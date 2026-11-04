const {app, BrowserWindow, Menu} = require('electron');
const path = require('node:path');
let server;
let mainWindow;
const dev = process.argv.includes('--dev');
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    if (!dev) {
      const {startServer} = await import('../server/index.js');
      server = await startServer({dataDir:app.getPath('userData'),port:0,staticDir:path.join(__dirname,'../dist')});
    }
    mainWindow = new BrowserWindow({width:1180,height:760,minWidth:850,minHeight:580,
      title:'FacturaCR', icon:path.join(__dirname,'../build/icon.png'),
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
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
