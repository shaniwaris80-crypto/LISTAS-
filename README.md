# ARSLAN LISTAS — Reparto seguro (versión autónoma de pruebas)

> **Versión de laboratorio:** no es el código fuente completo de la aplicación privada ARSLAN LISTAS Next. No altera los repositorios antiguos ni los datos de la web publicada.

> Los productos y cantidades que se cargan de forma inicial son **ficticios**. La demo no incorpora datos privados del negocio.

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

**Importante:** no se envían mensajes de WhatsApp automáticamente, no hay un backend de sincronización multiusuario en esta demo, y los ejemplos quedan guardados solamente en el `localStorage` de este HTML. Para integrar la regla en la web privada hacen falta los archivos fuente de esa aplicación.

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

**No es la versión completa publicada en Sites**, ni incluye contraseñas, clientes reales, importaciones privadas o sincronización en nube. El estado de la demo se almacena solo en el navegador.

Los repositorios `PEDIDOPRUEBAS`, `ponerprecios` y `reparto` no se modifican.

## Pruebas de interfaz móvil (opcional)

Tras `npm run check`, puedes ejecutar `python tests/test_browser_ui.py` con Python, Playwright y Chromium instalados. La prueba inyecta la página local en un navegador de 390 px y comprueba: pedidos de restaurante, asignación a ESMO, marca de enviado, desglose de compras, selector único de destino y bajadas. No abre WhatsApp real ni utiliza pedidos privados.

## Gestión de restaurantes

En **Pedidos**, puedes pegar varios pedidos juntos (`PEDIDO SP`, `PEDIDO SL`, `PEDIDO ST`, `PEDIDO BRASEROS CENTRO`, `PEDIDO BRASEROS FORUM`, `PEDIDO RIVIERA`), o utilizar **+ Pegar / añadir pedido** en el destino deseado. Cada restaurante conserva su pedido por separado y solo suma al Global lo que realmente se ha introducido.

## Estados en Proveedores

**Sin asignar → Asignado sin enviar → Enviado**. Elegir un proveedor y tocar un producto lo mueve a su lista de proveedor. Cada proveedor puede copiar o descargar únicamente sus líneas pendientes de envío, preparar WhatsApp y confirmar **Marcar enviado**. Si se asignan más líneas después de un envío, las nuevas aparecen en pendientes; las antiguas no se incluyen automáticamente en otro WhatsApp. Deshacer una marca de envío queda bloqueado si se han registrado bajadas de ese producto.