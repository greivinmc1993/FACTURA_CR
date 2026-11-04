const {app, BrowserWindow, Menu, ipcMain} = require('electron');
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
