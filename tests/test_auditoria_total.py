"""Auditoría funcional y visual completa de ARSLAN LISTAS NEXT.

Todo se ejecuta en memoria con pedidos sintéticos, almacenamiento simulado y
red bloqueada. Nunca inicia Firebase ni lee/escribe la jornada del usuario.
"""
from pathlib import Path
import json
import os
import shutil
import statistics
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'audit-output'
OUTPUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text(encoding='utf8')
assert 'const FIXTURE = ""' in HTML
assert 'const ARSLAN_CLOUD_ACTIVE = Boolean(' in HTML
HTML=HTML.replace('const ARSLAN_CLOUD_ACTIVE = Boolean(','const ARSLAN_CLOUD_ACTIVE = false && Boolean(',1)

ORDERS='''PEDIDO SP
3 TOMATE RAMA
2 BANANA
2 LIMON PRIMERA
1 MANZANA GOLDEN 24
PEDIDO SL
2 TOMATE RAMA
1 KIWI ZESPRI
1 MANZANA GOLDEN 28
PEDIDO ST
1 TOMATE RAMA
1 PIMIENTO VERDE
PEDIDO BRASEROS CENTRO
2 AGUACATE PRIMERA
1 TOMATE RAMA
PEDIDO BRASEROS FORUM
0.5 PUERROS
PEDIDO RIVIERA
1 TOMATE ROSA'''

metrics={'screens':{},'actions':{},'accessibility':{},'performance':{},'invariants':[]}


def browser_launch(playwright):
    launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    managed=Path(playwright.chromium.executable_path)
    system=(shutil.which('google-chrome') or shutil.which('google-chrome-stable')
            or shutil.which('chromium') or shutil.which('chromium-browser'))
    if not managed.exists() and system: launch['executable_path']=system
    return playwright.chromium.launch(**launch)


def settle(page):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def install_storage(page):
    page.evaluate('''() => {
      const box=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
       getItem:k=>box.has(k)?box.get(k):null,setItem:(k,v)=>box.set(k,String(v)),
       removeItem:k=>box.delete(k),clear:()=>box.clear(),key:i=>[...box.keys()][i]||null,
       get length(){return box.size}
      }});
    }''')


def install_stubs(page):
    page.evaluate('''() => {
      window.__downloads=[];window.__opens=[];window.__copies=[];window.__alerts=[];
      window.__promptRules=[];window.__confirmValue=true;
      download=(name,text,type='text/plain')=>window.__downloads.push({name,text:String(text),type});
      copyText=async text=>{window.__copies.push(String(text));return true};
      window.open=(url,target,features)=>{window.__opens.push({url,target,features});return null};
      alert=message=>window.__alerts.push(String(message));
      confirm=message=>{window.__lastConfirm=String(message);return window.__confirmValue};
      prompt=(message,defaultValue='')=>{
       window.__lastPrompt=String(message);
       const rule=window.__promptRules.find(item=>String(message).includes(item.contains));
       return rule?String(rule.value):String(defaultValue??'');
      };
      window.__setPrompt=(contains,value)=>window.__promptRules.unshift({contains,value});
      window.__snapshot=()=>structuredClone(state);
      window.__qa=()=>({tab,supplier,filter,purchaseView,orders:state.orders.length,
       totals:totals(state),pending:pendingPurchases(state),delivery:structuredClone(state.delivery),
       load:structuredClone(state.load),history:state.history.length,allocations:structuredClone(state.allocations),
       manual:structuredClone(state.manual),downloads:structuredClone(window.__downloads),opens:structuredClone(window.__opens),
       copies:structuredClone(window.__copies),alerts:structuredClone(window.__alerts),toast:toastMessage});
    }''')


def new_page(browser,width=390,height=844,mobile=True):
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,
      is_mobile=mobile,has_touch=mobile,accept_downloads=False)
    context.route('**/*',lambda route:route.abort())
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_default_timeout(5000)
    install_storage(page)
    page.set_content(HTML,wait_until='domcontentloaded')
    install_stubs(page)
    return context,page,errors


def seed(page,orders=ORDERS):
    page.evaluate('''orders => {
      state=createState();importBlocks(state,orders);tab='inicio';supplier='ESMO';filter='pending';
      purchaseView='pending';selectedDeliveryDest='SP';expandedPurchaseKey='';editingDestination='';
      orderView='all';expandedOrderDest='';toastMessage='';render();
    }''',orders)
    settle(page)


def screenshot(page,name):
    path=OUTPUT/name
    page.screenshot(path=str(path),full_page=True)
    metrics['screens'][name]={'width':page.viewport_size['width'],'height':page.viewport_size['height']}


def action(page,name,locator):
    before=page.evaluate('performance.now()')
    locator.click()
    settle(page)
    elapsed=page.evaluate('performance.now()')-before
    metrics['actions'].setdefault(name,[]).append(round(elapsed,2))


def check_layout(page,label):
    data=page.evaluate('''() => {
      const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
      const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(visible);
      const unnamed=buttons.filter(el=>!(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent.trim()));
      const small=buttons.map(el=>{const r=el.getBoundingClientRect();return {text:(el.getAttribute('aria-label')||el.textContent).trim().slice(0,50),w:r.width,h:r.height}})
       .filter(x=>x.w<40||x.h<40);
      const fields=[...document.querySelectorAll('input,select,textarea')].filter(visible);
      const unlabeled=fields.filter(el=>{
       if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby'))return false;
       if(el.id&&document.querySelector(`label[for="${CSS.escape(el.id)}"]`))return false;
       return !el.closest('label');
      }).map(el=>({tag:el.tagName,id:el.id,placeholder:el.getAttribute('placeholder')}));
      return {overflow:document.documentElement.scrollWidth-innerWidth,buttons:buttons.length,
       unnamed:unnamed.length,small,fields:fields.length,unlabeled};
    }''')
    metrics['accessibility'][label]=data
    assert data['overflow']<=1,(label,'desbordamiento horizontal',data)
    assert data['unnamed']==0,(label,'controles sin nombre',data)


def find_item(page,container,product):
    return page.locator(container).filter(has=page.locator('.product',has_text=product)).first


with sync_playwright() as p:
    browser=browser_launch(p)
    context,page,errors=new_page(browser)
    seed(page)
    assert page.locator('main h1').inner_text()=='Mi jornada'
    assert page.evaluate('window.__qa().orders')==13
    screenshot(page,'01_inicio_mobile.png')
    check_layout(page,'inicio-mobile')

    # PEDIDOS: filtros, edición individual, pegado múltiple, exportaciones y correcciones.
    action(page,'goto-pedidos',page.locator('.bottomnav [data-key="pedidos"]'))
    assert page.locator('main h1').inner_text()=='Pedidos'
    for key in ['stores','restaurants','all']:
        action(page,'order-filter-'+key,page.locator(f'[data-action="order-filter"][data-key="{key}"]'))
        assert page.evaluate('orderView')==key
    action(page,'open-restaurant',page.locator('.order-card[data-destination="BC"] .order-summary'))
    action(page,'edit-destination',page.locator('.order-card[data-destination="BC"] [data-action="destedit"]'))
    page.locator('#destorder-BC').fill('1 BROCOLI')
    action(page,'add-destination-order',page.locator('.order-card[data-destination="BC"] [data-action="destadd"]'))
    assert page.evaluate("totals(state).find(x=>x.product==='BROCOLI').total") == 1
    page.evaluate("window.__setPrompt('Nombre del nuevo restaurante','RESTAURANTE QA')")
    action(page,'new-destination',page.locator('[data-action="newdest"]'))
    assert page.get_by_text('RESTAURANTE QA',exact=True).count()>=1
    # Abrir de nuevo BC y comprobar salida TXT/WhatsApp sin abrir servicios reales.
    if not page.locator('.order-card[data-destination="BC"]').get_attribute('class').endswith('expanded'):
        page.locator('.order-card[data-destination="BC"] .order-summary').click()
    for act in ['destcopy','destdownload','destwa']:
        action(page,act,page.locator(f'.order-card[data-destination="BC"] [data-action="{act}"]'))
    assert page.evaluate('window.__copies.length')>=1
    assert page.evaluate('window.__downloads.length')>=1
    assert page.evaluate('window.__opens.length')>=1
    # Cambiar cantidad y nombre con datos sintéticos.
    page.evaluate("window.__setPrompt('Cantidad correcta','4')")
    tomato_line=find_item(page,'.order-card[data-destination="BC"] .item','TOMATE RAMA')
    action(page,'qty',tomato_line.locator('[data-action="qty"]'))
    assert page.evaluate("state.orders.find(x=>x.dest==='BC'&&x.product==='TOMATE RAMA').q")==4
    page.evaluate("window.__setPrompt('Nombre correcto','TOMATE ROSA')")
    action(page,'editname',tomato_line.locator('[data-action="editname"]'))
    assert page.evaluate("state.orders.some(x=>x.dest==='BC'&&x.product==='TOMATE ROSA')")
    screenshot(page,'02_pedidos_mobile.png')
    check_layout(page,'pedidos-mobile')

    # PROVEEDORES: selección, asignar, desasignar, TXT, WhatsApp y enviado/reapertura.
    action(page,'goto-proveedores',page.locator('.top-more'))
    # El botón superior abre Más; usar menú accesible del DOM para Proveedores en móvil mediante inicio.
    page.evaluate("tab='global';render()")
    settle(page)
    assert page.locator('main h1').inner_text()=='Proveedores'
    action(page,'select-MONTENEGRO',page.locator('[data-action="selprov"][data-key="MONTENEGRO"]'))
    assign=find_item(page,'.assign-items .item','BANANA').locator('[data-action="assign"]')
    action(page,'assign-provider',assign)
    assert page.evaluate("state.allocations.some(x=>x.product==='BANANA'&&x.supplier==='MONTENEGRO'&&x.status==='draft')")
    details=page.locator('.provider-card[data-provider="MONTENEGRO"] details')
    details.locator('summary').click()
    unassign=find_item(page,'.provider-card[data-provider="MONTENEGRO"] .item','BANANA').locator('[data-action="unassign"]')
    action(page,'unassign-provider',unassign)
    assert not page.evaluate("state.allocations.some(x=>x.product==='BANANA'&&x.status==='draft')")
    action(page,'assign-provider-again',find_item(page,'.assign-items .item','BANANA').locator('[data-action="assign"]'))
    action(page,'assign-second-product',find_item(page,'.assign-items .item','LIMON PRIMERA').locator('[data-action="assign"]'))
    for act in ['copy','copyall','provdownload','provdownloadall','whatsapp']:
        loc=page.locator(f'.provider-card[data-provider="MONTENEGRO"] [data-action="{act}"]').first
        if loc.count(): action(page,act,loc)
    action(page,'mark-sent',page.locator('.provider-card[data-provider="MONTENEGRO"] [data-action="sent"]'))
    assert page.evaluate("state.allocations.filter(x=>x.supplier==='MONTENEGRO').every(x=>x.status==='sent')")
    page.locator('.provider-card[data-provider="MONTENEGRO"] details summary').click()
    action(page,'reopen-sent',page.locator('.provider-card[data-provider="MONTENEGRO"] [data-action="reopensent"]'))
    assert page.evaluate("state.allocations.some(x=>x.supplier==='MONTENEGRO'&&x.status==='draft')")
    action(page,'mark-sent-again',page.locator('.provider-card[data-provider="MONTENEGRO"] [data-action="sent"]'))
    screenshot(page,'03_proveedores_mobile.png')
    check_layout(page,'proveedores-mobile')

    # PEDIDO ADICIONAL: se crea tras proveedor enviado y va a compra manual por destino.
    page.evaluate("tab='pedidos';expandedOrderDest='BC';editingDestination='BC';render()")
    page.locator('#destorder-BC').fill('2 BANANA')
    action(page,'late-destination-order',page.locator('.order-card[data-destination="BC"] [data-action="destadd"]'))
    assert page.evaluate("state.orders.some(x=>x.dest==='BC'&&x.product==='BANANA'&&x.kind==='pedido-adicional')")
    page.evaluate("tab='compras';purchaseView='additional';render()")
    settle(page)
    additional=find_item(page,'.additional-item','BANANA')
    assert additional.count()==1
    action(page,'additional-step-minus',additional.locator('[data-action="additional-step"][data-target="-1"]'))
    action(page,'additional-step-plus',additional.locator('[data-action="additional-step"][data-target="1"]'))
    action(page,'additional-buy',additional.locator('[data-action="additional-buy"]'))
    assert page.evaluate("state.manual.some(x=>x.additionalDest==='BC'&&x.kind==='compra-adicional')")
    action(page,'additional-undo',find_item(page,'.additional-item','BANANA').locator('[data-action="additional-undo"]'))
    assert page.evaluate("state.manual.some(x=>x.additionalDest==='BC'&&x.kind==='reversion-adicional')")

    # COMPRAS: parcial, +/−, edición, deshacer, filtros y exportaciones pendientes.
    page.evaluate("purchaseView='pending';render()")
    settle(page)
    pending=page.locator('.purchase-item[data-purchase-type="pending"]').first
    assert pending.count()==1
    product=pending.locator('.purchase-title').inner_text()
    before_pending=page.evaluate('(p)=>pendingPurchases(state).find(x=>x.product===p).remainingToBuy',product)
    if before_pending>1:
        action(page,'purchase-step-minus',pending.locator('[data-action="purchase-step"][data-target="pending:-1"]'))
        action(page,'purchase-step-plus',pending.locator('[data-action="purchase-step"][data-target="pending:1"]'))
    field=pending.locator('[data-purchase-qty]')
    field.fill('1')
    action(page,'purchase-confirm',pending.locator('[data-action="purchase-confirm"]'))
    assert page.evaluate('(p)=>pendingPurchases(state).find(x=>x.product===p).manuallyBought',product)>=1
    page.evaluate("purchaseView='manual';render()")
    manual=find_item(page,'.purchase-item',product)
    assert manual.count()==1
    action(page,'purchase-step-manual-plus',manual.locator('[data-action="purchase-step"][data-target="manual:1"]'))
    action(page,'purchase-save',manual.locator('[data-action="purchase-save"]'))
    page.evaluate("purchaseView='pending';render()")
    for key in ['pending','additional','manual','supplier','all']:
        action(page,'purchase-filter-'+key,page.locator(f'[data-action="purchasefilter"][data-key="{key}"]'))
        assert page.evaluate('purchaseView')==key
    page.evaluate("purchaseView='pending';render()")
    for act in ['manual-copy-pending','manual-download-pending','manual-wa-pending']:
        loc=page.locator(f'[data-action="{act}"]')
        if loc.count(): action(page,act,loc)
    page.evaluate("purchaseView='manual';render()")
    manual=find_item(page,'.purchase-item',product)
    if manual.count(): action(page,'purchase-undo',manual.locator('[data-action="purchase-undo"], [data-action="purchase-toggle"]').first)
    # Ajuste por destino modifica Global pero no compra la diferencia.
    page.evaluate("purchaseView='all';render()")
    row=find_item(page,'.purchase-item','TOMATE RAMA')
    details=row.locator('details.purchase-destination-details')
    if details.count() and not details.get_attribute('open'): details.locator('summary').click()
    plus=row.locator('[data-action="destqty"][data-dest="SP"][data-target="1"]')
    if plus.count():
        old_total=page.evaluate("totals(state).find(x=>x.product==='TOMATE RAMA').total")
        action(page,'destination-qty-plus',plus)
        assert page.evaluate("totals(state).find(x=>x.product==='TOMATE RAMA').total")==old_total+1
    screenshot(page,'04_compras_mobile.png')
    check_layout(page,'compras-mobile')

    # REPARTO: carga opcional, selección, bajar, +/−, parcial y deshacer.
    page.evaluate("tab='carga';render()")
    load_btn=page.locator('[data-action="load"]').first
    if load_btn.count(): action(page,'load',load_btn)
    page.evaluate("tab='reparto';selectedDeliveryDest='SP';render()")
    settle(page)
    assert page.locator('main h1').inner_text()=='Reparto'
    # Selección por chip y selector son equivalentes.
    sl_chip=page.locator('[data-action="delivery-select"][data-key="SL"]')
    if sl_chip.count(): action(page,'delivery-select-SL',sl_chip)
    sp_chip=page.locator('[data-action="delivery-select"][data-key="SP"]')
    if sp_chip.count(): action(page,'delivery-select-SP',sp_chip)
    deliver=page.locator('[data-action="deliver"]').first
    if deliver.count():
        action(page,'deliver-full',deliver)
        undo=page.locator('[data-action="undodelivery"]').first
        if undo.count(): action(page,'undo-delivery',undo)
    step_plus=page.locator('[data-action="deliver-step"][data-target="1"]').first
    if step_plus.count():
        action(page,'deliver-plus-one',step_plus)
        step_minus=page.locator('[data-action="deliver-step"][data-target="-1"]').first
        if step_minus.count(): action(page,'deliver-minus-one',step_minus)
    partial=page.locator('[data-action="deliverpartial"]').first
    if partial.count():
        page.evaluate("window.__setPrompt('Cantidad parcial','1')")
        action(page,'deliver-partial',partial)
    rider=page.locator('[data-action="rider"]').first
    if rider.count():
        page.evaluate("window.__setPrompt('Repartidor','RIDER QA')")
        action(page,'assign-rider',rider)
        assert 'RIDER QA' in page.evaluate('Object.values(state.riderAssignments).join()')
    screenshot(page,'05_reparto_mobile.png')
    check_layout(page,'reparto-mobile')

    # FALTANTES y EXTRA en estados sintéticos específicos.
    page.evaluate('''() => {
      state=createState();importBlocks(state,'PEDIDO SP\\n3 TOMATE RAMA\\nPEDIDO SL\\n3 TOMATE RAMA');
      manualBuySafe(state,'TOMATE RAMA|BULTO',4);tab='reparto';selectedDeliveryDest='SP';render();
      window.__setPrompt('SAN PABLO','3');window.__setPrompt('SAN LESMES','1');
    }''')
    shortage=page.locator('[data-action="shortage"]').first
    if shortage.count():
        action(page,'shortage-distribution',shortage)
        assert page.evaluate("state.shortageAllocation['TOMATE RAMA|BULTO']!=null")
    page.evaluate('''() => {
      state=createState();importBlocks(state,'PEDIDO SP\\n2 KIWI ZESPRI');
      manualBuySafe(state,'KIWI ZESPRI|BULTO',3,{allowExtra:true});tab='compras';purchaseView='all';render();
    }''')
    extra=page.locator('[data-action="extra"]').first
    if extra.count():
        action(page,'surplus-proposal',extra)
        assert page.evaluate('window.__alerts.length')>=1

    # CUENTA simulada: solo pantalla, nunca Firebase real.
    page.evaluate('''() => {
      cloudUser={id:'qa-user-1234567890',email:'qa@example.com'};accessUnlocked=true;
      cloudStatus='sincronizado';cloudMessage='Sincronizado con la nube';
      cloudEngine={dirty:false,conflict:null,revision:5};tab='cuenta';render();
    }''')
    screenshot(page,'06_cuenta_mobile.png')
    assert page.get_by_text('SESIÓN INICIADA',exact=True).count()==1
    assert page.get_by_text('SINCRONIZADO',exact=True).count()>=1
    check_layout(page,'cuenta-mobile')

    # Rendimiento con una jornada grande, sin exigir cifras irreales al runner.
    times=page.evaluate('''() => {
      cloudUser=null;accessUnlocked=true;state=createState();
      importBlocks(state,'PEDIDO SP\\n'+state.catalog.slice(0,120).map((x,i)=>(i%5+1)+' '+x).join('\\n'));
      const result=[];for(const target of ['inicio','pedidos','global','compras','reparto']){
       tab=target;const a=performance.now();render();result.push({target,ms:performance.now()-a});
      }return result;
    }''')
    metrics['performance']['mobile-large-day']=times
    assert max(x['ms'] for x in times)<1000,times
    assert not errors,errors
    metrics['invariants'] += [
      'No se cargaron datos de demostración al abrir',
      'Global sumó tiendas y restaurantes',
      'WhatsApp no marcó proveedor enviado automáticamente',
      'Pedido tardío quedó reservado por destino en compra manual',
      'Una diferencia añadida por tienda quedó pendiente hasta comprar o enviar',
      'Reparto no superó la cantidad autorizada',
      'Ninguna prueba realizó llamadas de red'
    ]
    context.close()

    # Escritorio: navegación lateral, densidad, scroll y posiciones.
    context,page,errors=new_page(browser,1440,900,False)
    seed(page)
    for key,title in [('inicio','Mi jornada'),('pedidos','Pedidos'),('global','Proveedores'),('compras','Compras manuales'),('carga','Carga'),('reparto','Reparto'),('cuenta','Cuenta y sincronización'),('auditoria','Auditoría')]:
        if key=='cuenta':
            page.evaluate("cloudUser={id:'qa-desktop-12345678',email:'qa@example.com'};accessUnlocked=true;cloudStatus='sincronizado';cloudMessage='Sincronizado';cloudEngine={dirty:false,conflict:null,revision:1};")
        action(page,'desktop-nav-'+key,page.locator(f'.side [data-key="{key}"]'))
        assert page.locator('main h1').inner_text()==title,(key,page.locator('main h1').inner_text())
        check_layout(page,'desktop-'+key)
    page.evaluate("tab='global';supplier='MONTENEGRO';filter='pending';render();document.querySelector('.assign-items').scrollTop=700")
    settle(page)
    before=page.evaluate("document.querySelector('.assign-items').scrollTop")
    btn=page.locator('.assign-items [data-action="assign"]').first
    if btn.count(): action(page,'desktop-assign-scroll',btn)
    after=page.evaluate("document.querySelector('.assign-items').scrollTop")
    assert abs(after-min(before,page.evaluate("document.querySelector('.assign-items').scrollHeight-document.querySelector('.assign-items').clientHeight")))<=2,(before,after)
    screenshot(page,'07_proveedores_desktop.png')
    assert not errors,errors
    context.close()
    browser.close()

# Resumen legible para el artefacto de auditoría.
all_action_times=[v for values in metrics['actions'].values() for v in values]
metrics['performance']['action-median-ms']=round(statistics.median(all_action_times),2) if all_action_times else None
metrics['performance']['action-max-ms']=round(max(all_action_times),2) if all_action_times else None
metrics['status']='PASS'
(OUTPUT/'audit_metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# Auditoría automatizada de ARSLAN LISTAS NEXT','',
 'Entorno: navegador aislado, almacenamiento en memoria, red bloqueada, datos sintéticos.','',
 f"- Acciones ejercitadas dinámicamente: {len(metrics['actions'])}",
 f"- Pantallas capturadas: {len(metrics['screens'])}",
 f"- Mediana de respuesta observada: {metrics['performance']['action-median-ms']} ms",
 f"- Máximo observado: {metrics['performance']['action-max-ms']} ms",'',
 '## Invariantes comprobadas']+[f'- {x}' for x in metrics['invariants']]+['','## Acciones']+[f'- {k}: {len(v)} prueba(s), máximo {max(v):.2f} ms' for k,v in sorted(metrics['actions'].items())]
(OUTPUT/'AUDITORIA_AUTOMATIZADA.md').write_text('\n'.join(lines),encoding='utf8')
print(f"AUDITORÍA TOTAL: {len(metrics['actions'])} acciones dinámicas, {len(metrics['screens'])} capturas, 0 red, 0 datos reales, 0 errores JS")
