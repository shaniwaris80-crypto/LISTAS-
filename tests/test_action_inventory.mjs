import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const handler=ui.slice(ui.indexOf('async function handleAction('),ui.indexOf("document.addEventListener('keydown'"));
assert.ok(handler.length>1000,'No se encontró el manejador completo de acciones');

const groups={
 session_team:[
  'unlock-access','lock-access','team-copy-id','team-add','team-revoke','team-join',
  'cloud-login','cloud-signup','cloud-reset','cloud-refresh','cloud-init','cloud-use-remote',
  'cloud-publish-local','cloud-logout','cloud-legacy-export','cloud-backup','cloud-choose-import','cloud-import-local'
 ],
 navigation:[
  'goto','purchasefilter','goto-additional','delivery-select','order-filter','order-open',
  'toggle-paste','filter','selprov','breakdown'
 ],
 additional_orders:['additional-step','additional-buy','additional-undo'],
 purchases:[
  'purchase-step','purchase-toggle','purchase-confirm','purchase-undo','purchase-save',
  'manual-undo-all','manual-copy-pending','manual-download-pending','manual-wa-pending',
  'buyall','buy','buyedit'
 ],
 orders:[
  'newdest','destedit','destadd','destcopy','destdownload','destwa','import','replace',
  'suggest','create','editname','qty','destqty'
 ],
 suppliers:[
  'assign','unassign','copy','copyall','provdownload','provdownloadall','whatsapp','sent','reopensent'
 ],
 warehouse_delivery:['load','deliver','deliver-step','deliverpartial','undodelivery','shortage','extra','rider'],
 day_and_backup:['clearday','newday','export']
};
const registry=Object.entries(groups).flatMap(([group,actions])=>actions.map(action=>({action,group})));
const registryNames=registry.map(x=>x.action);
assert.equal(new Set(registryNames).size,registryNames.length,'Hay acciones duplicadas en el inventario');

const cases=[...handler.matchAll(/case '([^']+)'/g)].map(m=>m[1]);
const uniqueCases=[...new Set(cases)].sort();
const missingRegistry=uniqueCases.filter(x=>!registryNames.includes(x));
const missingHandler=registryNames.filter(x=>!uniqueCases.includes(x));
assert.deepEqual(missingRegistry,[],`Acciones del código sin clasificar: ${missingRegistry.join(', ')}`);
assert.deepEqual(missingHandler,[],`Acciones esperadas que ya no existen: ${missingHandler.join(', ')}`);

const emitters=new Set([
 ...[...ui.matchAll(/btn\('([^']+)'/g)].map(m=>m[1]),
 ...[...ui.matchAll(/data-action=\\?"([^"\\]+)\\?"/g)].map(m=>m[1]),
 ...[...ui.matchAll(/data-action=\\?'([^'\\]+)\\?'/g)].map(m=>m[1])
]);
const ignoredEmitters=new Set(['']);
// Los atributos construidos con plantillas como data-action="${action}" se
// resuelven en tiempo de ejecución y no constituyen una acción literal.
const orphanEmitters=[...emitters].filter(x=>x&&!ignoredEmitters.has(x)&&!x.includes('${')&&!uniqueCases.includes(x)).sort();
assert.deepEqual(orphanEmitters,[],`Botones o controles sin manejador: ${orphanEmitters.join(', ')}`);

const sensitive={
 'team-revoke':['confirm('],
 'team-join':['confirm(','download('],
 'cloud-init':['confirm(','download('],
 'cloud-use-remote':['confirm(','download('],
 'cloud-publish-local':['confirm(','download('],
 'cloud-logout':['confirm(','download('],
 'cloud-import-local':['confirm(','download('],
 'additional-undo':['confirm('],
 'manual-undo-all':['confirm('],
 'replace':['confirm('],
 'sent':['confirm('],
 'reopensent':['confirm('],
 'buyall':['prompt('],
 'clearday':['confirm(','prompt(','download('],
 'newday':['confirm(','download(']
};
for(const [action,requirements] of Object.entries(sensitive)){
 const start=handler.indexOf(`case '${action}'`);
 assert.ok(start>=0,`No está la acción sensible ${action}`);
 const next=handler.indexOf("\n case '",start+8);
 const block=handler.slice(start,next<0?handler.length:next);
 for(const token of requirements)assert.ok(block.includes(token),`${action} debe contener ${token}`);
}

assert.ok(!ui.includes("case 'resetdemo'"),'No debe existir una acción que reemplace datos reales por una demo');
assert.ok(!ui.includes('localStorage.clear()'),'La interfaz no debe borrar todo el almacenamiento del navegador');
assert.ok(!/setItem\([^\n]*password/i.test(ui),'La contraseña no debe guardarse en localStorage');
const waStart=handler.indexOf("case 'whatsapp'");
const waEnd=handler.indexOf("case 'sent'",waStart);
assert.ok(waStart>=0&&waEnd>waStart);
assert.ok(!handler.slice(waStart,waEnd).includes('markSupplierSent'),'Abrir WhatsApp no debe marcar como enviado');
assert.ok(handler.includes("if(action==='replace'&&!confirm"),'Sustituir listas exige confirmación');
assert.ok(handler.includes("if(deliveryBusy&&!readonly.includes(action)"),'Debe bloquear dobles operaciones mientras Firebase confirma');

mkdirSync(new URL('../audit-output/',import.meta.url),{recursive:true});
const report={
 generatedAt:new Date().toISOString(),
 totalActions:uniqueCases.length,
 groups:Object.fromEntries(Object.entries(groups).map(([name,actions])=>[name,{count:actions.length,actions}])),
 uiEmitters:[...emitters].filter(x=>x&&!x.includes('${')).sort(),
 handlerActions:uniqueCases,
 safetyChecks:Object.keys(sensitive),
 status:'PASS'
};
writeFileSync(new URL('../audit-output/action-inventory.json',import.meta.url),JSON.stringify(report,null,2));
console.log(`INVENTARIO DE ACCIONES: ${uniqueCases.length} acciones clasificadas; 0 botones huérfanos; protecciones sensibles correctas`);
for(const [name,actions] of Object.entries(groups))console.log(` - ${name}: ${actions.length}`);
