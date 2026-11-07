'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const YY = require('../js/core'); require('../js/roster'); require('../js/match'); require('../js/ai'); require('../js/char');
const C = YY.C;
function seeded(fn) {
  const random = Math.random; let seed = 116;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + .5) / 4294967296; };
  try { return fn(); } finally { Math.random = random; }
}
function flight(dt, initial, env, time = 1) {
  const s = { netHit: true, ...initial };
  for (let t = 0; t < time - 1e-10; t += dt) YY.stepShuttle(s, Math.min(dt, time - t), env);
  return s;
}
function rally(side = -1, x = 1.98, y = 1.42, speed = 55, vy = 0) {
  const m = new YY.Match(); m.phase = 'rally'; m.events = [];
  const p = m.players[side < 0 ? 0 : 1]; p.x = side * 3;
  Object.assign(m.shuttle, { x: side * x, y, vx: side * speed, vy, speed: Math.hypot(speed, vy), live: true, held: false, lastHitter: 1 - p.idx, crossedNet: true });
  p.swing = { t: .1, btn: 'clear', kind: 'side', dur: C.SW_DUR, hit: false, prevE: 99 };
  return { m, p };
}

test('vacuum trajectory agrees with analytic ballistics; real drag converges and 30/60/120Hz callers agree', () => {
  const initial = { x: -2, y: 20, vx: 20, vy: 9 };
  for (const dt of [1 / 30, 1 / 60, C.DT, C.DT / 2]) {
    const s = flight(dt, initial, { drag: 0 });
    assert.ok(Math.abs(s.x - 18) < 1e-8); assert.ok(Math.abs(s.y - (29 - C.G / 2)) < 1e-8);
    assert.ok(Math.abs(s.vy - (9 - C.G)) < 1e-8);
  }
  for (const env of [null, { wind: 2.5 }, { drag: .066, wind: -1.6 }]) {
    const reference = flight(1 / 1920, initial, env), normal = flight(C.DT, initial, env);
    assert.ok(Math.hypot(normal.x - reference.x, normal.y - reference.y) < .003);
    for (const dt of [1 / 30, 1 / 60]) {
      const grouped = flight(dt, initial, env);
      assert.ok(Math.hypot(grouped.x - normal.x, grouped.y - normal.y) < 1e-8);
    }
  }
});

test('drag does not reverse a fast shuttle, mirror/wind symmetry holds, and terminal descent stays finite', () => {
  const fast = flight(.05, { x: 3, y: 20, vx: 5000, vy: 0 }, null, .2);
  assert.ok(fast.vx > 0 && Number.isFinite(fast.x));
  const a = flight(C.DT, { x: -3, y: 20, vx: 27, vy: 12 }, { wind: 1.8 });
  const b = flight(C.DT, { x: 3, y: 20, vx: -27, vy: 12 }, { wind: -1.8 });
  assert.ok(Math.abs(a.x + b.x) < 1e-10 && Math.abs(a.y - b.y) < 1e-10);
  const drop = flight(C.DT, { x: 2, y: 300, vx: 0, vy: 0 }, null, 10);
  assert.ok(Math.abs(drop.vy + Math.sqrt(C.G / C.DRAG)) < .01);
});

test('floor contact is at cork radius and near-line score does not overshoot with frame size', () => {
  for (const side of [-1, 1]) for (const dt of [C.DT, C.DT / 2, 1 / 30]) {
    const s = { x: side * 6.7, y: .075, vx: side * 10, vy: -4, netHit: true };
    assert.equal(YY.stepShuttle(s, dt), 'floor');
    assert.equal(s.y, C.SHUTTLE_R); assert.ok(Math.abs(s.x) > 6.72 && Math.abs(s.x) < 6.73);
    const m = new YY.Match(); Object.assign(m.shuttle, s, { live: true, netHit: false, lastHitter: side < 0 ? 1 : 0, shot: 'clear' });
    m.onLand(s.x); assert.equal(m.score[m.shuttle.lastHitter], 1); assert.equal(m.shuttle.speed, 0);
  }
});

test('a net fault stays a fault even if wind later moves the stopped shuttle across the net', () => {
  for (const hitter of [0, 1]) {
    const m = new YY.Match(); Object.assign(m.shuttle, { live: true, lastHitter: hitter, netHit: true, shot: 'drop', isServe: false });
    m.onLand(hitter === 0 ? .15 : -.15);
    assert.equal(m.score[1 - hitter], 1); assert.equal(m.events.at(-1).reason, '下网');
  }
});

test('speed/angle solvers hit requested distances with consistent wind and altitude predictions', () => {
  for (const env of [null, { drag: .066, wind: 1.6 }]) for (const side of [-1, 1]) {
    for (const angle of [26, 50, 66]) for (const distance of [3, 7, 10]) {
      const x = side * 3, dir = -side, rad = angle * Math.PI / 180;
      const speed = YY.solveSpeed(x, 1.8, dir, angle, distance, env);
      const result = YY.simulate(x, 1.8, Math.cos(rad) * speed * dir, Math.sin(rad) * speed, 6, false, true, env);
      assert.ok(Math.abs((result.landX - x) * dir - distance) < .001);
    }
    const x = side * 3, dir = -side, angle = YY.solveAngle(x, 3, dir, 22, 7, -45, 8, env) * Math.PI / 180;
    assert.ok(Math.abs((YY.simulate(x, 3, Math.cos(angle) * 22 * dir, Math.sin(angle) * 22, 6, false, true, env).landX - x) * dir - 7) < .001);
  }
  assert.ok(Math.abs(YY.simulate(2, 20, 0, 1, .103, true, true).t - .103) < 1e-10);
});

test('a fast incoming shuttle crossing the sweet region within a tick is hit once, equally on both sides', () => seeded(() => {
  for (const side of [-1, 1]) {
    const { m, p } = rally(side); m.step(C.DT);
    assert.equal(m.hitCount, 1); assert.equal(m.shuttle.lastHitter, p.idx);
    assert.equal(m.events.filter(e => e.type === 'hit').length, 1);
    const hit = m.events.find(e => e.type === 'hit'); assert.ok(hit.q > .94);
    assert.ok(Math.abs(hit.x) > 2.1 && Math.abs(hit.x) < 2.2);
    assert.ok(p.swing.contact.t >= C.SW_W0 && p.swing.contact.t <= C.SW_W1);
    m.checkContact(m.players[1 - p.idx], C.DT); assert.equal(m.hitCount, 1);
  }
}));

test('swept contact respects the active window, net ownership, expired swings and floor ordering', () => seeded(() => {
  for (const start of [0, C.SW_W1 + .01]) {
    const { m } = rally(); m.players[0].swing.t = start; m.step(C.DT); assert.equal(m.hitCount, 0);
  }
  const own = rally(); own.m.shuttle.crossedNet = false; own.m.step(C.DT); assert.equal(own.m.hitCount, 0);
  const net = rally(); net.m.shuttle.netHit = true; net.m.step(C.DT); assert.equal(net.m.hitCount, 0);
  const lateWindow = rally(); lateWindow.p.swing.t = C.SW_W1 - C.DT / 2; lateWindow.m.step(C.DT);
  assert.equal(lateWindow.m.hitCount, 1); assert.ok(lateWindow.p.swing.contact.t <= C.SW_W1);
  const low = rally(-1, 2.8, .11, 5, -15); low.m.step(C.DT);
  assert.equal(low.m.hitCount, 1); assert.equal(low.m.phase, 'rally'); assert.ok(low.p.swing.contact.y > C.SHUTTLE_R);
  const grounded = rally(-1, 2.8, C.SHUTTLE_R, 5, -15); grounded.m.step(C.DT);
  assert.equal(grounded.m.hitCount, 0); assert.equal(grounded.m.phase, 'point');
}));

test('a late press is buffered exactly once, an early press expires, and point reset clears pending shots', () => {
  const m = new YY.Match(); m.phase = 'rally'; m.shuttle.live = false;
  const p = m.players[0]; p.swing = { t: .28, dur: .3, hit: true };
  m.inputs[0].presses.push({ btn: 'drop' });
  for (let i = 0; i < 50; i++) m.step(C.DT);
  assert.equal(m.events.filter(e => e.type === 'swing').length, 1);
  m.events = []; p.swing = { t: .05, dur: .3, hit: true }; m.inputs[0].presses.push({ btn: 'smash' });
  for (let i = 0; i < 60; i++) m.step(C.DT);
  assert.equal(m.events.filter(e => e.type === 'swing').length, 0);
  p.bufferedShot = 'smash'; p.bufferT = C.SW_BUFFER; m.resetPoint();
  assert.equal(p.bufferedShot, null); assert.equal(p.bufferT, 0);
  m.phase = 'rally'; m.handlePress(p, { btn: 'invalid' }); assert.equal(p.swing, null);
});

test('near-net attacks cannot create negative stamina; sufficient stamina still allows kills', () => seeded(() => {
  for (const stamina of [0, 4, 8.4, 100]) {
    const { m, p } = rally(-1, .5, 1.9, 5); p.x = -1; p.stamina = stamina;
    p.swing.btn = 'smash'; m.doHit(p, p.swing, 0, C.REACH);
    assert.ok(p.stamina >= 0 && p.stamina <= 100);
    assert.equal(m.shuttle.shot === 'kill', stamina >= C.SMASH_COST * .35);
  }
}));

test('jump trajectory matches the height used by contact planning; tired/affected players get realistic jump hints', () => {
  for (const dt of [C.DT, C.DT / 2]) {
    const m = new YY.Match(); m.phase = 'rally'; const p = m.players[0]; m.handlePress(p, { btn: 'jump' });
    const v = p.vy, duration = .4;
    for (let t = 0; t < duration - 1e-10; t += dt) m.updatePlayer(p, dt);
    assert.ok(Math.abs(p.y - (v * duration - C.G * duration ** 2 / 2)) < 1e-9);
  }
  const { m, p } = rally(); p.stamina = 0;
  assert.equal(m.jumpVelocity(p), C.JUMP_V_LOW);
  p.buff.prone = 1; const vy0 = p.vy; m.handlePress(p, { btn: 'jump' }); // 趴地恢复时不能起跳
  assert.equal(p.vy, vy0); assert.equal(p.onGround, true);
  const hint = YY.findContact(m, p.idx, ['smash', 'over', 'low']); assert.notEqual(hint?.band, 'smash');
  for (const handling of [.75, 1, 1.25]) {
    p.st.handling = handling; m.beginSwing(p, 'clear');
    p.swing.t = p.swing.dur;
    assert.ok(Math.abs(YY.swingAngle(p, 0) - 45) < 1e-9, 'side swing returns to its final pose for every handling speed');
  }
});
