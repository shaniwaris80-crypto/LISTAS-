import assert from 'node:assert/strict';
import * as M from '../motor.mjs';
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('OK:',name)};
const sample=(qty=10)=>{let s=M.createState();M.importBlocks(s,`PEDIDO SP\n${qty} TOMATE RAMA`);return s};
const key=s=>M.totals(s).find(x=>x.product==='TOMATE RAMA').key;
const row=s=>M.pendingPurchases(s).find(x=>x.product==='TOMATE RAMA');
check('TXT sin duplicar incluye pendientes en formato cantidad-producto',()=>{
 const s=sample();assert.equal(M.pendingManualPurchaseTXT(s),'10TOMATE RAMA');
 const pack=M.pendingManualPurchaseWhatsApp(s);
 assert.ok(decodeURIComponent(pack.url).includes('COMPRAS MANUALES PENDIENTES'));
 assert.ok(pack.text.includes('10TOMATE RAMA'));
});
check('confirmar marca comprado y sale de pendiente; global sigue',()=>{
 const s=sample();M.manualBuySafe(s,key(s),10);
 assert.equal(row(s).remainingToBuy,0);assert.equal(row(s).manuallyBought,10);
 assert.equal(M.totals(s)[0].total,10);assert.equal(M.pendingManualPurchaseTXT(s),'');
});
check('deshacer individual resta comprado y devuelve todo a pendiente sin borrar el movimiento',()=>{
 const s=sample();M.manualBuySafe(s,key(s),10);
 const before=s.manual.length;M.reverseManualPurchase(s,key(s));
 assert.equal(row(s).remainingToBuy,10);assert.equal(row(s).manuallyBought,0);
 assert.equal(M.authorizedQty(s,key(s)),0);assert.equal(s.manual.length,before+1);
 assert.equal(s.manual.at(-1).kind,'reversal');assert.equal(s.manual.at(-1).q,-10);
 assert.equal(M.pendingManualPurchaseTXT(s),'10TOMATE RAMA');
});
check('más y menos cambia manual parcialmente sin alterar cantidad de pedidos',()=>{
 const s=sample();M.setManualPurchaseTotal(s,key(s),4);
 assert.equal(row(s).manuallyBought,4);assert.equal(row(s).remainingToBuy,6);
 M.setManualPurchaseTotal(s,key(s),7);assert.equal(row(s).manuallyBought,7);
 M.setManualPurchaseTotal(s,key(s),2);assert.equal(row(s).manuallyBought,2);
 assert.equal(row(s).remainingToBuy,8);assert.equal(row(s).total,10);
});
check('poner 0 desmarca y volver a marcar funciona',()=>{
 const s=sample();M.setManualPurchaseTotal(s,key(s),2);
 M.setManualPurchaseTotal(s,key(s),0);assert.equal(row(s).manuallyBought,0);
 M.setManualPurchaseTotal(s,key(s),5);assert.equal(row(s).manuallyBought,5);
});
check('con dos compras del mismo producto deshace neto completo sin perder historial',()=>{
 const s=sample();M.manualBuySafe(s,key(s),3);M.manualBuySafe(s,key(s),2);
 assert.equal(row(s).manuallyBought,5);M.reverseManualPurchase(s,key(s));
 assert.equal(row(s).manuallyBought,0);assert.equal(s.manual.length,3);
});
check('proveedor enviado no se duplica en TXT manual',()=>{
 const s=sample();M.assignSupplier(s,key(s),'ESMO',4);M.markSupplierSent(s,'ESMO');
 assert.equal(M.pendingManualPurchaseTXT(s),'6TOMATE RAMA');
 M.manualBuySafe(s,key(s),6);assert.equal(M.pendingManualPurchaseTXT(s),'');
 M.reverseManualPurchase(s,key(s));assert.equal(M.pendingManualPurchaseTXT(s),'6TOMATE RAMA');
 assert.equal(M.productStatus(s,key(s)).assignedSent,4);
});
check('desmarcar con proveedor enviado mantiene lo bajado si proveedor lo cubre',()=>{
 const s=sample();M.assignSupplier(s,key(s),'ESMO',8);M.markSupplierSent(s,'ESMO');
 M.manualBuySafe(s,key(s),2);M.deliver(s,key(s),'SP',5);
 M.reverseManualPurchase(s,key(s));assert.equal(M.authorizedQty(s,key(s)),8);
 assert.equal(s.delivery[key(s)+'@SP'],5);
});
check('deshacer compra que dejaría bajadas sin autorización se bloquea y no muta',()=>{
 const s=sample();M.manualBuySafe(s,key(s),10);M.deliver(s,key(s),'SP',3);
 const before=JSON.stringify(s);
 assert.throws(()=>M.reverseManualPurchase(s,key(s)),/ya bajado/i);
 assert.equal(JSON.stringify(s),before);
});
check('deshacer parcial permitido hasta cantidad ya bajada',()=>{
 const s=sample();M.manualBuySafe(s,key(s),10);M.deliver(s,key(s),'SP',3);
 M.reverseManualPurchase(s,key(s),7);assert.equal(row(s).manuallyBought,3);
 assert.throws(()=>M.reverseManualPurchase(s,key(s),1),/ya bajado/i);
});
check('deshacer TODAS solo manual y sin tocar pedidos proveedor repartidor ni historia',()=>{
 const s=sample();M.importBlocks(s,'PEDIDO SL\n2 MANZANA GOLDEN 24');
 const apple=M.totals(s).find(r=>r.product==='MANZANA GOLDEN 24').key;
 M.manualBuySafe(s,key(s),10);M.manualBuySafe(s,apple,2);
 const global=JSON.stringify(s.orders),dests=JSON.stringify(s.destinations),old=s.manual.length;
 const count=M.reverseAllManualPurchases(s);
 assert.equal(count,2);assert.equal(M.productStatus(s,key(s)).manuallyBought,0);
 assert.equal(M.productStatus(s,apple).manuallyBought,0);
 assert.equal(s.manual.length,old+2);assert.equal(JSON.stringify(s.orders),global);
 assert.equal(JSON.stringify(s.destinations),dests);assert.equal(M.summary(s).manualBought,0);
});
check('deshacer TODAS es atómico: si producto entregado no se deshace ni otro',()=>{
 const s=sample();M.importBlocks(s,'PEDIDO SL\n2 MANZANA GOLDEN 24');
 const apple=M.totals(s).find(r=>r.product==='MANZANA GOLDEN 24').key;
 M.manualBuySafe(s,key(s),10);M.manualBuySafe(s,apple,2);M.deliver(s,key(s),'SP',1);
 const before=JSON.stringify(s);
 assert.throws(()=>M.reverseAllManualPurchases(s),/ya bajado/i);
 assert.equal(JSON.stringify(s),before);assert.equal(M.productStatus(s,apple).manuallyBought,2);
});
check('borrador proveedor queda fuera de TXT manual sin permitir compras duplicadas',()=>{
 const s=sample();M.assignSupplier(s,key(s),'ESMO',10);
 assert.equal(M.pendingManualPurchaseTXT(s),'');
 assert.throws(()=>M.manualBuySafe(s,key(s),10),/borrador/i);
});
check('un nombre pendiente de revisión no sale en WhatsApp ni TXT',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n2 PERA PRODUCTO SIN CATALOGO');
 assert.equal(M.pendingManualPurchaseTXT(s),'');
 assert.equal(M.pendingManualPurchaseWhatsApp(s).url,'');
});
check('compras decimales toleran coma y no alteran calibre',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n3 MANZANA GOLDEN 24\n4 MANZANA GOLDEN 28');
 const k24=M.totals(s).find(r=>r.product==='MANZANA GOLDEN 24').key;
 M.setManualPurchaseTotal(s,k24,'1,5');assert.equal(M.productStatus(s,k24).manuallyBought,1.5);
 assert.equal(M.pendingManualPurchaseTXT(s).split('\n').length,2);
 assert.equal(M.productStatus(s,M.totals(s).find(r=>r.product==='MANZANA GOLDEN 28').key).manuallyBought,0);
});
console.log('PRUEBAS COMPRAS REVERSIBLES: '+passed+' correctas');