const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{
const {csvCell,csvDocument,reportHtml}=await import(pathToFileURL(path.join(__dirname,'../server/report-format.js')).href);
let n=0;const check=(name,fn)=>{fn();n++;console.log('OK '+name)};
check('Negativos numéricos sin comillas simples',()=>{assert.equal(csvCell(-10030000),'"-10030000"');assert.equal(csvCell('-1'),'"-1"')});
check('UTF-8 BOM y separador para Excel regional',()=>{let c=csvDocument(['Artículo','Variación'],[['Piñata niño',-3]]);assert.ok(c.startsWith('\ufeffsep=;\r\n'));assert.ok(c.includes('Piñata niño'));assert.ok(c.includes('"-3"'))});
check('Bloqueo de fórmulas externas',()=>{assert.equal(csvCell('=HYPERLINK(1)'),`"'=HYPERLINK(1)"`);assert.equal(csvCell('+SUM(1)'),`"'+SUM(1)"`)});
check('SKU con ceros preservado en Excel CSV',()=>{assert.equal(csvCell('00123',{identifier:true}),`"=""00123"""`)});
check('HTML PDF escapa caracteres sin perder tildes',()=>{const s=reportHtml({title:'Kárdex',headers:['Artículo'],rows:[['Piñata <especial>']]});assert.ok(s.includes('Piñata &lt;especial&gt;'));assert.ok(s.includes('charset="UTF-8"'))});
const f=fs.readFileSync(path.join(__dirname,'../server/kardex.js'),'utf8');
check('Kardex CSV, XLSX y PDF comparten filtros',()=>{for(const extension of ['csv','xlsx','html'])assert.ok(f.includes('kardex/export.'+extension))});
check('Rutas PDF de catálogo y movimientos',()=>{const s=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');assert.ok(s.includes('products/export.html'));assert.ok(s.includes('movements/export.html'));assert.ok(s.includes('alerts/export.html'))});
const m=fs.readFileSync(path.join(__dirname,'../src/main.jsx'),'utf8');
check('PDF y Excel disponibles en UI',()=>{assert.ok(m.includes('Guardar movimientos PDF'));assert.ok(m.includes('Guardar PDF catálogo'));assert.ok(m.includes('Exportar Excel .xlsx'))});
console.log('QA exportaciones '+n+'/'+n);
})().catch(e=>{console.error(e);process.exitCode=1});
