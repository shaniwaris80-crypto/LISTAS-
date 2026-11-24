import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SyncEngine,same} from '../sync-core.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const code=read('firebase-adapter.js'),config=read('firebase-config.js'),ui=read('ui.js'),rules=JSON.parse(read('database.rules.json'));
let n=0;const check=(name,okay)=>{assert.ok(okay,name);n++};
check('Firebase project separate from Madrid',!config.includes('v9madrid')&&!config.includes('449478080600'));
check('Firebase config has no administrative secrets',!config.includes('serviceAccount')&&!config.includes('private_key')&&!config.includes('service_role'));
check('Firebase project configured to independent LISTAS',config.includes("projectId: 'arslan-listas-next'")&&config.includes('arslan-listas-next-default-rtdb.europe-west1.firebasedatabase.app'));
check('Uses Realtime Database',code.includes('firebase-database.js')&&code.includes('getDatabase('));
check('Uses Firebase Authentication',code.includes('firebase-auth.js')&&code.includes('signInWithEmailAndPassword'));
check('Uses Firebase password recovery',code.includes('sendPasswordResetEmail'));
check('Uses Firebase create account',code.includes('createUserWithEmailAndPassword'));
check('Does not auto upload over existing remote',code.includes('old==null?')&&code.includes('runTransaction('));
check('Uses server-side CAS on revision',code.includes('old?.revision===expectedRevision'));
check('Realtime subscription',code.includes('onValue('));
check('Workspace Firebase path scoped to owner UID',code.includes('workspacePath()')&&code.includes('getWorkspaceOwner'));
check('Realtime rules allow only owner or explicitly listed members',rules.rules.arslanListas['arslan-listas-next-v1'].$owner.document['.read'].includes('auth.uid === $owner')&&rules.rules.arslanListas['arslan-listas-next-v1'].$owner.document['.write'].includes('members')&&rules.rules.arslanListas['arslan-listas-next-v1'].$owner.members.$member['.write'].includes('auth.uid === $owner'));
check('Atomic delivery transaction used',code.includes('async mutateDelivery(')&&code.includes('runTransaction(location')&&code.includes('applyDeliveryMutation('));
check('Login UI asks for password not email link',ui.includes('id="cloud-password"')&&ui.includes("case 'cloud-login':case 'cloud-signup':case 'cloud-reset'"));
check('Existing local storage key retained',ui.includes("const KEY='arslan_listas_reparto_seguro_v5_local_only'"));
check('Firebase UID is used for cloud access',ui.includes('user?.uid||user?.id')&&ui.includes('cloudAdapter.setUser(userId)'));
check('Legacy data detected when user logs in',ui.includes('hasLocal:hasRecord||hasLegacy'));
check('Legacy backup available before login',ui.includes("case 'cloud-legacy-export'"));
check('JSON export works',ui.includes('cloud-backup'));
check('JSON import for cross origin migration',ui.includes('cloud-import-file'));
check('JSON import blocks overwrite of existing orders',ui.includes('Ya hay pedidos en la nube. No importamos encima'));
check('First upload requires user approval',ui.includes("case 'cloud-init'")&&ui.includes('confirm('));
check('Conflict requires explicit choice',ui.includes("case 'cloud-publish-local'")&&ui.includes('copia de la nube'));
// RTDB elimina arrays vacíos: simular documento antiguo sin campos opcionales.
const {createState,deliveryPlan,applyDeliveryMutation,adjustDestinationDemand,totals,importBlocks,newDay}=await import('../motor.mjs');
const hydrate=new Function('createState',code+'; return hydrateCloudDocumentState;')(createState);
const complete=createState();
const legacy={day:complete.day,orders:[{id:'line-1',dest:'SP',q:2,product:'TOMATE RAMA',unit:'BULTO',review:false}],destinations:complete.destinations,
 catalog:complete.catalog,allocations:[{id:'alloc-1',key:'TOMATE RAMA|BULTO',q:2,status:'sent',supplier:'ESMO'}],
 history:[],customField:{important:'retain'},delivery:{}};
const snapshot=structuredClone(legacy);
const hydrated=hydrate(legacy);
check('RTDB missing arrays restored for transactions',Array.isArray(hydrated.manual)&&Array.isArray(hydrated.receipts)&&Array.isArray(hydrated.sentMessages));
check('Historical data and unknown fields preserved',JSON.stringify(legacy)===JSON.stringify(snapshot)&&JSON.stringify(hydrated.customField)===JSON.stringify(legacy.customField));
const row=deliveryPlan(hydrated).eligible.find(x=>x.dest==='SP');
check('Bajar +1 works with RTDB missing empty arrays',!!row&&applyDeliveryMutation(hydrated,{action:'ajustar',key:row.key,dest:'SP',quantity:1,expectedDelivered:0,expectedAllowed:2,day:hydrated.day,historyLength:0}).changed);
const demanded=hydrate(snapshot);
check('Subir cantidad +1 works with RTDB missing empty arrays',adjustDestinationDemand(demanded,'TOMATE RAMA|BULTO','SP',1,{expectedQuantity:2,day:demanded.day,historyLength:0}).changed&&totals(demanded)[0].total===3);
check('Malformed arrays reject writes rather than deleting purchases',(()=>{try{hydrate({...legacy,manual:{bad:'value'}});return false}catch{return true}})());

// Reproducir el valor leído de RTDB, no conservar los [] y {} que solo existen
// en memoria. No se carga el SDK remoto ni se accede a Firebase de producción.
function firebaseValue(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='object')return value;
 const entries=Object.entries(value).map(([key,child])=>[key,firebaseValue(child)]).filter(([,child])=>child!==null);
 if(!entries.length)return null;
 if(Array.isArray(value)){
  const result=Array(Number(entries.at(-1)[0])+1).fill(null);
  for(const [key,child] of entries)result[Number(key)]=child;
  return result;
 }
 return Object.fromEntries(entries);
}
const emptyWire=firebaseValue(complete);
check('Fixture reproduces Firebase removing empty orders and maps',!Object.hasOwn(emptyWire,'orders')&&!Object.hasOwn(emptyWire,'delivery'));
const emptyHydrated=hydrate(emptyWire);
check('Existing empty day is a valid document after RTDB round trip',same(emptyHydrated,complete));
check('Explicit null empty orders is restored without resetting the day',same(hydrate({...emptyWire,orders:null}),complete));
for(const invalid of [[],{}, {...emptyWire,day:null},{...emptyWire,catalog:undefined},{...emptyWire,destinations:'SP'},
 {...emptyWire,orders:'damaged'},{...emptyWire,orders:{7:{id:'retained-order',q:4}}},
 {...emptyWire,manual:{bad:'purchase'}},{...emptyWire,delivery:[]}]){
 assert.throws(()=>hydrate(invalid),error=>error.code==='INVALID_CLOUD_DATA');n++;
}

const previousDay=createState();
importBlocks(previousDay,'PEDIDO SP\n2 TOMATE RAMA');
importBlocks(previousDay,'PEDIDO SP\nTOMATE RAMA');
check('Fixture contains a parsed order awaiting quantity confirmation',previousDay.orders[1].q===null&&previousDay.orders[1].review);
previousDay.manual.push({id:'manual-retained',key:'TOMATE RAMA|BULTO',q:2,confirmed:true});
previousDay.delivery['TOMATE RAMA|BULTO@SP']=1;
previousDay.customField={note:'Conservar campo desconocido',nested:{source:'local'}};
const clearedDay=structuredClone(previousDay);
newDay(clearedDay,'2026-12-01');
const clearedWire=firebaseValue(clearedDay);
check('Fixture drops empty lists inside archived history too',!Object.hasOwn(clearedWire.history[0],'allocations')&&!Object.hasOwn(clearedWire.history[0].orders[0],'issues'));
check('Fixture drops the unconfirmed null quantity in archived orders',!Object.hasOwn(clearedWire.history[0].orders[1],'q'));
const recoveredDay=hydrate(clearedWire);
check('Known archived empty fields restore the same cleared-day state',same(recoveredDay,clearedDay));
check('Archived unconfirmed quantity remains null and awaiting review',recoveredDay.history[0].orders[1].q===null&&recoveredDay.history[0].orders[1].review);
check('Archived purchases deliveries and unknown fields remain intact',same(recoveredDay.history[0].manual,previousDay.manual)&&same(recoveredDay.history[0].delivery,previousDay.delivery)&&same(recoveredDay.customField,previousDay.customField));
check('Hydration does not rewrite the original Firebase snapshot',same(clearedWire,firebaseValue(clearedDay)));

// Ejecutar los métodos públicos del adaptador con SDK falso, de forma que el
// filtro normalize también se compruebe tras read/create/update.
async function firebaseHarness(initial=null){
 let document=structuredClone(initial),attempts=0,commits=0;
 const snapshot=()=>({exists:()=>document!==null,val:()=>structuredClone(document)});
 const auth={currentUser:{uid:'testOwner0000000001'},authStateReady:async()=>{}};
 const sdk={
  app:{getApps:()=>[],initializeApp:()=>({name:'test'})},
  auth:{getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:'local'},
  db:{getDatabase:()=>({}),ref:(_db,path)=>path,get:async()=>snapshot(),set:async()=>{},
   onValue:(_ref,fn)=>{fn(snapshot());return ()=>{};},
   runTransaction:async(_ref,mutate)=>{
    attempts++;
    const next=mutate(structuredClone(document));
    if(next===undefined)return {committed:false,snapshot:snapshot()};
    document=firebaseValue(next);commits++;
    return {committed:true,snapshot:snapshot()};
   }}
 };
 const instrumented=code.replace(/import\(FIREBASE_SDK_BASE\+'\/firebase-(app|auth|database)\.js'\)/g,(_match,name)=>`Promise.resolve(sdk.${name==='database'?'db':name})`);
 assert.ok(!instrumented.includes('import(FIREBASE_SDK_BASE'),'All Firebase imports must be replaced before runtime tests');
 const makeAdapter=new Function('createState','applyDeliveryMutation','adjustDestinationDemand','ARSLAN_FIREBASE_WORKSPACE','sdk',instrumented+';return createArslanCloudAdapter;')(createState,applyDeliveryMutation,adjustDestinationDemand,'test-workspace',sdk);
 const adapter=await makeAdapter({apiKey:'test-no-network',projectId:'test',appId:'test',databaseURL:'https://test-default-rtdb.europe-west1.firebasedatabase.app'});
 adapter.setUser(auth.currentUser.uid);
 return {adapter,get document(){return structuredClone(document);},get attempts(){return attempts;},get commits(){return commits;}};
}
const db=await firebaseHarness();
check('Absent remote document remains absent',await db.adapter.read()===null);
const created=await db.adapter.create(complete);
check('Creating empty day accepts the committed Firebase snapshot',created.revision===1&&same(created.data,complete)&&db.commits===1);
check('Reading empty day accepts an omitted orders key',same((await db.adapter.read()).data,complete));
const populated=await db.adapter.update(previousDay,1);
check('Order empty metadata round trips through actual adapter',populated.revision===2&&same(populated.data,previousDay));
const cleared=await db.adapter.update(clearedDay,2);
check('Clearing day acknowledges saved revision and preserves archive',cleared.revision===3&&same(cleared.data,clearedDay)&&db.commits===3);
check('Stale revision does not replace existing saved state',await db.adapter.update(previousDay,2)===null&&same((await db.adapter.read()).data,clearedDay)&&db.commits===3);
for(const revision of [undefined,0,-1,1.5,'2',Number.MAX_SAFE_INTEGER+1]){
 const invalidVersion=await firebaseHarness({revision,data:emptyWire});
 await assert.rejects(invalidVersion.adapter.read(),error=>error.code==='INVALID_CLOUD_DATA');n++;
 check('Invalid revision is rejected without changing remote data',invalidVersion.commits===0);
}

// Antes de la corrección, la escritura podía haberse confirmado en Firebase
// y fallar al leer su resultado. Recuperar esa revisión sin repetir Limpiar día.
const committedWire={revision:8,data:firebaseValue(clearedDay),updated_at:1};
for(const mode of ['start','retry']){
 const recovery=await firebaseHarness(committedWire);
 let persisted;
 const engine=new SyncEngine({adapter:recovery.adapter,initialState:clearedDay,hasLocal:true,
  meta:{revision:7,base:structuredClone(previousDay)},setDelay:999999,
  persist:(state,meta)=>{persisted={state:structuredClone(state),meta:structuredClone(meta)};}});
 try{
  if(mode==='start')await engine.start();
  else {engine.dirty=true;engine.status='sin_conexion';await engine.refresh(true);}
  check('Already committed clear-day recovers on '+mode,engine.status==='sincronizado'&&!engine.dirty&&!engine.conflict&&engine.revision===8);
  check('Recovery retains every local item and one archive on '+mode,same(engine.local,clearedDay)&&engine.local.history.length===1&&same(persisted.state,clearedDay));
  check('Recovery acknowledges revision without a duplicate commit on '+mode,recovery.commits===0&&recovery.document.revision===8&&persisted.meta.revision===8);
 }finally{engine.stop();}
}

// Un documento dañado no es falta de Internet y nunca sustituye la copia local.
const corruptWire={revision:8,data:{...emptyWire,manual:{unrecognized:{q:99}}}};
const corrupt=await firebaseHarness(corruptWire);
await assert.rejects(corrupt.adapter.read(),error=>error.code==='INVALID_CLOUD_DATA');n++;
const pending=structuredClone(previousDay);pending.aliases['LOCAL SIN ENVIAR']='TOMATE RAMA';
const protectedEngine=new SyncEngine({adapter:corrupt.adapter,initialState:pending,hasLocal:true,meta:{revision:8,base:previousDay},setDelay:999999});
try{
 await protectedEngine.start();
 check('Invalid Firebase data is shown separately from offline',protectedEngine.status==='datos_invalidos');
 check('Invalid data preserves pending changes and prevents automatic writes',same(protectedEngine.local,pending)&&protectedEngine.dirty&&corrupt.commits===0&&same(corrupt.document,corruptWire));
 await protectedEngine.refresh();
 check('Invalid format does not automatically retry pending writes',corrupt.attempts===0&&protectedEngine.status==='datos_invalidos');
 await protectedEngine.refresh(true);
 check('Manual retry validates damaged cloud data even when its revision matches',corrupt.attempts===1&&corrupt.commits===0&&same(corrupt.document,corruptWire));
 check('Rejected manual retry preserves pending local changes',protectedEngine.status==='datos_invalidos'&&protectedEngine.dirty&&same(protectedEngine.local,pending)&&protectedEngine.revision===8);
}finally{protectedEngine.stop();}
console.log('PRUEBAS FIREBASE: '+n+' correctas');
