import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as M from '../motor.mjs';

const key='TOMATE RAMA|BULTO';
const create=()=>{
 const state=M.createState();
 M.importBlocks(state,'PEDIDO SP\n3 TOMATE RAMA\nPEDIDO SL\n2 TOMATE RAMA');
 M.assignSupplier(state,key,'ESMO',5);
 M.markSupplierSent(state,'ESMO');
 return state;
};
const after=s=>M.deliveryPlan(s).eligible.filter(r=>r.key===key);
const qty=(s,dest)=>after(s).find(r=>r.dest===dest)?.allowed||0;
let count=0;
const test=(name,fn)=>{fn();count++;console.log('OK '+name)};
test('El pedido original enviado mantiene su cantidad y mensaje',()=>{
 const s=create(),before=M.supplierTXT(s,'ESMO');
 M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 assert.equal(M.supplierTXT(s,'ESMO'),before);
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'');
 assert.equal(s.allocations.filter(x=>x.status==='sent').length,1);
 assert.equal(s.allocations[0].q,5);
 assert.equal(M.totals(s).find(x=>x.key===key).total,7);
});
test('Nuevo restaurante aparece como ampliación y NO toma cajas de tiendas',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 assert.equal(s.orders.find(x=>x.dest==='BC').kind,'pedido-adicional');
 assert.equal(qty(s,'SP'),3);assert.equal(qty(s,'SL'),2);assert.equal(qty(s,'BC'),0);
 assert.equal(M.pendingPurchases(s).find(r=>r.key===key).remainingToBuy,2);
});
test('Compra parcial adicional reserva SOLO una caja para Braseros',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 M.manualBuySafe(s,key,1);s.manual.at(-1).additionalDest='BC';
 assert.equal(qty(s,'SP'),3);assert.equal(qty(s,'SL'),2);assert.equal(qty(s,'BC'),1);
 assert.equal(M.pendingPurchases(s).find(r=>r.key===key).remainingToBuy,1);
});
test('Compra total adicional habilita exactamente 2 para Braseros',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 M.manualBuySafe(s,key,2);s.manual.at(-1).additionalDest='BC';
 assert.equal(qty(s,'BC'),2);assert.equal(qty(s,'SP'),3);assert.equal(qty(s,'SL'),2);
 assert.equal(M.pendingPurchases(s).find(r=>r.key===key).remainingToBuy,0);
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'');
});
test('Bajada por dos destinos no se duplica',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 M.manualBuySafe(s,key,2);s.manual.at(-1).additionalDest='BC';
 const row=after(s).find(r=>r.dest==='BC'),op={action:'bajar',key,dest:'BC',quantity:1,expectedDelivered:0,expectedAllowed:row.allowed,day:s.day,historyLength:s.history.length};
 assert.equal(M.applyDeliveryMutation(s,op).changed,true);
 assert.equal(M.applyDeliveryMutation(s,op).code,'MODIFICADO_POR_OTRO');
 assert.equal(M.deliveredFor(s,key,'BC'),1);
 assert.equal(M.deliveredFor(s,key,'SP'),0);
});
test('Revertir compra adicional sin bajada conserva cantidades anteriores',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 M.manualBuySafe(s,key,2);s.manual.at(-1).additionalDest='BC';
 M.reverseManualPurchase(s,key,2);s.manual.at(-1).additionalDest='BC';
 assert.equal(qty(s,'BC'),0);assert.equal(qty(s,'SP'),3);assert.equal(qty(s,'SL'),2);
 assert.equal(s.manual.length,2);
});
test('Ampliar un pedido existente tras envío no reescribe su línea original',()=>{
 const s=create(),before=s.orders[0].q;
 const updated=M.adjustDestinationDemand(s,key,'SP',1,{expectedQuantity:3,day:s.day,historyLength:s.history.length});
 assert.equal(updated.changed,true);
 assert.equal(s.orders[0].q,before);
 assert.ok(s.orders.some(o=>o.dest==='SP'&&o.kind==='pedido-adicional'&&o.q===1));
 assert.equal(qty(s,'SP'),3);
});
test('Antes de enviar a proveedor, los pedidos no son ampliaciones',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n1 TOMATE RAMA');
 assert.equal(s.orders.length,1);assert.ok(s.orders.every(o=>o.kind!=='pedido-adicional'));
});
test('Aumentar pedido tardío no aumenta el pedido enviado',()=>{
 const s=create();M.importBlocks(s,'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA');
 M.adjustDestinationDemand(s,key,'BC',1,{expectedQuantity:2});
 assert.equal(M.supplierTXT(s,'ESMO'),'5TOMATE RAMA');
 assert.equal(M.totals(s).find(r=>r.key===key).total,8);
 assert.equal(qty(s,'BC'),0);
});
test('Las operaciones no requieren modificar las claves ni documentos Firebase',()=>{
 const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const config=readFileSync(new URL('../firebase-config.js',import.meta.url),'utf8');
 assert.ok(ui.includes("case 'additional-buy'"));
 assert.ok(ui.includes("case 'additional-undo'"));
 assert.ok(ui.includes("additionalDest=row.dest"));
 assert.ok(ui.includes("const KEY='arslan_listas_reparto_seguro_v5_local_only'"));
 assert.ok(config.includes("projectId: 'arslan-listas-next'"));
});
console.log('PEDIDOS TARDÍOS: '+count+' comprobaciones');
