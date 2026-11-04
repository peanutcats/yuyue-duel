async (page) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width:960,height:540});
  await page.goto('http://127.0.0.1:8766/?online=1');
  await page.waitForFunction(() => !!window.YuyueGame?.net);
  const click = async (p, id) => {
    const b = await p.evaluate(id => { const u = YuyueGame.ui; u.draw(); const b = u.buttons.find(b=>b.id===id && !b.disabled); if(!b) throw Error('Missing '+id); return {x:u.originX+(b.x+b.w/2)*u.scale,y:u.originY+(b.y+b.h/2)*u.scale}; },id);
    await p.mouse.click(b.x,b.y);
  };
  await click(page,'friend'); await click(page,'host');
  await page.waitForFunction(() => !!YuyueGame.net.code);
  const room = await page.evaluate(() => YuyueGame.net.code);
  const context2 = await page.context().browser().newContext({viewport:{width:960,height:540},hasTouch:true});
  const peer = await context2.newPage(); peer.on('pageerror', e=>errors.push(e.message));
  try {
    await peer.goto('http://127.0.0.1:8766/?online=1&room='+room);
    await peer.waitForFunction(() => YuyueGame.mode==='online' && !!YuyueGame.view?.buf.length);
    await page.waitForFunction(() => YuyueGame.mode==='online' && !!YuyueGame.view?.buf.length);
    // Separate windows represent two phones. Ensure both simulated apps are foregrounded.
    for(const p of [page,peer]) await p.evaluate(() => { __wx.emit('show',{query:{}}); if(YuyueGame.screen==='pause')YuyueGame.togglePause(); });
    await page.waitForFunction(() => YuyueGame.serverWait===null);
    const states = await Promise.all([page,peer].map(p=>p.evaluate(() => ({room:YuyueGame.net.code,player:YuyueGame.playerIndex,mirror:YuyueGame.R.mirror,match:YuyueGame.matchId,score:YuyueGame.view.score}))));
    if(states[0].player!==0 || states[1].player!==1 || !states[1].mirror || states[0].match!==states[1].match) throw Error(JSON.stringify(states));
    await page.screenshot({path:'output/playwright/wechat-online-host.png'}); await peer.screenshot({path:'output/playwright/wechat-online-guest.png'});
    await peer.evaluate(() => YuyueGame.net.disconnected());
    await peer.waitForFunction(() => YuyueGame.net.status==='connected' && !!YuyueGame.view?.buf.length);
    const reconnectRoom = await peer.evaluate(() => YuyueGame.net.code); if(reconnectRoom!==room)throw Error('Lost room on reconnect');
    await peer.evaluate(() => YuyueGame.quit());
    await page.waitForFunction(() => YuyueGame.screen==='message');
    if(errors.length)throw Error(errors.join('\n'));
    return {passed:true,room,states,reconnect:true,errors};
  } finally { await context2.close(); await page.goto('http://127.0.0.1:8766'); }
}
