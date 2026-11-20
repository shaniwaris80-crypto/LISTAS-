# ARSLAN LISTAS — Compras manuales reversibles

## Uso en móvil

En **Compras > Por comprar**, los productos que todavía faltan se muestran arriba. Toca la casilla vacía para marcar la compra manual, con la cantidad que figura en el campo. Puedes ajustarla antes con los botones **+**, **−** o escribiendo un número (se admite coma decimal). La parte comprada pasa **debajo** al apartado verde «Comprados manualmente». Si la compra fue parcial, la cantidad restante seguirá en los pendientes de arriba.

La casilla verde o **Deshacer** permite desmarcar una compra completa de un producto. Para cambiar solo una parte, usa los controles de cantidad de su tarjeta verde y pulsa **Guardar cantidad**, incluido el valor 0 para desmarcar. **Deshacer TODAS las compras manuales** realiza una reversión global con confirmación.

Las correcciones dejan un movimiento de reversión en `state.manual`, sin borrar el registro previo. Se recalculan pendientes, autorizado y reparto. Las bajadas realizadas no se borran: si desmarcar una compra deja menos autorización que la cantidad ya bajada, la corrección se rechaza con un aviso. En «Deshacer TODAS», primero se comprueban todos los productos y la operación se ejecuta completa o no se hace nada.

## Preparar la compra manual pendiente

En **Por comprar**, dispones de **Copiar TXT pendiente**, **Descargar TXT** y **WhatsApp pendientes**. Incluyen exclusivamente lo que sigue pendiente de compra manual, sin sumar lo cubierto por un proveedor enviado o asignado (aunque el borrador siga sin enviar). Los productos con un nombre sin confirmar no se exportan. Formato: cantidad seguida de nombre, sin espacio, una línea por producto, por ejemplo `3TOMATE RAMA`.

Abrir WhatsApp únicamente prepara un mensaje: la aplicación **no lo envía automáticamente ni marca nada como comprado**. El botón «Marcar TODOS como comprados» está dentro de **Acciones masivas** y requiere introducir `COMPRAR` para evitar marcas accidentales.

## Seguridad de datos y sincronización

Las correcciones se guardan en el mismo estado de jornada, sin limpiar pedidos, asignaciones, catálogo, destinos, historial, recepciones ni rutas. Con Firebase activo, se enviarán bajo la misma sincronización y control de conflictos ya existente. No es necesario exportar/importar para usar estas funciones. Si la aplicación muestra «No sincronizado» o un conflicto, hay que resolver esa situación antes de marcar compras.

## Pruebas

- `npm run check`: pruebas de negocio y del motor de sincronización, incluidos los casos de reversión parcial, deshacer todo atómico, entregas protegidas, proveedores y TXT de pendientes.
- `python tests/test_iphone_manual_clicks.py`: prueba táctil de marcar, desmarcar, mover a abajo, editar con +/− y teclear cantidades, sin acceso a cuentas reales. La prueba sustituye Firebase por datos simulados y utiliza almacenamiento simulado únicamente en el navegador de QA.