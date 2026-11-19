# ARSLAN LISTAS — botón «Limpiar día» en Inicio

## Qué se ha cambiado

- Botón **Limpiar día** visible justo debajo del título de la pantalla **Hoy / Inicio**, tanto en móvil como en ordenador.
- Estilo blanco y negro con borde rojo bien visible, sin ocultarlo en Ajustes o Auditoría.
- Un diálogo de confirmación explica qué se archiva y qué se conserva. Cancelar no cambia nada.
- Al aceptar, la jornada se archiva en el historial local y se abre vacía con la fecha local del dispositivo.
- Se vacían pedidos, asignaciones, compras, recepciones, envíos simulados, carga, bajadas, distribución de faltantes, asignaciones temporales de repartidor y huellas de importación.
- Se conservan catálogo y nombres nuevos, alias, lista de tiendas y restaurantes, repartidores y cualquier dato maestro/precio no reseteado.
- Permite volver a pegar un pedido de **PEDIDO SP / SL / ST** inmediatamente después de limpiar.
- Si la jornada ya está vacía, no crea otra entrada innecesaria en el historial.

## Archivos

`index.html` es **una demo autónoma** con listas de demostración de prueba y almacenamiento del navegador independiente. No altera la aplicación real publicada. Se genera con `node build.mjs` a partir de `motor.mjs`, `ui.js`, `estilos.css` y `pedidos_ejemplo_sinteticos.txt`.

La implementación real en **ARSLAN LISTAS Next** requerirá conectar el botón al mecanismo existente de archivo/reset del código fuente del proyecto. No se debe usar `localStorage.clear()` ni borrar catálogo, clientes/restaurantes, precios o jornadas archivadas.

## Pruebas ejecutadas

- `node test.mjs` — 44 pruebas correctas.
- `node test_extended.mjs` — 14 comprobaciones.
- `node test_reparto_seguro.mjs` — 29 pruebas correctas.
- `node test_boton_inicio.mjs` — 13 condiciones correctas; pruebas mediante JavaScript VM sin modificar datos reales.

**Limitación:** el navegador automatizado de esta sesión bloqueó la navegación a páginas locales, así que no se pudo generar una captura visual nueva del botón. La presencia del botón en la pantalla principal y su lógica de confirmación se comprobaron contra el HTML y el JavaScript generado.