"""Comprueba navegación con Firebase simulado y pedidos locales preexistentes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
css=html.split('<style>',1)[1].split('</style>',1)[0]
script=html.split('<script>',1)[1].rsplit('</script>',1)[0]
# Inyectar usuario existente, en dispositivo original, antes del inicio de la aplicación.
preload='''
const oldSaved=createState();
importBlocks(oldSaved,'PEDIDO SP\\n3 TOMATE RAMA\\n2 MANZANA GOLDEN 28\\nPEDIDO SL\\n1 TOMATE RAMA');
localStorage.setItem('arslan_listas_reparto_seguro_v5_local_only',JSON.stringify(oldSaved));
const __cloudBox={document:null};
createArslanCloudAdapter=async function(){return {
 setUser(id){this.uid=id;},onAuthChange(){return ()=>{}},
 async session(){return {user:{uid:'qa-device-2026',email:'pruebas@example.com'}}},
 async sendLogin(){},async signOut(){},
 async read(){return structuredClone(__cloudBox.document)},
 async create(data){if(__cloudBox.document)throw Error('ya hay datos');__cloudBox.document={revision:1,data:structuredClone(data)};return structuredClone(__cloudBox.document)},
 async update(data,rev){if(__cloudBox.document?.revision!==rev)return null;__cloudBox.document={revision:rev+1,data:structuredClone(data)};return structuredClone(__cloudBox.document)},
 watch(){return ()=>{}}
}}
'''
assert 'const FIXTURE =' in script
script=script.replace('const FIXTURE =',preload+'\nconst FIXTURE =',1)
script+='\nwindow.__qa=()=>({orders:state.orders.length,cloud:__cloudBox.document,tab});' 
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pg=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 errors=[]
 pg.on('pageerror',lambda exc:errors.append(str(exc)))
 pg.set_content('<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+css+'</style></head><body><div id="app"></div></body></html>')
 pg.evaluate("""() => {const m=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}})}""")
 pg.evaluate('(js)=>(0,eval)(js)',script)
 pg.wait_for_function("document.querySelector('#sync-badge')?.textContent==='IMPORTAR A NUBE'",timeout=10000)
 assert pg.evaluate('window.__qa().orders')==3
 assert pg.evaluate('window.__qa().cloud===null'), 'no debe crear nube vacía'
 for name,heading in [('compras','Compras'),('reparto','Bajar mercancía'),('pedidos','Pedidos')]:
  pg.locator('.bottomnav button[data-key="'+name+'"]').click()
  assert pg.locator('main h1').inner_text()==heading
  assert pg.evaluate('window.__qa().orders')==3
  assert pg.evaluate('document.documentElement.scrollWidth===innerWidth')
 pg.locator('.bottomnav button[data-key="inicio"]').click()
 assert pg.locator('button[data-action="cloud-init"]').count()==1
 assert pg.evaluate('window.__qa().cloud===null')
 assert not errors,errors
 print('Firebase SIMULADO iPhone: conserva 3 líneas locales, Compras/Reparto/Pedidos abren, ofrece importar sin crear nube vacía, 0 JS errors')
 browser.close()