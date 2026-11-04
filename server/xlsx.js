import { deflateRawSync } from 'node:zlib';

// Escritor XLSX mínimo, sin dependencias externas. Strings como texto real,
// números como números. Evita que Excel ejecute fórmulas provenientes de datos.
const xmlEscape = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const colName = i => {let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(entries){const files=[],central=[];let offset=0;for(const [name,content] of entries){
 const n=Buffer.from(name),raw=Buffer.from(content),packed=deflateRawSync(raw),crc=crc32(raw);
 const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(8,6);head.writeUInt16LE(8,8);head.writeUInt32LE(crc,14);head.writeUInt32LE(packed.length,18);head.writeUInt32LE(raw.length,22);head.writeUInt16LE(n.length,26);
 files.push(head,n,packed);
 const cent=Buffer.alloc(46);cent.writeUInt32LE(0x02014b50,0);cent.writeUInt16LE(20,4);cent.writeUInt16LE(20,6);cent.writeUInt16LE(8,8);cent.writeUInt16LE(8,10);cent.writeUInt32LE(crc,16);cent.writeUInt32LE(packed.length,20);cent.writeUInt32LE(raw.length,24);cent.writeUInt16LE(n.length,28);cent.writeUInt32LE(offset,42);central.push(cent,n);
 offset+=head.length+n.length+packed.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);return Buffer.concat([...files,...central,end]);}
export function makeXlsx(sheetName,headers,rows){
 if(rows.length>1048575)throw Error('Excel admite hasta 1.048.576 filas por hoja. Exporta en lotes.');
 const all=[headers,...rows];const rowXml=all.map((row,ri)=>`<row r="${ri+1}">${row.map((value,ci)=>{
  const ref=`${colName(ci)}${ri+1}`;
  if(ri!==0&&typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}" s="2"><v>${value}</v></c>`;
  const str=String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
  return `<c r="${ref}" s="${ri===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(str)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const widths=headers.map((h,i)=>Math.max(14,Math.min(48,Math.max(String(h).length+3,...rows.slice(0,150).map(r=>String(r[i]??'').length+2)))));
 const cols=`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rowXml}</sheetData><autoFilter ref="A1:${colName(headers.length-1)}${Math.max(1,all.length)}"/></worksheet>`;
 const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF147E70"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const entries=[
 ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
 ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
 ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
 ['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet]];
 return zip(entries);
}
