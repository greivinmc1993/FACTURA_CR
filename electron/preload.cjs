const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('facturacrPrinter',{print:(html,settings)=>ipcRenderer.invoke('facturacr:print-ticket',html,settings),list:()=>ipcRenderer.invoke('facturacr:list-printers')});
