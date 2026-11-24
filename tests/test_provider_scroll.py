"""Supplier assignment keeps its reading position in a real isolated browser.

Run after ``npm run build`` with Playwright and Chromium installed. No live
Firebase calls or user storage are used; every network request is blocked.
"""
from pathlib import Path
import os
import shutil

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = Path(os.environ.get('ARSLAN_SCROLL_TEST_HTML', ROOT / 'index.html'))
HTML = HTML_PATH.read_text(encoding='utf8')
assert 'const ARSLAN_CLOUD_ACTIVE = Boolean(' in HTML
HTML = HTML.replace(
    'const ARSLAN_CLOUD_ACTIVE = Boolean(',
    'const ARSLAN_CLOUD_ACTIVE = false && Boolean(',
    1,
)


def settle(page):
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')


def position(page):
    return page.evaluate('''() => {
      const list=document.querySelector('.assign-items');
      return {scroll:list.scrollTop,max:list.scrollHeight-list.clientHeight,
        top:list.getBoundingClientRect().top,
        panelTop:document.querySelector('.assign-panel').getBoundingClientRect().top,
        pageY:window.scrollY,
        pageMax:Math.max(0,document.scrollingElement.scrollHeight-innerHeight)};
    }''')


def target_in_view(page, last=False):
    return page.evaluate('''last => {
      const list=document.querySelector('.assign-items'), bounds=list.getBoundingClientRect();
      const nav=document.querySelector('.bottomnav'),navBounds=nav?.getBoundingClientRect();
      const bottom=Math.min(bounds.bottom,navBounds?.height?navBounds.top:innerHeight);
      const top=Math.max(bounds.top,document.querySelector('.top').getBoundingClientRect().bottom);
      const candidates=[...list.querySelectorAll('button[data-action="assign"]')].map(button=>{
        const r=button.getBoundingClientRect();
        return {key:decodeURIComponent(button.dataset.key),x:r.left+r.width/2,y:r.top+r.height/2,
          visible:r.top>top+8&&r.bottom<bottom-8};
      }).filter(x=>x.visible);
      if(!candidates.length)throw Error('No complete assignment button is visible');
      return candidates[last?candidates.length-1:Math.min(1,candidates.length-1)];
    }''', last)


def check_assignment(page, label, last=False, allow_page_clamp=False):
    target=target_in_view(page,last)
    before=position(page)
    count=page.locator('.assign-items [data-action="assign"]').count()
    page.mouse.click(target['x'],target['y'])
    settle(page)
    after=position(page)
    expected=min(before['scroll'],after['max'])
    assert abs(after['scroll']-expected)<=2, (
        label, 'assignment reset the nested list', before, after)
    if allow_page_clamp:
        # A short search result can become shorter than the viewport. Keep
        # the anchor exactly unless reaching the real document boundary makes
        # that position impossible; never permit an arbitrary jump.
        document_top=after['top']+after['pageY']
        desired_page_y=document_top-before['top']
        expected_page_y=max(0,min(desired_page_y,after['pageMax']))
        expected_top=document_top-expected_page_y
        assert abs(after['top']-expected_top)<=2 and abs(after['pageY']-expected_page_y)<=2, (
            label,'unexpected page position',before,after,
            {'expectedTop':expected_top,'expectedPageY':expected_page_y})
    else:
        assert abs(after['top']-before['top'])<=2, (
            label, 'assignment moved the list in the page', before, after)
    assert page.locator('.assign-items [data-action="assign"]').count()==count-1
    result=page.evaluate('''key => ({
      selected:supplier,
      rows:state.allocations.filter(row=>row.key===key),
      orders:JSON.stringify(state.orders),
      manual:state.manual,delivery:state.delivery,
      saved:JSON.parse(localStorage.getItem(KEY))
    })''',target['key'])
    assert result['selected']=='MONTENEGRO'
    assert len(result['rows'])==1
    assert result['rows'][0]['supplier']=='MONTENEGRO'
    assert result['rows'][0]['status']=='draft'
    assert result['orders']==page.evaluate('window.__originalOrders')
    assert result['manual']==[] and result['delivery']=={}
    assert any(row['key']==target['key'] for row in result['saved']['allocations'])
    assert not page.locator('main .notice.red').count()
    print(f'{label}: list {before["scroll"]:.0f} -> {after["scroll"]:.0f}; '
          f'viewport top {before["top"]:.1f} -> {after["top"]:.1f}')


with sync_playwright() as p:
    launch={'headless':True,'args':['--no-sandbox']}
    managed_browser=Path(p.chromium.executable_path)
    system_browser=(shutil.which('google-chrome') or shutil.which('google-chrome-stable')
                    or shutil.which('chromium') or shutil.which('chromium-browser'))
    if not managed_browser.exists() and system_browser:
        launch['executable_path']=system_browser
    browser=p.chromium.launch(**launch)
    for width,height,mobile in [(1440,900,False),(390,844,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},
            device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
        context.route('**/*',lambda route:route.abort())
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_default_timeout(4000)
        page.evaluate('''() => {
          const box=new Map();
          Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem:key=>box.get(key)||null,
            setItem:(key,value)=>box.set(key,String(value)),
            removeItem:key=>box.delete(key)
          }});
        }''')
        page.set_content(HTML,wait_until='domcontentloaded')
        page.evaluate('''() => {
          state=createState();
          importBlocks(state,'PEDIDO SP\\n'+state.catalog.slice(0,60).map(name=>'2 '+name).join('\\n'));
          window.__originalOrders=JSON.stringify(state.orders);
          tab='global';supplier='MONTENEGRO';filter='pending';render();
          const list=document.querySelector('.assign-items');
          list.scrollTop=1300;
          window.scrollTo({left:0,top:window.scrollY+list.getBoundingClientRect().top-180,behavior:'instant'});
        }''')
        settle(page)
        assert position(page)['scroll']>1000
        for index in range(3):
            check_assignment(page,f'{width}px consecutive assignment {index+1}')

        # A cloud onApply callback also replaces state and renders the whole view.
        # Exercise that same redraw boundary after local assignment has completed.
        before=position(page)
        page.evaluate('state=normalizeRuntimeState(structuredClone(state)); render()')
        settle(page)
        after=position(page)
        assert abs(after['scroll']-before['scroll'])<=2,(width,'redraw',before,after)
        assert abs(after['top']-before['top'])<=2,(width,'redraw viewport',before,after)

        page.evaluate("document.querySelector('.assign-items').scrollTop=1e9")
        settle(page)
        check_assignment(page,f'{width}px near bottom',last=True)

        # Keep the active product search through an assignment redraw. Growing
        # the supplier card must not reveal unrelated products again.
        page.locator('#searchRows').fill('MANZANA')
        page.evaluate('''() => {
          const list=document.querySelector('.assign-items');
          list.scrollTop=100;
          window.scrollTo({left:0,top:window.scrollY+list.getBoundingClientRect().top-180,behavior:'instant'});
        }''')
        settle(page)
        check_assignment(page,f'{width}px filtered assignment',allow_page_clamp=True)
        assert page.locator('#searchRows').input_value()=='MANZANA'
        visible_names=page.locator('.assign-items .searchable:visible .product').all_text_contents()
        assert visible_names and all('MANZANA' in name for name in visible_names)

        # Deliberately choosing a different list filter starts that result at
        # the beginning instead of inheriting a position from the prior filter.
        page.locator('#searchRows').fill('')
        page.evaluate("document.querySelector('.assign-items').scrollTop=1100")
        assert position(page)['scroll']>1000
        page.locator('.assign-panel button[data-action="filter"][data-key="all"]').click()
        settle(page)
        assert position(page)['scroll']==0
        assert page.locator('.assign-items .searchable').count()==60

        # A genuine navigation still opens the next screen at the top.
        page.locator('button[data-action="goto"][data-key="inicio"]:visible').click()
        settle(page)
        assert page.evaluate('window.scrollY')<=1
        page.locator('.shortcut[data-action="goto"][data-key="global"]').click()
        settle(page)
        assert position(page)['scroll']==0
        assert not errors,(width,errors)
        context.close()
    browser.close()
print('PROVIDER SCROLL: desktop and mobile assignment, repeat clicks, redraw and bottom clamp passed')
