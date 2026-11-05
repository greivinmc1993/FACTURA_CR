const {app, BrowserWindow, Menu, ipcMain, dialog, shell} = require('electron');
const fs=require('node:fs/promises');
const path = require('node:path');
let server;
let mainWindow;
const dev = process.argv.includes('--dev');
// QA opcional: el ejecutable empaquetado usa datos aislados y genera una prueba de arranque.
// No se activa en el uso normal del programa.
const qaSmoke = process.argv.includes('--qa-smoke');
const qaArg = name => process.argv.find(arg => arg.startsWith(name+'='))?.slice(name.length+1);
const qaResultFile = qaSmoke ? qaArg('--qa-result') : null;
const qaDataDir = qaSmoke ? qaArg('--qa-data-dir') : null;
if(qaSmoke){
  if(!qaResultFile || !qaDataDir || !path.isAbsolute(qaResultFile) || !path.isAbsolute(qaDataDir)){
    console.error('QA empaquetado requiere --qa-result y --qa-data-dir absolutos');
    process.exit(2);
  }
  app.setPath('userData',qaDataDir);
}
let qaErrors=[];
async function writeSmokeResult(result){
 if(!qaSmoke)return;
 try{
  await fs.mkdir(path.dirname(qaResultFile),{recursive:true});
  await fs.writeFile(qaResultFile,JSON.stringify({...result,version:app.getVersion(),errors:qaErrors},null,2));
 }catch(error){console.error('No se pudo guardar evidencia QA:',error)}
}
async function runPackagedSmoke(){
 const maxAttempts=30;
 let dom;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  dom=await mainWindow.webContents.executeJavaScript(`(() => {
    const root=document.getElementById('root');
    const text=(root?.innerText||'').trim();
    return {
      title: document.title,
      rootPresent:!!root,
      visibleCharacters:text.length,
      hasBrand: text.includes('Factura') || text.includes('CR'),
      navButtons:document.querySelectorAll('aside nav button').length,
      hasCompanyNavigation:Array.from(document.querySelectorAll('aside nav button')).some(b=>b.innerText.includes('Empresas')),
      preloadPrinter:typeof window.facturacrPrinter?.list==='function',
      preloadReports:typeof window.facturacrReports?.savePdf==='function',
      preloadBackups:typeof window.facturacrBackups?.openFolder==='function'
    };
  })()`,true);
  if(dom.rootPresent&&dom.visibleCharacters>100&&dom.navButtons>=4&&dom.hasCompanyNavigation)break;
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 if(!dom?.rootPresent||dom.visibleCharacters<=100||dom.navButtons<4||!dom.hasCompanyNavigation||!dom.preloadPrinter||!dom.preloadReports||!dom.preloadBackups){
   throw Error('La interfaz empaquetada no está lista o el preload no funciona: '+JSON.stringify(dom));
 }
 const health=await mainWindow.webContents.executeJavaScript(`fetch('/api/health').then(async r => ({status:r.status,body:await r.json()}))`,true);
 if(health.status!==200||health.body?.ok!==true||health.body.version!==app.getVersion()){
   throw Error('Servidor interno no respondió correctamente: '+JSON.stringify(health));
 }
 const shot=qaArg('--qa-screenshot');
 if(shot&&path.isAbsolute(shot)){
   await fs.mkdir(path.dirname(shot),{recursive:true});
   await fs.writeFile(shot,(await mainWindow.webContents.capturePage()).toPNG());
 }
 return {success:true,dom,health:health.body,screenshot:shot||null};
}

ipcMain.handle('facturacr:list-printers',async event=>{if(event.sender!==mainWindow?.webContents)throw Error('Ventana no autorizada');return mainWindow.webContents.getPrintersAsync()});
ipcMain.handle('facturacr:print-ticket',async(event,html,settings={})=>{
 if(event.sender!==mainWindow?.webContents)return {success:false,error:'Ventana no autorizada'};
 if(typeof html!=='string'||html.length>1200000)return {success:false,error:'Tiquete inválido o demasiado grande'};
 const printWindow=new BrowserWindow({show:false,width:450,height:700,parent:mainWindow,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 try{
  await printWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  const printerName=String(settings.printerName||'');
  const silent=!!settings.silent;
  const copies=Math.max(1,Math.min(5,Number(settings.copies)||1));
  const printers=await mainWindow.webContents.getPrintersAsync();
  if(printerName&&!printers.some(p=>p.name===printerName))return {success:false,error:'La impresora configurada ya no está instalada en Windows.'};
  if(silent&&!printerName)return {success:false,error:'Selecciona una impresora para habilitar la impresión directa.'};
  return await new Promise(resolve=>printWindow.webContents.print({silent,deviceName:printerName||undefined,copies,printBackground:true,margins:{marginType:'none'}},(success,reason)=>resolve({success,cancelled:!success&&/cancel/i.test(String(reason)),error:success?'':reason||'Impresión cancelada o fallida'})));
 }catch(error){return {success:false,error:String(error.message||error)}}
 finally{if(!printWindow.isDestroyed())printWindow.destroy()}
});
// Genera un PDF real desde una ventana aislada, sin ventanas emergentes del navegador.
ipcMain.handle('facturacr:save-sales-pdf',async(event,html,filename,options={})=>{
 if(event.sender!==mainWindow?.webContents)return {success:false,error:'Ventana no autorizada'};
 if(typeof html!=='string'||html.length>5000000)return {success:false,error:'Reporte inválido o demasiado grande'};
 const safeName=String(filename||'FacturaCR_reporte.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120).replace(/\.pdf$/i,'')+'.pdf';
 const reportWindow=new BrowserWindow({show:false,width:1120,height:800,parent:mainWindow,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 try{
  const result=await dialog.showSaveDialog(mainWindow,{title:'Guardar documento como PDF',defaultPath:path.join(app.getPath('documents'),safeName),filters:[{name:'Archivo PDF',extensions:['pdf']}]});
  if(result.canceled||!result.filePath)return {success:false,cancelled:true};
  await reportWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  await reportWindow.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
  const pdf=await reportWindow.webContents.printToPDF({pageSize:'A4',landscape:options?.landscape!==false,printBackground:true,margins:{top:0.5,bottom:0.5,left:0.5,right:0.5}});
  await fs.writeFile(result.filePath,pdf);
  return {success:true,path:result.filePath};
 }catch(error){return {success:false,error:String(error.message||error)}}
 finally{if(!reportWindow.isDestroyed())reportWindow.destroy()}
});
// Open only FacturaCR's known backups folder; the renderer cannot choose an arbitrary path.
ipcMain.handle('facturacr:open-backups-folder',async event=>{
 if(event.sender!==mainWindow?.webContents)return {success:false,error:'Ventana no autorizada'};
 try{
  const folder=path.join(app.getPath('userData'),'automatic-backups');
  await fs.mkdir(folder,{recursive:true});
  const error=await shell.openPath(folder);
  return error?{success:false,error}:{success:true};
 }catch(e){return {success:false,error:String(e.message||e)}}
});
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    if (!dev) {
      const {startServer} = await import('../server/index.js');
      server = await startServer({dataDir:app.getPath('userData'),port:0,staticDir:path.join(__dirname,'../dist')});
    }
    mainWindow = new BrowserWindow({width:1180,height:760,minWidth:850,minHeight:580,
      title:'FacturaCR', icon:path.join(__dirname,'../build/icon.png'),
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')}});
    if(qaSmoke){
      mainWindow.webContents.on('render-process-gone',(_event,details)=>qaErrors.push('Renderer cerrado: '+details.reason));
      mainWindow.webContents.on('console-message',(_event,details)=>{
        if(details.level==='error'||details.level===3) qaErrors.push(String(details.message).slice(0,500));
      });
    }
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',(event,url)=>{
      const allowed = dev ? 'http://127.0.0.1:5173/' : `http://127.0.0.1:${server.port}/`;
      if (!url.startsWith(allowed)) event.preventDefault();
    });
    await mainWindow.loadURL(dev?'http://127.0.0.1:5173':`http://127.0.0.1:${server.port}`);
    if(qaSmoke){
      const result=await runPackagedSmoke();
      await writeSmokeResult(result);
      app.quit();
    }
  } catch(err) {
    console.error('No se pudo iniciar FacturaCR:',err);
    if(qaSmoke){await writeSmokeResult({success:false,error:String(err.stack||err)});process.exitCode=1}
    app.quit();
  }
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(server)server.close().catch(console.error);});
