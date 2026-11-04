import { makeXlsx } from './xlsx.js';
import express from 'express';
import Database from 'better-sqlite3';
import { mkdirSync, mkdtempSync, unlinkSync, renameSync, existsSync, rmSync, createWriteStream, statSync, statfsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function startServer({ dataDir = join(process.cwd(), 'data'), port = 3001, staticDir = null } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const databasePath = join(dataDir, 'facturacr.sqlite');
  let db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const clientExtra = {
    trade_name:"TEXT NOT NULL DEFAULT ''", identification_type:"TEXT NOT NULL DEFAULT '01'",
    province:"TEXT NOT NULL DEFAULT ''", canton:"TEXT NOT NULL DEFAULT ''",
    district:"TEXT NOT NULL DEFAULT ''", address:"TEXT NOT NULL DEFAULT ''",
    activity_code:"TEXT NOT NULL DEFAULT ''", country_code:"TEXT NOT NULL DEFAULT '506'",
    phone_alt:"TEXT NOT NULL DEFAULT ''", preferred_payment:"TEXT NOT NULL DEFAULT ''", notes:"TEXT NOT NULL DEFAULT ''"
  };
  const productExtra = {
    product_code:"TEXT NOT NULL DEFAULT ''", image_data:"TEXT NOT NULL DEFAULT ''",
    tax_code:"TEXT NOT NULL DEFAULT '08'", unit:"TEXT NOT NULL DEFAULT 'Unid'",
    stock:"REAL NOT NULL DEFAULT 0", min_stock:"REAL NOT NULL DEFAULT 0",
    track_stock:"INTEGER NOT NULL DEFAULT 1", barcode:"TEXT NOT NULL DEFAULT ''",
    cost:"REAL NOT NULL DEFAULT 0", notes:"TEXT NOT NULL DEFAULT ''"
  };
  function migrateDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    legal_name TEXT NOT NULL,
    identification TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, identification TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, identification)
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('producto','servicio')),
    description TEXT NOT NULL, cabys TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK(price >= 0),
    currency TEXT NOT NULL CHECK(currency IN ('CRC','USD')),
    tax_rate REAL NOT NULL CHECK(tax_rate >= 0 AND tax_rate <= 100),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  // Migraciones no destructivas: conservan empresas, clientes y productos existentes.
  function addColumn(table, name, definition) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  for (const [k,v] of Object.entries(clientExtra)) addColumn('clients',k,v);
  for (const [k,v] of Object.entries(productExtra)) addColumn('products',k,v);
  // Historial inmutable de entradas, salidas y ajustes, separado por empresa.
  db.exec(`CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('entrada','salida','ajuste')),
    quantity REAL NOT NULL CHECK(quantity > 0),
    delta REAL NOT NULL,
    stock_before REAL NOT NULL,
    stock_after REAL NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_product ON inventory_movements(company_id,product_id,created_at);`);
  addColumn('products','alert_enabled','INTEGER NOT NULL DEFAULT 1');
  addColumn('products','is_deleted','INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    sale_type TEXT NOT NULL CHECK(sale_type IN ('contado','credito')),
    status TEXT NOT NULL DEFAULT 'activa' CHECK(status IN ('activa','anulada')),
    currency TEXT NOT NULL DEFAULT 'CRC',
    subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
    paid_cents INTEGER NOT NULL, balance_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    annulled_at TEXT, annul_reason TEXT
  );
  CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    description TEXT NOT NULL, quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL, tax_rate REAL NOT NULL,
    discount_cents INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    method TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sales_company_date ON sales(company_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(company_id,client_id);`);
  // Los códigos internos se validan por empresa en las operaciones nuevas.
  }
  migrateDatabase();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'2mb'}));
  // Limpieza tolerante a archivos temporalmente bloqueados en Windows.
  // Nunca permitir que una excepción en callbacks de descarga termine Electron.
  async function cleanTempDir(dir) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); return; }
      catch (err) {
        if (attempt === 4) { console.warn('Limpieza temporal pendiente:', dir, err.message); return; }
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  // Backups: use SQLite's online backup API (safe with WAL enabled).
  // Restoration is deliberately restricted to a complete, validated SQLite file.
  app.get('/api/backups/download', async (_req,res)=>{
    const dir=mkdtempSync(join(tmpdir(),'facturacr-backup-'));
    const snapshot=join(dir,'facturacr.sqlite');
    try {
      await db.backup(snapshot);
      const date=new Date().toISOString().replace(/[:.]/g,'-');
      res.download(snapshot,`FacturaCR_respaldo_${date}.sqlite`,err=>{
        // El stream de Windows puede mantener el archivo abierto unos instantes.
        void cleanTempDir(dir);
        if(err&&!res.headersSent)res.status(500).json({error:'No se pudo descargar el respaldo.'});
      });
    } catch(err) {
      await cleanTempDir(dir);
      console.error('Backup:',err);
      if(!res.headersSent)res.status(500).json({error:'No se pudo crear el respaldo.'});
    }
  });
  app.get('/api/health',(_req,res)=>res.json({ok:true,version:'0.6.0',backups:true}));
  app.get('/api/backups/status',(_req,res)=>{
    try {
      const fs=statfsSync(dataDir);
      const dbBytes=statSync(databasePath).size;
      const wal=databasePath+'-wal';
      res.json({databaseBytes:dbBytes,walBytes:existsSync(wal)?statSync(wal).size:0,freeBytes:Number(fs.bavail)*Number(fs.bsize),totalBytes:Number(fs.blocks)*Number(fs.bsize)});
    } catch(err){res.status(500).json({error:'No se pudo consultar el espacio de almacenamiento.'})}
  });
  // Recibir restauraciones en disco, por streaming, sin límite fijo de 100/512 MB.
  // Se conserva un margen de espacio libre para la copia previa y la restauración.
  app.post('/api/backups/restore',async(req,res)=>{
    if(!String(req.headers['content-type']||'').startsWith('application/octet-stream'))
      return res.status(415).json({error:'Seleccione un archivo SQLite válido.'});
    const declared=Number(req.headers['content-length']);
    if(!Number.isSafeInteger(declared)||declared<512)
      return res.status(400).json({error:'No se pudo determinar el tamaño del respaldo.'});
    const dbSize=statSync(databasePath).size;
    const fs=statfsSync(dataDir);
    const free=Number(fs.bavail)*Number(fs.bsize);
    if(free < declared + dbSize*2 + 100*1024*1024)
      return res.status(507).json({error:'Espacio insuficiente para restaurar y proteger los datos actuales. Libere espacio en el disco.'});
    const dir=mkdtempSync(join(dataDir,'.restore-'));
    const candidate=join(dir,'candidate.sqlite');
    const previous=join(dataDir,`facturacr_antes_restaurar_${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
    let closed=false, oldMoved=false;
    try {
      await pipeline(req,createWriteStream(candidate,{flags:'wx',mode:0o600}));
      if(statSync(candidate).size!==declared)throw Error('El archivo recibido está incompleto.');
      const test=new Database(candidate,{readonly:true,fileMustExist:true});
      try {
        const integrity=test.pragma('integrity_check',{simple:true});
        if(integrity!=='ok')throw Error('El respaldo no pasó la verificación de integridad.');
        const tables=test.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
        if(!['companies','clients','products','inventory_movements'].every(t=>tables.includes(t)))throw Error('El respaldo no pertenece a una versión compatible de FacturaCR.');
        for(const t of ['companies','clients','products','inventory_movements']) {
          test.prepare(`SELECT * FROM ${t} LIMIT 1`).all();
          const actual=new Set(test.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name));
          const expected=new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name));
          if([...actual].some(col=>!expected.has(col)))throw Error('Este respaldo contiene campos de una versión más nueva ('+t+'). Actualiza FacturaCR antes de restaurarlo.');
        }
      }finally{test.close()}
      // Preserve a consistent copy of current data BEFORE attempting replacement.
      await db.backup(previous);
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();closed=true;
      renameSync(databasePath,join(dir,'old.sqlite'));oldMoved=true;
      renameSync(candidate,databasePath);
      db=new Database(databasePath);
      db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
      migrateDatabase(); // Actualiza el esquema de respaldos anteriores sin perder registros.
      res.json({ok:true,previousBackup:previous.split(/[\\/]/).pop(),message:'Respaldo restaurado. La aplicación recargará los datos.'});
    }catch(err){
      console.error('Restore:',err);
      if(closed){
        try {
          if(oldMoved){
            try{db?.close()}catch{}
            if(existsSync(databasePath))unlinkSync(databasePath);
            renameSync(join(dir,'old.sqlite'),databasePath);
          }
          db=new Database(databasePath);db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
        }catch(recoveryErr){console.error('Recovery failed:',recoveryErr)}
      }
      res.status(400).json({error:'No se pudo restaurar: '+err.message});
    }finally{await cleanTempDir(dir)}
  });
  app.get('/api/companies', (_req,res) => res.json(db.prepare('SELECT id,legal_name,identification FROM companies ORDER BY id DESC').all()));
  app.post('/api/companies',(req,res)=>{
    const legal_name = String(req.body?.legal_name ?? '').trim();
    const identification = String(req.body?.identification ?? '').trim();
    if (!legal_name || legal_name.length > 160 || !/^\d{9,12}$/.test(identification)) {
      return res.status(400).json({error:'Ingrese una razón social (máx. 160 caracteres) y una identificación de 9 a 12 dígitos.'});
    }
    try {
      const result = db.prepare('INSERT INTO companies(legal_name,identification) VALUES (?,?)').run(legal_name,identification);
      res.status(201).json({id:Number(result.lastInsertRowid),legal_name,identification});
    } catch (err) {
      if (err.code?.startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({error:'La identificación ya está registrada.'});
      console.error(err);
      res.status(500).json({error:'No se pudo guardar la empresa.'});
    }
  });
  // All records are scoped to an existing company. Parameters are bound in SQL.
  const configs = {
    clients: {
      columns: ['name','identification','email','phone',...Object.keys(clientExtra)],
      parse(body) {
        const v = {};
        for (const key of this.columns) v[key] = String(body?.[key] ?? '').trim();
        if (!v.name || v.name.length > 100) throw Error('Indique nombre o razón social (máximo 100 caracteres).');
        if (!['01','02','03','04','05'].includes(v.identification_type)) throw Error('Seleccione un tipo de identificación válido.');
        const digits = v.identification;
        if (!/^[0-9A-Za-z]{3,20}$/.test(digits)) throw Error('Identificación inválida (sin guiones).');
        if (v.identification_type==='01' && !/^\d{9}$/.test(digits)) throw Error('La cédula física requiere 9 dígitos.');
        if (v.identification_type==='02' && !/^\d{10}$/.test(digits)) throw Error('La cédula jurídica requiere 10 dígitos.');
        if (v.email && (v.email.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))) throw Error('Correo inválido.');
        if (v.preferred_payment && !['01','02','03','04','05','06','07','99'].includes(v.preferred_payment)) throw Error('Medio de pago no válido.');
        if (v.activity_code && !/^(?:\d{4}\.\d|\d{6})$/.test(v.activity_code)) throw Error('Actividad económica: use el formato 3333.3 (se aceptan códigos anteriores de 6 dígitos).');
        if (v.province && !/^[1-7]$/.test(v.province)) throw Error('Provincia inválida.');
        if (v.canton && !/^\d{2}$/.test(v.canton)) throw Error('Cantón: use 2 dígitos.');
        if (v.district && !/^\d{2}$/.test(v.district)) throw Error('Distrito: use 2 dígitos.');
        if (v.address.length>160 || v.trade_name.length>80 || v.notes.length>500) throw Error('Uno de los campos de texto supera el máximo permitido.');
        if (v.phone.length>20 || v.phone_alt.length>20 || !/^\d{1,3}$/.test(v.country_code)) throw Error('Revise teléfonos y código de país.');
        return v;
      }
    },
    products: {
      columns: ['kind','description','cabys','price','currency','tax_rate',...Object.keys(productExtra),'alert_enabled'],
      parse(body) {
        const v={};
        for(const key of this.columns) v[key]=String(body?.[key] ?? '').trim();
        if (!['producto','servicio'].includes(v.kind) || !v.description || v.description.length>250) throw Error('Revise tipo y descripción.');
        if (v.cabys && !/^\d{13}$/.test(v.cabys)) throw Error('CABYS debe contener 13 dígitos.');
        if (!['CRC','USD'].includes(v.currency)) throw Error('Moneda inválida.');
        const tariffs={'01':0,'02':1,'03':2,'04':4,'05':0,'06':4,'07':8,'08':13,'09':0.5,'10':0,'11':0};
        if (!(v.tax_code in tariffs)) throw Error('Seleccione una tarifa de IVA válida.');
        v.tax_rate=tariffs[v.tax_code];
        for (const k of ['price','stock','min_stock','cost']) {
          const n=Number(v[k]);
          if (!Number.isFinite(n) || n<0 || n>1e12) throw Error('Revise precio, costo y existencias.');
          if (['stock','min_stock'].includes(k) && !Number.isSafeInteger(n)) throw Error('Las existencias y el mínimo deben ser números enteros.');
          v[k]=n;
        }
        if (!/^[a-zA-Z0-9_.-]{0,40}$/.test(v.product_code)) throw Error('Código interno: máximo 40 caracteres, sin espacios.');
        if (v.unit.length>20 || v.barcode.length>60 || v.notes.length>500) throw Error('Revise unidad, código de barras y notas.');
        v.track_stock = v.kind==='servicio'?0:(v.track_stock==='0'?0:1);
        v.alert_enabled = v.alert_enabled==='0'?0:1;
        if (v.image_data && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image_data) || v.image_data.length>950000)) throw Error('Imagen inválida o demasiado grande (máximo aproximado 700 KB).');
        return v;
      }
    }
  };
  const catalogColumns=['kind','product_code','barcode','description','cabys','price','cost','currency','tax_code','unit','stock','min_stock','track_stock','alert_enabled','notes'];
  // Excel en Costa Rica usa normalmente punto y coma como separador regional.
  // BOM UTF-8 + sep=; permite abrir directamente con doble clic en Excel.
  const csvEscape=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  // Excel convierte automáticamente identificadores largos en notación científica.
  // Solo los identificadores formados por dígitos se representan como texto en Excel.
  // Se limita estrictamente a dígitos para no introducir fórmulas arbitrarias en CSV.
  const excelIdentifier=value=>{
    const str=String(value??'');
    return /^\d+$/.test(str) ? '=\"'+str+'\"' : str;
  };
  const csvLine=(values,identifierIndices=[])=>values.map((v,i)=>csvEscape(identifierIndices.includes(i)?excelIdentifier(v):v)).join(';')+'\r\n';
  // CSV para Excel de Windows en configuración regional española.
  // Excel clásico puede interpretar UTF-8 como Windows-1252 incluso con BOM;
  // por eso la descarga directa usa Windows-1252, sin BOM.
  // Para interoperabilidad, ?encoding=utf8 permite exportar UTF-8 con BOM.
  const csvEncoding=req=>req.query.encoding==='utf8'?'utf8':'windows-1252';
  const csvBytes=(text,encoding)=>{
    if(encoding==='utf8')return Buffer.from('\uFEFF'+text,'utf8');
    // Códigos Windows-1252 para símbolos comunes fuera de Latin-1.
    const cp1252={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
    const bytes=[];
    for(const ch of text){const n=ch.codePointAt(0);bytes.push(n<=255?n:(cp1252[n]??63));}
    return Buffer.from(bytes);
  };
  // XLSX auténtico: las columnas de identificación, CABYS y SKU son texto,
  // evitando notación científica, pérdida de ceros y problemas de acentos en Excel.
  app.get('/api/companies/:companyId/products/export.xlsx',(req,res)=>{
    const companyId=Number(req.params.companyId);
    if(!Number.isSafeInteger(companyId)||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    const rows=db.prepare('SELECT * FROM products WHERE company_id=? AND is_deleted=0 ORDER BY description COLLATE NOCASE').all(companyId);
    const cols=['kind','product_code','barcode','description','cabys','price','cost','currency','tax_code','unit','stock','min_stock','track_stock','alert_enabled','notes'];
    const labels=['Tipo','Código / SKU','Código de barras','Producto / descripción','CABYS','Precio de venta','Costo','Moneda','Código IVA','Unidad','Existencias','Existencias mínimas','Controla existencias','Alerta habilitada','Observaciones'];
    const numeric=new Set(['price','cost','stock','min_stock','track_stock','alert_enabled']);
    const buffer=makeXlsx('Catálogo',labels,rows.map(row=>cols.map(k=>numeric.has(k)?Number(row[k]):String(row[k]??''))));
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="FacturaCR_catalogo.xlsx"');res.send(buffer);
  });
  app.get('/api/companies/:companyId/products/export.csv',(req,res)=>{
    const companyId=Number(req.params.companyId);
    if(!Number.isSafeInteger(companyId)||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    const products=db.prepare('SELECT * FROM products WHERE company_id=? AND is_deleted=0 ORDER BY id').all(companyId);
    const catalogLabels=['Tipo','Código / SKU','Código de barras','Producto / descripción','CABYS','Precio de venta','Costo','Moneda','Código IVA','Unidad','Existencias','Existencias mínimas','Controla existencias','Alerta habilitada','Observaciones'];
    const encoding=csvEncoding(req);
    res.setHeader('Content-Type',`text/csv; charset=${encoding}`);
    res.setHeader('Content-Disposition','attachment; filename="FacturaCR_catalogo_excel.csv"');
    res.send(csvBytes('sep=;\r\n'+csvLine(catalogLabels)+products.map(product=>csvLine(catalogColumns.map(k=>product[k]),[1,2,4,8])).join(''),encoding));
  });
  app.post('/api/companies/:companyId/products/import',(req,res)=>{
    const companyId=Number(req.params.companyId);
    if(!Number.isSafeInteger(companyId)||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    const rows=req.body?.rows;
    if(!Array.isArray(rows)||rows.length===0||rows.length>2000)return res.status(400).json({error:'Importa entre 1 y 2000 artículos por lote.'});
    try {
      const validated=rows.map((row,index)=>{
        try {
          const v={kind:'producto',product_code:'',barcode:'',description:'',cabys:'',price:'0',cost:'0',currency:'CRC',tax_code:'08',unit:'Unid',stock:'0',min_stock:'0',track_stock:'1',alert_enabled:'1',notes:'',image_data:'',...row};
          // Nunca importar imágenes en este flujo; se añaden desde el formulario.
          v.image_data='';
          return configs.products.parse(v);
        }catch(e){throw Error('Fila '+(index+2)+': '+e.message)}
      });
      const codes=new Set();
      for(const item of validated){
        if(!item.product_code)continue;
        if(codes.has(item.product_code))throw Error('Código duplicado dentro del archivo: '+item.product_code);
        codes.add(item.product_code);
        if(db.prepare('SELECT id FROM products WHERE company_id=? AND product_code=?').get(companyId,item.product_code))throw Error('El código '+item.product_code+' ya existe. La importación no reemplaza artículos existentes.');
      }
      const cols=configs.products.columns;
      const insert=db.prepare(`INSERT INTO products(company_id,${cols.join(',')}) VALUES (?,${cols.map(()=>'?').join(',')})`);
      const movement=db.prepare('INSERT INTO inventory_movements(company_id,product_id,movement_type,quantity,delta,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?,?)');
      const tx=db.transaction(()=>{
        for(const item of validated){
          const result=insert.run(companyId,...cols.map(k=>item[k]));
          if(item.kind==='producto'&&item.track_stock&&item.stock>0)movement.run(companyId,result.lastInsertRowid,'entrada',item.stock,item.stock,0,item.stock,'Importación inicial del catálogo');
        }
      });
      tx();res.status(201).json({ok:true,imported:validated.length});
    }catch(e){res.status(400).json({error:e.message})}
  });
  for (const [table, config] of Object.entries(configs)) {
    const prefix = `/api/companies/:companyId/${table}`;
    const company = req => {
      const id = Number(req.params.companyId);
      return Number.isSafeInteger(id) && id > 0 && db.prepare('SELECT id FROM companies WHERE id=?').get(id) ? id : null;
    };
    app.get(prefix, (req,res) => {
      const id = company(req);
      if (!id) return res.status(404).json({error:'Empresa no encontrada.'});
      res.json(db.prepare(`SELECT * FROM ${table} WHERE company_id=? ${table==='products'?'AND is_deleted=0':''} ORDER BY id DESC`).all(id));
    });
    app.post(prefix, (req,res) => {
      const id = company(req);
      if (!id) return res.status(404).json({error:'Empresa no encontrada.'});
      try {
        const item = config.parse(req.body);
        const cols = config.columns;
        // La existencia inicial se registra como movimiento de apertura.
        if (table==='products' && item.kind==='producto' && item.track_stock && item.stock>0) {
          const tx=db.transaction(()=>{
            const result=db.prepare(`INSERT INTO ${table} (company_id,${cols.join(',')}) VALUES (?,${cols.map(()=>'?').join(',')})`).run(id,...cols.map(c=>item[c]));
            db.prepare('INSERT INTO inventory_movements(company_id,product_id,movement_type,quantity,delta,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?,?)').run(id,result.lastInsertRowid,'entrada',item.stock,item.stock,0,item.stock,'Inventario inicial');
            return result;
          });
          const result=tx();
          return res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id=? AND company_id=?`).get(result.lastInsertRowid,id));
        }
        const result = db.prepare(`INSERT INTO ${table} (company_id,${cols.join(',')}) VALUES (?,${cols.map(()=>'?').join(',')})`).run(id,...cols.map(c=>item[c]));
        res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id=? AND company_id=?`).get(result.lastInsertRowid,id));
      } catch(err) {
        res.status(err.code?.startsWith('SQLITE_CONSTRAINT') ? 409 : 400).json({error:err.code?.startsWith('SQLITE_CONSTRAINT') ? 'Ya existe un registro con esa identificación.' : err.message});
      }
    });
    app.put(`${prefix}/:itemId`, (req,res) => {
      const id = company(req), itemId = Number(req.params.itemId);
      if (!id) return res.status(404).json({error:'Empresa no encontrada.'});
      if (!Number.isSafeInteger(itemId) || !db.prepare(`SELECT id FROM ${table} WHERE id=? AND company_id=?`).get(itemId,id)) return res.status(404).json({error:'Registro no encontrado.'});
      try {
        const item = config.parse(req.body), cols = config.columns;
        if(table==='products') {
          const old=db.prepare('SELECT * FROM products WHERE id=? AND company_id=?').get(itemId,id);
          if(item.stock!==old.stock) return res.status(400).json({error:'Las existencias se modifican únicamente mediante entradas, salidas o ajustes en el historial.'});
          if(old.kind==='producto' && item.kind==='servicio' && db.prepare('SELECT id FROM inventory_movements WHERE product_id=? LIMIT 1').get(itemId)) return res.status(400).json({error:'No se puede convertir a servicio un producto con historial de inventario.'});
        }
        db.prepare(`UPDATE ${table} SET ${cols.map(c=>c+'=?').join(',')} WHERE id=? AND company_id=?`).run(...cols.map(c=>item[c]),itemId,id);
        res.json(db.prepare(`SELECT * FROM ${table} WHERE id=? AND company_id=?`).get(itemId,id));
      } catch(err) {
        res.status(err.code?.startsWith('SQLITE_CONSTRAINT') ? 409 : 400).json({error:err.code?.startsWith('SQLITE_CONSTRAINT') ? 'Ya existe un registro con esa identificación.' : err.message});
      }
    });
    app.delete(`${prefix}/:itemId`, (req,res) => {
      const id = company(req), itemId = Number(req.params.itemId);
      if (!id) return res.status(404).json({error:'Empresa no encontrada.'});
      if (!Number.isSafeInteger(itemId)) return res.status(404).json({error:'Registro no encontrado.'});
      if(table==='products'){const result=db.prepare('UPDATE products SET is_deleted=1 WHERE id=? AND company_id=? AND is_deleted=0').run(itemId,id);return res.status(result.changes?204:404).end();}
      const result = db.prepare(`DELETE FROM ${table} WHERE id=? AND company_id=?`).run(itemId,id);
      res.status(result.changes ? 204 : 404).end();
    });
  }
  // Movimientos: la API calcula el saldo dentro de una transacción SQLite.
  app.get('/api/companies/:companyId/inventory/movements',(req,res)=>{
    const companyId=Number(req.params.companyId), productId=Number(req.query.productId);
    if(!Number.isSafeInteger(companyId)||companyId<1||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId)) return res.status(404).json({error:'Empresa no encontrada.'});
    if(!Number.isSafeInteger(productId)||productId<1) return res.status(400).json({error:'Seleccione un producto.'});
    res.json(db.prepare('SELECT * FROM inventory_movements WHERE company_id=? AND product_id=? ORDER BY id DESC LIMIT 300').all(companyId,productId));
  });
  // Exportación completa del historial, incluidos artículos retirados del catálogo.
  app.get('/api/companies/:companyId/inventory/movements/export.xlsx',(req,res)=>{
    const companyId=Number(req.params.companyId),status=String(req.query.status||'all'),sort=String(req.query.sort||'az');
    if(!Number.isSafeInteger(companyId)||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    if(!['all','active','deleted'].includes(status)||!['az','za','newest','oldest'].includes(sort))return res.status(400).json({error:'Filtro inválido.'});
    const where=status==='active'?' AND p.is_deleted=0':status==='deleted'?' AND p.is_deleted=1':'';
    const order={az:'p.description COLLATE NOCASE ASC, m.id DESC',za:'p.description COLLATE NOCASE DESC, m.id DESC',newest:'m.id DESC',oldest:'m.id ASC'}[sort];
    const rows=db.prepare(`SELECT m.id,m.created_at,p.description,p.product_code,p.barcode,p.is_deleted,m.movement_type,m.quantity,m.delta,m.stock_before,m.stock_after,m.reason,m.notes FROM inventory_movements m JOIN products p ON p.id=m.product_id AND p.company_id=m.company_id WHERE m.company_id=?${where} ORDER BY ${order}`).all(companyId);
    const headers=['ID movimiento','Fecha','Artículo','Código / SKU','Código de barras','Estado','Tipo','Cantidad','Cambio','Existencias antes','Existencias después','Motivo','Observaciones'];
    const data=rows.map(r=>[r.id,r.created_at,r.description,r.product_code,r.barcode,r.is_deleted?'Eliminado':'Activo',r.movement_type,r.quantity,r.delta,r.stock_before,r.stock_after,r.reason,r.notes]);
    const buffer=makeXlsx('Movimientos',headers,data);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="FacturaCR_movimientos.xlsx"');res.send(buffer);
  });
  app.get('/api/companies/:companyId/inventory/movements/export.csv',(req,res)=>{
    const companyId=Number(req.params.companyId);
    if(!Number.isSafeInteger(companyId)||companyId<1||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    const status=String(req.query.status||'all');
    const sort=String(req.query.sort||'az');
    if(!['all','active','deleted'].includes(status)||!['az','za','newest','oldest'].includes(sort))return res.status(400).json({error:'Filtro u ordenamiento inválido.'});
    const where=status==='active'?' AND p.is_deleted=0':status==='deleted'?' AND p.is_deleted=1':'';
    const order={az:'p.description COLLATE NOCASE ASC, m.id DESC',za:'p.description COLLATE NOCASE DESC, m.id DESC',newest:'m.id DESC',oldest:'m.id ASC'}[sort];
    const rows=db.prepare(`SELECT m.id, m.created_at, p.description, p.product_code, p.barcode, p.is_deleted, m.movement_type, m.quantity, m.delta, m.stock_before, m.stock_after, m.reason, m.notes FROM inventory_movements m JOIN products p ON p.id=m.product_id AND p.company_id=m.company_id WHERE m.company_id=?${where} ORDER BY ${order}`).all(companyId);
    const headers=['ID movimiento','Fecha','Artículo','Código / SKU','Código de barras','Estado','Tipo','Cantidad','Cambio','Existencias antes','Existencias después','Motivo','Observaciones'];
    const encoding=csvEncoding(req);
    res.setHeader('Content-Type',`text/csv; charset=${encoding}`);
    res.setHeader('Content-Disposition','attachment; filename="FacturaCR_movimientos_excel.csv"');
    res.write(csvBytes('sep=;\r\n'+csvLine(headers),encoding));
    for(const r of rows){
      const values=[r.id,r.created_at,r.description,r.product_code,r.barcode,r.is_deleted?'Eliminado':'Activo',r.movement_type,r.quantity,r.delta,r.stock_before,r.stock_after,r.reason,r.notes];
      res.write(csvBytes(csvLine(values,[3,4]),encoding));
    }
    res.end();
  });
  app.post('/api/companies/:companyId/inventory/movements',(req,res)=>{
    const companyId=Number(req.params.companyId), productId=Number(req.body?.product_id);
    const type=String(req.body?.movement_type??''),quantity=Number(req.body?.quantity);
    const reason=String(req.body?.reason??'').trim(),notes=String(req.body?.notes??'').trim();
    if(!Number.isSafeInteger(companyId)||companyId<1||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId)) return res.status(404).json({error:'Empresa no encontrada.'});
    if(!Number.isSafeInteger(productId)||productId<1||!['entrada','salida','ajuste'].includes(type)||!Number.isSafeInteger(quantity)||quantity<=0||quantity>1e9||!reason||reason.length>120||notes.length>500) return res.status(400).json({error:'Revise producto, tipo, cantidad positiva, motivo y observaciones.'});
    try {
      const tx=db.transaction(()=>{
        const product=db.prepare('SELECT * FROM products WHERE company_id=? AND id=? AND is_deleted=0').get(companyId,productId);
        if(!product||product.kind!=='producto'||!product.track_stock) throw Error('Este artículo no controla existencias.');
        const before=Number(product.stock);
        if(!Number.isSafeInteger(before)) throw Error('Este artículo tiene existencias decimales de una versión anterior. Regulariza su inventario antes de registrar movimientos.');
        // Ajuste significa establecer el saldo final a la cantidad indicada.
        const after=type==='ajuste'?quantity:before+(type==='entrada'?quantity:-quantity);
        if(after<0) throw Error('No hay existencias suficientes para realizar la salida.');
        const delta=after-before;
        if(delta===0) throw Error('El ajuste no cambia las existencias.');
        db.prepare('UPDATE products SET stock=? WHERE company_id=? AND id=?').run(after,companyId,productId);
        const result=db.prepare('INSERT INTO inventory_movements(company_id,product_id,movement_type,quantity,delta,stock_before,stock_after,reason,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(companyId,productId,type,quantity,delta,before,after,reason,notes);
        return db.prepare('SELECT * FROM inventory_movements WHERE id=?').get(result.lastInsertRowid);
      });
      res.status(201).json(tx());
    }catch(err){res.status(400).json({error:err.message});}
  });
  // POS interno: los comprobantes NO son facturas electrónicas de Hacienda.
  const cents=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Monto inválido.');return Math.round((n+Number.EPSILON)*100)};
  const saleCompany=req=>{
    const id=Number(req.params.companyId);
    if(!Number.isSafeInteger(id)||!db.prepare('SELECT id FROM companies WHERE id=?').get(id))throw Error('Empresa no encontrada.');
    return id;
  };
  const paymentLabels=['Efectivo','Tarjeta','SINPE Móvil','Transferencia bancaria','Cheque','Otros'];
  app.get('/api/companies/:companyId/sales',(req,res)=>{
    try{
      const companyId=saleCompany(req),q=String(req.query.q||'').trim().slice(0,120);
      const rows=db.prepare(`SELECT s.*,c.name AS client_name FROM sales s LEFT JOIN clients c ON c.id=s.client_id
       WHERE s.company_id=? AND (?='' OR CAST(s.id AS TEXT) LIKE ? OR c.name LIKE ? OR s.created_at LIKE ?)
       ORDER BY s.id DESC LIMIT 500`).all(companyId,q,`%${q}%`,`%${q}%`,`%${q}%`);
      res.json(rows);
    }catch(e){res.status(400).json({error:e.message})}
  });
  app.get('/api/companies/:companyId/sales/export.csv',(req,res)=>{
    try{
      const companyId=saleCompany(req);
      const rows=db.prepare(`SELECT s.*,COALESCE(c.name,'Consumidor final') AS client_name FROM sales s LEFT JOIN clients c ON c.id=s.client_id WHERE s.company_id=? ORDER BY s.id DESC`).all(companyId);
      const columns=['Venta','Fecha','Cliente','Tipo','Estado','Subtotal CRC','Descuento CRC','Impuesto CRC','Total CRC','Pagado CRC','Saldo CRC','Motivo anulación'];
      const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
      const csv='sep=;\r\n'+[columns,...rows.map(r=>[r.id,r.created_at,r.client_name,r.sale_type,r.status,r.subtotal_cents/100,r.discount_cents/100,r.tax_cents/100,r.total_cents/100,r.paid_cents/100,r.balance_cents/100,r.annul_reason||''])].map(row=>row.map(cell).join(';')).join('\r\n');
      res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="FacturaCR_ventas.csv"');res.send('\ufeff'+csv);
    }catch(e){res.status(400).json({error:e.message})}
  });
  app.get('/api/companies/:companyId/sales/:saleId',(req,res)=>{
    try{
      const companyId=saleCompany(req),id=Number(req.params.saleId);
      const sale=db.prepare('SELECT * FROM sales WHERE id=? AND company_id=?').get(id,companyId);
      if(!sale)return res.status(404).json({error:'Venta no encontrada.'});
      res.json({...sale,lines:db.prepare('SELECT * FROM sale_lines WHERE sale_id=? ORDER BY id').all(id),payments:db.prepare('SELECT * FROM sale_payments WHERE sale_id=? ORDER BY id').all(id)});
    }catch(e){res.status(400).json({error:e.message})}
  });
  app.post('/api/companies/:companyId/sales',(req,res)=>{
    try{
      const companyId=saleCompany(req),body=req.body||{};
      const saleType=String(body.sale_type||'');
      if(!['contado','credito'].includes(saleType))throw Error('Tipo de venta inválido.');
      const clientId=body.client_id==null||body.client_id===''?null:Number(body.client_id);
      if(saleType==='credito'&&!clientId)throw Error('Las ventas a crédito requieren un cliente registrado.');
      if(clientId&&!db.prepare('SELECT id FROM clients WHERE id=? AND company_id=?').get(clientId,companyId))throw Error('Cliente no pertenece a esta empresa.');
      if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100)throw Error('Agrega entre 1 y 100 líneas.');
      if(!Array.isArray(body.payments)||body.payments.length>10)throw Error('Pagos inválidos.');
      const discount=cents(body.discount||0);
      const unique=new Set(body.lines.map(l=>String(l.product_id)));
      if(unique.size!==body.lines.length)throw Error('Hay artículos duplicados en el carrito. Agrupa las cantidades.');
      const result=db.transaction(()=>{
        let subtotal=0,tax=0;
        const lines=body.lines.map(row=>{
          const productId=Number(row.product_id),quantity=Number(row.quantity);
          if(!Number.isSafeInteger(productId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100000)throw Error('Artículo o cantidad inválidos.');
          const product=db.prepare('SELECT * FROM products WHERE id=? AND company_id=? AND is_deleted=0').get(productId,companyId);
          if(!product)throw Error('Un artículo no existe o fue eliminado.');
          if(product.currency!=='CRC')throw Error(`«${product.description}» está en USD. Configura su precio en CRC antes de venderlo.`);
          const unit=cents(product.price),lineSubtotal=unit*quantity;
          if(!Number.isSafeInteger(lineSubtotal)||lineSubtotal>1e12)throw Error('Importe demasiado grande.');
          subtotal+=lineSubtotal;
          return {product,quantity,unit,lineSubtotal};
        });
        if(discount>subtotal)throw Error('El descuento supera el subtotal.');
        // Descuento proporcional por línea, con remanente asignado a la última.
        let distributed=0;
        const detailed=lines.map((line,i)=>{
          const part=i===lines.length-1?discount-distributed:Math.floor(discount*line.lineSubtotal/subtotal);
          distributed+=part;
          const lineTax=Math.round((line.lineSubtotal-part)*Number(line.product.tax_rate)/100);
          tax+=lineTax;
          return {...line,discount:part,lineTax,lineTotal:line.lineSubtotal-part+lineTax};
        });
        const total=subtotal-discount+tax;
        if(!Number.isSafeInteger(total)||total<=0)throw Error('El total debe ser positivo.');
        const payments=body.payments.map(pay=>{
          const method=String(pay.method||''),amount=cents(pay.amount);
          if(!paymentLabels.includes(method)||amount<1)throw Error('Método o importe de pago inválido.');
          return {method,amount};
        });
        const paid=payments.reduce((sum,p)=>sum+p.amount,0);
        if(paid>total)throw Error('Los pagos no pueden superar el total. Registra únicamente el importe aplicado a la venta.');
        if(saleType==='contado'&&paid!==total)throw Error('En contado, los pagos deben cubrir exactamente el total.');
        if(saleType==='credito'&&paid===total)throw Error('Una venta completamente pagada debe registrarse como contado.');
        for(const line of detailed){
          const p=line.product;
          if(p.kind==='producto'&&Number(p.track_stock)===1){
            const before=Number(p.stock);
            if(!Number.isSafeInteger(before)||before<line.quantity)throw Error(`Existencias insuficientes o decimales en «${p.description}».`);
            const after=before-line.quantity;
            db.prepare('UPDATE products SET stock=? WHERE id=? AND company_id=?').run(after,p.id,companyId);
            db.prepare(`INSERT INTO inventory_movements(company_id,product_id,movement_type,quantity,delta,stock_before,stock_after,reason,notes)
             VALUES (?,?,?,?,?,?,?,?,?)`).run(companyId,p.id,'salida',line.quantity,-line.quantity,before,after,'Venta POS','Descuento automático de inventario');
          }
        }
        const id=Number(db.prepare(`INSERT INTO sales(company_id,client_id,sale_type,subtotal_cents,discount_cents,tax_cents,total_cents,paid_cents,balance_cents)
          VALUES (?,?,?,?,?,?,?,?,?)`).run(companyId,clientId,saleType,subtotal,discount,tax,total,paid,total-paid).lastInsertRowid);
        const addLine=db.prepare(`INSERT INTO sale_lines(sale_id,product_id,description,quantity,unit_price_cents,tax_rate,discount_cents,subtotal_cents,tax_cents,total_cents) VALUES (?,?,?,?,?,?,?,?,?,?)`);
        for(const l of detailed)addLine.run(id,l.product.id,l.product.description,l.quantity,l.unit,l.product.tax_rate,l.discount,l.lineSubtotal,l.lineTax,l.lineTotal);
        const addPayment=db.prepare('INSERT INTO sale_payments(sale_id,method,amount_cents) VALUES (?,?,?)');
        for(const pay of payments)addPayment.run(id,pay.method,pay.amount);
        return {id,total_cents:total,balance_cents:total-paid};
      })();
      res.status(201).json(result);
    }catch(e){res.status(400).json({error:e.message})}
  });
  app.post('/api/companies/:companyId/sales/:saleId/annul',(req,res)=>{
    try{
      const companyId=saleCompany(req),saleId=Number(req.params.saleId),reason=String(req.body?.reason||'').trim();
      if(reason.length<5||reason.length>300)throw Error('Indica un motivo de anulación (5 a 300 caracteres).');
      const result=db.transaction(()=>{
        const sale=db.prepare('SELECT * FROM sales WHERE id=? AND company_id=?').get(saleId,companyId);
        if(!sale)throw Error('Venta no encontrada.');
        if(sale.status!=='activa')throw Error('La venta ya fue anulada.');
        const lines=db.prepare('SELECT * FROM sale_lines WHERE sale_id=?').all(saleId);
        for(const line of lines){
          const p=db.prepare('SELECT * FROM products WHERE id=? AND company_id=?').get(line.product_id,companyId);
          if(p&&p.kind==='producto'&&Number(p.track_stock)===1){
            const before=Number(p.stock),after=before+line.quantity;
            if(!Number.isSafeInteger(before))throw Error('Inventario con existencias decimales: regulariza antes de anular.');
            db.prepare('UPDATE products SET stock=? WHERE id=?').run(after,p.id);
            db.prepare(`INSERT INTO inventory_movements(company_id,product_id,movement_type,quantity,delta,stock_before,stock_after,reason,notes)
             VALUES (?,?,?,?,?,?,?,?,?)`).run(companyId,p.id,'entrada',line.quantity,line.quantity,before,after,'Anulación de venta POS',`Venta #${saleId}: ${reason}`);
          }
        }
        db.prepare("UPDATE sales SET status='anulada',annulled_at=CURRENT_TIMESTAMP,annul_reason=? WHERE id=?").run(reason,saleId);
        return {ok:true};
      })();res.json(result);
    }catch(e){res.status(400).json({error:e.message})}
  });
  // Compatibilidad con interfaz anterior que consulta /api/companies/:id/backups.
  // El respaldo sigue siendo global (todas las empresas), no por empresa.
  app.get('/api/companies/:companyId/backups',(req,res)=>{
    const companyId=Number(req.params.companyId);
    if(!Number.isSafeInteger(companyId)||!db.prepare('SELECT id FROM companies WHERE id=?').get(companyId))return res.status(404).json({error:'Empresa no encontrada.'});
    try{const fs=statfsSync(dataDir);const wal=databasePath+'-wal';res.json({databaseBytes:statSync(databasePath).size,walBytes:existsSync(wal)?statSync(wal).size:0,freeBytes:Number(fs.bavail)*Number(fs.bsize),totalBytes:Number(fs.blocks)*Number(fs.bsize),scope:'all-companies'});}
    catch{res.status(500).json({error:'No se pudo consultar el almacenamiento.'});}
  });
  app.use('/api',(req,res)=>res.status(404).json({error:`Ruta de API no disponible: ${req.method} ${req.originalUrl}. Comprueba que el instalador y el servidor sean de la misma versión.`,route:req.originalUrl}));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (_req,res) => res.sendFile(join(staticDir,'index.html')));
  }
  const httpServer = await new Promise((resolve,reject)=>{
    const s = app.listen(port,'127.0.0.1',()=>resolve(s));
    s.on('error',reject);
  });
  return {port:httpServer.address().port, close:()=>new Promise(resolve=>httpServer.close(()=>{db.close();resolve();}))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().then(({port})=>console.log(`API local: http://127.0.0.1:${port}`)).catch(err=>{console.error(err);process.exitCode=1;});
}
