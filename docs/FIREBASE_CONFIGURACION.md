# Conectar ARSLAN LISTAS entre móvil y ordenador — Firebase (como Ruta Madrid)

**Estado actual:** el código de Firebase ya está preparado y probado con una base simulada, pero la **sincronización real no funciona hasta conectar un proyecto Firebase propio de LISTAS**, activar Authentication y Realtime Database, publicar las reglas y desplegar la nueva web. Instalar el complemento Firebase de ChatGPT **no es necesario** para usar el SDK en la aplicación.

## Regla de seguridad antes de empezar

1. **No borres la caché ni los datos de sitio, no uses «Limpiar día» y no desinstales el navegador** del ordenador en el que están los pedidos. Esa es tu copia original.
2. Abre el sitio original **en ese mismo ordenador y navegador**. En **Inicio → Sincronización → Descargar copia JSON** o **Auditoría → Exportar estado JSON**, guarda el fichero. Comprueba que contiene tus `orders`, `destinations` y `catalog`, y guarda otra copia fuera del equipo.
3. **No uses el proyecto Firebase de RUTA MADRID.** La aplicación nueva debe disponer de proyecto, base, reglas y UID propios para no tocar rutas o facturas.

## Crear el backend sin complemento de ChatGPT

En [Firebase Console](https://console.firebase.google.com/):

1. **Añadir proyecto** con nombre `ARSLAN-LISTAS`, independiente de `v9madrid`.
2. En **Build → Authentication → Sign-in method**, activar **Correo electrónico/Contraseña**. En Authentication → Settings → Authorized domains, incluir la URL de producción de Vercel de LISTAS, cuando exista.
3. En **Build → Realtime Database**, crear una base europea. Elegir **modo bloqueado** al inicio; nunca utilizar reglas con `.read: true` y `.write: true`.
4. En la pestaña **Rules** de Realtime Database, copiar y publicar el contenido de `database.rules.json` de este repositorio. Las políticas solo permiten leer/escribir a una cuenta en `arslanListas/arslan-listas-next-v1/{UID}/document`. No autorizan a `anon`.
5. En **Project settings → General → Your apps**, registrar una aplicación **Web**. Copiar solamente la configuración web (no claves de servicio). Añadir a `firebase-config.js` los campos `apiKey`, `authDomain`, `databaseURL`, `projectId` y `appId` de este nuevo proyecto. `apiKey` de Firebase Web no es clave de administrador; la seguridad se aplica en Realtime Database Rules.
6. Ejecutar `npm run check`, publicar la versión en Vercel y confirmar que su HTTPS queda autorizado en Authentication. **No publicar** service accounts, claves privadas o contraseñas.

El archivo `firebase-config.js` empieza **vacío**. Por ello, hasta configurar esos campos, la aplicación mostrará «SOLO EN ESTE DISPOSITIVO», sin simular que funciona la nube.

## Primer inicio para conservar todas tus listas

**Primero el ordenador con los pedidos originales**, nunca el móvil vacío:

1. Descarga JSON desde el sitio anterior y confirma que lo has guardado.
2. Abre la nueva web de LISTAS en el **mismo navegador** que contiene el trabajo original. Si la URL cambia, el almacenamiento local será distinto; después de iniciar sesión usa **Importar copia JSON de otro dispositivo** y selecciona el fichero anterior.
3. Entra con correo y contraseña. Si la nube está vacía, el sistema pedirá **Subir los datos de este dispositivo**; no los sube de forma automática y descargará otra copia antes de enviarlos.
4. Espera a que aparezca **SINCRONIZADO**, y verifica SP, SL, ST, restaurantes, compras y bajadas. Es imprescindible ver los mismos totales antes de abrir el móvil.
5. En el móvil abre la misma URL de Vercel, inicia sesión con **el mismo correo y contraseña** y comprueba las listas. Añade una línea de prueba y confirma que aparece en el ordenador. Nunca pulses «Limpiar día» para forzar un refresco.

Si otro dispositivo creó previamente una nube vacía, la aplicación no sobrescribe tu información original automáticamente: mostrará un conflicto y te dejará elegir tras guardar copias. Si hay datos reales en ambos, no fuerces una versión: exporta los dos estados y compara antes.

## Qué se sincroniza y qué no

- Se sincronizan productos, catálogo, pedidos por tiendas/restaurantes, proveedores, compras manuales, carga y bajadas **entre dispositivos autenticados con el mismo UID**.
- Los cambios se envían con una revisión numérica y transacción condicional; los cambios independientes pueden fusionarse y los incompatibles bloquean el envío con aviso de conflicto.
- Si falla Internet, el navegador conserva cambios pendientes y los reenvía al recuperar conexión. «SINCRONIZADO» solo aparece cuando Firebase confirma la revisión.
- **Una cuenta de Firebase por empleado todavía no comparte el espacio de trabajo de la empresa**. Para usuarios independientes con permisos por tienda es necesario desarrollar reglas de miembros, invitaciones y un workspace empresarial. No compartas la contraseña principal con dependientes.
- Compartir URL o subir archivos a GitHub / Vercel **no recupera automáticamente datos de localStorage de otra URL**. Necesitas la copia JSON inicial.

## Pruebas técnicas

`npm run check` ejecuta los casos de negocio, compras, proveedores, reglas de reparto, sincronización simulada y seguridad de configuración. **No reemplaza una prueba real con dos dispositivos contra el nuevo proyecto Firebase**.