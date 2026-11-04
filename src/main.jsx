import React,{useEffect,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const APP_VERSION = __APP_VERSION__;
const ACTIVE_COMPANY_KEY = 'facturacr_active_company_id';
const roundCRC=cents=>Math.round(Number(cents||0)/100)*100;
const provinces={'1':'San José','2':'Alajuela','3':'Cartago','4':'Heredia','5':'Guanacaste','6':'Puntarenas','7':'Limón'};
const tariffs=[
 ['08','13% · Tarifa general'],['04','4% · Reducida'],['03','2% · Reducida'],
 ['02','1% · Reducida'],['09','0.5% · Reducida'],['01','0% · Con derecho a crédito'],
 ['10','Exento · Código 10'],['11','0% · Sin derecho a crédito'],
 ['05','Transitorio 0% · Solo notas de ajuste'],['06','Transitorio 4% · Solo notas de ajuste'],
 ['07','Transitorio 8% · Solo notas de ajuste']
];
const paymentMethods=[['01','Efectivo'],['02','Tarjeta'],['03','Cheque'],['04','Transferencia bancaria'],['05','Recaudado por terceros'],['06','SINPE Móvil'],['07','Plataforma digital'],['99','Otros']];
const geoBase='https://ubicaciones-cr.ryze-cr.workers.dev';
const pad2=v=>String(v).padStart(2,'0');
const rates={'01':0,'02':1,'03':2,'04':4,'05':0,'06':4,'07':8,'08':13,'09':0.5,'10':0,'11':0};
const blankClient={name:'',trade_name:'',identification_type:'01',identification:'',email:'',phone:'',phone_alt:'',country_code:'506',province:'',canton:'',district:'',address:'',activity_code:'',preferred_payment:'',notes:''};
const blankProduct={kind:'producto',product_code:'',barcode:'',description:'',cabys:'',price:'',price_includes_tax:'1',cost:'0',currency:'CRC',tax_code:'08',tax_rate:13,unit:'Unid',stock:'0',min_stock:'0',track_stock:'1',alert_enabled:'1',image_data:'',notes:''};
async function api(url,options={}){
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 if(response.status===204)return null;
 const contentType=response.headers.get('content-type')||'';
 if(!contentType.includes('application/json'))throw Error(`El servidor devolvió una respuesta inesperada (${response.status}). Comprueba que FacturaCR esté iniciado correctamente y reinicia la aplicación.`);
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Error en la solicitud');
 return data;
}
function Field({title,children}){return <label className="field">{title}{children}</label>}
class ScreenErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={error:null}}
 static getDerivedStateFromError(error){return {error}}
 componentDidCatch(error,info){console.error('FacturaCR: error de interfaz',error,info)}
 render(){if(this.state.error)return <div style={{padding:32,fontFamily:'system-ui',color:'#193450',maxWidth:800,margin:'auto'}}><h2>No se pudo mostrar esta pantalla</h2><p>FacturaCR detectó un problema en la interfaz. Tus datos no se han eliminado.</p><pre style={{whiteSpace:'pre-wrap',background:'#eef2f6',padding:16,borderRadius:8}}>{String(this.state.error.message||this.state.error)}</pre><button type="button" onClick={()=>window.location.reload()}>Recargar FacturaCR</button></div>;return this.props.children}
}
const basePrice=p=>Number(p.price_includes_tax)===1?Number(p.price)/(1+Number(p.tax_rate||0)/100):Number(p.price);
const saleMoney=cents=>(Number(cents||0)/100).toLocaleString('es-CR',{minimumFractionDigits:0,maximumFractionDigits:0});
const ticketDefaults={width:'80',logo:'',thankYou:'¡Gracias por su compra!',social:'',showAddress:true,showPhone:true,showClient:true,showPayments:true,showTax:true,autoPrint:false,printerName:'',silent:false,copies:1,template:'classic'};
const safeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function buildTicketHtml(sale,company,settings){
 const t={...ticketDefaults,...settings},width=t.width==='58'?'58mm':'80mm';
 const money=n=>'₡'+saleMoney(n);
 const client=sale.client||{};
 const field=(label,value)=>value?`<p><strong>${safeHtml(label)}:</strong> ${safeHtml(value)}</p>`:'';
 const lines=(sale.lines||[]).map(l=>`<tr><td>${safeHtml(l.description)}<small>${safeHtml(l.quantity)} × ${money(l.unit_price_cents)}</small></td><td class="right">${money(l.total_cents)}</td></tr>`).join('');
 const subtotal=Number(sale.subtotal_cents??(sale.lines||[]).reduce((a,l)=>a+Number(l.subtotal_cents||0),0));
 const tax=Number(sale.tax_cents??(sale.lines||[]).reduce((a,l)=>a+Number(l.tax_cents||0),0));
 const discount=Number(sale.discount_cents||0);
 const logo=t.logo&&/^data:image\/(png|jpeg|webp);base64,/.test(t.logo)?`<img class="logo" src="${t.logo}" alt="Logotipo">`:'';
 const compact=t.template==='compact',modern=t.template==='modern';
 const companyBlock=`${field('Razón social',company?.legal_name)}${field('Cédula jurídica/física',company?.identification)}${t.showAddress?field('Dirección',company?.address):''}${t.showPhone?field('Teléfono',company?.phone):''}${field('Correo',company?.email)}${field('Sitio web',company?.website)}`;
 const clientBlock=t.showClient?`<section class="section"><strong>DATOS DEL CLIENTE</strong>${field('Nombre',client.name||sale.client_name||'Consumidor final')}${field('Nombre comercial',client.trade_name)}${field('Identificación',client.identification)}${field('Teléfono',client.phone)}${field('Correo',client.email)}${field('Dirección',client.address)}</section>`:'';
 // Nunca inventar clave ni consecutivo de Hacienda. Solo mostrar datos reales persistidos.
 const feBlock=sale.fe_consecutivo||sale.fe_clave?`<section class="section"><strong>COMPROBANTE ELECTRÓNICO</strong>${field('Consecutivo FE',sale.fe_consecutivo)}${field('Clave FE',sale.fe_clave)}${field('Estado Hacienda',sale.fe_estado||'Sin estado registrado')}</section>`:`<p class="muted">FE Hacienda: no emitida / pendiente de integración</p>`;
 return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Tiquete #${safeHtml(sale.id)}</title><style>@page{size:${width} auto;margin:2mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;width:${width};max-width:100%;margin:0 auto;padding:3mm;font-size:${compact?'9':'11'}px;overflow-wrap:anywhere}.center{text-align:center}.logo{max-width:80%;max-height:25mm;object-fit:contain}h2{font-size:${modern?'19':'16'}px;margin:6px 0}p{margin:4px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}td{vertical-align:top;padding:4px 0;border-bottom:1px dashed #bbb;overflow-wrap:anywhere}td.right{text-align:right;white-space:nowrap;width:36%}small{display:block;font-size:10px}.totals{margin-top:8px}.totals p{display:flex;justify-content:space-between}.total{font-size:16px;font-weight:bold;border-top:1px solid #111;padding-top:6px}.muted{font-size:10px}.foot{margin-top:12px;border-top:1px dashed #777;padding-top:8px;white-space:pre-wrap}.section{border-top:1px dashed #888;padding:6px 0;margin-top:7px}.section strong{font-size:10px}</style></head><body><header class="center">${logo}<h2>${safeHtml(company?.trade_name||company?.legal_name||'FacturaCR')}</h2>${companyBlock}</header><section class="section"><strong>${sale.status==='anulada'?'VENTA ANULADA':'TIQUETE COMERCIAL INTERNO'}</strong>${field('Número de tiquete',sale.id)}${field('Fecha',sale.created_at)}${field('Tipo de venta',sale.sale_type)}</section>${feBlock}${clientBlock}<section class="section"><strong>DETALLE DE VENTA</strong><table><tbody>${lines}</tbody></table></section><div class="totals"><p><span>Subtotal sin IVA</span><b>${money(subtotal)}</b></p><p><span>Descuento</span><b>− ${money(discount)}</b></p>${t.showTax?`<p><span>IVA</span><b>${money(tax)}</b></p>`:''}<p class="total"><span>TOTAL</span><span>${money(sale.total_cents)}</span></p><p><span>Saldo pendiente</span><span>${money(sale.balance_cents)}</span></p></div>${t.showPayments?`<p class="muted">Pagos: ${(sale.payments||[]).map(x=>`${safeHtml(x.method)} ${money(x.amount_cents)}`).join(' · ')||'Sin pagos'}</p>`:''}<div class="foot center">${safeHtml(t.thankYou)}${(t.social||company?.social)?`<p>${safeHtml(t.social||company.social)}</p>`:''}<p class="muted">Documento interno. No sustituye una factura electrónica autorizada por Hacienda.</p></div></body></html>`;
}
function SalesPanel({companyId,company,askConfirm}){
 const [products,setProducts]=useState([]),[clients,setClients]=useState([]),[sales,setSales]=useState([]);
 const [cart,setCart]=useState([]),[clientId,setClientId]=useState(''),[saleType,setSaleType]=useState('contado');
 const [cashTendered,setCashTendered]=useState(''),[discount,setDiscount]=useState('0'),[payments,setPayments]=useState([{method:'Efectivo',amount:''}]);
 const [query,setQuery]=useState(''),[historyQuery,setHistoryQuery]=useState(''),[notice,setNotice]=useState('');
 const [details,setDetails]=useState(null),[annulReason,setAnnulReason]=useState('');
 const [abonoAmount,setAbonoAmount]=useState(''),[abonoMethod,setAbonoMethod]=useState('Efectivo');
 const [creditSales,setCreditSales]=useState([]),[creditPayments,setCreditPayments]=useState([]),[creditFilter,setCreditFilter]=useState('todas'),[creditSearch,setCreditSearch]=useState(''),[creditTab,setCreditTab]=useState('ventas');
 const [ticketSettings,setTicketSettings]=useState(ticketDefaults),[ticketDraft,setTicketDraft]=useState(ticketDefaults),[ticketSavedMessage,setTicketSavedMessage]=useState(''),[ticketPreview,setTicketPreview]=useState(''),[ticketConfigOpen,setTicketConfigOpen]=useState(false);
 const [printers,setPrinters]=useState([]),[printerBusy,setPrinterBusy]=useState(false);
 useEffect(()=>{let saved=ticketDefaults;try{saved={...ticketDefaults,...JSON.parse(localStorage.getItem(`facturacr_ticket_${companyId}`)||'{}')}}catch{}setTicketSettings(saved);setTicketDraft(saved);setTicketSavedMessage('');setTicketConfigOpen(false);setTicketPreview('')},[companyId]);
 const updateTicket=(key,value)=>{setTicketDraft(old=>({...old,[key]:value}));setTicketSavedMessage('')};
 const saveTicketSettings=()=>{try{localStorage.setItem(`facturacr_ticket_${companyId}`,JSON.stringify(ticketDraft));setTicketSettings({...ticketDraft});setTicketSavedMessage('Ajustes guardados correctamente para esta empresa.')}catch(e){setNotice('No se pudieron guardar los ajustes: '+e.message)}};
 const discardTicketChanges=()=>{setTicketDraft({...ticketSettings});setTicketSavedMessage('Se descartaron los cambios sin guardar.')};
 const ticketHasChanges=JSON.stringify(ticketDraft)!==JSON.stringify(ticketSettings);
 const refreshPrinters=async()=>{if(!window.facturacrPrinter?.list)return;setPrinterBusy(true);try{const result=await window.facturacrPrinter.list();setPrinters(result||[])}catch(e){setNotice('No se pudieron consultar las impresoras: '+e.message)}finally{setPrinterBusy(false)}};
 useEffect(()=>{refreshPrinters()},[companyId]);
 const printHtml=async html=>{if(!window.facturacrPrinter)throw Error('Impresión disponible solo en Electron.');const result=await window.facturacrPrinter.print(html,{printerName:ticketSettings.printerName,silent:ticketSettings.silent,copies:Number(ticketSettings.copies)||1,width:ticketSettings.width});if(!result?.success&&!result?.cancelled)throw Error(result?.error||'No se pudo imprimir.');return result};
 const testTicket=async()=>{try{const demo={id:'PRUEBA',created_at:new Date().toLocaleString('es-CR'),client:{name:'Cliente de prueba',identification:'',phone:''},lines:[{description:'Artículo de prueba',quantity:1,unit_price_cents:100000,total_cents:113000,tax_cents:13000}],total_cents:113000,balance_cents:0,payments:[],discount_cents:0};await printHtml(buildTicketHtml(demo,company,ticketSettings));}catch(e){setNotice(e.message)}};
 const openTicket=async(id,print=false)=>{try{const sale=await api(`/api/companies/${companyId}/sales/${id}`);sale.client_name=sale.client?.name||clients.find(c=>Number(c.id)===Number(sale.client_id))?.name||'Consumidor final';const html=buildTicketHtml(sale,company,ticketSettings);if(print){await printHtml(html)}else setTicketPreview(html)}catch(e){setNotice(e.message)}};
 const methods=['Efectivo' ,'Tarjeta','SINPE Móvil','Transferencia bancaria','Cheque','Otros'];
 const loadCredits=async()=>{
  if(!companyId)return;
  try{const [cs,cp]=await Promise.all([api(`/api/companies/${companyId}/credit-history`),api(`/api/companies/${companyId}/credit-history/payments`)]);
   setCreditSales(Array.isArray(cs)?cs:[]);setCreditPayments(Array.isArray(cp)?cp:[]);
  }catch(e){setNotice('No se pudo cargar el histórico de créditos: '+e.message)}
 };
 const exportCredits=()=>{
  const headers=creditTab==='ventas'?['Venta','Fecha','Cliente','Estado','Total CRC','Abonado CRC','Saldo CRC']:['Abono','Venta','Fecha','Cliente','Método','Monto CRC','Estado venta'];
  const rows=creditTab==='ventas'?filteredCredits.map(s=>[s.id,s.created_at,s.client_name,s.status,s.total_cents/100,s.paid_cents/100,s.balance_cents/100]):filteredCreditPayments.map(a=>[a.id,a.sale_id,a.created_at,a.client_name,a.method,a.amount_cents/100,a.status]);
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv='\ufeffsep=;\r\n'+[headers,...rows].map(r=>r.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=creditTab==='ventas'?'FacturaCR_creditos.csv':'FacturaCR_abonos.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const filteredCredits=creditSales.filter(s=>{
  const search=[s.id,s.client_name,s.created_at].some(v=>String(v||'').toLowerCase().includes(creditSearch.toLowerCase()));
  const state=creditFilter==='todas'||(creditFilter==='pendientes'&&s.status==='activa'&&s.balance_cents>0)||(creditFilter==='pagadas'&&s.status==='activa'&&s.balance_cents===0)||(creditFilter==='anuladas'&&s.status==='anulada');return search&&state;
 });
 const filteredCreditPayments=creditPayments.filter(a=>[a.sale_id,a.client_name,a.created_at,a.method].some(v=>String(v||'').toLowerCase().includes(creditSearch.toLowerCase()))&&(creditFilter==='todas'||filteredCredits.some(s=>s.id===a.sale_id)));
 const load=async()=>{
  if(!companyId)return;
  try{
   const [p,c,h]=await Promise.all([api(`/api/companies/${companyId}/products`),api(`/api/companies/${companyId}/clients`),api(`/api/companies/${companyId}/sales`)]);
   setProducts(Array.isArray(p)?p:[]);setClients(Array.isArray(c)?c:[]);setSales(Array.isArray(h)?h:[]);
  }catch(e){setNotice(e.message)}
 };
 useEffect(()=>{setCart([]);setClientId('');setDetails(null);setCreditSales([]);setCreditPayments([]);setNotice('');load();loadCredits()},[companyId]);
 const add=product=>setCart(old=>old.some(l=>l.id===product.id)?old.map(l=>l.id===product.id?{...l,quantity:l.quantity+1}:l):[...old,{id:product.id,description:product.description,price:basePrice(product),tax_rate:Number(product.tax_rate),quantity:1}]);
 const subtotal=cart.reduce((sum,l)=>sum+roundCRC(Math.round(l.price*100))*l.quantity,0);
 const discountCents=roundCRC(Math.round(Math.max(0,Number(discount)||0)*100));
 const effectiveDiscount=Math.min(subtotal,discountCents);
 let allocated=0;
 const tax=cart.reduce((sum,l,i)=>{const part=i===cart.length-1?effectiveDiscount-allocated:Math.floor(effectiveDiscount*roundCRC(Math.round(l.price*100))*l.quantity/(subtotal||1)/100)*100;allocated+=part;return sum+roundCRC(Math.round((roundCRC(Math.round(l.price*100))*l.quantity-part)*l.tax_rate/100))},0);
 const total=subtotal-effectiveDiscount+tax;
 const cashSelected=payments.some(p=>p.method==='Efectivo');
 const nonCashPaid=payments.filter(p=>p.method!=='Efectivo').reduce((sum,p)=>sum+roundCRC(Math.round((Number(p.amount)||0)*100)),0);
 const tenderCents=cashSelected&&cashTendered!==''?Math.max(0,roundCRC(Math.round((Number(cashTendered)||0)*100))):0;
 const cashApplied=cashSelected?Math.min(tenderCents,Math.max(0,total-nonCashPaid)):0;
 const paid=nonCashPaid+cashApplied;
 const changeCents=cashSelected?Math.max(0,tenderCents-cashApplied):0;
 const actualPayments=payments.filter(p=>p.method!=='Efectivo'&&Number(p.amount)>0).map(p=>({method:p.method,amount:roundCRC(Math.round(Number(p.amount)*100))/100}));
 if(cashApplied>0)actualPayments.push({method:'Efectivo',amount:cashApplied/100});
 const submit=async()=>{
  try{
   const result=await api(`/api/companies/${companyId}/sales`,{method:'POST',body:JSON.stringify({sale_type:saleType,client_id:clientId||null,discount:discountCents/100,lines:cart.map(l=>({product_id:l.id,quantity:l.quantity})),payments:actualPayments})});
   setNotice(`Venta interna #${result.id} registrada. Total ₡${saleMoney(result.total_cents)}. Saldo ₡${saleMoney(result.balance_cents)}. No es comprobante electrónico de Hacienda.`);
   if(ticketSettings.autoPrint)try{await openTicket(result.id,true)}catch(e){setNotice(`Venta #${result.id} guardada; impresión pendiente: ${e.message}`)};
   setCart([]);setPayments([{method:'Efectivo',amount:''}]);setDiscount('0');setCashTendered('');await load();await loadCredits();
  }catch(e){setNotice(e.message)}
 };
 const finish=e=>{e.preventDefault();if(!cart.length){setNotice('Agrega al menos un artículo.');return}
  askConfirm('Confirmar venta',`¿Registrar esta venta ${saleType} por ₡${saleMoney(total)}? Se descontará el inventario.`,submit);
 };
 const showSale=async id=>{try{setDetails(await api(`/api/companies/${companyId}/sales/${id}`))}catch(e){setNotice(e.message)}};
 const saveAbono=async()=>{try{if(!details)return;await api(`/api/companies/${companyId}/sales/${details.id}/payments`,{method:'POST',body:JSON.stringify({method:abonoMethod,amount:roundCRC(Math.round(Number(abonoAmount)*100))/100})});setAbonoAmount('');setNotice('Abono registrado correctamente.');await load();await loadCredits();await showSale(details.id)}catch(e){setNotice(e.message)}};
 const annul=async id=>{try{await api(`/api/companies/${companyId}/sales/${id}/annul`,{method:'POST',body:JSON.stringify({reason:annulReason})});setDetails(null);setAnnulReason('');setNotice(`Venta #${id} anulada y existencias devueltas.`);await load();await loadCredits()}catch(e){setNotice(e.message)}};
 const exportSales=async()=>{try{const response=await fetch(`/api/companies/${companyId}/sales/export.csv`);if(!response.ok)throw Error('No se pudo exportar.');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FacturaCR_ventas.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}catch(e){setNotice(e.message)}};
 if(!companyId)return <div className="card">Selecciona una empresa en Empresas antes de registrar ventas.</div>;
 return <div className="salesModule">
  <div className="card"><h3>Punto de venta · {company?.trade_name||company?.legal_name}</h3><p className="hint">Registro comercial interno en colones. No emite factura electrónica ni valida comprobantes ante Hacienda.</p>{notice&&<p className="notice" role="status">{notice}</p>}
   <Field title="Buscar artículo, código o SKU"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, código o SKU"/></Field>
   <div className="posProducts">{products.filter(p=>p.currency==='CRC'&&(p.kind==='servicio'||(p.kind==='producto'&&(!Number(p.track_stock)||Number(p.stock)>0)))).filter(p=>[p.description,p.product_code,p.barcode].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase()))).slice(0,60).map(p=><button type="button" className="secondary" key={p.id} onClick={()=>add(p)}><span className="posProductVisual">{p.image_data?<img src={p.image_data} alt={`Foto de ${p.description}`}/>:<span className="posProductNoPhoto">Sin foto</span>}</span><strong>{p.description}</strong><small>{p.product_code||'Sin SKU'} · ₡{Math.round(basePrice(p)).toLocaleString('es-CR',{maximumFractionDigits:0})} sin IVA · {p.kind==='producto'?`Stock: ${p.stock}`:'Servicio'}</small></button>)}</div>
  </div>
  <form className="card posCartCard" onSubmit={finish} onKeyDown={e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA')e.preventDefault()}}><h3 className="posCartTitle">🛒 Carrito de compras <span>{cart.reduce((s,l)=>s+l.quantity,0)} artículos</span></h3>
   {cart.length===0?<p className="hint">Selecciona artículos para comenzar.</p>:<div className="movementHistory"><table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>Acción</th></tr></thead><tbody>{cart.map(l=><tr key={l.id}><td>{l.description}</td><td><input style={{width:90}} type="number" min="1" max="100000" step="1" value={l.quantity} onChange={e=>setCart(old=>old.map(x=>x.id===l.id?{...x,quantity:Number(e.target.value)}:x))}/></td><td>₡{saleMoney(roundCRC(Math.round(l.price*100))*l.quantity)}</td><td><button type="button" className="danger" onClick={()=>setCart(old=>old.filter(x=>x.id!==l.id))}>Quitar</button></td></tr>)}</tbody></table></div>}
   <div className="two"><Field title="Cliente"><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Consumidor final</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name} · {c.identification}</option>)}</select></Field><Field title="Condición de venta"><select value={saleType} onChange={e=>setSaleType(e.target.value)}><option value="contado">Contado</option><option value="credito">Crédito</option></select></Field></div>
   <Field title="Descuento total (₡)"><input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></Field>
   <div className="posTotals"><div><span>Subtotal sin IVA</span><strong>₡{saleMoney(subtotal)}</strong></div><div><span>Descuento</span><strong className="posDiscount">− ₡{saleMoney(effectiveDiscount)}</strong></div><div><span>IVA</span><strong>₡{saleMoney(tax)}</strong></div><div className="posGrandTotal"><span>TOTAL A PAGAR</span><strong>₡{saleMoney(total)}</strong></div></div>
   <h4>Pagos combinados</h4>
   {payments.map((pay,i)=><div className="posPayment" key={i}>
    <select aria-label={`Método de pago ${i+1}`} value={pay.method} onChange={e=>{const method=e.target.value;if(method==='Efectivo'&&payments.some((p,j)=>j!==i&&p.method==='Efectivo'))return;setPayments(old=>old.map((p,j)=>i===j?{...p,method,amount:''}:p));if(pay.method==='Efectivo')setCashTendered('')}}>{methods.map(m=><option key={m} disabled={m==='Efectivo'&&payments.some((p,j)=>j!==i&&p.method==='Efectivo')}>{m}</option>)}</select>
    {pay.method==='Efectivo'?<div className="posCashHint">El monto se calcula con el efectivo recibido abajo.</div>:<input aria-label={`Monto de ${pay.method}`} type="number" min="0" step="0.01" placeholder="Monto pagado ₡" value={pay.amount} onChange={e=>setPayments(old=>old.map((p,j)=>i===j?{...p,amount:e.target.value}:p))}/>}
    <button type="button" className="secondary" disabled={payments.length===1} onClick={()=>{setPayments(old=>old.filter((_,j)=>j!==i));if(pay.method==='Efectivo')setCashTendered('')}}>Quitar</button>
   </div>)}
   <div className="actions"><button type="button" className="secondary" disabled={payments.length>=10} onClick={()=>setPayments(old=>[...old,{method:'SINPE Móvil',amount:''}])}>Agregar otro pago</button></div>
   {cashSelected&&<div className="posCashBox"><label htmlFor="posCashTendered" className="posCashTitle">Efectivo recibido (₡)</label><input id="posCashTendered" type="number" min="0" step="0.01" value={cashTendered} onChange={e=>setCashTendered(e.target.value)} placeholder="Monto entregado por el cliente"/><p className="hint">El sistema aplica únicamente lo necesario a la venta. El excedente se devuelve como vuelto.</p><div className="posCashResults"><span>Aplicado en efectivo: <strong>₡{saleMoney(cashApplied)}</strong></span><span className="posChange">Vuelto: <strong>₡{saleMoney(changeCents)}</strong></span></div></div>}
   <p className="posPaidSummary"><strong>Pagado:</strong> ₡{saleMoney(paid)} · <strong>Saldo:</strong> ₡{saleMoney(Math.max(0,total-paid))}</p>
   {saleType==='credito'&&<p className="hint">Las ventas a crédito requieren un cliente registrado. Puedes registrar abonos posteriores desde el historial de ventas.</p>}
   <button type="submit" disabled={!cart.length||discountCents>subtotal||nonCashPaid>total||(saleType==='contado'&&paid!==total)||(saleType==='credito'&&(!clientId||paid>=total))}>Confirmar venta</button>
  </form>
  <section className="card"><h3>Impresión de tiquetes</h3><p className="hint">Impresoras instaladas en Windows. Configuración independiente por empresa; tiquetes comerciales internos, no facturas electrónicas de Hacienda.</p><button type="button" className="secondary" onClick={()=>{setTicketConfigOpen(v=>!v);setTicketDraft({...ticketSettings});setTicketSavedMessage('')}}>{ticketConfigOpen?'Cerrar configuración':'Personalizar tiquete'}</button>{ticketConfigOpen&&<div className="ticketSettings"><div className="two"><Field title="Ancho de papel"><select value={ticketDraft.width} onChange={e=>updateTicket('width',e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></select></Field><Field title="Texto adicional para redes sociales (opcional)"><input value={ticketDraft.social} maxLength="200" onChange={e=>updateTicket('social',e.target.value)}/></Field></div><div className="two"><Field title="Impresora instalada en Windows"><select value={ticketDraft.printerName} onChange={e=>updateTicket('printerName',e.target.value)}><option value="">Predeterminada de Windows</option>{printers.map(pr=><option key={pr.name} value={pr.name}>{pr.displayName||pr.name}{pr.isDefault?' (predeterminada)':''}</option>)}</select></Field><Field title="Copias"><input type="number" min="1" max="5" step="1" value={ticketDraft.copies} onChange={e=>updateTicket('copies',Math.max(1,Math.min(5,Number(e.target.value)||1)))}/></Field></div><div className="actions"><button type="button" className="secondary" disabled={printerBusy} onClick={refreshPrinters}>Actualizar impresoras</button><button type="button" className="secondary" onClick={testTicket}>Imprimir tiquete de prueba</button></div><div className="two"><Field title="Plantilla"><select value={ticketDraft.template} onChange={e=>updateTicket('template',e.target.value)}><option value="classic">Clásica</option><option value="compact">Compacta</option><option value="modern">Moderna</option></select></Field></div><div className="ticketChecks"><label><input type="checkbox" checked={!!ticketDraft.silent} onChange={e=>updateTicket('silent',e.target.checked)}/>Impresión directa sin diálogo (solo impresora seleccionada)</label></div><Field title="Mensaje de agradecimiento"><textarea rows="2" maxLength="300" value={ticketDraft.thankYou} onChange={e=>updateTicket('thankYou',e.target.value)}/></Field><Field title="Logotipo (PNG, JPEG o WebP)">
  <p className="hint">Dimensiones máximas: 800 × 800 píxeles. Tamaño máximo: 250 KB. Para una mejor impresión térmica utiliza un logotipo de alto contraste, preferiblemente en blanco y negro.</p>
  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>250000){setNotice('El logotipo no puede superar 250 KB.');e.target.value='';return}
    const reader=new FileReader();
    reader.onload=()=>{
      const data=reader.result;
      const img=new Image();
      img.onload=()=>{
        if(img.naturalWidth>800||img.naturalHeight>800){setNotice(`El logotipo mide ${img.naturalWidth} × ${img.naturalHeight} píxeles. El máximo permitido es 800 × 800.`);e.target.value='';return}
        updateTicket('logo',data);
      };
      img.onerror=()=>{setNotice('No se pudo leer la imagen del logotipo.');e.target.value=''};
      img.src=data;
    };
    reader.onerror=()=>setNotice('No se pudo cargar el archivo.');
    reader.readAsDataURL(file);
  }}/>
</Field>
{ticketDraft.logo&&<div className="ticketLogoPreview"><strong>Vista previa del logotipo</strong><img src={ticketDraft.logo} alt="Miniatura del logotipo seleccionado"/><button type="button" className="secondary" onClick={()=>updateTicket('logo','')}>Quitar logotipo</button><p className="hint">Presiona «Guardar ajustes de impresión» para conservar este logotipo.</p></div>}
<div className="ticketChecks">{[['showAddress','Mostrar dirección'],['showPhone','Mostrar teléfono'],['showClient','Mostrar cliente'],['showPayments','Mostrar métodos de pago'],['showTax','Mostrar desglose de IVA'],['autoPrint','Imprimir automáticamente al registrar una venta']].map(([key,label])=><label key={key}><input type="checkbox" checked={!!ticketDraft[key]} onChange={e=>updateTicket(key,e.target.checked)}/>{label}</label>)}</div><div className="actions ticketSaveActions"><button type="button" onClick={saveTicketSettings} disabled={!ticketHasChanges}>Guardar ajustes de impresión</button><button type="button" className="secondary" onClick={discardTicketChanges} disabled={!ticketHasChanges}>Descartar cambios</button></div>{ticketSavedMessage&&<p className="ticketSavedMessage" role="status">{ticketSavedMessage}</p>}{ticketHasChanges&&<p className="hint">Hay cambios sin guardar. Las ventas seguirán usando la configuración guardada.</p>}<p className="hint">La impresión automática abre el diálogo de impresión de Windows. Para impresión silenciosa selecciona primero una impresora instalada. El controlador debe admitir el papel elegido.</p></div>}</section><section className="card"><h3>Historial de ventas</h3><div className="actions"><button type="button" className="secondary" onClick={exportSales}>Exportar ventas CSV</button><button type="button" className="secondary" onClick={load}>Actualizar</button></div><Field title="Buscar por número, fecha o cliente"><input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}/></Field><div className="movementHistory"><table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Total</th><th>Saldo</th><th>Detalle</th></tr></thead><tbody>{sales.filter(s=>[s.id,s.created_at,s.client_name].some(v=>String(v||'').toLowerCase().includes(historyQuery.toLowerCase()))).map(s=><tr key={s.id}><td>{s.id}</td><td>{s.created_at}</td><td>{s.client_name||'Consumidor final'}</td><td>{s.sale_type}</td><td>{s.status}</td><td>₡{saleMoney(s.total_cents)}</td><td>₡{saleMoney(s.balance_cents)}</td><td><button type="button" className="secondary" onClick={()=>showSale(s.id)}>Ver</button> <button type="button" className="secondary" onClick={()=>openTicket(s.id)}>Tiquete</button></td></tr>)}</tbody></table></div>
   {details&&<div className="catalogTools"><button type="button" className="secondary" onClick={()=>openTicket(details.id)}>Vista previa del tiquete</button> <button type="button" className="secondary" onClick={()=>openTicket(details.id,true)}>Imprimir</button><h4>Venta #{details.id} · {details.status}</h4><p>Fecha: {details.created_at} · Total ₡{saleMoney(details.total_cents)} · Saldo ₡{saleMoney(details.balance_cents)}</p><div className="movementHistory"><table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>IVA</th><th>Total</th></tr></thead><tbody>{details.lines.map(l=><tr key={l.id}><td>{l.description}</td><td>{l.quantity}</td><td>₡{saleMoney(l.unit_price_cents)}</td><td>₡{saleMoney(l.tax_cents)}</td><td>₡{saleMoney(l.total_cents)}</td></tr>)}</tbody></table></div><p>Pagos: {details.payments.map(p=>`${p.method} ₡${saleMoney(p.amount_cents)}`).join(' · ')||'Sin abonos'}</p>{details.status==='activa'&&details.sale_type==='credito'&&details.balance_cents>0&&<div className="posAbono"><h4>Registrar abono a crédito</h4><div className="two"><Field title="Método de pago"><select value={abonoMethod} onChange={e=>setAbonoMethod(e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select></Field><Field title="Monto del abono (₡)"><input type="number" min="0.01" step="0.01" value={abonoAmount} onChange={e=>setAbonoAmount(e.target.value)}/></Field></div><p>Saldo pendiente: ₡{saleMoney(details.balance_cents)}</p><button type="button" disabled={!Number(abonoAmount)||roundCRC(Math.round(Number(abonoAmount)*100))>details.balance_cents} onClick={()=>askConfirm('Confirmar abono',`¿Registrar un abono de ₡${Number(abonoAmount).toLocaleString('es-CR')}?`,saveAbono)}>Registrar abono</button></div>}{details.status==='activa'&&<><Field title="Motivo de anulación (mínimo 5 caracteres)"><textarea rows="2" maxLength="300" value={annulReason} onChange={e=>setAnnulReason(e.target.value)}/></Field><button type="button" className="danger" disabled={annulReason.trim().length<5} onClick={()=>askConfirm('Anular venta',`¿Anular la venta #${details.id}? Se devolverán las existencias y quedará registrada la anulación.`,()=>annul(details.id),true)}>Anular venta</button></>}<button type="button" className="secondary" onClick={()=>setDetails(null)}>Cerrar detalle</button></div>}
  </section>
  <section className="card creditHistory"><div className="creditHeading"><div><h3>Histórico de ventas a crédito</h3><p className="hint">Consulta cuentas pendientes, pagadas y todos los abonos registrados de esta empresa.</p></div><div className="actions"><button type="button" className="secondary" onClick={()=>{loadCredits();load()}}>Actualizar</button><button type="button" className="secondary" onClick={exportCredits}>Exportar CSV</button></div></div>
   <div className="creditSummary"><div><small>Ventas a crédito</small><strong>{creditSales.filter(s=>s.status==='activa').length}</strong></div><div><small>Total pendiente</small><strong>₡{saleMoney(creditSales.filter(s=>s.status==='activa').reduce((n,s)=>n+s.balance_cents,0))}</strong></div><div><small>Total abonado</small><strong>₡{saleMoney(creditSales.filter(s=>s.status==='activa').reduce((n,s)=>n+s.paid_cents,0))}</strong></div></div>
   <div className="creditFilters"><Field title="Buscar cliente, venta o fecha"><input value={creditSearch} onChange={e=>setCreditSearch(e.target.value)} placeholder="Nombre, número o fecha"/></Field><Field title="Estado de la cuenta"><select value={creditFilter} onChange={e=>setCreditFilter(e.target.value)}><option value="todas">Todas</option><option value="pendientes">Pendientes</option><option value="pagadas">Pagadas</option><option value="anuladas">Anuladas</option></select></Field></div>
   <div className="actions"><button type="button" className={creditTab==='ventas'?'':'secondary'} onClick={()=>setCreditTab('ventas')}>Ventas a crédito</button><button type="button" className={creditTab==='abonos'?'':'secondary'} onClick={()=>setCreditTab('abonos')}>Todos los abonos</button></div>
   <div className="movementHistory"><table><thead>{creditTab==='ventas'?<tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Acción</th></tr>:<tr><th>Abono</th><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Monto</th><th>Acción</th></tr>}</thead><tbody>{creditTab==='ventas'?filteredCredits.map(s=><tr key={s.id}><td>#{s.id}</td><td>{s.created_at}</td><td>{s.client_name}</td><td>{s.status==='anulada'?'Anulada':s.balance_cents>0?'Pendiente':'Pagada'}</td><td>₡{saleMoney(s.total_cents)}</td><td>₡{saleMoney(s.paid_cents)}</td><td><strong>₡{saleMoney(s.balance_cents)}</strong></td><td><button type="button" className="secondary" onClick={()=>showSale(s.id)}>Ver abonos</button></td></tr>):filteredCreditPayments.map(a=><tr key={a.id}><td>#{a.id}</td><td>#{a.sale_id}</td><td>{a.created_at}</td><td>{a.client_name}</td><td>{a.method}</td><td>₡{saleMoney(a.amount_cents)}</td><td><button type="button" className="secondary" onClick={()=>showSale(a.sale_id)}>Ver venta</button></td></tr>)}</tbody></table>{(creditTab==='ventas'?filteredCredits:filteredCreditPayments).length===0&&<p className="hint">No se encontraron registros para los filtros seleccionados.</p>}</div>
   {details?.sale_type==='credito'&&<div className="creditDetail"><h4>Detalle de abonos de venta #{details.id}</h4><p>Total ₡{saleMoney(details.total_cents)} · Abonado ₡{saleMoney(details.paid_cents)} · Saldo ₡{saleMoney(details.balance_cents)}</p><div className="movementHistory"><table><thead><tr><th>Abono</th><th>Fecha</th><th>Método</th><th>Importe</th></tr></thead><tbody>{details.payments.map(a=><tr key={a.id}><td>#{a.id}</td><td>{a.created_at}</td><td>{a.method}</td><td>₡{saleMoney(a.amount_cents)}</td></tr>)}</tbody></table>{!details.payments.length&&<p className="hint">Esta venta todavía no tiene abonos.</p>}</div><button type="button" className="secondary" onClick={()=>setDetails(null)}>Cerrar detalle</button></div>}
  </section>
  {ticketPreview&&<div className="ticketOverlay" role="dialog" aria-modal="true" aria-label="Vista previa de tiquete"><div className="ticketModal"><h3>Vista previa del tiquete</h3><iframe title="Tiquete" sandbox="allow-same-origin" srcDoc={ticketPreview}/><div className="actions"><button type="button" onClick={async()=>{try{if(!window.facturacrPrinter)throw Error('La impresión requiere la aplicación de escritorio.');await printHtml(ticketPreview)}catch(e){setNotice(e.message)}}}>Imprimir con Windows</button><button type="button" className="secondary" onClick={()=>setTicketPreview('')}>Cerrar</button></div></div></div>}
 </div>;
}
function App(){
 const restoreInput=useRef(null),catalogInput=useRef(null);
 const [backupStatus,setBackupStatus]=useState(null),[catalogPreview,setCatalogPreview]=useState(null),[catalogBusy,setCatalogBusy]=useState(false);
 const [backupBusy,setBackupBusy]=useState(false);
 const [autoBackup,setAutoBackup]=useState(null),[autoConfig,setAutoConfig]=useState({enabled:false,frequency:'daily',time:'20:00',keep:14});
 const [dialog,setDialog]=useState(null);
 const askConfirm=(title,description,action,danger=false)=>setDialog({title,description,action,danger});
 const closeDialog=()=>setDialog(null);
 const confirmDialog=()=>{const action=dialog?.action;setDialog(null);if(action)void action()};
 const [companies,setCompanies]=useState([]),[selected,setSelected]=useState(null),[tab,setTab]=useState('companies');
 const [geoCantons,setGeoCantons]=useState({}),[geoDistricts,setGeoDistricts]=useState({}),[geoError,setGeoError]=useState('');
 const [companyForm,setCompanyForm]=useState({legal_name:'',identification:'',trade_name:'',phone:'',email:'',address:'',website:'',social:''}),[items,setItems]=useState([]);
 const [movementProduct,setMovementProduct]=useState(null),[movements,setMovements]=useState([]),[moveForm,setMoveForm]=useState({movement_type:'entrada',quantity:'1',reason:'Compra',notes:''}),[form,setForm]=useState(blankClient),[editing,setEditing]=useState(null),[search,setSearch]=useState(''),[message,setMessage]=useState('');
 const sortStorageKey=`facturacr_sort_${selected??'none'}_${tab}`;
 const [sortBy,setSortBy]=useState('az');
 useEffect(()=>{try{setSortBy(localStorage.getItem(sortStorageKey)||'az')}catch{setSortBy('az')}},[sortStorageKey]);
 const changeSort=(value)=>{setSortBy(value);try{localStorage.setItem(sortStorageKey,value)}catch{}};
 const downloadBackup=async()=>{
  setBackupBusy(true);setMessage('Creando respaldo seguro de la base de datos...');
  try{
   const response=await fetch('/api/backups/download');
   if(!response.ok){const type=response.headers.get('content-type')||'';const data=type.includes('application/json')?await response.json():null;throw Error(data?.error||`No se pudo generar el respaldo (HTTP ${response.status}).`);}
   const blob=await response.blob();
   const filename=`FacturaCR_respaldo_${new Date().toISOString().slice(0,10)}.sqlite`;
   const url=URL.createObjectURL(blob);const link=document.createElement('a');
   link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage('Respaldo generado. Comprueba que el archivo esté en tu carpeta de descargas y guárdalo también en una unidad externa.');
  }catch(err){setMessage(err.message)}finally{setBackupBusy(false)}
 };
 const restoreBackup=async(event)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(!file.name.toLowerCase().endsWith('.sqlite')){setMessage('Selecciona un archivo de respaldo .sqlite.');return}
  
  askConfirm('Restaurar respaldo',`¿Restaurar «${file.name}»? Se reemplazarán los datos de TODAS las empresas y se creará una copia previa. Esta operación es delicada.`,()=>askConfirm('Confirmación final',`Última confirmación: reemplazar la información actual con «${file.name}».`,()=>performRestore(file),true),true);
 };
 const performRestore=async(file)=>{
  setBackupBusy(true);setMessage('Verificando respaldo y protegiendo los datos actuales...');
  try{
   const response=await fetch('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
   const type=response.headers.get('content-type')||'';
   if(!type.includes('application/json'))throw Error(`El servidor devolvió HTML en vez de JSON (HTTP ${response.status}). Reinicia FacturaCR y vuelve a intentar. No se ha confirmado la restauración.`);
   const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo restaurar.');
   setMessage('Restauración correcta. Se guardó una copia previa: '+result.previousBackup+'.');
   localStorage.removeItem(ACTIVE_COMPANY_KEY);setSelected(null);setItems([]);setEditing(null);await refreshCompanies();
  }catch(err){setMessage(err.message)}finally{setBackupBusy(false)}
 };
 const refreshBackupStatus=async()=>{try{const status=await api('/api/backups/status');setBackupStatus(status);setMessage('')}catch(e){setBackupStatus(null);setMessage('No se pudo consultar el espacio de respaldos: '+e.message)}};
 const refreshAutoBackup=async()=>{try{const data=await api('/api/backups/automatic');setAutoBackup(data);setAutoConfig(data.config)}catch(e){setMessage('No se pudieron consultar los respaldos automáticos: '+e.message)}};
 const saveAutoBackup=async()=>{setBackupBusy(true);try{await api('/api/backups/automatic',{method:'PUT',body:JSON.stringify(autoConfig)});await refreshAutoBackup();setMessage('Programación de respaldos guardada. Se ejecutará mientras FacturaCR esté abierto; si estaba cerrado, comprobará los respaldos pendientes al iniciar.')}catch(e){setMessage(e.message)}finally{setBackupBusy(false)}};
 const createAutoBackup=async()=>{setBackupBusy(true);try{const data=await api('/api/backups/automatic/run',{method:'POST'});await refreshAutoBackup();setMessage('Respaldo verificado: '+data.file)}catch(e){setMessage(e.message)}finally{setBackupBusy(false)}};
 useEffect(()=>{if(tab==='backups'){refreshBackupStatus();refreshAutoBackup()}},[tab]);
 const sizeLabel=bytes=>bytes==null||!Number.isFinite(Number(bytes))?'—':(Number(bytes)/1048576).toLocaleString('es-CR',{maximumFractionDigits:1})+' MB';
 const exportCatalog=async()=>{
  try{const response=await fetch(`/api/companies/${selected}/products/export.csv`);if(!response.ok)throw Error('No se pudo exportar el catálogo.');
  const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FacturaCR_catalogo.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){setMessage(e.message)}
 };
 const [movementExportStatus,setMovementExportStatus]=useState('all');
 const [movementExportSort,setMovementExportSort]=useState('az');
 const exportMovements=async()=>{
  if(!selected){setMessage('Selecciona una empresa antes de exportar.');return;}
  try{
   const response=await fetch(`/api/companies/${selected}/inventory/movements/export.csv?status=${encodeURIComponent(movementExportStatus)}&sort=${encodeURIComponent(movementExportSort)}`);
   if(!response.ok){const type=response.headers.get('content-type')||'';const result=type.includes('application/json')?await response.json():null;throw Error(result?.error||`No se pudo exportar el historial (HTTP ${response.status}).`)}
   const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');
   link.href=url;link.download=`FacturaCR_movimientos_${movementExportStatus}_${movementExportSort}.csv`;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('Historial de movimientos exportado correctamente.');
  }catch(err){setMessage(err.message)}
 };
 const parseCsv=text=>{
  text=text.replace(/^\uFEFF/,'');
  let delimiter=',';
  if(text.startsWith('sep=;')){delimiter=';';text=text.replace(/^sep=;\r?\n/,'')}
  else if(text.startsWith('sep=,')){text=text.replace(/^sep=,\r?\n/,'')}
  else {const first=text.split(/\r?\n/,1)[0];if((first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length)delimiter=';'}
  const rows=[],row=[];let field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
  else if(c==='"')quoted=true;else if(c===delimiter){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push([...row]);row.length=0;field=''}else field+=c}
  if(quoted)throw Error('El archivo CSV tiene comillas sin cerrar.');if(field||row.length){row.push(field);rows.push(row)}
  const aliases={'tipo':'kind','codigo / sku':'product_code','código / sku':'product_code','codigo de barras':'barcode','código de barras':'barcode','producto / descripcion':'description','producto / descripción':'description','cabys':'cabys','precio de venta':'price','costo':'cost','moneda':'currency','codigo iva':'tax_code','código iva':'tax_code','unidad':'unit','existencias':'stock','existencias minimas':'min_stock','existencias mínimas':'min_stock','controla existencias':'track_stock','alerta habilitada':'alert_enabled','observaciones':'notes'};
  const headers=(rows.shift()||[]).map(h=>{const key=h.trim().toLowerCase();return aliases[key]||key});
  if(!headers.includes('description')||!headers.includes('price'))throw Error('El CSV debe incluir Producto / descripción y Precio de venta. Puedes exportar primero una plantilla.');
  if(rows.length>2000)throw Error('Máximo 2000 artículos por importación.');
  const allowed=['kind','product_code','barcode','description','cabys','price','cost','currency','tax_code','unit','stock','min_stock','track_stock','alert_enabled','notes'];
  return rows.filter(r=>r.some(v=>v.trim())).map((r,i)=>{if(r.length!==headers.length)throw Error('Columnas inconsistentes en fila '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,['product_code','barcode','cabys','tax_code'].includes(h)?r[j].replace(/^=\"(\d+)\"$/,'$1'):r[j]]).filter(([h])=>allowed.includes(h)))});
 };
 const selectCatalog=async(e)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw Error('Divide el CSV en lotes de hasta 2 MB.');const bytes=await file.arrayBuffer();const raw=new Uint8Array(bytes);
   const isUtf8Bom=raw[0]===0xEF&&raw[1]===0xBB&&raw[2]===0xBF;
   const decoded=new TextDecoder(isUtf8Bom?'utf-8':'windows-1252').decode(raw);
   const rows=parseCsv(decoded);if(!rows.length)throw Error('El archivo no contiene artículos.');setCatalogPreview({name:file.name,rows});setMessage('Revisa la vista previa antes de importar.')}catch(err){setCatalogPreview(null);setMessage(err.message)}};
 const importCatalog=async()=>{if(!catalogPreview)return;askConfirm('Importar catálogo',`¿Importar ${catalogPreview.rows.length} artículos a ${current?.legal_name}? No se sobrescribirán artículos existentes.`,()=>persistCatalog());};
 const persistCatalog=async()=>{
  setCatalogBusy(true);try{const result=await api(`/api/companies/${selected}/products/import`,{method:'POST',body:JSON.stringify({rows:catalogPreview.rows})});setCatalogPreview(null);await refreshItems();setMessage(`Se importaron ${result.imported} artículos correctamente.`)}catch(err){setMessage(err.message)}finally{setCatalogBusy(false)}};
 const current=companies.find(c=>c.id===selected);
 const endpoint=`/api/companies/${selected}/${tab}`;
 const refreshCompanies=async()=>{try{const result=await api('/api/companies');setCompanies(result);setSelected(prev=>{
    const saved=localStorage.getItem(ACTIVE_COMPANY_KEY);
    const desired=prev??(saved===null?null:Number(saved));
    return result.some(c=>c.id===desired)?desired:result[0]?.id??null;
   });}catch(e){setMessage(e.message)}};
 const refreshItems=async()=>{
  if(!selected||!['clients','products'].includes(tab)){setItems([]);return;}
  try{const result=await api(endpoint);if(!Array.isArray(result))throw Error('El servidor devolvió un formato inesperado para el listado.');setItems(result)}
  catch(e){setItems([]);setMessage(e.message)}
 };
 useEffect(()=>{refreshCompanies()},[]);
 useEffect(()=>{if(selected!==null&&companies.some(c=>c.id===selected)){
  try{localStorage.setItem(ACTIVE_COMPANY_KEY,String(selected))}catch{}
 }},[selected,companies]);
 useEffect(()=>{setItems([]);setSearch('');setEditing(null);setForm(tab==='products'?blankProduct:blankClient);setMessage('');setMovementProduct(null);setMovements([]);refreshItems()},[selected,tab]);
 const getGeo=async(path,setter)=>{
   const key='facturacr_geo_'+path;
   const cached=localStorage.getItem(key);
   if(cached){try{setter(JSON.parse(cached));setGeoError('');return}catch{localStorage.removeItem(key)}}
   try{const response=await fetch(geoBase+path);if(!response.ok)throw Error();const data=await response.json();
     setter(data);localStorage.setItem(key,JSON.stringify(data));setGeoError('');
   }catch{setter({});setGeoError('No se pudo cargar el catálogo territorial. Conéctate a Internet para la primera consulta. Las ubicaciones consultadas anteriormente quedan guardadas en este equipo.');}
 };
 useEffect(()=>{if(tab==='clients'&&form.province)getGeo(`/provincia/${Number(form.province)}/cantones.json`,setGeoCantons);else setGeoCantons({})},[tab,form.province]);
 useEffect(()=>{if(tab==='clients'&&form.province&&form.canton)getGeo(`/provincia/${Number(form.province)}/canton/${Number(form.canton)}/distritos.json`,setGeoDistricts);else setGeoDistricts({})},[tab,form.province,form.canton]);
 const change=(key,value)=>setForm(prev=>({...prev,[key]:value,...(key==='tax_code'?{tax_rate:rates[value]}:{})}));
 const saveCompany=e=>{e.preventDefault();askConfirm('Guardar empresa',`¿${editingCompany?'Actualizar':'Registrar'} la empresa «${companyForm.legal_name}»?`,editingCompany?updateCompany:persistCompany)};
 const persistCompany=async()=>{try{const created=await api('/api/companies',{method:'POST',body:JSON.stringify(companyForm)});setCompanyForm({legal_name:'',identification:'',trade_name:'',phone:'',email:'',address:'',website:'',social:''});await refreshCompanies();setSelected(created.id);setMessage('Empresa registrada.')}catch(err){setMessage(err.message)}};
 const [editingCompany,setEditingCompany]=useState(null);
 const editCompany=c=>{setEditingCompany(c.id);setCompanyForm({legal_name:c.legal_name,identification:c.identification,trade_name:c.trade_name||'',phone:c.phone||'',email:c.email||'',address:c.address||'',website:c.website||'',social:c.social||''});setTab('companies')};
 const updateCompany=async()=>{try{await api(`/api/companies/${editingCompany}`,{method:'PUT',body:JSON.stringify(companyForm)});await refreshCompanies();setEditingCompany(null);setCompanyForm({legal_name:'',identification:'',trade_name:'',phone:'',email:'',address:'',website:'',social:''});setMessage('Información de empresa actualizada.')}catch(e){setMessage(e.message)}};
 const persistItem=async()=>{try{
   await api(endpoint+(editing?`/${editing}`:''),{method:editing?'PUT':'POST',body:JSON.stringify(tab==='products'?{...form,price_includes_tax:'1'}:form)});
   setForm(tab==='products'?blankProduct:blankClient);setEditing(null);await refreshItems();setMessage('Registro guardado correctamente.');
  }catch(err){setMessage(err.message)}};
 const saveItem=e=>{e.preventDefault();
  askConfirm(editing?'Guardar cambios':tab==='clients'?'Guardar cliente':'Guardar artículo',tab==='clients'?`¿Confirmas ${editing?'actualizar':'registrar'} este cliente?`:editing?'¿Confirmas los cambios de este artículo o servicio?':'¿Confirmas guardar este nuevo artículo o servicio?',persistItem);
 };
 const removeRecord=async item=>{try{await api(endpoint+'/'+item.id,{method:'DELETE'});await refreshItems();setMessage(tab==='products'?'Artículo retirado del catálogo. Su historial de inventario se conserva.':'Registro eliminado.');}catch(e){setMessage(e.message)}};
 const remove=item=>askConfirm(tab==='products'?'Eliminar artículo':'Eliminar registro',tab==='products'?`¿Retirar «${item.description}» del catálogo? Dejará de aparecer en artículos, pero se conservarán sus movimientos para auditoría.`:'¿Eliminar este registro? Esta acción no se puede deshacer.',()=>removeRecord(item),true);
 const edit=item=>{const apply=()=>{const keys=Object.keys(tab==='products'?blankProduct:blankClient);setForm(Object.fromEntries(keys.map(k=>[k,k==='price'&&tab==='products'&&Number(item.price_includes_tax)!==1?String(Math.round(Number(item.price)*(1+Number(item.tax_rate||0)/100)*100)/100):k==='price_includes_tax'?'1':String(item[k]??'')])));setEditing(item.id);window.scrollTo({top:0,behavior:'smooth'})};
  askConfirm(tab==='products'?'Editar artículo':'Editar cliente',`¿Deseas editar «${item.description||item.name}»?`,apply);
 };
 const loadMovements=async(productId)=>{try{setMovements(await api(`/api/companies/${selected}/inventory/movements?productId=${productId}`))}catch(e){setMessage(e.message)}};
 const openMovement=item=>{setMovementProduct(item.id);setMoveForm({movement_type:'entrada',quantity:'1',reason:'Compra',notes:''});loadMovements(item.id)};
 const saveMovement=async(e)=>{e.preventDefault();askConfirm('Registrar movimiento','¿Confirmas este movimiento de inventario? Modificará las existencias del artículo.',()=>persistMovement());};
 const persistMovement=async()=>{try{
  await api(`/api/companies/${selected}/inventory/movements`,{method:'POST',body:JSON.stringify({product_id:movementProduct,...moveForm})});
  await refreshItems();await loadMovements(movementProduct);setMoveForm({...moveForm,quantity:'1',notes:''});setMessage('Movimiento registrado en el historial.');
 }catch(e){setMessage(e.message)}};
 const uploadImage=async(e)=>{
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMessage('Solo imágenes JPG, PNG o WebP.');return}
  if(file.size>700000){setMessage('La imagen debe pesar menos de 700 KB.');return}
  const reader=new FileReader();reader.onload=()=>change('image_data',String(reader.result));reader.readAsDataURL(file);
 };
 const filtered=(Array.isArray(items)?items:[]).filter(item=>Object.entries(item).filter(([k])=>k!=='image_data').some(([,v])=>String(v).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>{
  const label=tab==='clients'?'name':'description';
  const text=(x,y)=>String(x??'').localeCompare(String(y??''),'es',{numeric:true,sensitivity:'base'});
  const num=(x,y)=>Number(x??0)-Number(y??0);
  let result=0;
  switch(sortBy){
   case 'za':result=text(b[label],a[label]);break;
   case 'oldest':result=num(a.id,b.id);break;
   case 'newest':result=num(b.id,a.id);break;
   case 'identification':result=text(a.identification,b.identification);break;
   case 'price_asc':result=num(a.price,b.price);break;
   case 'price_desc':result=num(b.price,a.price);break;
   case 'stock_asc':result=num(a.stock,b.stock);break;
   case 'stock_desc':result=num(b.stock,a.stock);break;
   default:result=text(a[label],b[label]);
  }
  return result||num(a.id,b.id);
 });
 return <div className="layout"><aside><h1>Factura<span>CR</span></h1><small>Administración multiempresa · v{APP_VERSION}</small><nav>
  <button className={tab==='companies'?'navactive':''} onClick={()=>setTab('companies')}>Empresas</button>
  <button className={tab==='clients'?'navactive':''} onClick={()=>setTab('clients')}>Clientes</button>
  <button className={tab==='products'?'navactive':''} onClick={()=>setTab('products')}>Inventario y servicios</button>
  <button className={tab==='sales'?'navactive':''} onClick={()=>setTab('sales')}>Ventas</button>
  <button className={tab==='backups'?'navactive':''} onClick={()=>setTab('backups')}>Respaldos</button><span>Facturas electrónicas · Próximamente</span><span>Usuarios y permisos · Próximamente</span>
 </nav></aside><main><header><h2>{tab==='companies'?'Empresas':tab==='clients'?'Clientes':tab==='backups'?'Respaldos':tab==='sales'?'Punto de venta':'Inventario y servicios'}</h2><p>Información guardada localmente y separada por empresa</p></header>
 {tab!=='companies'&&tab!=='backups'&&<div className="card company-picker"><strong>Empresa activa: {current?`${current.legal_name} · ${current.identification}`:'Sin empresa seleccionada'}</strong><p className="hint">Para cambiar de empresa, entra a la sección Empresas.</p></div>}
 {message&&<p className="notice" role="status">{message}</p>}
 {tab==='backups'&&<section className="card"><h3>Copias de seguridad de FacturaCR</h3>
  <p>El respaldo incluye todas las empresas, clientes, productos, fotografías e historial de inventario guardados en SQLite.</p>
  <p className="hint">Guarda una copia en un disco externo o nube privada. Los respaldos contienen información confidencial y no están cifrados.</p>
  <p className="hint">Base de datos: {sizeLabel(backupStatus?.databaseBytes)} · WAL temporal: {sizeLabel(backupStatus?.walBytes)} · Espacio libre: {sizeLabel(backupStatus?.freeBytes)} <button type="button" className="secondary" onClick={refreshBackupStatus}>Actualizar espacio</button></p>
  <div className="actions"><button type="button" disabled={backupBusy} onClick={downloadBackup}>Crear y descargar respaldo</button>
  <button type="button" disabled={backupBusy} className="danger" onClick={()=>restoreInput.current?.click()}>Restaurar respaldo</button></div>
  <div className="autoBackupPanel"><h3>Respaldos automáticos · v0.6.4</h3>
  <label className="backupToggle"><input type="checkbox" checked={!!autoConfig.enabled} onChange={e=>setAutoConfig({...autoConfig,enabled:e.target.checked})}/><span><strong>Activar respaldos automáticos</strong><small>FacturaCR realizará copias de seguridad según la frecuencia y hora que configures.</small></span></label>
  <div className="two"><Field title="Frecuencia"><select value={autoConfig.frequency} onChange={e=>setAutoConfig({...autoConfig,frequency:e.target.value})}><option value="daily">Diario</option><option value="weekly">Semanal (lunes)</option><option value="monthly">Mensual (día 1)</option></select></Field><Field title="Hora local"><input type="time" value={autoConfig.time} onChange={e=>setAutoConfig({...autoConfig,time:e.target.value})}/></Field></div>
  <div className="backupRetention"><Field title="Cantidad de respaldos que deseas conservar"><input type="number" min="1" max="365" value={autoConfig.keep} onChange={e=>setAutoConfig({...autoConfig,keep:Number(e.target.value)})}/></Field><p className="hint">Este número indica cuántos archivos de respaldo automático se guardarán como máximo (de 1 a 365). Por ejemplo, con <strong>14</strong> y frecuencia <strong>diaria</strong>, se conservarán aproximadamente las últimas dos semanas. Cuando se cree el respaldo número 15, se eliminará el más antiguo. No es la cantidad de empresas ni de copias por día.</p></div>
  <div className="actions"><button type="button" disabled={backupBusy} onClick={saveAutoBackup}>Guardar programación</button><button type="button" disabled={backupBusy} className="secondary" onClick={createAutoBackup}>Crear copia automática ahora</button><button type="button" className="secondary" onClick={refreshAutoBackup}>Actualizar listado</button></div>
  <p className="hint">Carpeta local: {autoBackup?.directory||'Cargando…'}</p><p className="hint">Se guardan copias SQLite verificadas de todas las empresas. Si el programa está cerrado a la hora prevista, el respaldo pendiente se realizará al volver a abrirlo. No se crean tareas de Windows mientras esté cerrado.</p>
  {autoBackup?.lastError&&<p className="warning">Último error: {autoBackup.lastError}</p>}
  <strong>Últimos respaldos automáticos</strong>{autoBackup?.files?.length?<ul>{autoBackup.files.slice(0,10).map(f=><li key={f}>{f}</li>)}</ul>:<p className="hint">Aún no se han generado respaldos automáticos.</p>}
  </div>
  <input ref={restoreInput} type="file" accept=".sqlite" style={{display:'none'}} onChange={restoreBackup}/>
  <p className="warning">Restaurar reemplaza toda la información actual. FacturaCR verifica el archivo y guarda una copia previa de la base de datos. Sin límite fijo de restauración: requiere espacio libre suficiente para el archivo y una copia previa.</p>
 </section>}
 {tab==='companies'?<section className="grid"><div className="card"><h3>{editingCompany?"Editar empresa":"Registrar empresa"}</h3><form onSubmit={saveCompany} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}}><Field title="Razón social"><input value={companyForm.legal_name} onChange={e=>setCompanyForm({...companyForm,legal_name:e.target.value})} maxLength="160" required/></Field><Field title="Identificación"><input value={companyForm.identification} onChange={e=>setCompanyForm({...companyForm,identification:e.target.value})} pattern="[0-9]{9,12}" required/></Field><Field title="Nombre comercial"><input value={companyForm.trade_name} onChange={e=>setCompanyForm({...companyForm,trade_name:e.target.value})} maxLength="160"/></Field><Field title="Teléfono"><input value={companyForm.phone} onChange={e=>setCompanyForm({...companyForm,phone:e.target.value})} maxLength="160"/></Field><Field title="Correo electrónico"><input value={companyForm.email} onChange={e=>setCompanyForm({...companyForm,email:e.target.value})} maxLength="300"/></Field><Field title="Sitio web"><input value={companyForm.website} onChange={e=>setCompanyForm({...companyForm,website:e.target.value})} maxLength="300"/></Field><Field title="Redes sociales"><input value={companyForm.social} onChange={e=>setCompanyForm({...companyForm,social:e.target.value})} maxLength="300"/></Field><Field title="Dirección comercial"><textarea rows="3" maxLength="300" value={companyForm.address} onChange={e=>setCompanyForm({...companyForm,address:e.target.value})}/></Field><button>{editingCompany?"Guardar cambios":"Guardar empresa"}</button>{editingCompany&&<button type="button" className="secondary" onClick={()=>{setEditingCompany(null);setCompanyForm({legal_name:"",identification:"",trade_name:"",phone:"",email:"",address:"",website:"",social:""})}}>Cancelar edición</button>}</form></div><div className="card"><h3>Empresas registradas</h3>{companies.length===0?<p>No hay empresas.</p>:companies.map(c=><div className="companyrow" key={c.id}><button className={'company '+(selected===c.id?'active':'')} onClick={()=>setSelected(c.id)}><b>{c.legal_name}</b><small>{c.identification}</small></button><button type="button" className="secondary" onClick={()=>editCompany(c)}>Editar datos</button><button type="button" disabled title="Requiere autenticación del propietario" className="secondary">Eliminar · Bloqueado</button></div>)}<p className="hint">Eliminar empresas estará disponible cuando implementemos la cuenta de propietario y verificación de contraseña. No se permite borrar empresas sin autenticación.</p></div></section>:
 tab==='backups'?null:
 tab==='sales'?<SalesPanel companyId={selected} company={current} askConfirm={askConfirm}/>: 
 !current?<div className="card">Primero registre una empresa.</div>:
 <section className="grid"><div className="card"><h3>{editing?'Editar':'Registrar'} {tab==='clients'?'cliente':'producto o servicio'}</h3><form onSubmit={saveItem} onKeyDown={e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){e.preventDefault()}}}>
 {tab==='clients'?<>
  <h4>Identificación</h4>
  <Field title="Nombre o razón social *"><input required maxLength="100" value={form.name} onChange={e=>change('name',e.target.value)}/></Field>
  <Field title="Nombre comercial"><input maxLength="80" value={form.trade_name} onChange={e=>change('trade_name',e.target.value)}/></Field>
  <div className="two"><Field title="Tipo de identificación"><select value={form.identification_type} onChange={e=>change('identification_type',e.target.value)}><option value="01">01 · Cédula física</option><option value="02">02 · Cédula jurídica</option><option value="03">03 · DIMEX</option><option value="04">04 · NITE</option><option value="05">05 · Extranjero no domiciliado</option></select></Field>
  <Field title="Número de identificación *"><input required maxLength="20" value={form.identification} onChange={e=>change('identification',e.target.value.replace(/[-\s]/g,''))}/></Field></div>
  <Field title="Código de actividad económica del receptor"><input inputMode="decimal" pattern="([0-9]{4}\.[0-9]|[0-9]{6})?" maxLength="6" value={form.activity_code} onChange={e=>change('activity_code',e.target.value)} placeholder="Ejemplo: 3333.3"/></Field>
  <h4>Dirección</h4>
  <div className="three"><Field title="Provincia"><select value={form.province} onChange={e=>{change('province',e.target.value);setForm(prev=>({...prev,province:e.target.value,canton:'',district:''}))}}><option value="">Seleccione</option>{Object.entries(provinces).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
  <Field title="Cantón"><select value={form.canton} disabled={!form.province||!Object.keys(geoCantons).length} onChange={e=>setForm(prev=>({...prev,canton:e.target.value,district:''}))}><option value="">Seleccione cantón</option>{Object.entries(geoCantons).map(([k,v])=><option key={k} value={pad2(k)}>{v}</option>)}</select></Field>
  <Field title="Distrito"><select value={form.district} disabled={!form.canton||!Object.keys(geoDistricts).length} onChange={e=>change('district',e.target.value)}><option value="">Seleccione distrito</option>{Object.entries(geoDistricts).map(([k,v])=><option key={k} value={pad2(k)}>{v}</option>)}</select></Field></div>
  {geoError&&<p className="hint" role="alert">{geoError}</p>}
  <p className="hint">Selecciona provincia → cantón → distrito. Los códigos se guardan internamente. Los catálogos se consultan en línea y se almacenan localmente para reutilizarlos.</p>
  <Field title="Dirección exacta / otras señas"><textarea rows="3" maxLength="160" value={form.address} onChange={e=>change('address',e.target.value)}/></Field>
  <h4>Contacto</h4>
  <div className="three"><Field title="Código país"><input maxLength="3" value={form.country_code} onChange={e=>change('country_code',e.target.value)}/></Field><Field title="Teléfono"><input maxLength="20" value={form.phone} onChange={e=>change('phone',e.target.value)}/></Field><Field title="Teléfono alternativo"><input maxLength="20" value={form.phone_alt} onChange={e=>change('phone_alt',e.target.value)}/></Field></div>
  <Field title="Correo electrónico"><input type="email" maxLength="160" value={form.email} onChange={e=>change('email',e.target.value)}/></Field>
  <Field title="Notas internas"><textarea rows="2" maxLength="500" value={form.notes} onChange={e=>change('notes',e.target.value)}/></Field>
 </>:<>
  <div className="two"><Field title="Tipo"><select value={form.kind} onChange={e=>{change('kind',e.target.value);if(e.target.value==='servicio')change('track_stock','0')}}><option value="producto">Producto</option><option value="servicio">Servicio</option></select></Field>
  <Field title="Código interno / SKU"><input maxLength="40" value={form.product_code} onChange={e=>change('product_code',e.target.value)}/></Field></div>
  <Field title="Descripción *"><textarea rows="2" required maxLength="250" value={form.description} onChange={e=>change('description',e.target.value)}/></Field>
  <div className="two"><Field title="CABYS (13 dígitos)"><input maxLength="13" pattern="([0-9]{13})?" value={form.cabys} onChange={e=>change('cabys',e.target.value)} placeholder="Consultar catálogo oficial"/></Field>
  <Field title="Código de barras"><input maxLength="60" value={form.barcode} onChange={e=>change('barcode',e.target.value)}/></Field></div>
  <h4>Precios e impuestos</h4>
  <div className="three"><Field title="Precio final con IVA incluido *"><input type="number" min="0" step="0.00001" required value={form.price} onChange={e=>change('price',e.target.value)}/></Field>
  <Field title="Costo"><input type="number" min="0" step="0.00001" value={form.cost} onChange={e=>change('cost',e.target.value)}/></Field>
  <Field title="Moneda"><select value={form.currency} onChange={e=>change('currency',e.target.value)}><option value="CRC">CRC · Colones</option><option value="USD">USD · Dólares</option></select></Field></div>
  <div className="posPricePreview"><span>Precio base sin IVA (calculado)</span><strong>{form.currency==='USD'?'$':'₡'}{(Number(form.price||0)/(1+Number(form.tax_rate||0)/100)).toLocaleString('es-CR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>El precio final incluye el impuesto seleccionado. En Ventas se mostrará el precio base.</small></div>
  <Field title="Tarifa de IVA"><select value={form.tax_code} onChange={e=>change('tax_code',e.target.value)}>{tariffs.map(([k,v])=><option key={k} value={k}>{v.replace(' · Código 10','')}</option>)}</select></Field>
  <p className="hint">Los códigos tributarios se conservan internamente para la futura integración con Hacienda. La tarifa se debe elegir según la clasificación tributaria del producto. Las tarifas transitorias solo aplican a los ajustes permitidos por Hacienda.</p>
  <h4>Inventario</h4>
  <div className="two"><Field title="Unidad de medida"><select value={form.unit} onChange={e=>change('unit',e.target.value)}>{['Unid','Kg','g','L','mL','m','m2','m3','h','d','Sp','Otros'].map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
  <Field title="Controlar existencias"><select value={form.kind==='servicio'?'0':form.track_stock} disabled={form.kind==='servicio'} onChange={e=>change('track_stock',e.target.value)}><option value="1">Sí</option><option value="0">No</option></select></Field></div>
  {form.kind==='producto'&&<div className="two"><Field title="Existencias actuales"><input type="number" min="0" step="1" value={form.stock} onChange={e=>change('stock',e.target.value)}/></Field><Field title="Avisar cuando queden estas unidades o menos"><input type="number" min="0" step="1" value={form.min_stock} onChange={e=>change('min_stock',e.target.value)}/></Field></div>}
  {form.kind==='producto'&&<Field title="Alertas de pocas unidades"><select value={form.alert_enabled} onChange={e=>change('alert_enabled',e.target.value)}><option value="1">Activadas</option><option value="0">Desactivadas</option></select></Field>}
  <p className="hint">Para cambiar existencias de productos guardados, utiliza Registrar movimiento. Así queda constancia de cada cambio.</p>
  <h4>Fotografía</h4><Field title="Foto del producto (JPG, PNG o WebP · hasta 700 KB)"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage}/></Field>
  {form.image_data&&<div className="photo"><img src={form.image_data} alt="Vista previa"/><button type="button" className="secondary" onClick={()=>change('image_data','')}>Quitar foto</button></div>}
  <Field title="Notas internas"><textarea rows="2" maxLength="500" value={form.notes} onChange={e=>change('notes',e.target.value)}/></Field>
 </>}
 <div className="actions"><button type="submit">{editing?'Guardar cambios':'Guardar registro'}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(tab==='products'?blankProduct:blankClient)}}>Cancelar</button>}</div></form></div>
 <div className="card"><h3>Registros de {current.legal_name}</h3>
 {tab==='products'&&<div className="catalogTools"><h4>Importar / exportar catálogo</h4><p className="hint">Exporta CSV para Excel de Windows (acentos legibles y códigos como texto). Para importar, usa un archivo CSV con las columnas de FacturaCR. No modifica artículos existentes ni importa fotografías.</p>
 <div className="actions"><button type="button" className="secondary" onClick={exportCatalog}>Exportar CSV para Excel</button><button type="button" className="secondary" onClick={()=>catalogInput.current?.click()}>Seleccionar CSV</button></div>
 <input ref={catalogInput} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={selectCatalog}/>
 {catalogPreview&&<div className="catalogPreview"><strong>Vista previa: {catalogPreview.name} · {catalogPreview.rows.length} artículos</strong><div className="movementHistory"><table><thead><tr><th>Descripción</th><th>Código / SKU</th><th>Precio</th><th>Existencias</th></tr></thead><tbody>{catalogPreview.rows.slice(0,8).map((r,i)=><tr key={i}><td>{r.description}</td><td>{r.product_code}</td><td>{r.price}</td><td>{r.stock||0}</td></tr>)}</tbody></table></div><p className="hint">Se muestran los primeros 8 artículos. La importación es todo o nada: si una fila falla, no se guarda ninguna.</p><div className="actions"><button type="button" disabled={catalogBusy} onClick={importCatalog}>Confirmar importación</button><button type="button" className="secondary" onClick={()=>setCatalogPreview(null)}>Cancelar</button></div></div>}
 </div>}{tab==='products'&&<div className="catalogTools"><h4>Exportar movimientos de inventario</h4><p className="hint">Incluye todo el historial, también de artículos eliminados. El archivo CSV conserva códigos y nombres con acentos.</p><div className="two"><Field title="Artículos incluidos"><select value={movementExportStatus} onChange={e=>setMovementExportStatus(e.target.value)}><option value="all">Activos y eliminados</option><option value="active">Solo activos</option><option value="deleted">Solo eliminados</option></select></Field><Field title="Orden de exportación"><select value={movementExportSort} onChange={e=>setMovementExportSort(e.target.value)}><option value="az">Artículo A–Z</option><option value="za">Artículo Z–A</option><option value="newest">Movimientos más recientes</option><option value="oldest">Movimientos más antiguos</option></select></Field></div><div className="actions"><button type="button" className="secondary" onClick={exportMovements}>Exportar movimientos CSV</button></div></div>}<Field title="Buscar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='clients'?'Nombre e identificación':'Producto, código y SKU'}/></Field><Field title="Ordenar por"><select value={sortBy} onChange={e=>changeSort(e.target.value)}>
 <option value="az">Nombre A–Z</option><option value="za">Nombre Z–A</option>
 <option value="newest">Más recientes</option><option value="oldest">Más antiguos</option>
 {tab==='clients'?<option value="identification">Número de identificación</option>:<>
 <option value="price_asc">Precio: menor a mayor</option><option value="price_desc">Precio: mayor a menor</option>
 <option value="stock_asc">Existencias: menor a mayor</option><option value="stock_desc">Existencias: mayor a menor</option>
 </>}</select></Field><p className="hint">{filtered.length} registro(s) encontrados · Preferencia guardada por empresa y módulo.</p><div className="records">{filtered.length===0?<p>No hay registros.</p>:filtered.map(item=><article className="record" key={item.id}>
 {tab==='products'&&<div className="thumbWrap">{item.image_data?<img className="thumb" src={item.image_data} alt={`Foto de ${item.description}`}/>:<div className="thumb thumbEmpty">Sin foto</div>}</div>}
 <div className="recordcontent"><b>{tab==='clients'?item.name:item.description}</b><small>{tab==='clients'?`${item.identification} · ${item.email||'Sin correo'} · ${item.phone||'Sin teléfono'}`:`${item.product_code||'Sin SKU'} · ${item.currency} ${Number(item.price).toFixed(2)} · IVA ${item.tax_rate}% · ${item.kind}`}</small>
 {tab==='products'&&item.kind==='producto'&&Number(item.track_stock)===1&&<small className={Number(item.alert_enabled)===1&&Number(item.stock)<=Number(item.min_stock)?'low':''}>Existencias: {item.stock} {item.unit} {Number(item.alert_enabled)===1&&Number(item.stock)<=Number(item.min_stock)?'· STOCK BAJO':''}</small>}</div>
 <div className="actions">{tab==='products'&&item.kind==='producto'&&Number(item.track_stock)===1&&<button className="secondary" onClick={()=>openMovement(item)}>Movimientos</button>}<button className="secondary" onClick={()=>edit(item)}>Editar</button><button className="danger" onClick={()=>remove(item)}>Eliminar</button></div></article>)}</div></div></section>}
 {tab==='products'&&movementProduct&&<section className="card movementPanel"><h3>Entradas, salidas y ajustes · {items.find(p=>p.id===movementProduct)?.description||'Producto'}</h3>
 <form onSubmit={saveMovement}><div className="three"><Field title="Tipo de movimiento"><select value={moveForm.movement_type} onChange={e=>setMoveForm({...moveForm,movement_type:e.target.value,reason:e.target.value==='entrada'?'Compra':e.target.value==='salida'?'Venta':'Conteo físico'})}><option value="entrada">Entrada (sumar)</option><option value="salida">Salida (restar)</option><option value="ajuste">Ajuste (saldo final)</option></select></Field><Field title={moveForm.movement_type==='ajuste'?'Existencias finales':'Cantidad'}><input type="number" min="1" step="1" required value={moveForm.quantity} onChange={e=>setMoveForm({...moveForm,quantity:e.target.value})}/></Field><Field title="Motivo"><input required maxLength="120" value={moveForm.reason} onChange={e=>setMoveForm({...moveForm,reason:e.target.value})}/></Field></div><Field title="Observaciones"><input maxLength="500" value={moveForm.notes} onChange={e=>setMoveForm({...moveForm,notes:e.target.value})}/></Field><div className="actions"><button type="submit">Registrar movimiento</button><button type="button" className="secondary" onClick={()=>setMovementProduct(null)}>Cerrar</button></div></form>
 <h4>Historial (últimos 300 movimientos)</h4><div className="movementHistory"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cambio</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{m.created_at}</td><td>{m.movement_type}</td><td>{m.delta>0?'+':''}{m.delta}</td><td>{m.stock_before}</td><td>{m.stock_after}</td><td>{m.reason}</td></tr>)}</tbody></table></div></section>}
 <p className="warning">Versión de desarrollo: la eliminación de empresas está bloqueada hasta implementar autenticación. El catálogo territorial se carga desde una fuente pública y debe revisarse antes de emitir comprobantes; CABYS requiere verificación oficial. El inventario registra movimientos manuales y automáticos por ventas internas. No emite XML ni factura electrónica de Hacienda.</p>
 </main>{dialog&&<div className="dialogOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeDialog()}}><section className="dialogCard" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeDialog()}}}>
  <div className="dialogSymbol" aria-hidden="true">{dialog.danger?'!':'✓'}</div>
  <h3 id="dialog-title">{dialog.title}</h3><p id="dialog-description">{dialog.description}</p>
  <div className="dialogActions"><button type="button" className="secondary" autoFocus onClick={closeDialog}>Cancelar</button><button type="button" className={dialog.danger?'danger':''} onClick={confirmDialog}>{dialog.danger?'Eliminar':'Confirmar'}</button></div>
 </section></div>}</div>;
}
createRoot(document.getElementById('root')).render(<ScreenErrorBoundary><App/></ScreenErrorBoundary>);
