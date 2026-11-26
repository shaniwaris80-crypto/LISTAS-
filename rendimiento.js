// ARSLAN LISTAS NEXT · rendimiento fluido 2026-11-26.
// Capa de presentación y cálculo. No borra ni reemplaza datos operativos.

const ARSLAN_PERF={
 inRender:false,
 cache:new Map(),
 current:null,
 lastRender:null,
 history:[],
 shellRenders:0,
 fullRenders:0
};

function arslanPerfNow(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
function arslanPerfKey(value){
 if(value===undefined)return '';
 if(value===null)return 'null';
 if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
 return '';
}
function arslanMemo(name,original,keyBuilder){
 return function(...args){
  if(!ARSLAN_PERF.inRender)return original.apply(this,args);
  const key=name+'|'+(keyBuilder?keyBuilder(...args):args.slice(1).map(arslanPerfKey).join('|'));
  if(ARSLAN_PERF.cache.has(key)){
   ARSLAN_PERF.current.hits[name]=(ARSLAN_PERF.current.hits[name]||0)+1;
   return ARSLAN_PERF.cache.get(key);
  }
  const start=arslanPerfNow(),value=original.apply(this,args);
  ARSLAN_PERF.current.calls[name]=(ARSLAN_PERF.current.calls[name]||0)+1;
  ARSLAN_PERF.current.cost[name]=(ARSLAN_PERF.current.cost[name]||0)+(arslanPerfNow()-start);
  ARSLAN_PERF.cache.set(key,value);
  return value;
 };
}

// Estas funciones son puras durante un render. La caché vive únicamente dentro
// de ese render; fuera de él siempre se ejecuta la lógica original.
const arslanPerfOriginalTotals=totals;
totals=arslanMemo('totals',arslanPerfOriginalTotals,()=> 'state');
const arslanPerfOriginalDeliveryPlan=deliveryPlan;
deliveryPlan=arslanMemo('deliveryPlan',arslanPerfOriginalDeliveryPlan,()=> 'state');
const arslanPerfOriginalPendingPurchases=pendingPurchases;
pendingPurchases=arslanMemo('pendingPurchases',arslanPerfOriginalPendingPurchases,()=> 'state');
const arslanPerfOriginalProductStatus=productStatus;
productStatus=arslanMemo('productStatus',arslanPerfOriginalProductStatus,(snapshot,key)=>key);
const arslanPerfOriginalAuthorizedQty=authorizedQty;
authorizedQty=arslanMemo('authorizedQty',arslanPerfOriginalAuthorizedQty,(snapshot,key)=>key);
const arslanPerfOriginalSupplierLines=supplierLines;
supplierLines=arslanMemo('supplierLines',arslanPerfOriginalSupplierLines,(snapshot,supplier,includeSent=true)=>supplier+'|'+includeSent);
const arslanPerfOriginalSupplierDraftTXT=supplierDraftTXT;
supplierDraftTXT=arslanMemo('supplierDraftTXT',arslanPerfOriginalSupplierDraftTXT,(snapshot,supplier)=>supplier);
const arslanPerfOriginalSupplierTXT=supplierTXT;
supplierTXT=arslanMemo('supplierTXT',arslanPerfOriginalSupplierTXT,(snapshot,supplier)=>supplier);
const arslanPerfOriginalUnassignedProducts=unassignedProducts;
unassignedProducts=arslanMemo('unassignedProducts',arslanPerfOriginalUnassignedProducts,()=> 'state');
const arslanPerfOriginalSurplus=surplus;
surplus=arslanMemo('surplus',arslanPerfOriginalSurplus,()=> 'state');
const arslanPerfOriginalAdditionalPurchaseRows=additionalPurchaseRows;
additionalPurchaseRows=arslanMemo('additionalPurchaseRows',arslanPerfOriginalAdditionalPurchaseRows,()=> 'state');

function arslanPerfStartRender(){
 ARSLAN_PERF.cache.clear();
 ARSLAN_PERF.current={tab,started:arslanPerfNow(),calls:{},hits:{},cost:{},partial:false};
 ARSLAN_PERF.inRender=true;
}
function arslanPerfFinishRender(){
 const current=ARSLAN_PERF.current;
 ARSLAN_PERF.inRender=false;
 if(!current)return;
 current.duration=arslanPerfNow()-current.started;
 current.nodes=typeof document!=='undefined'&&document.getElementById?.('app')?.querySelectorAll?document.getElementById('app').querySelectorAll('*').length:0;
 ARSLAN_PERF.lastRender=current;
 ARSLAN_PERF.history.push(current);
 if(ARSLAN_PERF.history.length>30)ARSLAN_PERF.history.shift();
 ARSLAN_PERF.current=null;
}

function arslanPerfScreen(){
 const view=({inicio:home,pedidos,global:globalView,compras,carga,reparto,mas,cuenta:accountView,auditoria})[tab];
 if(!view)throw Error('Pantalla no disponible');
 return view();
}
function arslanPerfMainHTML(screenHTML){
 return `<div id="operation-indicator" class="operation-indicator" role="status" aria-live="polite" hidden></div>${toastMessage?`<div class="notice ${toastMessage.startsWith('ERROR')?'red':'green'}">${esc(toastMessage)}</div>`:''}${screenHTML}`;
}
function arslanPerfCanPatchShell(app){
 return Boolean(app?.querySelector?.('.top')&&app.querySelector('.shell')&&app.querySelector('.shell main')&&cloudUser&&accessUnlocked);
}
function arslanPerfUpdateNavigation(app){
 for(const button of app.querySelectorAll('.side [data-action="goto"],.bottomnav [data-action="goto"]')){
  const active=dec(button.dataset.key||'')===tab;
  button.classList.toggle('active',active);
  if(button.closest('.bottomnav'))button.setAttribute('aria-current',active?'page':'false');
 }
 const oldBadge=app.querySelector('#sync-badge');
 if(oldBadge){const holder=document.createElement('div');holder.innerHTML=syncBadge();oldBadge.replaceWith(holder.firstElementChild);}
 const sideCloud=app.querySelector('.side-cloud');
 if(sideCloud)sideCloud.innerHTML=`${uiIcon('check',16)} ${esc(CLOUD_ENABLED?cloudMessage:'Solo en este dispositivo')}`;
}

const arslanPerfFallbackRender=render;
render=function(options={}){
 arslanPerfStartRender();
 try{
  const app=document.getElementById('app');
  if(!app){return;}
  // Pantallas de acceso y primer montaje conservan la ruta original completa.
  if(!arslanPerfCanPatchShell(app)){
   ARSLAN_PERF.fullRenders++;
   return arslanPerfFallbackRender(options);
  }
  const providerViewport=captureProviderViewport(Boolean(options?.resetProviderScroll));
  const drafts={};document.querySelectorAll('textarea').forEach(t=>{if(t.id&&t.value)drafts[t.id]=t.value;});
  let screenHTML='';
  try{screenHTML=arslanPerfScreen();}
  catch(error){
   console.error('Error al abrir sección de LISTAS:',tab,error);
   screenHTML=`<div class="card"><h2>No se pudo abrir ${esc(tab)}</h2><div class="notice red">${esc(error?.message||'Error de datos. No se ha borrado nada.')}</div><div class="tools">${btn('goto','Volver a Inicio','inicio','dark')}${btn('export','Descargar copia JSON','','small')}</div></div>`;
  }
  const main=app.querySelector('.shell main');
  main.innerHTML=arslanPerfMainHTML(screenHTML);
  arslanPerfUpdateNavigation(app);
  Object.entries(drafts).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.value=value;});
  restoreProviderViewport(providerViewport);
  if(typeof auditSafeEnhanceRenderedUI==='function')auditSafeEnhanceRenderedUI();
  ARSLAN_PERF.shellRenders++;
  ARSLAN_PERF.current.partial=true;
 }finally{arslanPerfFinishRender();}
};

// Un toque debe pintar su respuesta antes de ejecutar un render costoso. Se
// conserva la misma acción y la misma protección de Firebase.
if(typeof auditSafeRunTouchAction==='function'){
 auditSafeRunTouchAction=function(control){
  const action=control.dataset.action;
  if(!action)return;
  const key=dec(control.dataset.key||''),target=control.dataset.target?dec(control.dataset.target):'',dest=control.dataset.dest?dec(control.dataset.dest):'';
  auditSafeSetTouchProcessing(control,true);
  const run=()=>Promise.resolve(handleAction(action,key,target,dest))
   .catch(error=>{toastMessage='ERROR: '+(error?.message||String(error));render();})
   .finally(()=>{setTimeout(()=>{if(control.isConnected)auditSafeSetTouchProcessing(control,false);},45);});
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);
  else setTimeout(run,0);
 };
}

// Cambiar proveedor solo altera el selector y las etiquetas de asignación; no
// necesita reconstruir cientos de filas.
const arslanPerfOriginalHandleAction=handleAction;
handleAction=async function(action,key,target,dest){
 if(action==='selprov'&&auditSafeCanEnhanceDom()){
  supplier=key;
  for(const button of document.querySelectorAll('.supplier-pills [data-action="selprov"]'))button.classList.toggle('on',dec(button.dataset.key||'')===supplier);
  for(const button of document.querySelectorAll('.assign-items [data-action="assign"]'))button.textContent='+ '+supplier;
  return;
 }
 return arslanPerfOriginalHandleAction(action,key,target,dest);
};

// Reaplicar una vez tras cargar esta capa; no modifica el estado.
render();
