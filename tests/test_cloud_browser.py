# Prueba visual del flujo con Firebase SIMULADO. NO se conecta a una base real.
from pathlib import Path
from playwright.sync_api import sync_playwright
code=Path(__file__).resolve().parents[1].joinpath('index.html').read_text().split('<script>',1)[1].rsplit('</script>',1)[0]
for before,after in [
 ("apiKey: ''", "apiKey: 'firebase-demo-key'"),
 ("authDomain: ''", "authDomain: 'arslan-listas-demo.firebaseapp.com'"),
 ("databaseURL: ''", "databaseURL: 'https://arslan-listas-demo-default-rtdb.europe-west1.firebasedatabase.app'"),
 ("projectId: ''", "projectId: 'arslan-listas-demo'"),
 ("appId: ''", "appId: '1:123456:web:example'"),
]:
 assert before in code,before
 code=code.replace(before,after,1)
inject = '''
window.__cloudDb={record:null};
createArslanCloudAdapter=async function(){return {
 setUser(id){this.ownerId=id;},
 onAuthChange(){return ()=>{}},
 async session(){return {user:{uid:'firebase-test-123',email:'pruebas@example.com'}}},
 async sendLogin(){},async signOut(){},
 async read(){return structuredClone(window.__cloudDb.record)},
 async create(data){if(window.__cloudDb.record)throw Error('Record already exists');window.__cloudDb.record={revision:1,data:structuredClone(data)};return structuredClone(window.__cloudDb.record)},
 async update(data,rev){if(window.__cloudDb.record.revision!==rev)return null;window.__cloudDb.record={revision:rev+1,data:structuredClone(data)};return structuredClone(window.__cloudDb.record)},
 watch(){return ()=>{}}
}}
'''
code=code.replace('const FIXTURE =',inject+'\nconst FIXTURE =',1)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>')
 page.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()},configurable:true}); }''')
 page.evaluate('(js)=>{(0,eval)(js)}',code)
 page.wait_for_function("document.querySelector('#sync-badge')?.textContent==='SINCRONIZADO'",timeout=10000)
 assert page.evaluate('window.__cloudDb.record.revision')==1
 assert page.evaluate('window.__cloudDb.record.data.orders.length')==0
 page.locator('button[data-action="goto"][data-key="pedidos"]').first.click()
 page.locator('textarea#paste').fill('PEDIDO SP\n2 TOMATE RAMA')
 page.locator('button[data-action="import"]').click()
 page.wait_for_function('window.__cloudDb.record.revision>=2',timeout=10000)
 assert page.evaluate('window.__cloudDb.record.data.orders[0].q')==2
 page.locator('button[data-action="goto"][data-key="inicio"]').first.click()
 assert page.locator('#sync-badge').inner_text()=='SINCRONIZADO'
 assert page.locator('button[data-action="cloud-backup"]').count()==1
 assert page.locator('button[data-action="cloud-choose-import"]').count()==1
 assert not errors,errors
 print('Firebase SIMULADO: inicio autenticado, guardado, revisión, pantalla móvil y botones de copia/importación OK; 0 JS errors')
 browser.close()