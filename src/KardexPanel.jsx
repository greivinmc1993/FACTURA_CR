import React,{useEffect,useState} from 'react';

const initial={search:'',productId:'',type:'all',from:'',to:''};
const currency=n=>Number(n||0).toLocaleString('es-CR',{maximumFractionDigits:2});
export default function KardexPanel({companyId}){
 const [filters,setFilters]=useState(initial),[page,setPage]=useState(1);
 const [data,setData]=useState(null),[products,setProducts]=useState([]);
 const [loading,setLoading]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setFilters(initial);setPage(1);setData(null);setError('');if(!companyId){setProducts([]);return}
  let active=true;fetch(`/api/companies/${companyId}/products`).then(async r=>{if(!r.ok)throw Error('No se pudo consultar el catálogo.');return r.json()}).then(rows=>{if(active)setProducts(rows.filter(p=>p.kind==='producto'))}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[companyId]);
 useEffect(()=>{
  if(!companyId)return;
  const abort=new AbortController();setLoading(true);setError('');
  const params=new URLSearchParams({...filters,page:String(page)});
  fetch(`/api/companies/${companyId}/inventory/kardex?${params}`,{signal:abort.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'No se pudo consultar el kardex.');return j}).then(j=>setData(j)).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return()=>abort.abort();
 },[companyId,filters,page]);
 const change=(key,val)=>{setFilters(f=>({...f,[key]:val}));setPage(1)};
 const exportCsv=async()=>{
  if(!companyId||exporting)return;
  setExporting(true);setError('');
  try{const p=new URLSearchParams(filters),res=await fetch(`/api/companies/${companyId}/inventory/kardex/export.csv?${p}`);
   if(!res.ok){const j=await res.json();throw Error(j.error||'No se pudo exportar.')}const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`FacturaCR_kardex_empresa_${companyId}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){setError(e.message)}finally{setExporting(false)}
 };
 if(!companyId)return <section className="card">Selecciona una empresa para consultar el Kardex.</section>;
 const summary=data?.summary||{count:0,increases:0,decreases:0,products:0};
 return <div className="kardexWorkspace">
  <section className="card kardexHero"><div><small className="kardexEyebrow">TRAZABILIDAD DE EXISTENCIAS</small><h3>Kardex · Movimientos de inventario</h3><p className="hint">Registros históricos de entradas, salidas y ajustes. Esta pantalla es de solo lectura; no modifica existencias.</p></div><button type="button" disabled={exporting||loading} onClick={exportCsv}>{exporting?'Exportando…':'Exportar CSV completo'}</button></section>
  <section className="card kardexFilters">
   <label>Buscar artículo, SKU o motivo<input value={filters.search} maxLength="100" onChange={e=>change('search',e.target.value)} placeholder="Buscar movimientos…"/></label>
   <label>Artículo<select value={filters.productId} onChange={e=>change('productId',e.target.value)}><option value="">Todos los artículos</option>{products.map(p=><option value={p.id} key={p.id}>{p.description} · {p.product_code||'sin SKU'}</option>)}</select></label>
   <label>Tipo<select value={filters.type} onChange={e=>change('type',e.target.value)}><option value="all">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option><option value="ajuste">Ajustes</option></select></label>
   <label>Desde (UTC)<input type="date" value={filters.from} max={filters.to||undefined} onChange={e=>change('from',e.target.value)}/></label>
   <label>Hasta (UTC)<input type="date" value={filters.to} min={filters.from||undefined} onChange={e=>change('to',e.target.value)}/></label>
   <button type="button" className="secondary" onClick={()=>{setFilters({...initial});setPage(1)}}>Limpiar filtros</button>
  </section>
  {error&&<p className="notice" role="alert">{error}</p>}
  <div className="kardexStats"><article><small>Movimientos filtrados</small><strong>{currency(summary.count)}</strong></article><article><small>Unidades añadidas</small><strong className="kardexPositive">+{currency(summary.increases)}</strong></article><article><small>Unidades retiradas</small><strong className="kardexNegative">−{currency(summary.decreases)}</strong></article><article><small>Artículos involucrados</small><strong>{currency(summary.products)}</strong></article></div>
  <section className="card kardexResults"><div className="kardexResultsHead"><h3>Historial completo</h3><span className="hint">{loading?'Consultando…':`${summary.count} movimiento(s) · Página ${data?.page||page} de ${data?.totalPages||1}`}</span></div>
   <div className="movementHistory kardexTableScroll"><table><thead><tr><th>Fecha UTC</th><th>Artículo / SKU</th><th>Tipo</th><th>Variación</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead><tbody>{(data?.rows||[]).map(r=><tr key={r.id}><td>{r.created_at}</td><td><strong>{r.product_name}</strong><small className="kardexSub">{r.product_code||'Sin SKU'}{r.is_deleted?' · Retirado':''}</small></td><td><span className={'kardexType '+r.movement_type}>{r.movement_type}</span></td><td><strong className={r.delta>0?'kardexPositive':r.delta<0?'kardexNegative':''}>{r.delta>0?'+':''}{currency(r.delta)}</strong></td><td>{currency(r.stock_before)}</td><td>{currency(r.stock_after)}</td><td>{r.reason}{r.notes&&<small className="kardexSub">{r.notes}</small>}</td></tr>)}{!loading&&!data?.rows?.length&&<tr><td colSpan="7">No se encontraron movimientos para los filtros seleccionados.</td></tr>}</tbody></table></div>
   <div className="kardexPager"><span>50 movimientos por página; la exportación incluye todos los registros filtrados.</span><div className="actions"><button type="button" className="secondary" disabled={loading||page<=1} onClick={()=>setPage(n=>n-1)}>Anterior</button><button type="button" className="secondary" disabled={loading||page>=(data?.totalPages||1)} onClick={()=>setPage(n=>n+1)}>Siguiente</button></div></div>
  </section>
 </div>
}
