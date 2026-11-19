/**
 * Contrato de integración para la versión real de ARSLAN LISTAS Next.
 * No es un reemplazo directo de lib/domain.ts: adaptar las entidades y claves
 * de la versión publicada antes de enchufarlo. Esta función es pura.
 */
export type LineaPedido = {
  productId:string; unit:string; destinationId:string; quantity:number;
};
export type LineaProveedor = {
  productId:string; unit:string; quantity:number;
  status:'draft'|'prepared'|'sent'|'received'|'cancelled';
};
export type CompraManual = {
  productId:string; unit:string; quantity:number; confirmed:boolean;
};
export type Bajada = {
  productId:string; unit:string; destinationId:string; quantity:number;
};
export type DistribucionFaltante = {
  productId:string; unit:string; destinationId:string; quantity:number;
};
export type LineaReparto = {
  productId:string; unit:string; destinationId:string;
  requested:number; allowed:number; delivered:number; remaining:number;
};
export type Disponibilidad = {
  pendientes:LineaReparto[];
  bajadas:LineaReparto[];
  bloqueados:{productId:string;unit:string;reason:string}[];
  revisar:{productId:string;unit:string;authorized:number;requested:number;reason:string}[];
};
const num=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000;
const key=(productId:string,unit:string)=>JSON.stringify([productId,unit]);

/** Regla vigente: no autoriza reparto un proveedor simplemente asignado.
 * Autoriza pedidos con status sent/received (enviados explícitamente)
 * o compras manuales confirmed. CARGA NO INTERVIENE.
 */
export function prepararRepartoSeguro(input:{
 orders:LineaPedido[];
 allocations:LineaProveedor[];
 manual:CompraManual[];
 delivered:Bajada[];
 shortageDistribution?:DistribucionFaltante[];
}):Disponibilidad{
 const grouped=new Map<string,{productId:string;unit:string;requested:number;dest:Map<string,number>}>();
 for(const o of input.orders){
  if(!(Number.isFinite(o.quantity)&&o.quantity>0))continue;
  const k=key(o.productId,o.unit),g=grouped.get(k)||{productId:o.productId,unit:o.unit,requested:0,dest:new Map()};
  g.requested=num(g.requested+o.quantity);
  g.dest.set(o.destinationId,num((g.dest.get(o.destinationId)||0)+o.quantity));
  grouped.set(k,g);
 }
 const pendientes:LineaReparto[]=[],bajadas:LineaReparto[]=[],bloqueados:Disponibilidad['bloqueados']=[],revisar:Disponibilidad['revisar']=[];
 for(const [k,g] of grouped){
  const sent=input.allocations.filter(a=>key(a.productId,a.unit)===k&&['sent','received'].includes(a.status)).reduce((n,a)=>n+a.quantity,0);
  const manual=input.manual.filter(a=>key(a.productId,a.unit)===k&&a.confirmed).reduce((n,a)=>n+a.quantity,0);
  const authorized=num(sent+manual);
  if(authorized<=0){bloqueados.push({productId:g.productId,unit:g.unit,reason:'SIN ENVÍO A PROVEEDOR NI COMPRA MANUAL'});continue;}
  const distribution=new Map(input.shortageDistribution?.filter(x=>key(x.productId,x.unit)===k).map(x=>[x.destinationId,x.quantity])||[]);
  const missing=authorized<g.requested;
  if(missing&&g.dest.size>1&&distribution.size!==g.dest.size){revisar.push({productId:g.productId,unit:g.unit,authorized,requested:g.requested,reason:'CONFIRMAR DISTRIBUCIÓN DEL FALTANTE'});continue;}
  if(distribution.size){
   let total=0;
   for(const [destId,qty] of distribution){
    if(!Number.isFinite(qty)||qty<0||qty>(g.dest.get(destId)||0))throw Error('Distribución inválida para '+g.productId);
    total+=qty;
   }
   if(total>authorized+1e-8)throw Error('Distribución excede cantidad autorizada de '+g.productId);
  }
  let left=authorized;
  for(const [destinationId,requested] of [...g.dest].sort(([a],[b])=>a.localeCompare(b))){
   const proposal=missing&&g.dest.size>1?(distribution.get(destinationId)||0):requested;
   const allowed=num(Math.min(requested,left,proposal));left=num(Math.max(0,left-allowed));
   if(allowed<=0)continue;
   const delivered=num(input.delivered.filter(d=>key(d.productId,d.unit)===k&&d.destinationId===destinationId).reduce((n,d)=>n+d.quantity,0));
   if(delivered>allowed+1e-8)throw Error('Bajada superior a lo autorizado: '+g.productId);
   const record={productId:g.productId,unit:g.unit,destinationId,requested,allowed,delivered,remaining:num(allowed-delivered)};
   if(record.remaining>0)pendientes.push(record); else bajadas.push(record);
  }
 }
 return {pendientes,bajadas,bloqueados,revisar};
}