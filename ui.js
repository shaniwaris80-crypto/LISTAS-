// ARSLAN LISTAS · interfaz operativa para pedidos, compras y reparto.
const FIXTURE = __FIXTURE__;
const KEY='arslan_listas_reparto_seguro_v5_local_only';
let state;
const CLOUD_ENABLED=ARSLAN_CLOUD_ACTIVE;
if(!CLOUD_ENABLED){
 try{state=JSON.parse(localStorage.getItem(KEY)||'null');}catch{state=null;}
 if(!state||!Array.isArray(state.orders)||!Array.isArray(state.catalog)){
  state=createState(); // No cargar pedidos ficticios.
 }
}else{
 // Mostrar la copia existente del mismo navegador antes de entrar en Firebase.
 // No se guarda ni se importa a la nube sin consentimiento expreso.
 try{const previous=JSON.parse(localStorage.getItem(KEY)||'null');state=previous&&Array.isArray(previous.orders)&&Array.isArray(previous.catalog)?previous:createState();}
 catch{state=createState();}
}
state=normalizeRuntimeState(state);
let tab='inicio',supplier='ESMO',filter='pending',purchaseView='pending',toastMessage='';
let selectedDeliveryDest='SP',expandedPurchaseKey='',editingDestination='';
let orderView='all',expandedOrderDest='';
const purchaseDrafts=Object.create(null); // Sólo controles temporales. Ninguna compra se guarda sin confirmar.
let cloudAdapter=null,cloudEngine=null,cloudUser=null;
let teamOwnerUid=null,teamMembers=[],deliveryBusy=false;
// Bloqueo visual por pestaña: mantiene la sesión Firebase y sus datos sin exigir contraseña.
let accessUnlocked=false,lastCloudSuccess=null;
let cloudStatus=CLOUD_ENABLED?'conectando':'sin_configurar';
let cloudMessage=CLOUD_ENABLED?'Iniciando conexión…':'Guardado solo en este dispositivo';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=encodeURIComponent,dec=decodeURIComponent;
const destName=id=>state.destinations.find(d=>d.id===id)?.name||id;
const trow=key=>totals(state).find(t=>t.key===key);
function normalizeRuntimeState(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return createState();
 const defaults=createState(),next={...defaults,...value};
 for(const key of ['catalog','orders','allocations','manual','receipts','destinations','history','sentMessages','importedFingerprints','riders'])if(!Array.isArray(next[key]))next[key]=defaults[key];
 for(const key of ['aliases','delivery','load','shortageAllocation','riderAssignments'])if(!next[key]||typeof next[key]!=='object'||Array.isArray(next[key]))next[key]={};
 // No se borra ni se reemplaza ninguna compra, pedido o destino existente.
 next.orders=next.orders.map(line=>line&&typeof line==='object'?{...line,unit:line.unit||'BULTO',issues:Array.isArray(line.issues)?line.issues:[],suggestions:Array.isArray(line.suggestions)?line.suggestions:[]}:line).filter(Boolean);
 return next;
}

function freshCloudState(){const s=createState(),d=new Date();s.day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return s;}

function accessGate(){
 const email=cloudUser?.email||'Cuenta conectada';
 const blocked=['permiso_denegado','conflicto','error','sin_conexion'].includes(cloudStatus);
 return `<div class="auth-card saved-session-card"><div class="auth-heading"><span class="auth-logo">${uiIcon('purchases',36)}</span><h1>ARSLAN LISTAS NEXT</h1><p>Pedidos, compras y reparto</p></div>
 <div class="account-ready"><span class="icon-tile">${uiIcon('check',25)}</span><div><strong>Sesión iniciada</strong><small>${esc(email)}</small></div></div>
 <p class="subtle">Tu cuenta ya está reconocida en este dispositivo. Pulsa Entrar para abrir tu jornada sin escribir la contraseña de nuevo.</p>
 ${blocked?`<div class="notice ${cloudStatus==='permiso_denegado'?'red':'amber'}"><b>${esc(cloudStatus==='permiso_denegado'?'Firebase ha denegado el guardado':'Sincronización pendiente')}</b>${esc(cloudMessage)}. Tus datos locales no se eliminarán.</div>`:''}
 <div class="auth-buttons">${btn('unlock-access','Entrar a mis listas','','dark')}${btn('cloud-logout','Cambiar de cuenta','','small')}${blocked?btn('cloud-backup','Guardar copia de seguridad','','small'):''}</div>
 <p class="auth-footer">La sesión de Firebase sigue protegida. Este acceso no vuelve a enviar contraseñas.</p></div>`;
}
function accountView(){
 const logged=Boolean(cloudUser);
 const synced=cloudStatus==='sincronizado'&&!cloudEngine?.dirty&&!cloudEngine?.conflict;
 const denied=cloudStatus==='permiso_denegado',pending=Boolean(cloudEngine?.dirty);
 const cloudTitle=synced?'Datos sincronizados':denied?'Firebase ha denegado el guardado':cloudStatus==='sin_conexion'?'Sin conexión con Firebase':'Sincronización pendiente';
 return sectionTitle('Cuenta y sincronización','Comprueba tu sesión, el estado de Firebase y los datos pendientes de guardar.')+
 `<div class="account-cards">
 <div class="card account-info"><div class="sectionline"><h2>${uiIcon('check',20)} Inicio de sesión</h2>${pill(logged?'SESIÓN INICIADA':'SIN SESIÓN',logged?'ok':'warn')}</div>
 <div class="account-row"><span>Correo electrónico</span><strong>${esc(cloudUser?.email||'No conectado')}</strong></div>
 <div class="account-row"><span>Espacio de trabajo</span><strong>${logged?'Tu equipo ARSLAN LISTAS':'Sin conectar'}</strong></div>
 <div class="tools">${btn('lock-access','Bloquear pantalla','','small')}${btn('cloud-logout','Cerrar sesión','','small red')}</div></div>
 <div class="card account-info"><div class="sectionline"><h2>${uiIcon('delivery',20)} Sincronización</h2>${pill(synced?'SINCRONIZADO':denied?'ACCESO DENEGADO':cloudStatus==='sin_conexion'?'SIN CONEXIÓN':'PENDIENTE',synced?'ok':denied?'err':'warn')}</div>
 <strong class="account-status-title">${cloudTitle}</strong>
 <p class="subtle">${esc(cloudMessage)}</p>
 <div class="account-row"><span>Último estado confirmado</span><strong>${lastCloudSuccess?esc(new Date(lastCloudSuccess).toLocaleString('es-ES')):'Sin confirmar en esta sesión'}</strong></div>
 <div class="account-row"><span>Cambios locales sin subir</span><strong>${pending?'SÍ · conserva esta copia':'No detectados'}</strong></div>
 ${denied?`<div class="notice red"><b>Atención: no borres los datos.</b> El servidor ha rechazado una escritura. Revisa las reglas de Firebase antes de dar la jornada por sincronizada.</div>`:''}
 <div class="tools">${btn('cloud-refresh','Reintentar sincronización','','small dark')}${btn('cloud-backup','Descargar copia JSON','','small')}</div></div></div>
 <div class="card"><h2>Seguridad de tus pedidos</h2><p class="subtle">Puedes descargar la jornada completa, incluidos proveedores enviados, compras, bajadas e historial. La copia no cambia los datos de Firebase.</p>${btn('cloud-backup','Descargar copia de esta jornada','','small')}${denied?'<p class="subtle">Para corregir las reglas del proyecto consulta la consola Firebase. El código de GitHub no publica automáticamente cambios en esas reglas.</p>':''}</div>
 ${teamPanel()}`;
}

function cloudCanEdit(){return !CLOUD_ENABLED||(accessUnlocked&&cloudUser&&cloudEngine&&['sincronizado','pendiente','sin_conexion'].includes(cloudStatus)&&cloudEngine.revision!==null&&!cloudEngine.conflict);}
function persistCloudUser(next,meta){if(!cloudUser)return;try{localStorage.setItem(KEY+':user:'+cloudUser.id+':team:'+(teamOwnerUid||cloudUser.id),JSON.stringify({state:next,meta}));}catch(e){cloudStatus='error';cloudMessage='El navegador no permite guardar el trabajo: '+(e?.message||e);updateSyncDisplay();}}
function syncBadge(withId=true){
 const titles={sin_configurar:'SOLO EN ESTE DISPOSITIVO',conectando:'CONECTANDO',sin_sesion:'SIN SESIÓN',sincronizado:'SINCRONIZADO',pendiente:'GUARDANDO…',sin_conexion:'SIN CONEXIÓN',permiso_denegado:'ACCESO DENEGADO',conflicto:'REVISAR CONFLICTO',importar:'IMPORTAR A NUBE',esperando_origen:'ESPERANDO LISTAS',error:'ERROR DE SINCRONIZACIÓN'};
 const tone=cloudStatus==='sincronizado'?'ok':['conflicto','error','permiso_denegado'].includes(cloudStatus)?'err':'warn';
 return `<button type="button" class="sync-pill ${tone}" ${withId?'id="sync-badge"':''} data-action="goto" data-key="cuenta" title="Ver cuenta y sincronización" aria-label="Ver cuenta y sincronización: ${esc(titles[cloudStatus]||cloudStatus)}">${esc(titles[cloudStatus]||cloudStatus)}</button>`;
}
function legacyBackupButtons(){let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}return saved&&Array.isArray(saved.orders)?`<div class="notice"><b>Datos anteriores en este navegador:</b> ${saved.orders.length} líneas. Descarga una copia antes de conectar la nube. ${btn('cloud-legacy-export','Descargar copia JSON','','small')}</div>`:'';}

function teamPanel(){
 if(!CLOUD_ENABLED||!cloudUser)return '';
 const owner=teamOwnerUid||cloudUser.id,isOwner=owner===cloudUser.id;
 return `<details class="card team-panel"><summary><strong>Equipo · acceso de repartidores</strong></summary>
 <p class="subtle">Cada persona utiliza su cuenta propia de Firebase. El propietario autoriza las cuentas del equipo.</p>
 <label>Mi ID de Firebase</label><div class="team-member"><code>${esc(cloudUser.id)}</code>${btn('team-copy-id','Copiar','','small')}</div>
 <label for="team-owner-id">ID del propietario</label><input id="team-owner-id" value="${esc(owner)}" autocomplete="off" spellcheck="false">
 <div class="tools">${btn('team-join','Conectar a este equipo','','small dark')}</div>
 ${isOwner?`<div class="team-owner"><h3>Dar acceso a un trabajador</h3><p class="subtle">El trabajador crea su cuenta y te pasa su ID. No compartas tu contraseña.</p>
 <label for="team-member-id">ID del trabajador</label><input id="team-member-id" placeholder="ID de Firebase" autocomplete="off" spellcheck="false">
 <div class="tools">${btn('team-add','Autorizar acceso','','small dark')}</div>
 ${teamMembers.map(id=>`<div class="team-member"><code>${esc(id)}</code>${btn('team-revoke','Revocar',id,'small red')}</div>`).join('')}</div>`:
 `<p class="subtle">El propietario debe autorizar tu ID para ver la jornada.</p>`}
 </details>`;
}

function cloudPanel(){
 if(!CLOUD_ENABLED)return `<div class="card sync-panel"><h2>Sincronización entre dispositivos</h2><div class="notice red"><b>No activada.</b> Estos pedidos se guardan solamente en este navegador. Abrir la página en otro móvil no los copia.</div>${legacyBackupButtons()}<p class="subtle">La conexión requiere un proyecto Firebase independiente de Ruta Madrid. Consulta docs/FIREBASE_CONFIGURACION.md.</p></div>`;
 if(!cloudUser)return `<div class="auth-card"><div class="auth-heading"><span class="auth-logo">${uiIcon('purchases',36)}</span><h1>ARSLAN LISTAS NEXT</h1><p>Pedidos, compras y reparto</p><span class="auth-help">${uiIcon('check',17)} Accede a tu jornada en segundos</span></div>
 ${state.orders.length?`<div class="notice amber"><b>Hay ${state.orders.length} líneas en este navegador.</b> Descarga una copia antes de importar o cambiar de equipo.</div>`:''}
 <div class="auth-fields"><label for="cloud-email">Correo electrónico</label><input id="cloud-email" type="email" autocomplete="username" inputmode="email" placeholder="Tu correo" value="${esc(localStorage.getItem('arslan_listas_last_email')||'')}"><label for="cloud-password">Contraseña</label><input id="cloud-password" type="password" autocomplete="current-password" placeholder="Tu contraseña"></div>
 <p class="auth-explainer">${uiIcon('check',18)} Este dispositivo recuerda la sesión. Si continúa válida, al abrir solo tendrás que pulsar Entrar.</p>
 <div class="auth-buttons">${btn('cloud-login','Entrar','','dark')}${btn('cloud-reset','¿Olvidaste la contraseña?','','small')}${btn('cloud-signup','Crear cuenta','','small')}</div>
 <p class="subtle">${esc(cloudMessage)}</p>${legacyBackupButtons()}<p class="auth-footer">Inicio seguro con Firebase · No guardamos contraseñas en el código.</p></div>`;
 const user=esc(cloudUser.email||'Cuenta conectada');
 let actions='';
 if(cloudStatus==='esperando_origen')actions=`<div class="notice"><b>La nube está vacía y este dispositivo no tiene pedidos guardados.</b> No crearemos una jornada vacía que pueda bloquear la importación del ordenador. Abre LISTAS desde el navegador donde hiciste los pedidos, inicia sesión con esta misma cuenta y pulsa «Subir los datos de este dispositivo». Después pulsa ${btn('cloud-refresh','Comprobar si ya están las listas','','dark')} aquí.</div>`;
  else if(cloudStatus==='importar')actions=`<div class="notice"><b>Hay datos locales y la nube está vacía.</b> Para evitar pérdidas no subimos nada automáticamente.</div><div class="tools">${btn('cloud-init','Subir los datos de este dispositivo','','dark')}</div>`;
 else if(cloudStatus==='conflicto')actions=`<div class="notice red"><b>Dos dispositivos modificaron los datos.</b> Nada se sobrescribirá automáticamente. Al elegir una opción se descargará una copia de seguridad.</div><div class="tools">${btn('cloud-use-remote','Usar datos de la nube','','dark')}${btn('cloud-publish-local','Publicar mis datos locales','','red')}</div>`;
 else if(cloudStatus==='permiso_denegado')actions=`<div class="notice red"><b>Firebase ha denegado el guardado.</b> No se ha confirmado la sincronización. Conserva la copia del navegador y revisa las reglas de acceso; no pulses «Limpiar día».</div><div class="tools">${btn('cloud-refresh','Reintentar conexión','','small')}${btn('cloud-backup','Descargar copia de seguridad','','small dark')}</div>`;
 else actions=`<div class="tools">${btn('cloud-refresh','Sincronizar ahora','','dark')}${localStorage.getItem(KEY)?btn('cloud-import-local','Recuperar copia anterior de este navegador','','small'):''}</div>`;
 return `<div class="card sync-panel"><div class="sectionline"><h2>Sincronización de LISTAS</h2>${syncBadge(false)}</div><p class="subtle">${user} · ${esc(cloudMessage)}</p>${actions}<div class="tools">${btn('cloud-backup','Descargar copia de esta jornada','','small')}${btn('cloud-choose-import','Importar copia JSON de otro dispositivo','','small')}${btn('cloud-logout','Cerrar sesión','','small')}</div><input id="cloud-import-file" type="file" accept="application/json,.json" hidden><p class="subtle">El trabajo sin conexión queda pendiente de subir; nunca se sustituyen cambios conflictivos sin revisión. Para mover tus pedidos desde otra URL, primero exporta allí el JSON.</p></div>`+teamPanel();
}
function updateSyncDisplay(){
 const b=document.getElementById('sync-badge');if(b){const temp=document.createElement('div');temp.innerHTML=syncBadge();b.replaceWith(temp.firstElementChild);}
 const panel=document.getElementById('sync-panel');if(panel){panel.innerHTML=cloudPanel();}
}
function commit(message='Cambios guardados'){
 try{
  if(CLOUD_ENABLED){if(!cloudCanEdit())throw Error('Inicia sesión y resuelve cualquier conflicto antes de editar. No se guardaría correctamente.');cloudEngine.keepLocal(state);}
  else localStorage.setItem(KEY,JSON.stringify(state));
  toastMessage=message;render();
 }catch(err){toastMessage='ERROR: '+(err?.message||err);render();}
}
async function beginCloudUser(user){
 const userId=user?.uid||user?.id;
 if(!userId)throw Error('Firebase no ha devuelto una identidad de usuario válida');
 if(cloudUser?.id===userId&&cloudEngine)return;
 if(cloudEngine)cloudEngine.stop();
 cloudUser={id:userId,email:user.email||''};cloudAdapter.setUser(userId);
 let owner=userId;
 try{owner=localStorage.getItem(KEY+':team:'+userId)||userId;}catch{}
 cloudAdapter.setWorkspaceOwner(owner);teamOwnerUid=owner;teamMembers=[];
 if(owner===userId)void cloudAdapter.listMembers().then(list=>{teamMembers=list;updateSyncDisplay();}).catch(()=>{});
 let record=null;
 try{record=JSON.parse(localStorage.getItem(KEY+':user:'+userId+':team:'+owner)||'null');}catch{}
 if(!record&&owner===userId)try{record=JSON.parse(localStorage.getItem(KEY+':user:'+userId)||'null');}catch{}
 let legacy=null;if(owner===userId)try{legacy=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
 const hasRecord=!!(record?.state&&Array.isArray(record.state.orders));
 const hasLegacy=!!(!hasRecord&&legacy&&Array.isArray(legacy.orders));
 state=normalizeRuntimeState(hasRecord?record.state:hasLegacy?legacy:freshCloudState());
 cloudStatus='conectando';cloudMessage='Leyendo los pedidos de la nube…';render();
 cloudEngine=new SyncEngine({adapter:cloudAdapter,initialState:state,meta:record?.meta??null,
  hasLocal:hasRecord||hasLegacy,onApply(next){state=normalizeRuntimeState(next);render();},
  onStatus(status,message){
   cloudStatus=status;cloudMessage=message;
   if(status==='sincronizado')lastCloudSuccess=Date.now();
   if(accessUnlocked)updateSyncDisplay();else render();
  },
  persist: persistCloudUser,setDelay:650});
 await cloudEngine.start();render();
}
async function bootCloud(){
 if(!CLOUD_ENABLED){render();return;}
 cloudStatus='conectando';cloudMessage='Conectando con Firebase…';render();
 try{
  cloudAdapter=await createArslanCloudAdapter();
  const session=await cloudAdapter.session();
  if(session?.user)await beginCloudUser(session.user);
  else{cloudStatus='sin_sesion';cloudMessage='Entra con tu correo para compartir los pedidos entre tus dispositivos';render();}
  cloudAdapter.onAuthChange((event,session)=>{
   if(session?.user&&cloudUser?.id!==(session.user.uid||session.user.id))void beginCloudUser(session.user);
   if(event==='SIGNED_OUT'){
     accessUnlocked=false;lastCloudSuccess=null;
     if(cloudEngine)cloudEngine.stop();cloudEngine=null;cloudUser=null;teamOwnerUid=null;teamMembers=[];let old=null;try{old=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}state=normalizeRuntimeState(old&&Array.isArray(old.orders)?old:createState());
     cloudStatus='sin_sesion';cloudMessage='Sesión cerrada; tus pedidos siguen en la nube';render();
   }
  });
 }catch(e){cloudStatus='error';cloudMessage='No se pudo iniciar la sincronización: '+(e?.message||e);render();}
}
if(typeof setInterval==='function')setInterval(()=>{if(CLOUD_ENABLED&&cloudEngine&&!document.hidden&&navigator.onLine)void cloudEngine.refresh();},7000);
if(typeof window.addEventListener==='function')window.addEventListener('online',()=>{if(cloudEngine)void cloudEngine.refresh();});
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudEngine)void cloudEngine.refresh();});
function issueText(x){return x.issues.includes('PRODUCTO_NO_EN_CATALOGO')?'PRODUCTO NO EN CATÁLOGO':'REVISAR CANTIDAD'}

const SHOP_ICONS={
 home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
 orders:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9M9 11h6M9 15h6"/>',
 suppliers:'<path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6"/>',
 purchases:'<path d="M3 4h2l2 11h11l3-8H6M9 20h.01M18 20h.01"/>',
 delivery:'<path d="M3 6h10v12H3zM13 10h4l4 4v4h-8zM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 package:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10"/>',
 store:'<path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6"/>',
 restaurants:'<path d="M5 3v8M8 3v8M11 3v8M8 11v10M18 3v18M18 3c-3 2-4 5-4 9"/>',
 alert:'<circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 17h.01"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
};
function uiIcon(name,size=22){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHOP_ICONS[name]||SHOP_ICONS.package}</svg>`;}
function shopifyDate(){const d=new Date(state.day+'T12:00:00');return Number.isNaN(d.valueOf())?esc(state.day):d.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}).toUpperCase();}

const btn=(action,text,key='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-key="${enc(key)}">${text}</button>`;
const pill=(t,cls='')=>`<span class="pill ${cls}">${esc(t)}</span>`;
const sectionTitle=(s,d)=>`<div class="head"><div><h1>${s}</h1><p>${d}</p></div><div class="mini">Jornada ${esc(state.day)} · ${esc(CLOUD_ENABLED?(cloudStatus==='sincronizado'?'Sincronizado con Firebase':'Sincronización pendiente'):'Solo en este dispositivo')}</div></div>`;
function stats(){let x=summary(state);return `<div class="grid"><div class="stat"><b>${x.originalLines}</b><span>Líneas de pedido</span></div><div class="stat"><b>${x.products}</b><span>Productos globales</span></div><div class="stat"><b>${x.unreviewed}</b><span>Por revisar</span></div></div>`;}
function nav(){
 const links=[['inicio','Inicio','home'],['pedidos','Pedidos','orders'],['global','Proveedores','suppliers'],['compras','Compras','purchases'],['carga','Carga','package'],['reparto','Reparto','delivery'],['cuenta','Cuenta y sincronización','settings'],['auditoria','Auditoría','alert']];
 const mobile=[['inicio','Inicio','home'],['pedidos','Pedidos','orders'],['compras','Compras','purchases'],['reparto','Reparto','delivery']];
 return `<aside class="side"><div class="side-head"><span class="side-brand">A</span><div><strong>ARSLAN NEXT</strong><small>Operativa diaria</small></div></div><div class="caption">NAVEGACIÓN</div>${links.map(([k,label,icon])=>`<button type="button" class="${tab===k?'active':''}" data-action="goto" data-key="${k}">${uiIcon(icon,19)}<span>${label}</span></button>`).join('')}<div class="side-cloud">${uiIcon('check',16)} ${esc(CLOUD_ENABLED?cloudMessage:'Solo en este dispositivo')}</div></aside><nav class="bottomnav" aria-label="Navegación principal">${mobile.map(([k,label,icon])=>`<button type="button" aria-label="Abrir ${label}" aria-current="${tab===k?'page':'false'}" class="${tab===k?'active':''}" data-action="goto" data-key="${k}">${uiIcon(icon,23)}<span>${label}</span></button>`).join('')}</nav>`;
}
function home(){
 const plan=deliveryPlan(state),all=pendingPurchases(state);
 const shops=state.destinations.filter(d=>d.kind==='tienda').length;
 const restaurants=state.destinations.filter(d=>d.kind!=='tienda'&&state.orders.some(o=>o.dest===d.id)).length;
 const pending=all.filter(r=>r.remainingToBuy>0).length,done=plan.eligible.filter(r=>r.remaining<=0).length;
 const suppliers=SUPPLIERS.filter(p=>p!=='COMPRA EXTERNA'&&supplierLines(state,p,false).length).map(p=>({name:p,n:supplierLines(state,p,false).length}));
 const extras=typeof additionalPurchaseRows==='function'?additionalPurchaseRows(state).filter(r=>r.pending>0):[];
 const actions=[['pedidos','orders','PEDIDOS','Añadir y revisar listas'],['global','suppliers','PROVEEDORES','Asignar y enviar'],['compras','purchases','COMPRAS','Pendientes y manuales'],['reparto','delivery','REPARTO','Bajar por destino']];
 return `<div class="shop-home"><div class="home-welcome"><h1>Mi jornada</h1><p>${shopifyDate()} · San Pablo, San Lesmes, Santiago y restaurantes</p></div>
 <label class="shop-search">${uiIcon('search',21)}<input type="search" id="homeSearch" placeholder="Buscar producto o tienda" autocomplete="off"></label>
 <div class="shop-kpis"><div>${uiIcon('store',22)}<b>${shops}</b><span>TIENDAS</span></div><div>${uiIcon('restaurants',22)}<b>${restaurants}</b><span>RESTAURANTES</span></div><div>${uiIcon('orders',22)}<b>${pending}</b><span>PENDIENTES</span></div><div>${uiIcon('check',22)}<b>${done}</b><span>BAJADOS</span></div></div>
 <div class="shop-shortcuts">${actions.map(([page,icon,title,desc])=>`<button type="button" class="shortcut" data-action="goto" data-key="${page}"><span class="icon-tile">${uiIcon(icon,26)}</span><strong>${title}</strong><small>${desc}</small><span class="shortcut-arrow">›</span></button>`).join('')}</div>
 <div class="sectionline"><h2>Avisos de hoy</h2>${pill(pending+' productos por comprar',pending?'warn':'ok')}</div>
 <div class="card home-alerts">${extras.slice(0,3).map(r=>`<button type="button" class="alert-line" data-action="goto-additional"><span class="alert-icon">${uiIcon('alert',20)}</span><span><strong>${esc(destName(r.dest))} · ${esc(r.pending)} ${esc(r.product)}</strong><small>Pedido adicional · compra manual pendiente</small></span><span>›</span></button>`).join('')}${suppliers.slice(0,3).map(p=>`<button type="button" class="alert-line" data-action="goto" data-key="global"><span class="alert-icon">${uiIcon('package',20)}</span><span><strong>${esc(p.name)}</strong><small>${p.n} líneas pendientes de enviar</small></span><span>›</span></button>`).join('')}${!extras.length&&!suppliers.length?'<p class="subtle">No hay ampliaciones ni proveedores pendientes de enviar.</p>':''}</div>
 <details class="home-tools"><summary>${uiIcon('settings',17)} Más opciones, sincronización y copias de seguridad</summary><div id="sync-panel">${cloudPanel()}</div><div class="clear-day-home"><div class="clear-day-description"><strong>Limpiar día</strong><span>Solo al terminar la jornada; se descarga una copia y pide confirmación.</span></div>${btn('clearday','Limpiar día','','red clear-day-button')}</div></details></div>`;
}
function orderCard(d){
 const lines=state.orders.filter(l=>l.dest===d.id).sort((a,b)=>a.product.localeCompare(b.product,'es',{numeric:true}));
 const editing=editingDestination===d.id,expanded=expandedOrderDest===d.id||editing;
 const preview=lines.slice(0,3);
 return `<div class="card order-card searchable ${expanded?'expanded':''}" data-destination="${esc(d.id)}" data-search="${esc(d.name+' '+lines.map(l=>l.product).join(' '))}">
 <button type="button" class="order-summary" data-action="order-open" data-key="${enc(d.id)}" aria-expanded="${expanded}"><span class="icon-tile">${uiIcon(d.kind==='tienda'?'store':'restaurants',23)}</span><span class="order-overview"><strong>${esc(d.name)}</strong><small>${lines.length} productos pedidos</small></span><span class="order-arrow">${expanded?'⌃':'›'}</span></button>
 ${!expanded?`<div class="order-preview">${preview.map(l=>`<div><b class="qty-chip">${esc(l.q??'?')}</b><span>${esc(l.product)}</span></div>`).join('')}${lines.length>3?`<small>Y ${lines.length-3} más…</small>`:''}${!lines.length?'<small>Sin pedido todavía</small>':''}</div>`:''}
 ${expanded?`<div class="order-expanded"><div class="tools">${btn('destedit',editing?'Cerrar edición':'+ Añadir pedido',d.id,'small dark')}${lines.length?btn('destcopy','Copiar TXT',d.id,'small')+btn('destdownload','Descargar TXT',d.id,'small')+btn('destwa','WhatsApp',d.id,'small green'):''}</div>
 ${editing?`<div class="inline-order"><label for="destorder-${esc(d.id)}">Añadir productos a ${esc(d.name)}</label><textarea id="destorder-${esc(d.id)}" placeholder="2 TOMATE RAMA&#10;1 BROCOLI"></textarea>${btn('destadd','Guardar pedido',d.id,'dark small')}</div>`:''}
 <div class="items">${lines.map(l=>`<div class="item ${l.review?'err':''}"><div class="keynum">${esc(l.q??'?')}</div><div class="grow"><div class="product">${esc(l.product)}</div><div class="details">${esc(l.unit)} · ${l.review?pill(issueText(l),'err'):pill('OK','ok')}${l.kind==='pedido-adicional'?' · '+pill('Adicional','warn'):''}</div>${l.review&&l.suggestions.length?`<div class="tools">${l.suggestions.map(x=>`<button class="btn small" data-action="suggest" data-key="${enc(l.id)}" data-target="${enc(x)}">Usar ${esc(x)}</button>`).join('')}</div>`:''}</div><div class="mini-actions">${l.review?btn('create','Crear producto',l.id,'small dark'):''}${btn('qty','Cantidad',l.id,'small')}${btn('editname','Editar nombre',l.id,'small')}</div></div>`).join('')}</div></div>`:''}</div>`;
}
function pedidos(){
 const candidates=state.orders.filter(x=>x.review),stores=state.destinations.filter(d=>d.kind==='tienda');
 const restaurants=state.destinations.filter(d=>d.kind!=='tienda').sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const shown=orderView==='stores'?stores:orderView==='restaurants'?restaurants:[...stores,...restaurants];
 const active=shown.filter(d=>state.orders.some(o=>o.dest===d.id)||editingDestination===d.id),inactive=shown.filter(d=>!active.some(x=>x.id===d.id));
 return sectionTitle('Pedidos','Añade productos a cada tienda o restaurante sin mezclar cantidades.')+
 `<label class="shop-search">${uiIcon('search',21)}<input type="search" id="searchRows" placeholder="Buscar producto o cliente" autocomplete="off"></label>
 <div class="seg-tabs" role="group" aria-label="Filtrar destinos">${[['stores','Tiendas'],['restaurants','Restaurantes'],['all','Todos']].map(([k,label])=>`<button type="button" class="${orderView===k?'active':''}" data-action="order-filter" data-key="${k}">${label}</button>`).join('')}</div>
 <div class="order-store-stats">${stores.map(d=>`<div><span>${uiIcon('store',20)}</span><strong>${esc(d.name)}</strong><b>${state.orders.filter(o=>o.dest===d.id&&o.q>0).length}</b></div>`).join('')}</div>
 <div class="sectionline"><h2>Pedidos de la jornada</h2>${pill(active.length+' destinos con pedido','ok')}</div>
 <div class="orders-grid">${active.map(orderCard).join('')||'<p class="subtle">Aún no hay pedidos.</p>'}</div>
 <div class="sectionline"><h2>Otros destinos</h2><div class="tools">${btn('newdest','+ Nuevo restaurante','','small dark')}${btn('toggle-paste','+ Pegar listas','','small')}</div></div>
 <div class="orders-grid">${inactive.map(orderCard).join('')}</div>
 <details class="card paste-panel" id="bulkPaste"><summary><strong>Pegar varias listas juntas</strong> · tiendas y restaurantes</summary><label for="paste">Pedidos de WhatsApp con encabezados</label><textarea id="paste" placeholder="PEDIDO SP&#10;3 MANZANA GOLDEN 28&#10;PEDIDO BRASEROS CENTRO&#10;2 AGUACATE PRIMERA"></textarea><div class="tools">${btn('import','Añadir pedidos','','dark')}${btn('replace','Sustituir listas (solo sin compras)','','small')}${btn('goto','Proveedores','global','small')}</div></details>
 ${candidates.length?`<div class="notice amber"><b>${candidates.length} productos por revisar</b> Abre el destino y confirma los nombres o cantidades antes de comprar.</div>`:''}`;
}
function providerCard(p){
 const rows=supplierLines(state,p),draft=rows.filter(a=>a.status==='draft'),sent=rows.filter(a=>a.status==='sent'),draftText=supplierDraftTXT(state,p);
 const status=draft.length?pill(draft.length+' pendientes','warn'):sent.length?pill('ENVIADO','ok'):pill('Sin asignar');
 return `<div class="card provider-card searchable" data-provider="${esc(p)}" data-search="${esc(p+' '+rows.map(a=>a.product).join(' '))}">
 <div class="provider-heading"><span class="icon-tile">${uiIcon('suppliers',23)}</span><div class="provider-name"><h2>${esc(p)}</h2><small>${rows.length} productos · ${sent.length} enviados</small></div>${status}</div>
 ${rows.length?`<div class="provider-preview">${rows.slice(0,3).map(a=>`${esc(a.q)} ${esc(display(a.product))}`).join(' · ')}${rows.length>3?' · …':''}</div>`:'<p class="subtle">Sin productos asignados.</p>'}
 <div class="tools provider-actions">${draft.length?btn('whatsapp','WhatsApp pendiente',p,'small green')+btn('copy','Copiar TXT',p,'small')+btn('provdownload','Descargar TXT',p,'small')+btn('sent','✓ Marcar enviado',p,'small dark'):''}${!draft.length&&sent.length?pill('✓ Sin líneas nuevas por enviar','ok'):''}</div>
 ${rows.length?`<details class="provider-details"><summary>Ver líneas y opciones</summary><div class="items">${rows.map(a=>`<div class="item ${a.status==='sent'?'done':''}"><div class="keynum">${esc(a.q)}</div><div class="grow"><div class="product">${esc(display(a.product))}</div><div class="details">${pill(a.status==='sent'?'✓ Enviado':'Pendiente',a.status==='sent'?'ok':'warn')}</div></div>${a.status==='draft'?btn('unassign','Quitar borrador',a.key,'small'):''}</div>`).join('')}</div><div class="tools">${btn('copyall','Copiar todo',p,'small')}${btn('provdownloadall','Descargar todo',p,'small')}${sent.length?btn('reopensent','Corregir enviado',p,'small red'):''}</div>${draftText?`<pre class="copy">${esc(draftText)}</pre>`:''}</details>`:''}
 </div>`;
}
function globalView(){
 const rows=totals(state),unassigned=unassignedProducts(state),selected=SUPPLIERS.filter(x=>x!=='COMPRA EXTERNA');
 const visible=filter==='all'?rows:filter==='pending'?unassigned:filter==='draft'?rows.filter(r=>state.allocations.some(a=>a.key===r.key&&a.status==='draft')):rows.filter(r=>state.allocations.some(a=>a.key===r.key&&a.status==='sent'));
 return sectionTitle('Proveedores','Envía solo las líneas pendientes; los pedidos ya enviados nunca se reenvían automáticamente.')+
 `<label class="shop-search">${uiIcon('search',21)}<input id="searchRows" type="search" placeholder="Buscar proveedor o producto" autocomplete="off"></label>
 <div class="sectionline"><h2>Mis proveedores</h2>${pill(selected.length+' proveedores')}</div>
 <div class="provider-grid">${selected.map(providerCard).join('')}</div>
 <div class="card assign-panel"><div class="sectionline"><h2>Asignar productos</h2>${pill('Global conserva todos los pedidos')}</div>
 <div class="supplier-pills">${selected.map(p=>`<button class="btn ${supplier===p?'on':''}" data-action="selprov" data-key="${enc(p)}">${esc(p)}</button>`).join('')}</div>
 <div class="tools">${btn('filter',`Sin asignar (${unassigned.length})`,'pending','small '+(filter==='pending'?'dark':''))}${btn('filter','Todos','all','small '+(filter==='all'?'dark':''))}${btn('filter','Sin enviar','draft','small')}${btn('filter','Enviados','sent','small')}</div>
 <div class="items assign-items">${visible.map(r=>{const active=state.allocations.filter(a=>sameProductKey(state,a.key,r.key)&&a.status!=='cancelled');const covered=authorizedQty(state,r.key)>0;return `<div class="item searchable ${r.unresolved?'err':''}" data-search="${esc(r.product)}"><div class="keynum">${esc(r.total)}</div><div class="grow"><div class="product">${esc(r.product)}</div><div class="details">${esc(r.unit)} · ${Object.entries(r.by).map(([d,n])=>esc(destName(d))+': '+n).join(' · ')}</div><div class="tools">${covered?pill('Enviado o comprado','ok'):active.length?pill('Asignado sin enviar','warn'):pill('Sin asignar')}</div></div><div class="mini-actions">${r.unresolved?pill('Revisar nombre','err'):!active.length?btn('assign','+ '+esc(supplier),r.key,'small dark'):active.some(a=>a.status==='draft')?btn('unassign','Quitar borrador',r.key,'small'):''}</div></div>`;}).join('')||'<p class="subtle">No hay productos en este filtro.</p>'}</div></div>
 <div class="notice green"><b>¿Ha llegado un pedido nuevo después de enviar?</b> Agrégalo en Pedidos. Lo que falte se gestionará desde Compras Manuales, sin repetir WhatsApp.</div>`;
}
function getPurchaseDraft(row,mode){
 const key=mode+':'+row.key;
 if(Object.prototype.hasOwnProperty.call(purchaseDrafts,key))return purchaseDrafts[key];
 return String(mode==='manual'?row.manuallyBought:row.remainingToBuy).replace('.',',');
}
function purchaseQtyFromInput(key,mode){
 const input=[...document.querySelectorAll('[data-purchase-qty]')].find(el=>el.dataset.purchaseKey===key&&el.dataset.purchaseMode===mode);
 const raw=input?.value??purchaseDrafts[mode+':'+key];
 const q=Number(String(raw??'').trim().replace(',','.'));
 if(!String(raw??'').trim()||!Number.isFinite(q)||q<0)throw Error('Introduce una cantidad válida mayor o igual que cero');
 return fix(q);
}
function purchaseQuantityEditor(row,mode){
 const title=mode==='manual'?'Cantidad comprada':'Cantidad que vas a comprar';
 return `<div class="purchase-controls"><label>${title}</label><div class="purchase-qty-controls"><button type="button" class="qty-step" data-action="purchase-step" data-key="${enc(row.key)}" data-target="${mode}:-1" aria-label="Restar una unidad de ${esc(row.product)}">−</button><input type="text" inputmode="decimal" autocomplete="off" data-purchase-qty data-purchase-key="${esc(row.key)}" data-purchase-mode="${mode}" value="${esc(getPurchaseDraft(row,mode))}" aria-label="Cantidad de ${esc(row.product)}"><button type="button" class="qty-step" data-action="purchase-step" data-key="${enc(row.key)}" data-target="${mode}:1" aria-label="Sumar una unidad de ${esc(row.product)}">+</button></div>${mode==='manual'?btn('purchase-save','Guardar cantidad',row.key,'small dark'):''}</div>`;
}
function purchaseItem(row,mode){
 const checked=mode==='manual';
 const qty=checked?row.manuallyBought:mode==='pending'?row.remainingToBuy:row.total;
 const status=row.assignedSent>0?pill(row.assignedSent+' enviado proveedor','ok'):'';
 const drafted=row.assignedDraft>0?pill(row.assignedDraft+' asignado sin enviar','warn'):'';
 const bought=row.manuallyBought>0?pill(row.manuallyBought+' comprado manual','ok'):'';
 const reserved=mode==='manual'&&additionalPurchaseRows(state).some(r=>r.key===row.key&&r.purchased>0);
 const checkbox=(mode==='pending'||mode==='manual')&&!reserved;
 const tick=checkbox?`<button type="button" class="purchase-tick ${checked?'checked':''}" role="checkbox" aria-checked="${checked}" ${row.unresolved?'disabled':''} data-action="purchase-toggle" data-key="${enc(row.key)}" data-target="${mode}" aria-label="${checked?'Desmarcar compra manual de':'Marcar como comprado'} ${esc(row.product)}">${checked?'✓':''}</button>`:'';
 // Mostrar también las otras tiendas para poder sumar un producto que hoy está a cero.
 const detail=Object.entries({...Object.fromEntries(state.destinations.filter(d=>d.kind==='tienda').map(d=>[d.id,0])),...row.by})
  .sort((a,b)=>destName(a[0]).localeCompare(destName(b[0]),'es'));
 const destinations=detail.map(([dest,value])=>{
  const step=Math.abs(value%1)>1e-8?0.5:1;
  const disabled=deliveryBusy?'disabled aria-busy="true"':'';
  return `<div class="breakdown-line editable-destination" data-destination="${esc(dest)}"><span class="breakdown-destination">${esc(destName(dest))}</span><div class="destination-qty-controls"><button type="button" class="destination-qty-step" data-action="destqty" data-key="${enc(row.key)}" data-dest="${enc(dest)}" data-target="${-step}" ${disabled} aria-label="Quitar ${step} a ${esc(destName(dest))} en ${esc(row.product)}">−</button><strong class="destination-qty-value" aria-label="Cantidad de ${esc(destName(dest))}">${esc(value)}</strong><button type="button" class="destination-qty-step" data-action="destqty" data-key="${enc(row.key)}" data-dest="${enc(dest)}" data-target="${step}" ${disabled} aria-label="Añadir ${step} a ${esc(destName(dest))} en ${esc(row.product)}">+</button></div></div>`;
 }).join('');
 return `<div class="item searchable purchase-item ${checked?'manual-complete':''} ${row.unresolved?'err':''}" data-search="${esc(row.product)}" data-purchase-type="${mode}" data-product-key="${esc(row.key)}">
  ${tick}<div class="keynum">${qty}</div><div class="grow"><div class="product purchase-title">${esc(row.product)}</div>
   <div class="details">${esc(row.unit)} · Pedido total: <b>${row.total}</b> · Falta comprar: <b>${row.remainingToBuy}</b></div>
   <div class="purchase-statuses">${status}${drafted}${bought}${row.unresolved?pill('Revisar nombre en Pedidos','err'):''}</div>
   <details class="purchase-destination-details"><summary>Ver cantidades por tienda · Ajustar + / −</summary><div class="purchase-breakdown purchase-inline"><div class="purchase-inline-label">CANTIDAD POR TIENDA · un toque para corregir</div>
    ${destinations}
    <div class="breakdown-line total"><span>TOTAL GLOBAL</span><strong>${row.total} ${esc(row.unit)}</strong></div>
    ${row.remainingToBuy>0?`<div class="breakdown-line shortage-note"><span>Sin comprar ni enviar</span><strong>${row.remainingToBuy} ${esc(row.unit)}</strong></div>`:''}
   </div></details>
   ${reserved?'<p class="subtle">Parte de esta compra está reservada a un destino. Corrígela desde Pedidos adicionales.</p>':''}
   ${checkbox&&!row.unresolved?purchaseQuantityEditor(row,mode):''}</div>
   ${mode==='pending'&&!row.unresolved?btn('purchase-confirm','Confirmar compra',row.key,'small dark'):''}
   ${checked?(reserved?btn('goto-additional','Ver adicionales','','small'):btn('purchase-undo','Deshacer',row.key,'small')):''}</div>`;
}

/** Pedidos incorporados después de enviar a proveedores; no reenviar WhatsApp. */
function additionalPurchaseRows(snapshot){
 const rows=new Map(),plan=deliveryPlan(snapshot),t=totals(snapshot);
 for(const line of snapshot.orders||[]){
  if(line.kind!=='pedido-adicional'||!(Number(line.q)>0)||line.review)continue;
  const key=canonical(normalizedProductName(line.product,snapshot))+'|'+(line.unit||'BULTO'),id=key+'@'+line.dest;
  if(!rows.has(id))rows.set(id,{key,dest:line.dest,product:normalizedProductName(line.product,snapshot),unit:line.unit||'BULTO',qty:0});
  rows.get(id).qty=fix(rows.get(id).qty+line.q);
 }
 return [...rows.values()].map(r=>{
  const ordered=t.find(x=>sameProductKey(snapshot,x.key,r.key));
  const original=fix(Math.max(0,(ordered?.by?.[r.dest]||0)-r.qty));
  const allowed=plan.eligible.find(x=>sameProductKey(snapshot,x.key,r.key)&&x.dest===r.dest)?.allowed||0;
  const purchased=fix(Math.max(0,(snapshot.manual||[]).filter(m=>m.confirmed&&m.additionalDest===r.dest&&sameProductKey(snapshot,m.key,r.key)).reduce((n,m)=>n+(Number(m.q)||0),0)));
  return {...r,purchased,original,pending:fix(Math.max(0,r.qty-Math.max(purchased,Math.max(0,allowed-original)))),ready:allowed>=original+r.qty-1e-8};
 }).sort((a,b)=>a.dest.localeCompare(b.dest)||a.product.localeCompare(b.product,'es'));
}
function additionalPurchaseItem(row){
 const id=row.key+'@'+row.dest,inputId='additional-'+encodeURIComponent(id),value=purchaseDrafts['additional:'+id]??String(row.pending).replace('.',',');
 return `<div class="item searchable additional-item" data-search="${esc(row.product+' '+destName(row.dest))}"><div class="icon-tile">${uiIcon('package',23)}</div><div class="grow"><div class="product">${esc(row.product)}</div><div class="details">${esc(destName(row.dest))} · ${esc(row.unit)} · Pedido adicional: <b>${row.qty}</b></div>
 ${row.purchased>0?pill(row.purchased+' compra manual confirmada','ok'):''}
 ${row.pending>0?`<div class="additional-controls"><button type="button" class="qty-step" data-action="additional-step" data-key="${enc(id)}" data-target="-1">−</button><input id="${esc(inputId)}" data-additional-qty data-additional-key="${esc(id)}" type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" aria-label="Cantidad de compra adicional de ${esc(row.product)}"><button type="button" class="qty-step" data-action="additional-step" data-key="${enc(id)}" data-target="1">+</button>${btn('additional-buy','✓ Comprado',id,'small dark')}</div>`:row.ready?pill('Cubierto · listo para reparto','ok'):pill('Comprado · revisa distribución de faltantes','warn')}
 ${row.purchased>0?btn('additional-undo','Deshacer compra adicional',id,'small'):''}</div></div>`;
}

function compras(){
 const all=pendingPurchases(state),additional=additionalPurchaseRows(state),subtract=new Map();
 for(const r of additional)if(r.pending>0)subtract.set(r.key,fix((subtract.get(r.key)||0)+r.pending));
 const pending=all.map(r=>({...r,remainingToBuy:fix(Math.max(0,r.remainingToBuy-(subtract.get(r.key)||0)))})).filter(r=>r.remainingToBuy>0||r.unresolved);
 const bought=all.filter(r=>r.manuallyBought>0);
 const counts={pending:pending.length,additional:additional.filter(r=>r.pending>0).length,manual:bought.length,supplier:all.filter(r=>r.supplierCovered>0).length,all:all.length};
 const filters=[['pending','Pendientes'],['additional','Pedidos adicionales'],['manual','Comprados'],['supplier','Proveedores'],['all','Todos']];
 const other=purchaseView==='supplier'?all.filter(r=>r.supplierCovered>0):all;
 const exportable=pendingManualPurchaseTXT(state);
 const title={pending:'Por comprar',additional:'Pedidos adicionales',manual:'Compras realizadas',supplier:'Cubierto por proveedores',all:'Todos los productos'}[purchaseView]||'Compras';
 return sectionTitle('Compras manuales','Lo enviado a proveedores no se compra dos veces. Los pedidos tardíos se identifican por destino.')+
 `<label class="shop-search">${uiIcon('search',21)}<input id="searchRows" type="search" placeholder="Buscar producto" autocomplete="off"></label>
 <div class="purchase-tabs" role="group" aria-label="Filtros de compras">${filters.map(([k,label])=>`<button type="button" class="purchase-filter ${purchaseView===k?'active':''}" data-action="purchasefilter" data-key="${k}" aria-pressed="${purchaseView===k}">${label} <span class="filter-count">${counts[k]}</span></button>`).join('')}</div>
 ${purchaseView==='additional'?'<div class="notice green"><b>Pedidos recibidos después de enviar a proveedores.</b> Compra y marca sólo lo que falte. Cada cantidad se reserva a su tienda o restaurante, sin modificar los mensajes enviados.</div>':'<div class="notice green"><b>Compras sin duplicados.</b> Lo enviado o reservado al proveedor no se suma otra vez. Usa + / − para editar cantidades y confirma la compra real.</div>'}
 <div class="card purchases-list"><div class="sectionline"><h2>${title}</h2>${pill((purchaseView==='additional'?additional.filter(r=>r.pending>0).length:purchaseView==='manual'?bought.length:purchaseView==='pending'?pending.length:other.length)+' productos')}</div>
 ${purchaseView==='pending'?`<div class="purchase-bulk"><div class="tools">${btn('manual-copy-pending','Copiar TXT pendiente','','small')}${btn('manual-download-pending','Descargar TXT','','small')}${btn('manual-wa-pending','WhatsApp pendientes','','small green')}</div><details><summary>Acciones masivas · confirmar antes de comprar</summary><div class="tools">${btn('buyall','Marcar pendientes normales como comprados','','small dark')}</div></details><p class="subtle">${exportable?'El TXT pendiente incluye también ampliaciones sin comprar.':'Todo cubierto.'}</p></div>`:''}
 <div class="items">${purchaseView==='pending'?(pending.map(r=>purchaseItem(r,'pending')).join('')||'<p class="subtle">No quedan compras normales pendientes.</p>'):purchaseView==='additional'?(additional.map(additionalPurchaseItem).join('')||'<p class="subtle">Todavía no hay pedidos adicionales. Cuando añadas un pedido después de enviar a proveedores, aparecerá aquí.</p>'):purchaseView==='manual'?(bought.map(r=>purchaseItem(r,'manual')).join('')||'<p class="subtle">No hay compras manuales confirmadas.</p>'):(other.map(r=>purchaseItem(r,'readonly')).join('')||'<p class="subtle">Sin productos en esta vista.</p>')}</div></div>
 ${purchaseView==='pending'&&bought.length?`<details class="card purchase-completed"><summary>✓ Comprados manualmente · ${bought.length} productos</summary><div class="items">${bought.map(r=>purchaseItem(r,'manual')).join('')}</div></details>`:''}
 ${purchaseView==='manual'&&bought.length?`<div class="card"><div class="tools">${btn('manual-undo-all','Deshacer todas (si no hay reservas ni bajadas)','','small red')}</div></div>`:''}
 <div class="card"><div class="sectionline"><h2>Extras confirmados</h2>${pill('Sin compras duplicadas')}</div>${surplus(state).length?surplus(state).map(r=>`<div class="item"><div class="keynum">+${r.extra}</div><div class="grow"><b>${esc(r.product)}</b><div class="subtle">Compra adicional real; distribución opcional.</div></div>${btn('extra','Distribución',r.key,'small')}</div>`).join(''):'<p class="subtle">No hay sobrantes confirmados.</p>'}</div>`;
}
function carga(){const x=deliveryPlan(state);return sectionTitle('Carga · opcional','Si quieres, marca lo que has cargado. Si prefieres ir directamente a Reparto, puedes saltarte este paso.')+`<div class="notice green"><b>La carga no bloquea reparto.</b> Los productos habilitados aparecen en Reparto aunque no marques nada aquí.</div><div class="tools" style="margin-bottom:15px">${btn('goto','Ir directo a Reparto','reparto','dark')}</div>`+
 `<div class="card"><h2>Por cargar</h2><div class="items">${x.eligible.map(r=>{const q=state.load[r.key+'@'+r.dest]||0;return `<div class="item ${q>=r.allowed?'done':''}"><button class="clickable" data-action="load" data-key="${enc(r.key)}" data-dest="${enc(r.dest)}"><span class="check">${q>=r.allowed?'✓':''}</span><div class="grow"><div class="product">${esc(r.allowed)} ${esc(r.product)}</div><div class="details">${esc(destName(r.dest))} · ${esc(r.unit)}${q?' · cargado '+q:''}</div></div></button></div>`}).join('')||'<div class="subtle">Primero registra envío a proveedor o compra manual.</div>'}</div></div>`;}
function reparto(){
 const p=deliveryPlan(state);
 const dests=state.destinations.filter(d=>state.orders.some(o=>o.dest===d.id)).sort((a,b)=>a.kind==='tienda'&&b.kind!=='tienda'?-1:a.kind!=='tienda'&&b.kind==='tienda'?1:a.kind==='tienda'?STORE_ORDER.indexOf(a.id)-STORE_ORDER.indexOf(b.id):a.name.localeCompare(b.name,'es'));
 if(dests.length&&!dests.some(d=>d.id===selectedDeliveryDest))selectedDeliveryDest=dests[0].id;
 const dest=selectedDeliveryDest;
 const progress=deliveryProgress(state,dest);
 const current=state.destinations.find(x=>x.id===dest),notDone=p.eligible.filter(x=>x.dest===dest&&x.remaining>0),done=p.eligible.filter(x=>x.dest===dest&&x.remaining===0),myReview=p.needsReview.filter(x=>(x.by?.[dest]||0)>0),short=p.short.filter(x=>x.dest===dest),unready=p.blocked.filter(x=>(x.by?.[dest]||0)>0);
 return sectionTitle('Reparto','Selecciona la tienda o restaurante y baja la mercancía con un toque.')+
 `<div class="card destination-picker"><label for="deliveryDestination">¿En qué tienda o restaurante estás bajando?</label><select id="deliveryDestination">${dests.map(d=>`<option value="${esc(d.id)}" ${dest===d.id?'selected':''}>${esc(d.name)} · ${p.eligible.filter(x=>x.dest===d.id&&x.remaining>0).length} pendientes</option>`).join('')||'<option value="">Todavía sin pedidos</option>'}</select><div class="tools" style="margin-top:10px">${current?btn('rider','Repartidor: '+esc(state.riderAssignments?.[dest]||'Sin asignar'),dest,'small'):''}${pill('Carga opcional','ok')}</div></div>`+
 `<div class="delivery-dest-chips" role="group" aria-label="Elegir tienda o restaurante">${dests.map(d=>`<button type="button" class="${d.id===dest?'active':''}" data-action="delivery-select" data-key="${enc(d.id)}" aria-pressed="${d.id===dest}">${esc(d.name)}</button>`).join('')}</div><div class="card delivery-progress"><div class="progress-heading"><div><strong>Progreso · ${esc(current?.name||'destino')}</strong><span>${progress.completos} de ${progress.productos} productos completos</span></div><b>${progress.porcentaje}%</b></div><div class="progress-track" role="progressbar" aria-label="Bajadas de ${esc(current?.name||'destino')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.porcentaje}"><div class="progress-fill" style="width:${progress.porcentaje}%"></div></div><div class="progress-caption">${progress.pendientes} pendientes · actualizada con las bajadas confirmadas</div></div>`+
 `<div class="grid"><div class="stat"><b>${notDone.length}</b><span>Por bajar en ${esc(current?.name||'destino')}</span></div><div class="stat"><b>${done.length}</b><span>Bajados en este destino</span></div></div><div class="spacer"></div>`+
 (myReview.length?`<div class="notice amber"><b>Compra parcial pendiente de distribuir</b> ${myReview.map(r=>btn('shortage','Distribuir '+esc(r.product),r.key,'small')).join('')}</div>`:'')+
 `<div class="card delivery-pending"><div class="sectionline"><h2>Por bajar · ${esc(current?.name||'Sin destino')}</h2>${pill(notDone.length+' pendientes')}</div><div class="items">${notDone.map(r=>`<div class="item"><button class="clickable" data-action="deliver" data-key="${enc(r.key)}" data-dest="${enc(dest)}" ${deliveryBusy?'disabled aria-busy="true"':''}><span class="check"></span><div class="grow"><div class="product">${esc(r.remaining)} ${esc(r.product)}</div><div class="details">${esc(r.unit)} · ${r.delivered>0?`${r.delivered} ya bajado · `:''}Toca para marcar BAJADO</div></div></button><div class="mini-actions"><button type="button" class="btn small" data-action="deliver-step" data-key="${enc(r.key)}" data-dest="${enc(dest)}" data-target="-1" ${r.delivered<=0||deliveryBusy?'disabled':''} aria-label="Quitar una unidad bajada de ${esc(r.product)}">−</button><strong class="delivery-count">${esc(r.delivered)} / ${esc(r.allowed)}</strong><button type="button" class="btn small" data-action="deliver-step" data-key="${enc(r.key)}" data-dest="${enc(dest)}" data-target="${Math.min(1,r.remaining)}" ${deliveryBusy?'disabled':''} aria-label="Bajar una unidad de ${esc(r.product)}">+</button><button class="btn small" data-action="deliverpartial" data-key="${enc(r.key)}" data-dest="${enc(dest)}" ${deliveryBusy?'disabled':''}>Parcial</button></div></div>`).join('')||'<p class="subtle">Este destino no tiene productos por bajar. Puede que aún no haya un proveedor enviado o una compra manual, o que ya esté todo bajado.</p>'}</div></div>`+
 `<div class="card delivery-completed"><div class="sectionline"><h2>Bajados en ${esc(current?.name||'este destino')} (${done.length})</h2>${pill('Deshacer disponible','ok')}</div>${done.length?`<div class="items">${done.map(r=>`<div class="item done"><div class="check">✓</div><div class="grow"><div class="product">${esc(r.allowed)} ${esc(r.product)}</div><div class="details">${esc(r.unit)}</div></div><div class="mini-actions"><button type="button" class="btn small" data-action="deliver-step" data-key="${enc(r.key)}" data-dest="${enc(dest)}" data-target="${-Math.min(1,r.delivered)}" ${deliveryBusy?'disabled':''} aria-label="Quitar una unidad bajada de ${esc(r.product)}">−</button><strong class="delivery-count">${esc(r.delivered)} / ${esc(r.allowed)}</strong><button class="btn small" data-action="undodelivery" data-key="${enc(r.key)}" data-dest="${enc(dest)}" ${deliveryBusy?'disabled':''}>Deshacer todo</button></div></div>`).join('')}</div>`:'<p class="subtle">Aquí aparecen solo las bajadas completadas de este destino.</p>'}</div>`+
 (unready.length?`<div class="card delivery-unready"><div class="sectionline"><h2>Pendiente de comprar o enviar</h2>${pill(unready.length+' sin gestionar','err')}</div><p class="subtle">Estas cantidades forman parte del pedido de ${esc(current?.name||'la tienda')}, pero no están habilitadas para bajar.</p><div class="items">${unready.map(r=>`<div class="item err"><div class="keynum">${r.by[dest]}</div><div class="grow"><div class="product">${esc(r.product)}</div><div class="details">${esc(r.unit)} · Debe comprarse o enviarse al proveedor</div></div></div>`).join('')}</div></div>`:'')+
  (short.length?`<div class="notice amber"><b>Faltantes de ${esc(current?.name||'destino')}</b>${short.map(r=>`<div>Faltan ${r.missing} ${esc(r.product)}</div>`).join('')}</div>`:'');
}
function mas(){return sectionTitle('Más opciones','Cuenta, carga opcional, control y copias de seguridad.')+`<div class="card"><h2>Acciones</h2><div class="tools">${btn('goto','Cuenta y sincronización','cuenta','dark')}${btn('goto','Carga opcional','carga')}${btn('goto','Ver auditoría','auditoria')}${btn('goto','Pegar listas','pedidos')}</div></div>`;}
function auditoria(){
 const x=summary(state),p=deliveryPlan(state);
 const noNames=state.orders.filter(l=>l.review).length;
 const draft=state.allocations.filter(a=>a.status==='draft').length;
 const sent=state.allocations.filter(a=>a.status==='sent').length;
 const awaiting=pendingPurchases(state).filter(r=>r.remainingToBuy>0&&!r.unresolved).length;
 const outstanding=p.eligible.filter(r=>r.remaining>0).length;
 const done=p.eligible.filter(r=>r.remaining===0).length;
 const warnings=[
  [noNames,'Productos pendientes de confirmar nombre o cantidad'],
  [draft,'Líneas asignadas a proveedores, todavía sin envío confirmado'],
  [awaiting,'Productos pendientes de compra manual'],
  [p.needsReview.length,'Compras insuficientes pendientes de distribuir'],
  [p.blocked.length,'Productos bloqueados para reparto por falta de compra o envío']
 ];
 return sectionTitle('Control y seguridad','Resumen de los datos de la jornada. Ninguna acción de este panel cambia cantidades automáticamente.')+
 stats()+
 `<div class="card"><div class="sectionline"><h2>Estado de la jornada</h2>${pill(esc(state.day),'black')}</div><div class="grid"><div class="stat"><b>${sent}</b><span>Pedidos enviados a proveedor</span></div><div class="stat"><b>${done}</b><span>Productos bajados</span></div><div class="stat"><b>${outstanding}</b><span>Pendientes de bajar</span></div></div></div>`+
 `<div class="card"><h2>Incidencias para revisar</h2><div class="items">${warnings.map(([qty,label])=>`<div class="item"><span class="pill ${qty?'err':'ok'}">${qty||'OK'}</span><div class="grow"><b>${esc(label)}</b></div></div>`).join('')}</div></div>`+
 `<div class="card"><h2>Copias de seguridad</h2><p class="subtle">Descarga una copia JSON antes de cambiar de equipo o realizar correcciones importantes. Tus datos no se suben a GitHub.</p><div class="tools">${btn('export','Descargar copia de la jornada','','dark')}${btn('goto','Volver a pedidos','pedidos')}</div></div>`+
 `<div class="card"><h2>Jornada nueva</h2><p class="subtle">Archiva movimientos y conserva el diccionario, proveedores y restaurantes. Antes de limpiar se descarga una copia.</p>${btn('newday','Archivar y comenzar otro día','','small red')}</div>`;
}
function render(){
 const drafts={};document.querySelectorAll('textarea').forEach(t=>{if(t.id&&t.value)drafts[t.id]=t.value;});
 const app=document.getElementById('app');if(!app)return;
 if(CLOUD_ENABLED&&!cloudUser){app.innerHTML=`<div class="auth-page">${cloudStatus==='conectando'?`<div class="auth-working"><span class="auth-logo">${uiIcon('purchases',38)}</span><h1>ARSLAN LISTAS NEXT</h1><p>Comprobando sesión guardada…</p></div>`:cloudPanel()}</div>`;return;}
 if(CLOUD_ENABLED&&!accessUnlocked){app.innerHTML=`<div class="auth-page">${accessGate()}</div>`;return;}
 let screenHTML='';try{const view=({inicio:home,pedidos,global:globalView,compras,carga,reparto,mas,cuenta:accountView,auditoria})[tab];if(!view)throw Error('Pantalla no disponible');screenHTML=view();}
 catch(error){console.error('Error al abrir sección de LISTAS:',tab,error);screenHTML=`<div class="card"><h2>No se pudo abrir ${esc(tab)}</h2><div class="notice red">${esc(error?.message||'Error de datos. No se ha borrado nada.')}</div><div class="tools">${btn('goto','Volver a Inicio','inicio','dark')}${btn('export','Descargar copia JSON','','small')}</div></div>`;}
 app.innerHTML=`<div class="top"><div class="top-inner"><div class="brand"><span class="logo">${uiIcon('purchases',24)}</span><span><strong>ARSLAN LISTAS NEXT</strong><span class="subtitle">Pedidos, compras y reparto</span></span></div>${syncBadge()}<button type="button" class="top-more" data-action="goto" data-key="mas" aria-label="Más opciones" title="Más opciones">···</button></div></div><div class="shell">${nav()}<main><div id="operation-indicator" class="operation-indicator" role="status" aria-live="polite" hidden></div>${toastMessage?`<div class="notice ${toastMessage.startsWith('ERROR')?'red':'green'}">${esc(toastMessage)}</div>`:''}${screenHTML}</main></div>`;
 Object.entries(drafts).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.value=value;});
}
function download(name,text,type='text/plain'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}

/** Bajadas de un toque con verificación atómica en la versión más reciente.
 * Una operación concurrente sobre la misma fila no se aplica dos veces.
 */
/** Cada + / − guarda directamente: nunca marca como comprado el incremento. */
/** Feedback inmediato de + / − y Bajar sin reconstruir toda la pantalla.
 * La entrega se confirma SOLO cuando Firebase acepta la transacción. */
function setOperationBusy(busy,label='Guardando cambio en Firebase…'){
 const banner=document.getElementById('operation-indicator');
 if(banner){banner.hidden=!busy;if(busy)banner.textContent=label;}
 for(const el of document.querySelectorAll('[data-action="deliver"],[data-action="deliver-step"],[data-action="undodelivery"],[data-action="deliverpartial"],[data-action="destqty"]')){
  if(busy){
   if(!el.disabled){el.disabled=true;el.dataset.temporaryBusy='1';}
   el.setAttribute('aria-busy','true');
  }else{
   if(el.dataset.temporaryBusy==='1'){el.disabled=false;delete el.dataset.temporaryBusy;}
   el.removeAttribute('aria-busy');
  }
 }
}

async function changeDemandOneTap(key,dest,rawDelta){
 if(deliveryBusy)throw Error('Ya hay un cambio en curso. Comprueba la lista.');
 const row=totals(state).find(r=>r.key===key);
 if(!row)throw Error('Producto no encontrado; actualiza Compras');
 const delta=Number(String(rawDelta).replace(',','.'));
 if(!Number.isFinite(delta)||delta===0)throw Error('Cantidad inválida');
 const expected=row.by[dest]||0;
 if(!CLOUD_ENABLED){
  const result=adjustDestinationDemand(state,key,dest,delta,{expectedQuantity:expected,day:state.day,historyLength:state.history.length});
  if(result.changed)commit(''); // El total visible cambia sin insertar avisos que muevan las filas del iPhone
  else{toastMessage='Sin cambios';render();}
  return;
 }
 if(!cloudAdapter||!cloudEngine||!cloudUser||cloudStatus!=='sincronizado'||cloudEngine.dirty||cloudEngine.conflict)
  throw Error('La nube debe estar SINCRONIZADA para cambiar cantidades del equipo. No se ha alterado el pedido.');
 if(typeof navigator!=='undefined'&&!navigator.onLine)
  throw Error('Sin internet. No se ha actualizado el pedido compartido.');
 const operation={key,dest,delta,expectedQuantity:expected,day:state.day,historyLength:(state.history||[]).length};
 deliveryBusy=true;toastMessage='';setOperationBusy(true,'Actualizando cantidad en Firebase…');
 try{
  const result=await cloudAdapter.mutateDemand(operation);
  if(!result?.document)throw Error('Firebase no confirmó la cantidad; no se hizo ningún cambio local');
  if(!cloudEngine.dirty&&!cloudEngine.conflict)cloudEngine.applyConfirmedDocument(result.document);
  else await cloudEngine.refresh();
  toastMessage=result.changed?'':
   result.code==='MODIFICADO_POR_OTRO'?'Otra persona actualizó este producto. Ya ves la cantidad nueva.':
   result.code==='JORNADA_CAMBIADA'?'La jornada ha cambiado. No se modificó la cantidad.':
   'No se modificó el producto; revisa la cantidad actual.';
 }finally{deliveryBusy=false;setOperationBusy(false);render();}
}

async function processDeliveryClick(action,key,dest,qty=null){
 if(deliveryBusy){toastMessage='Ya se está guardando otra bajada. Comprueba su resultado.';render();return;}
 const row=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest);
 if(!row)throw Error('Producto no disponible para bajar. Actualiza el reparto.');
 if(!CLOUD_ENABLED){
  if(action==='deshacer')undoDelivery(state,key,dest);
  else if(action==='ajustar'){
   const current=deliveredFor(state,key,dest);
   const delta=Number(qty);
   if(!Number.isFinite(delta)||!delta||current+delta<0||current+delta>row.allowed)throw Error('Cantidad de bajada fuera de rango');
   if(delta>0)deliver(state,key,dest,delta);
   else{
    let left=fix(-delta);
    for(const location of Object.keys(state.delivery||{}).reverse()){
     const at=location.lastIndexOf('@');
     if(at<0||location.slice(at+1)!==dest||!sameProductKey(state,location.slice(0,at),key))continue;
     const take=Math.min(left,Number(state.delivery[location])||0);
     const next=fix((Number(state.delivery[location])||0)-take);
     if(next>0)state.delivery[location]=next;else delete state.delivery[location];
     left=fix(left-take);if(left<=0)break;
    }
   }
  }else deliver(state,key,dest,qty);
  commit(action==='deshacer'?'Bajada deshecha':action==='ajustar'?'Cantidad bajada ajustada':'Bajada guardada en este dispositivo');
  return;
 }
 if(!cloudAdapter||!cloudEngine||!cloudUser||cloudStatus!=='sincronizado'||cloudEngine.dirty||cloudEngine.conflict)
  throw Error('Conecta Firebase y espera a que el estado sea SINCRONIZADO antes de bajar. No se ha marcado nada.');
 if(typeof navigator!=='undefined'&&!navigator.onLine)
  throw Error('Sin conexión. Para evitar duplicados, las bajadas compartidas requieren confirmar Firebase.');
 deliveryBusy=true;toastMessage='';setOperationBusy(true,'Confirmando bajada con Firebase…');
 try{
  const op={action,key,dest,quantity:qty,expectedDelivered:row.delivered,expectedAllowed:row.allowed,
   day:state.day,historyLength:(state.history||[]).length};
  const result=await cloudAdapter.mutateDelivery(op);
  if(!result?.document)throw Error('Firebase no ha confirmado el estado actual');
  if(!cloudEngine.dirty&&!cloudEngine.conflict)cloudEngine.applyConfirmedDocument(result.document);
  else await cloudEngine.refresh();
  const reason={CANTIDAD_INSUFICIENTE:'Cantidad insuficiente. Comprueba la bajada actual.',CANTIDAD_INVALIDA:'Cantidad de bajada inválida.',MODIFICADO_POR_OTRO:'Ya lo cambió otra persona; lista actualizada sin duplicar la bajada.',
   YA_BAJADO:'Ya estaba bajado. La lista se ha actualizado.',JORNADA_CAMBIADA:'Se ha cambiado de jornada; no se guardó esta bajada.',
   CANTIDAD_ACTUALIZADA:'Otro usuario cambió la cantidad disponible; revisa la lista.',
   NO_HABILITADO:'La mercancía ya no está habilitada para repartir.'};
  toastMessage=result.changed?
   (action==='deshacer'?'Bajada deshecha y sincronizada con el equipo':action==='ajustar'?'Cantidad bajada ajustada en Firebase':'Bajada confirmada en Firebase · progreso actualizado'):
   (reason[result.code]||'Otro repartidor cambió esta línea. Comprueba la lista.');
 }finally{deliveryBusy=false;setOperationBusy(false);render();}
}

async function handleAction(action,key,target,dest){
 try{
 const readonly=['unlock-access','lock-access','goto','export','copy','copyall','provdownload','provdownloadall','whatsapp','destcopy','destdownload','destwa','purchasefilter','breakdown','filter','selprov','purchase-step','additional-step','order-open','order-filter','toggle-paste','goto-additional','delivery-select','manual-copy-pending','manual-download-pending','manual-wa-pending'];
 if(deliveryBusy&&!readonly.includes(action)&&!action.startsWith('cloud-')&&!action.startsWith('team-'))throw Error('Guardando el último cambio en Firebase.');
 if(CLOUD_ENABLED&&!action.startsWith('cloud-')&&!action.startsWith('team-')&&!readonly.includes(action)&&!cloudCanEdit())throw Error('Para guardar cambios debes entrar y tener sincronización lista. Revisa el estado de la nube en Inicio.');
 switch(action){
 case 'unlock-access':{if(!cloudUser)throw Error('Debes iniciar sesión en Firebase');accessUnlocked=true;tab=['permiso_denegado','conflicto','error'].includes(cloudStatus)?'cuenta':'inicio';toastMessage='';render();return;}
 case 'lock-access':{accessUnlocked=false;toastMessage='';render();return;}
 case 'team-copy-id':{if(!cloudUser)throw Error('Inicia sesión primero');const ok=await copyText(cloudUser.id);toastMessage=ok?'ID copiado para autorizar el equipo':'No se pudo copiar el ID';render();return;}
 case 'team-add':{if(!cloudUser)throw Error('Inicia sesión');const id=document.getElementById('team-member-id')?.value.trim();await cloudAdapter.addMember(id);teamMembers=await cloudAdapter.listMembers();toastMessage='Trabajador autorizado. Ya puede usar tu espacio de LISTAS.';render();return;}
 case 'team-revoke':{if(!cloudUser)throw Error('Inicia sesión');if(!confirm('¿Retirar acceso a este trabajador? No se borrarán los pedidos ni las bajadas.'))return;await cloudAdapter.revokeMember(key);teamMembers=await cloudAdapter.listMembers();toastMessage='Acceso retirado, sin borrar la jornada';render();return;}
 case 'team-join':{if(!cloudUser||!cloudAdapter)throw Error('Inicia sesión');const owner=document.getElementById('team-owner-id')?.value.trim();if(!/^[a-zA-Z0-9]{16,128}$/.test(owner))throw Error('ID de propietario inválido');if(owner===teamOwnerUid){toastMessage='Ya estás en este espacio de equipo';render();return;}if(cloudEngine?.dirty||cloudEngine?.conflict||cloudEngine?.running)throw Error('Hay cambios por guardar. No se cambia de equipo mientras haya modificaciones pendientes');if(!confirm('¿Cambiar de espacio? Se descargará antes una copia de esta jornada. Los datos existentes no se borrarán.'))return;download('ARSLAN_LISTAS_COPIA_ANTES_CAMBIAR_EQUIPO.json',JSON.stringify(state,null,2),'application/json');localStorage.setItem(KEY+':team:'+cloudUser.id,owner);const user={uid:cloudUser.id,email:cloudUser.email};if(cloudEngine)cloudEngine.stop();cloudEngine=null;cloudUser=null;await beginCloudUser(user);toastMessage='Espacio de equipo seleccionado. Solo verás datos si el propietario te ha autorizado.';render();return;}
 case 'cloud-login':case 'cloud-signup':case 'cloud-reset': {const email=document.getElementById('cloud-email')?.value?.trim(),password=document.getElementById('cloud-password')?.value||'';if(!email||!email.includes('@'))throw Error('Introduce un correo válido');if(action==='cloud-reset'){await cloudAdapter.resetPassword(email);toastMessage='Correo de recuperación solicitado; revisa tu buzón';}else if(action==='cloud-signup'){await cloudAdapter.signUp(email,password);accessUnlocked=true;toastMessage='Cuenta creada: confirma los permisos de Firebase';}else{await cloudAdapter.sendLogin(email,password);accessUnlocked=true;try{localStorage.setItem('arslan_listas_last_email',email)}catch{}toastMessage='Sesión iniciada';}render();return;}
 case 'cloud-refresh': {if(!cloudEngine)throw Error('Sin sesión');await cloudEngine.refresh(true);toastMessage='Sincronización comprobada: '+cloudMessage;render();return;}
 case 'cloud-init': {if(!confirm('¿Subir los datos de este dispositivo a la nube nueva? Antes se descargará una copia JSON. Comprueba que estás en el ordenador que tiene los pedidos buenos.'))return;download('ARSLAN_LISTAS_COPIA_ANTES_DE_SUBIR.json',JSON.stringify(state,null,2),'application/json');await cloudEngine.initializeFromLocal();render();return;}
 case 'cloud-use-remote': {if(!cloudEngine?.conflict)throw Error('No hay conflicto');if(!confirm('¿Usar la versión de la nube? Antes se descargará la versión LOCAL para recuperarla si lo necesitas.'))return;download('ARSLAN_COPIA_LOCAL_ANTES_DE_CAMBIAR.json',JSON.stringify(state,null,2),'application/json');await cloudEngine.useRemote();render();return;}
 case 'cloud-publish-local': {if(!cloudEngine?.conflict)throw Error('No hay conflicto');if(!confirm('ATENCIÓN: sustituirás la versión REMOTA por esta versión local. Se descargará primero una copia de la nube. ¿Confirmas?'))return;download('ARSLAN_COPIA_NUBE_ANTES_DE_CAMBIAR.json',JSON.stringify(cloudEngine.conflict.remote.data,null,2),'application/json');await cloudEngine.publishLocal();render();return;}
 case 'cloud-logout': {if(!cloudAdapter)return;await cloudAdapter.signOut();return;}
 case 'cloud-legacy-export': {const old=localStorage.getItem(KEY);if(!old)throw Error('No hay copia local antigua');download('ARSLAN_LISTAS_COPIA_NAVEGADOR.json',old,'application/json');return;}
 case 'cloud-backup': {download('ARSLAN_LISTAS_COPIA_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');return;}
 case 'cloud-choose-import': {if(!cloudEngine||cloudStatus==='conectando'||cloudStatus==='error')throw Error('Primero conecta la cuenta Firebase');document.getElementById('cloud-import-file')?.click();return;}
 case 'cloud-import-local': {if(!cloudEngine||!cloudCanEdit())throw Error('Primero conecta a la nube');const legacy=JSON.parse(localStorage.getItem(KEY)||'null');if(!legacy||!Array.isArray(legacy.orders))throw Error('No hay datos locales anteriores');if(state.orders.length||state.allocations.length||state.manual.length||Object.keys(state.delivery||{}).length)throw Error('Esta cuenta ya tiene una jornada con datos; exporta antes y no sobreescribas sin revisarlos');if(!confirm('¿Importar la copia anterior de este navegador? Verifica la fecha, tiendas y cantidades antes de confirmar. Se descargará una copia y no se sustituirá una jornada con pedidos.'))return;download('ARSLAN_COPIA_LOCAL_PREVIA.json',JSON.stringify(legacy,null,2),'application/json');state=normalizeRuntimeState(legacy);commit('Datos anteriores importados; sincronizando con la nube');return;}

 case 'goto':tab=key;toastMessage='';render();try{window.scrollTo({top:0,behavior:'instant'});}catch{}return;
 case 'purchasefilter':purchaseView=['pending','supplier','manual','all'].includes(key)?key:'pending';render();return;
 case 'additional-step':{
  const input=[...document.querySelectorAll('[data-additional-qty]')].find(el=>el.dataset.additionalKey===key);
  if(!input)throw Error('No está disponible la cantidad adicional');
  const delta=Number(String(target).replace(',','.')),value=Number(String(input.value).replace(',','.'));
  if(!Number.isFinite(delta)||!delta)throw Error('Ajuste inválido');
  input.value=String(fix(Math.max(0,(Number.isFinite(value)?value:0)+delta))).replace('.',',');
  purchaseDrafts['additional:'+key]=input.value;return;
 }
 case 'additional-buy':{
  const row=additionalPurchaseRows(state).find(r=>r.key+'@'+r.dest===key);
  if(!row||row.pending<=0)throw Error('Esta ampliación ya está cubierta; comprueba Reparto');
  const input=[...document.querySelectorAll('[data-additional-qty]')].find(el=>el.dataset.additionalKey===key);
  const amount=Number(String(input?.value??row.pending).replace(',','.'));
  if(!Number.isFinite(amount)||amount<=0||amount>row.pending+1e-8)throw Error('La cantidad debe ser positiva y no superar lo que falta del pedido adicional');
  const prev=state.manual.length;
  manualBuySafe(state,row.key,amount);
  if(state.manual.length!==prev+1)throw Error('La compra adicional no quedó registrada');
  state.manual[state.manual.length-1].additionalDest=row.dest;
  state.manual[state.manual.length-1].kind='compra-adicional';
  state.manual[state.manual.length-1].createdAt=new Date().toISOString();
  delete purchaseDrafts['additional:'+key];
  commit('Compra adicional registrada para '+destName(row.dest)+'; reparto habilitado sin reenviar proveedor');return;
 }
 case 'additional-undo':{
  const row=additionalPurchaseRows(state).find(r=>r.key+'@'+r.dest===key);
  if(!row||!(row.purchased>0))throw Error('No hay compra adicional que deshacer');
  if(deliveredFor(state,row.key,row.dest)>row.original+1e-8)throw Error('Esta ampliación ya tiene mercancía bajada. Deshaz primero las bajadas adicionales.');
  if(!confirm('¿Deshacer la compra adicional de '+row.purchased+' '+row.product+' de '+destName(row.dest)+'? Las cantidades del proveedor no se modifican.'))return;
  const previous=state.manual.length;
  reverseManualPurchase(state,row.key,row.purchased);
  if(state.manual.length!==previous+1)throw Error('No se registró la reversión');
  state.manual[state.manual.length-1].additionalDest=row.dest;
  state.manual[state.manual.length-1].kind='reversion-adicional';
  commit('Compra adicional deshecha con historial; no se alteró el pedido original');return;
 }
 case 'purchase-step': {
  const [mode,stepString]=target.split(':'),step=Number(stepString);
  if(!['pending','manual'].includes(mode)||![-1,1].includes(step))throw Error('Control de cantidad inválido');
  const input=[...document.querySelectorAll('[data-purchase-qty]')].find(el=>el.dataset.purchaseKey===key&&el.dataset.purchaseMode===mode);
  if(!input)throw Error('No se encontró el campo de cantidad');
  const n=Number(String(input.value).replace(',','.'));
  const next=fix(Math.max(0,(Number.isFinite(n)?n:0)+step));
  input.value=String(next).replace('.',',');purchaseDrafts[mode+':'+key]=input.value;return;
 }
 case 'purchase-toggle':case 'purchase-confirm':case 'purchase-undo':case 'purchase-save': {
  const row=pendingPurchases(state).find(r=>r.key===key);
  if(!row)throw Error('Producto no encontrado');
  const undo=action==='purchase-undo'||(action==='purchase-toggle'&&target==='manual');
  if(undo){if(additionalPurchaseRows(state).some(r=>r.key===key&&r.purchased>0))throw Error('Compra reservada para un destino. Deshazla desde Pedidos adicionales para no alterar el reparto.');reverseManualPurchase(state,key);delete purchaseDrafts['manual:'+key];purchaseView='pending';commit('Compra manual DESMARCADA. Ahora vuelve a pendientes; no se borraron los movimientos.');return;}
  if(action==='purchase-save'&&additionalPurchaseRows(state).some(r=>r.key===key&&r.purchased>0))throw Error('Producto con compra adicional reservada. Corrige su cantidad desde Pedidos adicionales.');
  const mode=action==='purchase-save'?'manual':'pending';
  const wanted=purchaseQtyFromInput(key,mode);
  if(mode==='pending'){
   if(!(wanted>0))throw Error('Marca una cantidad positiva antes de confirmar la compra');
   const removeDraft=row.assignedDraft>0&&wanted>row.remainingToBuy&&confirm('Parte del producto está en un borrador de proveedor. ¿Reducir ese borrador para no duplicar compra?');
   const allowExtra=row.authorized+wanted>row.total+1e-8;
   if(allowExtra&&!confirm('La cantidad supera el pedido. ¿Confirmas una compra EXTRA real?'))return;
   manualBuySafe(state,key,wanted,{removeDraft,allowExtra});
   delete purchaseDrafts['pending:'+key];delete purchaseDrafts['manual:'+key];
   purchaseView='pending';commit(`✓ Comprado manualmente ${wanted} ${row.product}. Se mueve abajo.`);return;
  }
  if(wanted>row.manuallyBought){
   const delta=fix(wanted-row.manuallyBought);
   const extra=row.authorized+delta>row.total+1e-8;
   if(extra&&!confirm('La cantidad comprada supera el pedido. ¿Confirmas el EXTRA?'))return;
   setManualPurchaseTotal(state,key,wanted,{allowExtra:extra});
  }else setManualPurchaseTotal(state,key,wanted);
  delete purchaseDrafts['manual:'+key];
  commit(wanted===0?'Compra manual desmarcada; vuelve a pendientes':'Cantidad manual actualizada: '+wanted+' '+row.product);return;
 }
 case 'manual-undo-all': {
  if(additionalPurchaseRows(state).some(r=>r.purchased>0))throw Error('Hay compras adicionales reservadas por restaurante. Deshazlas individualmente en Pedidos adicionales.');
  const products=pendingPurchases(state).filter(r=>r.manuallyBought>0);
  if(!products.length)throw Error('No hay compras manuales para deshacer');
  if(!confirm('¿DESHACER las compras manuales de '+products.length+' productos? Se conservarán los pedidos, proveedores e historial. Las bajadas realizadas no se alterarán.'))return;
  const undone=reverseAllManualPurchases(state);
  for(const k of Object.keys(purchaseDrafts))delete purchaseDrafts[k];
  purchaseView='pending';commit('Se han desmarcado '+undone+' productos de compra manual. Vuelven a pendientes.');return;
 }
 case 'manual-copy-pending':case 'manual-download-pending':case 'manual-wa-pending': {
  const pendingText=pendingManualPurchaseTXT(state);
  if(!pendingText)throw Error('No hay compras manuales pendientes para exportar. Comprueba los productos en rojo.');
  if(action==='manual-copy-pending'){
   const ok=await copyText(pendingText);toastMessage=ok?'TXT de compras pendientes copiado':'No se pudo copiar: descarga el TXT';render();return;
  }
  if(action==='manual-download-pending'){download('COMPRAS_MANUALES_PENDIENTES_'+state.day+'.txt',pendingText);return;}
  window.open(pendingManualPurchaseWhatsApp(state).url,'_blank','noopener');
  toastMessage='WhatsApp preparado solo con lo pendiente. El envío es manual y NO marca nada como comprado.';render();return;
 }
 
  case 'goto-additional':purchaseView='additional';tab='compras';toastMessage='';render();return;
 case 'delivery-select':selectedDeliveryDest=key;render();return;
 case 'order-filter':orderView=key;render();return;
 case 'order-open':expandedOrderDest=expandedOrderDest===key?'':key;render();return;
 case 'toggle-paste':{const p=document.getElementById('bulkPaste');if(p){p.open=true;p.scrollIntoView({behavior:'smooth',block:'start'});}return;}
 case 'filter':filter=key;render();return;
 case 'selprov':supplier=key;render();return;
 case 'destqty':{await changeDemandOneTap(key,dest,target);return;}
 case 'breakdown':expandedPurchaseKey=expandedPurchaseKey===key?'':key;render();return;
 case 'newdest':{const name=prompt('Nombre del nuevo restaurante:');if(name===null)return;const d=addDestination(state,name,'restaurante');orderView='all';expandedOrderDest=d.id;editingDestination=d.id;commit('Restaurante '+d.name+' creado, sin pedido todavía');document.querySelector(`[data-destination=\"${d.id}\"]`)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 case 'destedit':editingDestination=editingDestination===key?'':key;expandedOrderDest=key;render();if(editingDestination)document.querySelector(`[data-destination=\"${editingDestination}\"]`)?.scrollIntoView({behavior:'smooth',block:'start'});return;
 case 'destadd':{const d=state.destinations.find(x=>x.id===key);if(!d)throw Error('Destino desconocido');const v=document.getElementById('destorder-'+key)?.value?.trim();if(!v)throw Error('Introduce al menos un producto');const header='PEDIDO '+(key==='SP'||key==='SL'||key==='ST'?key:display(d.name));const r=importBlocks(state,header+'\n'+v);editingDestination='';commit(`Añadidas ${r.imported} líneas a ${d.name}`);return;}
 case 'destcopy':{const t=destinationTXT(state,key);if(!t)throw Error('Este destino aún no tiene pedido');const ok=await copyText(t);toastMessage=ok?'Pedido de '+destName(key)+' copiado':'No se pudo copiar. Descarga TXT';render();return;}
 case 'destdownload':{const t=destinationTXT(state,key);if(!t)throw Error('Este destino aún no tiene pedido');download('PEDIDO_'+canonical(destName(key)).replaceAll(' ','_')+'_'+state.day+'.txt',t);return;}
 case 'destwa':{const t=destinationWhatsApp(state,key);if(!t.text)throw Error('Este destino aún no tiene pedido');window.open(t.url,'_blank','noopener');toastMessage='WhatsApp preparado con el pedido de '+destName(key)+'; debes enviarlo tú';render();return;}
 case 'import':case 'replace':{
  const val=document.getElementById('paste').value.trim();if(!val)throw Error('Pega una lista con encabezado PEDIDO SL / SP / ST / BRASEROS CENTRO / RIVIERA');
  if(action==='replace'&&!confirm('¿Sustituir las listas de los destinos incluidos? Si ya empezaste compras o reparto no se permitirá.'))return;
  const result=importBlocks(state,val,{replace:action==='replace'});commit(`Importadas ${result.imported} líneas. ${result.issues.length?'Avisos: '+result.issues.join('; '):'Sin incidencias en encabezados.'}`);return;}
 case 'suggest':confirmProduct(state,key,target,{remember:true});commit('Producto confirmado; corrección recordada');return;
 case 'create':{
  const l=state.orders.find(x=>x.id===key);if(!l)throw Error('Línea no encontrada');const name=prompt('Nombre del nuevo producto, con variedad y calibre:',l.sourceName);if(name===null)return;confirmProduct(state,key,name,{create:true,remember:true});commit('Producto creado en el catálogo para próximas listas');return;}
 case 'editname':{
  const l=state.orders.find(x=>x.id===key);const name=prompt('Nombre correcto del producto:',l?.product||'');if(name===null)return;confirmProduct(state,key,name,{create:confirm('Si no existe, ¿quieres crear el producto nuevo?'),remember:true});commit('Producto corregido');return;}
 case 'qty':{const l=state.orders.find(x=>x.id===key);const input=prompt('Cantidad correcta:',l?.q??'');if(input===null)return;setQuantity(state,key,input);commit('Cantidad actualizada');return;}
 case 'assign':{quickAssign(state,key,supplier);filter='pending';commit('Asignado a '+supplier+'; sale de Sin asignar y entra en su lista');return;}
 case 'unassign':{const entries=state.allocations.filter(a=>a.key===key&&a.status==='draft');if(!entries.length)throw Error('No hay borrador que quitar');state.allocations=state.allocations.filter(a=>a.key!==key||a.status!=='draft');filter='pending';commit('Producto devuelto a Sin asignar');return;}
 case 'copy':case 'copyall':{const t=action==='copy'?supplierDraftTXT(state,key):supplierTXT(state,key);if(!t)throw Error('No hay productos para copiar');const ok=await copyText(t);toastMessage=ok?'TXT copiado':'No se pudo copiar. Descarga TXT';render();return;}
 case 'provdownload':case 'provdownloadall':{const t=action==='provdownload'?supplierDraftTXT(state,key):supplierTXT(state,key);if(!t)throw Error('No hay pedido para descargar');download('PEDIDO_'+canonical(key).replaceAll(' ','_')+'_'+(action==='provdownload'?'PENDIENTE_':'')+state.day+'.txt',t);return;}
 case 'whatsapp':{const t=supplierDraftWhatsApp(state,key);if(!t.text)throw Error('No hay líneas pendientes de envío');window.open(t.url,'_blank','noopener');toastMessage='WhatsApp preparado solo con lo no enviado. Confirma el envío al regresar.';render();return;}
 case 'sent':{if(!confirm('¿Confirmas que has enviado realmente el pedido a '+key+'? Abrir WhatsApp no cuenta como envío hasta que lo confirmes.'))return;const packet=markSupplierSent(state,key);commit(`Confirmado como ENVIADO a ${key}: ${packet.text.split('\n').length} líneas. No se envía automáticamente.`);return;}
 case 'reopensent':{if(!confirm('¿Reabrir como SIN ENVIAR las líneas marcadas enviadas a '+key+'? Si ya se bajó mercancía se bloqueará.'))return;reopenSupplierSent(state,key);commit('Marcado SIN ENVIAR de nuevo para '+key);return;}
 case 'buyall':{
  const extra=new Map();for(const r of additionalPurchaseRows(state))extra.set(r.key,fix((extra.get(r.key)||0)+r.pending));
  const rows=pendingPurchases(state).map(r=>({...r,remainingToBuy:fix(Math.max(0,r.remainingToBuy-(extra.get(r.key)||0)))})).filter(r=>!r.unresolved&&r.remainingToBuy>0);
  if(!rows.length)throw Error('No quedan compras normales pendientes. Revisa Pedidos adicionales.');
  const keyword=prompt(`Marcar ${rows.length} productos NORMALES como comprados (sin ampliaciones). Escribe COMPRAR para confirmar:`);
  if(keyword!=='COMPRAR')return;
  const copy=structuredClone(state);for(const r of rows)manualBuySafe(copy,r.key,r.remainingToBuy);
  state.manual=copy.manual;state.allocations=copy.allocations;for(const k of Object.keys(purchaseDrafts))delete purchaseDrafts[k];
  commit(`${rows.length} productos normales comprados manualmente; ampliaciones intactas.`);return;
 }
 case 'buy':{const r=pendingPurchases(state).find(x=>x.key===key);if(!r)throw Error('Producto inexistente');const q=r.remainingToBuy;if(q<=0)throw Error('Ya cubierto por proveedor o compra manual; evita comprarlo otra vez');manualBuySafe(state,key,q);commit(`Comprado manualmente: solo ${q} ${r.product} que faltaban`);return;}
 case 'buyedit':{const r=pendingPurchases(state).find(x=>x.key===key);if(!r)throw Error('Producto inexistente');const val=prompt('Cantidad REAL de compra manual, evitando lo cubierto por proveedor:',String(r.remainingToBuy));if(val===null)return;const q=Number(val.replace(',','.'));if(!(q>0))throw Error('Introduce una cantidad positiva');const removeDraft=r.assignedDraft>0&&q>r.remainingToBuy&&confirm('¿Quieres reducir expresamente el borrador de proveedor en la cantidad adicional que compras?');if(r.assignedDraft>0&&q>r.remainingToBuy&&!removeDraft)return;const allowExtra=r.authorized+q>r.total+1e-8;if(allowExtra&&!confirm('Atención: esta compra excede lo pedido. ¿Confirmas una compra EXTRA real?'))return;manualBuySafe(state,key,q,{removeDraft,allowExtra});commit('Compra manual confirmada; sin duplicar proveedor');return;}
 case 'load':{const r=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest);if(!r)throw Error('Producto no habilitado');loadItem(state,key,dest,r.allowed);commit('Marcado como cargado; el reparto sigue siendo independiente');return;}
 case 'deliver':{await processDeliveryClick('bajar',key,dest);return;}
 case 'deliver-step':{
  const delta=Number(String(target).replace(',','.'));
  if(!Number.isFinite(delta)||!delta)throw Error('Ajuste de bajada inválido');
  await processDeliveryClick('ajustar',key,dest,delta);
  return;
 }
 case 'deliverpartial':{const r=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest&&x.remaining>0);if(!r)throw Error('No está pendiente');const q=prompt(`Cantidad parcial a bajar de ${r.product}, máximo ${r.remaining}:`,String(r.remaining));if(q===null)return;await processDeliveryClick('bajar',key,r.dest,Number(q.replace(',','.')));return;}
 case 'undodelivery':{const rr=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest&&x.delivered>0);if(!rr)return;await processDeliveryClick('deshacer',key,rr.dest);return;}
 case 'shortage':{const r=deliveryPlan(state).needsReview.find(x=>x.key===key);if(!r)return;const inputs={};let available=r.authorized;for(const [d,need] of Object.entries(r.by)){
   const v=prompt(`${r.product}: hay ${available} para repartir. ¿Cuánto reservar para ${destName(d)}? (pidió ${need})`,String(Math.min(need,available)));
   if(v===null)return;const n=Number(v.replace(',','.'));inputs[d]=n;available=fix(available-n);
  }
  planShortage(state,key,inputs);commit('Reparto de compra parcial confirmado');return;}
 case 'extra':{const r=surplus(state).find(x=>x.key===key);if(!r)return;const q=distributeSurplus(r.extra);alert(`Propuesta sobre el EXTRA de ${r.extra} ${r.unit}:\nSAN PABLO ${q.SP}\nSAN LESMES ${q.SL}\nSANTIAGO ${q.ST}\nEsta vista sólo audita el reparto; no añade líneas extra automáticamente.`);return;}
 case 'rider':{const n=prompt(`Repartidor de ${destName(key)}:`,state.riderAssignments?.[key]||'');if(n===null||!n.trim())return;assignRider(state,key,n);commit('Repartidor asignado');return;}
 case 'clearday':{const hasActivity=Boolean(state.orders.length||state.allocations.length||state.manual.length||state.receipts.length||Object.keys(state.delivery||{}).length||Object.keys(state.load||{}).length||Object.keys(state.shortageAllocation||{}).length||Object.keys(state.riderAssignments||{}).length||(state.sentMessages||[]).length);if(!hasActivity){toastMessage='Esta jornada ya está vacía. Puedes pegar pedidos nuevos.';render();return;}const confirmed=confirm('LIMPIAR DÍA\n\nSe archivarán los pedidos actuales, asignaciones, compras, envíos, carga y bajadas.\n\nSe conservan productos, restaurantes, proveedores, nombres aprendidos e historial.\n\nSe descargará primero una copia de esta jornada. ¿Continuar?');if(!confirmed)return;const token=prompt('Para evitar un borrado accidental escribe LIMPIAR:','');if(token!=='LIMPIAR')return;download('ARSLAN_LISTAS_ANTES_LIMPIAR_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');const today=new Date();const d=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');newDay(state,d);tab='inicio';commit('Día limpiado y archivado. Ya puedes introducir pedidos nuevos; los productos y restaurantes siguen guardados.');return;}
 case 'newday':{if(!confirm('¿Archivar la jornada actual y empezar otra? Se descargará una copia antes de cambiar.'))return;download('ARSLAN_LISTAS_ANTES_NUEVO_DIA_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');const today=new Date();const d=prompt('Fecha de la nueva jornada (AAAA-MM-DD):',[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'));if(!d)return;newDay(state,d);tab='inicio';commit('Jornada nueva creada; catálogo y restaurantes conservados');return;}
 case 'export':download('ARSLAN_LISTAS_JORNADA_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');return;
 default:return;}
 }catch(e){toastMessage='ERROR: '+(e?.message||String(e));render();}
}
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.item[role=button][data-action=assign]')){e.preventDefault();handleAction('assign',dec(e.target.dataset.key),'','');}});
document.addEventListener('change',async e=>{
 if(e.target.id==='deliveryDestination'){selectedDeliveryDest=e.target.value;render();return;}
 if(e.target.id==='cloud-import-file'){
  try{
   if(!cloudEngine)throw Error('Debes iniciar sesión en Firebase primero');
   if(!['sincronizado','importar'].includes(cloudStatus))throw Error('Resuelve primero las sincronizaciones pendientes o conflictos');
   const file=e.target.files?.[0];if(!file)return;
   if(file.size>8_000_000)throw Error('Archivo demasiado grande; revisa la copia');
   const data=JSON.parse(await file.text());
   if(!data||typeof data!=='object'||!Array.isArray(data.orders)||!Array.isArray(data.destinations)||!Array.isArray(data.catalog)||typeof data.day!=='string')throw Error('No es una copia de jornada válida');
   if(state.orders.length||state.allocations?.length||state.manual?.length||Object.keys(state.delivery||{}).length)throw Error('Ya hay pedidos en la nube. No importamos encima: primero guarda copia y revisa la jornada');
   if(!confirm('¿Importar '+data.orders.length+' líneas desde el JSON? Se descargará primero una copia del estado actual.'))return;
   download('ARSLAN_LISTAS_ANTES_DE_IMPORTAR.json',JSON.stringify(state,null,2),'application/json');
   state=data;
   if(cloudStatus==='importar'){cloudEngine.apply(state);cloudEngine.hasLocal=true;cloudMessage='Copia cargada en este dispositivo. Pulsa SUBIR LOS DATOS para guardarla en Firebase.';render();}
   else commit('Copia importada; guardando en Firebase');
  }catch(err){toastMessage='ERROR AL IMPORTAR: '+(err?.message||err);render();}
 }
});
document.addEventListener('input',e=>{if(e.target.matches('[data-additional-qty]'))purchaseDrafts['additional:'+e.target.dataset.additionalKey]=e.target.value;if(e.target.matches('[data-purchase-qty]'))purchaseDrafts[e.target.dataset.purchaseMode+':'+e.target.dataset.purchaseKey]=e.target.value;if(e.target.id==='searchRows'){const word=canonical(e.target.value);document.querySelectorAll('.searchable').forEach(el=>{el.hidden=!canonical(el.dataset.search).includes(word);});}if(e.target.id==='homeSearch'&&e.target.value.trim().length>1){tab='pedidos';render();const input=document.getElementById('searchRows');if(input){input.value=e.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));}}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();handleAction(b.dataset.action,dec(b.dataset.key||''),b.dataset.target?dec(b.dataset.target):'',b.dataset.dest?dec(b.dataset.dest):'');}});
void bootCloud();