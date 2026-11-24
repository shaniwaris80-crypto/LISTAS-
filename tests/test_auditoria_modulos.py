"""Auditoría modular de las operaciones críticas de ARSLAN LISTAS NEXT.

Usa datos sintéticos, localStorage en memoria y red bloqueada. Cada módulo
empieza desde un estado limpio para que un fallo visual no oculte los demás.
"""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'audit-output'
OUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text(encoding='utf8')
HTML=HTML.replace('const ARSLAN_CLOUD_ACTIVE = Boolean(','const ARSLAN_CLOUD_ACTIVE = false && Boolean(',1)
RESULT={'actions':[], 'screens':[], 'findings':[], 'network_requests':0}


def browser_launch(p):
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    system=(shutil.which('google-chrome') or shutil.which('google-chrome-stable')
            or shutil.which('chromium') or shutil.which('chromium-browser'))
    if system and not Path(p.chromium.executable_path).exists(): opts['executable_path']=system
    return p.chromium.launch(**opts)


def setup(browser,width=390,height=844,mobile=True):
    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
    context.route('**/*',lambda route:(RESULT.__setitem__('network_requests',RESULT['network_requests']+1),route.abort()))
    page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_default_timeout(5000)
    page.evaluate('''() => {const m=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),
      key:i=>[...m.keys()][i]||null,get length(){return m.size}}})}''')
    page.set_content(HTML,wait_until='domcontentloaded')
    page.evaluate('''() => {
      window.__copies=[];window.__downloads=[];window.__opens=[];window.__alerts=[];
      window.__prompts=[];window.__confirm=true;
      copyText=async t=>{__copies.push(String(t));return true};
      download=(n,t,type='text/plain')=>__downloads.push({name:n,text:String(t),type});
      window.open=(url,target,features)=>{__opens.push({url,target,features});return null};
      alert=m=>__alerts.push(String(m));confirm=m=>{window.__lastConfirm=String(m);return window.__confirm};
      prompt=(m,d='')=>{window.__lastPrompt=String(m);const x=__prompts.find(p=>String(m).includes(p.part));return x?String(x.value):String(d??'')};
      window.__prompt=(part,value)=>__prompts.unshift({part,value});
    }''')
    return context,page,errors


def settle(page): page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')

def seed(page,text):
    page.evaluate('''text=>{state=createState();importBlocks(state,text);supplier='ESMO';filter='pending';purchaseView='pending';
      selectedDeliveryDest='SP';tab='inicio';toastMessage='';render()}''',text);settle(page)

def act(page,name,action,key='',target='',dest=''):
    page.evaluate('''async p=>{await handleAction(p.action,p.key,p.target,p.dest)}''',{'action':action,'key':key,'target':target,'dest':dest})
    settle(page); RESULT['actions'].append(name)
    assert not page.locator('main .notice.red').count(),(name,page.locator('main').inner_text()[-500:])

def shot(page,name):
    page.screenshot(path=str(OUT/name),full_page=True);RESULT['screens'].append(name)

def layout(page,label):
    info=page.evaluate('''() => {const v=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);
      const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(v);
      return {overflow:document.documentElement.scrollWidth-innerWidth,unnamed:controls.filter(e=>e.tagName==='BUTTON'&&!(e.textContent.trim()||e.getAttribute('aria-label')||e.title)).length,
      small:controls.filter(e=>{const r=e.getBoundingClientRect();return e.tagName==='BUTTON'&&(r.width<36||r.height<36)}).map(e=>(e.textContent||e.getAttribute('aria-label')).trim()).slice(0,20)}}''')
    assert info['overflow']<=1,(label,info);assert info['unnamed']==0,(label,info)
    if info['small']: RESULT['findings'].append({'severity':'medium','module':label,'finding':'Controles táctiles menores de 36 px','examples':info['small']})


def product_key(page,name):
    return page.evaluate('''name=>totals(state).find(x=>x.product===name)?.key||''',name)


with sync_playwright() as p:
    browser=browser_launch(p)

    # PROVEEDORES — todos los cambios usan claves producto/unidad y no datos reales.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n2 BANANA\n1 KIWI ZESPRI\n2 TOMATE RAMA\n1 BROCOLI\nPEDIDO SL\n1 BANANA')
    page.evaluate("tab='global';render()")
    act(page,'seleccionar proveedor','selprov','MONTENEGRO')
    banana=product_key(page,'BANANA');kiwi=product_key(page,'KIWI ZESPRI')
    act(page,'asignar BANANA','assign',banana)
    act(page,'quitar borrador BANANA','unassign',banana)
    act(page,'reasignar BANANA','assign',banana)
    act(page,'asignar KIWI','assign',kiwi)
    for name,action in [('copiar pendientes','copy'),('copiar todo','copyall'),('descargar pendientes','provdownload'),('descargar todo','provdownloadall'),('preparar WhatsApp','whatsapp')]:
        act(page,name,action,'MONTENEGRO')
    assert len(page.evaluate('__copies'))>=2 and len(page.evaluate('__downloads'))>=2 and len(page.evaluate('__opens'))==1
    assert page.evaluate("state.allocations.filter(x=>x.supplier==='MONTENEGRO').every(x=>x.status==='draft')")
    act(page,'marcar proveedor enviado','sent','MONTENEGRO')
    assert page.evaluate("state.allocations.filter(x=>x.supplier==='MONTENEGRO').every(x=>x.status==='sent')")
    act(page,'reabrir proveedor enviado','reopensent','MONTENEGRO')
    assert page.evaluate("state.allocations.some(x=>x.supplier==='MONTENEGRO'&&x.status==='draft')")
    act(page,'marcar enviado de nuevo','sent','MONTENEGRO')
    shot(page,'08_proveedores_audit_mobile.png');layout(page,'proveedores-mobile');assert not errors,errors;c.close()

    # PEDIDO TARDÍO y COMPRAS ADICIONALES — reserva exclusiva del restaurante.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n3 BANANA\nPEDIDO SL\n2 BANANA')
    banana=product_key(page,'BANANA')
    page.evaluate("assignSupplier(state,'BANANA|BULTO','ESMO',5);markSupplierSent(state,'ESMO');importBlocks(state,'PEDIDO BRASEROS CENTRO\\n2 BANANA');tab='compras';purchaseView='additional';render()")
    assert page.evaluate("state.orders.some(x=>x.dest==='BC'&&x.kind==='pedido-adicional')")
    row_id=banana+'@BC'
    act(page,'adicional menos','additional-step',row_id,'-1')
    act(page,'adicional más','additional-step',row_id,'1')
    act(page,'comprar adicional','additional-buy',row_id)
    assert page.evaluate("state.manual.some(x=>x.additionalDest==='BC'&&x.kind==='compra-adicional'&&x.q===2)")
    assert page.evaluate("deliveryPlan(state).eligible.find(x=>x.key==='BANANA|BULTO'&&x.dest==='BC')?.allowed")==2
    act(page,'deshacer adicional','additional-undo',row_id)
    assert page.evaluate("state.manual.some(x=>x.additionalDest==='BC'&&x.kind==='reversion-adicional')")
    shot(page,'09_pedidos_adicionales_mobile.png');layout(page,'pedidos-adicionales-mobile');assert not errors,errors;c.close()

    # COMPRAS NORMALES — parcial, edición, filtros, exportación, deshacer y destino.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n3 TOMATE RAMA\n2 KIWI ZESPRI\nPEDIDO SL\n1 TOMATE RAMA')
    page.evaluate("tab='compras';purchaseView='pending';render()")
    key=product_key(page,'TOMATE RAMA')
    # La cantidad por defecto es todo lo pendiente; comprobar +/− sin superar límites.
    act(page,'compra menos uno','purchase-step',key,'pending:-1')
    act(page,'compra más uno','purchase-step',key,'pending:1')
    act(page,'confirmar compra','purchase-confirm',key)
    assert page.evaluate("pendingPurchases(state).find(x=>x.key==='TOMATE RAMA|BULTO').manuallyBought")==4
    for name,view in [('pendientes','pending'),('adicionales','additional'),('comprados','manual'),('proveedores','supplier'),('todos','all')]:
        act(page,'filtro '+name,'purchasefilter',view);assert page.evaluate('purchaseView')==view
    page.evaluate("purchaseView='pending';render()")
    for name,action in [('copiar compras','manual-copy-pending'),('descargar compras','manual-download-pending'),('WhatsApp compras','manual-wa-pending')]: act(page,name,action)
    page.evaluate("purchaseView='manual';render()")
    act(page,'reducir compra manual','purchase-step',key,'manual:-1')
    act(page,'guardar compra editada','purchase-save',key)
    assert page.evaluate("pendingPurchases(state).find(x=>x.key==='TOMATE RAMA|BULTO').manuallyBought")==3
    act(page,'deshacer compra individual','purchase-undo',key)
    assert page.evaluate("pendingPurchases(state).find(x=>x.key==='TOMATE RAMA|BULTO').manuallyBought")==0
    old=page.evaluate("totals(state).find(x=>x.key==='TOMATE RAMA|BULTO').total")
    act(page,'subir demanda SP','destqty',key,'1','SP')
    assert page.evaluate("totals(state).find(x=>x.key==='TOMATE RAMA|BULTO').total")==old+1
    act(page,'bajar demanda SP','destqty',key,'-1','SP')
    assert page.evaluate("totals(state).find(x=>x.key==='TOMATE RAMA|BULTO').total")==old
    shot(page,'10_compras_audit_mobile.png');layout(page,'compras-mobile');assert not errors,errors;c.close()

    # CARGA y REPARTO — completo, unidad, parcial, deshacer, destino y repartidor.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n3 TOMATE RAMA\n2 BANANA\nPEDIDO SL\n1 TOMATE RAMA')
    page.evaluate("manualBuySafe(state,'TOMATE RAMA|BULTO',4);manualBuySafe(state,'BANANA|BULTO',2);tab='carga';render()")
    act(page,'marcar cargado','load','TOMATE RAMA|BULTO','','SP')
    assert page.evaluate("state.load['TOMATE RAMA|BULTO@SP']")==3
    page.evaluate("tab='reparto';selectedDeliveryDest='SP';render()")
    act(page,'seleccionar SL','delivery-select','SL')
    act(page,'seleccionar SP','delivery-select','SP')
    act(page,'bajar una unidad','deliver-step','TOMATE RAMA|BULTO','1','SP')
    assert page.evaluate("deliveredFor(state,'TOMATE RAMA|BULTO','SP')")==1
    act(page,'deshacer una unidad','deliver-step','TOMATE RAMA|BULTO','-1','SP')
    assert page.evaluate("deliveredFor(state,'TOMATE RAMA|BULTO','SP')")==0
    page.evaluate("window.__prompt('Cantidad parcial','1')")
    act(page,'bajada parcial','deliverpartial','TOMATE RAMA|BULTO','','SP')
    assert page.evaluate("deliveredFor(state,'TOMATE RAMA|BULTO','SP')")==1
    act(page,'bajar resto completo','deliver','TOMATE RAMA|BULTO','','SP')
    assert page.evaluate("deliveredFor(state,'TOMATE RAMA|BULTO','SP')")==3
    act(page,'deshacer bajada completa','undodelivery','TOMATE RAMA|BULTO','','SP')
    assert page.evaluate("deliveredFor(state,'TOMATE RAMA|BULTO','SP')")==0
    page.evaluate("window.__prompt('Repartidor','RIDER QA')")
    act(page,'asignar repartidor','rider','SP')
    assert page.evaluate("state.riderAssignments.SP")=='RIDER QA'
    shot(page,'11_reparto_audit_mobile.png');layout(page,'reparto-mobile');assert not errors,errors;c.close()

    # FALTANTES y SOBRANTES — no aplicar más de lo autorizado.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n3 TOMATE RAMA\nPEDIDO SL\n3 TOMATE RAMA')
    page.evaluate("manualBuySafe(state,'TOMATE RAMA|BULTO',4);tab='reparto';selectedDeliveryDest='SP';render();window.__prompt('SAN PABLO','3');window.__prompt('SAN LESMES','1')")
    act(page,'distribuir faltante','shortage','TOMATE RAMA|BULTO')
    assert page.evaluate("Object.values(state.shortageAllocation['TOMATE RAMA|BULTO']).reduce((a,b)=>a+b,0)")==4
    page.evaluate("state=createState();importBlocks(state,'PEDIDO SP\\n2 KIWI ZESPRI');manualBuySafe(state,'KIWI ZESPRI|BULTO',3,{allowExtra:true});tab='compras';purchaseView='all';render()")
    act(page,'ver propuesta de sobrante','extra','KIWI ZESPRI|BULTO')
    assert page.evaluate('__alerts.length')==1 and '60%' not in page.evaluate('__alerts[0]') # muestra cantidades calculadas, no escribe pedidos
    assert page.evaluate("totals(state).find(x=>x.key==='KIWI ZESPRI|BULTO').total")==2
    c.close()

    # CUENTA, AUDITORÍA y escritorio — solo estado simulado, nunca autenticación real.
    c,page,errors=setup(browser)
    seed(page,'PEDIDO SP\n1 BANANA')
    page.evaluate("cloudUser={id:'qa-user-123456789',email:'qa@example.com'};accessUnlocked=true;cloudStatus='sincronizado';cloudMessage='Sincronizado con la nube';cloudEngine={dirty:false,conflict:null,revision:1};tab='cuenta';render()")
    assert page.get_by_text('SESIÓN INICIADA',exact=True).count()==1 and page.get_by_text('SINCRONIZADO',exact=True).count()>=1
    shot(page,'12_cuenta_audit_mobile.png');layout(page,'cuenta-mobile')
    page.evaluate("tab='auditoria';render()")
    assert page.locator('main h1').inner_text()=='Auditoría';shot(page,'13_auditoria_mobile.png');layout(page,'auditoria-mobile');assert not errors,errors;c.close()

    c,page,errors=setup(browser,1440,900,False)
    seed(page,'PEDIDO SP\n3 TOMATE RAMA\n2 BANANA\nPEDIDO SL\n1 KIWI ZESPRI\nPEDIDO BRASEROS CENTRO\n1 BROCOLI')
    for target,title in [('inicio','Mi jornada'),('pedidos','Pedidos'),('global','Proveedores'),('compras','Compras manuales'),('carga','Carga'),('reparto','Reparto'),('auditoria','Auditoría')]:
        page.evaluate('(x)=>{tab=x;render()}',target);settle(page);assert page.locator('main h1').inner_text()==title;layout(page,'desktop-'+target)
    page.evaluate("tab='global';supplier='MONTENEGRO';filter='pending';render();document.querySelector('.assign-items').scrollTop=500")
    before=page.evaluate("document.querySelector('.assign-items').scrollTop")
    act(page,'asignación escritorio mantiene posición','assign','BANANA|BULTO')
    after=page.evaluate("document.querySelector('.assign-items').scrollTop")
    assert abs(after-min(before,page.evaluate("document.querySelector('.assign-items').scrollHeight-document.querySelector('.assign-items').clientHeight")))<=2
    shot(page,'14_proveedores_audit_desktop.png');assert not errors,errors;c.close();browser.close()

assert RESULT['network_requests']==0,RESULT['network_requests']
RESULT['status']='PASS';RESULT['action_count']=len(RESULT['actions']);RESULT['screen_count']=len(RESULT['screens'])
(OUT/'audit_modules.json').write_text(json.dumps(RESULT,ensure_ascii=False,indent=2),encoding='utf8')
print(f"AUDITORÍA MODULAR: {len(RESULT['actions'])} operaciones dinámicas, {len(RESULT['screens'])} capturas, 0 red y 0 datos reales")
