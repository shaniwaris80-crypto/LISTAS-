# ARSLAN LISTAS — iPhone y Compras

Actualización de navegación de iPhone y protección contra duplicidades (20 de noviembre de 2026).

## Compras

La pestaña **Por comprar** calcula por producto y unidad:

`pendiente = max(0, total pedido - cantidad enviada a proveedor - cantidad reservada en borrador - compras manuales confirmadas)`.

Los productos íntegramente cubiertos no aparecen allí. No se borran: pueden seguir viéndose en **A proveedores**, **Comprado manual** y **Ver todos**. Una recepción de proveedor no se añade una segunda vez a la compra; pertenece al mismo pedido a proveedor.

La lista individual de cada tienda/restaurante y el Global mantienen sus cantidades. El desglose «Quién lleva cuánto» continúa disponible al tocar el producto.

## Reparto

La autorización de reparto sigue siendo diferente de la compra pendiente: únicamente un pedido a proveedor **marcado como enviado** o una compra manual confirmada habilitan para bajar. Un borrador reservado **no** habilita reparto. Carga sigue siendo opcional.

## iPhone

La navegación fija contiene cinco destinos grandes (Hoy, Pedidos, Proveedores, Compras y Bajar); Más aparece arriba a la derecha para acceder a Carga y Auditoría. No requiere desplazar horizontalmente la pantalla.

## Conservación y nube

No se modifican ni se borran registros existentes en Firebase o localStorage al publicar el cambio. Cuando hay datos de la versión anterior en el mismo navegador, la aplicación ofrece consultarlos antes de iniciar sesión y realizar la importación. Sin importar desde el navegador original, otro móvil no puede recuperarlos automáticamente.

## Pruebas

- `npm run check`: lógica, compras manuales, proveedores, sincronización y regresión.
- `python tests/test_ios_navigation.py`: navegación y diseño a 320, 375, 390, 430 y 768 px, filtro de proveedor enviado.
- `python tests/test_ios_cloud_navigation.py`: navegador con datos locales y Firebase simulado, comprobación de que nunca crea una nube vacía automáticamente.