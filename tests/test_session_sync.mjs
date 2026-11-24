import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';
import * as M from '../motor.mjs';
import {SyncEngine} from '../sync-core.mjs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const script=read('index.html').match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'El compilado incluye JavaScript');
new Script(script,{filename:'arslan-listas-next.js'});
const app={innerHTML:''};
const indicator={hidden:true,textContent:''};
const state=M.createState();M.importBlocks(state,'PEDIDO SP\n2 TOMATE RAMA');
const initial=structuredClone(state);
const store=new Map([['arslan_listas_reparto_seguro_v5_local_only',JSON.stringify(state)]]);
const ctx=createContext({
 console,structuredClone,URL,Blob,setTimeout,clearTimeout,
 navigator:{onLine:true},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 window:{addEventListener(){},scrollTo(){}},
 document:{getElementById:id=>id==='app'?app:id==='operation-indicator'?indicator:null,
  querySelectorAll:()=>[],addEventListener(){},hidden:false},
 confirm:()=>false,prompt:()=>null,alert:()=>{}
});
// No conectar Firebase realmente en pruebas. Comprobar las pantallas por separado.
runInContext(script.replace(/void bootCloud\(\);\s*$/,''),ctx);
runInContext(`cloudUser={id:'test-user-abcdefghijklmnop',email:'operador@example.com'};
 cloudStatus='permiso_denegado';
 cloudMessage='Firebase denegó el guardado';
 cloudEngine={dirty:true,conflict:null,revision:2,keepLocal(){}};
 render();`,ctx);
assert.match(app.innerHTML,/Entrar a mis listas/);
assert.match(app.innerHTML,/operador@example.com/);
assert.doesNotMatch(app.innerHTML,/Mi jornada/);
await runInContext("handleAction('unlock-access','','','')",ctx);
assert.match(app.innerHTML,/Cuenta y sincronización/);
assert.match(app.innerHTML,/ACCESO DENEGADO/);
assert.match(app.innerHTML,/Cambios locales sin subir/);
assert.match(app.innerHTML,/Descargar copia/);
assert.match(app.innerHTML,/Abrir reglas de Firebase/);
assert.match(app.innerHTML,/data-action="goto" data-key="cuenta"/);
await runInContext("handleAction('purchasefilter','additional','','')",ctx);
assert.equal(runInContext("purchaseView",ctx),'additional');
await runInContext("handleAction('lock-access','','','')",ctx);
assert.match(app.innerHTML,/Entrar a mis listas/);
assert.deepEqual(JSON.parse(JSON.stringify(runInContext('state',ctx))).orders,initial.orders,'Bloquear nunca borra pedidos');
runInContext("setOperationBusy(true,'Guardando…')",ctx);
assert.equal(indicator.hidden,false);
assert.equal(indicator.textContent,'Guardando…');
runInContext('setOperationBusy(false)',ctx);
assert.equal(indicator.hidden,true);

// Los errores de formato no son una caída de Internet y bloquean nuevas
// escrituras, manteniendo visibles la copia local y su descarga.
runInContext(`accessUnlocked=true;tab='cuenta';cloudStatus='datos_invalidos';
 cloudMessage='Firebase ha devuelto datos incompatibles. Se conserva la copia local.';
 render();`,ctx);
assert.match(app.innerHTML,/ERROR DE DATOS/);
assert.doesNotMatch(app.innerHTML,/SIN CONEXIÓN/);
assert.match(app.innerHTML,/Descargar copia JSON/);
assert.equal(runInContext('cloudCanEdit()',ctx),false);
assert.deepEqual(JSON.parse(JSON.stringify(runInContext('state',ctx))).orders,initial.orders,
 'Mostrar el error de formato conserva los pedidos locales');

// Reproducir una caché escrita por el adaptador anterior: RTDB había omitido
// las listas y mapas vacíos, también dentro del historial y de cada pedido.
const omitFirebaseEmpty=value=>{
 if(value===null||value===undefined)return undefined;
 if(Array.isArray(value))return value.length?value.map(omitFirebaseEmpty):undefined;
 if(typeof value==='object'){
  const entries=Object.entries(value).map(([key,item])=>[key,omitFirebaseEmpty(item)])
   .filter(([,item])=>item!==undefined);
  return entries.length?Object.fromEntries(entries):undefined;
 }
 return value;
};
const cacheBase=M.createState();
cacheBase.day='2026-11-23';
M.importBlocks(cacheBase,'PEDIDO SP\n2 TOMATE RAMA');
M.newDay(cacheBase,'2026-11-24');
M.importBlocks(cacheBase,'PEDIDO SP\n1 KIWI ZESPRI');
const oldBase=omitFirebaseEmpty(cacheBase),oldLocal=structuredClone(oldBase);
oldLocal.orders[0].q=3;
assert.equal(oldBase.history[0].manual,undefined,'La caché reproduce listas omitidas del archivo');
assert.equal(oldBase.orders[0].issues,undefined,'La caché reproduce listas omitidas de cada línea');
const remoteState=structuredClone(cacheBase);
M.importBlocks(remoteState,'PEDIDO SL\n4 TOMATE RAMA');
const fixtureUser='cachetest1234567890abcdef';
const cacheKey='arslan_listas_reparto_seguro_v5_local_only:user:'+fixtureUser+':team:'+fixtureUser;
const cachedJSON=JSON.stringify({state:oldLocal,meta:{revision:7,base:oldBase,schema:1}});
store.set(cacheKey,cachedJSON);
let releaseRead;
const pendingRead=new Promise(resolve=>{releaseRead=resolve;});
let cachedRemote={revision:8,data:remoteState},cacheWrites=0;
// Mock del contrato del adaptador; se ejecutan beginCloudUser y SyncEngine
// reales, sin iniciar Firebase ni acceder a datos de producción.
ctx.fixtureUser=fixtureUser;
ctx.testAdapter={
 setUser(){},setWorkspaceOwner(){},async listMembers(){return [];},
 async read(){await pendingRead;return structuredClone(cachedRemote);},
 async update(next,revision){
  assert.equal(revision,cachedRemote.revision,'El reintento conserva la revisión CAS vigente');
  cacheWrites++;
  cachedRemote={revision:revision+1,data:structuredClone(next)};
  return structuredClone(cachedRemote);
 }
};
const sessionStart=runInContext(`cloudEngine=null;cloudUser=null;cloudAdapter=testAdapter;
 beginCloudUser({uid:fixtureUser,email:'cache@example.com'});`,ctx);
try{
 assert.equal(store.get(cacheKey),cachedJSON,'La normalización en memoria no reemplaza la copia antes de leer la nube');
 assert.equal(runInContext('cloudEngine.base.history[0].manual.length',ctx),0);
 assert.equal(runInContext('cloudEngine.base.orders[0].issues.length',ctx),0);
 assert.equal(runInContext('state.history[0].manual.length',ctx),0);
 releaseRead();await sessionStart;
 assert.equal(runInContext('cloudStatus',ctx),'pendiente','Las formas vacías no provocan un conflicto de historial');
 assert.equal(runInContext('cloudEngine.dirty',ctx),true,'La modificación local sigue pendiente de envío');
 assert.equal(runInContext('cloudEngine.local.orders.find(line=>line.dest==="SP").q',ctx),3);
 assert.equal(runInContext('cloudEngine.local.orders.find(line=>line.dest==="SL").q',ctx),4);
 await runInContext('cloudEngine.refresh(true)',ctx);
 assert.equal(runInContext('cloudStatus',ctx),'sincronizado');
 assert.equal(runInContext('cloudEngine.dirty',ctx),false);
 assert.equal(cacheWrites,1,'Solo se envía una combinación confirmada');
 assert.equal(cachedRemote.data.orders.find(line=>line.dest==='SP').q,3,'Se conserva el cambio local');
 assert.equal(cachedRemote.data.orders.find(line=>line.dest==='SL').q,4,'Se conserva el pedido del otro dispositivo');
 assert.deepEqual(cachedRemote.data.history,cacheBase.history,'El historial permanece completo y sin duplicarse');
 const savedCache=JSON.parse(store.get(cacheKey));
 assert.equal(savedCache.meta.revision,9);
 assert.deepEqual(savedCache.state,cachedRemote.data,'La copia local conserva el documento confirmado');
}finally{
 releaseRead();await sessionStart;
 runInContext('cloudEngine?.stop()',ctx);
}

let readCount=0,writeCount=0,denied=true;
const remote={revision:1,data:M.createState()};
const engine=new SyncEngine({
 adapter:{
  async read(){readCount++;return structuredClone(remote);},
  async update(next,revision){
   writeCount++;
   if(denied){const e=new Error('permission_denied');e.code='PERMISSION_DENIED';throw e;}
   remote.revision=revision+1;remote.data=structuredClone(next);return structuredClone(remote);
  }
 },
 initialState:structuredClone(remote.data),onApply(){},persist(){},setDelay:600000
});
await engine.start();
engine.keepLocal({...remote.data,day:'2026-11-25'});
await engine.flush();
assert.equal(engine.status,'permiso_denegado');
assert.equal(engine.dirty,true,'Los cambios siguen locales');
const oldWrites=writeCount;
await engine.refresh();
assert.equal(writeCount,oldWrites,'No reintentar en bucle una escritura denegada');
denied=false;
await engine.refresh(true);
assert.equal(engine.status,'sincronizado','Reintento expreso recupera el servicio');
assert.equal(engine.dirty,false);
assert.equal(remote.data.day,'2026-11-25');
engine.stop();
const rules=JSON.parse(read('database.rules.json')).rules.arslanListas['arslan-listas-next-v1'].$owner.document;
assert.ok(rules['.write'].includes('auth.uid === $owner'),'No se abren los permisos privados');
assert.ok(!rules['.validate'].includes("['day','orders','destinations','catalog']"),'Las jornadas vacías no exigen orders');
assert.ok(rules['.validate'].includes("['day','destinations','catalog']"));
console.log('CUENTA Y SINCRONIZACIÓN: sesión, permisos, formato y recuperación de caché correctos');
