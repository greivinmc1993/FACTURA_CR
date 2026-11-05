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
 await test('Respaldo descargable es SQLite íntegro y contiene la empresa',async()=>{
  const response=await fetch(base+'/api/backups/download');
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,16).toString('ascii'),'SQLite format 3\0');
  const backupPath=path.join(dir,'qa-backup-descargado.sqlite');
  fs.writeFileSync(backupPath,bytes);
  const Database=require('better-sqlite3');
  const backup=new Database(backupPath,{readonly:true,fileMustExist:true});
  try{
   assert.equal(backup.pragma('integrity_check',{simple:true}),'ok');
   assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM companies').get().n,1);
  }finally{backup.close()}
 });
 await test('Respaldo automático crea un archivo SQLite válido en carpeta temporal',async()=>{
  const res=await request('POST','/api/backups/automatic/run');
  assert.equal(res.status,200,JSON.stringify(res.body));
  assert.equal(res.body.created,true);
  const status=await request('GET','/api/backups/automatic');
  assert.equal(status.status,200);
  assert.ok(status.body.files.includes(res.body.file));
  const Database=require('better-sqlite3');
  const file=path.join(dir,'automatic-backups',res.body.file);
  const backup=new Database(file,{readonly:true,fileMustExist:true});
  try{assert.equal(backup.pragma('integrity_check',{simple:true}),'ok')}
  finally{backup.close()}
 });
 await test('Restauración inválida se rechaza sin alterar los datos',async()=>{
  const before=fs.statSync(path.join(dir,'facturacr.sqlite')).size;
  const invalid=Buffer.alloc(1024,0x41);
  const response=await fetch(base+'/api/backups/restore',{method:'POST',headers:{'content-type':'application/octet-stream','content-length':String(invalid.length)},body:invalid});
  assert.equal(response.status,400);
  const r=await request('GET','/api/companies');
  assert.equal(r.status,200);assert.equal(r.body.length,1);
  const Database=require('better-sqlite3');
  const db=new Database(path.join(dir,'facturacr.sqlite'),{readonly:true});
  try{assert.equal(db.pragma('integrity_check',{simple:true}),'ok')}
  finally{db.close()}
  assert.ok(fs.statSync(path.join(dir,'facturacr.sqlite')).size>=before);
 });
 await test('Se rechaza configuración de respaldo fuera de rango',async()=>{
  const r=await request('PUT','/api/backups/automatic',{enabled:true,frequency:'daily',time:'25:90',keep:0});
  assert.equal(r.status,400);
 });
 console.log(`QA servidor REAL: ${checks}/${checks} pruebas aprobadas`);
}
main().catch(err=>{console.error('QA servidor REAL falló:',err.stack||err);process.exitCode=1})
.finally(async()=>{
 if(server){try{await server.close()}catch(e){console.error('Cierre:',e);process.exitCode=1}}
 try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:8,retryDelay:150})}
 catch(e){console.error('No se pudo eliminar el directorio temporal:',e.message);process.exitCode=1}
});
