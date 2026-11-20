# Smoke test de la UI con un servidor simulado: NO es una prueba de Supabase real.
from pathlib import Path
from playwright.sync_api import sync_playwright
code=Path(__file__).resolve().parents[1].joinpath('index.html').read_text().split('<script>',1)[1].rsplit('</script>',1)[0]
code=code.replace("url: '',", "url: 'https://mock.supabase.co',",1).replace("publishableKey: ''", "publishableKey: 'sb_publishable_test'",1)
# Inyectar adaptador falso en la misma función del bundle justo antes de definir la UI.
inject = '''
window.__cloudDb={record:null};
createArslanCloudAdapter=async function(){return {
 setUser(id){this.ownerId=id;},
 onAuthChange(){return {unsubscribe(){}}},
 async session(){return {user:{id:'user-123',email:'pruebas@example.com'}}},
 async sendLogin(){},async signOut(){},
 async read(){return structuredClone(window.__cloudDb.record)},
 async create(data){window.__cloudDb.record={revision:1,data:structuredClone(data)};return structuredClone(window.__cloudDb.record)},
 async update(data,rev){if(window.__cloudDb.record.revision!==rev)return null;window.__cloudDb.record={revision:rev+1,data:structuredClone(data)};return structuredClone(window.__cloudDb.record)},
 watch(){return ()=>{}}
}}
'''
code=code.replace('const FIXTURE =',inject+'\nconst FIXTURE =',1)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>')
 page.evaluate('''() => { const m=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()},configurable:true}); }''')
 page.evaluate('(js)=>{(0,eval)(js)}',code)
 page.wait_for_function("document.querySelector('#sync-badge')?.textContent==='SINCRONIZADO'",timeout=7000)
 print('Auth + initial cloud:',page.locator('#sync-badge').inner_text())
 print('Cloud revision:',page.evaluate('window.__cloudDb.record.revision'))
 assert page.evaluate('window.__cloudDb.record.data.orders.length')==0
 page.get_by_role('button',name='Pedidos',exact=True).first.click()
 page.locator('textarea#paste').fill('PEDIDO SP\n2 TOMATE RAMA')
 page.locator('button[data-action="import"]').click()
 page.wait_for_function('window.__cloudDb.record.revision>=2',timeout=7000)
 assert page.evaluate('window.__cloudDb.record.data.orders[0].product')=='TOMATE RAMA'
 assert page.evaluate('window.__cloudDb.record.data.orders[0].q')==2
 print('Cloud after adding order:',page.evaluate('window.__cloudDb.record.revision'))
 page.get_by_role('button',name='Hoy').first.click()
 print('Latest sync badge:',page.locator('#sync-badge').inner_text())
 assert page.locator('#sync-panel').get_by_text('Sincronización de LISTAS').count()==1
 assert not errors, errors
 print('Browser mock flow: OK. No JS page errors.')
 page.screenshot(path='/mnt/data/ARSLAN_LISTAS_SYNC/sync_nube_simulada_movil.png')
 b.close()