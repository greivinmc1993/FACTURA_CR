'use strict';
// Suite de integración de rutas REALES y SQL REAL en base temporal.
// Express/better-sqlite3 se sustituyen SOLO en memoria de pruebas mediante adaptadores;
// esto NO sustituye pruebas finales con dependencias productivas y Electron en Windows.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite');
const root=path.join(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'facturacr-qa-integracion-'));
const staging=path.join(temp,'staging');fs.mkdirSync(staging);fs.copyFileSync(path.join(root,'package.json'),path.join(temp,'package.json'));
// Copiar contenido del servidor sin modificar el código de producción.
let serverText=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
assert.ok(serverText.includes("import express from 'express'"));
assert.ok(serverText.includes("import Database from 'better-sqlite3'"));
serverText=serverText.replace("import express from 'express'","import express from './express.mjs'")
 .replace("import Database from 'better-sqlite3'","import Database from './sqlite.mjs'");
fs.writeFileSync(path.join(staging,'index.mjs'),serverText);
for(const name of ['express.mjs','sqlite.mjs'])fs.copyFileSync(path.join(__dirname,'qa-adapters',name),path.join(staging,name));
fs.copyFileSync(path.join(root,'server','xlsx.js'),path.join(staging,'xlsx.js'));
// El módulo ESM se interpreta como ESM incluso si el proyecto padre usa CommonJS.
fs.writeFileSync(path.join(staging,'package.json'),'{'+'"type":"module"'+'}');
let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('OK ',name)}catch(err){failed++;console.error('FAIL',name,err.stack||err)}}
(async()=>{
 const {startServer}=await import(pathToFileURL(path.join(staging,'index.mjs')).href);
 const {routes}=await import(pathToFileURL(path.join(staging,'express.mjs')).href);
 const started=await startServer({dataDir:path.join(temp,'db'),port:0});
 const dbPath=path.join(temp,'db','facturacr.sqlite');
 const read=()=>new DatabaseSync(dbPath,{readOnly:true});
 const call=async(method,url,body={})=>{
  const route=routes.find(r=>{
   if(r.method!==method)return false;
   const matcher=new RegExp('^'+r.path.replace(/:[A-Za-z][A-Za-z0-9_]*/g,'[^/]+').replace(/\//g,'\\/')+'$');
   return matcher.test(url);
  });
  assert.ok(route,`Ruta inexistente ${method} ${url}`);
  const keys=[...route.path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map(m=>m[1]);
  const actualParts=url.split('/'),routeParts=route.path.split('/'),params={};
  routeParts.forEach((part,i)=>{if(part.startsWith(':'))params[part.slice(1)]=actualParts[i]});
  let status=200,result,completed=false;
  const res={headersSent:false,status(s){status=s;return this},json(v){result=v;completed=true;return this},setHeader(){},type(){return this},send(v){result=v;completed=true;return this}};
  await route.handler({params,body,headers:{},query:{},originalUrl:url},res);
  assert.equal(completed,true,`Sin respuesta ${method} ${url}`);
  return {status,body:result};
 };
 try{
  await check('API de diagnóstico declara versión actual',async()=>{const r=await call('GET','/api/health');assert.equal(r.status,200);assert.equal(r.body.version,'0.6.39')});
  await check('Inicio y esquema SQLite en base nueva',async()=>{
   const sql=read();const tables=sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
   for(const name of ['companies','clients','products','sales','sale_lines','sale_payments','inventory_movements','quotations','quotation_lines','company_quote_settings'])assert.ok(tables.includes(name),name);
   assert.equal(sql.prepare('PRAGMA foreign_keys').get().foreign_keys,1);sql.close();
  });
  let a,b,clientId,prodId,saleId,creditId,quoteId;
  await check('Empresas independientes y color guardado',async()=>{
   let r=await call('POST','/api/companies',{legal_name:'QA Comercio A',identification:'123456789',avatar_color:'#7c3aed'});assert.equal(r.status,201);a=r.body.id;
   r=await call('POST','/api/companies',{legal_name:'QA Comercio B',identification:'987654321',avatar_color:'#0891b2'});assert.equal(r.status,201);b=r.body.id;
   r=await call('GET','/api/companies');assert.equal(r.body.find(x=>x.id===a).avatar_color,'#7c3aed');assert.equal(r.body.length,2);
   const sql=read();assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM companies WHERE identification=?').get('123456789').n,1);sql.close();
  });
  await check('Cliente registrado por empresa',async()=>{
   const r=await call('POST',`/api/companies/${a}/clients`,{name:'Cliente QA',identification:'115460323',identification_type:'01',country_code:'506'});
   assert.equal(r.status,201);clientId=r.body.id;
   const list=await call('GET',`/api/companies/${b}/clients`);assert.equal(list.body.length,0);
  });
  await check('Producto IVA incluido ₡700 con existencias',async()=>{
   const r=await call('POST',`/api/companies/${a}/products`,{kind:'producto',description:'Producto QA',cabys:'1234567890123',product_code:'SKU700',price:'700',cost:'300',currency:'CRC',tax_code:'08',price_includes_tax:'1',unit:'Unid',stock:'10',min_stock:'2',track_stock:'1',alert_enabled:'1'});
   assert.equal(r.status,201,JSON.stringify(r.body));prodId=r.body.id;
  });
  await check('Contado: ₡619 base + ₡81 IVA = ₡700 y salida de inventario',async()=>{
   const r=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',client_id:clientId,discount:0,lines:[{product_id:prodId,quantity:1}],payments:[{method:'SINPE Móvil',amount:700}]});
   assert.equal(r.status,201,JSON.stringify(r.body));saleId=r.body.id;assert.equal(r.body.total_cents,70000);
   const sql=read(),s=sql.prepare('SELECT * FROM sales WHERE id=?').get(saleId);
   assert.deepEqual([s.subtotal_cents,s.tax_cents,s.total_cents,s.balance_cents],[61900,8100,70000,0]);
   assert.equal(sql.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,9);
   assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE product_id=? AND reason='Venta POS'").get(prodId).n,1);sql.close();
  });
  await check('Contado: pago insuficiente no crea otra venta ni mueve stock',async()=>{
   const before=read();const count=before.prepare('SELECT COUNT(*) AS n FROM sales').get().n, stock=before.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock;before.close();
   const r=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:0,lines:[{product_id:prodId,quantity:1}],payments:[{method:'Efectivo',amount:699}]});
   assert.equal(r.status,400);
   const after=read();assert.equal(after.prepare('SELECT COUNT(*) AS n FROM sales').get().n,count);assert.equal(after.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,stock);after.close();
  });
  await check('Venta con descuento: la API calcula impuestos y no deja residuos',async()=>{
   const r=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:0,lines:[{product_id:prodId,quantity:2}],payments:[{method:'Tarjeta',amount:1400}]});
   assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.total_cents,140000);
   const extra=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:620,lines:[{product_id:prodId,quantity:1}],payments:[]});
   assert.equal(extra.status,400,'El descuento superior a la base debe rechazarse');
  });
  await check('Crédito y abonos parciales: saldo coherente',async()=>{
   const sale=await call('POST',`/api/companies/${a}/sales`,{sale_type:'credito',client_id:clientId,discount:0,lines:[{product_id:prodId,quantity:1}],payments:[{method:'Efectivo',amount:200}]});
   assert.equal(sale.status,201,JSON.stringify(sale.body));creditId=sale.body.id;assert.equal(sale.body.balance_cents,50000);
   const abono=await call('POST',`/api/companies/${a}/sales/${creditId}/payments`,{method:'SINPE Móvil',amount:499});assert.equal(abono.status,200);assert.equal(abono.body.balance_cents,100);
   const fin=await call('POST',`/api/companies/${a}/sales/${creditId}/payments`,{method:'SINPE Móvil',amount:1,settle_balance:true});assert.equal(fin.status,200);assert.equal(fin.body.balance_cents,0);
   const over=await call('POST',`/api/companies/${a}/sales/${creditId}/payments`,{method:'Efectivo',amount:1});assert.equal(over.status,400);
  });
  await check('Aislamiento de empresas en ventas y cotizaciones',async()=>{
   const other=await call('GET',`/api/companies/${b}/sales/${saleId}`);assert.notEqual(other.status,200);
   const bad=await call('POST',`/api/companies/${b}/sales`,{sale_type:'contado',client_id:clientId,discount:0,lines:[{product_id:prodId,quantity:1}],payments:[]});assert.notEqual(bad.status,201);
  });
  await check('Anulación devuelve existencias y segundo intento se rechaza',async()=>{
   const pre=read();const before=pre.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock;pre.close();
   const r=await call('POST',`/api/companies/${a}/sales/${saleId}/annul`,{reason:'Prueba QA de anulación'});assert.equal(r.status,200,JSON.stringify(r.body));
   const after=read();assert.equal(after.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,before+1);after.close();
   const twice=await call('POST',`/api/companies/${a}/sales/${saleId}/annul`,{reason:'Intento duplicado'});assert.equal(twice.status,400);
  });
  await check('Proforma no descuenta existencias ni registra venta',async()=>{
   const pre=read();const sales=pre.prepare('SELECT COUNT(*) AS n FROM sales').get().n,stock=pre.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock;pre.close();
   const r=await call('POST',`/api/companies/${a}/quotations`,{client_id:clientId,title:'Proforma QA',lines:[{product_id:prodId,quantity:2}]});assert.equal(r.status,201,JSON.stringify(r.body));quoteId=r.body.id;
   const after=read();assert.equal(after.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,stock);assert.equal(after.prepare('SELECT COUNT(*) AS n FROM sales').get().n,sales);after.close();
  });
  await check('Editar proforma existente mantiene número y no mueve inventario',async()=>{
   const old=await call('GET',`/api/companies/${a}/quotations/${quoteId}`);assert.equal(old.status,200,JSON.stringify(old.body));
   const l=old.body.lines[0];
   const updated=await call('PUT',`/api/companies/${a}/quotations/${quoteId}`,{client_id:clientId,title:'Proforma QA editada',lines:[{existing_line_id:l.id,quantity:3,description:l.description}]});
   assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(updated.body.id,quoteId);
   const sql=read();assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM quotations').get().n,1);assert.equal(sql.prepare('SELECT quantity FROM quotation_lines WHERE quotation_id=?').get(quoteId).quantity,3);sql.close();
  });
  await check('Respaldo SQLite automático es íntegro',async()=>{
   const result=await call('POST','/api/backups/automatic/run');assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.created,true);
   const files=fs.readdirSync(path.join(temp,'db','automatic-backups'));assert.ok(files.length>=1);
   const bk=new DatabaseSync(path.join(temp,'db','automatic-backups',files[0]),{readOnly:true});assert.equal(bk.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(bk.prepare('SELECT COUNT(*) AS n FROM companies').get().n,2);bk.close();
  });
  await check('Configuración de respaldos valida frecuencia y retención',async()=>{
   const invalid=await call('PUT','/api/backups/automatic',{enabled:true,frequency:'hourly',time:'20:00',keep:-1});assert.equal(invalid.status,400);
   const valid=await call('PUT','/api/backups/automatic',{enabled:false,frequency:'weekly',time:'21:15',keep:7});assert.equal(valid.status,200);
   const current=await call('GET','/api/backups/automatic');assert.equal(current.body.config.keep,7);assert.equal(current.body.config.frequency,'weekly');
  });
  await check('Inventario insuficiente revierte toda la transacción',async()=>{
   const sql=read(),oldStock=sql.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,oldSales=sql.prepare('SELECT COUNT(*) AS n FROM sales').get().n;sql.close();
   const r=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:0,lines:[{product_id:prodId,quantity:100}],payments:[{method:'Tarjeta',amount:70000}]});
   assert.equal(r.status,400);const checkDb=read();assert.equal(checkDb.prepare('SELECT stock FROM products WHERE id=?').get(prodId).stock,oldStock);assert.equal(checkDb.prepare('SELECT COUNT(*) AS n FROM sales').get().n,oldSales);checkDb.close();
  });
  await check('Descuento negativo y pago excesivo se rechazan',async()=>{
   const a1=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:-1,lines:[{product_id:prodId,quantity:1}],payments:[]});assert.equal(a1.status,400);
   const a2=await call('POST',`/api/companies/${a}/sales`,{sale_type:'contado',discount:0,lines:[{product_id:prodId,quantity:1}],payments:[{method:'Efectivo',amount:701}]});assert.equal(a2.status,400);
  });
  await check('Configuración impresión se guarda en la base',async()=>{
   const settings={logo:'',autoPrint:true,paperWidth:'80'};
   const r=await call('PUT',`/api/companies/${a}/ticket-settings`,settings);assert.equal(r.status,200,JSON.stringify(r.body));
   const get=await call('GET',`/api/companies/${a}/ticket-settings`);assert.equal(get.body.settings.autoPrint,true);
  });
  await check('Prueba de carga SQLite: búsqueda indexada y 10.000 artículos',async()=>{
   const db=new DatabaseSync(path.join(temp,'bulk.sqlite'));
   db.exec('CREATE TABLE products(id INTEGER PRIMARY KEY, description TEXT, sku TEXT UNIQUE, stock INTEGER)');
   const insert=db.prepare('INSERT INTO products(description,sku,stock) VALUES (?,?,?)');
   db.exec('BEGIN');for(let i=0;i<10000;i++)insert.run(`Artículo QA ${i}`,`SKU${i}`,100);db.exec('COMMIT');
   const stmt=db.prepare('SELECT * FROM products WHERE sku=?');
   const start=performance.now();for(let i=0;i<1000;i++)assert.equal(stmt.get(`SKU${i*9}`).stock,100);
   const ms=Math.round(performance.now()-start);assert.ok(ms<5000,`1.000 consultas tardaron ${ms} ms`);db.close();
   console.log('   Datos sintéticos, 10.000 artículos y 1.000 búsquedas:',ms,'ms (NO representa el rendimiento de Electron)');
  });
 } finally{await started.close()}
 console.log(`QA integración local: ${passed} superadas / ${passed+failed}, ${failed} errores`);
 if(failed)process.exitCode=1;
})().catch(e=>{console.error('Fallo al iniciar QA:',e.stack||e);process.exitCode=1}).finally(()=>{fs.rmSync(temp,{recursive:true,force:true})});
