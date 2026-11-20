// Código de interfaz separado para compilar una demo HTML autónoma.
const FIXTURE = __FIXTURE__;
const KEY='arslan_listas_reparto_seguro_v5_local_only';
let state;
const CLOUD_ENABLED=ARSLAN_CLOUD_ACTIVE;
if(!CLOUD_ENABLED){
 try{state=JSON.parse(localStorage.getItem(KEY)||'null');}catch{state=null;}
 if(!state||!Array.isArray(state.orders)||!Array.isArray(state.catalog)){
  state=createState();importBlocks(state,FIXTURE);
 }
}else state=createState();
let tab='inicio',supplier='ESMO',filter='pending',toastMessage='';
let selectedDeliveryDest='SP',expandedPurchaseKey='',editingDestination='';
let cloudAdapter=null,cloudEngine=null,cloudUser=null;
let cloudStatus=CLOUD_ENABLED?'conectando':'sin_configurar';
let cloudMessage=CLOUD_ENABLED?'Iniciando conexión…':'Guardado solo en este dispositivo';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=encodeURIComponent,dec=decodeURIComponent;
const destName=id=>state.destinations.find(d=>d.id===id)?.name||id;
const trow=key=>totals(state).find(t=>t.key===key);
function freshCloudState(){const s=createState(),d=new Date();s.day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return s;}
function cloudCanEdit(){return !CLOUD_ENABLED||(cloudUser&&cloudEngine&&['sincronizado','pendiente','sin_conexion'].includes(cloudStatus)&&cloudEngine.revision!==null&&!cloudEngine.conflict);}
function persistCloudUser(next,meta){if(!cloudUser)return;try{localStorage.setItem(KEY+':user:'+cloudUser.id,JSON.stringify({state:next,meta}));}catch(e){cloudStatus='error';cloudMessage='El navegador no permite guardar el trabajo: '+(e?.message||e);updateSyncDisplay();}}
function syncBadge(withId=true){
 const titles={sin_configurar:'SOLO EN ESTE DISPOSITIVO',conectando:'CONECTANDO',sin_sesion:'ENTRA PARA SINCRONIZAR',sincronizado:'SINCRONIZADO',pendiente:'GUARDANDO…',sin_conexion:'SIN CONEXIÓN',conflicto:'REVISAR CONFLICTO',importar:'IMPORTAR A NUBE',error:'ERROR DE SINCRONIZACIÓN'};
 const tone=cloudStatus==='sincronizado'?'ok':cloudStatus==='conflicto'||cloudStatus==='error'?'err':'warn';
 return `<span class="sync-pill ${tone}" ${withId?'id="sync-badge"':''} title="${esc(cloudMessage)}">${esc(titles[cloudStatus]||cloudStatus)}</span>`;
}
function legacyBackupButtons(){let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}return saved&&Array.isArray(saved.orders)?`<div class="notice"><b>Datos anteriores en este navegador:</b> ${saved.orders.length} líneas. Descarga una copia antes de conectar la nube. ${btn('cloud-legacy-export','Descargar copia JSON','','small')}</div>`:'';}
function cloudPanel(){
 if(!CLOUD_ENABLED)return `<div class="card sync-panel"><h2>Sincronización entre dispositivos</h2><div class="notice red"><b>No activada.</b> Estos pedidos se guardan solamente en este navegador. Abrir la página en otro móvil no los copia.</div>${legacyBackupButtons()}<p class="subtle">La conexión requiere un proyecto Firebase independiente de Ruta Madrid. Consulta docs/FIREBASE_CONFIGURACION.md.</p></div>`;
 if(!cloudUser)return `<div class="card sync-panel"><h2>Conectar mis dispositivos</h2><p class="subtle">Usa el mismo correo y contraseña en móvil y ordenador. Se requiere una base propia de Firebase, nunca la de Ruta Madrid.</p><label for="cloud-email">Correo electrónico</label><input id="cloud-email" type="email" autocomplete="username" placeholder="tu-correo@ejemplo.es"><label for="cloud-password">Contraseña</label><input id="cloud-password" type="password" autocomplete="current-password" placeholder="Contraseña de Firebase"><div class="tools">${btn('cloud-login','Entrar','','dark')}${btn('cloud-signup','Crear cuenta','','small')}${btn('cloud-reset','Recuperar contraseña','','small')}</div><p class="subtle">${esc(cloudMessage)}</p>${legacyBackupButtons()}</div>`;
 const user=esc(cloudUser.email||'Cuenta conectada');
 let actions='';
 if(cloudStatus==='importar')actions=`<div class="notice"><b>Hay datos locales y la nube está vacía.</b> Para evitar pérdidas no subimos nada automáticamente.</div><div class="tools">${btn('cloud-init','Subir los datos de este dispositivo','','dark')}</div>`;
 else if(cloudStatus==='conflicto')actions=`<div class="notice red"><b>Dos dispositivos modificaron los datos.</b> Nada se sobrescribirá automáticamente. Al elegir una opción se descargará una copia de seguridad.</div><div class="tools">${btn('cloud-use-remote','Usar datos de la nube','','dark')}${btn('cloud-publish-local','Publicar mis datos locales','','red')}</div>`;
 else actions=`<div class="tools">${btn('cloud-refresh','Sincronizar ahora','','dark')}${localStorage.getItem(KEY)?btn('cloud-import-demo','Importar datos anteriores de este navegador','','small'):''}</div>`;
 return `<div class="card sync-panel"><div class="sectionline"><h2>Sincronización de LISTAS</h2>${syncBadge(false)}</div><p class="subtle">${user} · ${esc(cloudMessage)}</p>${actions}<div class="tools">${btn('cloud-backup','Descargar copia de esta jornada','','small')}${btn('cloud-choose-import','Importar copia JSON de otro dispositivo','','small')}${btn('cloud-logout','Cerrar sesión','','small')}</div><input id="cloud-import-file" type="file" accept="application/json,.json" hidden><p class="subtle">El trabajo sin conexión queda pendiente de subir; nunca se sustituyen cambios conflictivos sin revisión. Para mover tus pedidos desde otra URL, primero exporta allí el JSON.</p></div>`;
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
 let record=null;
 try{record=JSON.parse(localStorage.getItem(KEY+':user:'+userId)||'null');}catch{record=null;}
 let legacy=null;try{legacy=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
 const hasRecord=!!(record?.state&&Array.isArray(record.state.orders));
 const hasLegacy=!!(!hasRecord&&legacy&&Array.isArray(legacy.orders));
 state=hasRecord?record.state:hasLegacy?legacy:freshCloudState();
 cloudStatus='conectando';cloudMessage='Leyendo los pedidos de la nube…';render();
 cloudEngine=new SyncEngine({adapter:cloudAdapter,initialState:state,meta:record?.meta??null,
  hasLocal:hasRecord||hasLegacy,onApply(next){state=next;render();},
  onStatus(status,message){cloudStatus=status;cloudMessage=message;updateSyncDisplay();},
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
     if(cloudEngine)cloudEngine.stop();cloudEngine=null;cloudUser=null;state=createState();
     cloudStatus='sin_sesion';cloudMessage='Sesión cerrada; tus pedidos siguen en la nube';render();
   }
  });
 }catch(e){cloudStatus='error';cloudMessage='No se pudo iniciar la sincronización: '+(e?.message||e);render();}
}
if(typeof setInterval==='function')setInterval(()=>{if(CLOUD_ENABLED&&cloudEngine&&!document.hidden&&navigator.onLine)void cloudEngine.refresh();},7000);
if(typeof window.addEventListener==='function')window.addEventListener('online',()=>{if(cloudEngine)void cloudEngine.refresh();});
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudEngine)void cloudEngine.refresh();});
function issueText(x){return x.issues.includes('PRODUCTO_NO_EN_CATALOGO')?'PRODUCTO NO EN CATÁLOGO':'REVISAR CANTIDAD'}
const btn=(action,text,key='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-key="${enc(key)}">${text}</button>`;
const pill=(t,cls='')=>`<span class="pill ${cls}">${esc(t)}</span>`;
const sectionTitle=(s,d)=>`<div class="head"><div><h1>${s}</h1><p>${d}</p></div><div class="mini">Jornada ${esc(state.day)} · Pedidos del dispositivo</div></div>`;
function stats(){let x=summary(state);return `<div class="grid"><div class="stat"><b>${x.originalLines}</b><span>Líneas de pedido</span></div><div class="stat"><b>${x.products}</b><span>Productos globales</span></div><div class="stat"><b>${x.unreviewed}</b><span>Por revisar</span></div></div>`;}
function nav(){const links=[['inicio','Hoy'],['pedidos','Pedidos'],['global','Proveedores'],['compras','Compras'],['carga','Carga'],['reparto','Reparto'],['auditoria','Auditoría']];return `<aside class="side"><div class="caption">Operativa diaria</div>${links.map(([k,label],i)=>`<button class="${tab===k?'active':''}" data-action="goto" data-key="${k}"><span class="step">${i+1}</span>${label}</button>`).join('')}<div class="caption">Almacenamiento</div><div class="subtle" style="padding:6px 14px">${esc(CLOUD_ENABLED?cloudMessage:'Solo en este dispositivo. Sin nube conectada.')}</div></aside><nav class="bottomnav">${[['inicio','Hoy'],['pedidos','Pedidos'],['global','Proveedores'],['compras','Compras'],['reparto','Reparto'],['mas','Más']].map(([k,label])=>`<button class="${tab===k?'active':''}" data-action="goto" data-key="${k}">${label}</button>`).join('')}</nav>`;}
function home(){let x=summary(state),plan=deliveryPlan(state);return sectionTitle('Todo en orden.','Tus pedidos de San Lesmes y San Pablo, listos para revisar, enviar a proveedores y bajar de la furgoneta.')+`<div class="clear-day-home"><div class="clear-day-description"><strong>¿Empezar pedidos nuevos?</strong><span>Archiva la jornada actual y conserva catálogo, restaurantes, proveedores y precios.</span></div>${btn('clearday','Limpiar día','','red clear-day-button')}</div>`+`<div id="sync-panel">${cloudPanel()}</div>`+stats()+`<div class="spacer"></div><div class="card"><h2>Regla de reparto que estamos comprobando</h2><div class="notice"><b>No se reparte lo que no se ha gestionado.</b> Un producto sólo aparece en «Por bajar» si hay un pedido marcado como enviado a proveedor o una compra manual confirmada. Asignarlo a un proveedor, sin enviarlo, no basta.</div><div class="tools">${btn('goto','Revisar pedidos','pedidos','dark')}${btn('goto','Asignar proveedores','global')}${btn('goto','Bajar mercancía','reparto')}</div></div><div class="twocol"><div class="card"><h2>Compras</h2><div class="subtle">${x.assignedDraft} asignaciones pendientes de enviar · ${x.assignedSent} enviadas · ${x.manualBought} compras manuales registradas.</div><div class="spacer"></div>${btn('goto','Abrir compras','compras','dark')}</div><div class="card"><h2>Reparto</h2><div class="subtle">${plan.eligible.filter(r=>r.remaining>0).length} líneas por bajar · ${plan.blocked.length} productos sin compra ni envío · ${plan.needsReview.length} compras parciales por distribuir.</div><div class="spacer"></div>${btn('goto','Abrir reparto','reparto','dark')}</div></div><div class="card"><h2>Destinos incluidos</h2><div class="summary-list">${state.destinations.map(d=>pill(d.name)).join('')}</div><p class="subtle">Los restaurantes están listos, pero sólo suman al Global cuando introduces sus pedidos. No se inventan cantidades.</p></div>`;}
function orderCard(d){
 const lines=state.orders.filter(l=>l.dest===d.id).sort((a,b)=>a.product.localeCompare(b.product,'es',{numeric:true}));
 const isEditing=editingDestination===d.id;
 const isRest=d.kind==='restaurante';
 return `<div class="card order-card" data-destination="${esc(d.id)}"><div class="sectionline"><h2>${esc(d.name)}</h2>${pill((isRest?'Restaurante · ':'Tienda · ')+lines.length+' líneas',lines.length?'ok':'')}</div>`+
 `<div class="tools" style="margin-bottom:12px">${btn('destedit',isEditing?'Cerrar edición':'+ Pegar / añadir pedido',d.id,'small dark')}${lines.length?btn('destcopy','Copiar TXT',d.id,'small')+btn('destdownload','Descargar TXT',d.id,'small')+btn('destwa','WhatsApp',d.id,'small green'):pill('Todavía sin pedido')}</div>`+
 (isEditing?`<div class="inline-order"><label for="destorder-${esc(d.id)}">Escribe o pega el pedido de ${esc(d.name)}</label><textarea id="destorder-${esc(d.id)}" placeholder="2 TOMATE RAMA&#10;1 BROCOLI"></textarea><div class="tools">${btn('destadd','Añadir líneas a este destino',d.id,'dark small')}</div></div>`:'')+
 (lines.length?`<div class="items">${lines.map(l=>`<div class="item ${l.review?'err':''}"><div class="keynum">${esc(l.q??'?')}</div><div class="grow"><div class="product">${esc(l.product)}</div><div class="details">${esc(l.unit)} · ${l.review?pill(issueText(l),'err'):pill('OK','ok')} ${l.raw!==`${l.q} ${l.product}`?'· Original: '+esc(l.raw):''}</div>${l.review&&l.suggestions.length?`<div class="tools" style="margin-top:8px">${l.suggestions.map(x=>`<button class="btn small" data-action="suggest" data-key="${enc(l.id)}" data-target="${enc(x)}">Usar ${esc(x)}</button>`).join('')}</div>`:''}</div><div class="mini-actions">${l.review?btn('create','+ Crear producto',l.id,'small dark'):''}${btn('qty','Cantidad',l.id,'small')}${btn('editname','Editar nombre',l.id,'small')}</div></div>`).join('')}</div>`:`<p class="subtle">Sin cantidades. Este destino no se suma al Global hasta que introduzcas un pedido.</p>`)+`</div>`;
}
function pedidos(){
 const candidates=state.orders.filter(x=>x.review);
 const stores=state.destinations.filter(d=>d.kind==='tienda');
 const restaurants=state.destinations.filter(d=>d.kind!=='tienda').sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const occupied=restaurants.filter(d=>state.orders.some(o=>o.dest===d.id)||editingDestination===d.id);
 const empty=restaurants.filter(d=>!state.orders.some(o=>o.dest===d.id)&&editingDestination!==d.id);
 return sectionTitle('Pedidos','Tiendas y restaurantes separados. Pega varios encabezados o escribe cada lista desde el móvil.')+
 `<div class="card"><div class="sectionline"><h2>Pegar varias listas juntas</h2>${pill('SP / SL / ST / BRASEROS / RIVIERA')}</div><label for="paste">Pedidos de WhatsApp con encabezados</label><textarea id="paste" placeholder="PEDIDO SP&#10;3 MANZANA GOLDEN 28&#10;PEDIDO SL&#10;2 TOMATE RAMA&#10;PEDIDO BRASEROS CENTRO&#10;1 BROCOLI"></textarea><div class="tools"><button class="btn dark" data-action="import">Añadir pedidos</button><button class="btn" data-action="replace">Sustituir listas del destino</button>${btn('goto','Ver Global','global')}</div></div>`+
 (candidates.length?`<div class="notice"><b>${candidates.length} nombres por confirmar</b> Elige una sugerencia o crea producto nuevo y se recordará.</div>`:'<div class="notice green"><b>Nombres confirmados</b> Puedes organizar las compras.</div>')+
 `<h2>Tiendas</h2>`+stores.map(orderCard).join('')+`<div class="sectionline"><h2>Pedidos de restaurantes</h2><div class="tools">${pill(restaurants.filter(d=>state.orders.some(o=>o.dest===d.id)).length+' con pedido','ok')}${btn('newdest','+ Nuevo restaurante','','small dark')}</div></div>`+
 occupied.map(orderCard).join('')+
 `<div class="card"><h3>Restaurantes disponibles</h3><p class="subtle">Braseros Centro, Forum, Severo, Edificio, Tomillares y Riviera. Se suman al Global sólo si tienen pedido.</p><div class="tools">${empty.length?empty.map(d=>btn('destedit','+ '+esc(d.name),d.id,'small')).join(''):'<span class="subtle">Todos tienen pedido o están abiertos para editar.</span>'}</div></div>`;
}
function providerCard(p){
 const rows=supplierLines(state,p),draft=supplierLines(state,p,false),sent=rows.filter(x=>x.status==='sent');
 const allText=supplierTXT(state,p),draftText=supplierDraftTXT(state,p);
 return `<div class="card provider-card" data-provider="${esc(p)}"><div class="sectionline"><h2>${esc(p)}</h2>${pill(rows.length+' productos')}${sent.length?pill(sent.length+' enviados','ok'):pill('Sin enviar','warn')}</div>`+
 (rows.length?`<div class="items">${rows.map(a=>`<div class="item ${a.status==='sent'?'done':''}"><div class="keynum">${esc(a.q)}</div><div class="grow"><div class="product">${esc(display(a.product))}</div><div class="details">${a.status==='sent'?pill('✓ Enviado','ok'):pill('☐ Sin enviar','warn')}</div></div>${a.status==='draft'?btn('unassign','↩ Quitar',a.key,'small'):''}</div>`).join('')}</div>`:'<div class="subtle">No tiene productos asignados todavía.</div>')+
 (rows.length?`<div class="copy">${esc(draftText||'(Todo lo asignado está marcado como enviado)')}</div>`:'')+
 `<div class="tools" style="margin-top:12px">${draft.length?btn('copy','Copiar TXT pendiente',p,'small dark')+btn('provdownload','Descargar TXT',p,'small')+btn('whatsapp','WhatsApp',p,'small green')+btn('sent','☐ Marcar enviado',p,'small'):''}${rows.length?btn('copyall','Copiar TXT completo',p,'small')+btn('provdownloadall','Descargar todo',p,'small'):''}${sent.length?btn('reopensent','Corregir enviado',p,'small'):''}</div>`+
 `<p class="subtle">WhatsApp solo prepara las líneas pendientes; confirma el envío con la casilla después de enviarlo.</p></div>`;
}
function globalView(){
 const rows=totals(state),unassigned=unassignedProducts(state);
 const selected=SUPPLIERS.filter(x=>x!=='COMPRA EXTERNA');
 const visible=filter==='all'?rows:filter==='pending'?unassigned:filter==='draft'?rows.filter(r=>state.allocations.some(a=>a.key===r.key&&a.status==='draft')):rows.filter(r=>state.allocations.some(a=>a.key===r.key&&a.status==='sent'));
 return sectionTitle('Asignación a proveedores','Elige un proveedor y toca cada producto de «Sin asignar». Desaparece de esa lista y entra en el proveedor elegido.')+
 `<div class="card"><div class="sectionline"><h2>Proveedor seleccionado</h2>${pill(supplier,'black')}</div><div class="supplier-pills">${selected.map(p=>`<button class="btn ${supplier===p?'on':''}" data-action="selprov" data-key="${enc(p)}">${esc(p)} (${supplierLines(state,p).length})</button>`).join('')}</div>`+
 `<div class="tools">${btn('filter',`Sin asignar (${unassigned.length})`,'pending','small '+(filter==='pending'?'dark':''))}${btn('filter','Global total','all','small '+(filter==='all'?'dark':''))}${btn('filter','Asignados sin enviar','draft','small')}${btn('filter','Enviados','sent','small')}</div></div>`+
 `<div class="card"><div class="sectionline"><h2>${filter==='pending'?'Sin asignar':filter==='all'?'Global · todas las cantidades':filter==='draft'?'Asignados sin enviar':'Ya enviados'} · ${visible.length}</h2><span class="subtle">Global conserva los totales de todos los destinos</span></div><label for="searchRows">Buscar producto</label><input id="searchRows" placeholder="Ej.: TOMATE RAMA, GOLDEN 28" autocomplete="off"/><div class="items">${visible.map(r=>{const active=state.allocations.filter(a=>a.key===r.key&&a.status!=='cancelled');const status=authorizedQty(state,r.key)>0?pill('Habilitado','ok'):active.length?pill('Asignado / sin enviar','warn'):pill('Sin asignar','err');return `<div class="item searchable ${r.unresolved?'err':''}" data-search="${esc(r.product)}" ${!active.length&&!r.unresolved?`data-action="assign" data-key="${enc(r.key)}" role="button" tabindex="0" aria-label="Asignar ${esc(r.product)} a ${esc(supplier)}"`:''}><div class="keynum">${esc(r.total)}</div><div class="grow"><div class="product">${esc(r.product)}</div><div class="details">${esc(r.unit)} · ${Object.entries(r.by).map(([d,n])=>esc(destName(d))+': '+n).join(' · ')}</div><div class="tools" style="margin-top:7px">${status} ${active.map(a=>pill(a.supplier+' '+a.q,a.status==='sent'?'ok':'warn')).join('')}</div></div><div class="mini-actions">${r.unresolved?pill('Revisar nombre','err'):!active.length?btn('assign','+ '+esc(supplier),r.key,'small dark'):active.some(a=>a.status==='draft')?btn('unassign','↩ Quitar borrador',r.key,'small'):''}</div></div>`;}).join('')||'<p class="subtle">Sin productos en esta lista. Cambia el filtro para ver el Global consolidado.</p>'}</div></div>`+
 `<div class="sectionline"><h2>Listas por proveedor</h2>${pill('TXT y WhatsApp independientes')}</div>`+selected.map(providerCard).join('');
}
function compras(){
 const rows=totals(state);
 return sectionTitle('Compras','Toca el nombre de un producto para saber qué tiendas y restaurantes llevan cada cantidad, como en Ruta Madrid.')+
 `<div class="notice amber"><b>Asignar no es enviar.</b> Sólo el envío confirmado o la compra manual habilitan Reparto. La carga no es obligatoria.</div>`+
 `<div class="card"><div class="sectionline"><h2>Compra total y compras sueltas</h2>${pill('Toca producto para ver destinos')}</div><div class="tools" style="margin-bottom:10px">${btn('buyall','✓ Comprar pendientes sin proveedor','','small dark')}</div><label for="searchRows">Buscar producto</label><input id="searchRows" placeholder="Ej.: TOMATE RAMA" autocomplete="off"/><div class="items">${rows.map(r=>{
 const st=productStatus(state,r.key),open=expandedPurchaseKey===r.key;
 return `<div class="item searchable ${r.unresolved?'err':''}" data-search="${esc(r.product)}"><div class="keynum">${r.total}</div><div class="grow"><button type="button" class="product-disclosure" data-action="breakdown" data-key="${enc(r.key)}" aria-expanded="${open}"><span>${esc(r.product)}</span><span class="subtle">${open?'▲ Ocultar destinos':'▼ Ver quién lleva cuánto'}</span></button><div class="details">${esc(r.unit)} · Manual: ${st.manuallyBought} · Enviado: ${st.assignedSent}</div><div class="tools" style="margin-top:7px">${r.unresolved?pill('Revisar nombre','err'):st.manuallyBought?pill('Comprado manual','ok'):st.assignedSent?pill('Enviado proveedor','ok'):st.assignedDraft?pill('Asignado, no enviado','warn'):pill('Sin comprar / enviar','err')}</div>${open?`<div class="purchase-breakdown"><h3>Quién lleva cuánto · ${esc(r.product)}</h3>${Object.entries(r.by).sort((a,b)=>destName(a[0]).localeCompare(destName(b[0]),'es')).map(([d,q])=>`<div class="breakdown-line"><span>${esc(destName(d))}</span><strong>${esc(q)} ${esc(r.unit)}</strong></div>`).join('')}<div class="breakdown-line total"><span>TOTAL PEDIDO</span><strong>${r.total} ${esc(r.unit)}</strong></div></div>`:''}</div><div class="mini-actions">${btn('buy','✓ Comprar',r.key,'small '+(st.remainingToAuthorize?'dark':''))}${btn('buyedit','Más / menos',r.key,'small')}</div></div>`;}).join('')}</div></div><div class="card"><h2>Extras confirmados</h2>${surplus(state).length?surplus(state).map(r=>`<div class="item"><div class="keynum">+${r.extra}</div><div class="grow"><b>${esc(r.product)}</b><div class="subtle">Propuesta: 60 % SP · 20 % SL · 20 % ST</div></div>${btn('extra','Ver reparto',r.key,'small')}</div>`).join(''):'<p class="subtle">No hay compra extra confirmada. Enviar a un proveedor no es recibir mercancía.</p>'}</div>`;
}
function carga(){const x=deliveryPlan(state);return sectionTitle('Carga · opcional','Si quieres, marca lo que has cargado. Si prefieres ir directamente a Reparto, puedes saltarte este paso.')+`<div class="notice green"><b>La carga no bloquea reparto.</b> Los productos habilitados aparecen en Reparto aunque no marques nada aquí.</div><div class="tools" style="margin-bottom:15px">${btn('goto','Ir directo a Reparto','reparto','dark')}</div>`+
 `<div class="card"><h2>Por cargar</h2><div class="items">${x.eligible.map(r=>{const q=state.load[r.key+'@'+r.dest]||0;return `<div class="item ${q>=r.allowed?'done':''}"><button class="clickable" data-action="load" data-key="${enc(r.key)}" data-dest="${enc(r.dest)}"><span class="check">${q>=r.allowed?'✓':''}</span><div class="grow"><div class="product">${esc(r.allowed)} ${esc(r.product)}</div><div class="details">${esc(destName(r.dest))} · ${esc(r.unit)}${q?' · cargado '+q:''}</div></div></button></div>`}).join('')||'<div class="subtle">Primero registra envío a proveedor o compra manual.</div>'}</div></div>`;}
function reparto(){
 const p=deliveryPlan(state);
 const dests=state.destinations.filter(d=>state.orders.some(o=>o.dest===d.id)).sort((a,b)=>a.kind==='tienda'&&b.kind!=='tienda'?-1:a.kind!=='tienda'&&b.kind==='tienda'?1:a.kind==='tienda'?STORE_ORDER.indexOf(a.id)-STORE_ORDER.indexOf(b.id):a.name.localeCompare(b.name,'es'));
 if(dests.length&&!dests.some(d=>d.id===selectedDeliveryDest))selectedDeliveryDest=dests[0].id;
 const dest=selectedDeliveryDest;
 const current=state.destinations.find(x=>x.id===dest),notDone=p.eligible.filter(x=>x.dest===dest&&x.remaining>0),done=p.eligible.filter(x=>x.dest===dest&&x.remaining===0),myReview=p.needsReview.filter(x=>(x.by?.[dest]||0)>0),short=p.short.filter(x=>x.dest===dest);
 return sectionTitle('Bajar mercancía','Selecciona ARRIBA una tienda o restaurante; sólo ves sus productos, sin mezclar listas.')+
 `<div class="card destination-picker"><label for="deliveryDestination">¿En qué tienda o restaurante estás bajando?</label><select id="deliveryDestination">${dests.map(d=>`<option value="${esc(d.id)}" ${dest===d.id?'selected':''}>${esc(d.name)} · ${p.eligible.filter(x=>x.dest===d.id&&x.remaining>0).length} pendientes</option>`).join('')||'<option value="">Todavía sin pedidos</option>'}</select><div class="tools" style="margin-top:10px">${current?btn('rider','Repartidor: '+esc(state.riderAssignments?.[dest]||'Sin asignar'),dest,'small'):''}${pill('Carga opcional','ok')}</div></div>`+
 `<div class="grid"><div class="stat"><b>${notDone.length}</b><span>Por bajar en ${esc(current?.name||'destino')}</span></div><div class="stat"><b>${done.length}</b><span>Bajados en este destino</span></div></div><div class="spacer"></div>`+
 (myReview.length?`<div class="notice amber"><b>Compra parcial pendiente de distribuir</b> ${myReview.map(r=>btn('shortage','Distribuir '+esc(r.product),r.key,'small')).join('')}</div>`:'')+
 `<div class="card"><div class="sectionline"><h2>Por bajar · ${esc(current?.name||'Sin destino')}</h2>${pill(notDone.length+' pendientes')}</div><div class="items">${notDone.map(r=>`<div class="item"><button class="clickable" data-action="deliver" data-key="${enc(r.key)}" data-dest="${enc(dest)}"><span class="check"></span><div class="grow"><div class="product">${esc(r.remaining)} ${esc(r.product)}</div><div class="details">${esc(r.unit)} · ${r.delivered>0?`${r.delivered} ya bajado · `:''}Toca para marcar BAJADO</div></div></button><div class="mini-actions"><button class="btn small" data-action="deliverpartial" data-key="${enc(r.key)}" data-dest="${enc(dest)}">Parcial</button></div></div>`).join('')||'<p class="subtle">Este destino no tiene productos por bajar. Puede que aún no haya un proveedor enviado o una compra manual, o que ya esté todo bajado.</p>'}</div></div>`+
 `<div class="card"><div class="sectionline"><h2>Bajados en ${esc(current?.name||'este destino')} (${done.length})</h2>${pill('Deshacer disponible','ok')}</div>${done.length?`<div class="items">${done.map(r=>`<div class="item done"><div class="check">✓</div><div class="grow"><div class="product">${esc(r.allowed)} ${esc(r.product)}</div><div class="details">${esc(r.unit)}</div></div><button class="btn small" data-action="undodelivery" data-key="${enc(r.key)}" data-dest="${enc(dest)}">Deshacer</button></div>`).join('')}</div>`:'<p class="subtle">Aquí aparecen solo las bajadas completadas de este destino.</p>'}</div>`+
 (short.length?`<div class="notice amber"><b>Faltantes de ${esc(current?.name||'destino')}</b>${short.map(r=>`<div>Faltan ${r.missing} ${esc(r.product)}</div>`).join('')}</div>`:'');
}
function mas(){return sectionTitle('Más opciones','La carga es opcional; la auditoría y los datos de prueba están separados de tus pedidos reales.')+`<div class="card"><h2>Acciones</h2><div class="tools">${btn('goto','Carga opcional','carga','dark')}${btn('goto','Ver auditoría','auditoria')}${btn('goto','Pegar listas','pedidos')}</div></div>`;}
function auditoria(){const x=summary(state),p=deliveryPlan(state);return sectionTitle('Auditoría','Comprobaciones y seguridad del flujo en esta copia local, sin mensajes ni movimientos en tu aplicación real.')+stats()+`<div class="spacer"></div><div class="card"><h2>Condiciones de aceptación</h2><div class="items">${[
['91 líneas originales de 2 tiendas',x.originalLines===91],['Calibre GOLDEN 28 separado de GOLDEN 24',!!trow('MANZANA GOLDEN 28|BULTO')&&!!trow('MANZANA GOLDEN 24|BULTO')],['Los no enviados y no comprados están bloqueados',p.blocked.every(r=>authorizedQty(state,r.key)===0)],['Carga no condiciona reparto',true],['Los restaurantes suman sin fusionar sus destinos',true],['Los nombres sin confirmar no se envían automáticamente',true],['Las bajadas sólo permiten cantidades habilitadas',true],['WhatsApp requiere envío manual',true]].map(([name,ok])=>`<div class="item"><span class="pill ${ok?'ok':'err'}">${ok?'OK':'REVISAR'}</span><div class="grow"><b>${esc(name)}</b></div></div>`).join('')}</div></div><div class="card"><h2>Empezar otra jornada</h2><p class="subtle">Conserva catálogo, nombres nuevos, restaurantes, proveedores e histórico, y limpia pedidos y marcas de compra, carga y reparto de esta demo.</p>${btn('newday','Limpiar todo y nueva jornada','', 'red small')}</div><div class="card"><h2>Esta prueba es independiente</h2><p class="subtle">La aplicación real es privada y no ha sido modificada. Aquí todos los movimientos son locales, y los «Envíos» se marcan como simulación. Ningún proveedor ha recibido WhatsApp.</p><div class="tools">${btn('export','Exportar estado JSON','','small')}${btn('resetdemo','Restaurar listas de ejemplo','','small dark')}</div></div>`;}
function render(){const drafts={};document.querySelectorAll('textarea').forEach(t=>{if(t.id&&t.value)drafts[t.id]=t.value;});const app=document.getElementById('app');app.innerHTML=`<div class="top"><div class="top-inner"><div class="brand"><span class="logo">A</span><span>ARSLAN LISTAS <span style="font-weight:550">· REPARTO SEGURO</span><div class="subtitle">Compras · proveedores · reparto</div></span></div>${syncBadge()}</div></div><div class="shell">${nav()}<main>${toastMessage?`<div class="notice green">${esc(toastMessage)}</div>`:''}${({inicio:home,pedidos,global:globalView,compras,carga,reparto,mas,auditoria})[tab]()}</main></div>`;Object.entries(drafts).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.value=value;});}
function download(name,text,type='text/plain'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}
async function handleAction(action,key,target,dest){
 try{
 const readonly=['goto','export','copy','copyall','provdownload','provdownloadall','whatsapp','destcopy','destdownload','destwa'];
 if(CLOUD_ENABLED&&!action.startsWith('cloud-')&&!readonly.includes(action)&&!cloudCanEdit())throw Error('Para guardar cambios debes entrar y tener sincronización lista. Revisa el estado de la nube en Inicio.');
 switch(action){
 case 'cloud-login':case 'cloud-signup':case 'cloud-reset': {const email=document.getElementById('cloud-email')?.value?.trim(),password=document.getElementById('cloud-password')?.value||'';if(!email||!email.includes('@'))throw Error('Introduce un correo válido');if(action==='cloud-reset'){await cloudAdapter.resetPassword(email);toastMessage='Correo de recuperación solicitado; revisa tu buzón';}else if(action==='cloud-signup'){await cloudAdapter.signUp(email,password);toastMessage='Cuenta creada: confirma los permisos de Firebase';}else{await cloudAdapter.sendLogin(email,password);toastMessage='Sesión iniciada';}render();return;}
 case 'cloud-refresh': {if(!cloudEngine)throw Error('Sin sesión');await cloudEngine.refresh();toastMessage='Sincronización comprobada: '+cloudMessage;render();return;}
 case 'cloud-init': {if(!confirm('¿Subir los datos de este dispositivo a la nube nueva? Antes se descargará una copia JSON. Comprueba que estás en el ordenador que tiene los pedidos buenos.'))return;download('ARSLAN_LISTAS_COPIA_ANTES_DE_SUBIR.json',JSON.stringify(state,null,2),'application/json');await cloudEngine.initializeFromLocal();render();return;}
 case 'cloud-use-remote': {if(!cloudEngine?.conflict)throw Error('No hay conflicto');if(!confirm('¿Usar la versión de la nube? Antes se descargará la versión LOCAL para recuperarla si lo necesitas.'))return;download('ARSLAN_COPIA_LOCAL_ANTES_DE_CAMBIAR.json',JSON.stringify(state,null,2),'application/json');await cloudEngine.useRemote();render();return;}
 case 'cloud-publish-local': {if(!cloudEngine?.conflict)throw Error('No hay conflicto');if(!confirm('ATENCIÓN: sustituirás la versión REMOTA por esta versión local. Se descargará primero una copia de la nube. ¿Confirmas?'))return;download('ARSLAN_COPIA_NUBE_ANTES_DE_CAMBIAR.json',JSON.stringify(cloudEngine.conflict.remote.data,null,2),'application/json');await cloudEngine.publishLocal();render();return;}
 case 'cloud-logout': {if(!cloudAdapter)return;await cloudAdapter.signOut();return;}
 case 'cloud-legacy-export': {const old=localStorage.getItem(KEY);if(!old)throw Error('No hay copia local antigua');download('ARSLAN_LISTAS_COPIA_NAVEGADOR.json',old,'application/json');return;}
 case 'cloud-backup': {download('ARSLAN_LISTAS_COPIA_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');return;}
 case 'cloud-choose-import': {if(!cloudEngine||cloudStatus==='conectando'||cloudStatus==='error')throw Error('Primero conecta la cuenta Firebase');document.getElementById('cloud-import-file')?.click();return;}
 case 'cloud-import-demo': {if(!cloudEngine||!cloudCanEdit())throw Error('Primero conecta a la nube');const legacy=JSON.parse(localStorage.getItem(KEY)||'null');if(!legacy||!Array.isArray(legacy.orders))throw Error('No hay datos locales anteriores');if(state.orders.length||state.allocations.length||state.manual.length||Object.keys(state.delivery||{}).length)throw Error('Esta cuenta ya tiene una jornada con datos; exporta antes y no sobreescribas sin revisarlos');if(!confirm('¿Subir la copia LOCAL anterior a la nube? Puede contener productos de demostración.'))return;download('ARSLAN_COPIA_LOCAL_PREVIA.json',JSON.stringify(legacy,null,2),'application/json');state=legacy;commit('Datos anteriores importados; sincronizando con la nube');return;}

 case 'goto':tab=key;toastMessage='';render();window.scrollTo({top:0});return;
 case 'filter':filter=key;render();return;
 case 'selprov':supplier=key;render();return;
 case 'breakdown':expandedPurchaseKey=expandedPurchaseKey===key?'':key;render();return;
 case 'newdest':{const name=prompt('Nombre del nuevo restaurante:');if(name===null)return;const d=addDestination(state,name,'restaurante');editingDestination=d.id;commit('Restaurante '+d.name+' creado, sin pedido todavía');document.querySelector(`[data-destination=\"${d.id}\"]`)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 case 'destedit':editingDestination=editingDestination===key?'':key;render();if(editingDestination)document.querySelector(`[data-destination=\"${editingDestination}\"]`)?.scrollIntoView({behavior:'smooth',block:'start'});return;
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
 case 'sent':{const packet=markSupplierSent(state,key);commit(`Pedido a ${key} (${packet.text.split('\n').length} líneas) MARCADO enviado (simulación, no se envió WhatsApp)`);return;}
 case 'reopensent':{if(!confirm('¿Reabrir como SIN ENVIAR las líneas marcadas enviadas a '+key+'? Si ya se bajó mercancía se bloqueará.'))return;reopenSupplierSent(state,key);commit('Marcado SIN ENVIAR de nuevo para '+key);return;}
 case 'buyall':{const rows=totals(state).filter(r=>!r.unresolved).filter(r=>{const st=productStatus(state,r.key);return st.authorized<=0&&st.assignedDraft<=0&&st.requested>0;});if(!rows.length)throw Error('No hay productos pendientes sin proveedor; revisa las asignaciones');if(!confirm(`¿Confirmas compra manual de ${rows.length} productos sin asignar o enviar? Esta compra se registrará en la demostración.`))return;for(const r of rows)manualBuySafe(state,r.key,r.total);commit(`${rows.length} productos comprados manualmente`);return;}
 case 'buy':{const r=trow(key);if(!r)throw Error('Producto inexistente');const st=productStatus(state,key);const q=st.remainingToAuthorize;if(q<=0)throw Error('No queda pendiente; Más / menos permite registrar una compra realmente adicional');const removeDraft=st.assignedDraft>0;if(removeDraft&&!confirm('Hay un borrador de pedido a proveedor. ¿Quieres reducirlo en la cantidad que compras manualmente '+q+' '+r.product+'?'))return;manualBuySafe(state,key,q,{removeDraft});commit(`Comprado manualmente: ${q} ${r.product}`);return;}
 case 'buyedit':{const r=trow(key);const st=productStatus(state,key);const val=prompt('Cantidad REAL de compra manual adicional (no es recepción de proveedor):',String(st.remainingToAuthorize));if(val===null)return;const q=Number(val.replace(',','.'));const removeDraft=st.assignedDraft>0;if(removeDraft&&!confirm('¿Reducir el pedido borrador a proveedor en la cantidad que compras por tu cuenta?'))return;const allowExtra=st.authorized+q>r.total+1e-8;if(allowExtra&&!confirm('Atención: esta compra excede lo pedido. ¿Confirmas que se compró mercancía EXTRA real?'))return;manualBuySafe(state,key,q,{removeDraft,allowExtra});commit('Compra manual adicional confirmada');return;}
 case 'load':{const r=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest);if(!r)throw Error('Producto no habilitado');loadItem(state,key,dest,r.allowed);commit('Marcado como cargado; el reparto sigue siendo independiente');return;}
 case 'deliver':{deliver(state,key,dest);commit('Bajado. Se retira de pendientes.');return;}
 case 'deliverpartial':{const r=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest&&x.remaining>0);if(!r)throw Error('No está pendiente');const q=prompt(`Cantidad parcial a bajar de ${r.product}, máximo ${r.remaining}:`,String(r.remaining));if(q===null)return;deliver(state,key,r.dest,Number(q.replace(',','.')));commit('Bajada parcial registrada');return;}
 case 'undodelivery':{const rr=deliveryPlan(state).eligible.find(x=>x.key===key&&x.dest===dest&&x.delivered>0);if(!rr)return;undoDelivery(state,key,rr.dest);commit('Bajada deshecha; vuelve a pendientes');return;}
 case 'shortage':{const r=deliveryPlan(state).needsReview.find(x=>x.key===key);if(!r)return;const inputs={};let available=r.authorized;for(const [d,need] of Object.entries(r.by)){
   const v=prompt(`${r.product}: hay ${available} para repartir. ¿Cuánto reservar para ${destName(d)}? (pidió ${need})`,String(Math.min(need,available)));
   if(v===null)return;const n=Number(v.replace(',','.'));inputs[d]=n;available=fix(available-n);
  }
  planShortage(state,key,inputs);commit('Reparto de compra parcial confirmado');return;}
 case 'extra':{const r=surplus(state).find(x=>x.key===key);if(!r)return;const q=distributeSurplus(r.extra);alert(`Propuesta sobre el EXTRA de ${r.extra} ${r.unit}:\nSAN PABLO ${q.SP}\nSAN LESMES ${q.SL}\nSANTIAGO ${q.ST}\nEsta vista sólo audita el reparto; no añade líneas extra automáticamente.`);return;}
 case 'rider':{const n=prompt(`Repartidor de ${destName(key)}:`,state.riderAssignments?.[key]||'');if(n===null||!n.trim())return;assignRider(state,key,n);commit('Repartidor asignado');return;}
 case 'clearday':{const hasActivity=Boolean(state.orders.length||state.allocations.length||state.manual.length||state.receipts.length||Object.keys(state.delivery||{}).length||Object.keys(state.load||{}).length||Object.keys(state.shortageAllocation||{}).length||Object.keys(state.riderAssignments||{}).length||(state.sentMessages||[]).length);if(!hasActivity){toastMessage='Esta jornada ya está vacía. Puedes pegar pedidos nuevos.';render();return;}const confirmed=confirm('LIMPIAR DÍA — DEMOSTRACIÓN\n\nSe archivarán y quitarán de la jornada actual todos los pedidos, asignaciones, compras, envíos simulados, carga y bajadas.\n\nSE CONSERVAN: catálogo y productos nuevos, alias, tiendas, restaurantes, proveedores e histórico.\n\n¿Crear una jornada vacía para empezar otra vez?');if(!confirmed)return;const today=new Date();const d=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');newDay(state,d);tab='inicio';commit('Día limpiado y archivado. Ya puedes introducir pedidos nuevos; los productos y restaurantes siguen guardados.');return;}
 case 'newday':{if(!confirm('¿Archivar la jornada y empezar otra? Se conservan catálogo, restaurantes y proveedores.'))return;const today=new Date();const d=prompt('Fecha de la nueva jornada (AAAA-MM-DD):',[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'));if(!d)return;newDay(state,d);tab='inicio';commit('Jornada nueva creada; catálogo y restaurantes conservados');return;}
 case 'export':download('auditoria_arslan_demo_'+state.day+'.json',JSON.stringify(state,null,2),'application/json');return;
 case 'resetdemo':if(!confirm('¿Volver a cargar los dos pedidos de ejemplo en esta demo? Se sustituye el estado local de la demo.'))return;state=createState();importBlocks(state,FIXTURE);tab='inicio';commit('Demostración restaurada, sin modificar la aplicación publicada');return;
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
document.addEventListener('input',e=>{if(e.target.id==='searchRows'){const word=canonical(e.target.value);document.querySelectorAll('.searchable').forEach(el=>{el.hidden=!canonical(el.dataset.search).includes(word);});}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();handleAction(b.dataset.action,dec(b.dataset.key||''),b.dataset.target?dec(b.dataset.target):'',b.dataset.dest?dec(b.dataset.dest):'');}});
void bootCloud();