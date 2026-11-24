# ARSLAN LISTAS NEXT · Auditoría completa

Fecha: 24/11/2026

## Seguridad del proceso

La auditoría se ejecutó con jornadas sintéticas, `localStorage` en memoria y todas las peticiones de red bloqueadas. No se accedió a Firebase real, no se importaron pedidos del usuario y no se ejecutó «Limpiar día» sobre la aplicación publicada.

Las acciones destructivas o relacionadas con la cuenta se revisaron mediante sus contratos de seguridad y las pruebas existentes: confirmación, copia JSON previa, bloqueo por conflicto y preservación del historial.

## Cobertura

- 76 acciones de interfaz clasificadas.
- 0 botones o controles sin manejador.
- 45 operaciones ejercitadas dinámicamente en Chromium.
- 7 pantallas capturadas en móvil y escritorio.
- 0 peticiones de red durante la auditoría dinámica.
- 0 datos reales utilizados.
- Suite completa existente correcta: pedidos, proveedores, compras, reparto concurrente, Firebase, sincronización, cantidades por destino, diseño responsive, pedidos tardíos y ampliaciones.

### Acciones revisadas por familia

| Familia | Acciones |
|---|---:|
| Sesión y equipo | 18 |
| Navegación | 10 |
| Pedidos adicionales | 3 |
| Compras | 12 |
| Pedidos | 13 |
| Proveedores | 9 |
| Carga y reparto | 8 |
| Jornada y copias | 3 |
| **Total** | **76** |

## Resultados por módulo

### Inicio y sesión

- La sesión persistente funciona sin guardar la contraseña en el código.
- Cuenta y sincronización separa correctamente «sesión iniciada» de «datos sincronizados».
- Los conflictos, permisos denegados y documentos incompatibles conservan la copia local.
- Recomendación: mantener siempre visible la hora de la última sincronización y añadir un indicador de dispositivo/usuario que hizo el último cambio.

### Pedidos

- Las cantidades de SP, SL, ST y restaurantes permanecen separadas.
- El Global suma todos los destinos.
- La importación duplicada queda bloqueada.
- Las ediciones directas se bloquean cuando ya existen compras, envíos o bajadas.
- Hallazgo: «Otros destinos» genera una página muy larga en móvil.
- Mejora aplicada: agrupar «Otros destinos» en una sección plegable, abierta por defecto en escritorio y cerrada en iPhone.

### Diccionario de productos

- Se respetan variedades, calibres y unidades.
- Los alias seguros como BANAN/BANANA funcionan sin mezclar productos.
- Hallazgo: el catálogo inicial no incluía AGUACATE PRIMERA, AGUACATE LISO ni LIMÓN PRIMERA, aunque son denominaciones de uso habitual.
- Mejora aplicada: migración acumulativa que añade únicamente esos nombres si faltan. No sustituye el catálogo aprendido ni modifica pedidos existentes.
- Recomendación: crear un apartado «Productos por revisar» con alta rápida y sugerencia del proveedor habitual.

### Proveedores

- Asignar, quitar borrador, copiar, descargar, preparar WhatsApp, marcar enviado y reabrir funcionan.
- Abrir WhatsApp no marca el pedido como enviado.
- Las líneas enviadas no vuelven a aparecer en el siguiente mensaje pendiente.
- La posición de la lista se conserva al asignar productos.
- Recomendación: añadir «Recepción del proveedor» para registrar recibido completo, parcial o sustituido, aprovechando el campo `receipts` ya presente en el modelo.

### Compras manuales

- Se compra únicamente lo que falta tras proveedor.
- La compra parcial, edición y reversión conservan historial.
- Los pedidos tardíos se reservan por restaurante y no consumen mercancía original de otra tienda.
- Los incrementos por tienda cambian Global pero quedan pendientes hasta comprar o enviar.
- Recomendación: reemplazar los `prompt()` por un panel inferior con teclado numérico, cantidad pedida, cubierta y pendiente visibles simultáneamente.

### Carga

- La carga sigue siendo opcional y no bloquea Reparto.
- Hallazgo: una carga marcada no tenía corrección directa visible.
- Mejora aplicada: el mismo botón alterna cargado/desmarcado; desmarcar no toca compras, pedidos ni reparto.
- Recomendación: permitir carga parcial únicamente si existe una necesidad operativa real; de lo contrario mantener el modelo binario para reducir errores.

### Reparto

- Bajar completo, parcial, +1, −1 y deshacer respetan la cantidad autorizada.
- Las transacciones concurrentes evitan dobles bajadas.
- Los faltantes deben distribuirse antes de habilitar reparto.
- Hallazgo: se podía asignar o cambiar repartidor, pero no dejar el destino sin repartidor.
- Mejora aplicada: botón «Quitar repartidor», sin alterar pedidos, compras o bajadas.
- Recomendación: mostrar nombre del último usuario y hora en cada bajada; añadir deshacer rápido durante 10–15 segundos.

### Sobrantes

- La propuesta 60/20/20 se calcula sin crear pedidos automáticamente.
- Recomendación: incorporar dos botones separados: «Solo ver propuesta» y «Aplicar como sobrecompra», con vista previa y confirmación.

### Limpieza y copias

- Limpiar día exige confirmación, palabra de seguridad y descarga previa.
- La jornada nueva conserva catálogo, alias, destinos y proveedores.
- Recomendación: mostrar una pantalla previa con totales que se archivarán y un enlace inmediato a «Restaurar última jornada» durante un plazo limitado.

## Hallazgos visuales y de accesibilidad

1. El estado de sincronización tenía un área táctil demasiado pequeña.
2. El nombre completo de la aplicación competía con el estado de nube en iPhone.
3. Algunas pantallas largas obligaban a desplazarse demasiado.
4. Los mensajes mediante `prompt`, `confirm` y `alert` son funcionales, pero poco cómodos en móvil.
5. Los avisos operativos necesitaban anunciarse a lectores de pantalla.

### Mejoras aplicadas

- Botón de sincronización con área táctil de al menos 40–44 px.
- Nombre móvil abreviado visualmente a «ARSLAN NEXT»; nombre completo conservado como etiqueta accesible.
- Todos los botones reciben `type="button"` si faltaba.
- Avisos operativos con `role="status"` y `aria-live="polite"`.
- Otros destinos agrupados.
- Carga reversible.
- Repartidor eliminable.

## Hoja de ruta recomendada

### Prioridad alta

1. **Recepción de proveedor:** recibido completo/parcial, sustitución, diferencia y observación.
2. **Centro de actividad:** quién cambió cantidad, compró, envió o bajó; hora y dispositivo.
3. **Paneles numéricos móviles:** sustituir diálogos nativos por controles claros y rápidos.
4. **Restauración de jornada:** últimas copias con fecha y resumen, sin depender de buscar archivos JSON.
5. **Productos por revisar:** resolver nombres desconocidos antes de llegar a Proveedores.

### Prioridad media

1. Plantillas de pedidos frecuentes para restaurantes.
2. Proveedor habitual por producto con sugerencia, nunca asignación automática irreversible.
3. Filtros «solo mi tienda», «solo pendientes», «modificado hoy» y «con incidencias».
4. Aplicación controlada de sobrecompra 60/20/20.
5. Vista compacta para almacén con producto, cantidad, destino y dos botones grandes.

### Prioridad futura

1. Lectura de código de barras/QR para cajas y destinos.
2. Informe de merma y diferencias entre comprado, repartido y vendido.
3. Modo sin conexión con cola visible y conciliación cuando vuelva Firebase.
4. Histórico semanal y comparación de cantidades por tienda/proveedor.

## Límites de esta auditoría

- No se probaron credenciales, correos de recuperación ni altas de trabajadores contra cuentas reales.
- No se ejecutó ninguna acción destructiva en producción.
- WhatsApp se comprobó generando el enlace, sin enviar mensajes.
- Las transacciones Firebase se probaron con adaptadores simulados y la suite de concurrencia; la aplicación publicada quedó fuera del entorno de prueba para proteger la jornada real.
