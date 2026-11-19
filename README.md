# ARSLAN LISTAS — Reparto seguro (versión autónoma de pruebas)

> **Versión de laboratorio:** no es el código fuente completo de la aplicación privada ARSLAN LISTAS Next. No altera los repositorios antiguos ni los datos de la web publicada.

> Los productos y cantidades que se cargan de forma inicial son **ficticios**. La demo no incorpora datos privados del negocio.

## Qué incluye

- Pedidos de San Pablo (SP), San Lesmes (SL), Santiago (ST) y destinos de restaurantes (Braseros Centro, Forum, Severo, Edificio, Tomillares, Riviera).
- Pegado de varias listas, cálculo del global, separación de calibres (por ejemplo, GOLDEN 24 y 28), sugerencias de nombres y creación de productos.
- Asignación de proveedores mediante selección y toques; exportación de cantidades pegadas al nombre en mayúsculas.
- Compra manual, envío a proveedores **simulado** y carga opcional.
- **Reparto seguro:** solo entra lo marcado como enviado a proveedor o comprado manualmente; asignar sin enviar no basta.
- Reparto por tienda, bajadas con un toque, corrección y deshacer, distribución de excedentes bajo confirmación.
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
- `tests/` — listas sintéticas de demostración, pruebas funcionales y pruebas de limpieza.
- `docs/` — límites, guía y contrato de la regla para la futura integración en Next.

## GitHub y privacidad

Código de demostración subido a **`shaniwaris80-crypto/LISTAS-`**. Este repositorio es **público**. La fixture contiene datos **inventados y sintéticos**, no los pedidos reales ni nombres de dependientes.

**No es la versión completa publicada en Sites**, ni incluye contraseñas, clientes reales, importaciones privadas o sincronización en nube. El estado de la demo se almacena solo en el navegador.

Los repositorios `PEDIDOPRUEBAS`, `ponerprecios` y `reparto` no se modifican.