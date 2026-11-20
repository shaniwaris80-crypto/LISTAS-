// Conexión segura de ARSLAN LISTAS a Supabase (auth OTP + RLS + CAS).
const ARSLAN_CLOUD_ACTIVE = Boolean(ARSLAN_CLOUD_CONFIG.url && ARSLAN_CLOUD_CONFIG.publishableKey);
const ARSLAN_SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.113.0/+esm';
async function createArslanCloudAdapter(config=ARSLAN_CLOUD_CONFIG) {
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url))throw Error('La URL del proyecto Supabase no está configurada correctamente');
 if(!config.publishableKey.startsWith('sb_publishable_')&&!config.publishableKey.startsWith('eyJ'))throw Error('Configura solo la clave pública (publishable/anon). No introduzcas claves secretas.');
 const sdk=await import(ARSLAN_SUPABASE_CDN);
 const client=sdk.createClient(config.url.replace(/\/$/,''),config.publishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'arslan_listas_sync_auth_v1'}
 });
 let userId=null;
 function ensureUser(){if(!userId)throw Error('Inicia sesión para sincronizar');return userId;}
 function check({data,error}){if(error)throw Error(error.message||'Error de Supabase');return data;}
 return {
  client,
  setUser(id){userId=id;},
  onAuthChange(listener){return client.auth.onAuthStateChange((event,session)=>{queueMicrotask(()=>listener(event,session));}).data.subscription;},
  async session(){const {data,error}=await client.auth.getSession();if(error)throw Error(error.message);return data.session;},
  async sendLogin(email){const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname,shouldCreateUser:true}});if(error)throw Error(error.message);},
  async signOut(){const {error}=await client.auth.signOut();if(error)throw Error(error.message);userId=null;},
  async read(){
    const {data,error}=await client.from('arslan_documents').select('revision,data,updated_at')
      .eq('owner_id',ensureUser()).maybeSingle();check({data,error});
    if(!data)return null;
    return {revision:Number(data.revision),data:data.data,updated_at:data.updated_at};
  },
  async create(state){
    const owner_id=ensureUser();const {data,error}=await client.from('arslan_documents').insert({owner_id,revision:1,data:state})
      .select('revision,data,updated_at').single();check({data,error});
    return {revision:Number(data.revision),data:data.data,updated_at:data.updated_at};
  },
  async update(state,expectedRevision){
    const {data,error}=await client.from('arslan_documents').update({data:state,revision:expectedRevision+1})
      .eq('owner_id',ensureUser()).eq('revision',expectedRevision).select('revision,updated_at').maybeSingle();check({data,error});
    return data?{revision:Number(data.revision),updated_at:data.updated_at}:null;
  },
  watch(callback){
    const channel=client.channel('arslan-doc-'+ensureUser()).on('postgres_changes',{
      event:'*',schema:'public',table:'arslan_documents',filter:'owner_id=eq.'+userId
    },()=>callback()).subscribe();
    return ()=>{void client.removeChannel(channel);};
  }
 };
}