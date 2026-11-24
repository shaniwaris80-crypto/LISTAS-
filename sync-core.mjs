// ARSLAN LISTAS — motor de sincronización (independiente de la UI y del proveedor).
// Una instantánea con revisión CAS y fusión conservadora de cambios simultáneos.
export const SYNC_SCHEMA_VERSION = 1;

const clone = value => value === undefined ? undefined : structuredClone(value);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function syncFailureStatus(error){
 if(error?.code==='INVALID_CLOUD_DATA')return 'datos_invalidos';
 if(/permission[_ -]?denied/i.test(String(error?.code||'')+' '+String(error?.message||error)))return 'permiso_denegado';
 return 'sin_conexion';
}
function invalidCloudMessage(error){
 return 'Firebase ha respondido, pero no se puede interpretar la jornada. Los cambios locales se conservan: '+(error?.message||error);
}
export function same(a, b) {
  if (Object.is(a,b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length===b.length && a.every((v,i)=>same(v,b[i]));
  if (plain(a) && plain(b)) {
    const ak=Object.keys(a), bk=Object.keys(b);
    return ak.length===bk.length && ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
  }
  return false;
}

class MergeConflict extends Error {
  constructor(path){super('Conflicto en '+(path||'datos de la jornada'));this.path=path;}
}
function mergeById(base, local, remote, path) {
  const all=[...base,...local,...remote];
  if (!all.every(x=>plain(x) && typeof x.id==='string' && x.id)) throw new MergeConflict(path);
  const toMap = ar => {
    const m=new Map();for(const x of ar){if(m.has(x.id))throw new MergeConflict(path+': ID duplicado '+x.id);m.set(x.id,x);}return m;
  };
  const B=toMap(base), L=toMap(local), R=toMap(remote);
  const result=[];
  for(const id of new Set([...R.keys(),...L.keys(),...B.keys()])) {
    const merged=mergeAny(B.get(id),L.get(id),R.get(id),path+'/'+id);
    if(merged!==undefined)result.push(merged);
  }
  return result;
}
const unique = (items) => {
  const set=new Set(),result=[];
  for(const x of items){let key=JSON.stringify(x);if(!set.has(key)){set.add(key);result.push(clone(x));}}
  return result;
};
function mergeArray(base,local,remote,path){
 const field=path.split('/').pop();
 if(['orders','allocations','manual','receipts','destinations'].includes(field))return mergeById(base,local,remote,path);
 if(['catalog','riders','importedFingerprints'].includes(field)) {
   const unchanged=base.every(x=>local.some(y=>same(x,y)))&&base.every(x=>remote.some(y=>same(x,y)));
   if(!unchanged)throw new MergeConflict(path);
   return unique([...remote,...local]);
 }
 // Jornadas archivadas y mensajes son log append-only: permitir sólo apéndices no destructivos.
 if(['history','sentMessages'].includes(field)&&local.length>=base.length&&remote.length>=base.length&&base.every((x,i)=>same(x,local[i])&&same(x,remote[i]))) {
   return unique([...remote,...local.slice(base.length)]);
 }
 throw new MergeConflict(path);
}
function mergeAny(base,local,remote,path){
 if(same(local,base))return clone(remote);
 if(same(remote,base))return clone(local);
 if(same(local,remote))return clone(local);
 if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote))return mergeArray(base,local,remote,path);
 if(plain(base)&&plain(local)&&plain(remote)){
   const result={};
   for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
     const value=mergeAny(base[key],local[key],remote[key],path+'/'+key);
     if(value!==undefined)result[key]=value;
   }
   return result;
 }
 throw new MergeConflict(path);
}
export function mergeStates(base,local,remote){
 try {
   if (!plain(base)||!plain(local)||!plain(remote)) throw new MergeConflict('raíz');
   // Nunca mezclar limpiar día/cambiar jornada con escrituras del mismo día en otro terminal.
   const changedDayLocal=!same(base.day,local.day),changedDayRemote=!same(base.day,remote.day);
   if ((changedDayLocal && !same(remote,base)) || (changedDayRemote && !same(local,base)) ||
       (!same(base.history,local.history) && !same(remote,base)) ||
       (!same(base.history,remote.history) && !same(local,base)))throw new MergeConflict('jornada / Limpiar día');
   // Detectar el mismo producto o pedido editado a la vez, aunque los IDs de fila sean distintos.
   const touchedKeys=(field,version)=>{
     const old=new Map((base[field]||[]).map(x=>[x.id,x]));
     const changed=(version[field]||[]).filter(x=>!same(x,old.get(x.id)));
     return new Set(changed.map(x=>field==='orders'?[x.dest,x.product,x.unit].join('|'):x.key));
   };
   for(const field of ['orders','allocations','manual','receipts']){
     const left=touchedKeys(field,local),right=touchedKeys(field,remote);
     if([...left].some(x=>x&&right.has(x)))throw new MergeConflict('mismo producto o pedido editado simultáneamente ('+field+')');
   }
   const localFingerprints=(local.importedFingerprints||[]).filter(x=>!(base.importedFingerprints||[]).includes(x));
   const remoteFingerprints=(remote.importedFingerprints||[]).filter(x=>!(base.importedFingerprints||[]).includes(x));
   if(localFingerprints.some(x=>remoteFingerprints.includes(x)))throw new MergeConflict('mismo pedido pegado a la vez');
   // Asignar, comprar o corregir pedidos en paralelo puede cambiar la disponibilidad de un mismo producto.
   const touched=(doc,keys)=>keys.some(k=>!same(doc[k],base[k]));
   const operational=['orders','allocations','manual','receipts','shortageAllocation','delivery','load'];
   if((touched(local,['orders','allocations'])&&touched(remote,['manual','receipts','delivery','shortageAllocation']))||
      (touched(remote,['orders','allocations'])&&touched(local,['manual','receipts','delivery','shortageAllocation'])))
      throw new MergeConflict('compras/proveedores/reparto');
   return {ok:true,value:mergeAny(base,local,remote,'estado')};
 }catch(e){return {ok:false,reason:e.message||String(e),path:e.path||'estado'};}
}

/**
 * adapter.read(): {revision:number,data:object}|null
 * adapter.create(state): {revision:number,data:object}
 * adapter.update(next, expectedRevision): {revision:number}|null (null means CAS conflict)
 * adapter.watch(fn): unsubscriber (optional)
 * All callbacks are synchronous; adapter methods are asynchronous.
 */
export class SyncEngine {
  constructor({adapter,initialState,meta=null,hasLocal=false,onApply=()=>{},onStatus=()=>{},persist=()=>{},setDelay=600}) {
    this.adapter=adapter;this.local=clone(initialState);this.meta=meta;
    this.hasLocal=hasLocal;this.onApply=onApply;this.onStatus=onStatus;this.persist=persist;
    this.revision=meta?.revision??null;this.base=clone(meta?.base??null);
    this.status='conectando';this.message='Conectando a la nube';this.conflict=null;
    this.dirty=false;this.running=false;this.stopped=false;this.timer=null;this.unsubscribe=null;this.setDelay=setDelay;
    this.setStatus('conectando','Conectando a la nube');
  }
  setStatus(status,message=''){this.status=status;this.message=message;this.onStatus(status,message);}
  getMeta(){return this.revision===null?null:{revision:this.revision,base:clone(this.base),schema:SYNC_SCHEMA_VERSION};}
  apply(next){this.local=clone(next);this.onApply(clone(next));this.persist(clone(next),this.getMeta());}
  keepLocal(next){this.local=clone(next);this.dirty=true;this.persist(clone(next),this.getMeta());this.setStatus('pendiente','Cambios guardados en este dispositivo. Sincronizando…');this.schedule();}
  schedule(){if(this.stopped||!this.dirty||this.conflict||this.revision===null)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush();},this.setDelay);}
  async start(){
    try {
      const remote=await this.adapter.read();
      if(remote){await this.acceptRemote(remote);}
      else if(this.hasLocal){this.revision=null;this.base=null;this.setStatus('importar','La nube está vacía. Elige si quieres subir los datos de este dispositivo.');}
      else {this.revision=null;this.base=null;this.setStatus('esperando_origen','La nube está vacía. Para proteger tus pedidos, entra primero desde el ordenador que tiene las listas y pulsa «Subir los datos de este dispositivo».');}
      if(this.adapter.watch){this.unsubscribe=this.adapter.watch(()=>{if(!this.stopped)void this.refresh();});}
    }catch(err){
      if(this.revision!==null&&this.base)this.dirty=!same(this.local,this.base);
      const status=syncFailureStatus(err);
      if(status==='datos_invalidos')this.setStatus(status,invalidCloudMessage(err));
      else if(status==='permiso_denegado')this.setStatus(status,'Firebase ha rechazado la lectura por permisos. Se conserva la copia local.');
      else if(this.revision!==null&&this.base)this.setStatus('sin_conexion','Sin conexión; los cambios se guardan aquí y quedan pendientes');
      else this.setStatus('error','No se pudo leer la nube: '+(err?.message||err));
    }
  }
  async acceptRemote(remote){
    if(!Number.isSafeInteger(remote.revision)||remote.revision<1||!plain(remote.data)||!Array.isArray(remote.data.orders)){
      const error=new Error('Datos de nube no válidos');error.code='INVALID_CLOUD_DATA';throw error;
    }
    // Ya sincronizado y sin cambios pendientes: aceptar la última revisión
    // de Firebase, sin provocar conflictos contra la copia del primer inicio.
    if(this.revision!==null&&!this.dirty&&this.base&&same(this.local,this.base)){
      if(remote.revision<this.revision)return;
      this.revision=remote.revision;this.base=clone(remote.data);this.conflict=null;
      this.apply(remote.data);this.setStatus('sincronizado','Cambios del equipo recibidos');
      return;
    }
    if(this.hasLocal&&!same(this.local,remote.data)){
      if(this.base||this.meta?.base){
        const merged=mergeStates(this.base||this.meta.base,this.local,remote.data);
        if(merged.ok){this.revision=remote.revision;this.base=clone(remote.data);this.apply(merged.value);this.dirty=!same(this.local,remote.data);if(this.dirty){this.setStatus('pendiente','Se han combinado cambios independientes; guardando…');this.schedule();}else this.setStatus('sincronizado','Actualizado desde la nube');return;}
      }
      this.conflict={remote:clone(remote),local:clone(this.local)};this.revision=remote.revision;this.base=clone(remote.data);this.setStatus('conflicto','Hay datos diferentes en este dispositivo y en la nube. Elige una versión sin perder la copia local.');return;
    }
    this.revision=remote.revision;this.base=clone(remote.data);this.dirty=false;this.conflict=null;this.apply(remote.data);this.setStatus('sincronizado','Datos actualizados en los dispositivos');
  }
  async initializeFromLocal(){
    if(this.status!=='importar')throw Error('No hay una importación inicial pendiente');
    try{const created=await this.adapter.create(this.local);this.revision=created.revision;this.base=clone(created.data);this.dirty=false;this.conflict=null;this.persist(this.local,this.getMeta());this.setStatus('sincronizado','Datos de este dispositivo subidos a la nube');}
    catch(err){const remote=await this.adapter.read();if(remote)await this.acceptRemote(remote);else throw err;}
  }
  async refresh(force=false){
    // No repetir automáticamente fallos de permisos o formato cada 7 s.
    // Reintentar expresamente desde Cuenta y sincronización.
    if(this.stopped||this.running||this.status==='importar'||this.status==='conflicto')return;
    if(['permiso_denegado','datos_invalidos'].includes(this.status)&&!force)return;
    if(this.dirty){await this.flush();return;}
    this.running=true;
    try{const remote=await this.adapter.read();if(remote&&remote.revision!==this.revision){await this.acceptRemote(remote);}else if(this.revision!==null)this.setStatus('sincronizado','Sincronizado con la nube');}
    catch(err){
      const status=syncFailureStatus(err);
      this.setStatus(status,status==='datos_invalidos'?invalidCloudMessage(err):status==='permiso_denegado'?
        'Firebase ha rechazado la lectura o escritura por permisos. No borres datos; descarga una copia.':
        'Sin conexión: '+(err?.message||err));
    }
    finally{this.running=false;}
  }
  async flush(){
    if(this.stopped||this.running||!this.dirty||this.conflict||this.revision===null)return;
    clearTimeout(this.timer);this.running=true;
    try {
      for(let attempt=0;attempt<3;attempt++){
        const version=this.revision, draft=clone(this.local);
        const saved=await this.adapter.update(draft,version);
        if(saved){this.revision=saved.revision;this.base=draft;this.dirty=!same(this.local,draft);this.persist(this.local,this.getMeta());if(this.dirty){this.setStatus('pendiente','Hay cambios adicionales por guardar');}else this.setStatus('sincronizado','Cambios guardados en todos los dispositivos');return;}
        const remote=await this.adapter.read();if(!remote)throw Error('El documento remoto no existe');
        // Una versión anterior podía confirmar la transacción y fallar al leer
        // orders vacío. Reconocer ese guardado sin reenviarlo ni duplicar archivos.
        if(same(this.local,remote.data)){await this.acceptRemote(remote);return;}
        const merge=mergeStates(this.base,this.local,remote.data);
        if(!merge.ok){this.conflict={remote:clone(remote),local:clone(this.local)};this.setStatus('conflicto',merge.reason+' — se necesita revisión, no se ha sobrescrito la nube');return;}
        this.revision=remote.revision;this.base=clone(remote.data);this.apply(merge.value);
      }
      this.setStatus('pendiente','La nube cambió varias veces; reintenta sincronizar');
    }catch(err){
      const status=syncFailureStatus(err);
      this.setStatus(status,status==='datos_invalidos'?invalidCloudMessage(err):
       status==='permiso_denegado'?'Firebase denegó el guardado. Los datos quedan en este navegador; descarga una copia y revisa las reglas.':
       'No se pudo enviar a la nube; cambios guardados localmente: '+(err?.message||err));
    }
    finally{
      this.running=false;
      if(this.dirty&&!this.conflict&&!['sin_conexion','permiso_denegado','datos_invalidos'].includes(this.status))this.schedule();
    }
  }
  /** Incorporar una bajada confirmada atómicamente en Firebase. */
  applyConfirmedDocument(remote){
    if(!remote||!Number.isSafeInteger(remote.revision)||!remote.data)throw Error('Confirmación de Firebase inválida');
    if(this.dirty||this.conflict)throw Error('Hay cambios locales sin guardar; no se sustituyeron tus datos');
    if(this.revision!==null&&remote.revision<this.revision)return;
    this.revision=remote.revision;this.base=clone(remote.data);this.meta=this.getMeta();
    this.apply(remote.data);this.setStatus('sincronizado','Bajada confirmada en Firebase');
  }
  async useRemote(){
    if(!this.conflict)throw Error('No hay conflicto');
    const remote=this.conflict.remote;this.conflict=null;this.revision=remote.revision;this.base=clone(remote.data);this.dirty=false;this.apply(remote.data);this.setStatus('sincronizado','Versión de la nube recuperada');
  }
  async publishLocal(){
    if(!this.conflict)throw Error('No hay conflicto');
    const remote=await this.adapter.read();if(!remote)throw Error('No hay nube a la que publicar');
    this.conflict=null;this.revision=remote.revision;this.base=clone(remote.data);this.dirty=true;this.setStatus('pendiente','Publicando tu versión con confirmación…');await this.flush();
  }
  stop(){this.stopped=true;clearTimeout(this.timer);if(typeof this.unsubscribe==='function')this.unsubscribe();}
}
