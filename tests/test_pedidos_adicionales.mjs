import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../motor.mjs';

// Todos los escenarios usan un estado nuevo en memoria; jamás acceden a Firebase real.
const key='TOMATE RAMA|BULTO';
function setup(){
 const s=M.createState();
 M.importBlocks(s,'PEDIDO SP\n3 TOMATE RAMA\nPEDIDO SL\n2 TOMATE RAMA');
 M.assignSupplier(s,key,'ESMO',5);
 M.markSupplierSent(s,'ESMO');
 return s;
}
const allocations=s=>Object.fromEntries(M.deliveryPlan(s).eligible.filter(x=>x.key===key).map(x=>[x.dest,x.allowed]));
const add=(s,who='BRASEROS CENTRO',q=2)=>M.importBlocks(s,'PEDIDO '+who+'\n'+q+' TOMATE RAMA');
function buyAdditional(s,qty,dest='BC'){
 M.manualBuySafe(s,key,qty);
 s.manual.at(-1).additionalDest=dest;
 s.manual.at(-1).kind='compra-adicional';
}
test('01. Pedido tardío se identifica sin alterar el envío original',()=>{
 const s=setup(),before=M.supplierTXT(s,'ESMO');
 add(s);
 assert.equal(s.orders.filter(o=>o.kind==='pedido-adicional').length,1);
 assert.equal(M.supplierTXT(s,'ESMO'),before);
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'');
 assert.deepEqual(allocations(s),{SP:3,SL:2});
 assert.equal(M.deliveryPlan(s).short.find(r=>r.dest==='BC'&&r.key===key).missing,2);
});
test('02. Comprar ampliación reserva cantidad solo para el restaurante',()=>{
 const s=setup();add(s);buyAdditional(s,2);
 assert.deepEqual(allocations(s),{SP:3,SL:2,BC:2});
 assert.equal(M.totals(s).find(r=>r.key===key).total,7);
 assert.equal(M.productStatus(s,key).assignedSent,5);
 assert.equal(M.productStatus(s,key).manuallyBought,2);
});
test('03. Compra parcial conserva faltante y reservas originales',()=>{
 const s=setup();add(s);buyAdditional(s,1);
 assert.deepEqual(allocations(s),{SP:3,SL:2,BC:1});
 assert.equal(M.deliveryPlan(s).short.find(r=>r.dest==='BC'&&r.key===key).missing,1);
});
test('04. Dos restaurantes no mezclan cajas compradas',()=>{
 const s=setup();add(s,'BRASEROS CENTRO',2);add(s,'BRASEROS FORUM',1);
 buyAdditional(s,2,'BC');
 assert.equal(allocations(s).BC,2);
 assert.equal(allocations(s).BF,undefined);
 buyAdditional(s,1,'BF');
 assert.deepEqual(allocations(s),{SP:3,SL:2,BC:2,BF:1});
});
test('05. Producto nuevo después del envío se puede comprar manualmente',()=>{
 const s=setup();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n1 BANANA');
 assert.equal(M.deliveryPlan(s).blocked.some(r=>r.key==='BANANA|BULTO'),true);
 M.manualBuySafe(s,'BANANA|BULTO',1);
 s.manual.at(-1).additionalDest='BC';
 assert.equal(M.deliveryPlan(s).eligible.find(r=>r.dest==='BC'&&r.key==='BANANA|BULTO').allowed,1);
});
test('06. Incremento con + crea línea adicional en vez de tocar original',()=>{
 const s=setup();
 const before=s.orders.find(o=>o.dest==='SP').q;
 const a=M.adjustDestinationDemand(s,key,'SP',1,{expectedQuantity:before,day:s.day,historyLength:s.history.length});
 assert.equal(a.changed,true);
 assert.equal(s.orders.find(o=>o.dest==='SP'&&o.kind!=='pedido-adicional').q,before);
 assert.equal(s.orders.find(o=>o.dest==='SP'&&o.kind==='pedido-adicional').q,1);
 assert.deepEqual(allocations(s),{SP:3,SL:2});
 buyAdditional(s,1,'SP');
 assert.deepEqual(allocations(s),{SP:4,SL:2});
});
test('07. Repartidores concurrentes no bajan dos veces lo mismo',()=>{
 const s=setup();add(s);buyAdditional(s,2);
 const row=M.deliveryPlan(s).eligible.find(r=>r.key===key&&r.dest==='BC');
 const op={action:'bajar',key,dest:'BC',expectedDelivered:row.delivered,expectedAllowed:row.allowed,day:s.day,historyLength:s.history.length};
 assert.equal(M.applyDeliveryMutation(s,op).changed,true);
 assert.equal(M.applyDeliveryMutation(s,op).code,'MODIFICADO_POR_OTRO');
 assert.equal(M.deliveredFor(s,key,'BC'),2);
});
test('08. Reversión manual trazable reduce solo la nueva reserva',()=>{
 const s=setup();add(s);buyAdditional(s,2);
 M.reverseManualPurchase(s,key,2);
 s.manual.at(-1).additionalDest='BC';
 assert.deepEqual(allocations(s),{SP:3,SL:2});
 assert.equal(s.manual.length,2);
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'');
});
test('09. Pedido duplicado no se introduce por segunda vez',()=>{
 const s=setup();add(s);assert.throws(()=>add(s),/ya se han pegado/i);
 assert.equal(s.orders.filter(o=>o.kind==='pedido-adicional').length,1);
});
test('10. Jornada sin ampliaciones sigue funcionando como antes',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n3 TOMATE RAMA\nPEDIDO SL\n2 TOMATE RAMA');
 M.manualBuySafe(s,key,5);
 assert.deepEqual(allocations(s),{SP:3,SL:2});
});
