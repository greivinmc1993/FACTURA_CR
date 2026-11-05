import React,{useCallback,useEffect,useMemo,useState} from 'react';

const fmtMoney=cents=>'₡'+Math.round(Number(cents||0)/100).toLocaleString('es-CR');
const utcDay=date=>date.toISOString().slice(0,10);
const currentRange=()=>{const now=new Date();return {from:utcDay(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))),to:utcDay(now)}};
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';

export default function DashboardPanel({companyId,company}){
 const initial=useMemo(currentRange,[]);
 const [from,setFrom]=useState(initial.from),[to,setTo]=useState(initial.to);
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async(signal)=>{
  if(!companyId){setData(null);setError('');return}
  setBusy(true);setError('');setData(null);
  try{
   const response=await fetch(`/api/companies/${companyId}/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,{signal});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'No se pudo consultar el dashboard.');
   if(!signal?.aborted)setData(json);
  }catch(err){if(err.name!=='AbortError')setError(err.message)}finally{if(!signal?.aborted)setBusy(false)}
 },[companyId,from,to]);
 useEffect(()=>{const ctrl=new AbortController();load(ctrl.signal);return()=>ctrl.abort()},[load]);
 const setPreset=kind=>{const now=new Date();const today=utcDay(now);
  if(kind==='month'){setFrom(utcDay(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1))));setTo(today)}
  if(kind==='week'){const day=now.getUTCDay();const monday=new Date(now);monday.setUTCDate(monday.getUTCDate()-((day+6)%7));setFrom(utcDay(monday));setTo(today)}
  if(kind==='year'){setFrom(utcDay(new Date(Date.UTC(now.getUTCFullYear(),0,1))));setTo(today)}
 };
 const downloadCsv=()=>{
  if(!data)return;
  const rows=[['Fecha (UTC)','Ventas válidas','Ingresos CRC'],...data.daily.map(d=>[d.day,d.sales,(d.revenue_cents/100).toFixed(2)])];
  const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`FacturaCR_dashboard_${from}_${to}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 };
 const stats=data?.summary;
 const peak=Math.max(1,...(data?.daily||[]).map(d=>Number(d.revenue_cents)||0));
 return <section className="bizDashboard">
  <div className="card bizDashHero"><div><p className="bizDashEyebrow">ANÁLISIS COMERCIAL · DATOS LOCALES</p><h3>Resumen de {company?.trade_name||company?.legal_name||'tu empresa'}</h3><p className="hint">Ventas internas registradas en esta empresa. Se excluyen las anuladas. No es un reporte fiscal ni de utilidad neta.</p></div><button className="secondary" type="button" onClick={()=>load()} disabled={busy||!companyId}>↻ Actualizar</button></div>
  <div className="card bizDashFilters"><div className="bizDashPresets"><button type="button" className="secondary" onClick={()=>setPreset('week')}>Esta semana</button><button type="button" className="secondary" onClick={()=>setPreset('month')}>Este mes</button><button type="button" className="secondary" onClick={()=>setPreset('year')}>Este año</button></div><label>Desde (UTC)<input aria-label="Fecha inicial del dashboard" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta (UTC)<input aria-label="Fecha final del dashboard" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" className="secondary" onClick={downloadCsv} disabled={!data||busy}>Exportar CSV</button></div>
  {!companyId?<div className="card">Selecciona una empresa para consultar el dashboard.</div>:<>
  {busy&&<div className="card" role="status">Consultando movimientos comerciales…</div>}
  {error&&<div className="card bizDashError" role="alert">{error}</div>}
  {data&&<>
   <div className="bizDashMetrics">
    <div className="bizDashMetric"><span>Ventas del período</span><strong>{fmtMoney(stats.revenue_cents)}</strong><small>Ventas activas creadas en el período</small></div>
    <div className="bizDashMetric"><span>Ventas registradas</span><strong>{Number(stats.sale_count).toLocaleString('es-CR')}</strong><small>{stats.annulled_count} anuladas excluidas</small></div>
    <div className="bizDashMetric"><span>Ticket promedio</span><strong>{fmtMoney(stats.average_ticket_cents)}</strong><small>Promedio por venta activa</small></div>
    <div className="bizDashMetric"><span>Crédito pendiente total</span><strong>{fmtMoney(data.outstanding.balance_cents)}</strong><small>{data.outstanding.count} ventas con saldo · todas las fechas</small></div>
   </div>
   <div className="bizDashGrid">
    <article className="card bizDashChart"><div className="bizDashSectionHead"><div><h4>Evolución de ventas</h4><p className="hint">Por fecha de registro de venta (UTC) · valores con IVA</p></div></div>
     {data.daily.length?<div className="bizDashBars" aria-label="Gráfica de ingresos por fecha">{data.daily.map(d=><div className="bizDashBarItem" key={d.day} title={`${d.day}: ${fmtMoney(d.revenue_cents)} · ${d.sales} ventas`}><div className="bizDashBar" style={{height:`${Math.max(3,100*Number(d.revenue_cents)/peak)}%`}}/><small>{d.day.slice(5)}</small></div>)}</div>:<p className="bizDashEmpty">No hay ventas activas en estas fechas.</p>}
     <div className="bizDashChartFooter"><span>Base después de descuento: <strong>{fmtMoney(stats.net_base_cents)}</strong></span><span>IVA: <strong>{fmtMoney(stats.tax_cents)}</strong></span></div>
    </article>
    <article className="card bizDashTop"><div className="bizDashSectionHead"><div><h4>Productos más vendidos</h4><p className="hint">Ordenados por unidades · excluye ventas anuladas</p></div></div>
     {data.top_products.length?<div className="bizDashTopList">{data.top_products.map((p,i)=><div className="bizDashTopLine" key={`${p.product_id}-${p.description}`}><span className="bizDashRank">{i+1}</span><div className="bizDashTopName"><strong>{p.description}</strong><small>{Number(p.units).toLocaleString('es-CR')} unidades</small></div><b>{fmtMoney(p.revenue_cents)}</b></div>)}</div>:<p className="bizDashEmpty">No hay artículos vendidos en este período.</p>}
    </article>
   </div>
   <article className="card bizDashBottom"><div className="bizDashSectionHead"><div><h4>Pagos recibidos por método</h4><p className="hint">Movimientos cobrados en el período, únicamente de ventas actualmente activas. Los abonos pueden corresponder a ventas anteriores.</p></div></div>
     {data.payment_methods.length?<div className="bizDashMethods">{data.payment_methods.map(p=><div className="bizDashMethod" key={p.method}><strong>{p.method}</strong><small>{p.operations} movimiento(s)</small><b>{fmtMoney(p.amount_cents)}</b></div>)}</div>:<p className="bizDashEmpty">No hay pagos registrados en las fechas seleccionadas.</p>}
   </article>
   <p className="bizDashFootnote">Los importes están expresados en colones (CRC). Las fechas usan UTC, tal como se almacenan en SQLite. Las ventas del período representan operaciones creadas en el período, mientras los cobros se agrupan según su fecha de pago; no deben sumarse entre sí. El crédito pendiente incluye todas las fechas.</p>
  </>}
  </>}
 </section>;
}
