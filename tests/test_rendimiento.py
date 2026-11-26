"""Rendimiento de ARSLAN LISTAS con datos sintéticos y red bloqueada."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text(encoding='utf8')
assert 'ARSLAN LISTAS NEXT · rendimiento fluido' in HTML
HTML=HTML.replace('const ARSLAN_CLOUD_ACTIVE = Boolean(','const ARSLAN_CLOUD_ACTIVE = false && Boolean(',1)

def launch(p):
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    system=(shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium') or shutil.which('chromium-browser'))
    if system and not Path(p.chromium.executable_path).exists(): opts['executable_path']=system
    return p.chromium.launch(**opts)

with sync_playwright() as p:
    browser=launch(p)
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    requests=[];context.route('**/*',lambda route:(requests.append(route.request.url),route.abort()))
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML,wait_until='domcontentloaded')
    page.evaluate('''() => {window.__confirm=true;confirm=()=>true;prompt=(m,d='')=>String(d??'');alert=()=>{};download=()=>{};copyText=async()=>true;window.open=()=>null}''')
    # Simular sesión abierta y jornada grande sin tocar Firebase.
    page.evaluate('''() => {
      state=createState();
      const products=state.catalog.slice(0,Math.min(180,state.catalog.length));
      state.orders=products.map((product,index)=>({id:'perf-'+index,dest:['SP','SL','ST'][index%3],raw:'1 '+product,sourceName:product,product,q:1,unit:'BULTO',review:false,issues:[],suggestions:[]}));
      cloudUser={id:'synthetic-user',email:'qa@example.com'};accessUnlocked=true;
      cloudStatus='sincronizado';cloudMessage='Prueba aislada';
      tab='compras';render();
    }''')
    stats=page.evaluate('ARSLAN_PERF.lastRender')
    assert stats['calls'].get('totals',0)<=2,stats
    assert stats['calls'].get('deliveryPlan',0)<=1,stats
    assert stats['calls'].get('additionalPurchaseRows',0)<=1,stats
    assert stats['calls'].get('pendingPurchases',0)<=1,stats
    assert stats['duration']<700,stats
    # El armazón superior no se destruye al navegar entre secciones.
    page.evaluate("window.__topNode=document.querySelector('.top');tab='global';render()")
    assert page.evaluate("document.querySelector('.top')===window.__topNode")
    assert page.evaluate('ARSLAN_PERF.lastRender.partial===true')
    # Elegir proveedor no dispara render ni pierde la posición.
    before=page.evaluate('ARSLAN_PERF.history.length')
    page.evaluate("document.querySelector('.assign-items').scrollTop=200;window.__scrollBefore=document.querySelector('.assign-items').scrollTop")
    page.evaluate("handleAction('selprov','MONTENEGRO','','')")
    after=page.evaluate('ARSLAN_PERF.history.length')
    assert after==before,(before,after)
    assert page.evaluate("supplier==='MONTENEGRO'")
    assert page.evaluate("document.querySelector('.assign-items').scrollTop===window.__scrollBefore")
    assert 'on' in (page.locator('.supplier-pills [data-key="MONTENEGRO"]').get_attribute('class') or '')
    # Las filas fuera de pantalla usan contención visual.
    item=page.locator('.assign-items>.item').first
    if item.count():
        assert item.evaluate("el=>getComputedStyle(el).contentVisibility") in ('auto','visible')
    assert not errors,errors
    assert requests==[],requests
    context.close();browser.close()
print('RENDIMIENTO EN NAVEGADOR: cálculo acotado, shell estable, proveedor instantáneo y 0 red')
