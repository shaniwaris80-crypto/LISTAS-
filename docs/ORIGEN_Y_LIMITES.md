# ARSLAN LISTAS — Reparto seguro v5 (versión autónoma de pruebas)

**Fecha:** 19 de noviembre de 2026.

## Estado real

Esta entrega **no ha sido instalada en la web privada de ARSLAN LISTAS Next**. El conector de publicación de Sites no está disponible en esta conversación y la página privada exige iniciar sesión; tampoco está disponible el repositorio de código completo. Para proteger el sistema en uso se entrega una versión autónoma ejecutable y el contrato TypeScript para integrar la regla al recuperar el proyecto actual.

Los datos de esta versión son los dos pedidos sintéticos generados para pruebas. Todo lo modificado en este HTML se guarda **únicamente en el almacenamiento local del navegador** bajo una clave separada. Ningún botón envía WhatsApp por sí mismo. **«Marcar enviado (prueba)» simula la confirmación** para validar las bajadas.

## Abrir

1. Abrir `index.html` en un navegador moderno, móvil u ordenador, para probar los botones.
2. En **Proveedores**, elegir ESMO y tocar GOLDEN 24 y GOLDEN 28. Al asignar, aún no aparecen en Reparto.
3. Pulsar **Marcar enviado (prueba)**. Aparecen en Reparto para SP y SL.
4. En **Compras**, comprar manualmente TOMATE RAMA. Aparece en Reparto sin proveedor ni carga.
5. En Reparto, tocar un producto: desaparece de pendientes; **Deshacer** lo devuelve.
6. **Nuevo día** archiva la jornada en la copia local y conserva productos y restaurantes.

## Regla de negocio aprobada

- Asignación en borrador = **NO** entra a reparto.
- Pedido a proveedor marcado como enviado = **SÍ** entra a reparto hasta la cantidad enviada.
- Compra manual confirmada = **SÍ** entra a reparto hasta la cantidad comprada.
- La carga es **opcional**, y no autoriza ni bloquea las bajadas.
- Cantidades insuficientes para varios destinos = solicitar distribución explícita, no inventarla.
- El reparto por defecto del **sobrante** puede proponerse 60 % SP / 20 % SL / 20 % ST; nunca debe aplicarse silenciosamente.
- Marcar un producto como bajado no altera su compra ni su proveedor.
- No sumar la recepción del proveedor como una compra manual adicional del mismo pedido.

## Medidas contra duplicados

- Tocar de nuevo el mismo proveedor desasigna un borrador sin enviar.
- Un producto enviado a proveedor no puede moverse como si fuera un borrador.
- Si un producto en borrador se compra manualmente, la aplicación exige confirmar que se reduce el borrador en la misma cantidad.
- Si una compra manual supera el total previsto, exige confirmar el extra.
- Una compra parcial no borra el resto pendiente de proveedor.
- La creación de un producto nuevo comprueba duplicados y conserva nombres corregidos.

## Restaurantes y vocabulario

Los restaurantes Braseros Centro, Forum, Severo, Edificio y Tomillares, además de Riviera, se mantienen como destinos separados. Al pegar un pedido real para ellos, sus productos suman al Global pero sus listas no se fusionan.

Se conservan las diferencias de calibre MANZANA GOLDEN 24/28 y presentaciones PATATA 5 KG. Los productos desconocidos aparecen en rojo para corregir o crear y recordar.

## Contenido

- `index.html` — versión autónoma; un archivo listo para abrir.
- `motor.mjs` — reglas de negocio en JavaScript, con validaciones.
- `ui.js` y `estilos.css` — fuente de la demo.
- `REGLA_REPARTO_NEXT.ts` — función pura para adaptar al dominio de Next cuando se disponga del código real; **no es un parche instalado**.
- `test.mjs` y `test_extended.mjs` — regresión original.
- `test_reparto_seguro.mjs` — 29 pruebas de la nueva lógica.
- `test_ui.py` — nueve pruebas de interacción en Chromium móvil, con datos aislados.
- `pedidos_ejemplo_sinteticos.txt` — pedidos SL y SP de ejemplo.
- Capturas de la interfaz en el ZIP de laboratorio (no se suben al repositorio público).

## Ejecutar las pruebas

Con Node.js:

```bash
node test.mjs
node test_extended.mjs
node test_reparto_seguro.mjs
```

El script de pruebas visuales requiere Python, Playwright y Chromium instalados. No requiere conexión a ningún sistema de producción.

## Para integrar en la web real

1. Obtener el repositorio **nuevo** de ARSLAN LISTAS Next y una copia de seguridad de sus datos. No modificar `PEDIDOPRUEBAS`, `ponerprecios` ni `reparto`.
2. En el modelo actual, definir claramente estados `draft`, `sent`, recepción de proveedor, `manual-confirmed` y cantidades por producto/unidad.
3. Sustituir el origen de las filas de Reparto por el cálculo de elegibilidad de `REGLA_REPARTO_NEXT.ts`, adaptando las interfaces al `AppState` real. No conectar la condición al estado de Carga.
4. Exigir confirmación expresa al marcar Enviado; abrir WhatsApp sólo prepara el mensaje.
5. Proteger cambios que reduzcan mercancía por debajo de lo ya bajado o que dupliquen proveedor y compra manual.
6. Ejecutar regresiones con estas dos listas, restaurantes y un iPhone real, primero en staging.
7. Publicar nueva versión del sitio privado sin sobrescribir datos de producción.