import fs from 'node:fs';
const motor=fs.readFileSync(new URL('./motor.mjs',import.meta.url),'utf8').replace(/\bexport\s+(?=(?:const|function|class|let)\b)/g,'');
const core=fs.readFileSync(new URL('./sync-core.mjs',import.meta.url),'utf8').replace(/\bexport\s+(?=(?:const|function|class|let)\b)/g,'');
const cloudConf=fs.readFileSync(new URL('./firebase-config.js',import.meta.url),'utf8');
const cloudAdapter=fs.readFileSync(new URL('./firebase-adapter.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('./ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./estilos.css',import.meta.url),'utf8');
// Los pedidos ficticios se usan SOLO en tests. NUNCA se incluyen en la web real.
const fixture='';
const js=motor+'\n'+core+'\n'+cloudConf+'\n'+cloudAdapter+'\n'+ui.replace('__FIXTURE__',JSON.stringify(fixture).replaceAll('<','\\u003C'));
fs.writeFileSync(new URL('./index.html',import.meta.url),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b813b"><title>ARSLAN LISTAS NEXT — Gestión diaria</title><style>${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('index.html generado');