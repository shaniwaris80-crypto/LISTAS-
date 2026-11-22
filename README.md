# ARSLAN LISTAS — gestión diaria

Aplicación web para las tiendas **San Pablo, San Lesmes y Santiago** y los pedidos independientes de restaurantes. Funciona en PC e iPhone con una interfaz blanco y negro, estados rojo/verde y barra verde de progreso de bajadas por destino.

**Web:** https://shaniwaris80-crypto.github.io/LISTAS-/

**Repositorio:** https://github.com/shaniwaris80-crypto/LISTAS-

## Preparación para uso real

El HTML de producción **no incluye pedidos ficticios**, no carga listas de ejemplo ni muestra un botón para restaurar demostraciones. Los ejemplos se usan únicamente en los archivos de pruebas automatizadas. El repositorio GitHub es **público**: no subas allí pedidos reales, claves privadas, contraseñas ni copias JSON de jornadas.

Firebase está configurado en el proyecto independiente `arslan-listas-next`. Authentication (correo/contraseña) y Realtime Database con reglas privadas por propietario/miembro están activados.

**Antes de empezar en el móvil:** usa el ordenador y navegador en el que ya están tus pedidos, descarga una copia JSON, inicia sesión y confirma que la primera importación a Firebase conserva todos los pedidos, compras, asignaciones y bajadas. Después verifica que el estado sea **SINCRONIZADO** y abre la misma cuenta/equipo en el móvil. No uses «Limpiar día» para resolver problemas de sincronización.

## Rediseño Shopify (23/11/2026)

La nueva interfaz se inspira en patrones de gestión de inventario: fondo claro, tarjetas compactas, buscador, cuatro accesos principales y navegación inferior de cuatro pestañas en iPhone. Proveedores se encuentra en Inicio y en el menú del ordenador. La pantalla de acceso aparece únicamente si no existe una sesión de Firebase válida. El navegador puede recordar el correo, **nunca guarda la contraseña en el código**.

### Pedidos recibidos después de enviar al proveedor

Si añades productos tras confirmar que se ha enviado al menos un proveedor, las líneas nuevas quedan identificadas como **pedido adicional**. Se suman a Global y aparecen en **Compras → Pedidos adicionales**, agrupadas por producto y destino. La compra manual se marca expresamente; nunca se reenvía el WhatsApp anterior ni se duplica automáticamente una compra. Se registra a qué tienda o restaurante corresponde cada compra adicional, y el plan de Reparto conserva las cantidades previamente reservadas para las tiendas originales.

Una compra pendiente no se considera realmente comprada hasta que se confirma. Las compras adicionales pueden deshacerse con un movimiento de reversión mientras no comprometan bajadas físicas. Las operaciones concurrentes conservan las verificaciones existentes de Firebase; si hay conflicto, no sobrescriben silenciosamente el trabajo de otro dispositivo.

**Seguridad de datos:** los cambios son de código; no ejecutan «Limpiar día», no reinician Firebase ni borran pedidos, proveedores, compras o historial. No se incluyen credenciales ni datos reales dentro del repositorio.

## Flujo completo

1. **Pedidos:** pega listas juntas con encabezados `PEDIDO SP`, `PEDIDO SL`, `PEDIDO ST`, `PEDIDO BRASEROS CENTRO`, `PEDIDO BRASEROS FORUM`, `PEDIDO RIVIERA`, etc. Los restaurantes pueden añadirse de forma independiente. Cada destino tiene TXT, descarga y enlace a WhatsApp.
2. **Productos:** reconoce BANAN/BANANA, plurales, acentos, textos copiados de WhatsApp y cantidades con coma. GOLDEN 24 y GOLDEN 28 se mantienen independientes; un nombre dudoso requiere confirmación. Los alias confirmados se guardan para futuras listas.
3. **Global:** suma por producto y unidad, conservando cuánto corresponde a cada destino.
4. **Proveedores:** elegir proveedor y tocar producto lo mueve de «Sin asignar» a su lista. Cada proveedor puede copiar TXT, descargarlo y preparar WhatsApp. **WhatsApp no envía automáticamente**, y «Marcar enviado» requiere confirmar que se envió de verdad.
5. **Compras:** en «Por comprar» aparecen solo las cantidades no cubiertas por proveedores o compras manuales. Permite casillas, +/−, importe exacto, deshacer individual/todas, TXT y WhatsApp de pendientes. Debajo de cada producto se ve el desglose por tienda y los ajustes +/− de **un toque** que recalculan Global y Reparto.
6. **Carga:** opcional. No es obligatoria antes de bajar.
7. **Reparto/Bajar:** arriba se elige una sola tienda o restaurante. La barra verde mide el progreso de las líneas pedidas en ese destino; muestra pendientes, bajados, faltantes y diferencias pendientes de compra/envío. Marcado total, parcial y deshacer.
8. **Control:** estado de jornada, incidencias, copia JSON y «Limpiar día». Esta operación pide confirmación, descarga una copia y archiva los movimientos, conservando el diccionario y los destinos.

## Sincronización y múltiples repartidores

Firebase actualiza la jornada compartida; cada persona puede entrar con una cuenta propia y unirse al espacio del propietario **solo después de recibir permiso explícito**. El propietario autoriza o revoca miembros por ID de Firebase.

Las bajadas y correcciones de cantidades usan transacciones de Realtime Database que comprueban la última versión. Si dos personas tocan el mismo producto a la vez, la segunda operación no vuelve a sumar ni borra la primera. Los cambios en productos distintos pueden guardarse sin sobrescribirse.

**Las bajadas compartidas requieren conexión a Firebase** para confirmarse; sin Internet no se marcan provisionalmente como completadas, porque podrían duplicarse. Otros cambios locales pueden quedar pendientes de sincronización bajo el motor de conflictos.

No se ha realizado ningún envío real de WhatsApp durante el desarrollo.

## Seguridad y recuperación

- No se comparten las contraseñas del propietario con empleados.
- Solo propietario y miembros autorizados pueden acceder a su espacio de Firebase.
- La acción «Limpiar día» conserva catálogo, restaurantes, proveedores, alias e historial y descarga antes un JSON.
- Los movimientos de compras manuales se corrigen con reversión trazable; no se elimina el historial.
- Los cambios de pedidos y bajadas que afectarían mercancía ya bajada quedan protegidos.
- Cualquier discrepancia simultánea de compras/proveedores se bloquea para revisión, no se sobrescribe silenciosamente.
- La aplicación **no edita datos de Ruta Madrid ni Estambul**.

## Comprobar el código

Requiere Node.js 20 o posterior y no necesita dependencias externas:

```sh
npm run check
```

Esto compila `index.html` y ejecuta pruebas de pedidos, proveedores, compras, clientes, almacén, reparto, importación, reconocimiento de nombres, acceso Firebase, concurrencia, seguridad del cierre y presentación PC/iPhone.

**Antes del primer uso con empleados, realiza una prueba supervisada con dos dispositivos y sus cuentas reales** para verificar autorizaciones y actualización de la misma jornada. Las pruebas automáticas son aisladas y no sustituyen esa verificación.

La web sigue desplegada en GitHub Pages. No se ha migrado a Vercel.
