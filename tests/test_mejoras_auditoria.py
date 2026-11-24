"""Pruebas de navegador de las mejoras seguras de la auditoría.

Red bloqueada, localStorage en memoria y datos sintéticos. No usa Firebase real.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text(encoding='utf8')
assert 'AUDIT_SAFE_CATALOG_ADDITIONS' in HTML
HTML=HTML.replace('const ARSLAN_CLOUD_ACTIVE = Boolean(','const ARSLAN_CLOUD_ACTIVE = false && Boolean(',1)


def launch_browser(p):
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    system=(shutil.which('google-chrome') or shutil.which('google-chrome-stable')
            or shutil.which('chromium') or shutil.which('chromium-browser'))
    if system and not Path(p.chromium.executable_path).exists(): opts['executable_path']=system
    return p.chromium.launch(**opts)


def settle(page):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def setup(browser,width,height,mobile):
    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
    requests=[]
    context.route('**/*',lambda route:(requests.append(route.request.url),route.abort()))
    page=context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''() => {const box=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>box.get(k)||null,setItem:(k,v)=>box.set(k,String(v)),removeItem:k=>box.delete(k),clear:()=>box.clear(),
      key:i=>[...box.keys()][i]||null,get length(){return box.size}}})}''')
    page.set_content(HTML,wait_until='domcontentloaded')
    page.evaluate('''() => {window.__confirm=true;confirm=()=>window.__confirm;prompt=(m,d='')=>String(d??'');alert=()=>{};
      download=()=>{};copyText=async()=>true;window.open=()=>null}''')
    return context,page,errors,requests


with sync_playwright() as p:
    browser=launch_browser(p)
    for width,height,mobile in [(390,844,True),(1440,900,False)]:
        context,page,errors,requests=setup(browser,width,height,mobile)
        additions=page.evaluate("AUDIT_SAFE_CATALOG_ADDITIONS.every(x=>state.catalog.includes(x))")
        assert additions,(width,'faltan productos del catálogo')
        assert page.evaluate("new Set(state.catalog.map(canonical)).size===state.catalog.length"),(width,'catálogo duplicado')
        assert page.evaluate("AUDIT_SAFE_CATALOG_ADDITIONS.every(x=>createState().catalog.includes(x))")

        # Encabezado y controles seguros.
        assert page.locator('.brand strong').inner_text()==('ARSLAN NEXT' if mobile else 'ARSLAN LISTAS NEXT')
        sync=page.locator('.sync-pill').first
        assert sync.evaluate('(el)=>el.getBoundingClientRect().height')>=40
        assert page.locator('button:not([type])').count()==0

        # Otros destinos se agrupa; cerrado en móvil y abierto en escritorio.
        page.evaluate("state=createState();importBlocks(state,'PEDIDO SP\\n1 BANANA');tab='pedidos';orderView='all';render()")
        settle(page)
        details=page.locator('details.other-destinations')
        assert details.count()==1
        assert details.get_attribute('open') == (None if mobile else '')
        if mobile:
            details.locator('summary').click();settle(page);assert details.get_attribute('open')==''
            page.evaluate("render()")
            assert page.locator('details.other-destinations').get_attribute('open')==''

        # Carga reversible: un toque marca y otro desmarca sin alterar compra/reparto.
        page.evaluate('''() => {state=createState();importBlocks(state,'PEDIDO SP\\n2 BANANA');manualBuySafe(state,'BANANA|BULTO',2);
          tab='carga';render();window.__beforeOrders=JSON.stringify(state.orders);window.__beforeManual=JSON.stringify(state.manual)}''')
        button=page.locator('[data-action="load-toggle"]').first
        assert button.count()==1 and button.get_attribute('aria-pressed')=='false'
        button.click();settle(page)
        assert page.evaluate("state.load['BANANA|BULTO@SP']")==2
        assert page.locator('[data-action="load-toggle"]').first.get_attribute('aria-pressed')=='true'
        page.locator('[data-action="load-toggle"]').first.click();settle(page)
        assert page.evaluate("state.load['BANANA|BULTO@SP']===undefined")
        assert page.evaluate("JSON.stringify(state.orders)===window.__beforeOrders && JSON.stringify(state.manual)===window.__beforeManual")

        # Quitar repartidor conserva cantidades, compras y bajadas.
        page.evaluate('''() => {assignRider(state,'SP','RIDER QA');tab='reparto';selectedDeliveryDest='SP';
          window.__beforeRiderOrders=JSON.stringify(state.orders);window.__beforeRiderManual=JSON.stringify(state.manual);
          window.__beforeDelivery=JSON.stringify(state.delivery);render()}''')
        clear=page.locator('[data-action="clear-rider"]')
        assert clear.count()==1
        clear.click();settle(page)
        assert page.evaluate("state.riderAssignments.SP===undefined")
        assert page.evaluate("JSON.stringify(state.orders)===window.__beforeRiderOrders && JSON.stringify(state.manual)===window.__beforeRiderManual && JSON.stringify(state.delivery)===window.__beforeDelivery")

        # Los avisos operativos se anuncian a lectores de pantalla.
        page.evaluate("toastMessage='Cambio comprobado';render()")
        notice=page.locator('main > .notice').first
        assert notice.get_attribute('role')=='status'
        assert notice.get_attribute('aria-live')=='polite'

        assert not errors,(width,errors)
        assert requests==[],(width,requests)
        context.close()
    browser.close()

print('MEJORAS DE AUDITORÍA EN NAVEGADOR: móvil y escritorio correctos, 0 red y 0 datos reales')
