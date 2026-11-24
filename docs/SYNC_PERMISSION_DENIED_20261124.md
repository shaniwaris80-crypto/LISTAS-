# ARSLAN LISTAS NEXT · corrección segura de permission_denied

## Qué está pasando
La pantalla de Cuenta y sincronización puede indicar **ACCESO DENEGADO** aunque la sesión Firebase esté iniciada. El proyecto utiliza una regla `.validate` que exige la clave `orders`, pero Realtime Database omite los arrays vacíos. Una jornada sin pedidos puede fallar la validación de escritura y dar `permission_denied`, sin que falle la conexión a Internet.

Esta causa se deduce del código y de las reglas versionadas. **Las reglas publicadas actualmente en Firebase pueden diferir**: verificar allí antes de cambiarlas.

## Aplicación en Firebase (administrador)
1. Antes de actuar, abre **Cuenta y sincronización → Descargar copia JSON** en el dispositivo que tenga la jornada correcta. No borres el navegador ni cierres sesión con cambios pendientes.
2. En Firebase Console selecciona el proyecto `arslan-listas-next` → Realtime Database → Reglas.
3. Confirma que el propietario y los miembros autorizados mantienen los controles `.read` y `.write` basados en `auth.uid`. **No permitir acceso público**.
4. Compara la regla `.validate` de `arslanListas/arslan-listas-next-v1/$owner/document` con `database.rules.json` de este repositorio. La modificación prevista elimina únicamente `orders` de la lista de *hijos obligatorios* y mantiene `day`, `destinations` y `catalog`.
5. Publica la regla en Firebase, y solo entonces regresa a **Cuenta y sincronización → Reintentar sincronización**.
6. Verifica el número de pedidos y las cantidades en Pedidos / Compras / Reparto antes de seguir operando. Si hay diferencias o conflicto, conserva ambas copias y no publiques una sobre otra.

## Importante
- Un cambio en `database.rules.json` de GitHub NO despliega reglas por sí mismo. Es necesario publicarlas desde Firebase Console o con un despliegue autorizado.
- Nunca pegues contraseñas, claves privadas, tokens ni datos reales de clientes en GitHub.
- Nunca uses `Limpiar día` como reparación de sincronización.
- Las opciones del panel separan **sesión iniciada** (autenticación) de **sincronizado** (confirmación del servidor).
