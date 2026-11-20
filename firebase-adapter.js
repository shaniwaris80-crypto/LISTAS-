// Adaptador de Firebase Realtime Database (misma arquitectura que Ruta Madrid).
// Snapshot privado por UID con versión CAS para evitar pisar otro dispositivo.
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
 let currentUid=null;
 const authUser=()=>{
   const actual=auth.currentUser?.uid;
   if(!currentUid || currentUid!==actual)throw Error('La sesión ha cambiado. Vuelve a iniciar sesión.');
   return currentUid;
 };
 const docPath=()=>`arslanListas/${ARSLAN_FIREBASE_WORKSPACE}/${authUser()}/document`;
 const normalize=(obj)=>{
   if(!obj)return null;
   const rev=Number(obj.revision);
   if(!Number.isSafeInteger(rev) || rev<1 || !obj.data || !Array.isArray(obj.data.orders))throw Error('Los datos recibidos de Firebase no tienen un formato válido');
   return {revision:rev,data:obj.data,updated_at:obj.updated_at||null};
 };
 const {ref,get,onValue,runTransaction}=dbSDK;
 return {
  setUser(id){currentUid=id;},
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
   const tx=await runTransaction(location,old=>old?.revision===expectedRevision?
    {revision:expectedRevision+1,data:state,updated_at:Date.now()}:undefined,{applyLocally:false});
   return tx.committed?normalize(tx.snapshot.val()):null;
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