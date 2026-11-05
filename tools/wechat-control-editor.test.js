'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadGame } = require('./wechat-test-harness');
const Layout = require('../minigame/src/control-layout');
function editor(h) { h.app.show('settings'); h.frames(); h.click('layout-settings'); assert.equal(h.app.screen, 'controlEditor'); }
function group(h, id) { return h.app.ui.editor.groups.find(g => g.id === id); }
function drag(h, id, x, y, end = 'End') {
  const g = group(h, id); h.touch('Start', [[77, g.x, g.y]]); h.touch('Move', [[77, x, y]]); h.frames(); h.touch(end, [[77, x, y]]); h.frames();
}
function positions(h) { return h.app.ui.editor.groups.map(g => [g.id, g.x, g.y]); }

test('dragging movement and actions saves a local layout, reloads it, and moves the real hit targets with the graphics', () => {
  const h = loadGame(), u = h.app.ui; editor(h);
  const old = { ...group(h, 'move') }, x = 300, y = u.H - 82;
  drag(h, 'move', x, y); drag(h, 'clear', u.W / 2 + 45, u.H - 70);
  assert.equal(group(h, 'move').x, x);
  h.click('layout-save'); assert.equal(h.app.screen, 'settings');
  assert.ok(h.storage.has(Layout.KEY)); assert.equal(h.storage.has('yuyue.profile'), false);
  h.app.destroy();
  const next = loadGame({ storage: h.storage }); next.app.startAI('normal'); next.frames();
  const c = next.app.ui.controls, right = c.find(b => b.id === 'right'), clear = c.find(b => b.id === 'clear');
  assert.ok(Math.abs(right.pad.cx - x) < .01); assert.ok(Math.abs(right.y - y) < .01);
  assert.equal(next.app.input.hit(old.x - old.off, old.y), null, 'old pad location must not remain active');
  const jump = c.find(b => b.id === 'jump');
  next.touch('Start', [[1, right.x, right.y], [2, clear.x, clear.y], [3, jump.x, jump.y]]);
  assert.equal(next.app.ctrlFor[0].move(), 1); assert.deepEqual([...next.app.ctrlFor[0].drain()], ['clear', 'jump']);
  next.touch('Cancel', [[1, right.x, right.y], [2, clear.x, clear.y], [3, jump.x, jump.y]]);
  assert.equal(next.app.ctrlFor[0].move(), 0); next.app.destroy();
});

test('overlap is rejected, offscreen drags clamp safely, and swapped action positions survive reload', () => {
  const h = loadGame(); editor(h);
  const clear = { ...group(h, 'clear') }, drop = { ...group(h, 'drop') };
  drag(h, 'clear', drop.x, drop.y);
  assert.equal(group(h, 'clear').x, clear.x); assert.equal(group(h, 'clear').y, clear.y);
  drag(h, 'move', -100, -500);
  const moved = group(h, 'move'); assert.ok(moved.x - moved.off - moved.r >= 8); assert.ok(moved.y - moved.r >= 90);
  drag(h, 'clear', h.app.ui.W / 2, h.app.ui.H - 70);
  drag(h, 'drop', clear.x, clear.y); drag(h, 'clear', drop.x, drop.y);
  assert.ok(Math.abs(group(h, 'drop').x - clear.x) < .01);
  h.click('layout-save'); h.app.destroy();
  const next = loadGame({ storage: h.storage }); next.app.startAI('normal');
  const c = next.app.ui.controls.find(b => b.id === 'clear'), d = next.app.ui.controls.find(b => b.id === 'drop');
  assert.ok(Math.abs(c.x - drop.x) < .01 && Math.abs(c.y - drop.y) < .01);
  assert.ok(Math.abs(d.x - clear.x) < .01 && Math.abs(d.y - clear.y) < .01); next.app.destroy();
});

test('cancel/back, touch cancellation, backgrounding and resize never save a partial drag or fire a gameplay action', () => {
  const h = loadGame(); h.app.startAI('normal'); h.app.togglePause(); h.frames(); h.click('layout-pause');
  const time = h.app.match.time, before = positions(h);
  drag(h, 'move', 300, h.app.ui.H - 82, 'Cancel'); assert.deepEqual(positions(h), before);
  const g = group(h, 'move');
  h.touch('Start', [[77, g.x, g.y]]); h.touch('Move', [[77, 300, g.y]]); h.events.Hide();
  assert.equal(h.app.ui.editor.drag, null); assert.deepEqual(positions(h), before);
  h.events.Show({ query: {} }); h.frames(20); assert.equal(h.app.match.time, time);
  assert.equal(h.app.ctrlFor[0].queue.length, 0); assert.equal(h.app.ctrlFor[0].move(), 0);
  drag(h, 'move', 300, h.app.ui.H - 82); h.click('back');
  assert.equal(h.app.screen, 'pause'); assert.equal(h.app.paused, true); assert.equal(h.storage.has(Layout.KEY), false);
  h.click('layout-pause'); assert.deepEqual(positions(h), before);
  const p = group(h, 'jump'); h.touch('Start', [[78, p.x, p.y]]); h.touch('Move', [[78, 400, 220]]);
  h.resize(390, 844); h.resize(844, 390); h.frames(); assert.equal(h.app.ui.editor.drag, null);
  assert.deepEqual(positions(h), before); h.click('layout-save'); h.click('resume');
  assert.equal(h.app.paused, false); h.frames(2); assert.ok(h.app.match.time > time); h.app.destroy();
});

test('single-player/online and two-player layouts stay independent; restore-default only changes the selected layout after saving', () => {
  const h = loadGame(); editor(h); drag(h, 'move', 300, h.app.ui.H - 82);
  h.click('layout-duo'); const g = group(h, 'p1-move'), original = g.y;
  drag(h, 'p1-move', g.x, h.app.ui.H - 145); const movedY = group(h, 'p1-move').y;
  assert.notEqual(movedY, original); h.click('layout-save');
  const saved = JSON.parse(h.storage.get(Layout.KEY)); assert.ok(saved.solo.move && saved.duo['p1-move']);
  h.app.startLocal(); h.frames(); assert.ok(Math.abs(h.app.ui.controls.find(b => b.id === 'p1-left').y - movedY) < .01);
  h.app.togglePause(); h.frames(); h.click('layout-pause'); assert.equal(h.app.ui.editor.mode, 'duo');
  h.click('layout-reset'); h.click('back'); assert.ok(h.app.ui.savedControls.duo['p1-move']);
  h.click('layout-pause'); h.click('layout-reset'); h.click('layout-save');
  assert.equal(Object.keys(h.app.ui.savedControls.duo).length, 0); assert.ok(h.app.ui.savedControls.solo.move);
  assert.ok(Math.abs(h.app.ui.controls.find(b => b.id === 'p1-left').y - original) < .01); h.app.destroy();
});

test('invalid saved positions are ignored and resized layouts remain usable with large finger targets', () => {
  const bad = new Map([[Layout.KEY, JSON.stringify({ v: 1, solo: { jump: { x: 10, y: -2 }, clear: { x: null, y: 'wrong' }, arbitrary: { x: .5, y: .5 } }, duo: 'bad' })]]);
  const h = loadGame({ storage: bad }); editor(h);
  assert.equal(Object.keys(h.app.ui.savedControls.solo).length, 0);
  drag(h, 'move', 300, h.app.ui.H - 82); h.click('layout-save'); h.app.destroy();
  for (const [width, height] of [[667, 375], [932, 430], [1024, 768]]) {
    const next = loadGame({ width, height, safe: true, storage: bad }); next.app.startAI('normal'); next.frames();
    const u = next.app.ui, items = Layout.groups(u.controls);
    assert.equal(Layout.conflicts(items).size, 0);
    for (const g of items) {
      assert.ok(g.x - g.off - g.r >= 0 && g.x + g.off + g.r <= u.W);
      assert.ok(g.y - g.r >= 0 && g.y + g.r <= u.H); assert.ok(g.r * u.scale >= 23);
    }
    next.app.destroy();
  }
});

test('storage failure keeps the editor draft open and does not claim a saved layout', () => {
  const h = loadGame(); editor(h); drag(h, 'move', 300, h.app.ui.H - 82);
  h.wx.setStorageSync = () => { throw new Error('disk full'); };
  h.click('layout-save'); assert.equal(h.app.screen, 'controlEditor');
  assert.equal(Object.keys(h.app.ui.savedControls.solo).length, 0); assert.equal(h.storage.has(Layout.KEY), false);
  h.app.destroy();
});
