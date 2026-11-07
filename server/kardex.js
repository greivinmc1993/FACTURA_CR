// Kardex global de inventario. Solo lectura; nunca modifica existencias.
const types=['all','entrada','salida','ajuste'];
const dateRE=/^\d{4}-\d{2}-\d{2}$/;
export function buildKardexFilters(query={}){
 const type=String(query.type||'all');
 const productId=String(query.productId||'').trim();
 const from=String(query.from||'').trim(),to=String(query.to||'').trim();
 const search=String(query.search||'').trim();
 const page=Number(query.page||1);
 if(!types.includes(type))throw Error('Tipo de movimiento inválido.');
 if(productId&&!/^[1-9]\d{0,12}$/.test(productId))throw Error('Artículo inválido.');
 for(const day of [from,to])if(day&&(!dateRE.test(day)||Number.isNaN(new Date(day+'T00:00:00Z').valueOf())||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day))throw Error('Fecha inválida.');
 if(from&&to&&from>to)throw Error('La fecha inicial no puede superar la final.');
 if(search.length>100)throw Error('Búsqueda demasiado larga.');
 if(!Number.isSafeInteger(page)||page<1||page>1000000)throw Error('Página inválida.');
 const params=[];let where='m.company_id=?';
 if(productId){where+=' AND m.product_id=?';params.push(Number(productId))}
 if(type!=='all'){where+=' AND m.movement_type=?';params.push(type)}
 if(from){where+=' AND m.created_at>=?';params.push(from+' 00:00:00')}
 if(to){where+=' AND m.created_at<?';params.push(new Date(new Date(to+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10)+' 00:00:00')}
 if(search){where+=' AND (p.description LIKE ? OR p.product_code LIKE ? OR m.reason LIKE ?)';params.push(...Array(3).fill('%'+search+'%'))}
 return {where,params,page,from,to,type,productId,search};
}
const BASE=`FROM inventory_movements m JOIN products p ON p.id=m.product_id AND p.company_id=m.company_id`;
const FIELDS=`m.id,m.created_at,m.product_id,p.description AS product_name,p.product_code,p.unit,p.is_deleted,m.movement_type,m.quantity,m.delta,m.stock_before,m.stock_after,m.reason,m.notes`;
export function registerKardexRoutes(app,db){
 const core=(req,res)=>{
  const companyId=Number(req.params.companyId);
  if(!Number.isSafeInteger(companyId)||companyId<1||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId)){
   res.status(404).json({error:'Empresa no encontrada.'});return null;
  }
  try{const filters=buildKardexFilters(req.query);return {...filters,args:[companyId,...filters.params]}}
  catch(e){res.status(400).json({error:e.message});return null}
 };
 app.get('/api/companies/:companyId/inventory/kardex',(req,res)=>{
  const f=core(req,res);if(!f)return;
  const summary=db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN m.delta>0 THEN m.delta ELSE 0 END),0) AS increases,COALESCE(SUM(CASE WHEN m.delta<0 THEN -m.delta ELSE 0 END),0) AS decreases,COUNT(DISTINCT m.product_id) AS products ${BASE} WHERE ${f.where}`).get(...f.args);
  const limit=50,offset=(f.page-1)*limit;
  const rows=db.prepare(`SELECT ${FIELDS} ${BASE} WHERE ${f.where} ORDER BY m.id DESC LIMIT ? OFFSET ?`).all(...f.args,limit,offset);
  res.json({rows,summary,page:f.page,pageSize:limit,totalPages:Math.max(1,Math.ceil(summary.count/limit))});
 });
 app.get('/api/companies/:companyId/inventory/kardex/export.csv',(req,res)=>{
  const f=core(req,res);if(!f)return;
  const esc=value=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\u0027$&')+'"';
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="FacturaCR_kardex.csv"');
  const cols=['ID','Fecha UTC','Artículo','SKU','Estado','Tipo','Cantidad','Variación','Existencia anterior','Existencia posterior','Unidad','Motivo','Observaciones'];
  res.write('\uFEFFsep=;\r\n'+cols.map(esc).join(';')+'\r\n');
  // Iteración en lotes: evita retener todo el historial en memoria.
  const stmt=db.prepare(`SELECT ${FIELDS} ${BASE} WHERE ${f.where} AND m.id<? ORDER BY m.id DESC LIMIT 500`);
  let lastId=Number.MAX_SAFE_INTEGER;
  for(;;){
   const batch=stmt.all(...f.args,lastId);if(!batch.length)break;
   for(const r of batch){const v=[r.id,r.created_at,r.product_name,r.product_code,r.is_deleted?'Retirado':'Activo',r.movement_type,r.quantity,r.delta,r.stock_before,r.stock_after,r.unit,r.reason,r.notes];res.write(v.map(esc).join(';')+'\r\n')}
   lastId=batch[batch.length-1].id;
   if(batch.length<500)break;
  }
  res.end();
 });
}
