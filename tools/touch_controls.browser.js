// 通过 Playwright CLI 执行：run-code "$(cat tools/touch_controls.browser.js)"
// 默认使用当前页的站点；截图存放于 output/playwright/（先创建目录）。
async (page) => {
  const browser = page.context().browser();
  const engine = browser.browserType().name();
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  try {
    await p.goto(page.url());
    await p.evaluate(() => {
      App.startAI('normal'); App.paused = true; App.R.setVenue('arena'); App.R.clearFx(); App.pausedDrawn = false;
      window.touchEnds = [];
      document.addEventListener('touchend', e => touchEnds.push(e.defaultPrevented));
    });
    // 真正的触屏连续点击：每次按下恰好产生一次动作，且 scale 始终为 1。
    for (const action of ['jump', 'clear', 'drop', 'smash']) {
      for (let i = 0; i < 8; i++) await p.locator('.arc .t-' + action).tap();
    }
    const taps = await p.evaluate(() => ({ counts: App.ctrlFor[0].counts, scale: visualViewport.scale, ends: touchEnds }));
    check(Object.values(taps.counts).every(n => n === 8), '快速点击遗漏或重复动作');
    check(taps.scale === 1 && taps.ends.length === 32 && taps.ends.every(Boolean), '触屏默认缩放未被拦截');
    const controls = await p.evaluate(() => {
      const c = App.ctrlFor[0], zone = document.querySelector('.joy-zone');
      const r = document.querySelector('.joy').getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const event = (type, px, py, id = 71) => zone.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: px, clientY: py }));
      const initialJump = c.counts.jump;
      event('pointerdown', x, y);
      for (let i = 0; i < 10; i++) { event('pointermove', x, y - 85); event('pointermove', x, y + 50); }
      const verticalDir = c.touchDir;
      event('pointermove', x + 25, y - 80); const right = c.touchDir;
      event('pointermove', x - 25, y + 50); const left = c.touchDir;
      const jump = c.counts.jump - initialJump;
      event('pointercancel', x, y); const stopped = c.touchDir;
      const dbl = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
      document.querySelector('#game').dispatchEvent(dbl);
      return { verticalDir, right, left, jump, stopped, dblBlocked: dbl.defaultPrevented };
    });
    check(controls.verticalDir === 0 && controls.jump === 0, '摇杆垂直位移触发动作');
    check(controls.right > .9 && controls.left < -.9 && controls.stopped === 0 && controls.dblBlocked, '方向切换、释放或双击保护失败');
    // Chromium 额外验证原生多指同时触摸：移动时点跳，只触发一个起跳。
    if (engine === 'chromium') {
      const cdp = await context.newCDPSession(p);
      const r = await p.locator('.joy').boundingBox(), jump = await p.locator('.arc .t-jump').boundingBox();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:x+25,y:y-40,id:1}]});
      await p.waitForFunction(() => App.ctrlFor[0].touchDir > .9);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:x+25,y:y-40,id:1},{x:jump.x+jump.width/2,y:jump.y+jump.height/2,id:2}]});
      await p.waitForFunction(() => App.ctrlFor[0].counts.jump === 9);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchCancel', touchPoints:[]});
      await p.waitForFunction(() => App.ctrlFor[0].touchDir === 0);
    }
    const layouts = [];
    for (const [width, height] of [[568,320],[844,390],[390,844]]) {
      await p.setViewportSize({width,height});
      await p.evaluate(() => { YY.forceLand = innerHeight > innerWidth; App.applyViewport(); App.pausedDrawn = false; App.render(0); });
      const geometry = await p.evaluate(() => {
        const buttons = [...document.querySelectorAll('.arc .tbtn')].map(el => ({label:el.getAttribute('aria-label'), ...YY.appRect(el)}));
        const vp = YY.viewport();
        const circles = buttons.map(r => ({x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2}));
        let minGap = Infinity;
        for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++) {
          const a=circles[i], b=circles[j]; minGap=Math.min(minGap, Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r);
        }
        return {vp,buttons,minGap};
      });
      const {vp,buttons,minGap} = geometry, jump = buttons.find(b=>b.label==='跳');
      check(minGap >= 8, '环形按键触区过近');
      check(buttons.every(r=>r.width>=48&&r.left>=0&&r.top>=0&&r.left+r.width<=vp.W+1&&r.top+r.height<=vp.H+1), '触区越界或太小');
      check(buttons.filter(b=>b!==jump).every(b=>b.width<jump.width&&b.top+b.height<jump.top+jump.height), '跳键未位于右下角');
      layouts.push({width,height,minGap:Math.round(minGap),rot:vp.rot});
      if (vp.rot) {
        const before = await p.evaluate(()=>App.ctrlFor[0].counts.clear);
        await p.locator('.arc .t-clear').tap();
        check(await p.evaluate(()=>App.ctrlFor[0].counts.clear) === before + 1, '旋转后触控失准');
      }
      await p.screenshot({path:`output/playwright/radial-${engine}-${width}.png`});
    }
    await p.setViewportSize({width:844,height:390});
    await p.evaluate(()=>{YY.forceLand=false;App.applyViewport();App.show('help');});
    const help = p.locator('#scr-help .panel');
    check(await help.isVisible(), '菜单不可用');
    await p.evaluate(()=>{const el=document.querySelector('#scr-help .panel');el.scrollTop=150;});
    check(await help.evaluate(el=>el.scrollTop)>0, '帮助页无法滚动');
    await help.evaluate(el=>el.scrollTop=0);
    await p.locator('#scr-help button[data-go="menu"]').tap();
    check(await p.evaluate(()=>App.screen) === 'menu', '触摸保护吞掉菜单点击');
    await p.evaluate(()=>{App.show(null);App.startLocal();App.paused=true;App.R.clearFx();App.pausedDrawn=false;App.render(0);});
    await p.screenshot({path:`output/playwright/radial-${engine}-duo.png`});
    check(errors.length === 0, errors.join(';'));
    return {engine,taps:taps.counts,scale:taps.scale,controls,layouts,errors};
  } finally { await context.close(); }
}
