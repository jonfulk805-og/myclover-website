import asyncio,json,os,tempfile,glob
from pathlib import Path
OUT=Path(tempfile.mkdtemp(prefix="clover-lanes-test-"))
from playwright.async_api import async_playwright
BASE=os.environ.get('BOWLING_TEST_URL','http://localhost:8000/games/clover-bowling/?manual')
async def ready(page,mode='solo'):
 await page.goto(BASE);await page.wait_for_function('window.__BL');await page.select_option('#mode',mode);await page.click('#start');await page.add_style_tag(content='*{transition:none!important}')
async def forced(page,n):
 await page.click('#bowl')
 await page.evaluate('''n=>{__BL.phys.pins.forEach((p,i)=>p.down=i<n);__BL.finishRoll();}''',n)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or next(iter(glob.glob('/root/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell')),None),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await b.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await ready(page)
  await page.locator('#bowl').focus();await page.keyboard.down('KeyD');await page.evaluate('__BL.step(120)');await page.keyboard.up('KeyD');assert float(await page.input_value('#aim'))>1
  await page.locator('#bowl').focus();await page.keyboard.down('ArrowRight');await page.evaluate('__BL.step(120)');await page.keyboard.up('ArrowRight');assert float(await page.input_value('#position'))>=27
  await page.keyboard.press('KeyP');assert await page.evaluate('__BL.paused');await page.click('#resume');assert not await page.evaluate('__BL.paused')
  print('Keyboard aim, position and pause PASS')
  await ready(page)
  for i in range(12):
   await forced(page,10)
   assert await page.evaluate('__BL.players[0].frames.flat().length')==i+1
   await page.click('#next')
   if i<11:assert await page.evaluate('__BL.phys.pins.length')==10
  assert await page.evaluate('__BL.state')=='end';assert await page.evaluate('__BL.players[0].total()')==300
  print('Perfect game UI, tenth-frame fresh racks, final score PASS')
  await ready(page)
  for i in range(9):
   await forced(page,0);await page.click('#next');await forced(page,0);await page.click('#next')
  await forced(page,10);await page.click('#next');await forced(page,7);await page.click('#next');assert await page.evaluate('__BL.phys.pins.length')==3
  await forced(page,3);await page.click('#next');assert await page.evaluate('__BL.players[0].total()')==20
  print('Tenth X,7,/ retains remaining 3 pins, score 20 PASS')
  await ready(page,'two')
  for i in range(24):
   await forced(page,10);await page.click('#next')
  assert await page.evaluate('__BL.state')=='end';assert await page.evaluate('__BL.players.map(p=>p.total())')==[300,300]
  print('Pass-and-play alternating frames, full 300-300 tie PASS')
  await ready(page,'practice')
  await forced(page,10);await page.click('#next');await forced(page,3);await page.click('#next');assert await page.evaluate('__BL.phys.pins.length')==7
  await forced(page,0);await page.click('#next');assert await page.evaluate('__BL.phys.pins.length')==10
  print('Practice reset after strike + two throw counter PASS')
  await ready(page)
  result=await page.evaluate('''()=>{let shots=0;while(__BL.state!=='end'&&shots<30){if(__BL.state==='aim'){__BL.launch();__BL.step(1200);shots++;}else if(__BL.state==='result')__BL.next();else throw Error(__BL.state);}return {shots,state:__BL.state,total:__BL.players[0].total(),frames:__BL.players[0].frames};}''')
  assert result['state']=='end';print('REAL PHYSICS COMPLETE GAME',json.dumps(result))
  await page.set_viewport_size({'width':844,'height':390});await ready(page);await page.wait_for_function('document.querySelector("canvas").width<1000');await page.evaluate('__BL.step(240);__BL.render(5)');await page.screenshot(path=str(OUT/'landscape.png'))
  await page.set_viewport_size({'width':390,'height':844});await ready(page);await page.wait_for_function('document.querySelector("canvas").width<700');await page.evaluate('__BL.step(240);__BL.render(5)');await page.screenshot(path=str(OUT/'phone.png'))
  box=await page.locator('#bowl').bounding_box();assert box['y']+box['height']<844
  await page.locator('#aim').fill('0.5');await page.click('#bowl');await page.evaluate('__BL.step(1200);__BL.render(5)');assert await page.evaluate('__BL.state')=='result'
  print('Phone slider + bowl, landscape controls PASS; errors',errors);assert not errors
  await b.close()
asyncio.run(main())
