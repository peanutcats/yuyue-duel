'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createClock = require('../minigame/src/clock');
const Network = require('../minigame/src/network');
const { loadGame } = require('./wechat-test-harness');

function clockFixture(scale, offset = 928145) {
  let elapsed = 0, wallOffset = 1700000000000, rawOffset = offset, broken = false;
  const wx = { getPerformance: () => ({ now() { if (broken) throw Error('clock unavailable'); return rawOffset + elapsed * scale; } }) };
  const clock = createClock(wx, () => Math.floor(wallOffset + elapsed));
  return { clock, wx, advance(ms) { elapsed += ms; return clock.now(); }, changeWall(ms) { wallOffset += ms; }, restartRaw() { rawOffset = -elapsed * scale; }, breakRaw() { broken = true; } };
}

for (const scale of [1, 1000]) {
  const label = scale === 1 ? 'IDE milliseconds' : 'device microseconds';
  test(label + ': calibrated clock advances one second per real second without an origin jump', () => {
    const h = clockFixture(scale, 887766554433);
    assert.equal(h.clock.now(), 0);
    assert.equal(h.advance(4), 4); assert.equal(h.advance(4), 8);
    assert.equal(h.advance(8), 16);
    assert.equal(h.clock.info().rawUnit, scale === 1 ? 'milliseconds' : 'microseconds');
    assert.equal(h.advance(984), 1000);
    h.changeWall(-60000); assert.equal(h.advance(100), 1100);
    h.changeWall(120000); assert.equal(h.advance(100), 1200);
    h.restartRaw(); const resumed = h.advance(20); assert.equal(resumed, 1220);
    assert.equal(h.advance(1000), 2220);
    h.breakRaw(); assert.equal(h.advance(20), 2240);
    assert.equal(h.clock.info().source, 'Date.now');
  });

  for (const fps of [30, 60, 90, 120]) test(`${label} at ${fps} fps: 1 real second means 120 physics ticks, not ${fps * 6}`, () => {
    const h = loadGame({ performanceScale: scale });
    try {
      h.app.startLocal(); const start = h.app.match.time, ticks = h.app.tickN;
      h.frames(fps, 1000 / fps);
      assert.ok(Math.abs(h.app.match.time - start - 1) <= h.YY.C.DT + .001);
      assert.ok(Math.abs(h.app.tickN - ticks - 120) <= 1);
      assert.ok(Math.abs(h.app.rawDt - 1 / fps) < .002);
    } finally { h.app.destroy(); }
  });

  test(label + ': movement, jump, swing and shuttle match shared 120Hz physics in real time', () => {
    const h = loadGame({ performanceScale: scale });
    try {
      h.app.startLocal(); const m = h.app.match;
      m.phase = 'rally'; m.players[0].x = -5;
      Object.assign(m.shuttle, { x: 4, y: 5, vx: -10, vy: 0, live: true, held: false, lastHitter: 1 });
      const reference = new h.YY.Match(); reference.phase = 'rally'; reference.players[0].x = -5;
      Object.assign(reference.shuttle, m.shuttle);
      const c = h.app.ctrlFor[0]; c.touchDir = 1; c.push('jump'); c.push('clear');
      reference.inputs[0].move = 1; reference.inputs[0].presses.push({ btn: 'jump' }, { btn: 'clear' });
      h.frames(12, 1000 / 60); // 0.2 seconds of real elapsed time.
      for (let i = 0; i < 24; i++) reference.step(h.YY.C.DT);
      assert.ok(Math.abs(m.time - .2) < .01);
      assert.ok(Math.abs(m.players[0].x - reference.players[0].x) < .05, 'movement accelerated');
      assert.ok(Math.abs(m.players[0].y - reference.players[0].y) < .05, 'jump accelerated');
      assert.ok(m.players[0].swing, 'swing ended before its 0.3-second duration');
      assert.ok(Math.abs(m.players[0].swing.t - reference.players[0].swing.t) < .01);
      assert.ok(Math.abs(m.shuttle.x - reference.shuttle.x) < .1, 'shuttle accelerated');
      assert.ok(Math.abs(m.shuttle.y - reference.shuttle.y) < .05);
    } finally { h.app.destroy(); }
  });

  test(label + ': delayed feedback and background resume use real time without fast-forward', () => {
    const h = loadGame({ performanceScale: scale });
    try {
      h.app.startLocal(); let fired = false; h.app.defer(() => { fired = true; }, 900);
      h.frames(30); assert.equal(fired, false);
      const before = h.app.match.time; h.events.Hide(); h.frames(); h.advance(30000);
      h.events.Show({ query: {} }); h.frames(); assert.equal(h.app.match.time, before);
      h.click('resume'); h.frames(18); assert.equal(fired, false);
      h.frames(8); assert.equal(fired, true);
      assert.ok(h.app.match.time - before < .6);
    } finally { h.app.destroy(); }
  });

  test(label + ': network ping/retry thresholds are milliseconds, not raw wx units', () => {
    const f = clockFixture(scale), handlers = {}, sent = [];
    const socket = { onOpen: fn => handlers.open = fn, onMessage: fn => handlers.message = fn, onClose() {}, onError() {}, close() {}, send({ data, success }) { sent.push(JSON.parse(data)); success?.(); } };
    f.wx.connectSocket = () => socket;
    const net = new Network({ wx: f.wx, now: f.clock.now, hidden: () => false }, { serverUrl: 'wss://badminton.example/ws' });
    net.manual = false; net.request = { t: 'create' }; net.open(); handlers.open();
    handlers.message({ data: JSON.stringify({ t: 'welcome', room: 'ABCD', token: 'seat', seq: 0, action: 0, player: 0 }) });
    f.advance(20); handlers.message({ data: JSON.stringify({ t: 'pong', ts: 0, nt: 50 }) });
    assert.ok(Math.abs(net.rtt - .056) < 1e-8);
    for (let i = 0; i < 29; i++) { f.advance(1000 / 60); net.update(); }
    assert.equal(sent.filter(d => d.t === 'ping').length, 1);
    assert.equal(net.status, 'connected');
    f.advance(500); net.update(); assert.equal(sent.filter(d => d.t === 'ping').length, 2);
    net.disconnected(); f.advance(100); net.update(); assert.equal(net.socket, null);
    f.advance(650); net.update(); assert.equal(net.socket, socket); net.close();
  });
}

test('missing, throwing or unknown-unit clocks safely use millisecond wall time', () => {
  for (const wx of [{}, { getPerformance() { throw Error('unsupported'); } }, { getPerformance: () => ({ now: () => NaN }) }, { getPerformance: () => ({ now: () => 7 }) }]) {
    let wall = 100; const clock = createClock(wx, () => wall);
    wall += 200; assert.equal(clock.now(), 200);
    wall -= 1000; assert.equal(clock.now(), 200);
    wall += 20; assert.equal(clock.now(), 220);
  }
});

test('memory-pressure fallback clears portrait caches without breaking the next frame', () => {
  const h = loadGame({ performanceScale: 1000 });
  try { h.app.show('team'); h.frames(); h.events.MemoryWarning({}); h.frames(); assert.equal(h.app.R.quality, 0); }
  finally { h.app.destroy(); }
});
