from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
# Archivo HTML aislado, sin conexión Firebase ni cambios en cuentas del usuario.
html=re.sub(r"(apiKey|authDomain|databaseURL|projectId|appId): '[^']*'",lambda m:m.group(1)+": ''",html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h in [(320,700),(375,812),(390,844),(430,932)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=True,has_touch=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_default_timeout(3500)
  # El entorno de QA bloquea acceso real a localStorage en about:blank.
  # Simular almacenamiento de esta pestaña para comprobar guardados sin red.
  page.evaluate("""() => {
   const box = new Map();
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>box.has(k)?box.get(k):null,
    setItem:(k,v)=>{box.set(k,String(v))},
    removeItem:k=>box.delete(k),clear:()=>box.clear()
   }});
  }""")
  page.set_content(html,wait_until='domcontentloaded')
  page.evaluate("""() => {state=createState();importBlocks(state,'PEDIDO SP\\n5 TOMATE RAMA\\n2 MANZANA GOLDEN 24');tab='compras';purchaseView='pending';render()}""")
  assert page.locator('main h1').first.inner_text()=='Compras'
  assert page.locator('.bottomnav button').count()==5
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow init {w}'
  pending=page.locator('.purchase-item[data-search="TOMATE RAMA"][data-purchase-type="pending"]')
  manual=page.locator('.purchase-completed .purchase-item[data-search="TOMATE RAMA"]')
  assert pending.count()==1 and manual.count()==0
  assert pending.locator('button[role="checkbox"]').get_attribute('aria-checked')=='false'
  assert pending.locator('[data-purchase-qty]').input_value()=='5'
  # Restar, sumar, escribir 3 y confirmar compra; parcial queda arriba y compra abajo.
  pending.locator('[data-target="pending:-1"]').click()
  assert pending.locator('[data-purchase-qty]').input_value()=='4'
  pending.locator('[data-target="pending:1"]').click()
  assert pending.locator('[data-purchase-qty]').input_value()=='5'
  pending.locator('[data-purchase-qty]').fill('3')
  pending.locator('[data-action="purchase-confirm"]').click()
  pending=page.locator('.purchase-item[data-search="TOMATE RAMA"][data-purchase-type="pending"]')
  manual=page.locator('.purchase-completed .purchase-item[data-search="TOMATE RAMA"]')
  assert pending.count()==1 and manual.count()==1
  assert pending.locator('.keynum').inner_text()=='2'
  assert manual.locator('.keynum').inner_text()=='3'
  assert manual.locator('button[role="checkbox"]').get_attribute('aria-checked')=='true'
  assert page.evaluate("pendingManualPurchaseTXT(state)")=='2MANZANA GOLDEN 24\n2TOMATE RAMA'
  # Un ajuste adicional desde abajo debe actualizar pendientes arriba.
  manual.locator('[data-target="manual:1"]').click()
  assert manual.locator('[data-purchase-qty]').input_value()=='4'
  manual.locator('[data-action="purchase-save"]').click()
  pending=page.locator('.purchase-item[data-search="TOMATE RAMA"][data-purchase-type="pending"]')
  manual=page.locator('.purchase-completed .purchase-item[data-search="TOMATE RAMA"]')
  assert pending.locator('.keynum').inner_text()=='1'
  assert manual.locator('.keynum').inner_text()=='4'
  # Al desmarcar se recupera la totalidad y desaparece de completados.
  manual.locator('[data-action="purchase-toggle"]').click()
  pending=page.locator('.purchase-item[data-search="TOMATE RAMA"][data-purchase-type="pending"]')
  assert pending.locator('.keynum').inner_text()=='5'
  assert page.locator('.purchase-completed .purchase-item[data-search="TOMATE RAMA"]').count()==0
  assert page.evaluate('state.manual.at(-1).kind')=='reversal'
  assert page.locator('main .notice.red').count()==0, 'No se debe mostrar error de guardado'
  assert page.evaluate("JSON.parse(localStorage.getItem(KEY)).manual.length>0"), 'No persistió la corrección'

  # Seleccionar el producto completo y luego otro, deshacer todos.
  pending.locator('[data-action="purchase-toggle"]').click()
  assert page.locator('.purchase-item[data-search="TOMATE RAMA"][data-purchase-type="pending"]').count()==0
  assert page.locator('.purchase-completed .purchase-item[data-search="TOMATE RAMA"]').count()==1
  apple=page.locator('.purchase-item[data-search="MANZANA GOLDEN 24"][data-purchase-type="pending"]')
  apple.locator('[data-action="purchase-toggle"]').click()
  assert page.locator('.purchase-completed .purchase-item').count()==2
  page.once('dialog',lambda d:d.accept())
  page.locator('[data-action="manual-undo-all"]').click()
  assert page.locator('.purchase-completed .purchase-item').count()==0
  assert page.evaluate('pendingManualPurchaseTXT(state)')=='2MANZANA GOLDEN 24\n5TOMATE RAMA'
  # Compras > manual now empty; other sections still open.
  page.locator('.purchase-filter[data-key="manual"]').click()
  assert page.locator('main h1').first.inner_text()=='Compras'
  assert page.locator('.purchase-item[data-purchase-type="manual"]').count()==0
  page.locator('.bottomnav [data-key="reparto"]').click()
  assert page.locator('main h1').first.inner_text()=='Bajar mercancía'
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow reparto {w}'
  page.locator('.bottomnav [data-key="compras"]').click()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow compras {w}'
  for el in page.locator('.qty-step').all():
   assert el.evaluate('(el) => el.getBoundingClientRect().width>=44')
  assert not errors,(w,errors)
  assert page.locator('main .notice.red').count()==0, f'Error inesperado visible {w}'
  if w==390:
   page.locator('.purchase-filter[data-key="pending"]').click()
   page.screenshot(path=str(root/'tests/iphone_compras_pendientes.png'),full_page=True)
   page.locator('.purchase-item[data-purchase-type="pending"]').first.locator('[data-action="purchase-toggle"]').click()
   page.screenshot(path=str(root/'tests/iphone_compras_seleccionada.png'),full_page=True)
  print(f'iPhone {w}px: seleccionar, +/−, escribir, mover abajo, desmarcar, deshacer todo, TXT, Reparto, 0 errores')
  page.close()
 browser.close()