# ARSLAN LISTAS: sincronización entre iPhone, Android y ordenador

**Estado del código:** preparada, **NO activada todavía**. En este repositorio `cloud-config.js` contiene URL/clave vacías. Por eso la app avisa claramente **SOLO EN ESTE DISPOSITIVO**. No existe aún una base exclusiva de LISTAS; las bases Supabase conectadas que hemos localizado pertenecen a Estambul Delivery y no se utilizan ni modifican.

## Por qué antes no funcionaba

La versión anterior guardaba todo bajo `localStorage` en cada navegador. Son espacios diferentes incluso cuando la dirección web es la misma. Subir el HTML a GitHub **no sincroniza los datos**. Compartir un enlace de WhatsApp tampoco los sincroniza.

## Qué hemos implementado

- Base de datos Postgres con JSON de jornada por usuario, versión y marca de tiempo.
- Acceso por correo mediante Supabase Auth: el **mismo correo** en iPhone, Android y ordenador ve sus mismos pedidos.
- Reglas de seguridad **Row Level Security**: cada cuenta accede únicamente a su propio documento. No hay lectura anónima.
- Guardado local inmediato, envío a nube tras editar, escucha de cambios de Postgres (Realtime) y comprobación cada 7 segundos como respaldo.
- Concurrencia optimista por `revision`: una escritura solo funciona si nadie ha cambiado el documento desde la última lectura.
- Mezcla automática **solo** de cambios independientes seguros (p. ej. un pedido de SP y otro de SL); conflicto visible si hay riesgo de duplicar una compra o pisar una bajada.
- Sin conexión: los cambios locales quedan pendientes y se intentan enviar al recuperar Internet. Nunca aparece «Sincronizado» si el servidor aún no ha confirmado.
- Copias antes de resolver un conflicto; limpiar día de un terminal no se mezcla con pedidos añadidos durante el mismo periodo en otro terminal.
- Identificadores aleatorios únicos para evitar que dos teléfonos creen líneas con el mismo ID.

## Falta activar un proyecto Supabase NUEVO y exclusivo

**No ejecutar estas instrucciones en `ESTAMBUL DELIVERY`, `ESTAMBUL DELIVERY STAGING` ni `Estambul Delivery V10 QA`.** No compartir la base de datos, credenciales o servicio con esas aplicaciones.

1. Elegir la organización Supabase y crear un proyecto nuevo, p. ej. `ARSLAN-LISTAS-CLOUD`, en región **eu-west-3** (París, cerca de España). Supabase puede cobrar según el plan y la capacidad disponible; comprobar la cotización antes de aceptar.
2. En el proyecto nuevo, ejecutar el script `sql/001_sync.sql` en SQL Editor. Crea `public.arslan_documents` con RLS, permisos y Realtime. El script no borra datos de otras aplicaciones.
3. En **Project Settings → API Keys**, copiar SOLO la **publishable key** (`sb_publishable_...`). No utilizar una secret key ni `service_role` en el frontend.
4. En `cloud-config.js`, rellenar:

```javascript
const ARSLAN_CLOUD_CONFIG = Object.freeze({
  url: 'https://TU-PROYECTO.supabase.co',
  publishableKey: 'sb_publishable_TU-CLAVE-PUBLICA'
});
```

5. En Supabase Auth → URL Configuration, registrar la dirección **HTTPS real** de esta app, tanto en Site URL como en la lista de Redirect URLs, por ejemplo la de GitHub Pages **si se ha habilitado** para LISTAS. No introducir una URL ficticia. El correo de acceso abrirá la web publicada.
6. Ejecutar `npm run check` y publicar el nuevo `index.html` de este repositorio en el sitio donde se vaya a usar.
7. Abrir **Inicio → Conectar mis dispositivos**. Iniciar sesión con el mismo correo en los dos equipos. Si hay datos locales anteriores, elegir **importar** conscientemente, revisarlos y conservar una copia JSON.

## Pruebas de aceptación reales al conectar la base

1. En ordenador, iniciar sesión y crear `PEDIDO SP 2 TOMATE RAMA`. Esperar etiqueta **SINCRONIZADO**.
2. En iPhone, con el mismo correo, abrir la app: debe aparecer ese pedido sin pegarlo de nuevo.
3. En iPhone, añadir `PEDIDO SL 3 TOMATE RAMA`. El ordenador debe verlo después de recibir Realtime o al pulsar **Sincronizar ahora**.
4. Asignar un proveedor y marcar enviado; comprobar que el estado llega al segundo dispositivo.
5. Apagar Internet en móvil, marcar un producto bajado; mostrar **SIN CONEXIÓN**, guardar local, restablecer Internet y comprobar que se sincroniza.
6. Editar la **misma línea** desde dos terminales desconectados; ambos datos deben conservarse y aparecer **REVISAR CONFLICTO**, sin perder las compras previas.
7. Pulsar **Limpiar día** mientras el otro terminal tiene cambios sin subir: bloquear la combinación automática y ofrecer recuperación.
8. Abrir con un correo distinto: no debe poder leer los datos del propietario. Las políticas RLS deben impedirlo también en la API directamente.

## Límite de esta primera integración

Las cuentas de dependientes **aún no comparten un mismo espacio de trabajo**. Esta versión sincroniza entre dispositivos que inician sesión con **la misma cuenta**. Para que cada empleado pueda usar su propia cuenta y limitarse a SP/SL/ST hace falta incorporar una tabla de miembros de equipo, permisos por destino e invitaciones, con políticas RLS propias. **No compartir la contraseña o cuenta principal del propietario con los empleados.**

La sincronización de la app publicada en `arslan-listas-next.arslan96.chatgpt.site` tampoco se modifica por subir código a `LISTAS-`: son despliegues separados. Es necesario publicar la versión de este repositorio en un sitio web y configurar su base.

## Archivos

- `sync-core.mjs`: comparador y coordinador de revisiones, probado con dos dispositivos simulados.
- `cloud-adapter.js`: conexión Supabase Auth + REST + Realtime; se activa solo si hay configuración.
- `cloud-config.js`: URL y clave pública del proyecto nuevo.
- `sql/001_sync.sql`: tabla y políticas de acceso.
- `tests/test_sync.mjs`: pruebas de concurrencia, pérdidas de red y validación de la separación por cuenta.

**Importante:** no se han probado operaciones contra Supabase real porque todavía no existe la base exclusiva de LISTAS. Las pruebas de sincronización se han realizado con una base simulada que reproduce revisiones concurrentes.