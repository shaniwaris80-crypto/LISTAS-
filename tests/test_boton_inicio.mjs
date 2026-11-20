import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script=src.match(/<script>([\s\S]*?)<\/script>/)?.[1].replace('const ARSLAN_CLOUD_ACTIVE = Boolean(', 'const ARSLAN_CLOUD_ACTIVE = false && Boolean(');
assert.ok(script, 'HTML con JS integrado');
const html={innerHTML:''};
const stored=new Map();
let allow=false;
let pasteVal='';
const ctx=vm.createContext({
 console,
 structuredClone,
 URL,
 Blob,
 navigator:{clipboard:{writeText:async()=>{}}},
 localStorage:{getItem:(k)=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
 confirm:()=>allow,
 prompt:()=>null,
 alert:()=>{},
 window:{scrollTo(){},open(){}},
 document:{getElementById:(id)=>id==='app'?html:{value:pasteVal},addEventListener(){},querySelectorAll:()=>[]},
 setTimeout:()=>{},
});
vm.runInContext(script,ctx);
assert.match(html.innerHTML,/data-action="clearday"/);
assert.match(html.innerHTML,/>Limpiar día<\/button>/);
const before=vm.runInContext('structuredClone(state)',ctx);
assert.equal(before.orders.length,91);
assert.match(html.innerHTML,/¿Empezar pedidos nuevos\?/);
await vm.runInContext("handleAction('clearday','','','')",ctx);
assert.equal(vm.runInContext('state.orders.length',ctx),91, 'cancelar no borra');
allow=true;
await vm.runInContext("handleAction('clearday','','','')",ctx);
const after=vm.runInContext('structuredClone(state)',ctx);
for(const k of ['orders','allocations','manual','receipts','sentMessages','importedFingerprints'])assert.deepEqual(after[k],[],`Limpia ${k}`);
for(const k of ['delivery','load','riderAssignments'])assert.deepEqual(after[k],{},`Limpia ${k}`);
for(const k of ['catalog','destinations','aliases','riders'])assert.deepEqual(after[k],before[k],`Conserva ${k}`);
assert.equal(after.history.length,before.history.length+1,'Archiva anterior');
assert.equal(after.history.at(-1).orders.length,91,'Historial conserva los pedidos');
assert.equal(stored.size,1, 'La demo guarda sólo en su propia clave');
assert.match(html.innerHTML,/Día limpiado y archivado/);
assert.match(html.innerHTML,/data-action="clearday"/);
await vm.runInContext("handleAction('clearday','','','')",ctx);
assert.equal(vm.runInContext('state.history.length',ctx),1,'No archivar jornada vacía');
pasteVal='PEDIDO ST\n2 TOMATE RAMA';
await vm.runInContext("handleAction('import','','','')",ctx);
assert.equal(vm.runInContext('state.orders.length',ctx),1);
assert.equal(vm.runInContext('state.orders[0].dest',ctx),'ST');
console.log('PRUEBAS BOTÓN INICIO: 13 condiciones correctas: visible, confirmar, cancelar, preservar datos maestros, archivar, nueva lista ST.');