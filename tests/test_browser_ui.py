from playwright.sync_api import sync_playwright
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out='/mnt/data/ARSLAN_LISTAS_NEXT_GITHUB/tests/captura_bajar_movil.png'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 console=[]
 page.on('pageerror',lambda e:console.append(str(e)))
 page.set_content((ROOT/'index.html').read_text(encoding='utf8'),wait_until='load')
 print('1 INICIO',page.locator('h1').first.inner_text())
 # Open pedidos through bottom nav
 page.locator('.bottomnav [data-key="pedidos"]').click()
 assert page.get_by_text('Pedidos de restaurantes').count()==1
 assert page.get_by_text('BRASEROS · CENTRO').count()>=1
 # add restaurant specifically
 page.locator('button[data-action="destedit"][data-key="BC"]').first.click()
 page.locator('#destorder-BC').fill('2 TOMATE RAMA\n1 BROCOLI')
 page.locator('button[data-action="destadd"][data-key="BC"]').click()
 assert page.locator('.order-card[data-destination="BC"] .product').count()==2
 assert page.locator('.order-card[data-destination="BC"] button[data-action="destwa"]').count()==1
 assert page.locator('.order-card[data-destination="BC"] button[data-action="destdownload"]').count()==1
 print('2 RESTAURANTES',page.locator('.order-card[data-destination="BC"] h2').inner_text(),page.locator('.order-card[data-destination="BC"] .product').all_inner_texts())
 # open Global then ESMO and assign tomato (unreviewed)
 page.locator('.bottomnav [data-key="global"]').click()
 assert page.get_by_text('Sin asignar',exact=False).count()>0
 tomato = page.locator('.card .item').filter(has=page.locator('.product',has_text='TOMATE RAMA')).filter(has=page.locator('button[data-action="assign"]'))
 if tomato.count():
  tomato.first.click()
  assert page.locator('.provider-card[data-provider="ESMO"] .product').filter(has_text='TOMATE RAMA').count()==1
  assert page.locator('button[data-action="sent"][data-key="ESMO"]').count()==1
  print('3 ASIGNACION TOMATE a ESMO')
  page.locator('button[data-action="sent"][data-key="ESMO"]').click()
  print('4 MARCAR ENVIADO',page.locator('.provider-card[data-provider="ESMO"]').get_by_text('Enviado',exact=False).all_inner_texts()[:3])
 else:
  print('3 NO TOMATO IN UNASSIGNED; rows',page.locator('.card .item').count())
 page.locator('.bottomnav [data-key="compras"]').click()
 # opening TOMATE should show BRASEROS and SP
 purchase=page.locator('button.product-disclosure').filter(has_text='TOMATE RAMA')
 assert purchase.count()==1
 purchase.click()
 assert page.locator('.purchase-breakdown').get_by_text('BRASEROS · CENTRO').count()==1
 print('5 COMPRAS BREAKDOWN:',page.locator('.purchase-breakdown').inner_text()[:270])
 page.locator('.bottomnav [data-key="reparto"]').click()
 assert page.locator('select#deliveryDestination').count()==1
 page.locator('#deliveryDestination').select_option('BC')
 assert page.locator('h2').filter(has_text='Por bajar · BRASEROS · CENTRO').count()==1
 assert page.locator('h2').filter(has_text='Por bajar · SAN PABLO').count()==0
 page.screenshot(path=out,full_page=True)
 print('6 REPARTO POR DESTINO',page.locator('select#deliveryDestination').input_value(),page.locator('main').inner_text()[:570])
 # mark one down and verify one less
 pending_before=page.locator('button[data-action="deliver"]').count()
 if pending_before:
  page.locator('button[data-action="deliver"]').first.click()
  pending_after=page.locator('button[data-action="deliver"]').count()
  assert pending_after==pending_before-1,(pending_before,pending_after)
  print('7 BAJAR',pending_before,pending_after)
 assert not console,console
 print('CONSOLE ERRORS:',console)
 print('SCREENSHOT:',out)
 browser.close()