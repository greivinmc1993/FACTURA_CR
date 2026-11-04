<div align="center">
  <h1>🇨🇷 FacturaCR</h1>
  <p><strong>Punto de venta y gestión comercial de escritorio para Costa Rica</strong></p>
  <p>Empresas · Clientes · Artículos · Inventario · Ventas · Crédito · Respaldos</p>
  <p>
    <img src="https://img.shields.io/badge/Versi%C3%B3n-0.6.9.2-blue" alt="Versión 0.6.10" />
    <img src="https://img.shields.io/badge/Estado-En%20pruebas-orange" alt="En pruebas" />
    <img src="https://img.shields.io/badge/Plataforma-Windows-0078D4" alt="Windows" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
    <img src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" alt="Electron 44" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js y Express" />
    <img src="https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  </p>
</div>

<hr />

<h2>📋 Acerca del proyecto</h2>
<p><strong>FacturaCR</strong> es una aplicación de escritorio, desarrollada para gestionar operaciones de negocios costarricenses desde una interfaz local. Utiliza <strong>SQLite integrado</strong>, por lo que no requiere instalar MySQL ni un servidor de base de datos independiente.</p>
<p>El proyecto se encuentra en desarrollo y pruebas. Su módulo de ventas genera registros comerciales internos; <strong>todavía no emite comprobantes electrónicos autorizados por Hacienda</strong>.</p>

<h2>✨ Funcionalidades</h2>
<ul>
  <li><strong>Empresas:</strong> gestión multiempresa, datos comerciales y tributarios; la empresa activa se selecciona desde su módulo.</li>
  <li><strong>Clientes:</strong> identificaciones, contacto, dirección y datos para futuras operaciones tributarias.</li>
  <li><strong>Artículos y servicios:</strong> fotografías, SKU, códigos de barras, CABYS, costos, precios, unidades y tarifas de IVA.</li>
  <li><strong>Inventario:</strong> entradas, salidas y ajustes con historial, prevención de existencias negativas y alertas de mínimo.</li>
  <li><strong>Punto de venta:</strong> carrito, ventas al contado y crédito, pagos en efectivo, tarjeta, SINPE Móvil y transferencia; combinación de medios de pago.</li>
  <li><strong>Historial:</strong> consulta de ventas y anulación con reposición de existencias según las reglas del sistema.</li>
  <li><strong>Cuentas por cobrar:</strong> abonos y seguimiento de saldos de ventas a crédito, incorporados para pruebas en v0.6.3.</li>
  <li><strong>Precios e IVA:</strong> precio final ingresado en Artículos, cálculo del precio base y desglose tributario en Ventas, en pruebas en v0.6.3.</li>
  <li><strong>Respaldos manuales:</strong> creación, descarga y restauración de bases SQLite con comprobaciones y protección previa a restaurar.</li>
  <li><strong>CSV:</strong> herramientas de importación y exportación, incluida exportación de movimientos de inventario, con ajustes para Excel en Windows.</li>
  <li><strong>Interfaz:</strong> diseño adaptable, búsquedas, ordenamiento y confirmaciones antes de acciones relevantes.</li>
</ul>

<h2>🖨️ Impresión y redondeo (v0.6.3, en pruebas)</h2>
<ul>
<li>Selección de impresora Windows por empresa, impresión de prueba, hasta 5 copias y modo silencioso opcional.</li>
<li>Diseños clásico, compacto y moderno; papel 58/80 mm, logotipo, mensaje, redes sociales y campos configurables.</li>
<li>Configuración guardada localmente por empresa; no se incluye en el respaldo de SQLite.</li>
<li>Empresa predeterminada seleccionable en Empresas, priorizada al reiniciar.</li>
<li>Las nuevas ventas y abonos redondean los montos al colón más cercano. Las ventas históricas conservan sus importes originales.</li>
<li>El enlace del negocio se muestra como texto. QR gráfico y funciones ESC/POS quedan pendientes.</li>
<li>Se requiere probar la impresión física en Windows con controladores de 58 y 80 mm.</li>
</ul>

<h2>🧰 Tecnologías</h2>
<table>
  <thead><tr><th>Capa</th><th>Tecnología</th></tr></thead>
  <tbody>
    <tr><td>Interfaz</td><td>React 19, Vite 6, CSS</td></tr>
    <tr><td>Escritorio</td><td>Electron 44</td></tr>
    <tr><td>API local</td><td>Node.js, Express 4</td></tr>
    <tr><td>Base de datos</td><td>SQLite, better-sqlite3</td></tr>
    <tr><td>Instalador</td><td>electron-builder, NSIS (Windows)</td></tr>
  </tbody>
</table>

<h2>📁 Estructura</h2>
<pre><code>FacturaCR/
├── build/             # Iconos y recursos de instalación
├── electron/          # Proceso principal de Electron
├── server/            # API Express y persistencia SQLite
├── src/               # React y estilos
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md</code></pre>

<h2>🚀 Instalación y ejecución</h2>
<p><strong>Requisitos:</strong> Windows 10/11 x64, Node.js 22 LTS y npm. Si los módulos nativos lo requieren, instalar las herramientas de compilación C++ de Visual Studio.</p>
<p>Clona el repositorio privado y entra en su carpeta:</p>
<pre><code>git clone URL_DEL_REPOSITORIO
cd FacturaCR</code></pre>
<p>Sustituye <code>URL_DEL_REPOSITORIO</code> por la dirección real del repositorio.</p>
<p>Instala las dependencias y ejecuta la versión de escritorio en desarrollo:</p>
<pre><code>npm install
npm run desktop:dev</code></pre>
<p>Otros comandos disponibles:</p>
<table>
  <thead><tr><th>Comando</th><th>Función</th></tr></thead>
  <tbody>
    <tr><td><code>npm run dev</code></td><td>Inicia API y Vite</td></tr>
    <tr><td><code>npm run build</code></td><td>Compila la interfaz en <code>dist/</code></td></tr>
    <tr><td><code>npm run desktop</code></td><td>Compila y abre Electron</td></tr>
    <tr><td><code>npm run dist:win</code></td><td>Genera instalador Windows NSIS en <code>release/</code></td></tr>
  </tbody>
</table>
<p>El instalador no se almacena en Git: se construye localmente. Para distribución pública se recomienda firmar digitalmente el ejecutable.</p>

<h2>💾 Datos y respaldos</h2>
<ul>
  <li>En desarrollo, SQLite se guarda normalmente en <code>data/</code>; en la versión instalada, en el directorio <code>userData</code> de Electron (habitualmente bajo <code>%APPDATA%</code>).</li>
  <li>Los datos de desarrollo y los de la instalación <strong>no se sincronizan automáticamente</strong>.</li>
  <li>Los respaldos y restauraciones manuales afectan la base completa, incluidas todas las empresas.</li>
  <li>Antes de actualizar o restaurar, crear una copia externa y comprobar que puede recuperarse.</li>
  <li>Los respaldos actuales no están cifrados: tratarlos como información confidencial.</li>
  <li>Los respaldos automáticos se planifican para la versión 0.6.4; aún no están implementados.</li>
</ul>

<h2>🕘 Evolución del proyecto</h2>
<table>
  <thead><tr><th>Versión</th><th>Principales avances</th></tr></thead>
  <tbody>
    <tr><td>0.4.x</td><td>Datos tributarios de clientes, artículos y servicios, fotos y migraciones de base de datos.</td></tr>
    <tr><td>0.5.0</td><td>Movimientos de inventario, trazabilidad y alertas de existencias.</td></tr>
    <tr><td>0.5.1–0.5.3</td><td>Mejoras de formularios, ordenamientos, empresa activa y confirmaciones.</td></tr>
    <tr><td>0.5.5–0.5.15</td><td>Respaldos manuales, interfaz responsive, exportaciones CSV y correcciones.</td></tr>
    <tr><td>0.6.0–0.6.1</td><td>Punto de venta, medios de pago, historial, correcciones del vuelto y fotos.</td></tr>
    <tr><td>0.6.3</td><td>Precio con IVA incluido, carrito destacado y abonos a crédito (en pruebas).</td></tr>
    <tr><td>0.6.3</td><td>Tiquetes térmicos de 58/80 mm con impresoras Windows y diseños personalizables por empresa</td></tr>
    <tr><td>0.6.4</td><td>Respaldos automáticos, programación, retención y validación de integridad</td></tr>
  </tbody>
</table>
<p>Las notas históricas detalladas se conservan en los archivos <code>NOTAS_VERSION_*.txt</code> del proyecto, cuando estén disponibles.</p>

<h2>🗺️ Hoja de ruta</h2>
<table>
  <thead><tr><th>Versión</th><th>Objetivo</th><th>Estado</th></tr></thead>
  <tbody>    
    <tr><td>0.7.0</td><td>Reportes y estadísticas</td><td>Planificada</td></tr>
    <tr><td>0.8.0</td><td>Documentos electrónicos XML y representación PDF conforme a requisitos aplicables</td><td>Planificada</td></tr>
    <tr><td>0.9.0</td><td>Firma digital, envío y consulta de respuestas de Hacienda</td><td>Planificada</td></tr>
    <tr><td>1.0.0</td><td>Usuarios, autenticación y permisos</td><td>Planificada</td></tr>
    <tr><td>1.1.0</td><td>Licenciamiento comercial</td><td>Planificada</td></tr>
  </tbody>
</table>

<h2>🔐 Seguridad y limitaciones</h2>
<ul>
  <li>La API local escucha en <code>127.0.0.1</code>, pero todavía no cuenta con autenticación completa.</li>
  <li>La separación multiempresa organiza registros; no representa aislamiento de permisos entre usuarios.</li>
  <li>No publicar bases SQLite, respaldos, datos de clientes, certificados, claves privadas ni archivos <code>.env</code>.</li>
  <li><code>.gitignore</code> evita nuevas inclusiones accidentales, pero no elimina archivos ya rastreados por Git.</li>
  <li>El sistema no debe considerarse listo para operaciones tributarias reales ni para producción sin pruebas, controles de seguridad y validación regulatoria.</li>
</ul>

<h2>⚠️ Facturación electrónica</h2>
<p>Las ventas registradas actualmente y los futuros tiquetes térmicos son <strong>comprobantes internos</strong>; no sustituyen una factura electrónica validada por el Ministerio de Hacienda de Costa Rica. La generación XML, firma y envío se desarrollarán en etapas posteriores y deberán comprobarse contra las especificaciones oficiales vigentes.</p>

<h2>📄 Licencia</h2>
<p>Proyecto privado en desarrollo. No se concede autorización para copiar, redistribuir o comercializar el código por el mero hecho de acceder al repositorio. La licencia definitiva se establecerá antes de su distribución comercial.</p>

<hr />
<div align="center"><p><strong>FacturaCR</strong> · Desarrollado para negocios de Costa Rica 🇨🇷</p></div>


## Impresión térmica v0.6.3

Desde Ventas > Impresión de tiquetes puedes personalizar logotipo, mensaje, redes sociales, campos visibles y tamaño 58/80 mm por empresa. Desde el historial puedes previsualizar, imprimir y reimprimir tiquetes usando el diálogo de impresión de Windows. El papel y controlador deben estar configurados en Windows. No son comprobantes electrónicos autorizados por Hacienda.


<h2>💳 Histórico de ventas a crédito y abonos (v0.6.3, en pruebas)</h2>
<p>La sección Ventas incluye un histórico específico de ventas a crédito, con filtros por cliente, número, fecha y estado (pendiente, pagada o anulada), resumen de cuentas, consulta individual de cada abono (fecha, método e importe) y exportación CSV. Los registros se filtran por empresa activa y se almacenan en SQLite. Los pagos iniciales también se incluyen en el historial de pagos.</p>


### Ajustes de tiquetes (v0.6.3)
Los datos comerciales del tiquete (razón social, nombre comercial, identificación, dirección, teléfono, correo, sitio web y redes sociales) se administran en **Empresas → Editar datos**. Se eliminó la opción de QR. Las preferencias de impresión permanecen guardadas por empresa en el equipo.


### Guardar personalización de tiquetes
En **Ventas → Personalizar tiquete**, presiona **Guardar ajustes de impresión**. La configuración se guarda por empresa en el almacenamiento local de Electron; no se incluye aún en los respaldos SQLite.


### Logotipo del tiquete
En **Ventas → Personalizar tiquete**, puedes cargar un logotipo PNG, JPEG o WebP de hasta **800 × 800 píxeles** y **250 KB**. Se muestra una miniatura y puedes quitarlo antes de guardar. Los ajustes se conservan localmente por empresa mediante **Guardar ajustes de impresión**.

### v0.6.4 · Empresa recordada y respaldos automáticos
- La empresa activa se recuerda al cerrar y reabrir FacturaCR. Se eliminó la opción de empresa predeterminada.
- **Respaldos → Respaldos automáticos:** activación, frecuencia diaria/semanal/mensual, hora local, retención de 1 a 365 copias, creación manual y listado de copias.
- Se crean instantáneas consistentes con `better-sqlite3.backup()`, verificadas mediante `PRAGMA integrity_check`.
- La programación se guarda en `data/automatic-backup-settings.json` y los archivos en `data/automatic-backups/`. El directorio `data/` está excluido del repositorio Git.
- El programador funciona con FacturaCR abierto; al iniciar comprueba si hay una copia pendiente. No se instala una tarea independiente de Windows.
- **Limitación:** los ajustes de impresión guardados en localStorage aún no se incluyen en las copias SQLite automáticas. Copia también los datos de usuario de Electron antes de reinstalar Windows o cambiar de equipo.

### Claridad en configuración de respaldos
La opción **Cantidad de respaldos que deseas conservar** limita el número total de archivos automáticos (1 a 365). Por ejemplo, 14 respaldos diarios equivalen aproximadamente a dos semanas; el más antiguo se elimina al superar el límite. La casilla de activación ahora está alineada con su descripción.


### v0.6.5 · Personalización de tiquetes protegida por respaldos
- Los ajustes de impresión por empresa (logotipo, ancho de papel, plantilla, impresora, copias, etc.) se guardan también en SQLite.
- Al entrar a Ventas, la configuración previa de `localStorage` se migra automáticamente a SQLite si aún no existía en la base.
- Los respaldos manuales y automáticos de SQLite creados a partir de esta versión incluyen estas preferencias.
- Al restaurar una copia que contenga los ajustes, se recuperan automáticamente al abrir Ventas.
- La selección de empresa sigue recordándose localmente; no hay empresa predeterminada.
- Nota: los respaldos anteriores a esta actualización no contienen las preferencias de impresión. El respaldo de SQLite no incluye la configuración del programador de respaldos, guardada por separado en JSON.

### Corrección puntual: último colón de crédito
Se permite registrar el abono final cuando el saldo visible es ₡1 pero la base conserva céntimos. El servidor valida el saldo actual y liquida exactamente los céntimos pendientes dentro de una transacción SQLite. No se modificaron otros módulos de la interfaz.


### v0.6.6 — Botones animados
Efectos hover, pulsación y foco accesible; respeta movimiento reducido. Solo CSS.


## v0.6.8 — Historial y paneles plegables
- Historial de ventas: Hoy, Esta semana (lunes a hoy), Este mes, Este año, Todas las fechas y rango personalizado.
- Búsqueda por número, cliente o fecha combinable con el período.
- Cantidad y total de ventas visibles (total excluye anuladas).
- Historial de ventas y panel de créditos expandibles/plegables independientemente.
- El botón de exportación del historial conserva su comportamiento original: exporta todas las ventas de la empresa, no solo las filtradas.
- Sin cambios en la base de datos ni en la lógica de pagos y redondeo.

<h2>Actualización 0.6.9.2</h2>
<p>Reportes filtrados para Excel (CSV) y PDF, con corrección de persistencia de la opción de impresión automática por empresa. El cambio de esa casilla se guarda inmediatamente y se verifica en SQLite.</p>

<h2>Actualización v0.6.9.2 — PDF y catálogo grande</h2>
<ul>
<li>Los reportes filtrados se exportan a un PDF real con el selector de guardado de Windows por medio de Electron, sin ventanas emergentes.</li>
<li>El punto de venta muestra 24 artículos por página, con navegación anterior/siguiente y búsqueda por nombre, SKU y código de barras entre todos los artículos disponibles.</li>
<li>Se mantienen las operaciones de ventas, créditos, abonos, historial y respaldos.</li>
</ul>


## Novedades v0.6.10 — 1.000 artículos o más

- Búsqueda rápida por descripción, SKU o código de barras, con hasta ocho sugerencias seleccionables para añadir al carrito.
- Campo independiente para lectores de códigos de barras USB tipo teclado: escanear y Enter para añadir una unidad. También admite ingreso manual.
- Detecta códigos duplicados y evita agregar un artículo incorrecto.
- Conserva la paginación de 24 artículos por página de v0.6.9.2.
- La importación masiva CSV ya estaba disponible: hasta 2.000 productos por lote, vista previa y transacción todo o nada. No reemplaza artículos existentes.
- No se modifican las ventas, los abonos, la persistencia SQLite, los PDF ni los respaldos.
