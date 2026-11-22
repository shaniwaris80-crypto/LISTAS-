"""E2E de navegador real aislado de Firebase y de los datos de usuarios."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
document = (ROOT / 'index.html').read_text(encoding='utf8')
css = document.split('<style>',1)[1].split('</style>',1)[0]
script = document.split('<script>',1)[1].rsplit('</script>',1)[0]
assert 'const FIXTURE = ""' in script
assert "case 'resetdemo'" not in script
assert 'importBlocks(state,FIXTURE)' not in script
script = script.replace('const ARSLAN_CLOUD_ACTIVE = Boolean(', 'const ARSLAN_CLOUD_ACTIVE = false && Boolean(')
script += """
window.__qa = () => ({orders:state.orders.length,summary:summary(state),
  totals:totals(state),delivery:structuredClone(state.delivery),history:state.history.length,
  pending:pendingPurchases(state),progress:deliveryProgress(state,'SP')});
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width':390,'height':844},device_scale_factor=1,
        is_mobile=True,has_touch=True,accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    def handle_dialog(d):
        if d.type == 'prompt' and 'restaurante' in d.message.lower():
            d.accept('CAFETERIA QA')
        elif d.type == 'prompt' and 'LIMPIAR' in d.message:
            d.accept('LIMPIAR')
        else:
            d.accept()
    page.on('dialog', handle_dialog)
    page.set_content('<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+css+'</style></head><body><div id="app"></div></body></html>')
    page.evaluate("""() => {
      const m = new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
       getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),
       removeItem:k=>m.delete(k),clear:()=>m.clear()
      }});
    }""")
    page.evaluate('(js) => (0,eval)(js)', script)
    assert page.locator('main h1').inner_text() == 'Control de jornada'
    assert page.evaluate('window.__qa().orders') == 0, 'un navegador nuevo no debe tener pedidos ficticios'

    page.locator('.bottomnav button[data-key="pedidos"]').click()
    assert page.locator('main h1').inner_text() == 'Pedidos'
    page.locator('#paste').fill(
       'PEDIDO SP\n3 TOMATE RAMA\n1 BANANA\n'
       'PEDIDO SL\n2 TOMATE RAMA\n'
       'PEDIDO ST\n1 TOMATE RAMA\n'
       'PEDIDO BRASEROS CENTRO\n2 TOMATE RAMA')
    page.locator('button[data-action="import"]').click()
    assert page.evaluate('window.__qa().orders') == 5
    assert page.evaluate("""window.__qa().totals.find(x=>x.product==='TOMATE RAMA').total""") == 8
    assert page.locator('.order-card[data-destination="BC"] button[data-action="destdownload"]').count() == 1
    assert page.locator('.order-card[data-destination="BC"] button[data-action="destwa"]').count() == 1
    print('E2E 1: Pedidos de SP, SL, ST y Braseros suman el Global; restaurante tiene TXT/WhatsApp')

    page.locator('.bottomnav button[data-key="global"]').click()
    assert page.locator('main h1').inner_text() == 'Asignación a proveedores'
    assignable = page.locator('.item[role="button"][data-action="assign"]').filter(has_text='TOMATE RAMA')
    assert assignable.count() >= 1
    assignable.first.click()
    assert page.locator('.provider-card[data-provider="ESMO"] .product').filter(has_text='TOMATE RAMA').count() >= 1
    assert page.evaluate('window.__qa().delivery') == {}
    page.locator('.provider-card[data-provider="ESMO"] button[data-action="sent"]').click()
    assert page.locator('.provider-card[data-provider="ESMO"]').get_by_text('Enviado',exact=False).count() >= 1
    print('E2E 2: Asignación y envío confirmado con diálogo, sin WhatsApp real')

    page.locator('.bottomnav button[data-key="compras"]').click()
    assert page.locator('main h1').inner_text() == 'Compras'
    assert page.locator('.purchase-item[data-purchase-type="pending"]').count() == 1
    assert page.locator('.purchase-item[data-purchase-type="pending"] .purchase-title').inner_text() == 'BANANA'
    page.locator('.purchase-item[data-purchase-type="pending"] .purchase-tick').click()
    assert page.locator('.purchase-completed .purchase-item[data-purchase-type="manual"]').count() == 1
    assert page.evaluate('window.__qa().pending.find(x=>x.product==="BANANA").manuallyBought') == 1
    print('E2E 3: Compra manual tickable cambia a sección comprada')

    page.locator('.bottomnav button[data-key="reparto"]').click()
    assert page.locator('main h1').inner_text() == 'Bajar mercancía'
    assert page.locator('#deliveryDestination').count() == 1
    assert page.locator('.delivery-progress .progress-heading>b').inner_text() == '0%'
    btn = page.locator('button[data-action="deliver"]').filter(has_text='TOMATE RAMA').first
    btn.click()
    assert page.locator('.delivery-progress .progress-heading>b').inner_text() == '50%'
    assert page.evaluate("""window.__qa().delivery['TOMATE RAMA|BULTO@SP']""") == 3
    page.locator('button[data-action="undodelivery"]').first.click()
    assert page.locator('.delivery-progress .progress-heading>b').inner_text() == '0%'
    print('E2E 4: Reparto de una sola tienda, barra verde y deshacer')

    page.locator('.bottomnav button[data-key="compras"]').click()
    page.locator('button[data-action="purchasefilter"][data-key="all"]').click()
    product = page.locator('.purchase-item').filter(has_text='TOMATE RAMA').first
    assert product.count() == 1
    plus=product.locator('.editable-destination[data-destination="SP"] button[data-action="destqty"][data-target="1"]')
    plus.click()
    assert page.evaluate("""window.__qa().totals.find(x=>x.product==='TOMATE RAMA').total""") == 9
    assert page.evaluate("""window.__qa().pending.find(x=>x.product==='TOMATE RAMA').remainingToBuy""") == 1
    print('E2E 5: + de San Pablo sube total de 8 a 9 y deja una caja pendiente de comprar')

    page.locator('.bottomnav button[data-key="reparto"]').click()
    assert page.get_by_text('Compra parcial pendiente de distribuir',exact=False).count() > 0
    print('E2E 6: Reparto refleja la diferencia sin habilitar la caja que falta comprar')

    page.locator('.bottomnav button[data-key="pedidos"]').click()
    page.locator('button[data-action="newdest"]').click()
    assert page.get_by_text('CAFETERIA QA').count() > 0
    assert page.evaluate('window.__qa().totals.find(x=>x.product==="TOMATE RAMA").total') == 9
    print('E2E 7: Crear restaurante sin inventar cantidades')

    for width in [320,375,390,430,768,1440]:
        page.set_viewport_size({'width':width,'height':860})
        menu = '.bottomnav' if width <= 850 else '.side'
        page.locator(menu+' button[data-key="compras"]').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'desbordamiento compras {width}'
        page.locator(menu+' button[data-key="reparto"]').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'desbordamiento reparto {width}'
        if width <= 768:
            assert page.locator('.bottomnav').evaluate("(x)=>getComputedStyle(x).display") != 'none'
        else:
            assert page.locator('.side').evaluate("(x)=>getComputedStyle(x).display") != 'none'
    print('E2E 8: iPhone 320-430 px, tablet 768 y PC 1440 sin scroll horizontal')

    assert not errors, 'Errores JavaScript: '+str(errors)
    print('E2E COMPLETADO: pedidos, global, proveedores, compra tickable, baja parcial, progreso, cambio cantidad y tamaños responsive; 0 errores JS')
    context.close()
    browser.close()
