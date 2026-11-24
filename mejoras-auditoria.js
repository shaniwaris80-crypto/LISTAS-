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
 target.catalog.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 return target;
}

// Las copias antiguas conservan todo su contenido y reciben únicamente los
// nombres nuevos que falten. No se reemplaza el catálogo aprendido.
const auditSafeOriginalNormalizeRuntimeState=normalizeRuntimeState;
normalizeRuntimeState=function(value){
 return auditSafeAppendCatalog(auditSafeOriginalNormalizeRuntimeState(value));
};

let auditSafeOtherDestinationsOpen=null;

function auditSafeEnhanceBrand(){
 const brand=document.querySelector('.brand strong');
 if(!brand)return;
 brand.setAttribute('aria-label','ARSLAN LISTAS NEXT');
 brand.textContent=window.innerWidth<=850?'ARSLAN NEXT':'ARSLAN LISTAS NEXT';
}

function auditSafeEnhanceOtherDestinations(){
 if(tab!=='pedidos')return;
 const heading=[...document.querySelectorAll('main .sectionline h2')]
  .find(node=>node.textContent.trim()==='Otros destinos');
 const section=heading?.closest('.sectionline'),grid=section?.nextElementSibling;
 if(!section||!grid?.classList.contains('orders-grid'))return;
 const count=grid.querySelectorAll('.order-card').length;
 const details=document.createElement('details');
 details.className='other-destinations card';
 details.open=auditSafeOtherDestinationsOpen??window.innerWidth>850;
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
 for(const control of document.querySelectorAll('button[data-action="load"]')){
  const key=decodeURIComponent(control.dataset.key||''),dest=decodeURIComponent(control.dataset.dest||'');
  const row=deliveryPlan(state).eligible.find(item=>item.key===key&&item.dest===dest);
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
 if(tab!=='reparto')return;
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
 // Los botones sin tipo pueden enviar formularios accidentalmente si en el
 // futuro una tarjeta se integra dentro de un formulario.
 document.querySelectorAll('button:not([type])').forEach(button=>button.type='button');
 if(toastMessage){
  const notice=document.querySelector('main > .notice');
  if(notice){notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.setAttribute('aria-atomic','true');}
 }
}

function auditSafeEnhanceRenderedUI(){
 auditSafeEnhanceBrand();
 auditSafeEnhanceOtherDestinations();
 auditSafeEnhanceLoadButtons();
 auditSafeEnhanceRiderClear();
 auditSafeEnhanceAccessibility();
}

const auditSafeOriginalRender=render;
render=function(options={}){
 const current=document.querySelector('.other-destinations');
 if(current)auditSafeOtherDestinationsOpen=current.open;
 auditSafeOriginalRender(options);
 auditSafeEnhanceRenderedUI();
};

const auditSafeOriginalHandleAction=handleAction;
handleAction=async function(action,key,target,dest){
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
 return auditSafeOriginalHandleAction(action,key,target,dest);
};

window.addEventListener('resize',auditSafeEnhanceBrand,{passive:true});

// Aplicar la migración acumulativa también a la copia que ya estaba cargada
// antes de que este complemento terminase de ejecutarse.
state=normalizeRuntimeState(state);
render();
