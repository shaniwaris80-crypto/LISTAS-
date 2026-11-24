import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const improvements=readFileSync(new URL('../mejoras-auditoria.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../mejoras-auditoria.css',import.meta.url),'utf8');
const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(improvements,/AGUACATE PRIMERA/);
assert.match(improvements,/AGUACATE LISO/);
assert.match(improvements,/LIMON PRIMERA/);
assert.match(improvements,/existing\.has\(key\)/,'La migración debe evitar duplicados');
assert.match(improvements,/target\.catalog\.push\(product\)/,'El catálogo solo se amplía');
assert.doesNotMatch(improvements,/target\.catalog\s*=\s*\[/,'No se reemplaza el catálogo existente');
assert.doesNotMatch(improvements,/state\.(orders|allocations|manual|receipts|delivery|history)\s*=\s*(\[\]|\{\})/,'No se vacían datos operativos');

assert.match(improvements,/action==='load-toggle'/);
assert.match(improvements,/delete state\.load\[location\]/);
assert.match(improvements,/no se modificó el reparto ni la compra/i);
assert.match(improvements,/action==='clear-rider'/);
assert.match(improvements,/delete state\.riderAssignments\[key\]/);
assert.match(improvements,/pedidos, compras y bajadas permanecen intactos/i);
assert.match(improvements,/button:not\(\[type\]\)/);
assert.match(improvements,/aria-live/);
assert.match(improvements,/other-destinations/);

// Tacto rápido: ejecución en pointerup, supresión del click retrasado y
// cancelación segura al desplazar el dedo.
assert.match(improvements,/AUDIT_SAFE_TOUCH_SELECTOR/);
assert.match(improvements,/pointerdown/);
assert.match(improvements,/pointermove/);
assert.match(improvements,/pointerup/);
assert.match(improvements,/pointercancel/);
assert.match(improvements,/stopImmediatePropagation/);
assert.match(improvements,/touch-pressed/);
assert.match(improvements,/AUDIT_SAFE_TOUCH_DISTANCE=12/);

// Carga: deliveryPlan debe calcularse una sola vez para todas las filas.
assert.match(improvements,/tab!==['"]carga['"]/);
assert.match(improvements,/new Map\(deliveryPlan\(state\)\.eligible\.map/);
assert.doesNotMatch(improvements,/for\([^)]*data-action=\\"load\\"[\s\S]{0,400}deliveryPlan\(state\)\.eligible\.find/);

assert.match(css,/\.sync-pill\{[\s\S]*min-height:44px/);
assert.match(css,/@media\(max-width:850px\)[\s\S]*min-height:42px/);
assert.match(css,/\.load-completed/);
assert.match(css,/\.rider-clear/);
assert.match(css,/-webkit-tap-highlight-color/);
assert.match(css,/touch-action:manipulation/);
assert.match(css,/\.touch-processing/);
assert.match(css,/\.touch-row-active/);
assert.match(css,/transform:scale\(\.975\)/);

assert.match(build,/mejoras-auditoria\.js/);
assert.match(build,/mejoras-auditoria\.css/);
assert.match(html,/AUDIT_SAFE_CATALOG_ADDITIONS/,'El HTML compilado debe incluir las mejoras');
assert.match(html,/AUDIT_SAFE_TOUCH_SELECTOR/,'El HTML compilado debe incluir el tacto rápido');
assert.match(html,/\.other-destinations/,'El HTML compilado debe incluir sus estilos');
assert.doesNotMatch(html,/PEDIDO SP\n3 MANZANA GOLDEN 28/,'Producción no incluye datos de demostración');

console.log('MEJORAS DE AUDITORÍA Y TACTO RÁPIDO: 41 comprobaciones seguras correctas');
