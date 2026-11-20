"""E2E visual sin acceder a datos reales ni Firebase: botones grandes y compras sin duplicados."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
# QA siempre local sin credenciales; la web publicada conserva configuración Firebase.
html=re.sub(r"(apiKey|authDomain|databaseURL|projectId|appId): '[^']*'",lambda m:m.group(1)+": ''",html)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(320,700),(375,812),(390,844),(430,932),(768,1024)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=True,has_touch=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='domcontentloaded')
        assert page.evaluate('state.orders.length')==91
        assert page.locator('.bottomnav button').count()==5
        assert page.locator('.top-more').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'scroll horizontal inicio {width}'
        for key,h1 in [('compras','Compras'),('reparto','Bajar mercancía'),('global','Asignación a proveedores'),('pedidos','Pedidos')]:
            page.locator(f'.bottomnav button[data-key="{key}"]').click()
            assert page.locator('main h1').first.inner_text()==h1, f'{width} {key} no abrió'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'scroll horizontal {width} {key}'
            if key=='compras':
                assert page.locator('.purchase-tabs .purchase-filter').count()==4
                assert page.locator('.purchase-tabs [data-key="pending"]').get_attribute('aria-pressed')=='true'
            if key=='reparto':assert page.locator('#deliveryDestination').count()==1
        assert not errors, f'JS {width}: {errors}'
        # La navegación no debe quedar bajo el indicador de inicio de iOS.
        layout=page.evaluate('''() => ({buttons:[...document.querySelectorAll('.bottomnav button')].map(x=>({x:x.getBoundingClientRect().x,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})), doc:document.documentElement.scrollWidth,view:innerWidth})''')
        assert all(x['w']>=54 and x['h']>=44 for x in layout['buttons']),str(layout)
        if width==390:
            page.locator('.bottomnav button[data-key="compras"]').click()
            page.screenshot(path=str(root/'tests/captura_compras_iphone.png'))
            page.locator('.bottomnav button[data-key="reparto"]').click()
            page.screenshot(path=str(root/'tests/captura_reparto_iphone.png'))
            # Marcar todo TOMATE RAMA como enviado a un proveedor excluye su compra duplicada.
            page.evaluate("""() => {const row=totals(state).find(x=>x.product==='TOMATE RAMA');quickAssign(state,row.key,'ESMO');markSupplierSent(state,'ESMO');render()}""")
            page.locator('.bottomnav button[data-key="compras"]').click()
            assert page.locator('.purchase-item[data-search="TOMATE RAMA"]').count()==0
            page.locator('.purchase-filter[data-key="supplier"]').click()
            assert page.locator('.purchase-item[data-search="TOMATE RAMA"]').count()==1
            page.locator('.purchase-filter[data-key="pending"]').click()
            page.locator('.bottomnav button[data-key="reparto"]').click()
            assert not errors,errors
        print('iPhone/tablet',width,': 4 pantallas, sin desbordamiento, 5 botones grandes, 0 JS errors')
        page.close()
    browser.close()