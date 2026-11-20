# ARSLAN LISTAS — Reparto seguro (versión autónoma de pruebas)

> **Versión de laboratorio con sincronización preparada:** no es el código fuente completo de la aplicación privada ARSLAN LISTAS Next. No altera los repositorios antiguos ni los datos de la web publicada.

> Los productos y cantidades que se cargan de forma inicial en un navegador nuevo son **ficticios**. La demo no incorpora datos privados del negocio.

## Qué incluye

- Pedidos de San Pablo (SP), San Lesmes (SL), Santiago (ST) y destinos de restaurantes (Braseros Centro, Forum, Severo, Edificio, Tomillares, Riviera).
- Pegado de varias listas, cálculo del global, separación de calibres (por ejemplo, GOLDEN 24 y 28), sugerencias de nombres y creación de productos.
- **Asignación como en Pedidos:** elegir proveedor y tocar el producto completo; desaparece de «Sin asignar» pero permanece en Global y entra en la lista propia de su proveedor.
- **Cada proveedor tiene su lista:** TXT pendiente, copia, descarga, WhatsApp, TXT completo y marca manual «Enviado». Abrir WhatsApp no marca enviado. Los nuevos TXT pendientes excluyen lo ya enviado.
- Compra manual, envío a proveedores **simulado** y carga opcional.
- **Reparto seguro:** solo entra lo marcado como enviado a proveedor o comprado manualmente; asignar sin enviar no basta.
- **Reparto por destino seleccionado:** elegir arriba SP, SL, ST o un restaurante; sólo se muestra la lista de esa tienda, con bajadas de un toque, parcial y deshacer. La carga sigue siendo opcional.
- **Pedidos individuales de restaurantes:** Braseros Centro, Forum, Severo, Edificio, Tomillares y Riviera; cada pedido tiene edición propia y botones Copiar TXT, Descargar TXT y WhatsApp. No se crean cantidades para restaurantes vacíos.
- **Compras como Ruta Madrid:** tocar el nombre del producto abre el desglose de qué tienda/restaurante lo necesita y cuántas unidades; el total permanece visible.
- Botón rojo **Limpiar día** en la portada: archiva los pedidos de la jornada y conserva catálogo, restaurantes y proveedores.
- Interfaz móvil en blanco y negro, estados verde/rojo.

**Importante:** no se envían mensajes de WhatsApp automáticamente. La sincronización utiliza ahora **Firebase Authentication + Realtime Database**, igual que Ruta Madrid, pero con base **independiente**. **Todavía no hay proyecto Firebase conectado**: `firebase-config.js` tiene sus campos vacíos. Hasta configurarlo, los datos siguen siendo locales. Consulta [Configurar Firebase](docs/FIREBASE_CONFIGURACION.md). Instalar el complemento de Firebase de ChatGPT no es obligatorio para el código.

## Uso local

Abre `index.html` en un navegador, o usa un servidor estático local.

Para regenerar el HTML y ejecutar las pruebas:

```bash
npm run check
```

El comando utiliza Node.js 20 o posterior y **no requiere instalar dependencias**.

## Estructura

- `index.html` — aplicación autónoma compilada.
- `motor.mjs` — reglas de negocio y parser.
- `ui.js` + `estilos.css` — interfaz y estilo.
- `build.mjs` — genera `index.html`.
- `tests/` — listas sintéticas de demostración, pruebas funcionales, limpieza, proveedores/destinos y prueba visual opcional con Playwright.
- `docs/` — límites, guía y contrato de la regla para la futura integración en Next.

## GitHub y privacidad

Código de demostración subido a **`shaniwaris80-crypto/LISTAS-`**. Este repositorio es **público**. La fixture contiene datos **inventados y sintéticos**, no los pedidos reales ni nombres de dependientes.

**No es la versión completa publicada en Sites**, ni incluye contraseñas, clientes reales, importaciones privadas o una sincronización en nube ya activada. Hasta activar Firebase el estado se almacena solo en el navegador. No publiques JSON exportados con pedidos reales.

Los repositorios `PEDIDOPRUEBAS`, `ponerprecios` y `reparto` no se modifican.

## Pruebas de interfaz móvil (opcional)

Tras `npm run check`, puedes ejecutar `python tests/test_browser_ui.py` con Python, Playwright y Chromium instalados. La prueba inyecta la página local en un navegador de 390 px y comprueba: pedidos de restaurante, asignación a ESMO, marca de enviado, desglose de compras, selector único de destino y bajadas. No abre WhatsApp real ni utiliza pedidos privados.

## Gestión de restaurantes

En **Pedidos**, puedes pegar varios pedidos juntos (`PEDIDO SP`, `PEDIDO SL`, `PEDIDO ST`, `PEDIDO BRASEROS CENTRO`, `PEDIDO BRASEROS FORUM`, `PEDIDO RIVIERA`), o utilizar **+ Pegar / añadir pedido** en el destino deseado. Cada restaurante conserva su pedido por separado y solo suma al Global lo que realmente se ha introducido. Para otras empresas (por ejemplo ALESAL PAN), utiliza **+ Nuevo restaurante**: crea la ficha sin inventar cantidades y permite registrar su propio pedido.

## Estados en Proveedores

**Sin asignar → Asignado sin enviar → Enviado**. Elegir un proveedor y tocar un producto lo mueve a su lista de proveedor. Cada proveedor puede copiar o descargar únicamente sus líneas pendientes de envío, preparar WhatsApp y confirmar **Marcar enviado**. Si se asignan más líneas después de un envío, las nuevas aparecen en pendientes; las antiguas no se incluyen automáticamente en otro WhatsApp. Deshacer una marca de envío queda bloqueado si se han registrado bajadas de ese producto.


## Sincronización entre dispositivos (Firebase)

El proyecto incorpora `firebase-adapter.js` (Firebase Authentication, escucha `onValue`, transacciones de Realtime Database), `sync-core.mjs` (sincronización por revisión con fusión conservadora y conflictos), `firebase-config.js` (vacío hasta configurar una base **nueva**) y `database.rules.json` (cada UID solamente accede a sus propios datos). El código **no** utiliza Supabase, ni la base de Ruta Madrid, ni las cuentas de Estambul.

**No activa la nube automáticamente.** Primero debes exportar los pedidos que ya tienes en el ordenador original. La aplicación permite descargar copias JSON y volver a importarlas incluso si cambia de URL de GitHub Pages a Vercel. Ningún fichero del usuario se sube a GitHub. El primer envío a Firebase requiere confirmación y descarga otra copia; los cambios simultáneos conflictivos se bloquean para revisión.

Consulta **[docs/FIREBASE_CONFIGURACION.md](docs/FIREBASE_CONFIGURACION.md)** para todos los pasos sin instalar ningún complemento en ChatGPT. La conexión real queda pendiente de crear y configurar el proyecto Firebase.

Esta versión sincroniza *la misma cuenta* entre móvil y ordenador. Cuentas diferentes para empleados y permisos por tienda aún necesitan una ampliación específica.