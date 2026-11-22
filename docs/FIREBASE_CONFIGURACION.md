# Firebase ARSLAN LISTAS — puesta en marcha real

**Proyecto configurado:** `arslan-listas-next`. Realtime Database europea `europe-west1` en `https://arslan-listas-next-default-rtdb.europe-west1.firebasedatabase.app`. Autenticación por correo/contraseña habilitada. Plan Spark (sin facturación adicional activada). El código web contiene únicamente la configuración pública de Firebase.

No utilizar Firebase de Ruta Madrid ni Estambul.

## 1. Migrar la primera jornada sin borrar pedidos

1. Desde el **mismo ordenador y navegador donde ya aparecen tus listas**, abre https://shaniwaris80-crypto.github.io/LISTAS-/ y no borres datos del navegador.
2. En «Hoy» usa «Descargar copia JSON» de los datos anteriores. Guarda una copia fuera del navegador y comprueba que contiene las claves `orders`, `destinations`, `catalog`, `allocations`, `manual` y `delivery`.
3. Inicia sesión en Firebase con una cuenta propia. Si aparece «La nube está vacía / Subir los datos de este dispositivo», revisa cantidades y pulsa para importar expresamente. Se ofrecerá otra copia antes de subir.
4. Verifica en el ordenador que siguen los pedidos de SP, SL, ST y restaurantes, que los proveedores enviados mantienen el estado y que las compras y bajadas coinciden.
5. Solo entonces abre la misma web en el iPhone. Inicia sesión con la misma cuenta o únete al mismo espacio de equipo después de que el propietario lo autorice. Comprueba que aparece «SINCRONIZADO».

**Nunca uses «Limpiar día» para forzar la sincronización**. Si un navegador está vacío, primero revisa la cuenta, el equipo y el estado de Firebase.

## 2. Dar acceso a empleados con cuentas separadas

1. Cada trabajador crea su **propia cuenta** con correo y contraseña desde «Conectar mis dispositivos».
2. El trabajador copia el «Mi ID de Firebase» desde el panel «Equipo».
3. El propietario abre «Hoy → Equipo» en su sesión, pega el ID del trabajador en «Autorizar acceso» y confirma.
4. El trabajador pega el ID del **propietario** en «Conectar a este equipo».
5. Comprueba en ambos dispositivos que usan la **misma jornada** y aparecen las mismas bajadas.

Los usuarios no autorizados no pueden consultar ni modificar pedidos del propietario. El propietario puede revocar el acceso sin borrar la jornada.

## 3. Cómo funciona Bajar con varias personas

- El botón de una bajada no se confirma hasta que Firebase apruebe una transacción sobre la versión actual de esa línea.
- Dos repartidores que marquen **productos distintos** conservan los dos cambios.
- Si dos personas marcan **el mismo producto**, solo se aplica una bajada; la otra pantalla recibe la versión actualizada, sin duplicarla.
- Deshacer la bajada también compara el estado actual; no puede deshacer silenciosamente la acción reciente de otro trabajador.
- Si no hay Internet, Bajar requiere recuperar la conexión. La pantalla no mostrará una bajada compartida como completada antes de confirmarse.
- La barra verde refleja el porcentaje completado de la **tienda seleccionada**, sin sumar cajas a kilos o manojos.

## 4. Copias y cierre de jornada

«Hoy → Limpiar día» exige confirmación y escribir `LIMPIAR`. Descarga una copia JSON antes de archivar y limpiar los movimientos de la jornada. Conserva catálogo, proveedores, restaurantes, alias aprendidos e historial.

También se puede descargar una copia en «Control y seguridad».

## 5. Seguridad de la base de datos

[Firebase Console](https://console.firebase.google.com/project/arslan-listas-next/database/arslan-listas-next-default-rtdb/rules).

Las reglas publicadas requieren `auth.uid` y pertenencia al espacio de trabajo. Solo el propietario puede añadir o revocar miembros. **No reemplazar las reglas con `.read: true` ni `.write: true`**.

Firebase no almacena las contraseñas en el repositorio; nunca envíes claves privadas de servicio ni contraseñas por WhatsApp o GitHub.

## 6. Verificación antes de operación con varios usuarios

Las pruebas automatizadas comprueban el motor, los conflictos y las reglas. Se necesita además una prueba supervisada con **dos dispositivos autenticados reales** para confirmar permisos, latencia, actualización de progreso y estado de recuperación ante un corte de red. No afirmar «sincronizado» solo porque la web cargue o porque un test aislado termine correctamente.

La web de producción está en GitHub Pages, **no en Vercel** todavía.
