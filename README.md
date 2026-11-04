
<div align="center">
  <h1>🇨🇷 FacturaCR</h1>
  <p><strong>Sistema de punto de venta y gestión comercial para Costa Rica</strong></p>
  <p>Empresas · Clientes · Artículos · Inventario · Ventas · Crédito · Respaldos</p>

  <img src="https://img.shields.io/badge/Versión-0.6.2-blue" alt="Versión" />
  <img src="https://img.shields.io/badge/Estado-En%20desarrollo-orange" alt="Estado" />
  <img src="https://img.shields.io/badge/Plataforma-Windows-0078D4" alt="Windows" />

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  </p>
</div>

<hr>

<h2>📋 Acerca del proyecto</h2>

<p>
  <strong>FacturaCR</strong> es una aplicación de escritorio diseñada
  para facilitar la administración comercial de negocios en Costa Rica.
  Permite gestionar empresas, clientes, artículos, inventarios, ventas,
  cuentas por cobrar y respaldos desde una interfaz moderna.
</p>

<p>
  Está desarrollada con React, Vite, Electron, Node.js, Express y SQLite.
  Utiliza una base de datos local integrada, por lo que no requiere
  instalar MySQL ni un servidor de base de datos independiente.
</p>

<p>
  <strong>Estado:</strong> proyecto en desarrollo y pruebas.
  Actualmente registra ventas comerciales internas, pero todavía
  no emite comprobantes electrónicos autorizados por Hacienda.
</p>

<h2>✨ Funcionalidades</h2>

<h3>🏢 Gestión de empresas</h3>
<ul>
  <li>Administración de múltiples empresas.</li>
  <li>Registro de información comercial y tributaria.</li>
  <li>Selección y persistencia de la empresa activa.</li>
  <li>Organización de datos por empresa.</li>
</ul>

<h3>👥 Clientes</h3>
<ul>
  <li>Registro, edición y consulta de clientes.</li>
  <li>Identificaciones y datos de contacto.</li>
  <li>Direcciones e información comercial.</li>
  <li>Asociación de clientes con operaciones de venta.</li>
</ul>

<h3>📦 Artículos e inventario</h3>
<ul>
  <li>Administración de artículos y servicios.</li>
  <li>Fotografías de productos.</li>
  <li>Códigos SKU, códigos de barras y CABYS.</li>
  <li>Costos, precios y tarifas de IVA.</li>
  <li>Control de existencias y stock mínimo.</li>
  <li>Entradas, salidas y ajustes de inventario.</li>
  <li>Historial de movimientos.</li>
  <li>Herramientas de importación y exportación CSV.</li>
</ul>

<h3>🛒 Punto de venta</h3>
<ul>
  <li>Carrito de compras.</li>
  <li>Ventas al contado y a crédito.</li>
  <li>Pagos en efectivo, tarjeta, SINPE Móvil y transferencia.</li>
  <li>Combinación de métodos de pago.</li>
  <li>Desglose de subtotal, descuentos, IVA y total.</li>
  <li>Historial y consulta de ventas.</li>
  <li>Anulación de ventas con reposición de inventario.</li>
  <li>Cálculo del vuelto según el efectivo recibido.</li>
</ul>

<h3>💰 Precios y cuentas por cobrar</h3>
<p>Mejoras incorporadas para pruebas en la versión 0.6.2:</p>
<ul>
  <li>Ingreso del precio final con IVA incluido en Artículos.</li>
  <li>Cálculo automático del precio base sin IVA.</li>
  <li>Visualización del precio base en Ventas.</li>
  <li>Aplicación del impuesto por separado para evitar duplicaciones.</li>
  <li>Carrito y resumen de importes más destacados.</li>
  <li>Registro de abonos a ventas a crédito.</li>
  <li>Consulta de saldos pendientes.</li>
</ul>

<h3>💾 Respaldos</h3>
<ul>
  <li>Creación de respaldos manuales de SQLite.</li>
  <li>Descarga y restauración de respaldos.</li>
  <li>Comprobaciones de integridad.</li>
  <li>Protección de datos antes de restauraciones.</li>
</ul>

<h2>🧰 Tecnologías utilizadas</h2>

<table>
  <thead>
    <tr>
      <th>Componente</th>
      <th>Tecnología</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Frontend</td><td>React 19</td></tr>
    <tr><td>Herramienta de desarrollo</td><td>Vite 6</td></tr>
    <tr><td>Aplicación de escritorio</td><td>Electron 44</td></tr>
    <tr><td>Backend</td><td>Node.js y Express 4</td></tr>
    <tr><td>Base de datos</td><td>SQLite y better-sqlite3</td></tr>
    <tr><td>Estilos</td><td>CSS</td></tr>
    <tr><td>Instalador Windows</td><td>electron-builder y NSIS</td></tr>
    <tr><td>Control de versiones</td><td>Git y GitHub</td></tr>
  </tbody>
</table>

<h2>📁 Estructura del proyecto</h2>

<pre><code>FacturaCR/
├── build/             # Iconos y recursos del instalador
├── electron/          # Aplicación de escritorio
├── server/            # API Express y base de datos
├── src/               # Interfaz React y estilos
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md</code></pre>

<h2>🚀 Instalación y ejecución</h2>

<h3>Requisitos</h3>
<ul>
  <li>Windows 10 u 11 de 64 bits.</li>
  <li>Node.js 22 LTS.</li>
  <li>npm.</li>
  <li>Git.</li>
  <li>Herramientas de compilación C++ de Visual Studio si los módulos nativos las requieren.</li>
</ul>

<h3>1. Clonar el repositorio</h3>

<pre><code>git clone URL_DEL_REPOSITORIO
cd FacturaCR</code></pre>

<p>Reemplazar <code>URL_DEL_REPOSITORIO</code> por la dirección real del repositorio.</p>

<h3>2. Instalar dependencias</h3>

<pre><code>npm install</code></pre>

<h3>3. Ejecutar en desarrollo</h3>

<pre><code>npm run desktop:dev</code></pre>

<h3>4. Generar el instalador de Windows</h3>

<pre><code>npm run dist:win</code></pre>

<p>El instalador generado se almacena en la carpeta <code>release/</code>.</p>

<h3>Otros comandos</h3>

<table>
  <thead>
    <tr><th>Comando</th><th>Descripción</th></tr>
  </thead>
  <tbody>
    <tr><td><code>npm run dev</code></td><td>Inicia el entorno de desarrollo.</td></tr>
    <tr><td><code>npm run build</code></td><td>Compila la interfaz.</td></tr>
    <tr><td><code>npm run desktop</code></td><td>Compila y abre Electron.</td></tr>
    <tr><td><code>npm run desktop:dev</code></td><td>Abre la aplicación en desarrollo.</td></tr>
    <tr><td><code>npm run dist:win</code></td><td>Genera el instalador de Windows.</td></tr>
  </tbody>
</table>

<h2>🗄️ Base de datos y seguridad</h2>

<p>
  FacturaCR utiliza SQLite como almacenamiento local.
  En desarrollo, la base de datos normalmente se encuentra
  en <code>data/</code>. En la aplicación instalada se utiliza
  el directorio de datos de usuario de Electron.
</p>

<ul>
  <li>Las bases de datos reales no deben subirse a GitHub.</li>
  <li>Los respaldos deben conservarse en ubicaciones seguras.</li>
  <li>No publicar certificados, contraseñas ni claves privadas.</li>
  <li>Los datos de desarrollo y de la instalación no se sincronizan automáticamente.</li>
  <li>El acceso multiusuario con permisos todavía está planificado.</li>
  <li>Antes de actualizar el programa, se recomienda crear un respaldo.</li>
</ul>

<h2>🕘 Historial de versiones</h2>

<table>
  <thead>
    <tr><th>Versión</th><th>Principales cambios</th></tr>
  </thead>
  <tbody>
    <tr><td>0.4.x</td><td>Información tributaria, artículos y migraciones de base de datos.</td></tr>
    <tr><td>0.5.0</td><td>Movimientos y control de inventario.</td></tr>
    <tr><td>0.5.1 - 0.5.3</td><td>Mejoras en formularios, empresas y confirmaciones.</td></tr>
    <tr><td>0.5.5 - 0.5.15</td><td>Respaldos manuales, exportaciones y correcciones.</td></tr>
    <tr><td>0.6.0</td><td>Implementación inicial del punto de venta.</td></tr>
    <tr><td>0.6.1</td><td>Corrección del vuelto y mejoras de fotografías y clientes.</td></tr>
    <tr><td>0.6.2</td><td>Precios con IVA incluido, carrito mejorado y abonos a crédito (en pruebas).</td></tr>
  </tbody>
</table>

<h2>🗺️ Hoja de ruta</h2>

<table>
  <thead>
    <tr><th>Versión</th><th>Funcionalidades previstas</th><th>Estado</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>0.6.3</td>
      <td>Impresión térmica de 58 y 80 mm, compatibilidad con impresoras Windows y personalización de tiquetes.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>0.6.4</td>
      <td>Respaldos automáticos, programación, retención, alertas y verificación de integridad.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>0.7.0</td>
      <td>Reportes, estadísticas y análisis comercial.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>0.8.0</td>
      <td>Documentos electrónicos XML y representación PDF.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>0.9.0</td>
      <td>Firma digital, envío y consulta de respuestas de Hacienda.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>1.0.0</td>
      <td>Usuarios, autenticación y permisos.</td>
      <td>Planificada</td>
    </tr>
    <tr>
      <td>1.1.0</td>
      <td>Sistema de licenciamiento comercial.</td>
      <td>Planificada</td>
    </tr>
  </tbody>
</table>

<h2>🧾 Facturación electrónica de Costa Rica</h2>

<p>
  La integración con el Ministerio de Hacienda de Costa Rica
  forma parte de la evolución prevista de FacturaCR.
</p>

<p>Las etapas futuras contemplan:</p>

<ul>
  <li>Generación de documentos electrónicos XML.</li>
  <li>Validación de datos tributarios y códigos CABYS.</li>
  <li>Firma digital de documentos.</li>
  <li>Envío de comprobantes a Hacienda.</li>
  <li>Consulta de aceptación o rechazo.</li>
  <li>Representación gráfica en PDF.</li>
</ul>

<p>
  <strong>Importante:</strong> las ventas y los futuros tiquetes
  térmicos de FacturaCR son comprobantes comerciales internos
  mientras no se implemente y valide la integración tributaria.
  No sustituyen facturas electrónicas autorizadas por Hacienda.
</p>

<h2>🔐 Privacidad del repositorio</h2>

<p>
  El archivo <code>.gitignore</code> excluye dependencias,
  compilaciones, instaladores, bases de datos, respaldos,
  archivos temporales y configuraciones sensibles.
</p>

<p>
  El repositorio debe conservar únicamente el código fuente
  y los recursos necesarios para desarrollar y compilar
  la aplicación.
</p>

<h2>📄 Licencia</h2>

<p>
  Proyecto privado en desarrollo.
  Todos los derechos reservados hasta que se establezca
  una licencia de distribución o comercialización.
</p>

<hr>

<div align="center">
  <p><strong>FacturaCR 🇨🇷</strong></p>
  <p>Desarrollado para facilitar la gestión comercial de negocios en Costa Rica.</p>
  <p><em>En constante desarrollo y mejora.</em></p>
</div>
