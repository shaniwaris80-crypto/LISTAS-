import assert from 'node:assert/strict';
import * as M from '../motor.mjs';
let passed=0;const check=(name,fn)=>{fn();passed++;};
check('BANANA y BANAN se reconocen en formato cantidad al final',()=>{
 const s=M.createState(),a=M.parseOrderLine('BANANA 1',s),b=M.parseOrderLine('BANAN 0.5',s);
 assert.equal(a.product,'BANANA');assert.equal(b.product,'BANANA');
 assert.equal(a.q,1);assert.equal(b.q,0.5);
 assert.equal(b.review,false);
});
check('decimal con coma también suma',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\nBANANA 1\nBANAN 0,5');
 assert.equal(M.totals(s).filter(x=>x.product==='BANANA').length,1);
 assert.equal(M.totals(s).find(x=>x.product==='BANANA').total,1.5);
});
check('unifica producto antiguo BANAN sin borrar líneas originales',()=>{
 const s=M.createState();s.catalog.push('BANAN');s.orders.push({id:'1',dest:'SP',product:'BANANA',sourceName:'BANANA',q:1,unit:'BULTO',review:false});
 s.orders.push({id:'2',dest:'SP',product:'BANAN',sourceName:'BANAN',q:0.5,unit:'BULTO',review:true});
 assert.equal(M.totals(s).find(x=>x.product==='BANANA').total,1.5);
 assert.equal(s.orders.length,2);assert.equal(s.orders[1].product,'BANAN');
 assert.equal(M.destinationTXT(s,'SP'),'1,5BANANA');
});
check('no junta unidades diferentes',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n1 BANANA\n0,5KG BANAN');
 assert.equal(M.totals(s).filter(x=>x.product==='BANANA').length,2);
});
check('nunca mezcla calibres GOLDEN 24 y GOLDEN 28',()=>{
 const s=M.createState();M.importBlocks(s,'PEDIDO SP\n1 MANZANA GOLDEN 24\n1 MANZANA GOLDEN 28');
 const t=M.totals(s);assert.notEqual(t.find(x=>x.product==='MANZANA GOLDEN 24').key,t.find(x=>x.product==='MANZANA GOLDEN 28').key);
});
console.log('ALIAS BANANA: '+passed+' pruebas correctas');
