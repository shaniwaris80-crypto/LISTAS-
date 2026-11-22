# Auditoría de salida a producción · ARSLAN LISTAS

**Fecha:** 22/11/2026
**Proyecto:** `shaniwaris80-crypto/LISTAS-`
**Entorno de producción:** GitHub Pages, Firebase Authentication y Realtime Database de `arslan-listas-next`.
**Alcance:** código actual de pedidos, global, proveedores, compras, carga, bajadas, iPhone, ordenador y sincronización concurrente.

## Metodología y seguridad

- Todas las operaciones de prueba se realizan sobre **datos sintéticos creados en memoria**. No se cargan facturas, listas, compras ni bajadas reales en Firebase para hacer estas pruebas.
- La compilación de producción contiene `const FIXTURE = ""` y nunca carga órdenes ficticias al abrir la web.
- Se ha retirado la acción `resetdemo`, que podía reemplazar una jornada real por pedidos de ejemplo.
- Se mantiene la clave de almacenamiento local antigua para no perder pedidos del ordenador original.
- Se valida `index.html` con el analizador JavaScript de Node, además de ejecutar las pruebas de reglas de negocio.
- «Limpiar día» exige confirmación explícita, descarga primero JSON y archiva la jornada actual conservando catálogo y destinos.

## Matriz de aceptación automatizada

| Módulo | Comprobaciones |
|---|---|
| Pedidos | Tres tiendas, varios restaurantes, encabezados y textos de WhatsApp, duplicados, reemplazo protegido |
| Productos | BANAN/BANANA, plurales, coma decimal, fracciones, nombre nuevo, alias aprendido y separación de calibres |
| Global | Totales, desglose por tienda y restaurante, unidades separadas |
| Proveedores | Selección rápida, desasignar borradores, TXT/WhatsApp, enviado confirmado, pendientes no reenviados, revertir con protección |
| Compras manuales | Solo cantidades no cubiertas, casillas, más/menos, deshacer individual/todas, TXT de pendientes |
| Recepciones | Cantidad real de proveedor sin doble compra ni recepción mayor de lo enviado |
| Carga | Opcional, no bloquea reparto |
| Reparto | Solo comprado/enviado, parciales, faltantes, deshacer, progreso verde por destino |
| Concurrencia | Dos trabajadores actuando en filas iguales o distintas, revisión/CAS, cambios obsoletos rechazados |
| Corrección por tienda | +/− directos modifican Global; cantidades añadidas quedan pendientes hasta comprar/enviar |
| Seguridad | Bloqueo de datos sin permiso, controles del propietario, rechazo de cierres y cambios incompatibles |
| Nueva jornada | Archivo y conservación de diccionario, restaurantes y proveedores |
| Diseño | Cinco botones de iPhone, áreas seguras, contraste, anchos PC/móvil, script compilado |

**Batería de aceptación:** 58 escenarios completos, además de las baterías previas de cada módulo. Todos se deben confirmar con CI correcto antes de liberar la rama a `main`.

## Correcciones prioritarias incluidas

1. No mostrar datos de prueba ni opción «Restaurar demostración» en la web definitiva.
2. El nuevo día comienza con la fecha actual, no con 19/11/2026.
3. Productos con proveedor asignado o compra iniciada no admiten cambio directo de nombre ni sustitución masiva que deje asignaciones huérfanas.
4. Corregir cantidades por tienda desde Compras con +/−; Global y Reparto recalculan sin dar por comprada la diferencia.
5. Bajar compartido usa transacciones Firebase, con protección contra doble toque y revisiones antiguas.
6. Barra verde de progreso sobre productos pedidos por cada destino, sin sumar cajas, kilos y manojos como una sola unidad.
7. Los proveedores solo se marcan «Enviados» cuando el usuario confirma la acción. Preparar WhatsApp no constituye un envío real.
8. Los botones de navegación y controles se ajustan a iPhone y escritorio.

## Verificaciones externas aún necesarias

Las pruebas automatizadas **no son sustituto de verificar dos terminales reales autenticados con datos de operación**. Antes de repartir de verdad, se debe comprobar de forma supervisada:

- En el ordenador original se ve la jornada completa y existe copia JSON.
- Los pedidos de ordenador ya están subidos a Firebase y muestran «SINCRONIZADO».
- El iPhone inicia sesión en la **misma cuenta o equipo autorizado** y muestra los mismos totales.
- Dos personas marcan **dos productos distintos** y el progreso cambia en ambos dispositivos.
- Dos personas intentan marcar **la misma fila**: una acción se confirma, la otra recibe el estado actualizado sin duplicación.
- Una compra parcial requiere distribución antes de habilitar cantidades no autorizadas.
- Se abre WhatsApp, se envía de verdad y solo entonces se confirma «Enviado».

**No se han realizado envíos reales por WhatsApp ni modificaciones sobre los pedidos del usuario durante las pruebas.**

## Límites funcionales conscientes

- «Enviado al proveedor» autoriza el reparto según la regla operativa solicitada; no prueba recepción física. La recepción real es un registro aparte.
- Las bajadas compartidas requieren conexión para confirmarse; no se dejan marcadas provisionalmente sin confirmación remota.
- No se han creado ni activado cuentas de empleados en nombre del usuario. El propietario debe autorizarlas.
- El hosting definitivo continúa en GitHub Pages; todavía no se ha migrado a Vercel.
- Los datos de navegador de otra URL no se pueden recuperar automáticamente; la primera migración requiere la copia JSON y confirmar la importación.

## Validación del repositorio

```sh
npm run check
```

La ejecución debe completar sin fallos. El HTML se recompila desde `motor.mjs`, `sync-core.mjs`, `firebase-config.js`, `firebase-adapter.js`, `ui.js` y `estilos.css`; el fichero resultante se debe versionar junto con las fuentes. Las órdenes sintéticas permanecen exclusivamente bajo `tests/`.

**Resultado recomendado:** liberar a `main` solo si todas las pruebas CI terminan correctamente y el despliegue público coincide con el commit probado.
