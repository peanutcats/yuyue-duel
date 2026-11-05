'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const safeInsets = require('../minigame/src/safe-area');
const { loadGame } = require('./wechat-test-harness');

test('portrait safe-area coordinates reported in a landscape window reserve the notch without shrinking only the right side', () => {
  const v = safeInsets({ windowWidth: 844, windowHeight: 390, safeArea: { left: 0, top: 59, right: 390, bottom: 810 } });
  assert.deepEqual(v, { left: 59, right: 59, top: 0, bottom: 0, safeAreaSource: 'rotated' });
  // Previous code silently capped the right gap to 15% of 844, shifting
  // the page centre 63.3pt left, exactly the class of failure in the phone image.
  const h = loadGame({ windowInfo: { safeArea: { left: 0, top: 59, right: 390, bottom: 810 } } });
  const u = h.app.ui;
  assert.ok(Math.abs(u.originX + u.W * u.scale / 2 - 422) < .01);
  assert.ok(u.originX >= 59); assert.ok(u.W * u.scale > 720);
  h.click('story'); assert.equal(h.app.screen, 'story');
  h.click('back'); h.click('ai'); h.click('normal');
  const right = h.app.ui.controls.find(b => b.id === 'right');
  h.touch('Start', [[1, right.x, right.y]]); assert.equal(h.app.ctrlFor[0].move(), 1);
  h.touch('End', [[1, right.x, right.y]]); assert.equal(h.app.ctrlFor[0].move(), 0);
  h.app.destroy();
});

test('notch on either side, no safe area, and malformed safe areas keep every landscape page centred and tappable', () => {
  const cases = [
    { width: 667, height: 375, safeArea: null },
    { width: 844, height: 390, safeArea: { left: 47, top: 0, right: 844, bottom: 369 } },
    { width: 844, height: 390, safeArea: { left: 0, top: 0, right: 797, bottom: 369 } },
    { width: 932, height: 430, safeArea: { left: 0, top: 59, right: 430, bottom: 898 } },
    { width: 1024, height: 768, safeArea: { left: 0, top: 24, right: 1024, bottom: 748 } },
    { width: 844, height: 390, safeArea: { left: NaN, top: 999, right: 0, bottom: 0 } },
    { width: 844, height: 390, safeArea: { left: 0, top: 0, right: 300, bottom: 200 } },
  ];
  for (const { width, height, safeArea } of cases) {
    const h = loadGame({ width, height, windowInfo: { safeArea } }), u = h.app.ui;
    assert.ok(Math.abs(u.originX + u.W * u.scale / 2 - width / 2) < .01);
    assert.ok(u.originX >= 12 && u.W * u.scale > width * .75);
    for (const screen of ['menu', 'story', 'team', 'settings', 'help', 'friend']) {
      h.app.show(screen); h.frames();
      const left = u.originX + 20 * u.scale, right = width - (u.originX + (u.W - 20) * u.scale);
      assert.ok(Math.abs(left - right) < .01, `${width} ${screen} gutters`);
      for (const b of u.buttons.filter(b => !b.disabled && b.h > 0)) {
        assert.ok(b.x >= -1 && b.x + b.w <= u.W + 1 && b.y >= -1 && b.y + b.h <= u.H + 1, `${width} ${screen} ${b.id} bounds`);
      }
    }
    h.app.show('menu'); h.frames();
    const b = u.buttons.find(b => b.id === 'story');
    // Use raw device coordinates to check render/input transforms together.
    const touch = { identifier: 9, clientX: u.originX + (b.x + b.w / 2) * u.scale, clientY: u.originY + (b.y + b.h / 2) * u.scale };
    h.events.TouchStart({ changedTouches: [touch] }); h.events.TouchEnd({ changedTouches: [touch] });
    assert.equal(h.app.screen, 'story'); h.app.destroy();
  }
});

test('phone controls are reachable inward from screen edges, clear system gesture strip, and support simultaneous movement/jump/swing', () => {
  for (const [width, height] of [[667, 375], [844, 390], [932, 430]]) {
    const h = loadGame({ width, height }); h.app.startAI('normal'); h.frames();
    const u = h.app.ui, get = id => u.controls.find(b => b.id === id);
    const left = get('left'), right = get('right'), jump = get('jump'), clear = get('clear');
    assert.ok(u.originX + (left.x - left.r) * u.scale >= 70, 'pad no longer hugs the device edge');
    assert.ok(height - (u.originY + (left.y + left.r) * u.scale) >= 35, 'pad stays above home gesture edge');
    assert.ok(width - (u.originX + (jump.x + jump.r) * u.scale) >= 50, 'right-hand controls also inset');
    assert.ok(left.r * u.scale >= 35, 'keep large finger target');
    h.touch('Start', [[1, right.x, right.y], [2, jump.x, jump.y], [3, clear.x, clear.y]]);
    assert.equal(h.app.ctrlFor[0].move(), 1);
    assert.deepEqual([...h.app.ctrlFor[0].drain()], ['jump', 'clear']);
    h.touch('Move', [[1, left.x, left.y]]); assert.equal(h.app.ctrlFor[0].move(), -1);
    h.resize(height, width); assert.equal(h.app.ctrlFor[0].move(), 0);
    h.resize(width, height); h.frames();
    assert.ok(Math.abs(h.app.ui.originX + h.app.ui.W * h.app.ui.scale / 2 - width / 2) < .01);
    h.app.destroy();
  }
});
