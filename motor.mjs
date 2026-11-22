// ARSLAN LISTAS — motor de pedidos, proveedores, compras y reparto para uso diario.
export const STORE_ORDER=['SP','SL','ST'];
export const DESTINATIONS=[
 {id:'SP',name:'SAN PABLO',kind:'tienda'},
 {id:'SL',name:'SAN LESMES',kind:'tienda'},
 {id:'ST',name:'SANTIAGO',kind:'tienda'},
 {id:'BC',name:'BRASEROS · CENTRO',kind:'restaurante'},
 {id:'BF',name:'BRASEROS · FORUM',kind:'restaurante'},
 {id:'BS',name:'BRASEROS · SEVERO',kind:'restaurante'},
 {id:'BE',name:'BRASEROS · EDIFICIO',kind:'restaurante'},
 {id:'BT',name:'BRASEROS · TOMILLARES',kind:'restaurante'},
 {id:'RV',name:'RIVIERA',kind:'restaurante'}
];
export const SUPPLIERS=['ESMO','MONTENEGRO','ÁNGEL VACA','JOSÉ ANTONIO','JAVI','ANGELO','COMPRA EXTERNA'];
const catalogList=`MANZANA PINK LADY|CHIRIMOYA|MANDARINA PLASENCIA|MARACUYA|MANDARINA COLOMBE|PINA|MELON|BROCOLI|MANZANA GOLDEN 28|LIMON SEGUNDA|PLATANO CANARIO PRIMERA|PAPAYA|MANGO|MANZANA GOLDEN 24|NARANJA MESA SONRISA|NARANJA HOJA|BATAVIA|PEREJIL|CHAMPINON|UVA BLANCA|UVA ROJA|CEREZA|ZANAHORIA|TOMATE ASURCADO MARRON|TOMATE ROSA|CEBOLLA DULCE|CEBOLLA NORMAL|MANDARINA HOJA|MANZANA GRANNY SMITH|KIWI ZESPRI GOLD|VALVENOSTA GOLDEN|KIWI ZESPRI|PERA RINCON DEL SOTO|GRANADA|PERA LIMONERA|NUECES|AGUACATE GRANEL|PERA CONFERENCIA SEGUNDA|KIWI SEGUNDA|KAKI|REINETA PARDA|COLIFLOR|ICEBERG|GUINDILLA|PIMIENTO PADRON|CASTANA|ESCAROLA|ACELGAS|ESPINACA|APIO|NARANJA ZUMO|ARANDANOS|SETAS|BERENJENA|CALABACIN|PIMIENTO ITALIANO ROJO|PUERROS|PEPINO|BONIATO|TOMATE PERA|TOMATE RAFF|TOMATE RAMA|TOMATE ASURCADO AZUL|CEBOLLA ROJA|PATATA 5 KG|AJO PRIMERA|REMOLACHA|MANZANA GOLDEN 20|MANZANA GOLDEN 24|MANZANA GOLDEN 28|MANZANA ROYAL GALA 24|REINETA 24|REINETA 28|PATATA 10 KG|PATATA 25 KG|CILANTRO|KIWI TOMASIN|YAUTIA|YAME|MACHO VERDE|MACHO MADURO|CEBOLLA ROJA|SANDIA|NARANJA ZUMO`; 
export const SEED_CATALOG=[...new Set([...catalogList.split('|'),'BANANA'])].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
export function canonical(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
export function display(s){return canonical(s);}
export function suggest(name,catalog){
 const t=canonical(name), c=catalog.map(x=>canonical(x));
 // Los términos varietales/numéricos tienen preferencia sobre coincidencias de otras familias.
 const words=t.split(' '),family=words[0];
 // Nunca sugerir calibre distinto por una errata numérica: GOLDEN 29 no es GOLDEN 28.
 const numericTokens=t.split(' ').filter(w=>/^\d+$/.test(w));
 const compatible=v=>numericTokens.every(n=>v.split(' ').includes(n));
 const candidates=c.filter(v=>compatible(v)&&(v.split(' ')[0]===family || (family==='GOLDEN'&&v.includes('GOLDEN')) || (family==='GRNNY'&&v.includes('GRANNY')) || (t.includes('GRNNY')&&v.includes('GRANNY'))));
 const lev=(a,b)=>{const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n];};
 const compare=x=>{
  // Una abreviatura conocida puede omitir la familia, pero no variedad ni calibre.
  const forms=[x];
  if(x.startsWith('MANZANA '))forms.push(x.slice(8));
  if(x.startsWith('PERA '))forms.push(x.slice(5));
  return Math.min(...forms.map(form=>lev(t,form)));
 };
 return (candidates.length?candidates:c.filter(compatible))
  .map(x=>({x,score:compare(x)}))
  .filter(v=>v.score<=Math.max(2,Math.ceil(t.length*.32)))
  .sort((a,b)=>a.score-b.score||a.x.localeCompare(b.x,'es')).slice(0,3).map(v=>v.x);
}
let serial=0;const id=(p)=>`${p}_${typeof crypto!=='undefined' && crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+(++serial)+'_'+Math.random().toString(36).slice(2)}`;
export function createState(){const d=new Date();const day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return {day,catalog:[...SEED_CATALOG],aliases:{},orders:[],allocations:[],manual:[],receipts:[],delivery:{},load:{},shortageAllocation:{},riderAssignments:{},riders:['REPARTIDOR 1','REPARTIDOR 2'],destinations:structuredClone(DESTINATIONS),history:[],sentMessages:[],importedFingerprints:[]};}
/** Erratas seguras de productos: solo abreviaturas inequívocas. Nunca corregir
 * automáticamente variedades, calibres ni denominaciones ambiguas. */
/** Reconocimiento seguro: alias explícitos y plurales de familias.
 * Nunca se elimina un calibre, calidad u origen para forzar una coincidencia.
 */
const SAFE_EXACT_ALIASES=Object.freeze({
 BANAN:'BANANA',BANANAS:'BANANA',
 'PINK LADY':'MANZANA PINK LADY',
 'GRANNY SMITH':'MANZANA GRANNY SMITH',
 'GOLDEN 20':'MANZANA GOLDEN 20','GOLDEN 24':'MANZANA GOLDEN 24','GOLDEN 28':'MANZANA GOLDEN 28'
});
const FAMILY_PLURALS=Object.freeze({
 MANZANAS:'MANZANA',TOMATES:'TOMATE',BANANAS:'BANANA',
 PERAS:'PERA',PATATAS:'PATATA',CEBOLLAS:'CEBOLLA',
 NARANJAS:'NARANJA',LIMONES:'LIMON',MANDARINAS:'MANDARINA',
 PIMIENTOS:'PIMIENTO',PLATANOS:'PLATANO',PEPINOS:'PEPINO',
 AGUACATES:'AGUACATE',ZANAHORIAS:'ZANAHORIA',CHAMPINONES:'CHAMPINON',
 KIWIS:'KIWI',CALABACINES:'CALABACIN',MELONES:'MELON'
});
export function normalizedProductName(name,state){
 const key=canonical(name);
 if(!key)return key;
 const aliases=state.aliases||{};
 // Una corrección confirmada por el usuario se recuerda para próximas listas.
 if(aliases[key])return canonical(aliases[key]);
 const fixed=SAFE_EXACT_ALIASES[key];
 if(fixed)return (state.catalog||[]).find(c=>canonical(c)===fixed)||fixed;
 const exact=(state.catalog||[]).find(c=>canonical(c)===key);
 if(exact)return exact;
 const words=key.split(' ');
 if(FAMILY_PLURALS[words[0]]){
  const singular=[FAMILY_PLURALS[words[0]],...words.slice(1)].join(' ');
  const match=(state.catalog||[]).find(c=>canonical(c)===singular);
  if(match)return match;
 }
 return key;
}
export function matchCatalog(name,state){
 const key=canonical(name),norm=normalizedProductName(key,state);
 return (state.catalog||[]).find(c=>canonical(c)===canonical(norm))
   ||(SAFE_EXACT_ALIASES[key]===norm ? norm:null);
}
const num=(x)=>Number(String(x).replace(',','.'));
/** Quita el prefijo de WhatsApp [fecha, hora] remitente: sin alterar cantidades. */
export function stripWhatsAppPrefix(line){
 return String(line||'')
  .replace(/^\s*\[\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}[^\]]*\]\s*[^:]{1,100}:\s*/,'')
  .replace(/^\s*[-•*]+\s*/,'').trim();
}
export function parseOrderLine(line,state){
 const text=stripWhatsAppPrefix(line);if(!text)return null;
 let name=text,q=null,unit='BULTO';
 // 3TOMATE RAMA; 1,5 KG TOMATE; 3 x MANZANA; 7 PATATA 5 KG
 const m=text.match(/^(\d+\/\d+|\d+(?:[,.]\d+)?)\s*(?:[xX*]\s*)?(KG|KGS|CAJAS?|MANOJOS?|SACOS?|UNDS?|UDS?)?\s*(.+)$/i);
 if(m){q=m[1].includes('/')?m[1].split('/').map(Number).reduce((a,b)=>a/b):num(m[1]);name=m[3];if(m[2]){const token=canonical(m[2]);unit=token.startsWith('KG')?'KG':token.startsWith('CAJA')?'CAJA':token.startsWith('SACO')?'SACO':token.startsWith('MANOJO')?'MANOJO':'UD';}}
 else {
   // Nombre terminado en cantidad: GOLDEN 28 3 y PATATA 5 KG 7.
   // Nombre + cantidad (BANANA 0,5), incluyendo unidad final y fracciones.
   // Si el texto completo ES un producto del catálogo, no confundir calibre
   // GOLDEN 28 o formato PATATA 5 KG con una cantidad comprada.
   const last=text.match(/^(.+?)(?:\s+|\s*[:=]\s*)(\d+(?:[,.]\d+)?|\d+\/\d+)(?:\s*(KG|KGS|CAJAS?|MANOJOS?|SACOS?|UNDS?|UDS?))?$/i);
   if(last){
    const maybeFull=canonical(text),end=last[2],prefix=canonical(last[1]);
    const calibreLike=/\b(GOLDEN|REINETA|FUJI|ROYAL GALA)\b/.test(prefix)&&/^\d{2}$/.test(end);
    const packWeight=/^PATATA\s+\d+(?:[,.]\d+)?\s*KG$/.test(maybeFull);
    if(!matchCatalog(maybeFull,state)&&!calibreLike&&!packWeight){
     name=last[1].trim();
     q=end.includes('/')?end.split('/').map(Number).reduce((a,b)=>a/b):num(end);
     if(last[3]){const token=canonical(last[3]);unit=token.startsWith('KG')?'KG':token.startsWith('CAJA')?'CAJA':token.startsWith('SACO')?'SACO':token.startsWith('MANOJO')?'MANOJO':'UD';}
    }
   }
 }
 // GOLDEN 28 3 se interpreta como qty 3, calibre 28; nunca 28 cajas.
 if(!Number.isFinite(q)||q<=0)q=null;
 const k=canonical(name);let found=matchCatalog(k,state);
 // Un alias abreviado sólo si el calibre coincide exactamente.
 if(!found&&/^GOLDEN\s+\d{2}$/.test(k))found=matchCatalog('MANZANA '+k,state);
 const issues=[];
 if(!found)issues.push('PRODUCTO_NO_EN_CATALOGO');
 if(q===null)issues.push('CANTIDAD_SIN_CONFIRMAR');
 return {id:id('line'),raw:text,sourceName:k,product:found||k,q,unit,review:issues.length>0,issues,suggestions:found?[]:suggest(k,state.catalog)};
}
function parseHeader(line,state){
 let h=line.replace(/^\[[^\]]+\]\s*[^:]{1,120}:\s*/,'').replace(/🛒/g,'').replace(/\*/g,'').trim();
 const match=h.match(/^PEDIDO\s+(.+)$/i);if(!match)return null;
 const raw=canonical(match[1]);const labels={SL:'SL',SP:'SP',ST:'ST','SAN PABLO':'SP','SAN LESMES':'SL',SANTIAGO:'ST','BRASEROS CENTRO':'BC','BRASEROS FORUM':'BF','BRASEROS SEVERO':'BS','BRASEROS EDIFICIO':'BE','BRASEROS TOMILLARES':'BT','RIVIERA':'RV','BRASEROS TOMILLARES':'BT','BRASEROS CENTRO GENERAL':'BC'};
 return labels[raw] || state.destinations.find(d=>canonical(d.name)===raw)?.id || 'UNKNOWN:'+raw;
}
export function importBlocks(state,text,{replace=false}={}){
 const fingerprint=canonical(text);if(!replace&&state.importedFingerprints?.includes(fingerprint))throw Error('Estas listas ya se han pegado en esta jornada. Evita duplicar pedidos.');
 let dest=null,n=0;const issues=[];const seen=new Set();
 for(const original of String(text).split(/\r?\n/)){
  const raw=stripWhatsAppPrefix(original);
  if(!raw)continue;
  const heading=parseHeader(raw,state);
  if(heading){dest=heading.startsWith('UNKNOWN:')?null:heading;if(!dest)issues.push('Destino no reconocido: '+heading.substring(8));if(replace&&dest&&!seen.has(dest)){if(state.allocations.some(a=>a.status!=='cancelled')||state.manual.length||Object.keys(state.delivery).length)throw Error('No puedes sustituir pedidos con asignaciones, compras o bajadas iniciadas. Corrige cantidades desde Compras para conservar el historial');state.orders=state.orders.filter(o=>o.dest!==dest);seen.add(dest);}continue;}
  if(!dest){if(raw.trim().startsWith('['))continue;issues.push('Línea sin destino: '+raw.trim());continue;}
  const parsed=parseOrderLine(raw,state);if(parsed){
   const late=state.allocations.some(a=>a.status==='sent');
   state.orders.push({...parsed,dest,...(late?{kind:'pedido-adicional',receivedAt:new Date().toISOString()}:{} )});n++;}
 }
 if(!state.importedFingerprints)state.importedFingerprints=[];state.importedFingerprints.push(fingerprint);
 return {imported:n,issues};
}
export function confirmProduct(state,lineId,target,{create=false,remember=true}={}){
 const line=state.orders.find(l=>l.id===lineId);if(!line)throw Error('No existe la línea');
 const clean=canonical(target);
 const priorKey=canonical(line.product)+'|'+line.unit;
 if(canonical(line.product)!==clean&&(state.allocations.some(a=>a.status!=='cancelled'&&sameProductKey(state,a.key,priorKey))||state.manual.some(m=>sameProductKey(state,m.key,priorKey))||Object.keys(state.delivery).some(k=>k.startsWith(priorKey+'@'))))throw Error('Este producto ya tiene asignaciones, compras o bajadas. Deshaz primero las operaciones o corrige cantidades desde Compras; no se cambia su nombre silenciosamente');
 if(!clean)throw Error('Nombre vacío');
 const existing=matchCatalog(clean,state);
 if(!existing&&!create)throw Error('Producto inexistente: usa Crear nuevo');
 if(!existing)state.catalog.push(clean);
 const targetName=existing||clean;
 const original=canonical(line.sourceName);
 if(remember&&original!==canonical(targetName)){
   const signature=x=>canonical(x).split(' ').filter(w=>/^\d+$/.test(w)||['PRIMERA','SEGUNDA','TERCERA'].includes(w)).join('|');
   // Una corrección puntual NO debe enseñar a cambiar calibre o calidad
   // de todos los pedidos futuros (GOLDEN 24 nunca se aprende como GOLDEN 28).
   const safeSignature=signature(original)===signature(targetName);
   const prior=matchCatalog(original,state);
   if(safeSignature&&(!prior||canonical(prior)===canonical(targetName)))state.aliases[original]=targetName;
 }
 line.product=targetName;line.review=false;line.issues=line.q==null?['CANTIDAD_SIN_CONFIRMAR']:[];line.suggestions=[];
 if(line.issues.length)line.review=true;
 return targetName;
}
export function setQuantity(state,lineId,value){
 const line=state.orders.find(l=>l.id===lineId);
 if(!line)throw Error('Línea no encontrada');
 const q=num(value);
 if(!Number.isFinite(q)||q<=0)throw Error('Cantidad positiva requerida');
 const key=canonical(normalizedProductName(line.product,state))+'|'+(line.unit||'BULTO');
 const managed=state.allocations.some(a=>a.status!=='cancelled'&&sameProductKey(state,a.key,key))
  ||state.manual.some(m=>sameProductKey(state,m.key,key))
  ||Object.entries(state.delivery||{}).some(([path,val])=>path.includes('@')&&sameProductKey(state,path.slice(0,path.lastIndexOf('@')),key)&&Number(val)>0);
 if(managed)throw Error('Este producto ya tiene proveedor, compra o bajada. Corrige el pedido desde Compras con + / − para recalcular el Global y Reparto.');
 line.q=q;
 line.issues=line.issues.filter(x=>x!=='CANTIDAD_SIN_CONFIRMAR');
 line.review=line.issues.length>0;
}
export function addDestination(state,name,kind='restaurante'){const key=canonical(name);let d=state.destinations.find(x=>canonical(x.name)===key);if(d)return d;d={id:id('dest'),name:key,kind};state.destinations.push(d);return d;}
export function totals(state){
 const map=new Map();for(const l of state.orders){if(!l.q)continue;const name=normalizedProductName(l.product,state),key=canonical(name)+'|'+l.unit;let item=map.get(key);if(!item){item={key,product:name,unit:l.unit,total:0,by:{},unresolved:false};map.set(key,item);}
 item.total=fix(item.total+l.q);item.by[l.dest]=fix((item.by[l.dest]||0)+l.q);item.unresolved ||= (l.review && !(canonical(l.product)==='BANAN' && canonical(name)==='BANANA'));
 }
 return [...map.values()].sort((a,b)=>a.product.localeCompare(b.product,'es',{numeric:true}));
}
/** Compatibilidad sin borrar registros antiguos: las compras y bajadas
 * guardadas como BANAN se asocian al nuevo total BANANA. */
export function normalizedProductKey(state,key){
 const raw=String(key||''),split=raw.lastIndexOf('|');
 if(split<0)return canonical(normalizedProductName(raw,state));
 return canonical(normalizedProductName(raw.slice(0,split),state))+'|'+canonical(raw.slice(split+1));
}
export function sameProductKey(state,a,b){return normalizedProductKey(state,a)===normalizedProductKey(state,b);}
export function deliveredFor(state,key,dest){
 return fix(Object.entries(state.delivery||{}).reduce((sum,[location,qty])=>{
  const i=location.lastIndexOf('@');
  return i>=0&&location.slice(i+1)===dest&&sameProductKey(state,location.slice(0,i),key)?sum+(Number(qty)||0):sum;
 },0));
}
function legacyShortage(state,key){
 return state.shortageAllocation[key]||Object.entries(state.shortageAllocation||{}).find(([k])=>sameProductKey(state,k,key))?.[1]||null;
}
/** Ajuste rápido de cantidades pedidas por destino, SIN comprar el incremento.
 * Modifica las líneas de pedido existentes sin tocar proveedores, compras o
 * datos de bajadas. Valida la operación completa antes de aplicar cambios.
 * Sólo se acepta un destino y la misma unidad del producto.
 */
export function adjustDestinationDemand(state,key,dest,change,{expectedQuantity=null,day=null,historyLength=null}={}){
 if(day!==null&&day!==state.day)return {changed:false,code:'JORNADA_CAMBIADA'};
 if(historyLength!==null&&historyLength!==(state.history||[]).length)return {changed:false,code:'JORNADA_CAMBIADA'};
 if(!state.destinations.some(d=>d.id===dest))throw Error('Tienda o restaurante no encontrado');
 const row=totals(state).find(r=>sameProductKey(state,r.key,key));
 if(!row)throw Error('Producto no encontrado en el Global');
 const actual=fix(row.by[dest]||0);
 if(expectedQuantity!==null&&Math.abs(actual-Number(expectedQuantity))>1e-8)
  return {changed:false,code:'MODIFICADO_POR_OTRO',cantidad:actual,total:row.total};
 const delta=fix(Number(String(change).replace(',','.')));
 if(!Number.isFinite(delta)||delta===0)throw Error('Cambio de cantidad inválido');
 const next=fix(Math.max(0,actual+delta));
 const changeApplied=fix(next-actual);
 if(Math.abs(changeApplied)<1e-8)return {changed:false,code:'SIN_CAMBIOS',cantidad:actual,total:row.total};
 const nextOrders=structuredClone(state.orders);
 const matching=nextOrders.filter(o=>o.dest===dest&&o.q>0&&sameProductKey(state,canonical(o.product)+'|'+(o.unit||'BULTO'),row.key));
 if(changeApplied>0){
  const afterSupplierSend=state.allocations.some(a=>a.status==='sent');
  if(afterSupplierSend){
   nextOrders.push({id:id('adicional'),dest,raw:String(changeApplied)+' '+row.product,
    sourceName:canonical(row.product),product:row.product,q:changeApplied,unit:row.unit,
    review:false,issues:[],suggestions:[],kind:'pedido-adicional',receivedAt:new Date().toISOString()});
  }else if(matching.length){
   const l=matching[matching.length-1];
   l.q=fix(l.q+changeApplied);
  }else{
   nextOrders.push({id:id('cantidad'),dest,raw:String(changeApplied)+' '+row.product,
    sourceName:canonical(row.product),product:row.product,q:changeApplied,unit:row.unit,
    review:false,issues:[],suggestions:[],kind:'ajuste-cantidad'});
  }
 }else{
  let remaining=fix(-changeApplied);
  for(const l of [...matching].reverse()){
   if(remaining<=1e-8)break;
   const taken=fix(Math.min(l.q,remaining));
   l.q=fix(l.q-taken);remaining=fix(remaining-taken);
  }
  if(remaining>1e-8)throw Error('La cantidad indicada supera el pedido actual');
 }
 const draft={...state,orders:nextOrders}; // Conserva también las líneas ajustadas a 0 para poder recuperarlas en Pedidos.
 // Nunca permitir que el nuevo reparto deje cantidades ya bajadas sin respaldo.
 const plan=deliveryPlan(draft);
 for(const [location,q] of Object.entries(state.delivery||{})){
  if(!(Number(q)>0))continue;
  const at=location.lastIndexOf('@');if(at<0)continue;
  const productKey=location.slice(0,at),place=location.slice(at+1);
  const allowed=plan.eligible.filter(r=>r.dest===place&&sameProductKey(draft,r.key,productKey))
   .reduce((sum,r)=>sum+r.allowed,0);
  if(allowed+1e-8<deliveredFor(state,productKey,place))
   throw Error('Hay mercancía bajada que quedaría sin respaldo. Corrige primero Reparto o compra la diferencia.');
 }
 state.orders=draft.orders;
 return {changed:true,code:'ACTUALIZADO',cantidad:next,total:fix(row.total+changeApplied),
  anterior:actual,diferencia:changeApplied,pendiente:pendingPurchases(state).find(x=>sameProductKey(state,x.key,row.key))?.remainingToBuy||0};
}
export function qtyRequested(state,key){return totals(state).find(t=>sameProductKey(state,t.key,key))?.total||0;}
export function fix(n){return Math.round((Number(n)||0)*1000)/1000;}
export function assignSupplier(state,key,supplier,quantity){if(!SUPPLIERS.includes(supplier))throw Error('Proveedor desconocido');const row=totals(state).find(t=>t.key===key);if(!row)throw Error('Producto inexistente');if(row.unresolved)throw Error('Revisa el nombre en rojo antes de asignar');
 const q=quantity??row.total; if(!(q>0))throw Error('Cantidad no válida');
 // Prevent multiple draft assignments that exceed requested qty (extra requires separate manual purchase).
 const active=state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status!=='cancelled');const existing=active.find(a=>a.supplier===supplier&&a.status==='draft');
 const others=active.reduce((s,a)=>s+a.q,0)-(existing?.q||0);
 if(others+q>row.total+1e-8)throw Error('La asignación supera la cantidad pedida');
 if(existing)existing.q=fix(q);else state.allocations.push({id:id('prov'),key,supplier,q:fix(q),status:'draft'});
}
export function moveDraftToSupplier(state,key,supplier){
 const active=state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status!=='cancelled');
 if(active.some(a=>a.status==='sent'))throw Error('Este producto ya se envió: corrige el pedido en vez de moverlo silenciosamente');
 state.allocations=state.allocations.filter(a=>!sameProductKey(state,a.key,key)||a.status==='cancelled');
 return assignSupplier(state,key,supplier,qtyRequested(state,key));
}
export function supplierLines(state,supplier,includeSent=true){return state.allocations.filter(a=>a.supplier===supplier&&a.status!=='cancelled'&&(includeSent||a.status==='draft')).map(a=>({ ...a,product:normalizedProductName(a.key.split('|')[0],state) })).sort((a,b)=>a.product.localeCompare(b.product,'es',{numeric:true}));}
const qtyLabel=n=>String(n).replace('.',',');
function combinedSupplierTXT(lines,state){
 const map=new Map();for(const a of lines){const key=normalizedProductKey(state,a.key),old=map.get(key);
  if(old)old.q=fix(old.q+a.q);else map.set(key,{name:normalizedProductName(a.product,state),q:fix(a.q)});}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true})).map(a=>`${qtyLabel(a.q)}${display(a.name)}`).join('\n');
}
export function supplierTXT(state,supplier){return combinedSupplierTXT(supplierLines(state,supplier),state);}
export function prepareWhatsApp(state,supplier){return {supplier,text:supplierTXT(state,supplier),url:`https://wa.me/?text=${encodeURIComponent('PEDIDO '+supplier+'\n'+supplierTXT(state,supplier))}`};}
/** Sólo los productos que aún no han sido enviados: previene reenviar un pedido antiguo. */
export function supplierDraftTXT(state,supplier){return combinedSupplierTXT(supplierLines(state,supplier,false),state);}
export function supplierDraftWhatsApp(state,supplier){const text=supplierDraftTXT(state,supplier);return {supplier,text,url:text?`https://wa.me/?text=${encodeURIComponent('PEDIDO '+supplier+'\n'+text)}`:''};}
/** Un pedido individual es independiente y forma parte del total Global sólo cuando contiene líneas. */
export function destinationLines(state,dest){
 if(!state.destinations.some(d=>d.id===dest))throw Error('Destino desconocido');
 const map=new Map();
 for(const line of state.orders.filter(l=>l.dest===dest&&l.q>0)){
  const product=normalizedProductName(line.product,state),key=canonical(product)+'|'+line.unit;
  const old=map.get(key);
  if(old){old.q=fix(old.q+line.q);old.review ||= line.review;}
  else map.set(key,{key,product,unit:line.unit,q:fix(line.q),review:line.review && !(canonical(line.product)==='BANAN'&&canonical(product)==='BANANA')});
 }
 return [...map.values()].sort((a,b)=>a.product.localeCompare(b.product,'es',{numeric:true}));
}
export function destinationTXT(state,dest){return destinationLines(state,dest).map(l=>`${qtyLabel(l.q)}${display(l.product)}`).join('\n');}
export function destinationWhatsApp(state,dest){const d=state.destinations.find(x=>x.id===dest);if(!d)throw Error('Destino desconocido');const text=destinationTXT(state,dest);return {text,url:text?`https://wa.me/?text=${encodeURIComponent('PEDIDO '+display(d.name)+'\n'+text)}`:''};}
/** Conservar el Global completo, pero sacar lo asignado de la bandeja rápida de asignación. */
export function unassignedProducts(state){return totals(state).filter(r=>{
 const allocations=state.allocations.filter(a=>sameProductKey(state,a.key,r.key)&&a.status!=='cancelled');
 const manual=productStatus(state,r.key).manuallyBought;
 return !allocations.length && r.total-manual>1e-8;
});}
/** Volver a preparar un envío marcado por error, sólo si no se ha empezado a bajarlo. */
export function reopenSupplierSent(state,supplier){
 const lines=supplierLines(state,supplier).filter(a=>a.status==='sent');
 if(!lines.length)throw Error('No hay líneas enviadas para reabrir');
 for(const a of lines){if(Object.entries(state.delivery||{}).some(([location,q])=>{const at=location.lastIndexOf('@');return at>=0&&sameProductKey(state,location.slice(0,at),a.key)&&q>0;}))throw Error('Hay mercancía bajada: no se puede anular el envío sin corregir el reparto');}
 for(const a of state.allocations)if(a.supplier===supplier&&a.status==='sent')a.status='draft';
 return lines.length;
}

export function markSupplierSent(state,supplier){const lines=supplierLines(state,supplier,false);if(!lines.length)throw Error('No hay líneas nuevas para enviar');const packet={id:id('envio'),supplier,text:combinedSupplierTXT(lines,state),timestamp:new Date().toISOString(),confirmedByUser:true,channel:'confirmacion-manual'};for(const a of state.allocations)if(a.supplier===supplier&&a.status==='draft')a.status='sent';state.sentMessages.push(packet);return packet;}
export function manualBuy(state,key,q){const row=totals(state).find(t=>t.key===key);if(!row)throw Error('No existe producto');if(row.unresolved)throw Error('Confirma el producto antes de comprar');if(!(q>0))throw Error('Cantidad positiva requerida');state.manual.push({id:id('manual'),key,q:fix(q),confirmed:true});}
export function receiveSupplier(state,allocationId,q){const a=state.allocations.find(x=>x.id===allocationId&&x.status==='sent');if(!a)throw Error('El pedido debe estar enviado');if(!(q>0))throw Error('Cantidad inválida');const previous=state.receipts.filter(x=>x.allocationId===allocationId).reduce((s,x)=>s+x.q,0);if(previous+q>a.q+1e-8)throw Error('No se recibe más de lo enviado sin registrar una compra extra');state.receipts.push({id:id('receipt'),allocationId,q:fix(q)});}
export function authorizedQty(state,key){const sent=state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status==='sent').reduce((s,a)=>s+a.q,0);const manual=state.manual.filter(m=>sameProductKey(state,m.key,key)&&m.confirmed).reduce((s,a)=>s+a.q,0);return fix(sent+manual);}
export function actuallyReceived(state,key){const manual=state.manual.filter(m=>sameProductKey(state,m.key,key)&&m.confirmed).reduce((s,x)=>s+x.q,0);
 const received=state.receipts.filter(r=>sameProductKey(state,state.allocations.find(a=>a.id===r.allocationId)?.key,key)).reduce((s,x)=>s+x.q,0);return fix(manual+received);
}

/** Regla única de negocio usada por Global, Compras y Reparto.
 * Un borrador asignado NO autoriza bajadas. Un pedido realmente marcado
 * como enviado o una compra manual confirmada SÍ las autoriza.
 * La carga permanece completamente independiente.
 */
export function productStatus(state,key){
 const requested=qtyRequested(state,key);
 const active=state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status!=='cancelled');
 const assignedDraft=fix(active.filter(a=>a.status==='draft').reduce((sum,a)=>sum+a.q,0));
 const assignedSent=fix(active.filter(a=>a.status==='sent').reduce((sum,a)=>sum+a.q,0));
 const manuallyBought=fix(state.manual.filter(m=>sameProductKey(state,m.key,key)&&m.confirmed).reduce((sum,m)=>sum+m.q,0));
 const supplierReceived=fix(state.receipts.filter(r=>active.some(a=>a.id===r.allocationId)).reduce((sum,r)=>sum+r.q,0));
 const authorized=fix(assignedSent+manuallyBought);
 const status=authorized>0?'REPARTO_HABILITADO':assignedDraft>0?'ASIGNADO_SIN_ENVIAR':'SIN_GESTIONAR';
 return {requested,assignedDraft,assignedSent,manuallyBought,supplierReceived,authorized,status,remainingToAuthorize:fix(Math.max(0,requested-authorized)),extraPurchased:fix(Math.max(0,supplierReceived+manuallyBought-requested))};
}

/** Asignación rápida: una pulsación añade o mueve, y una segunda en el mismo
 * proveedor quita el borrador. Nunca borra ni cambia un envío confirmado.
 */
export function quickAssign(state,key,supplier){
 const row=totals(state).find(t=>t.key===key);
 if(!row)throw Error('Producto no encontrado');
 if(row.unresolved)throw Error('Revisa el nombre en rojo antes de asignar');
 if(!SUPPLIERS.includes(supplier)||supplier==='COMPRA EXTERNA')throw Error('Selecciona un proveedor válido');
 const active=state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status!=='cancelled');
 if(active.some(a=>a.status==='sent'))throw Error('Ya enviado: cualquier cambio requiere una corrección explícita');
 if(active.length&&active.every(a=>a.supplier===supplier&&a.status==='draft')){
  state.allocations=state.allocations.filter(a=>a.key!==key||a.status!=='draft');
  return 'DESASIGNADO';
 }
 const manual=productStatus(state,key).manuallyBought;
 const q=fix(row.total-manual);
 if(q<=0)throw Error('Ya está comprado manualmente: no dupliques la compra al asignar un proveedor');
 state.allocations=state.allocations.filter(a=>a.key!==key||a.status!=='draft');
 assignSupplier(state,key,supplier,q);
 return 'ASIGNADO';
}

/** Compra separada de recepción de proveedor.
 * - Nunca registra la recepción de un proveedor existente.
 * - Si existe borrador de proveedor, necesita retirarlo expresamente.
 * - Si excede la cantidad pedida, necesita confirmación adicional.
 */
export function manualBuySafe(state,key,q,{removeDraft=false,allowExtra=false}={}){
 const row=totals(state).find(t=>t.key===key);
 if(!row)throw Error('Producto no encontrado');
 if(row.unresolved)throw Error('Confirma el nombre en rojo antes de comprar');
 const qty=fix(Number(String(q).replace(',','.')));
 if(!(qty>0))throw Error('Cantidad de compra positiva requerida');
 const status=productStatus(state,key);
 const unassigned=fix(Math.max(0,row.total-status.authorized-status.assignedDraft));
 if(status.assignedDraft>0&&!removeDraft&&qty>unassigned+1e-8)throw Error('Existe pedido a proveedor sin enviar: no dupliques ese borrador. Retíralo antes de comprar su cantidad');
 const expected=fix(status.authorized+qty);
 if(expected>row.total+1e-8&&!allowExtra)throw Error('Compra superior al pedido: confirma expresamente la cantidad extra');
 if(removeDraft){
  // Reduce el borrador exactamente por la compra manual, sin borrar
  // silenciosamente los otros bultos que aún se esperan del proveedor.
  // Solo se retira del borrador la cantidad de compra que supera
  // lo que estaba libre, sin tocar otros bultos reservados al proveedor.
  let toReduce=fix(Math.max(0,qty-unassigned));
  for(const a of state.allocations.filter(a=>sameProductKey(state,a.key,key)&&a.status==='draft')){
   if(toReduce<=0)break;
   const reduction=Math.min(toReduce,a.q);
   a.q=fix(a.q-reduction);
   toReduce=fix(toReduce-reduction);
  }
  state.allocations=state.allocations.filter(a=>!(sameProductKey(state,a.key,key)&&a.status==='draft'&&a.q<=0));
 }
 manualBuy(state,key,qty);
 return productStatus(state,key);
}

/** Vista de control: la lista sin gestionar sigue visible en compras, aunque
 * Reparto únicamente reciba los autorizados.
 */
export function pendingPurchases(state){
 return totals(state).map(row=>{
  const st=productStatus(state,row.key);
  // Cada cantidad se cuenta una sola vez: enviada a proveedor, reservada
  // en borrador o comprada manualmente. La recepción no crea una segunda compra.
  const supplierCovered=fix(st.assignedSent+st.assignedDraft);
  const remainingToBuy=fix(Math.max(0,row.total-supplierCovered-st.manuallyBought));
  return {...row,...st,supplierCovered,remainingToBuy};
 });
}

/**
 * Deshacer una compra manual sin eliminar el historial. Cada reversión
 * crea una corrección negativa; los movimientos anteriores permanecen.
 * Nunca deja bajadas físicas sin cantidad habilitada.
 */
export function checkManualPurchaseReversal(state,key,quantity){
 const st=productStatus(state,key);
 const qty=fix(Number(String(quantity).replace(',','.')));
 if(!Number.isFinite(qty)||qty<=0||qty>st.manuallyBought+1e-8)
  throw Error('Cantidad a deshacer inválida o superior a lo comprado manualmente');
 const after=fix(st.authorized-qty);
 const delivered=fix(Object.entries(state.delivery||{}).filter(([location,v])=>{const at=location.lastIndexOf('@');return at>=0&&sameProductKey(state,location.slice(0,at),key)&&Number(v)>0;}).reduce((n,[,v])=>n+Number(v),0));
 if(after+1e-8<delivered){
  const name=totals(state).find(x=>x.key===key)?.product||key;
  throw Error(`No puedes desmarcar ${name}: hay ${delivered} ya bajado y quedarían ${after} habilitados. Deshaz primero las bajadas que correspondan.`);
 }
 return {key,qty,after,delivered};
}
export function reverseManualPurchase(state,key,quantity=null){
 const bought=productStatus(state,key).manuallyBought;
 const change=checkManualPurchaseReversal(state,key,quantity===null?bought:quantity);
 state.manual.push({id:id('correccion-manual'),key,q:fix(-change.qty),confirmed:true,kind:'reversal',timestamp:new Date().toISOString()});
 return productStatus(state,key);
}
/** Deshacer todas de forma atómica: si una afecta a bajadas, no modifica NINGUNA. */
export function reverseAllManualPurchases(state){
 const rows=pendingPurchases(state).filter(row=>row.manuallyBought>0);
 if(!rows.length)throw Error('No hay compras manuales activas para deshacer');
 for(const row of rows)checkManualPurchaseReversal(state,row.key,row.manuallyBought);
 for(const row of rows)reverseManualPurchase(state,row.key,row.manuallyBought);
 return rows.length;
}
/** Guardar cantidad total comprada manualmente por producto (no el total del proveedor). */
export function setManualPurchaseTotal(state,key,total,{allowExtra=false,removeDraft=false}={}){
 const n=fix(Number(String(total).replace(',','.')));
 if(!Number.isFinite(n)||n<0)throw Error('Introduce una cantidad válida, igual o mayor que cero');
 const current=productStatus(state,key).manuallyBought;
 if(n===current)return productStatus(state,key);
 if(n<current)return reverseManualPurchase(state,key,fix(current-n));
 return manualBuySafe(state,key,fix(n-current),{allowExtra,removeDraft});
}
/** Sólo cantidades por comprar manualmente, nunca proveedores cubiertos ni duplicados. */
export function pendingManualPurchaseTXT(state){
 return pendingPurchases(state).filter(r=>r.remainingToBuy>0&&!r.unresolved)
  .map(r=>`${qtyLabel(r.remainingToBuy)}${display(r.product)}`).join('\n');
}
export function pendingManualPurchaseWhatsApp(state){
 const text=pendingManualPurchaseTXT(state);
 return {text,url:text?`https://wa.me/?text=${encodeURIComponent('COMPRAS MANUALES PENDIENTES\n'+text)}`:''};
}

const dOrder=(a,b)=>{const ai=STORE_ORDER.indexOf(a),bi=STORE_ORDER.indexOf(b);if(ai>=0&&bi>=0)return ai-bi;if(ai>=0)return -1;if(bi>=0)return 1;return a.localeCompare(b);};
export function planShortage(state,key,by){
 const row=totals(state).find(t=>t.key===key);if(!row)throw Error('Producto no encontrado');
 const authorized=authorizedQty(state,key);let total=0;
 for(const [dest,rawQty] of Object.entries(by)){
  const q=num(rawQty);if(!Number.isFinite(q)||q<0)throw Error('Cantidad inválida');
  if(q>(row.by[dest]||0)+1e-8)throw Error('No se pueden asignar más de las cajas pedidas por tienda');
  if(q+(1e-8)<deliveredFor(state,key,dest))throw Error('No se puede quitar mercancía ya bajada');
  total+=q;
 }
 if(total>authorized+1e-8)throw Error('Se supera la mercancía habilitada');
 state.shortageAllocation[key]=Object.fromEntries(Object.entries(by).map(([d,q])=>[d,fix(num(q))]));
 return state.shortageAllocation[key];
}
/** Los pedidos adicionales NUNCA pueden consumir la cantidad previamente
 * reservada a las tiendas antes del envío a proveedor.  */
function lateCoveredPlan(state,t,authorized,sorted){
 const lateBy={};
 for(const line of state.orders||[]){
  if(line.kind!=='pedido-adicional'||!(line.q>0))continue;
  const k=canonical(normalizedProductName(line.product,state))+'|'+(line.unit||'BULTO');
  if(sameProductKey(state,k,t.key))lateBy[line.dest]=fix((lateBy[line.dest]||0)+line.q);
 }
 if(!Object.values(lateBy).some(q=>q>0)||legacyShortage(state,t.key))return null;
 const baseBy=Object.fromEntries(sorted.map(([dest,q])=>[dest,fix(Math.max(0,q-(lateBy[dest]||0)))]));
 const baseTotal=fix(Object.values(baseBy).reduce((n,q)=>n+q,0));
 const reserved={};
 for(const m of state.manual||[]){
  if(m.confirmed&&m.additionalDest&&sameProductKey(state,m.key,t.key))
   reserved[m.additionalDest]=fix((reserved[m.additionalDest]||0)+m.q);
 }
 const reservedTotal=fix(Object.values(reserved).reduce((n,q)=>n+Math.max(0,q),0));
 if(authorized-reservedTotal+1e-8<baseTotal)return null;
 let free=fix(Math.max(0,authorized-reservedTotal-baseTotal));
 const eligible=[],short=[];
 for(const [dest,demand] of sorted){
  const original=baseBy[dest]||0,late=lateBy[dest]||0;
  const own=fix(Math.min(late,Math.max(0,reserved[dest]||0)));
  const shared=fix(Math.min(Math.max(0,late-own),free));
  free=fix(free-shared);
  const allowed=fix(Math.min(demand,original+own+shared));
  if(allowed>0){const delivered=deliveredFor(state,t.key,dest);
   eligible.push({key:t.key,dest,product:t.product,unit:t.unit,
    requested:demand,allowed,delivered,remaining:fix(Math.max(0,allowed-delivered))});}
  if(allowed<demand)short.push({key:t.key,dest,product:t.product,missing:fix(demand-allowed),unit:t.unit});
 }
 return {eligible,short};
}

export function deliveryPlan(state){const eligible=[],blocked=[],short=[],needsReview=[];let all=totals(state);
 for(const t of all){const authorized=productStatus(state,t.key).authorized;
  if(!authorized){blocked.push({...t,reason:'SIN ENVIAR NI COMPRAR'});continue;}
  const sorted=Object.entries(t.by).sort((a,b)=>dOrder(a[0],b[0]));
  const addition=lateCoveredPlan(state,t,authorized,sorted);
  if(addition){eligible.push(...addition.eligible);short.push(...addition.short);continue;}
  // Si afecta a varias tiendas y falta producto, no se elige arbitrariamente quién recibe menos.
  const partial=authorized<t.total-1e-8&&sorted.length>1;
  const specified=legacyShortage(state,t.key);
  if(partial&&!specified){
   needsReview.push({...t,authorized,reason:'REPARTO INSUFICIENTE: ELIGE CANTIDADES POR DESTINO'});
   // Las bajadas ya hechas no desaparecen porque después aumenten un pedido.
   // Se mantienen únicamente esos mínimos y la disponibilidad libre queda
   // pendiente de distribuir manualmente, nunca se reparte a otra tienda.
   const physical=sorted.map(([dest,demand])=>({dest,demand,delivered:deliveredFor(state,t.key,dest)}));
   const taken=fix(physical.reduce((sum,x)=>sum+x.delivered,0));
   if(taken<=authorized+1e-8){
    for(const {dest,demand,delivered} of physical){
     if(delivered>0)eligible.push({key:t.key,dest,product:t.product,unit:t.unit,
      requested:demand,allowed:delivered,delivered,remaining:0});
     if(delivered<demand)short.push({key:t.key,dest,product:t.product,missing:fix(demand-delivered),unit:t.unit});
    }
   }
   continue;
  }
  let left=authorized;
  for(const [dest,demand] of sorted){const proposal=partial?fix(specified[dest]||0):demand;const allowed=fix(Math.min(demand,left,proposal));
   if(allowed>0){const delivered=deliveredFor(state,t.key,dest);eligible.push({key:t.key,dest,product:t.product,unit:t.unit,requested:demand,allowed,delivered,remaining:fix(Math.max(0,allowed-delivered))});}
   if(allowed<demand)short.push({key:t.key,dest,product:t.product,missing:fix(demand-allowed),unit:t.unit});
   left=fix(Math.max(0,left-allowed));}
 }
 return {eligible:eligible.sort((a,b)=>dOrder(a.dest,b.dest)||a.product.localeCompare(b.product,'es',{numeric:true})),blocked,short,needsReview};
}

export function deliver(state,key,dest,q=null){const row=deliveryPlan(state).eligible.find(r=>r.key===key&&r.dest===dest);if(!row)throw Error('Producto no habilitado para reparto');const add=q===null?row.remaining:num(q);if(!(add>0)||add>row.remaining+1e-8)throw Error('Cantidad superior al reparto habilitado');const k=key+'@'+dest;state.delivery[k]=fix((state.delivery[k]||0)+add);return state.delivery[k];}
export function undoDelivery(state,key,dest){for(const location of Object.keys(state.delivery||{})){const at=location.lastIndexOf('@');if(at>=0&&location.slice(at+1)===dest&&sameProductKey(state,location.slice(0,at),key))delete state.delivery[location];}}

/** Progreso de bajada por destino, ponderado por cantidades realmente habilitadas.
 * No mezcla tiendas y nunca cuenta productos sin compra/envío como bajados.
 */
export function deliveryProgress(state,dest){
 // El progreso incluye TODO el pedido de la tienda, también lo que aún
 // falta comprar o repartir. Evita enseñar 100 % con cajas todavía faltantes.
 // Cada producto pesa una fila; nunca se suman bultos, kilos y manojos.
 const rows=totals(state).filter(x=>(x.by[dest]||0)>0);
 const total=rows.length;
 const bajado=fix(rows.reduce((sum,r)=>sum+Math.min(1,deliveredFor(state,r.key,dest)/(r.by[dest]||1)),0));
 const completos=rows.filter(r=>deliveredFor(state,r.key,dest)+1e-8>=r.by[dest]).length;
 const pendientes=total-completos;
 return {total,bajado,restante:fix(Math.max(0,total-bajado)),
   porcentaje:total>0?Math.min(100,Math.round(bajado/total*100)):0,
   productos:rows.length,completos,pendientes};
}

/** Mutación segura para una transacción Firebase: compara la fila VISIBLE con la
 * última fila de la nube. Dos personas no pueden tickar dos veces lo mismo.
 * Devuelve changed=false SIN modificar el estado cuando hay cambio concurrente.
 */
export function applyDeliveryMutation(state,{action,key,dest,quantity=null,expectedDelivered,expectedAllowed,day,historyLength}){
 if(state.day!==day||((state.history||[]).length)!==historyLength)
  return {changed:false,code:'JORNADA_CAMBIADA'};
 const row=deliveryPlan(state).eligible.find(r=>r.key===key&&r.dest===dest);
 if(!row)return {changed:false,code:'NO_HABILITADO'};
 if(!Number.isFinite(Number(expectedDelivered))||Math.abs(row.delivered-Number(expectedDelivered))>1e-8)
  return {changed:false,code:'MODIFICADO_POR_OTRO'};
 if(!Number.isFinite(Number(expectedAllowed))||Math.abs(row.allowed-Number(expectedAllowed))>1e-8)
  return {changed:false,code:'CANTIDAD_ACTUALIZADA'};
 if(action==='bajar'){
  if(row.remaining<=1e-8)return {changed:false,code:'YA_BAJADO'};
  const amount=quantity===null?row.remaining:num(quantity);
  if(!Number.isFinite(amount)||amount<=0)return {changed:false,code:'CANTIDAD_INVALIDA'};
  if(amount>row.remaining+1e-8)return {changed:false,code:'CANTIDAD_INSUFICIENTE'};
  deliver(state,key,dest,amount);
  return {changed:true,code:'BAJADO',cantidad:fix(amount)};
 }
 if(action==='deshacer'){
  if(row.delivered<=1e-8)return {changed:false,code:'YA_DESHECHO'};
  undoDelivery(state,key,dest);
  return {changed:true,code:'DESHECHO',cantidad:fix(row.delivered)};
 }
 // Ajuste individual, atómico y reversible en el mismo destino.
 if(action==='ajustar'){
  const delta=fix(Number(String(quantity).replace(',','.')));
  if(!Number.isFinite(delta)||Math.abs(delta)<1e-8)return {changed:false,code:'CANTIDAD_INVALIDA'};
  if(delta>row.remaining+1e-8)return {changed:false,code:'CANTIDAD_INSUFICIENTE'};
  if(-delta>row.delivered+1e-8)return {changed:false,code:'CANTIDAD_INSUFICIENTE'};
  if(delta>0)deliver(state,key,dest,delta);
  else{
   // Respetar claves antiguas del mismo producto para no perder bajadas.
   let left=fix(-delta);
   for(const location of Object.keys(state.delivery||{}).reverse()){
    const at=location.lastIndexOf('@');
    if(at<0||location.slice(at+1)!==dest||!sameProductKey(state,location.slice(0,at),key))continue;
    const take=fix(Math.min(left,Number(state.delivery[location])||0));
    if(take<=0)continue;
    const next=fix(Number(state.delivery[location])-take);
    if(next>0)state.delivery[location]=next;
    else delete state.delivery[location];
    left=fix(left-take);
    if(left<=1e-8)break;
   }
   if(left>1e-8)throw Error('No se pudo encontrar la bajada anterior; no se guardó el ajuste');
  }
  return {changed:true,code:'AJUSTADO',cantidad:delta};
 }
 return {changed:false,code:'ACCION_DESCONOCIDA'};
}

export function loadItem(state,key,dest,q){state.load[key+'@'+dest]=fix(q);}
export function surplus(state){const out=[];for(const t of totals(state)){const extra=fix(Math.max(0,actuallyReceived(state,t.key)-t.total));if(extra>0)out.push({...t,extra});}return out;}
export function distributeSurplus(extra,{fractional=false}={}){
 if(!(extra>0))return {SP:0,SL:0,ST:0};
 if(fractional)return {SP:fix(extra*.6),SL:fix(extra*.2),ST:fix(extra-fix(extra*.6)-fix(extra*.2))};
 const total=Math.round(extra);const exact=[total*.6,total*.2,total*.2];const amounts=exact.map(Math.floor);let rem=total-amounts.reduce((a,b)=>a+b,0);const places=exact.map((v,i)=>({i,r:v-amounts[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);
 for(let i=0;i<rem;i++)amounts[places[i%3].i]++;
 return {SP:amounts[0],SL:amounts[1],ST:amounts[2]};
}
export function assignRider(state,dest,name){if(!state.destinations.some(x=>x.id===dest))throw Error('Destino desconocido');const rider=canonical(name);if(!rider)throw Error('Repartidor vacío');if(!state.riders.includes(rider))state.riders.push(rider);state.riderAssignments[dest]=rider;}
export function newDay(state,newDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate))throw Error('Fecha inválida');const before={day:state.day,orders:state.orders,allocations:state.allocations,manual:state.manual,receipts:state.receipts,delivery:state.delivery,load:state.load,shortageAllocation:state.shortageAllocation||{},riderAssignments:state.riderAssignments||{},sentMessages:state.sentMessages||[]};state.history.push(structuredClone(before));state.day=newDate;state.orders=[];state.allocations=[];state.manual=[];state.receipts=[];state.delivery={};state.load={};state.shortageAllocation={};state.riderAssignments={};state.sentMessages=[];state.importedFingerprints=[];}
export function summary(state){const t=totals(state),p=deliveryPlan(state);return {day:state.day,destinations:state.destinations.length,originalLines:state.orders.length,products:t.length,quantities:fix(t.reduce((s,x)=>s+x.total,0)),unreviewed:state.orders.filter(x=>x.review).length,assignedDraft:state.allocations.filter(a=>a.status==='draft').length,assignedSent:state.allocations.filter(a=>a.status==='sent').length,manualBought:pendingPurchases(state).filter(r=>r.manuallyBought>0).length,deliverable:p.eligible.length,blocked:p.blocked.length,shortages:p.short.length,shortageReview:p.needsReview.length,delivered:Object.keys(state.delivery).length};}