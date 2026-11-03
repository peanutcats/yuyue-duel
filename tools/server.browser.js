// Playwright CLI run-code: two independent pages, authoritative state and reconnect.
async (page) => {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const a = await desktop.newPage(), b = await mobile.newPage(), errors = [];
  for (const p of [a, b]) p.on('pageerror', e => errors.push(e.message));
  try {
    await a.goto(base);
    await a.getByRole('button', { name: '好友对战 在线房间 · 同屏双人 ›' }).click();
    await a.getByRole('button', { name: '创建房间', exact: true }).click();
    await a.waitForFunction(() => YY.Net.code);
    const code = await a.locator('#lobbyCode').textContent();
    await b.goto(base + '/?room=' + code);
    await Promise.all([a, b].map(p => p.waitForFunction(() => App.isOnline() && App.view.buf.length > 2)));
    const initial = await Promise.all([a, b].map(p => p.evaluate(() => ({ player: App.playerIndex, localMatch: App.match, mirror: App.R.mirror, id: App.matchId }))));
    if (initial.some(s => s.localMatch !== null) || initial[0].player !== 0 || initial[1].player !== 1) throw new Error('Client authority or seat assignment failed');
    const serving = await a.evaluate(() => App.view.server);
    await (serving ? b : a).keyboard.press('KeyJ');
    await a.waitForFunction(() => App.view.phase === 'rally');
    // Keyboard input still works on a touch-capable viewport; touch layout is checked below.
    const mover = serving ? a : b;
    const before = await mover.evaluate(() => App.view.players[App.playerIndex].x);
    await mover.keyboard.down('KeyD'); await mover.waitForTimeout(250); await mover.keyboard.up('KeyD');
    const after = await mover.evaluate(() => App.view.players[App.playerIndex].x);
    if (Math.abs(after - before) < 0.1) throw new Error('Movement input did not reach authority');
    await Promise.all([a, b].map(p => p.waitForFunction(() => App.view.score[0] + App.view.score[1] > 0)));
    const scores = await Promise.all([a, b].map(p => p.evaluate(() => App.view.score)));
    if (JSON.stringify(scores[0]) !== JSON.stringify(scores[1])) throw new Error('Scores disagree');
    await b.evaluate(() => YY.Net.socket.close());
    await b.waitForFunction(() => YY.Net.socket?.readyState === 1 && !YY.Net.retryAt && App.view.buf.length > 2);
    const resumed = await b.evaluate(() => App.matchId);
    if (resumed !== initial[1].id) throw new Error('Reconnect reset the match');
    if (!await b.locator('#touch').isVisible()) throw new Error('Mobile controls missing');
    await a.screenshot({ path: 'output/playwright/server-desktop.png' });
    await b.screenshot({ path: 'output/playwright/server-mobile.png' });
    if (errors.length) throw new Error(errors.join('\n'));
    return { initial, scores, movement: Math.abs(after - before), reconnected: true, mobileControls: true, errors };
  } finally { await desktop.close(); await mobile.close(); }
}
