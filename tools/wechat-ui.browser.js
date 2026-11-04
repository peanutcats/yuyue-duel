async (page) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8766');
  await page.waitForFunction(() => !!window.YuyueGame?.ui?.buttons.length);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const click = async id => {
    await settle();
    const b = await page.evaluate(id => { const u = YuyueGame.ui, b = u.buttons.find(b => b.id === id && !b.disabled); if (!b) throw Error('Missing button ' + id); return { x: u.originX + (b.x + b.w / 2) * u.scale, y: u.originY + (b.y + b.h / 2) * u.scale }; }, id);
    await page.mouse.click(b.x, b.y); await settle();
  };
  const expect = async screen => { const actual = await page.evaluate(() => YuyueGame.screen); if (actual !== screen) throw Error('Expected ' + screen + ', got ' + actual); };
  await click('ai'); await expect('ai'); await page.screenshot({path:'output/playwright/wechat-ai.png'});
  await click('normal'); await expect(null); await page.screenshot({path:'output/playwright/wechat-match.png'});
  await click('pause'); await expect('pause'); await click('help-pause'); await expect('help'); await click('back'); await expect('pause'); await click('quit');
  await click('story'); await page.screenshot({path:'output/playwright/wechat-story.png'}); await click('stage-0-1'); await expect('dialog'); await page.screenshot({path:'output/playwright/wechat-dialog.png'});
  await click('skip'); await expect(null); await click('pause'); await click('quit');
  await page.evaluate(() => YY.Profile.setStars('0-1', 1)); await click('stage-0-2'); await click('skip'); await expect('quiz'); await page.screenshot({path:'output/playwright/wechat-quiz.png'});
  await click('back'); await expect('story'); await click('back');
  await click('team'); await expect('team'); await page.screenshot({path:'output/playwright/wechat-team.png'}); await click('char-canglan');
  await click('character-bio'); await expect('message'); await click('message-ok'); await click('back');
  await click('practice'); await click('drill-smash'); await page.screenshot({path:'output/playwright/wechat-practice.png'}); await click('pause'); await click('quit');
  await page.setViewportSize({width:844,height:390}); await page.goto('http://127.0.0.1:8766/?safe=1'); await settle();
  await page.screenshot({path:'output/playwright/wechat-phone.png'});
  await click('ai'); await click('easy'); await page.screenshot({path:'output/playwright/wechat-phone-match.png'});
  await page.setViewportSize({width:1024,height:768}); await settle(); await click('pause'); await page.screenshot({path:'output/playwright/wechat-tablet.png'});
  await page.setViewportSize({width:390,height:844}); await settle(); await page.screenshot({path:'output/playwright/wechat-portrait.png'});
  await page.setViewportSize({width:960,height:540}); await page.goto('http://127.0.0.1:8766'); await settle();
  if(errors.length) throw Error(errors.join('\n'));
  return {passed:true, screens:12, errors};
}
