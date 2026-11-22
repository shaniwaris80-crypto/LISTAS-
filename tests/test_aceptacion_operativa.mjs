import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import * as M from '../motor.mjs';

const sample=(txt='PEDIDO SP\n3 TOMATE RAMA\n2 BANANA\nPEDIDO SL\n3 TOMATE RAMA\n1 BANANA')=>{
 const s=M.createState();M.importBlocks(s,txt);return s;
};
const tomato='TOMATE RAMA|BULTO';
const banana='BANANA|BULTO';
const row=(s,k)=>M.totals(s).find(r=>r.key===k);
const purchase=(s,k)=>M.pendingPurchases(s).find(r=>r.key===k);
const saved=(s)=>structuredClone(s);

test('01. Jornada nueva comienza vacía con fecha del equipo, sin pedidos de ejemplo',()=>{
 const s=M.createState();
 assert.equal(s.orders.length,0);assert.equal(s.manual.length,0);
 assert.match(s.day,/^\d{4}-\d{2}-\d{2}$/);
 const today=new Date();const expected=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 assert.equal(s.day,expected);
});

test('02. Existen SP SL ST y los restaurantes independientes',()=>{
 const ids=M.createState().destinations.map(x=>x.id);
 for(const id of ['SP','SL','ST','BC','BF','BS','BE','BT','RV'])assert.ok(ids.includes(id),id);
});

test('03. Importación de tres tiendas y tres restaurantes suma el Global sin mezclar destinos',()=>{
 const s=sample('PEDIDO SP\n3 TOMATE RAMA\nPEDIDO SL\n2 TOMATE RAMA\nPEDIDO ST\n1 TOMATE RAMA\nPEDIDO BRASEROS CENTRO\n2 TOMATE RAMA\nPEDIDO BRASEROS FORUM\n1 TOMATE RAMA\nPEDIDO RIVIERA\n1 TOMATE RAMA');
 const r=row(s,tomato);
 assert.equal(r.total,10);assert.deepEqual(r.by,{SP:3,SL:2,ST:1,BC:2,BF:1,RV:1});
 assert.equal(s.orders.length,6);
 assert.equal(M.destinationTXT(s,'BC'),'2TOMATE RAMA');
 assert.equal(M.destinationTXT(s,'RV'),'1TOMATE RAMA');
});

test('04. Se suman líneas repetidas de un mismo producto, manteniendo originales',()=>{
 const s=sample('PEDIDO SP\n1 TOMATE RAMA\n2 TOMATE RAMA\n3 TOMATE RAMA');
 assert.equal(row(s,tomato).total,6);assert.equal(s.orders.length,3);
});

test('05. Pegar el mismo bloque dos veces evita duplicación silenciosa',()=>{
 const s=sample('PEDIDO SP\n1 TOMATE RAMA');
 assert.throws(()=>M.importBlocks(s,'PEDIDO SP\n1 TOMATE RAMA'),/ya se han pegado/i);
 assert.equal(row(s,tomato).total,1);
});

test('06. Cabecera desconocida no inventa tienda ni cantidades',()=>{
 const s=M.createState();
 const r=M.importBlocks(s,'PEDIDO UBICACION INVENTADA\n2 TOMATE RAMA');
 assert.equal(s.orders.length,0);assert.ok(r.issues.some(x=>x.includes('Destino no reconocido')));
});

test('07. WhatsApp con fechas y remitentes separa tiendas',()=>{
 const s=M.createState();
 M.importBlocks(s,'[21/11/26, 12:20] Imman: PEDIDO SP\n[21/11/26, 12:21] Imman: 1 BANANA\n[21/11/26, 12:22] Imman: PEDIDO SL\n[21/11/26, 12:23] Imman: BANAN 0,5');
 assert.equal(row(s,banana).total,1.5);assert.equal(row(s,banana).by.SP,1);assert.equal(row(s,banana).by.SL,0.5);
});

test('08. Banana y Banan 0,5 convergen sin perder las líneas',()=>{
 const s=sample('PEDIDO SP\nBANANA 1\nBANAN 0,5');
 assert.equal(row(s,banana).total,1.5);assert.equal(s.orders.length,2);
 assert.equal(M.destinationTXT(s,'SP'),'1,5BANANA');
});

test('09. Acentos y plurales se reconocen sin cambiar variedad',()=>{
 const s=sample('PEDIDO SP\n1 TOMATE RAMA\n2 TOMATES RAMA');
 assert.equal(row(s,tomato).total,3);assert.equal(M.canonical('PLÁTANO'),'PLATANO');
});

test('10. GOLDEN 24 y GOLDEN 28 mantienen calibres independientes',()=>{
 const s=sample('PEDIDO SP\nGOLDEN 24 2\nGOLDEN 28 3');
 assert.equal(M.totals(s).find(x=>x.product==='MANZANA GOLDEN 24').total,2);
 assert.equal(M.totals(s).find(x=>x.product==='MANZANA GOLDEN 28').total,3);
});

test('11. No interpreta un calibre sin cantidad como compra',()=>{
 const s=M.createState(),l=M.parseOrderLine('GOLDEN 28',s);
 assert.equal(l.q,null);assert.equal(l.review,true);
});

test('12. Conserva patata 5 kg como formato y 7 como cantidad',()=>{
 const s=M.createState(),l=M.parseOrderLine('PATATA 5 KG 7',s);
 assert.equal(l.product,'PATATA 5 KG');assert.equal(l.q,7);
});

test('13. Distintas unidades de TOMATE RAMA no se mezclan',()=>{
 const s=sample('PEDIDO SP\n1 TOMATE RAMA\n1,5 KG TOMATE RAMA');
 assert.equal(M.totals(s).filter(x=>x.product==='TOMATE RAMA').length,2);
});

test('14. Producto desconocido no se autoenvía; Crear nuevo lo guarda en el diccionario',()=>{
 const s=sample('PEDIDO SP\n2 PERA EDEN');
 const l=s.orders[0];assert.equal(l.review,true);
 assert.throws(()=>M.assignSupplier(s,l.product+'|BULTO','ESMO'),/Revisa/i);
 M.confirmProduct(s,l.id,'PERA EDEN',{create:true,remember:true});
 assert.ok(s.catalog.includes('PERA EDEN'));assert.equal(s.orders[0].review,false);
});

test('15. Corrección confirmada se aprende para la próxima lista',()=>{
 const s=sample('PEDIDO SP\n1 MANZANA GRNNY SMITH');
 const l=s.orders[0];assert.equal(l.review,true);
 M.confirmProduct(s,l.id,'MANZANA GRANNY SMITH',{remember:true});
 M.importBlocks(s,'PEDIDO SL\n2 MANZANA GRNNY SMITH');
 assert.equal(s.orders[1].review,false);
 assert.equal(M.totals(s).find(x=>x.product==='MANZANA GRANNY SMITH').total,3);
});

test('16. Corregir cantidad individual no modifica otra tienda',()=>{
 const s=sample(),l=s.orders.find(x=>x.dest==='SP'&&x.product==='TOMATE RAMA');
 M.setQuantity(s,l.id,'4');
 assert.equal(row(s,tomato).total,7);assert.equal(row(s,tomato).by.SL,3);
 assert.throws(()=>M.setQuantity(s,l.id,'0'),/positiva/i);
});

test('17. Añadir restaurante no inventa pedidos ni cambia global',()=>{
 const s=sample(),before=M.summary(s).quantities;
 const d=M.addDestination(s,'CAFÉ NUEVO');
 assert.equal(M.summary(s).quantities,before);
 M.importBlocks(s,'PEDIDO CAFE NUEVO\n1 TOMATE RAMA');
 assert.equal(M.destinationTXT(s,d.id),'1TOMATE RAMA');
});

test('18. Asignación rápida mueve producto de Sin asignar al proveedor sin perder Global',()=>{
 const s=sample(),before=row(s,tomato).total;
 assert.ok(M.unassignedProducts(s).some(x=>x.key===tomato));
 M.quickAssign(s,tomato,'ESMO');
 assert.ok(!M.unassignedProducts(s).some(x=>x.key===tomato));
 assert.equal(M.supplierLines(s,'ESMO').length,1);assert.equal(row(s,tomato).total,before);
});

test('19. Doble toque al mismo proveedor revierte solo el borrador',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');
 M.quickAssign(s,tomato,'ESMO');
 assert.equal(M.supplierLines(s,'ESMO').length,0);
 assert.ok(M.unassignedProducts(s).some(x=>x.key===tomato));
});

test('20. Asignar sin enviar NO habilita Reparto',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');
 assert.ok(!M.deliveryPlan(s).eligible.some(x=>x.key===tomato));
 assert.ok(M.deliveryPlan(s).blocked.some(x=>x.key===tomato));
});

test('21. El envío confirmado habilita Reparto y excluye de TXT pendiente',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'6TOMATE RAMA');
 const p=M.markSupplierSent(s,'ESMO');
 assert.equal(p.confirmedByUser,true);
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'');
 assert.equal(M.supplierTXT(s,'ESMO'),'6TOMATE RAMA');
 assert.equal(M.deliveryPlan(s).eligible.filter(x=>x.key===tomato).length,2);
});

test('22. Un nuevo borrador de proveedor no reenvía líneas enviadas',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 M.quickAssign(s,banana,'ESMO');
 assert.equal(M.supplierDraftTXT(s,'ESMO'),'3BANANA');
 assert.equal(M.supplierTXT(s,'ESMO'),'3BANANA\n6TOMATE RAMA');
});

test('23. WhatsApp de proveedores y restaurantes solo prepara enlace; no envía ni marca',()=>{
 const s=sample(),n=s.allocations.length;
 M.quickAssign(s,tomato,'ESMO');
 const w=M.supplierDraftWhatsApp(s,'ESMO');
 assert.ok(w.url.startsWith('https://wa.me/?text='));
 assert.ok(decodeURIComponent(w.url).includes('6TOMATE RAMA'));
 assert.equal(s.allocations[0].status,'draft');
 const d=M.destinationWhatsApp(s,'SP');
 assert.ok(decodeURIComponent(d.url).includes('PEDIDO SAN PABLO'));
 assert.equal(s.allocations.length,n+1);
});

test('24. Marcar enviado y reabrir quedan protegidos si ya hay bajadas',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 M.deliver(s,tomato,'SP',1);
 assert.throws(()=>M.reopenSupplierSent(s,'ESMO'),/bajada/i);
});

test('25. Compra manual suma solo lo que falta y no duplica proveedor',()=>{
 const s=sample();M.assignSupplier(s,tomato,'ESMO',4);
 M.manualBuySafe(s,tomato,2);
 assert.equal(M.productStatus(s,tomato).manuallyBought,2);
 assert.equal(purchase(s,tomato).remainingToBuy,0);
 M.markSupplierSent(s,'ESMO');
 assert.equal(M.productStatus(s,tomato).authorized,6);
});

test('26. No permite compra extra por error si el proveedor ya cubrió todo',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 assert.equal(purchase(s,tomato).remainingToBuy,0);
 assert.throws(()=>M.manualBuySafe(s,tomato,1),/extra/i);
});

test('27. Recepción de proveedor no autoriza una segunda compra',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 M.receiveSupplier(s,s.allocations[0].id,4);
 assert.equal(M.productStatus(s,tomato).supplierReceived,4);
 assert.equal(M.productStatus(s,tomato).authorized,6);
 assert.throws(()=>M.receiveSupplier(s,s.allocations[0].id,3),/No se recibe/i);
});

test('28. Compra manual se puede deshacer sin borrar el historial',()=>{
 const s=sample();M.manualBuySafe(s,tomato,4);
 M.reverseManualPurchase(s,tomato,2);
 assert.equal(M.productStatus(s,tomato).manuallyBought,2);
 assert.equal(s.manual.length,2);assert.equal(s.manual[1].kind,'reversal');
});

test('29. Deshacer TODAS es atómico y no borra bajadas',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);M.manualBuySafe(s,banana,3);
 M.deliver(s,tomato,'SP',1);
 const before=s.manual.length;
 assert.throws(()=>M.reverseAllManualPurchases(s),/bajado/i);
 assert.equal(s.manual.length,before);
 M.undoDelivery(s,tomato,'SP');
 const n=M.reverseAllManualPurchases(s);
 assert.equal(n,2);assert.equal(M.productStatus(s,tomato).manuallyBought,0);
});

test('30. TXT de compras manuales incluye solo pendientes no cubiertos',()=>{
 const s=sample();M.assignSupplier(s,tomato,'ESMO',4);
 M.manualBuySafe(s,tomato,1);
 const txt=M.pendingManualPurchaseTXT(s);
 assert.match(txt,/1TOMATE RAMA/);
 assert.match(txt,/3BANANA/);
 assert.ok(!txt.includes('6TOMATE'));
});

test('31. Sin compra ni envío, ningún producto entra en Reparto',()=>{
 const s=sample();assert.equal(M.deliveryPlan(s).eligible.length,0);
 assert.equal(M.deliveryPlan(s).blocked.length,2);
});

test('32. La carga es opcional antes de Bajar',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 assert.equal(Object.keys(s.load).length,0);
 M.deliver(s,tomato,'SP',1);
 assert.equal(s.delivery[tomato+'@SP'],1);
});

test('33. Bajada parcial no supera cantidad habilitada',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 M.deliver(s,tomato,'SP',1);
 assert.equal(M.deliveryPlan(s).eligible.find(x=>x.key===tomato&&x.dest==='SP').remaining,2);
 assert.throws(()=>M.deliver(s,tomato,'SP',3),/superior/i);
});

test('34. Deshacer bajada conserva producto pendiente',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 M.deliver(s,tomato,'SP');M.undoDelivery(s,tomato,'SP');
 assert.equal(M.deliveryPlan(s).eligible.find(x=>x.key===tomato&&x.dest==='SP').remaining,3);
});

test('35. Compra insuficiente para dos tiendas exige distribuir',()=>{
 const s=sample();M.manualBuySafe(s,tomato,4);
 assert.equal(M.deliveryPlan(s).needsReview.length,1);
 M.planShortage(s,tomato,{SP:3,SL:1});
 assert.equal(M.deliveryPlan(s).needsReview.length,0);
 assert.equal(M.deliveryPlan(s).eligible.find(x=>x.key===tomato&&x.dest==='SL').allowed,1);
});

test('36. Reparto no permite distribuir más de lo autorizado',()=>{
 const s=sample();M.manualBuySafe(s,tomato,4);
 assert.throws(()=>M.planShortage(s,tomato,{SP:3,SL:2}),/supera/i);
});

test('37. Dos personas bajando la misma fila no duplican cantidades',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 const op={action:'bajar',key:tomato,dest:'SP',expectedDelivered:0,expectedAllowed:3,day:s.day,historyLength:s.history.length};
 assert.equal(M.applyDeliveryMutation(s,op).changed,true);
 assert.equal(M.applyDeliveryMutation(s,op).changed,false);
 assert.equal(s.delivery[tomato+'@SP'],3);
});

test('38. Dos personas bajando destinos diferentes conservan ambos cambios',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 const o={action:'bajar',key:tomato,expectedDelivered:0,expectedAllowed:3,day:s.day,historyLength:s.history.length};
 assert.equal(M.applyDeliveryMutation(s,{...o,dest:'SP'}).changed,true);
 assert.equal(M.applyDeliveryMutation(s,{...o,dest:'SL'}).changed,true);
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,50);
 assert.equal(M.deliveryProgress(s,'SL').porcentaje,50);
});

test('39. Progreso verde separa cada tienda y no mezcla cajas con kg',()=>{
 const s=sample();M.manualBuySafe(s,tomato,6);
 M.deliver(s,tomato,'SP');
 assert.equal(M.deliveryProgress(s,'SP').porcentaje,50);
 assert.equal(M.deliveryProgress(s,'SL').porcentaje,0);
});

test('40. Aumentar SP modifica Global y deja sin comprar el incremento',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 const r=M.adjustDestinationDemand(s,tomato,'SP',1,{expectedQuantity:3,day:s.day,historyLength:s.history.length});
 assert.equal(r.changed,true);assert.equal(row(s,tomato).total,7);
 assert.equal(purchase(s,tomato).remainingToBuy,1);
});

test('41. Dos cambios simultáneos sobre la misma tienda no sobrescriben',()=>{
 const s=sample(),meta={expectedQuantity:3,day:s.day,historyLength:s.history.length};
 assert.equal(M.adjustDestinationDemand(s,tomato,'SP',1,meta).changed,true);
 const other=M.adjustDestinationDemand(s,tomato,'SP',1,meta);
 assert.equal(other.changed,false);assert.equal(other.code,'MODIFICADO_POR_OTRO');
 assert.equal(row(s,tomato).by.SP,4);
});

test('42. Prohíbe bajar un producto no autorizado',()=>{
 const s=sample();assert.throws(()=>M.deliver(s,tomato,'SP'),/habilitado/i);
});

test('43. Asignar un repartidor no modifica compras ni tiendas',()=>{
 const s=sample(),before=s.orders.length;
 M.assignRider(s,'SP','REPARTIDOR 1');
 assert.equal(s.riderAssignments.SP,'REPARTIDOR 1');
 assert.equal(s.orders.length,before);
});

test('44. Diferencia de mercancía extra distribuye 60/20/20 sin crear pedidos',()=>{
 const s=sample(),before=s.orders.length;
 const q=M.distributeSurplus(10);
 assert.deepEqual(q,{SP:6,SL:2,ST:2});assert.equal(s.orders.length,before);
});

test('45. Limpiar día archiva todo y conserva diccionario, destinos y proveedores',()=>{
 const s=sample(),old=s.day,base=s.catalog.length;
 M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 M.deliver(s,tomato,'SP',1);
 const date='2026-11-23';
 M.newDay(s,date);
 assert.equal(s.day,date);assert.equal(s.orders.length,0);
 assert.equal(s.allocations.length,0);assert.equal(Object.keys(s.delivery).length,0);
 assert.equal(s.history.at(-1).day,old);assert.equal(s.history.at(-1).orders.length,4);
 assert.equal(s.catalog.length,base);assert.ok(s.destinations.some(x=>x.id==='SP'));
});

test('46. Configuración Firebase real y reglas privadas por propietario o miembro',()=>{
 const cfg=readFileSync(new URL('../firebase-config.js',import.meta.url),'utf8');
 const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));
 const b=rules.rules.arslanListas['arslan-listas-next-v1'].$owner;
 assert.ok(cfg.includes("projectId: 'arslan-listas-next'"));
 assert.match(b.document['.read'],/auth.uid === \$owner/);
 assert.match(b.document['.read'],/members/);
 assert.match(b.members.$member['.write'],/auth.uid === \$owner/);
});

test('47. HTML de producción es JavaScript válido, sin listas de demo ni botón de restaurar',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'script del HTML');
 new Script(script,{filename:'arslan-productivo.js'});
 assert.ok(script.includes("const FIXTURE = \"\""),'sin fixture real en producción');
 assert.ok(!script.includes("case 'resetdemo'"),'reinicio demo retirado');
 assert.ok(!script.includes('importBlocks(state,FIXTURE)'),'sin importación automática de muestras');
});

test('48. Navegación y botones centrales permanecen en la web',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const action of ['goto','import','assign','sent','purchase-toggle','manual-undo-all','manual-wa-pending','deliver','undodelivery','destqty','clearday','cloud-backup']){
  assert.ok(html.includes("case '"+action+"'")||html.includes("case '"+action+"':")||html.includes("data-action=\""+action+"\""),'Acción '+action);
 }
 assert.match(html,/progress-track/);assert.match(html,/destination-qty-step/);
});

test('49. Menú móvil iPhone y distribución PC están incorporados',()=>{
 const css=readFileSync(new URL('../estilos.css',import.meta.url),'utf8');
 assert.ok(css.includes('safe-area-inset-bottom'));
 assert.ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
 assert.ok(css.includes('grid-template-columns:232px minmax(0,1fr)'));
});

test('50. Escritura crítica de bajadas usa transacción Firebase',()=>{
 const adapter=readFileSync(new URL('../firebase-adapter.js',import.meta.url),'utf8');
 assert.ok(adapter.includes('async mutateDelivery('));
 assert.ok(adapter.includes('runTransaction(location,old=>'));
 assert.ok(adapter.includes('applyDeliveryMutation(draft,operation)'));
});

test('51. Reemplazar lista de SP antes de comprar no borra SL',()=>{
 const s=sample();
 M.importBlocks(s,'PEDIDO SP\n1 TOMATE RAMA',{replace:true});
 assert.equal(row(s,tomato).total,4);
 assert.equal(row(s,tomato).by.SP,1);
 assert.equal(row(s,tomato).by.SL,3);
});

test('52. No reemplaza un pedido de la jornada con envíos confirmados',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 const before=s.orders.length;
 assert.throws(()=>M.importBlocks(s,'PEDIDO SP\n8 TOMATE RAMA',{replace:true}),/No se pueden sustituir/i);
 assert.equal(s.orders.length,before);
});

test('53. Edición directa de Pedidos bloqueada si ya hay proveedor y recomienda Compras',()=>{
 const s=sample(),l=s.orders.find(x=>x.dest==='SP'&&x.product==='TOMATE RAMA');
 M.quickAssign(s,tomato,'ESMO');
 assert.throws(()=>M.setQuantity(s,l.id,'5'),/Corrige el pedido desde Compras/i);
 assert.equal(row(s,tomato).total,6);
});

test('54. Edición directa bloqueada si hay compra manual o bajada física',()=>{
 const s=sample(),l=s.orders.find(x=>x.dest==='SP'&&x.product==='TOMATE RAMA');
 M.manualBuySafe(s,tomato,6);M.deliver(s,tomato,'SP',1);
 assert.throws(()=>M.setQuantity(s,l.id,'2'),/Compras/i);
 assert.equal(s.delivery[tomato+'@SP'],1);
});

test('55. Cambiar desde Compras sí permite corregir cantidad con productos enviados',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');M.markSupplierSent(s,'ESMO');
 const res=M.adjustDestinationDemand(s,tomato,'SP',1,{expectedQuantity:3,day:s.day,historyLength:0});
 assert.equal(res.changed,true);assert.equal(row(s,tomato).total,7);
 assert.equal(purchase(s,tomato).remainingToBuy,1);
});

test('56. La app no ofrece restaurar una demo ni importa muestras en la página principal',()=>{
 const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 assert.ok(!ui.includes("case 'resetdemo'"));
 assert.ok(!ui.includes('importBlocks(state,FIXTURE)'));
 assert.ok(!ui.includes('LIMPIAR DÍA — DEMOSTRACIÓN'));
 assert.ok(ui.includes('ARSLAN_LISTAS_ANTES_LIMPIAR_'));
});

test('57. Reemplazar pedidos con proveedor asignado, aunque no enviado, queda bloqueado',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');
 assert.throws(()=>M.importBlocks(s,'PEDIDO SP\n8 TOMATE RAMA',{replace:true}),/asignaciones/i);
 assert.equal(s.allocations.length,1);assert.equal(row(s,tomato).total,6);
});

test('58. No cambia el nombre de un producto ya asignado a proveedor',()=>{
 const s=sample();M.quickAssign(s,tomato,'ESMO');
 const line=s.orders.find(x=>x.dest==='SP'&&x.product==='TOMATE RAMA');
 assert.throws(()=>M.confirmProduct(s,line.id,'TOMATE DANIELA',{remember:true}),/asignaciones/i);
 assert.equal(row(s,tomato).total,6);
});
