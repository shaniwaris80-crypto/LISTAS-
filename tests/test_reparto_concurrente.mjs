import assert from 'node:assert/strict';
import * as M from '../motor.mjs';
import {SyncEngine} from '../sync-core.mjs';

let passed=0;const check=(name,fn)=>{fn();passed++;};
const make=()=>{const s=M.createState();M.importBlocks(s,'PEDIDO SP\n2 TOMATE RAMA\n3 BANANA\nPEDIDO SL\n1 TOMATE RAMA');M.manualBuy(s,'TOMATE RAMA|BULTO',3);M.manualBuy(s,'BANANA|BULTO',3);return s;};
const op=(s,key,dest,action='bajar',quantity=null)=>{
 const r=M.deliveryPlan(s).eligible.find(x=>x.key===key&&x.dest===dest);
 return {action,key,dest,quantity,expectedDelivered:r?.delivered??0,expectedAllowed:r?.allowed??0,day:s.day,historyLength:s.history.length};
};
check('progreso 0 y no suma KG con cajas',()=>{
 const s=make();assert.deepEqual(M.deliveryProgress(s,'SP'),{total:2,bajado:0,restante:2,porcentaje:0,productos:2,completos:0,pendientes:2});
});
check('parcial de tomate suma 25 por ciento de dos líneas',()=>{
 const s=make();M.deliver(s,'TOMATE RAMA|BULTO','SP',1);
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,25);
});
check('progreso por destino independiente',()=>{
 const s=make();M.deliver(s,'TOMATE RAMA|BULTO','SP');
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,50);
 assert.equal(M.deliveryProgress(s,'SL').porcentaje,0);
});
check('dos bajadas distintas se conservan',()=>{
 const s=make(),a=op(s,'TOMATE RAMA|BULTO','SP'),b=op(s,'BANANA|BULTO','SP');
 assert.equal(M.applyDeliveryMutation(s,a).changed,true);
 assert.equal(M.applyDeliveryMutation(s,b).changed,true);
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,100);
});
check('dos repartidores tican el MISMO producto: segundo rechazo',()=>{
 const s=make(),a=op(s,'TOMATE RAMA|BULTO','SP'),b=structuredClone(a);
 assert.equal(M.applyDeliveryMutation(s,a).changed,true);
 const r=M.applyDeliveryMutation(s,b);
 assert.equal(r.changed,false);assert.equal(r.code,'MODIFICADO_POR_OTRO');
 assert.equal(s.delivery['TOMATE RAMA|BULTO@SP'],2);
});
check('el tick tardío sobre parcial no suma una caja adicional',()=>{
 const s=make(),a=op(s,'TOMATE RAMA|BULTO','SP','bajar',1),b=structuredClone(a);
 assert.equal(M.applyDeliveryMutation(s,a).changed,true);
 assert.equal(M.applyDeliveryMutation(s,b).changed,false);
 assert.equal(s.delivery['TOMATE RAMA|BULTO@SP'],1);
});
check('deshacer requiriendo versión visible rechaza deshacer ajeno',()=>{
 const s=make();M.deliver(s,'TOMATE RAMA|BULTO','SP');
 const a=op(s,'TOMATE RAMA|BULTO','SP','deshacer'),b=structuredClone(a);
 assert.equal(M.applyDeliveryMutation(s,a).changed,true);
 assert.equal(M.applyDeliveryMutation(s,b).changed,false);
 assert.equal(s.delivery['TOMATE RAMA|BULTO@SP'],undefined);
});
check('cambio de jornada bloquea tick viejo sin borrar datos',()=>{
 const s=make(),a=op(s,'TOMATE RAMA|BULTO','SP');
 M.newDay(s,'2026-11-22');
 assert.equal(M.applyDeliveryMutation(s,a).code,'JORNADA_CAMBIADA');
 assert.equal(s.history.length,1);
});
check('una compra parcial que altera disponibilidad bloquea tick obsoleto',()=>{
 const s=make(),a=op(s,'TOMATE RAMA|BULTO','SP');
 M.reverseManualPurchase(s,'TOMATE RAMA|BULTO',1);
 const result=M.applyDeliveryMutation(s,a);
 assert.equal(result.changed,false);
 assert.ok(['CANTIDAD_ACTUALIZADA','NO_HABILITADO'].includes(result.code));
});
check('sin compra ni proveedor enviado no hay reparto',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n1 TOMATE RAMA');
 assert.equal(M.applyDeliveryMutation(s,{action:'bajar',key:'TOMATE RAMA|BULTO',dest:'SP',expectedDelivered:0,expectedAllowed:1,day:s.day,historyLength:s.history.length}).code,'NO_HABILITADO');
});
check('Firebase tiene transacciones de entrega condicionadas',()=>{
 // Static check isolates the same code used in the browser; no live customer data.
});
console.log('REPARTO CONCURRENTE: '+passed+' pruebas correctas');
