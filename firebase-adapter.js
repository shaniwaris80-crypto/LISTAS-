// Adaptador de Firebase Realtime Database (misma arquitectura que Ruta Madrid).
// Snapshot privado por UID con versión CAS para evitar pisar otro dispositivo.
/**
 * RTDB omite listas vacías al guardar ([] y {}).
 * Recupera campos vacíos ausentes, conserva el contenido real y rechaza
 * estructuras incompatibles para no borrar pedidos, compras ni bajadas.
 */
function cloudDataError(message){
 const error=new Error(message);
 error.code='INVALID_CLOUD_DATA';
 return error;
}
function hydrateCloudDocumentState(input){
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const invalid=field=>cloudDataError('Campo de jornada incompatible: '+field+'. Se conserva la copia local.');
 // Identificar una jornada real antes de restaurar sus colecciones vacías.
 // Un documento ausente o dañado nunca se convierte en una jornada nueva.
 if(!object(input)||typeof input.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.day))
  throw cloudDataError('Documento de jornada inválido; se conserva la copia local');
 for(const field of ['catalog','destinations'])if(!Array.isArray(input[field]))throw invalid(field);
 const restore=(value,arrays,maps,path)=>{
  if(!object(value))throw invalid(path);
  const result={...value};
  for(const field of arrays){
   if(result[field]===undefined||result[field]===null)result[field]=[];
   else if(!Array.isArray(result[field]))throw invalid(path+'.'+field);
  }
  for(const field of maps){
   if(result[field]===undefined||result[field]===null)result[field]={};
   else if(!object(result[field]))throw invalid(path+'.'+field);
  }
  // También desaparecen las listas vacías de cada línea y del historial.
  // Restaurarlas evita conflictos falsos con la copia guardada en el navegador.
  if(arrays.includes('orders'))result.orders=result.orders.map((line,index)=>{
   const order=restore(line,['issues','suggestions'],[],path+'.orders['+index+']');
   if(order.q===undefined)order.q=null; // Cantidad pendiente de confirmar.
   return order;
  });
  return result;
 };
 const state=restore(input,
  ['orders','allocations','manual','receipts','history','sentMessages','importedFingerprints','riders'],
  ['aliases','delivery','load','shortageAllocation','riderAssignments'],'data');
 state.history=state.history.map((entry,index)=>restore(entry,
  ['orders','allocations','manual','receipts','sentMessages'],
  ['delivery','load','shortageAllocation','riderAssignments'],'data.history['+index+']'));
 return state;
}
const FIREBASE_SDK_VERSION='12.16.0'; // versión usada en RUTA1 como referencia de compatibilidad
const FIREBASE_SDK_BASE=`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
async function createArslanCloudAdapter(config=ARSLAN_FIREBASE_CONFIG) {
 if(!config || !config.apiKey || !config.projectId || !config.appId ||
    !/^https:\/\/[a-z0-9-]+(?:-default-rtdb)?(?:\.[a-z0-9-]+)?\.firebasedatabase\.app\/?$|^https:\/\/[a-z0-9-]+\.firebaseio\.com\/?$/.test(config.databaseURL)) {
   throw Error('Configura Firebase Realtime Database para LISTAS antes de sincronizar');
 }
 const [appSDK,authSDK,dbSDK]=await Promise.all([
  import(FIREBASE_SDK_BASE+'/firebase-app.js'),
  import(FIREBASE_SDK_BASE+'/firebase-auth.js'),
  import(FIREBASE_SDK_BASE+'/firebase-database.js')
 ]);
 const app=appSDK.getApps().find(a=>a.name==='arslan-listas-next')||appSDK.initializeApp(config,'arslan-listas-next');
 const auth=authSDK.getAuth(app),db=dbSDK.getDatabase(app);
 await authSDK.setPersistence(auth,authSDK.browserLocalPersistence);
 let currentUid=null, workspaceOwner=null;
 const authUser=()=>{
   const actual=auth.currentUser?.uid;
   if(!currentUid || currentUid!==actual)throw Error('La sesión ha cambiado. Vuelve a iniciar sesión.');
   return currentUid;
 };
 const workspacePath=()=>`arslanListas/${ARSLAN_FIREBASE_WORKSPACE}/${workspaceOwner||authUser()}`;
 const docPath=()=>`${workspacePath()}/document`;
 const validUid=id=>typeof id==='string'&&/^[A-Za-z0-9]{16,128}$/.test(id);
 const normalize=(obj)=>{
   if(obj===null||obj===undefined)return null;
   const rev=obj.revision;
   if(typeof obj!=='object'||Array.isArray(obj)||!Number.isSafeInteger(rev)||rev<1||!obj.data)
    throw cloudDataError('Los datos recibidos de Firebase no tienen un formato válido');
   return {revision:rev,data:hydrateCloudDocumentState(obj.data),updated_at:obj.updated_at||null};
 };
 const {ref,get,set,onValue,runTransaction}=dbSDK;
 return {
  setUser(id){if(currentUid!==id)workspaceOwner=id;currentUid=id;},
  setWorkspaceOwner(uid){if(!validUid(uid))throw Error('ID de equipo inválido');workspaceOwner=uid;},
  getWorkspaceOwner(){return workspaceOwner||authUser();},
  async addMember(uid){if(!validUid(uid))throw Error('ID de trabajador inválido');if((workspaceOwner||authUser())!==authUser())throw Error('Solo el propietario puede autorizar trabajadores');if(uid===authUser())throw Error('Ya eres propietario');await set(ref(db,workspacePath()+'/members/'+uid),true);},
  async revokeMember(uid){if(!validUid(uid))throw Error('ID de trabajador inválido');if((workspaceOwner||authUser())!==authUser())throw Error('Solo el propietario puede retirar accesos');await set(ref(db,workspacePath()+'/members/'+uid),false);},
  async listMembers(){if((workspaceOwner||authUser())!==authUser())return [];const snap=await get(ref(db,workspacePath()+'/members'));const data=snap.val()||{};return Object.keys(data).filter(uid=>data[uid]===true);},
  onAuthChange(listener){
   return authSDK.onAuthStateChanged(auth,user=>listener(user?'SIGNED_IN':'SIGNED_OUT',user?{user}:null),error=>listener('AUTH_ERROR',{error}));
  },
  async session(){await auth.authStateReady();return auth.currentUser?{user:auth.currentUser}:null;},
  async sendLogin(email,password){
   if(!email?.trim()||!password)throw Error('Introduce correo y contraseña');
   await authSDK.signInWithEmailAndPassword(auth,email.trim(),password);
  },
  async signUp(email,password){
   if(!email?.trim()||!password||password.length<8)throw Error('Introduce un correo y una contraseña de al menos ocho caracteres');
   await authSDK.createUserWithEmailAndPassword(auth,email.trim(),password);
  },
  async resetPassword(email){
   if(!email?.trim())throw Error('Introduce primero tu correo');
   await authSDK.sendPasswordResetEmail(auth,email.trim());
  },
  async signOut(){await authSDK.signOut(auth);currentUid=null;},
  async read(){
   const snap=await get(ref(db,docPath()));
   return snap.exists()?normalize(snap.val()):null;
  },
  async create(state){
   const location=ref(db,docPath());
   const tx=await runTransaction(location,old=>old==null?{revision:1,data:state,updated_at:Date.now()}:undefined,{applyLocally:false});
   if(!tx.committed)throw Error('La nube ya contiene datos. No se sobrescribió nada.');
   return normalize(tx.snapshot.val());
  },
  async update(state,expectedRevision){
   const location=ref(db,docPath());
   const tx=await runTransaction(location,old=>{
    if(old?.revision===expectedRevision){
     // Un reintento explícito tampoco debe sobrescribir un documento dañado.
     normalize(old);
     return {revision:expectedRevision+1,data:state,updated_at:Date.now()};
    }
    return undefined;
   },{applyLocally:false});
   return tx.committed?normalize(tx.snapshot.val()):null;
  },
  /** Cada tick se procesa dentro de UNA transacción sobre el documento vigente.
   * El SDK reintenta si otro repartidor guardó entre la lectura y la escritura.
   * Un tick tardío sobre la misma fila queda rechazado, nunca se duplica.
   */
  async mutateDelivery(operation){
   const location=ref(db,docPath());
   const first=await get(location);
   if(!first.exists())throw Error('No hay jornada sincronizada todavía');
   let outcome={changed:false,code:'NO_DISPONIBLE'};
   const tx=await runTransaction(location,old=>{
    if(!old||!old.data||!Number.isSafeInteger(old.revision)){outcome={changed:false,code:'NO_DISPONIBLE'};return;}
    const draft=hydrateCloudDocumentState(structuredClone(old.data));
    const result=applyDeliveryMutation(draft,operation);
    outcome=result;
    if(!result.changed)return;
    return {revision:old.revision+1,data:draft,updated_at:Date.now()};
   },{applyLocally:false});
   if(tx.committed)return {...outcome,document:normalize(tx.snapshot.val())};
   const latest=await get(location);
   return {...outcome,document:latest.exists()?normalize(latest.val()):null};
  },
  /** Cambiar cantidad de una tienda en la última versión de Firebase.
   * Un segundo clic obsoleto no pisa el cambio de otra persona.
   */
  async mutateDemand(operation){
   const location=ref(db,docPath());
   let outcome={changed:false,code:'NO_DISPONIBLE'};
   const tx=await runTransaction(location,old=>{
    if(!old||!old.data||!Number.isSafeInteger(old.revision)){
     outcome={changed:false,code:'NO_DISPONIBLE'};return;
    }
    const draft=hydrateCloudDocumentState(structuredClone(old.data));
    const result=adjustDestinationDemand(draft,operation.key,operation.dest,operation.delta,{
     expectedQuantity:operation.expectedQuantity,day:operation.day,historyLength:operation.historyLength});
    outcome=result;
    if(!result.changed)return;
    return {revision:old.revision+1,data:draft,updated_at:Date.now()};
   },{applyLocally:false});
   if(tx.committed)return {...outcome,document:normalize(tx.snapshot.val())};
   const latest=await get(location);
   return {...outcome,document:latest.exists()?normalize(latest.val()):null};
  },
  watch(callback){
   let first=true;
   const unsub=onValue(ref(db,docPath()),()=>{
     if(first){first=false;return;}
     callback();
   },err=>{console.error('LISTAS Firebase Realtime:',err?.code||err?.message);callback();});
   return unsub;
  }
 };
}
