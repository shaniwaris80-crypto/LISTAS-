import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SyncEngine,mergeStates,same} from '../sync-core.mjs';
import {createState,importBlocks,totals,newDay} from '../motor.mjs';
let passed=0;const check=(name,fn)=>{fn();passed++;};
function database(){
 let doc=null,reads=0,writes=0,throwNext=false;
 return {
  get document(){return structuredClone(doc);},get writes(){return writes;},
  get reads(){return reads;}, set offline(v){throwNext=v;},
  adapter:{
   async read(){reads++;if(throwNext)throw Error('Red caída');return structuredClone(doc);},
   async create(data){if(doc)throw Error('Duplicado');doc={revision:1,data:structuredClone(data)};return structuredClone(doc);},
   async update(data,revision){if(throwNext)throw Error('Red caída');if(doc.revision!==revision)return null;doc={revision:revision+1,data:structuredClone(data)};writes++;return structuredClone(doc);}
  }
 };
}
const fresh=()=>createState();
function createEngine(db,local,meta=null,hasLocal=false){
 let applied=structuredClone(local),status='',stored;
 const engine=new SyncEngine({adapter:db.adapter,initialState:local,meta,hasLocal,
  onApply(next){applied=structuredClone(next);},onStatus(s){status=s;},persist(state,meta){stored={state,meta};},setDelay:999999});
 return {engine,get applied(){return applied;},get status(){return status;},get stored(){return stored;}};
}
check('equal ignores order in object keys',()=>assert.ok(same({a:1,b:{c:2}},{b:{c:2},a:1})));
check('equal detects changed array order',()=>assert.ok(!same([1,2],[2,1])));
check('merge independent dictionary edits',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.aliases['GRNNY']='MANZANA GRANNY SMITH';r.aliases['MANZ']='MANZANA GOLDEN 24';
 const m=mergeStates(b,a,r);assert.equal(m.ok,true);assert.equal(Object.keys(m.value.aliases).length,2);
});
check('merge two independent shop orders by stable IDs',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.orders.push({id:'line_A',dest:'SP',product:'TOMATE RAMA',q:3,unit:'BULTO'});
 r.orders.push({id:'line_B',dest:'SL',product:'TOMATE RAMA',q:2,unit:'BULTO'});
 const m=mergeStates(b,a,r);assert.equal(m.ok,true);assert.equal(m.value.orders.length,2);
});
check('merge refuses changes to same order quantity',()=>{
 let b=fresh();b.orders.push({id:'A',dest:'SP',product:'TOMATE RAMA',q:1});let a=structuredClone(b),r=structuredClone(b);a.orders[0].q=4;r.orders[0].q=5;
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('merge refuses simultaneous day reset and order insert',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);newDay(a,'2026-12-01');r.orders.push({id:'B',dest:'SP',product:'TOMATE RAMA',q:2});
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('merge refuses provider assignment versus manual purchase',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.allocations.push({id:'as1',key:'TOMATE RAMA|BULTO',q:2,supplier:'ESMO'});
 r.manual.push({id:'m1',key:'TOMATE RAMA|BULTO',q:2});
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('new catalog items are merged',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);a.catalog.push('PERA EDEN');r.catalog.push('MANZANA EXTRA');
 let m=mergeStates(b,a,r);assert.equal(m.ok,true);assert.ok(m.value.catalog.includes('PERA EDEN'));assert.ok(m.value.catalog.includes('MANZANA EXTRA'));
});
check('catalog deletions are protected from simultaneous additions',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);a.catalog.pop();r.catalog.push('KIWI EXTRA');
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('simultaneous same product assignments are flagged',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.allocations.push({id:'a1',key:'TOMATE RAMA|BULTO',q:1,supplier:'ESMO'});
 r.allocations.push({id:'a2',key:'TOMATE RAMA|BULTO',q:2,supplier:'MONTENEGRO'});
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('simultaneous same product manual purchases are flagged',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.manual.push({id:'m1',key:'TOMATE RAMA|BULTO',q:1});
 r.manual.push({id:'m2',key:'TOMATE RAMA|BULTO',q:1});
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('a second pasted copy of one fingerprint requires review',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 a.importedFingerprints.push('PEDIDO SP 1 TOMATE RAMA');r.importedFingerprints.push('PEDIDO SP 1 TOMATE RAMA');
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('same-date limpiar dia versus other change never merges',()=>{
 let b=fresh(),a=structuredClone(b),r=structuredClone(b);
 b.orders.push({id:'1',dest:'SP',product:'TOMATE RAMA',q:1});a=structuredClone(b);r=structuredClone(b);
 newDay(a,b.day);r.orders.push({id:'2',dest:'SL',product:'KIWI ZESPRI',q:1});
 assert.equal(mergeStates(b,a,r).ok,false);
});
check('schema secures anon users with RLS',()=>{
 const sql=readFileSync(new URL('../sql/001_sync.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
 assert.ok(sql.includes('REVOKE ALL ON public.arslan_documents FROM anon'));
 assert.ok(sql.includes('auth.uid()'));
 assert.ok(sql.includes('ALTER PUBLICATION supabase_realtime'));
});
check('client config never includes privileged secret',()=>{
 const conf=readFileSync(new URL('../cloud-config.js',import.meta.url),'utf8');
 assert.ok(conf.includes("url: ''"));assert.ok(conf.includes("publishableKey: ''"));
});
check('unique IDs do not repeat across calls',()=>{
 let a=fresh();importBlocks(a,'PEDIDO SP\n2 TOMATE RAMA\n1 TOMATE RAMA');assert.notEqual(a.orders[0].id,a.orders[1].id);
});

// Scenario 1: A writes, B fetches remotely; no force overwrite.
const db=database(),A=createEngine(db,fresh());await A.engine.start();
assert.equal(A.status,'sincronizado');
check('first authenticated device initializes empty cloud',()=>assert.equal(db.document.revision,1));
const B=createEngine(db,fresh());await B.engine.start();
check('second device fetches same initial state',()=>assert.ok(same(A.engine.local,B.engine.local)));
let s1=structuredClone(A.engine.local);importBlocks(s1,'PEDIDO SP\n3 TOMATE RAMA');A.engine.keepLocal(s1);await A.engine.flush();
check('first device writes remote revision 2',()=>assert.equal(db.document.revision,2));
await B.engine.refresh();
check('second device receives first device order',()=>assert.equal(B.engine.local.orders[0].dest,'SP'));
check('second device displays count from cloud',()=>assert.equal(totals(B.engine.local).find(x=>x.product==='TOMATE RAMA').total,3));
// Scenario 2: concurrent independent edits on different stores auto merge.
const s2=structuredClone(B.engine.local);importBlocks(s2,'PEDIDO SL\n2 TOMATE RAMA');B.engine.keepLocal(s2);
const s3=structuredClone(A.engine.local);importBlocks(s3,'PEDIDO ST\n1 BROCOLI');A.engine.keepLocal(s3);
await A.engine.flush();await B.engine.flush();
check('concurrent independent shops merge in cloud',()=>assert.deepEqual(db.document.data.orders.map(x=>x.dest).sort(),['SL','SP','ST']));
check('cloud revision increases without overwriting',()=>assert.equal(db.document.revision,4));
await A.engine.refresh();
check('both devices eventually see merged totals',()=>assert.deepEqual(A.engine.local.orders.map(x=>x.dest).sort(),['SL','SP','ST']));
// Scenario 3: same line conflict is surfaced rather than overwritten.
const baseA=structuredClone(A.engine.local),baseB=structuredClone(B.engine.local);
baseA.orders.find(x=>x.dest==='SP').q=9; A.engine.keepLocal(baseA);
baseB.orders.find(x=>x.dest==='SP').q=10;B.engine.keepLocal(baseB);
await A.engine.flush(); await B.engine.flush();
check('same line concurrent edit stops with conflict',()=>assert.equal(B.engine.status,'conflicto'));
check('conflict never overwrites remote',()=>assert.equal(db.document.data.orders.find(x=>x.dest==='SP').q,9));
await B.engine.useRemote();
check('user can resolve conflict with remote version',()=>assert.equal(B.engine.local.orders.find(x=>x.dest==='SP').q,9));
// Scenario 4: offline edits stay local and later reach cloud.
db.offline=true;let offlineState=structuredClone(A.engine.local);offlineState.aliases['PRUEBA']='TOMATE RAMA';A.engine.keepLocal(offlineState);await A.engine.flush();
check('network failure marked offline',()=>assert.equal(A.engine.status,'sin_conexion'));
check('offline edits never falsely reported synced',()=>assert.equal(db.document.data.aliases['PRUEBA'],undefined));
db.offline=false;await A.engine.refresh();
check('offline edit synchronizes once back online',()=>assert.equal(db.document.data.aliases['PRUEBA'],'TOMATE RAMA'));
check('saved meta is tied to confirmed revision',()=>assert.equal(A.stored.meta.revision,db.document.revision));
// Scenario 5: new unpaired local dataset is never automatically uploaded.
const newdb=database(),local=fresh();local.orders.push({id:'private',dest:'SP',product:'KIWI ZESPRI',q:12});
const C=createEngine(newdb,local,null,true);await C.engine.start();
check('initial local data requires explicit import',()=>assert.equal(C.status,'importar'));
check('local data not auto uploaded',()=>assert.equal(newdb.document,null));
await C.engine.initializeFromLocal();
check('explicit import preserves local data',()=>assert.equal(newdb.document.data.orders[0].q,12));
for(const e of [A,B,C])e.engine.stop();
console.log('PRUEBAS SINCRONIZACIÓN: '+passed+' correctas');