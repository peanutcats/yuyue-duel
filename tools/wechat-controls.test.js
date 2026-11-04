'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadGame } = require('./wechat-test-harness');

function startSolo(opts) {
  const h = loadGame(opts); h.click('ai'); h.click('normal');
  const m = h.app.match; m.server = 1; m.resetPoint(); m.phase = 'idle'; m.shuttle.held = false;
  return h;
}

test('movement pad: seam, gaps, thumb drift and sliding never drop the direction; leaving far away stops', () => {
  const h = startSolo(), { app } = h, c = app.ctrlFor[0];
  const L = app.ui.controls.find(b => b.id === 'left'), cx = L.zone.cx, cy = L.y;
  h.touch('Start', [[1, cx + 1, cy]]); assert.equal(c.move(), 1, 'pressing exactly on the seam still moves');
  h.touch('Move', [[1, cx - 25, cy + 8]]); assert.equal(c.move(), -1, 'slide across seam switches direction');
  h.touch('Move', [[1, cx - 25, cy - 75]]); assert.equal(c.move(), -1, 'thumb drifting upward keeps moving');
  h.touch('Move', [[1, cx + 5, cy - 75]]); assert.equal(c.move(), -1, 'hysteresis near the seam avoids jitter');
  h.touch('Move', [[1, cx + 30, cy]]); assert.equal(c.move(), 1);
  const x0 = app.match.players[0].x; h.frames(10); assert.ok(app.match.players[0].x > x0, 'player actually moves toward the net');
  h.touch('Move', [[1, app.ui.W / 2, 40]]); assert.equal(c.move(), 0, 'leaving for the top of the screen stops');
  h.touch('Move', [[1, cx - 30, cy]]); assert.equal(c.move(), -1, 'coming back resumes');
  h.touch('End', [[1, cx - 30, cy]]); assert.equal(c.move(), 0);
  h.touch('Start', [[2, 4, app.ui.H - 4]]); assert.equal(c.move(), -1, 'screen corner below the pad still counts as left');
  h.touch('End', [[2, 4, app.ui.H - 4]]);
  app.destroy();
});

test('action buttons use enlarged nearest-centre hit areas and stay finger sized', () => {
  for (const [width, height] of [[667, 375], [844, 390], [932, 430]]) {
    const h = startSolo({ width, height, safe: true }), { app } = h, c = app.ctrlFor[0];
    const actions = app.ui.controls.filter(b => b.action);
    for (const b of actions) {
      assert.ok(b.r * app.ui.scale >= 23, `${width}: ${b.id} visual radius ${b.r * app.ui.scale}pt too small`);
      assert.ok(b.hitR > b.r);
      h.touch('Start', [[5, b.x + b.r + 6, b.y]]); h.touch('End', [[5, b.x + b.r + 6, b.y]]);
      const q = [...c.drain()]; assert.deepEqual(q, [b.action], `${width}: tapping just outside ${b.id} edge`);
    }
    const jump = actions.find(b => b.id === 'jump'), smash = actions.find(b => b.id === 'smash');
    const mx = (jump.x + smash.x) / 2, my = (jump.y + smash.y) / 2 + 6;
    h.touch('Start', [[6, mx, my]]); h.touch('End', [[6, mx, my]]);
    assert.deepEqual([...c.drain()], [Math.hypot(mx - jump.x, my - jump.y) / jump.hitR < Math.hypot(mx - smash.x, my - smash.y) / smash.hitR ? 'jump' : 'smash']);
    app.destroy();
  }
});

test('UI scale keeps text readable on phones: logical height ~380 so 1 unit is about 1pt', () => {
  for (const [width, height] of [[667, 375], [844, 390], [932, 430]]) {
    const h = loadGame({ width, height, safe: true });
    assert.ok(h.app.ui.scale >= .86 && h.app.ui.scale <= 1.2, `${width}x${height} scale ${h.app.ui.scale}`);
    assert.ok(h.app.ui.W >= 699.9 && h.app.ui.H >= 379.9);
    for (const screen of ['menu', 'ai', 'practice', 'friend', 'join', 'story', 'team', 'codex', 'help', 'settings']) {
      h.app.show(screen); h.frames(1);
      for (const b of h.app.ui.buttons) {
        if (b.id === 'dialogue' || b.h <= 0) continue;
        assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= h.app.ui.W + 1 && b.y + b.h <= h.app.ui.H + 1, `${width} ${screen}: ${b.id} out of bounds`);
        if (b.h > 0 && !b.disabled && b.y < h.app.ui.capB) assert.ok(b.x + b.w <= h.app.ui.capL + 12, `${width} ${screen}: ${b.id} under WeChat capsule`);
      }
    }
    h.app.destroy();
  }
});
