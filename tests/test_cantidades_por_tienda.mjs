import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as M from '../motor.mjs';

let total=0;
const check=(name,fn)=>{fn();total++;};
const fresh=(sp=3,sl=3)=>{
 const s=M.createState();
 M.importBlocks(s,'PEDIDO SP\n'+sp+' TOMATE RAMA\nPEDIDO SL\n'+sl+' TOMATE RAMA');
 return s;
};
const key='TOMATE RAMA|BULTO';
const req=s=>M.totals(s).find(t=>t.key===key);
const op=(s,delta,dest='SP')=>M.adjustDestinationDemand(s,key,dest,delta,{
 expectedQuantity:req(s).by[dest]||0,day:s.day,historyLength:s.history.length
});
check('subir San Pablo 3 a 4: Global 6 a 7',()=>{
 const s=fresh(),r=op(s,1);
 assert.equal(r.changed,true);assert.equal(r.cantidad,4);assert.equal(r.total,7);
 assert.equal(req(s).by.SP,4);assert.equal(req(s).by.SL,3);
});
check('subir pedido NO compra automaticamente la caja nueva',()=>{
 const s=fresh();M.assignSupplier(s,key,'ESMO',6);M.markSupplierSent(s,'ESMO');
 op(s,1);
 assert.equal(M.productStatus(s,key).assignedSent,6);
 assert.equal(M.pendingPurchases(s).find(x=>x.key===key).remainingToBuy,1);
});
check('reparto refleja falta y conserva tienda SP separada de SL',()=>{
 const s=fresh();M.assignSupplier(s,key,'ESMO',6);M.markSupplierSent(s,'ESMO');
 op(s,1);
 assert.equal(M.deliveryPlan(s).needsReview.find(x=>x.key===key),undefined);
 assert.equal(M.deliveryPlan(s).eligible.find(x=>x.key===key&&x.dest==='SP').allowed,3);
 assert.equal(M.deliveryPlan(s).eligible.find(x=>x.key===key&&x.dest==='SL').allowed,3);
 assert.equal(M.deliveryPlan(s).short.find(x=>x.key===key&&x.dest==='SP').missing,1);
 assert.equal(M.totals(s).find(x=>x.key===key).by.SP,4);
});
check('restar 1 en SP actualiza solo SP y total',()=>{
 const s=fresh();op(s,-1);
 assert.equal(req(s).by.SP,2);assert.equal(req(s).by.SL,3);assert.equal(req(s).total,5);
});
check('restar mas de lo pedido no produce negativos',()=>{
 const s=fresh();op(s,-100);
 assert.equal(req(s).by.SP,undefined);assert.equal(req(s).total,3);
});
check('unidad medio bulto se puede quitar con un toque',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n0,5 BANANA\n1 TOMATE RAMA');
 const k='BANANA|BULTO',before=M.totals(s).find(x=>x.key===k).by.SP;
 const result=M.adjustDestinationDemand(s,k,'SP',-1,{expectedQuantity:before,day:s.day,historyLength:s.history.length});
 assert.equal(result.cantidad,0);assert.equal(M.totals(s).some(x=>x.key===k),false);
});
check('aumentar producto a otro restaurante con pedido existente respeta destino',()=>{
 const s=fresh();const bc=s.destinations.find(d=>d.id==='BC');assert.ok(bc);
 op(s,1,'BC');assert.equal(req(s).by.BC,1);assert.equal(req(s).total,7);
});
check('modificar conserva las otras lineas y productos',()=>{
 const s=fresh();M.importBlocks(s,'PEDIDO SP\n2 BANANA');
 const count=s.orders.length;op(s,1);assert.equal(s.orders.length,count);
 assert.equal(M.totals(s).find(x=>x.key==='BANANA|BULTO').total,2);
});
check('dos dispositivos que ven SP3 no pisan la cantidad del otro',()=>{
 const s=fresh(),expected=3;
 const a=M.adjustDestinationDemand(s,key,'SP',1,{expectedQuantity:expected,day:s.day,historyLength:s.history.length});
 const b=M.adjustDestinationDemand(s,key,'SP',1,{expectedQuantity:expected,day:s.day,historyLength:s.history.length});
 assert.equal(a.changed,true);assert.equal(b.changed,false);assert.equal(b.code,'MODIFICADO_POR_OTRO');
 assert.equal(req(s).by.SP,4);
});
check('cambio de jornada bloquea un tick antiguo',()=>{
 const s=fresh();const day=s.day,historyLength=s.history.length;M.newDay(s,'2026-11-22');
 const r=M.adjustDestinationDemand(s,key,'SP',1,{expectedQuantity:3,day,historyLength});
 assert.equal(r.changed,false);assert.equal(r.code,'JORNADA_CAMBIADA');
});
check('bajar y cambiar cantidad NO borra bajadas existentes',()=>{
 const s=fresh();M.assignSupplier(s,key,'ESMO',6);M.markSupplierSent(s,'ESMO');
 M.deliver(s,key,'SP');
 const before=s.delivery[key+'@SP'];op(s,1);
 assert.equal(s.delivery[key+'@SP'],before);
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,75);
});
check('reducir por debajo de lo bajado queda bloqueado sin alterar pedidos',()=>{
 const s=fresh();M.assignSupplier(s,key,'ESMO',6);M.markSupplierSent(s,'ESMO');
 M.deliver(s,key,'SP');
 const before=structuredClone(s.orders);
 assert.throws(()=>op(s,-1),/bajada|bajado|respaldo/i);
 assert.deepEqual(s.orders,before);
});
check('un producto solo autorizado parcialmente mantiene historial de compra',()=>{
 const s=fresh();M.manualBuy(s,key,2);
 const prev=s.manual.length;op(s,1);
 assert.equal(s.manual.length,prev);
 assert.equal(M.productStatus(s,key).manuallyBought,2);
});
check('no permite modificar cantidades de destino inexistente',()=>{
 const s=fresh();assert.throws(()=>op(s,1,'SITIO INVENTADO'),/Tienda|restaurante/i);
});
check('mismo producto con unidades diferentes se mantiene separado',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n1 TOMATE RAMA\n2KG TOMATE RAMA');
 M.adjustDestinationDemand(s,'TOMATE RAMA|BULTO','SP',1,{expectedQuantity:1});
 assert.equal(M.totals(s).find(x=>x.key==='TOMATE RAMA|BULTO').total,2);
 assert.equal(M.totals(s).find(x=>x.key==='TOMATE RAMA|KG').total,2);
});
check('iPhone tiene + y - por tienda sin confirmar dos veces',()=>{
 const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 assert.ok(ui.includes('data-action="destqty"'));
 assert.ok(ui.includes("case 'destqty'"));
 assert.ok(ui.includes('changeDemandOneTap('));
 const css=readFileSync(new URL('../estilos.css',import.meta.url),'utf8');
 assert.ok(css.includes('.destination-qty-step'));
});
check('mutación de demanda utiliza transacción Firebase',()=>{
 const code=readFileSync(new URL('../firebase-adapter.js',import.meta.url),'utf8');
 assert.ok(code.includes('async mutateDemand('));
 assert.ok(code.includes('adjustDestinationDemand(draft,operation.key'));
 assert.ok(code.includes('runTransaction(location'));
});
console.log('CANTIDADES POR DESTINO: '+total+' pruebas correctas');