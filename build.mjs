import fs from 'node:fs';
const motor=fs.readFileSync(new URL('./motor.mjs',import.meta.url),'utf8').replace(/\bexport\s+(?=(?:const|function|class|let)\b)/g,'');
const ui=fs.readFileSync(new URL('./ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./estilos.css',import.meta.url),'utf8');
const fixture=fs.readFileSync(new URL('./tests/pedidos_ejemplo_sinteticos.txt',import.meta.url),'utf8');
const js=motor+'\n'+ui.replace('__FIXTURE__',JSON.stringify(fixture).replaceAll('<','\\u003C'));
fs.writeFileSync(new URL('./index.html',import.meta.url),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050505"><title>ARSLAN LISTAS — Reparto seguro (pruebas)</title><style>${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('index.html generado');