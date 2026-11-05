// Smoke QA con dependencias REALES de Express + better-sqlite3.
// Ejecutar después de npm ci: npm run qa:real-server
// Crea archivos solo en una carpeta temporal que elimina al terminar.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'facturacr-qa-nativo-'));
let server;
let checks=0;
async function test(name,fn){await fn();checks++;console.log('OK',name)}
async function main(){
 const {startServer}=await import(pathToFileURL(path.join(root,'server/index.js')).href);
 server=await startServer({dataDir:dir,port:0});
 const base=`http://127.0.0.1:${server.port}`;
 const request=async(method,url,body)=>{
  const options={method,headers:{}};
  if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body)}
  const res=await fetch(base+url,options);
  return {status:res.status,body:await res.json()};
 };
 await test('HTTP health responde versión actual',async()=>{
  const r=await request('GET','/api/health');
  const expected=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  assert.equal(r.status,200);assert.equal(r.body.version,expected);assert.equal(r.body.ok,true);
 });
 await test('SQLite nativo crea empresa y la recupera por HTTP',async()=>{
  const r=await request('POST','/api/companies',{legal_name:'Comercio temporal QA',identification:'123456789'});
  assert.equal(r.status,201,JSON.stringify(r.body));
  const list=await request('GET','/api/companies');
  assert.equal(list.status,200);assert.equal(list.body.length,1);
  assert.equal(list.body[0].identification,'123456789');
 });
 await test('API real rechaza identificación empresarial duplicada',async()=>{
  const r=await request('POST','/api/companies',{legal_name:'Duplicado',identification:'123456789'});
  assert.equal(r.status,409,JSON.stringify(r.body));
 });
 await test('Servidor informa espacio de respaldo sobre carpeta temporal',async()=>{
  const r=await request('GET','/api/backups/status');
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.ok(r.body.databaseBytes>0);
 });
 await test('Datos temporales persistidos en SQLite',async()=>{
  const Database=require('better-sqlite3');
  const db=new Database(path.join(dir,'facturacr.sqlite'),{readonly:true});
  try{assert.equal(db.prepare('SELECT COUNT(*) AS n FROM companies').get().n,1);
      assert.equal(db.pragma('integrity_check',{simple:true}),'ok');}
  finally{db.close()}
 });
 console.log(`QA servidor REAL: ${checks}/${checks} pruebas aprobadas`);
}
main().catch(err=>{console.error('QA servidor REAL falló:',err.stack||err);process.exitCode=1})
.finally(async()=>{
 if(server){try{await server.close()}catch(e){console.error('Cierre:',e);process.exitCode=1}}
 try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:150})}
 catch(e){console.error('No se pudo eliminar el directorio temporal:',e.message);process.exitCode=1}
});
