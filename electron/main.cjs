const {app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const fs=require('node:fs/promises');
const path = require('node:path');
let server;
let mainWindow;
const dev = process.argv.includes('--dev');
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
ipcMain.handle('facturacr:save-sales-pdf',async(event,html,filename)=>{
 if(event.sender!==mainWindow?.webContents)return {success:false,error:'Ventana no autorizada'};
 if(typeof html!=='string'||html.length>5000000)return {success:false,error:'Reporte inválido o demasiado grande'};
 const safeName=String(filename||'FacturaCR_reporte.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120).replace(/\.pdf$/i,'')+'.pdf';
 const reportWindow=new BrowserWindow({show:false,width:1120,height:800,parent:mainWindow,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 try{
  const result=await dialog.showSaveDialog(mainWindow,{title:'Guardar reporte de ventas como PDF',defaultPath:path.join(app.getPath('documents'),safeName),filters:[{name:'Archivo PDF',extensions:['pdf']}]});
  if(result.canceled||!result.filePath)return {success:false,cancelled:true};
  await reportWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  await reportWindow.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
  const pdf=await reportWindow.webContents.printToPDF({pageSize:'A4',landscape:true,printBackground:true,margins:{top:0.5,bottom:0.5,left:0.5,right:0.5}});
  await fs.writeFile(result.filePath,pdf);
  return {success:true,path:result.filePath};
 }catch(error){return {success:false,error:String(error.message||error)}}
 finally{if(!reportWindow.isDestroyed())reportWindow.destroy()}
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
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',(event,url)=>{
      const allowed = dev ? 'http://127.0.0.1:5173/' : `http://127.0.0.1:${server.port}/`;
      if (!url.startsWith(allowed)) event.preventDefault();
    });
    await mainWindow.loadURL(dev?'http://127.0.0.1:5173':`http://127.0.0.1:${server.port}`);
  } catch(err) { console.error('No se pudo iniciar FacturaCR:',err); app.quit(); }
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(server)server.close().catch(console.error);});
