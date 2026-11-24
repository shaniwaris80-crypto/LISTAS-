// ARSLAN LISTAS NEXT · mejoras seguras derivadas de la auditoría 2026-11-24.
// Este archivo no borra pedidos, compras, asignaciones, bajadas ni historial.

const AUDIT_SAFE_CATALOG_ADDITIONS=Object.freeze([
 'AGUACATE PRIMERA',
 'AGUACATE LISO',
 'LIMON PRIMERA'
]);

function auditSafeAppendCatalog(target){
 if(!target||!Array.isArray(target.catalog))return target;
 const existing=new Set(target.catalog.map(canonical));
 for(const product of AUDIT_SAFE_CATALOG_ADDITIONS){
  const key=canonical(product);
  if(!existing.has(key)){target.catalog.push(product);existing.add(key);}
 }
 return target;
}

// Tanto una jornada nueva como una copia antigua conservan todo su contenido y
// reciben únicamente los nombres que falten. Nunca se reemplaza ni reordena el
// catálogo aprendido por el usuario.
const auditSafeOriginalCreateState=createState;
createState=function(){return auditSafeAppendCatalog(auditSafeOriginalCreateState());};
const auditSafeOriginalNormalizeRuntimeState=normalizeRuntimeState;
normalizeRuntimeState=function(value){
 return auditSafeAppendCatalog(auditSafeOriginalNormalizeRuntimeState(value));
};

let auditSafeOtherDestinationsOpen=null;
const auditSafeCanEnhanceDom=()=>typeof document!=='undefined'&&typeof document.querySelector==='function'&&typeof document.querySelectorAll==='function'&&typeof document.createElement==='function';

function auditSafeEnhanceBrand(){
 if(!auditSafeCanEnhanceDom())return;
 const brand=document.querySelector('.brand strong');
 if(!brand)return;
 brand.setAttribute('aria-label','ARSLAN LISTAS NEXT');
 brand.textContent=(typeof window!=='undefined'&&window.innerWidth<=850)?'ARSLAN NEXT':'ARSLAN LISTAS NEXT';
}

function auditSafeEnhanceOtherDestinations(){
 if(!auditSafeCanEnhanceDom()||tab!=='pedidos')return;
 const heading=[...document.querySelectorAll('main .sectionline h2')]
  .find(node=>node.textContent.trim()==='Otros destinos');
 const section=heading?.closest('.sectionline'),grid=section?.nextElementSibling;
 if(!section||!grid?.classList.contains('orders-grid'))return;
 const count=grid.querySelectorAll('.order-card').length;
 const details=document.createElement('details');
 details.className='other-destinations card';
 details.open=auditSafeOtherDestinationsOpen??(typeof window!=='undefined'&&window.innerWidth>850);
 const summary=document.createElement('summary');
 summary.innerHTML=`<span><strong>Otros destinos</strong><small>${count} disponibles · toca para ${details.open?'cerrar':'abrir'}</small></span><span class="other-destinations-chevron" aria-hidden="true">⌄</span>`;
 details.append(summary);
 const tools=section.querySelector('.tools');
 if(tools){
  const actions=document.createElement('div');
  actions.className='other-destinations-actions';
  actions.append(tools);
  details.append(actions);
 }
 details.append(grid);
 section.replaceWith(details);
 details.addEventListener('toggle',()=>{
  auditSafeOtherDestinationsOpen=details.open;
  const helper=details.querySelector('summary small');
  if(helper)helper.textContent=`${count} disponibles · toca para ${details.open?'cerrar':'abrir'}`;
 });
}

function auditSafeEnhanceLoadButtons(){
 if(!auditSafeCanEnhanceDom()||tab!=='carga')return;
 // deliveryPlan es costoso. Se calcula una sola vez por pantalla, no una vez
 // por cada producto, para que una lista grande responda rápido en iPhone.
 const rows=new Map(deliveryPlan(state).eligible.map(item=>[item.key+'@'+item.dest,item]));
 for(const control of document.querySelectorAll('button[data-action="load"]')){
  const key=decodeURIComponent(control.dataset.key||''),dest=decodeURIComponent(control.dataset.dest||'');
  const row=rows.get(key+'@'+dest);
  if(!row)continue;
  const loaded=Number(state.load?.[key+'@'+dest])||0;
  const completed=loaded>=row.allowed-1e-8;
  control.dataset.action='load-toggle';
  control.setAttribute('aria-pressed',String(completed));
  control.setAttribute('aria-label',completed?
   `Desmarcar carga de ${row.product} para ${destName(dest)}`:
   `Marcar cargado ${row.product} para ${destName(dest)}`);
  control.closest('.item')?.classList.toggle('load-completed',completed);
  const details=control.querySelector('.details');
  if(details&&completed&&!details.textContent.includes('toca para desmarcar'))details.append(' · toca para desmarcar');
 }
}

function auditSafeEnhanceRiderClear(){
 if(!auditSafeCanEnhanceDom()||tab!=='reparto')return;
 const dest=selectedDeliveryDest,current=state.riderAssignments?.[dest];
 if(!dest||!current||document.querySelector('[data-action="clear-rider"]'))return;
 const riderButton=document.querySelector('.destination-picker [data-action="rider"]');
 if(!riderButton)return;
 const clear=document.createElement('button');
 clear.type='button';
 clear.className='btn small rider-clear';
 clear.dataset.action='clear-rider';
 clear.dataset.key=encodeURIComponent(dest);
 clear.textContent='Quitar repartidor';
 clear.setAttribute('aria-label',`Quitar a ${current} de ${destName(dest)}`);
 riderButton.insertAdjacentElement('afterend',clear);
}

function auditSafeEnhanceAccessibility(){
 if(!auditSafeCanEnhanceDom())return;
 // Los botones sin tipo pueden enviar formularios accidentalmente si en el
 // futuro una tarjeta se integra dentro de un formulario.
 document.querySelectorAll('button:not([type])').forEach(button=>button.type='button');
 if(toastMessage){
  const notice=document.querySelector('main > .notice');
  if(notice){notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.setAttribute('aria-atomic','true');}
 }
}

// Respuesta táctil rápida: en pantallas táctiles la acción se ejecuta al soltar
// el dedo, sin esperar al click posterior. El movimiento cancela el toque para
// que desplazar una lista nunca active un botón accidentalmente.
const AUDIT_SAFE_TOUCH_SELECTOR='[data-action]';
const AUDIT_SAFE_TOUCH_DISTANCE=12;
const AUDIT_SAFE_TOUCH_DURATION=900;
let auditSafeFastTouchBound=false;
let auditSafeTouchGesture=null;
let auditSafeSuppressedClick=null;

function auditSafeTouchControl(event){
 if(!auditSafeCanEnhanceDom())return null;
 const origin=event?.target;
 return typeof origin?.closest==='function'?origin.closest(AUDIT_SAFE_TOUCH_SELECTOR):null;
}
function auditSafeTouchDisabled(control){
 return !control||Boolean(control.disabled)||control.getAttribute?.('aria-disabled')==='true';
}
function auditSafeTouchSignature(control){
 if(!control?.dataset)return '';
 return [control.dataset.action||'',control.dataset.key||'',control.dataset.target||'',control.dataset.dest||''].join('\u0001');
}
function auditSafeClearTouchVisual(control){
 if(!control?.classList)return;
 control.classList.remove('touch-pressed');
 control.closest?.('.item,.card,.purchase-item')?.classList.remove('touch-row-active');
}
function auditSafeSetTouchProcessing(control,busy){
 if(!control?.classList)return;
 control.classList.toggle('touch-processing',busy);
 if(busy){
  if(!control.hasAttribute('aria-busy'))control.dataset.auditSafeBusy='1';
  control.setAttribute('aria-busy','true');
 }else if(control.dataset.auditSafeBusy==='1'){
  control.removeAttribute('aria-busy');
  delete control.dataset.auditSafeBusy;
 }
}
function auditSafeStartTouch(event){
 if(!['touch','pen'].includes(event.pointerType))return;
 const control=auditSafeTouchControl(event);
 if(auditSafeTouchDisabled(control))return;
 auditSafeTouchGesture={
  pointerId:event.pointerId,
  control,
  startX:Number(event.clientX)||0,
  startY:Number(event.clientY)||0,
  started:Date.now(),
  cancelled:false
 };
 control.classList.add('touch-pressed');
 control.closest?.('.item,.card,.purchase-item')?.classList.add('touch-row-active');
}
function auditSafeMoveTouch(event){
 const gesture=auditSafeTouchGesture;
 if(!gesture||gesture.pointerId!==event.pointerId||gesture.cancelled)return;
 const dx=(Number(event.clientX)||0)-gesture.startX,dy=(Number(event.clientY)||0)-gesture.startY;
 if(Math.hypot(dx,dy)>AUDIT_SAFE_TOUCH_DISTANCE){
  gesture.cancelled=true;
  auditSafeClearTouchVisual(gesture.control);
 }
}
function auditSafeCancelTouch(event){
 const gesture=auditSafeTouchGesture;
 if(!gesture||gesture.pointerId!==event.pointerId)return;
 auditSafeClearTouchVisual(gesture.control);
 auditSafeTouchGesture=null;
}
function auditSafeRunTouchAction(control){
 const action=control.dataset.action;
 if(!action)return;
 const key=dec(control.dataset.key||''),target=control.dataset.target?dec(control.dataset.target):'',dest=control.dataset.dest?dec(control.dataset.dest):'';
 auditSafeSetTouchProcessing(control,true);
 Promise.resolve(handleAction(action,key,target,dest))
  .catch(error=>{toastMessage='ERROR: '+(error?.message||String(error));render();})
  .finally(()=>{setTimeout(()=>{if(control.isConnected)auditSafeSetTouchProcessing(control,false);},90);});
}
function auditSafeEndTouch(event){
 const gesture=auditSafeTouchGesture;
 if(!gesture||gesture.pointerId!==event.pointerId)return;
 const control=gesture.control;
 const sameControl=auditSafeTouchControl(event)===control;
 const valid=!gesture.cancelled&&sameControl&&!auditSafeTouchDisabled(control)&&Date.now()-gesture.started<=AUDIT_SAFE_TOUCH_DURATION;
 auditSafeClearTouchVisual(control);
 auditSafeTouchGesture=null;
 if(!valid)return;
 event.preventDefault();
 auditSafeSuppressedClick={signature:auditSafeTouchSignature(control),until:Date.now()+1100};
 auditSafeRunTouchAction(control);
}
function auditSafeSuppressDelayedClick(event){
 const control=auditSafeTouchControl(event),suppressed=auditSafeSuppressedClick;
 const signature=auditSafeTouchSignature(control);
 if(!suppressed||signature!==suppressed.signature||Date.now()>suppressed.until){
  if(suppressed&&Date.now()>suppressed.until)auditSafeSuppressedClick=null;
  return;
 }
 event.preventDefault();
 event.stopImmediatePropagation();
 auditSafeSuppressedClick=null;
}
function auditSafeBindFastTouch(){
 if(!auditSafeCanEnhanceDom()||auditSafeFastTouchBound||typeof document.addEventListener!=='function')return;
 auditSafeFastTouchBound=true;
 document.documentElement?.classList?.add('fast-touch-ready');
 document.addEventListener('pointerdown',auditSafeStartTouch,{capture:true,passive:true});
 document.addEventListener('pointermove',auditSafeMoveTouch,{capture:true,passive:true});
 document.addEventListener('pointerup',auditSafeEndTouch,{capture:true,passive:false});
 document.addEventListener('pointercancel',auditSafeCancelTouch,{capture:true,passive:true});
 document.addEventListener('click',auditSafeSuppressDelayedClick,true);
}

function auditSafeEnhanceRenderedUI(){
 if(!auditSafeCanEnhanceDom())return;
 auditSafeEnhanceBrand();
 auditSafeEnhanceOtherDestinations();
 auditSafeEnhanceLoadButtons();
 auditSafeEnhanceRiderClear();
 auditSafeEnhanceAccessibility();
 auditSafeBindFastTouch();
}

const auditSafeOriginalRender=render;
render=function(options={}){
 if(auditSafeCanEnhanceDom()){
  const current=document.querySelector('.other-destinations');
  if(current)auditSafeOtherDestinationsOpen=current.open;
 }
 auditSafeOriginalRender(options);
 auditSafeEnhanceRenderedUI();
};

const auditSafeOriginalHandleAction=handleAction;
handleAction=async function(action,key,target,dest){
 try{
  if(action==='load-toggle'){
   const row=deliveryPlan(state).eligible.find(item=>item.key===key&&item.dest===dest);
   if(!row)throw Error('Producto no habilitado para carga');
   const location=key+'@'+dest,loaded=Number(state.load?.[location])||0;
   if(loaded<row.allowed-1e-8)return auditSafeOriginalHandleAction('load',key,target,dest);
   if(deliveryBusy)throw Error('Hay otra operación en curso. Comprueba su resultado.');
   if(CLOUD_ENABLED&&!cloudCanEdit())throw Error('La nube debe estar lista antes de corregir la carga.');
   delete state.load[location];
   commit('Carga desmarcada; no se modificó el reparto ni la compra');
   return;
  }
  if(action==='clear-rider'){
   if(deliveryBusy)throw Error('Hay otra operación en curso. Comprueba su resultado.');
   if(CLOUD_ENABLED&&!cloudCanEdit())throw Error('La nube debe estar lista antes de quitar el repartidor.');
   if(!state.riderAssignments?.[key])return;
   delete state.riderAssignments[key];
   commit('Repartidor quitado; pedidos, compras y bajadas permanecen intactos');
   return;
  }
  return await auditSafeOriginalHandleAction(action,key,target,dest);
 }catch(error){
  toastMessage='ERROR: '+(error?.message||String(error));
  render();
 }
};

if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
 window.addEventListener('resize',auditSafeEnhanceBrand,{passive:true});
}

// Aplicar la migración acumulativa también a la copia que ya estaba cargada
// antes de que este complemento terminase de ejecutarse.
state=normalizeRuntimeState(state);
render();
