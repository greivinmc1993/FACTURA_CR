<div align="center">
  <h1>🇨🇷 FacturaCR</h1>
  <p><strong>Sistema de punto de venta y gestión comercial para Costa Rica</strong></p>
  <p>Aplicación de escritorio para administrar empresas, clientes, artículos, inventario, ventas y cuentas por cobrar.</p>
  <p><img src="https://img.shields.io/badge/Versi%C3%B3n-0.6.2-blue" alt="Versión 0.6.2" /> <img src="https://img.shields.io/badge/Estado-En%20desarrollo-orange" alt="En desarrollo" /> <img src="https://img.shields.io/badge/Plataforma-Windows-0078D4" alt="Windows" /></p>
  <p><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" /> <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" /> <img src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" alt="Electron" /> <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js y Express" /> <img src="https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite&logoColor=white" alt="SQLite" /></p>
</div><hr /><h2>📋 Descripción</h2>
<p><strong>FacturaCR</strong> es una aplicación de escritorio orientada a pequeños y medianos negocios de Costa Rica. Centraliza operaciones comerciales y utiliza una base de datos SQLite local, sin necesidad de instalar un servidor de bases de datos independiente.</p><h2>✨ Funcionalidades</h2>
<ul>
  <li>Administración de múltiples empresas y sus datos comerciales.</li>
  <li>Registro y gestión de clientes.</li>
  <li>Catálogo de artículos y servicios, con fotografías, códigos y tarifas de IVA.</li>
  <li>Inventario, movimientos de existencias y alertas de stock mínimo.</li>
  <li>Punto de venta con carrito, pagos en efectivo y medios electrónicos.</li>
  <li>Ventas al contado y a crédito, abonos y consulta de saldos pendientes.</li>
  <li>Historial de ventas y operaciones de anulación.</li>
  <li>Respaldos y restauración manual de la base de datos.</li>
  <li>Importación y exportación de información mediante archivos CSV, según el módulo.</li>
</ul>
<p><strong>Nota:</strong> Las funciones pueden evolucionar durante las pruebas de la versión 0.6.2.</p><h2>🧰 Tecnologías</h2>
<table>
  <thead><tr><th>Componente</th><th>Tecnología</th></tr></thead>
  <tbody>
    <tr><td>Interfaz</td><td>React 19 + Vite 6</td></tr>
    <tr><td>Aplicación de escritorio</td><td>Electron</td></tr>
    <tr><td>API local</td><td>Node.js + Express</td></tr>
    <tr><td>Persistencia</td><td>SQLite mediante better-sqlite3</td></tr>
    <tr><td>Instalador Windows</td><td>electron-builder (NSIS)</td></tr>
  </tbody>
</table><h2>📁 Estructura del proyecto</h2>
<pre><code>FacturaCR/
├── build/             # Iconos y recursos del instalador
├── electron/          # Proceso principal de Electron
├── server/            # API local y acceso a SQLite
├── src/               # Interfaz React y estilos
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md</code></pre><h2>🚀 Instalación y desarrollo</h2>
<p><strong>Requisitos:</strong> Windows 10/11, Node.js compatible con las dependencias del proyecto y npm. Se recomienda Node.js 22 LTS para desarrollo. La compilación de módulos nativos puede requerir herramientas de C++ en Windows.</p>
<ol>
  <li>Clonar el repositorio:</li>
</ol>
<pre><code>git clone URL_DEL_REPOSITORIO
git checkout main
npm install</code></pre>
<p>Reemplaza <code>URL_DEL_REPOSITORIO</code> por la URL real de GitHub. Ejecuta los comandos desde la carpeta del proyecto.</p>
<p>Iniciar la aplicación en desarrollo:</p>
<pre><code>npm run desktop:dev</code></pre>
<p>Compilar la interfaz:</p>
<pre><code>npm run build</code></pre>
<p>Crear el instalador de Windows:</p>
<pre><code>npm run dist:win</code></pre>
<p>El instalador se genera en <code>release/</code>. Los archivos de compilación no se suben al repositorio.</p><h2>💾 Almacenamiento y respaldos</h2>
<p>FacturaCR utiliza SQLite. En desarrollo, la información puede almacenarse en <code>data/</code>; en la aplicación instalada se utiliza el directorio de datos de usuario de Electron. Estos entornos no comparten automáticamente la misma base de datos.</p>
<p><strong>Por seguridad, las bases de datos, los respaldos y los datos reales de clientes no deben subirse a GitHub.</strong> Antes de actualizar o restaurar información, realiza un respaldo y verifica que pueda recuperarse.</p><h2>🗺️ Hoja de ruta</h2>
<table>
  <thead><tr><th>Versión</th><th>Objetivo</th><th>Estado</th></tr></thead>
  <tbody>
    <tr><td>0.6.2</td><td>Precios con IVA, mejoras del carrito, crédito y abonos</td><td>En pruebas</td></tr>
    <tr><td>0.6.3</td><td>Impresión térmica y personalización de tiquetes</td><td>Planificada</td></tr>
    <tr><td>0.6.4</td><td>Respaldos automáticos</td><td>Planificada</td></tr>
    <tr><td>0.7.0</td><td>Reportes y estadísticas</td><td>Planificada</td></tr>
    <tr><td>0.8.0</td><td>Documentos electrónicos de Hacienda</td><td>Planificada</td></tr>
    <tr><td>0.9.0</td><td>Firma y envío de comprobantes</td><td>Planificada</td></tr>
    <tr><td>1.0.0</td><td>Usuarios y seguridad</td><td>Planificada</td></tr>
  </tbody>
</table><h2>⚠️ Estado y cumplimiento tributario</h2>
<p>FacturaCR está <strong>en desarrollo</strong>. Las ventas y tiquetes internos no equivalen a comprobantes electrónicos aceptados por el Ministerio de Hacienda de Costa Rica. La emisión, firma y envío de XML tributarios se incorporarán y validarán en etapas posteriores. No debe considerarse una solución de facturación electrónica autorizada en su estado actual.</p><h2>🔐 Seguridad del repositorio</h2>
<p>No publiques bases de datos, credenciales, certificados digitales, claves privadas, archivos <code>.env</code> ni respaldos. El archivo <code>.gitignore</code> evita que Git agregue accidentalmente muchos de estos archivos, pero no elimina archivos que ya fueron registrados anteriormente.</p><h2>📄 Licencia</h2>
<p>Proyecto privado en desarrollo. No se concede una licencia de uso, redistribución o modificación a terceros por el mero acceso al código. La licencia definitiva se establecerá antes de su distribución comercial.</p><hr />
<div align="center"><p>Desarrollado para negocios de Costa Rica 🇨🇷</p></div>
