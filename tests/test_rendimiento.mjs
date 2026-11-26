import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const perf=readFileSync(new URL('../rendimiento.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../rendimiento.css',import.meta.url),'utf8');
const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(perf,/ARSLAN_PERF/);
assert.match(perf,/totals=arslanMemo/);
assert.match(perf,/deliveryPlan=arslanMemo/);
assert.match(perf,/productStatus=arslanMemo/);
assert.match(perf,/additionalPurchaseRows=arslanMemo/);
assert.match(perf,/main\.innerHTML=arslanPerfMainHTML/,'Debe sustituir solo el contenido principal cuando la sesión está abierta');
assert.match(perf,/arslanPerfUpdateNavigation/);
assert.match(perf,/requestAnimationFrame\(run\)/,'El feedback táctil pinta antes del trabajo pesado');
assert.match(perf,/action==='selprov'/,'Elegir proveedor no debe reconstruir toda la lista');
assert.doesNotMatch(perf,/state\.(orders|allocations|manual|receipts|delivery|history)\s*=/,'La capa de rendimiento no sustituye datos operativos');
assert.doesNotMatch(perf,/delete\s+state\.(orders|allocations|manual|receipts|delivery|history)/,'La capa de rendimiento no borra datos operativos');
assert.match(css,/content-visibility:auto/);
assert.match(css,/scroll-behavior:auto/);
assert.match(build,/rendimiento\.js/);
assert.match(build,/rendimiento\.css/);
assert.match(html,/ARSLAN LISTAS NEXT · rendimiento fluido/,'El HTML compilado incluye la optimización');
assert.match(html,/content-visibility:auto/,'El HTML compilado incluye la reducción de pintura');
console.log('RENDIMIENTO FLUIDO: 17 comprobaciones seguras correctas');
