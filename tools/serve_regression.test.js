// 发球 / 球网 / 接球回归：node --test tools/serve_regression.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const YY = require('../js/core.js');
require('../js/match.js');
require('../js/ai.js');
require('../js/practice.js');
global.window = globalThis;
global.location = { search: '' };
require('../js/net.js');
require('../js/render.js');
const C = YY.C;

function incoming(server, x, y, vx, vy = 0) {
  const m = new YY.Match({ firstServer: server });
  const p = m.players[1 - server];
  p.x = p.side * C.X_NEAR;
  m.phase = 'rally';
  m.events = [];
  Object.assign(m.shuttle, {
    x: p.side * x, y, vx: p.side * vx, vy, speed: Math.hypot(vx, vy),
    live: true, held: false, lastHitter: server, shot: 'sserve', isServe: true,
  });
  return m;
}

function swing(m, idx) {
  const p = m.players[idx];
  // 选择窗口末端，使任何可触及的合法来球都一定会触发接触。
  p.swing = {
    t: C.SW_W1 - C.DT / 2, hit: false, serve: false,
    judged: false, prevE: 99, btn: 'clear', dur: C.SW_DUR,
  };
  m.checkContact(p, C.DT);
}

for (const server of [0, 1]) {
  const receiver = 1 - server;
  const label = server === 0 ? '左发右接' : '右发左接';

  test(`${label}：不能隔网接到尚未过网的球，包括高于网带的球`, () => {
    for (const y of [1.15, 1.9]) {
      const m = incoming(server, -0.2, y, 5);
      assert.ok(m.ringError(m.players[receiver], m.shuttle) < C.REACH);
      swing(m, receiver);
      assert.equal(m.shuttle.lastHitter, server);
      assert.equal(m.hitCount, 0);
    }
  });

  test(`${label}：撞网后不能被接回或清除失误，最终正确计分`, () => {
    const m = incoming(server, -0.08, 1.15, 5);
    m.step(C.DT);
    assert.equal(m.shuttle.netHit, true);
    assert.equal(m.shuttle.crossedNet, false);
    assert.equal(m.events.filter(e => e.type === 'net').length, 1);
    assert.equal(YY.findContact(m, receiver, ['low']), null);
    for (let i = 0; i < 240 && m.shuttle.live; i++) {
      swing(m, receiver);
      m.step(C.DT);
    }
    assert.equal(m.phase, 'point');
    assert.equal(m.shuttle.lastHitter, server);
    assert.equal(m.shuttle.netHit, true);
    assert.equal(m.score[receiver], 1);
    assert.equal(m.stats[server].errors, 1);
    assert.equal(m.events.filter(e => e.type === 'hit').length, 0);
    assert.equal(m.events.find(e => e.type === 'point').reason, '发球失误 · 下网');
  });

  test(`${label}：球头擦到网带也不能穿过，低平快球不能跳过碰撞`, () => {
    for (const y of [1.0, C.NET_H + C.SHUTTLE_R / 2]) {
      for (const vx of [8, 55]) {
        const m = incoming(server, -0.12, y, vx);
        for (let i = 0; i < 8 && !m.shuttle.netHit; i++) m.step(C.DT);
        assert.equal(m.shuttle.netHit, true);
        assert.ok(m.players[receiver].side * m.shuttle.x < 0);
        swing(m, receiver);
        assert.equal(m.shuttle.lastHitter, server);
      }
    }
  });

  test(`${label}：真实过网的贴网球仍可回击，下一拍必须重新过网`, () => {
    const m = incoming(server, -0.15, C.NET_CLEAR + 0.12, 5);
    while (m.players[receiver].side * m.shuttle.x <= 0.12) m.step(C.DT);
    assert.equal(m.shuttle.netHit, false);
    assert.equal(m.shuttle.crossedNet, true);
    assert.ok(m.ringError(m.players[receiver], m.shuttle) < C.REACH);
    swing(m, receiver);
    assert.equal(m.shuttle.lastHitter, receiver);
    assert.equal(m.hitCount, 1);
    assert.equal(m.shuttle.crossedNet, false);
    m.players[server].x = m.players[server].side * C.X_NEAR;
    swing(m, server);
    assert.equal(m.hitCount, 1, '不能在同一个物理步内隔网连击');
  });

  test(`${label}：过网后低于网高的来球仍可合法接起`, () => {
    const m = incoming(server, 0.35, 1.15, 4, -2);
    m.shuttle.crossedNet = true;
    m.players[receiver].x = m.players[receiver].side * 1.15;
    swing(m, receiver);
    assert.equal(m.shuttle.lastHitter, receiver);
  });

  test(`${label}：球头未完全进入接球方半场时不能抢击`, () => {
    const m = incoming(server, C.SHUTTLE_R / 2, 1.9, 5);
    m.shuttle.crossedNet = true;
    swing(m, receiver);
    assert.equal(m.shuttle.lastHitter, server);
  });

  test(`${label}：球头中心刚过网但下缘擦网时，仍退回发球侧`, () => {
    const m = incoming(server, 0.02, C.NET_CLEAR + 0.005, 1, -2);
    m.step(C.DT);
    assert.equal(m.shuttle.netHit, true);
    assert.equal(m.shuttle.crossedNet, false);
    assert.ok(m.players[server].side * m.shuttle.x > 0);
    while (m.shuttle.live) m.step(C.DT);
    assert.equal(m.score[receiver], 1);
  });

  test(`${label}：贴近网带顶角但球头未接触的上升球不能误判撞网`, () => {
    const m = incoming(server, -0.08, C.NET_H + 0.04, 3, 3);
    while (m.players[receiver].side * m.shuttle.x <= 0.1) {
      m.step(C.DT);
      assert.equal(m.shuttle.netHit, false);
    }
    assert.equal(m.shuttle.crossedNet, true);
  });
}

test('确定性发球矩阵：双方、高远/网前、不同质量，预测与实际飞行及得分一致', () => {
  const random = Math.random;
  let seed = 20261103;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
  const outcomes = { net: 0, clear: 0 };
  try {
    for (const server of [0, 1]) for (const btn of ['clear', 'drop']) {
      for (const q of [0, 0.15, 0.45, 0.75, 1]) for (let sample = 0; sample < 8; sample++) {
        const m = new YY.Match({ firstServer: server });
        m.startServe(m.players[server], btn, q);
        while (m.phase === 'serve') m.step(C.DT);
        const prediction = m.pred;
        assert.equal(m.shuttle.crossedNet, false);
        for (let step = 0; step < 1200 && m.shuttle.live; step++) {
          const s = m.shuttle, oldX = s.x, oldY = s.y;
          m.step(C.DT);
          if (oldX * s.x < 0 && !s.netHit) {
            const f = oldX / (oldX - s.x);
            assert.ok(oldY + (s.y - oldY) * f > C.NET_CLEAR);
            assert.equal(s.netHit, false);
          }
          if (s.netHit) assert.ok(m.players[server].side * s.x > 0, '撞网球必须留在发球侧');
        }
        assert.equal(m.phase, 'point');
        assert.equal(m.shuttle.netHit, prediction.netHit);
        assert.ok(Math.abs(m.shuttle.x - prediction.landX) < 1e-9);
        if (q === 1) assert.equal(m.shuttle.netHit, false, '满质量发球应安全过网');
        assert.equal(m.score[0] + m.score[1], 1);
        outcomes[m.shuttle.netHit ? 'net' : 'clear']++;
      }
    }
  } finally { Math.random = random; }
  assert.ok(outcomes.net > 0 && outcomes.clear > 0, '必须覆盖失败与成功发球');
});

function guestBetween(a, b) {
  const v = new YY.GuestView();
  v.push(a); v.push(b); v.clockOff = 0;
  v.update((a.ht + b.ht) / 2 + 0.05);
  return v;
}

test('联机发球：蓄力阶段不提前放球，声音和击球特效随显示帧触发且只触发一次', () => {
  const m = new YY.Match({});
  m.startServe(m.players[0], 'drop', 1);
  m.time = 1;
  const a = YY.snapshot(m, []);
  m.time = 1.02; m.launchServe();
  const hit = m.events.find(e => e.type === 'hit');
  const b = YY.snapshot(m, [hit]);
  const v = guestBetween(a, b);
  assert.equal(v.phase, 'serve');
  assert.equal(v.shuttle.held, true);
  assert.equal(v.shuttle.x, a.s[0]);
  assert.equal(v.players[0].swing.contact, null);
  assert.equal(v.events.length, 0);
  v.update(1.08);
  assert.equal(v.phase, 'rally');
  assert.equal(v.shuttle.held, false);
  assert.equal(v.shuttle.vx, b.s[2]);
  assert.ok(v.players[0].swing.contact);
  assert.deepEqual(v.events.splice(0), [hit]);
  v.update(1.09);
  assert.equal(v.events.length, 0);
});

test('联机接球：不能把击球前的位置与击球后的速度、球拍和击球方拼在一起', () => {
  const m = incoming(0, 0.35, 1.15, 4, -2);
  m.shuttle.crossedNet = true;
  m.players[1].x = 1.15;
  m.time = 2;
  const a = YY.snapshot(m, []);
  swing(m, 1);
  m.shuttle.x -= 0.08; m.time = 2.02;
  const b = YY.snapshot(m, m.events.slice());
  const v = guestBetween(a, b);
  assert.equal(v.shuttle.lastHitter, 0);
  assert.equal(v.shuttle.x, a.s[0]);
  assert.equal(v.shuttle.vx, a.s[2]);
  assert.equal(v.players[1].swing, null);
  assert.equal(v.events.length, 0);
  v.update(2.08);
  assert.equal(v.shuttle.lastHitter, 1);
  assert.equal(v.shuttle.x, b.s[0]);
  assert.equal(v.events[0].type, 'hit');
});

test('联机撞网和下一分重置：不跨越碰撞/传送插值，也不提前播放事件', () => {
  const m = incoming(0, -0.08, 1.15, 5);
  m.time = 3;
  const a = YY.snapshot(m, []);
  m.step(C.DT); m.time = 3.02;
  const b = YY.snapshot(m, m.events.slice());
  const v = guestBetween(a, b);
  assert.equal(v.shuttle.netHit, false);
  assert.equal(v.shuttle.x, a.s[0]);
  assert.equal(v.events.length, 0);
  v.update(3.08);
  assert.equal(v.shuttle.netHit, true);
  assert.equal(v.shuttle.x, b.s[0]);
  assert.equal(v.events[0].type, 'net');
  m.phase = 'point'; m.shuttle.live = false; m.time = 4;
  const c = YY.snapshot(m, []);
  m.resetPoint(); m.time = 4.02;
  const d = YY.snapshot(m, []);
  assert.ok(Math.abs(c.s[0] - d.s[0]) < 3, '覆盖旧版三米距离阈值漏掉的重置');
  const reset = guestBetween(c, d);
  assert.equal(reset.phase, 'point');
  assert.equal(reset.shuttle.x, c.s[0]);
  assert.equal(reset.players[1].x, c.p[1][0]);
  reset.update(4.08);
  assert.equal(reset.phase, 'serve');
  assert.equal(reset.shuttle.x, d.s[0]);
});

test('同一次飞行仍平滑插值，已结束的挥拍不残留', () => {
  const m = incoming(0, -1, 2, 5);
  m.time = 5;
  m.players[1].swing = { t: 0.29, kind: 'side', dur: 0.3 };
  const a = YY.snapshot(m, []);
  m.shuttle.x = -0.9; m.players[1].swing = null; m.time = 5.02;
  const b = YY.snapshot(m, []);
  const v = guestBetween(a, b);
  assert.ok(Math.abs(v.shuttle.x + 0.95) < 1e-9);
  v.update(5.08);
  assert.equal(v.players[1].swing, null);
});

// 用 Canvas 的仿射变换记录最终拍面像素中心，覆盖身体倾斜、起跳及镜像视角。
function racketRecorder() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [], faces = [];
  const ctx = new Proxy({
    faces,
    save() { stack.push(m.slice()); },
    restore() { m = stack.pop(); },
    translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
    rotate(a) {
      const [aa, b, c, d] = m, ca = Math.cos(a), sa = Math.sin(a);
      m[0] = aa * ca + c * sa; m[1] = b * ca + d * sa;
      m[2] = c * ca - aa * sa; m[3] = d * ca - b * sa;
    },
    createLinearGradient() { return { addColorStop() {} }; },
    ellipse(x, y) {
      if (YY.LOOKS.some(look => look.racket === ctx.strokeStyle)) {
        faces.push([m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      }
    },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  return ctx;
}

test('发球和回球的真实接触点就是拍面像素中心，左右/镜像/跑动/跳跃一致', () => {
  for (const server of [0, 1]) for (const mirror of [false, true]) for (const serve of [false, true]) {
    const m = incoming(server, 0.5, 2.4, 5);
    const p = m.players[serve ? server : 1 - server];
    if (serve) {
      m.startServe(p, 'drop', 1); m.launchServe();
    } else {
      p.x = p.side * 1; p.y = 0.7; p.onGround = false; p.vx = 3;
      p.swing = { t: C.SW_SWEET, btn: 'clear', kind: 'over', dur: C.SW_DUR };
      m.doHit(p, p.swing, 0.05, C.REACH);
    }
    const r = Object.create(YY.Renderer.prototype);
    Object.assign(r, { sc: 60, cx: 500, gy: 500, shx: 2, shy: -3, mirror, time: 0 });
    const ctx = racketRecorder();
    r.drawPlayer(ctx, p, YY.LOOKS[p.idx]);
    const face = ctx.faces.at(-1);
    assert.ok(face);
    assert.ok(Math.abs(face[0] - r.sx(m.shuttle.x)) < 1e-9);
    assert.ok(Math.abs(face[1] - r.sy(m.shuttle.y)) < 1e-9);
  }
});

test('桌面/手机/镜像画面：网带上沿与物理网高重合，球头大小使用碰撞半径', () => {
  for (const sc of [34, 74]) for (const mirror of [false, true]) {
    const r = Object.create(YY.Renderer.prototype);
    Object.assign(r, { sc, cx: 400, gy: 300, ox: sc * 0.1, oy: sc * 0.085, shx: 2, shy: -3, mirror, time: 0.03, netWob: 1 });
    let path, tape, radius;
    const ctx = new Proxy({
      beginPath() { path = []; },
      moveTo(x, y) { path.push([x, y]); },
      lineTo(x, y) { path.push([x, y]); },
      fill() { if (ctx.fillStyle === '#ffffff') tape = path; },
      arc(x, y, r) { if (ctx.fillStyle === '#f7e9cf') radius = r; },
    }, { get(target, key) { return key in target ? target[key] : () => {}; } });
    r.drawNet(ctx);
    assert.equal(tape.length, 4);
    assert.ok(Math.abs((tape[0][0] + tape[1][0]) / 2 - r.sx(0)) < 1e-9);
    assert.ok(Math.abs((tape[0][1] + tape[1][1]) / 2 - r.sy(C.NET_H)) < 1e-9);
    r.drawShuttle(ctx, { x: 0, y: 2, live: true, vx: 1, vy: 0 });
    assert.ok(Math.abs(radius - C.SHUTTLE_R * sc) < 1e-9);
  }
});
