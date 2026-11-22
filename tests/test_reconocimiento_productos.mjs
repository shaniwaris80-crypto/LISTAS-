import assert from 'node:assert/strict';
import * as M from '../motor.mjs';

const s=()=>M.createState();let passed=0;
const check=(name,fn)=>{fn();passed++;};

check('BANANA 1 y BANAN 0,5 se suman sin crear productos diferentes',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\nBANANA 1\nBANAN 0,5');
 assert.equal(M.totals(x).filter(r=>r.product==='BANANA').length,1);
 assert.equal(M.totals(x)[0].total,1.5);
});
check('Bananas en plural equivale a BANANA en singular',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 BANANA\n0,5 BANANAS');
 assert.equal(M.totals(x).find(r=>r.product==='BANANA').total,1.5);
});
check('Plural TOMATES RAMA se normaliza sin cambiar variedad',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 TOMATE RAMA\n2 TOMATES RAMA');
 assert.equal(M.totals(x).find(r=>r.product==='TOMATE RAMA').total,3);
});
check('Plural MANZANAS GOLDEN 28 mantiene calibre 28',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 MANZANA GOLDEN 28\n2 MANZANAS GOLDEN 28');
 assert.equal(M.totals(x).find(r=>r.product==='MANZANA GOLDEN 28').total,3);
});
check('GOLDEN 24 y GOLDEN 28 permanecen distintos',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\nGOLDEN 24 1\nGOLDEN 28 3');
 assert.equal(M.totals(x).find(r=>r.product==='MANZANA GOLDEN 24').total,1);
 assert.equal(M.totals(x).find(r=>r.product==='MANZANA GOLDEN 28').total,3);
});
check('GOLDEN 28 sin cantidad no es pedido de 28 cajas',()=>{
 const line=M.parseOrderLine('GOLDEN 28',s());
 assert.equal(line.q,null);assert.equal(line.review,true);
});
check('BANAN 0.5 con unidad final',()=>{
 const line=M.parseOrderLine('BANAN 0.5 KG',s());
 assert.equal(line.product,'BANANA');assert.equal(line.q,0.5);assert.equal(line.unit,'KG');
});
check('BANANA 1/2 se lee como medio bulto',()=>{
 const line=M.parseOrderLine('BANANA 1/2',s());
 assert.equal(line.product,'BANANA');assert.equal(line.q,0.5);
});
check('PATATA 5 KG no se interpreta como cinco unidades',()=>{
 const line=M.parseOrderLine('PATATA 5 KG',s());
 assert.equal(line.q,null);assert.equal(line.product,'PATATA 5 KG');
});
check('PATATA 5 KG 7 distingue 7 sacos de formato 5 kg',()=>{
 const line=M.parseOrderLine('PATATA 5 KG 7',s());
 assert.equal(line.q,7);assert.equal(line.product,'PATATA 5 KG');
});
check('WhatsApp con fecha y remitente detecta encabezado y línea',()=>{
 const x=s();
 M.importBlocks(x,'[20/11/26, 09:45:12] Imman: PEDIDO SP\n[20/11/26, 09:46:00] Imman: 1 BANANA\n[20/11/26, 09:47:00] Imman: BANAN 0,5');
 assert.equal(x.orders.length,2);assert.equal(M.totals(x).find(r=>r.product==='BANANA').total,1.5);
});
check('Corrección confirmada se recuerda en siguientes tiendas',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 MANZANA GRNNY SMITH');
 const line=x.orders[0];assert.equal(line.review,true);
 M.confirmProduct(x,line.id,'MANZANA GRANNY SMITH',{remember:true});
 M.importBlocks(x,'PEDIDO SL\n2 MANZANA GRNNY SMITH');
 assert.equal(x.orders[1].review,false);
 assert.equal(M.totals(x).find(r=>r.product==='MANZANA GRANNY SMITH').total,3);
});
check('No sugiere automáticamente calibre 28 para GOLDEN 29',()=>{
 const candidates=M.suggest('MANZANA GOLDEN 29',s().catalog);
 assert.ok(!candidates.includes('MANZANA GOLDEN 28'));
 assert.ok(!candidates.includes('MANZANA GOLDEN 24'));
});
check('Calibres no generan alias permanentes incorrectos',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 GOLDEN 29');
 const line=x.orders[0];
 M.confirmProduct(x,line.id,'MANZANA GOLDEN 28',{remember:true});
 assert.equal(x.aliases['GOLDEN 29'],undefined);
});
check('Calidades PRIMERA y SEGUNDA no aprenden alias cruzado',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 KAKI PRIMERA');
 M.confirmProduct(x,x.orders[0].id,'KAKI SEGUNDA',{create:true,remember:true});
 assert.equal(x.aliases['KAKI PRIMERA'],undefined);
});
check('No suma unidades distintas aunque el producto coincida',()=>{
 const x=s();M.importBlocks(x,'PEDIDO SP\n1 BANANA\n0,5KG BANAN');
 assert.equal(M.totals(x).filter(r=>r.product==='BANANA').length,2);
});
console.log('RECONOCIMIENTO DE PRODUCTOS: '+passed+' pruebas correctas');
