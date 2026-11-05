// Contrato del dashboard: que se agregue en SQLite y esté separado por empresa.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/main.jsx'),'utf8');
const panel=fs.readFileSync(path.join(root,'src/DashboardPanel.jsx'),'utf8');
const checks=[
 ['Ruta de dashboard exige empresa válida',()=>assert.ok(server.includes("app.get('/api/companies/:companyId/dashboard'")&&server.includes('companyId=saleCompany(req)'))],
 ['Dashboard filtra ventas anuladas',()=>assert.ok(server.includes("status='activa' AND created_at BETWEEN ? AND ?"))],
 ['Agregación sin límite de historial de 500 ventas',()=>{const endpoint=server.split("app.get('/api/companies/:companyId/dashboard'")[1].split('// Ajustes reutilizables de proformas')[0];assert.ok(endpoint.includes('SUM(total_cents)'));assert.ok(!endpoint.includes('LIMIT 500'))}],
 ['Ventas y pagos se agrupan por fechas distintas',()=>assert.ok(server.includes('p.created_at BETWEEN ? AND ?')&&server.includes('s.created_at BETWEEN ? AND ?'))],
 ['Dashboard conectado a la navegación y empresa activa',()=>assert.ok(ui.includes("tab==='dashboard'?<DashboardPanel companyId={selected} company={current}/>"))],
 ['Exportación CSV y estados de carga y error',()=>assert.ok(panel.includes('downloadCsv')&&panel.includes('setBusy(true)')&&panel.includes('role="alert"'))],
 ['Balance global separado del período',()=>assert.ok(server.includes("balance_cents>0")&&panel.includes('todas las fechas'))],
];let pass=0;for(const [label,fn]of checks){fn();pass++;console.log('PASS',label)}
console.log(`QA dashboard: ${pass}/${checks.length}`);
