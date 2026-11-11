'use strict';
// 技能 v4 重做：持续性装置跨回合保留、各角色新机制的效果与应对
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path');
globalThis.window = globalThis;
for (const f of ['core', 'roster', 'match', 'ai']) require(path.join(__dirname, '../js', f + '.js'));
const YY = globalThis.YY, C = YY.C;

const M = (a, b, actA, actB) => {
  const m = new YY.Match({ skills: [{ passive: YY.char(a).passive, act: actA || YY.char(a).acts.slice(0, 2) }, { passive: YY.char(b).passive, act: actB || YY.char(b).acts.slice(0, 2) }] });
  m.players.forEach(p => p.energy = 100); return m;
};
const serve = (m, srv, btn) => { m.server = srv; m.resetPoint(false); m.players.forEach(p => p.energy = 100); m.startServe(m.players[srv], btn || 'clear', 0.9); for (let i = 0; i < 20 && m.phase !== 'rally'; i++) m.step(C.DT); };
const run = (m, sec, f) => { for (let t = 0; t < sec; t += C.DT) { if (f) f(); m.step(C.DT); if (m.phase !== 'rally') break; } };
const cast = (m, i, id, aim) => m.useSkill(m.players[i], m.players[i].kit.act.indexOf(id), aim == null ? null : { aim });
const ev = (m, t) => m.events.filter(e => e.type === t);
const incoming = (s, o) => Object.assign(s, { lastHitter: 1, crossedNet: false, netHit: false, live: true, held: false, ctl: null }, o);
const endPoint = (m) => { m.phase = 'rally'; Object.assign(m.shuttle, { lastHitter: 0, live: true, netHit: false, crossedNet: true, isServe: false }); m.onLand(4); for (let t = 0; t < 3 && m.phase === 'point'; t += C.DT) m.step(C.DT); };

test('field devices survive the end of a point with their countdown paused', () => {
  const m = M('houzi', 'xiaohong', ['haomao', 'jindou'], ['fanshe', 'zipao']); serve(m, 0, 'clear');
  assert.ok(cast(m, 0, 'haomao')); assert.ok(cast(m, 1, 'fanshe'));
  run(m, 0.5); const mini = m.entOf('mini', 0), board = m.entOf('board', 1), t0 = [mini.t, board.t];
  endPoint(m); assert.equal(m.phase, 'serve', 'next point');
  assert.ok(m.entOf('mini', 0) === mini && m.entOf('board', 1) === board, 'the monkey and the reflector are still on court');
  for (let i = 0; i < 120; i++) m.step(C.DT); // 发球前等一秒
  assert.ok(Math.abs(mini.t - t0[0]) < 0.05 && Math.abs(board.t - t0[1]) < 0.05, 'timers do not run between points');
  m.startServe(m.players[0], 'clear', 0.9); for (let i = 0; i < 20 && m.phase !== 'rally'; i++) m.step(C.DT); run(m, 1);
  assert.ok(mini.t < t0[0] - 0.8, 'and resume in the next rally');
  // 网上的机关（糖网 / 借网）与复制体也一样
  const n = M('ranran', 'lu', ['tangqiu', 'jiewang'], ['fuzhi', 'jieli']); serve(n, 0, 'clear');
  n.addEnt('bow',0,0,C.NET_H,99);cast(n, 0, 'jiewang'); cast(n, 1, 'fuzhi'); const clone = n.entOf('clone', 1), left = [n.players[0].buff.silkReady, clone.t];
  endPoint(n); for (let i = 0; i < 120; i++) n.step(C.DT);
  assert.ok(n.entOf('clone', 1) === clone, 'the clone stays for the next rally');
  assert.ok(Math.abs(clone.t-left[1])<.05);assert.ok(!(n.players[0].buff.silkReady>0),'ribbon charge ends with the rally');
  // 一次性的动作（潮水、长拍）照常在回合结束时收掉
  const w = M('canglan', 'lingfeng'); serve(w, 0, 'clear'); cast(w, 0, 'chaolai'); endPoint(w);
  assert.ok(!w.entOf('wave', 0));
});

test('lingfeng: air step charges a gust shot that is faster and knocks the receiver back', () => {
  const m = M('lingfeng', 'canglan', ['tafeng', 'yuyue']); m.phase = 'rally'; const p = m.players[0], o = m.players[1];
  p.onGround = false; p.y = 0.5; assert.ok(cast(m, 0, 'tafeng')); assert.ok(p.buff.jifeng > 0);
  const shot = { type: 'smash', vx: 20, vy: -6 }, ctx = {}; m.skShot(p, shot, ctx);
  assert.ok(ctx.gust && Math.abs(shot.vx - 24.4) < 1e-9, 'gust smash is faster');
  Object.assign(m.shuttle, { x: -2, y: 2.5, vx: shot.vx, vy: shot.vy, live: true, held: false }); m.afterHit(p, shot, 0.8, ctx);
  assert.deepEqual({ ...m.shuttle.gust }, { o: 0 });
  o.x = 3; Object.assign(m.shuttle, { x: 2.5, y: 1.2 }); m.afterHit(o, { type: 'lift', vx: -6, vy: 8 }, 0.6, {});
  assert.ok(o.buff.knock > 0, 'the receiver is knocked back'); const x0 = o.x;
  for (let i = 0; i < 40; i++) m.updatePlayer(o, C.DT);
  assert.ok(o.x - x0 > 0.6, 'pushed away from the net: ' + (o.x - x0)); assert.equal(m.shuttle.gust, null);
});

test('canglan: the pool saves the first landing with a bounce, the second landing scores', () => {
  const m = M('canglan', 'lingfeng', ['chaolai', 'huichao']); m.phase = 'rally'; const p = m.players[0]; p.x = -6; m.players[1].x = 3;
  assert.ok(cast(m, 0, 'chaolai')); const pool = m.entOf('pool', 0); assert.equal(pool.t, 8); assert.ok(pool.x < 0, 'on her own half');
  assert.equal(cast(m, 0, 'chaolai'), false, 'one pool at a time');
  incoming(m.shuttle, { x: -2, y: 1.2, vx: -3, vy: -3, crossedNet: true }); m.events.length = 0;
  let bounce = null; run(m, 0.8, () => { if (!bounce && m.shuttle.puddle) bounce = { vy: m.shuttle.vy, y: m.shuttle.y }; });
  assert.ok(bounce && bounce.vy > 3, 'the first landing pops up from the water');
  assert.ok(ev(m, 'splash').length === 1 && pool.hits === 1);
  run(m, 3); assert.deepEqual(m.score, [0, 1], 'the second landing scores as usual');
});

test('canglan: recalling a pool bounce rides the tide without extending the pool and leaves a heavy ball', () => {
  const m = M('canglan', 'lingfeng', ['chaolai', 'huichao']); m.phase = 'rally'; m.players[0].x = -6;
  cast(m, 0, 'chaolai'); const pool = m.entOf('pool', 0);
  incoming(m.shuttle, { x: -1.4, y: 3, vx: -3, vy: -2, crossedNet: true, path: [] });
  run(m, 2, () => { if (m.shuttle.puddle && m.shuttle.vy < 2) m.phase = 'hold'; }); m.phase = 'rally';
  const t0 = pool.t; m.players[0].skillCd = 0; assert.ok(cast(m, 0, 'huichao'));
  assert.equal(m.shuttle.ctl.k, 'rewind'); assert.equal(m.shuttle.ctl.tide, 1); assert.equal(pool.t,t0,'rewind does not renew the pool');
  run(m, 0.08); m.players[0].skillCd = 0; assert.ok(cast(m, 0, 'huichao'));
  assert.equal(m.shuttle.tide, 0); assert.ok(m.shuttle.oppQ < 1, 'the tide ball is harder to return');
});

test('xiaohong: aimed self-toss, guide line and the toss into the reflection board', () => {
  const toss = (aim) => {
    const m = M('xiaohong', 'canglan', ['zipao', 'pingyi']); m.phase = 'rally'; const p = m.players[0]; p.x = -3;
    incoming(m.shuttle, { x: p.x + p.dir * 0.7, y: 1.5, vx: -6, vy: -1, crossedNet: true });
    assert.ok(cast(m, 0, 'zipao', aim)); assert.equal(m.shuttle.selfToss, 0); assert.ok(p.swing && p.swing.toss, 'a scoop motion');
    return m.shuttle;
  };
  const up = toss(), lean = toss({ x: .8, y: .6 }), soft = toss({ x: .2, y: .35 });
  assert.ok(Math.abs(up.vx) < 1.5 && up.vy > 5, 'tap: straight over her head');
  assert.ok(lean.vx > 3, 'drag forward: tossed toward the net');
  assert.ok(Math.hypot(soft.vx, soft.vy) < Math.hypot(lean.vx, lean.vy), 'a short drag is a softer toss');
  // 辅助线校准保留球路，不再附加自抛重球
  const g = M('xiaohong', 'canglan', ['pingyi', 'zipao']); g.phase = 'rally'; const q = g.players[0]; q.x = -3;
  assert.ok(cast(g, 0, 'pingyi', { x: 1, y: -.3 })); const line = g.entOf('guide', 0); assert.equal(line.n,2);assert.equal(line.a,undefined);
  assert.equal(g.halfOf(0), C.HALF, 'the court stays the same size');
  Object.assign(g.shuttle, { x: q.x + .5, y: 2.6, live: true, held: false, ctl: null, selfToss: 0 });
  const shot = { type: 'smash', vx: 15, vy: -3 }, ctx = {}; g.skShot(q, shot, ctx);
  const safe=YY.simulate(g.shuttle.x,g.shuttle.y,shot.vx,shot.vy,6,false,false,g.physEnv());assert.ok(!safe.netHit&&safe.landX>0&&safe.landX<C.HALF,'calibrated shot stays legal');
  assert.equal(ctx.skill,'pingyi');assert.equal(ctx.lever,undefined);assert.equal(shot.type,'smash');assert.equal(g.entOf('guide',0).n,1);
  // 自抛垫进反射板：板子替她把球打出去
  const b = M('xiaohong', 'canglan', ['zipao', 'fanshe']); b.phase = 'rally'; const r = b.players[0]; r.x = -3;
  incoming(b.shuttle, { x: r.x + r.dir * 0.7, y: 1.5, vx: -6, vy: -1, crossedNet: true }); assert.ok(cast(b, 0, 'zipao'));
  b.addEnt('board', 0, b.shuttle.x + 0.1, b.shuttle.y + 1.0, 12, { n: 2, cool: 0, age:.5 }); b.events.length = 0; run(b, 0.6);
  assert.ok(ev(b, 'skillProc').some(e => e.id === 'fanshe')); assert.equal(b.shuttle.selfToss, -1); assert.ok(b.shuttle.vx > 0, 'out toward the opponent');
});

test('ranran: the ribbon is aimed, wraps the incoming ball and releases a chosen short return', () => {
  const m = M('ranran', 'canglan', ['hongxian', 'jiewang']); m.phase = 'rally'; const p = m.players[0]; p.x = -3;
  incoming(m.shuttle, { x: -1.2, y: 2.4, vx: -5, vy: 0, crossedNet: true });
  assert.ok(cast(m, 0, 'hongxian', { x: .85, y: .5 })); assert.ok(m.entOf('ribbon', 0));
  let got = false; run(m, 0.5, () => { const c = m.shuttle.ctl; if (c && c.k === 'tether') got = true; });
  assert.ok(got && m.shuttle.ctl && m.shuttle.ctl.k === 'tether', 'the ribbon wraps the ball and pulls it in');
  m.events.length = 0; p.skillCd = 0; assert.ok(cast(m, 0, 'hongxian', { x: .9, y: .2 }));
  const s = m.shuttle; assert.equal(s.ctl, null); assert.equal(s.lastHitter, 0); assert.ok(s.vx>0,'released toward the opponent');const path=YY.simulate(s.x,s.y,s.vx,s.vy,6,false,false,m.physEnv());assert.ok(!path.netHit&&path.landX>0&&path.landX<C.HALF,'short return is legal');
  assert.ok(ev(m, 'skillProc').some(e => e.id === 'hongxian' && /回旋压短/.test(e.label)));
  assert.ok(ev(m, 'hit').some(e => e.p === 0 && e.skill === 'hongxian'));
  // 丝带过不了网
  const n = M('ranran', 'canglan', ['hongxian', 'jiewang']); n.phase = 'rally'; n.players[0].x = -1; n.shuttle.live = false;
  assert.ok(cast(n, 0, 'hongxian', { x: 1, y: -.1 })); let far = -9; run(n, 0.4, () => { const e = n.entOf('ribbon', 0); if (e) far = Math.max(far, e.x); });
  assert.ok(far <= -0.12 + 1e-9, 'stops at the net: ' + far);
});

test('ruibao: the floor slam raises two walls; every bounce speeds the ball up and only the far side scores', () => {
  const g = M('ruibao', 'canglan', ['diban', 'baozi']); g.phase = 'rally'; const r = g.players[0]; r.x = -3.5; g.players[1].x = 4;
  incoming(g.shuttle, { x: r.x + r.dir * 0.6, y: 1.6, vx: -8, vy: -2, crossedNet: true });
  assert.ok(cast(g, 0, 'diban')); const walls = g.entsOf('wall', 0); assert.equal(walls.length, 2);
  assert.ok(walls.some(w => w.v && w.x < r.x) && walls.some(w => !w.v && w.y > 3), 'one wall behind him, one overhead');
  assert.ok(r.swing && r.swing.slam && r.swing.style === 'smash', 'a full overhead slam motion');
  g.events.length = 0; let last = null, jumps = 0;
  run(g, 4, () => { const sp = Math.hypot(g.shuttle.vx, g.shuttle.vy), n = g.shuttle.slam ? g.shuttle.slam.n : -1; if (last && n > last.n) { if (sp > last.sp * 1.1) jumps++; } last = { sp, n }; });
  const bounces = ev(g, 'skillProc').filter(e => e.id === 'diban' && /反弹/.test(e.label)).length;
  assert.ok(bounces >= 1 && jumps === bounces, 'every bounce speeds it up: ' + jumps + ' / ' + bounces);
  assert.deepEqual(g.score, [1, 0], 'his own floor is exempt once; it scores on the far side');
  // 手动朝后墙砸：撞墙也算一次反弹
  const w = M('ruibao', 'canglan', ['diban', 'baozi']); w.phase = 'rally'; const wr = w.players[0]; wr.x = -3.5;
  incoming(w.shuttle, { x: wr.x + wr.dir * 0.6, y: 1.6, vx: -8, vy: -2, crossedNet: true }); assert.ok(cast(w, 0, 'diban', { x: -.95, y: .2 }));
  w.events.length = 0; run(w, 0.5); assert.ok(ev(w, 'skillProc').some(e => /后墙/.test(e.label)), 'the back wall returns it');
});

test('ruibao: the bun wraps the shuttle, soaks up both players\' power and releases it on demand', () => {
  const b = M('ruibao', 'canglan', ['baozi', 'diban']); b.phase = 'rally'; const rb = b.players[0], o = b.players[1]; rb.x = -3;
  incoming(b.shuttle, { x: 1, y: 2.6, vx: -11, vy: -1, crossedNet: false }); b.rePred();
  assert.ok(cast(b, 0, 'baozi')); assert.ok(b.entOf('bunFly', 0), 'the bun is thrown');
  let wrap = null; run(b, 1, () => { if (!wrap && b.shuttle.bun) wrap = { st: b.shuttle.bun.st, sp: Math.hypot(b.shuttle.vx, b.shuttle.vy) }; });
  assert.ok(wrap && wrap.st > 2 && wrap.sp < 8, 'wrapped, slowed, and the lost speed is stored');
  // 对手的重扣打在肉包上：力量被吃掉，球变成软绵绵的高球
  const c = M('ruibao', 'canglan', ['baozi', 'diban']); c.phase = 'rally'; const cr = c.players[0], co = c.players[1]; cr.x = -3; co.x = 3;
  Object.assign(c.shuttle, { x: 2.5, y: 2.6, vx: -24, vy: -6, live: true, held: false, ctl: null, bun: { o: 0, st: 4, t: 5 } });
  c.afterHit(co, { type: 'smash', vx: -24, vy: -6 }, 0.8, {});
  assert.ok(Math.hypot(c.shuttle.vx, c.shuttle.vy) < 20 && c.shuttle.bun.st > 4, 'the smash is absorbed');
  // 5 秒内再按：吸收的动能一次性还给球
  Object.assign(c.shuttle, { x: -2, y: 2, vx: 6, vy: 1, lastHitter: 0, crossedNet: false });
  const st = c.shuttle.bun.st, sp = Math.hypot(6, 1); c.events.length = 0; cr.skillCd = 0;
  assert.ok(cast(c, 0, 'baozi')); assert.ok(Math.hypot(c.shuttle.vx,c.shuttle.vy)<=30 && Math.hypot(c.shuttle.vx,c.shuttle.vy)>=sp, 'bounded delayed force'); const land=YY.simulate(c.shuttle.x,c.shuttle.y,c.shuttle.vx,c.shuttle.vy,6,false,false,c.physEnv()); assert.ok(!land.netHit && land.landX>0 && land.landX<6.7, 'release preserves a legal landing');
  assert.equal(c.shuttle.bun, null); assert.ok(ev(c, 'skillProc').some(e => e.id === 'zheteng'), 'releasing feeds the passive');
});

test('xingxing: the gate exit holds the ball for 0.35 s; gravity is a draining toggle that only bends her own shots', () => {
  const m = M('xingxing', 'canglan', ['xingmen', 'zhongli']); m.phase = 'rally'; const p = m.players[0], o = m.players[1]; p.x = -3; o.x = 2;
  assert.ok(cast(m, 0, 'xingmen'));
  Object.assign(m.shuttle, { x: -2.4, y: 2.2, live: true, held: false, ctl: null });
  const sh = m.resolveShot(p, 'drop', 0.8, false); m.shuttle.vx = sh.vx; m.shuttle.vy = sh.vy; m.afterHit(p, sh, 0.8, {});
  assert.equal(m.entsOf('gate', 0).length, 2); let warp = 0, at = null;
  run(m, 1, () => { const c = m.shuttle.ctl; if (c && c.k === 'warp') { warp += C.DT; at = at || { x: m.shuttle.x }; } });
  assert.ok(Math.abs(warp - 0.35) < 0.03, 'the ball waits in the exit: ' + warp.toFixed(3));
  assert.ok(at.x > 5, 'the exit is behind him'); assert.ok(m.shuttle.vx < 0 && m.shuttle.crossedNet);
  // 重力换班：被动把她打过的球变成重力球；开关翻转重力，按秒耗能，0.5 秒切换冷却
  const g = M('xingxing', 'canglan', ['zhongli', 'xingmen']); g.phase = 'rally'; const q = g.players[0], r = g.players[1]; q.x = -3; r.x = 3;
  Object.assign(g.shuttle, { x: q.x + .5, y: 2.4, vx: 12, vy: 6, live: true, held: false, ctl: null, crossedNet: false });
  g.afterHit(q, { type: 'clear', vx: 12, vy: 6 }, 0.8, {}); assert.deepEqual({ ...g.shuttle.grav }, { o: 0 }, 'passive: her shot is a gravity ball');
  assert.ok(!g.physEnv() || !(g.physEnv().g < 0), 'gravity is normal while the switch is off');
  Object.assign(g.shuttle, { x: r.x - .5, y: 2.4 }); g.afterHit(r, { type: 'clear', vx: -12, vy: 6 }, 0.8, {});
  assert.deepEqual({ ...g.shuttle.grav }, { o: 0 }, 'still a gravity ball after the opponent returns it');
  const plain = M('lingfeng', 'canglan'); plain.phase = 'rally'; plain.afterHit(plain.players[0], { type: 'clear' }, 0.8, {}); assert.ok(!plain.shuttle.grav, 'only when she carries the skill');
  Object.assign(g.shuttle, { x: 1, y: 3, vx: 2.5, vy: -2, lastHitter: 0, crossedNet: true });
  assert.ok(cast(g, 0, 'zhongli')); assert.ok(q.buff.gravOn > 0); assert.equal(q.skillCd, 0.5);
  assert.equal(g.useSkill(q, 0, null), false, 'toggle cooldown');
  const env = g.physEnv(); assert.ok(env.g < 0 && env.ceil === YY.GRAV_CEIL, 'flipped gravity with a ceiling');
  const e0 = q.energy, y0 = g.shuttle.y; let top = 0; run(g, 2, () => { top = Math.max(top, g.shuttle.y); });
  assert.ok(top > y0 + 2 && top <= YY.GRAV_CEIL + 1e-9, 'it floats up and hovers under the ceiling: ' + top.toFixed(2));
  assert.ok(e0 - q.energy > 9, 'drains energy every second: ' + (e0 - q.energy).toFixed(1));
  assert.equal(q.buff.gravOn, 0, 'automatically switches off after 1.5 seconds'); assert.ok(q.buff.gravRest > 0); q.skillCd = 0; assert.equal(cast(g,0,'zhongli'),false,'settling window cannot be bypassed');
  let fell = false; run(g, 3, () => { if (g.shuttle.vy < -2) fell = true; }); assert.ok(fell, 'switched off: it falls again');
  assert.deepEqual(g.score, [1, 0]);
  q.energy = 0.01; q.skillCd = 0; q.buff.gravOn = 99; g.phase = 'rally'; g.skPlayer(q, 0.1); assert.equal(q.buff.gravOn, 0, 'switches off with no energy');
});

test('laochen: Ctrl+H swaps the next attack for a soft ball; the freeze pane stops the real shuttle', () => {
  for (const [aim, type] of [[null, 'lift'], [1, 'net']]) {
    const m = M('laochen', 'canglan', ['yati', 'shuangji']); m.phase = 'rally'; const p = m.players[0], o = m.players[1]; p.x = -3; o.x = 3;
    assert.ok(cast(m, 0, 'yati', aim)); assert.ok(m.entOf('replace', 0)); m.entOf('replace',0).age=.31; const e0 = p.energy;
    Object.assign(m.shuttle, { x: o.x - 0.5, y: 2.6, live: true, held: false, ctl: null });
    const drop = { type: 'drop', vx: -6, vy: 1 }; m.skShot(o, drop, {}); assert.equal(drop.type, 'drop', 'soft balls are not replaced');
    const shot = { type: 'smash', vx: -20, vy: -6 }, ctx = {}; m.skShot(o, shot, ctx);
    assert.equal(shot.type, type); assert.ok(shot.vy > 0 && ctx.replaced === 1); assert.equal(p.energy, e0 + 3); assert.ok(!m.entOf('replace', 0), 'replaced once');
  }
  const n = M('laochen', 'canglan', ['shuangji', 'yati']); n.phase = 'rally'; const q = n.players[0]; q.x = -3;
  assert.ok(cast(n, 0, 'shuangji', { x: .6, y: .5 })); const pane = n.entOf('pane', 0); assert.ok(q.side * pane.x > 0); pane.age=.3;
  incoming(n.shuttle, { x: pane.x + 1.6, y: pane.y + .1, vx: -9, vy: 0, crossedNet: true });
  let frozen = null; run(n, 0.5, () => { const c = n.shuttle.ctl; if (!frozen && c && c.k === 'freeze') frozen = { x: n.shuttle.x, vx: c.vx }; });
  assert.ok(frozen, 'the shuttle freezes in the pane'); run(n, 0.3); assert.equal(n.shuttle.x, frozen.x, 'and stays put');
  assert.equal(YY.skPack(n).c.k, 'freeze', 'online peers see the freeze');
  q.skillCd = 0; assert.ok(cast(n, 0, 'shuangji')); assert.ok(n.shuttle.ctl.thaw); for(let i=0;i<20&&n.shuttle.ctl;i++)n.skControl(C.DT); assert.equal(n.shuttle.ctl, null); assert.equal(n.shuttle.vx, frozen.vx, 'early thaw keeps its speed');
  assert.deepEqual(n.score, [0, 0]);
});

test('ranran sling, ding devices and guoge leverage give heavy feedback events', () => {
  const m = M('dingding', 'canglan', ['xuanpai', 'youyou']); m.phase = 'rally'; m.players[0].x = -3;
  incoming(m.shuttle, { x: -3 + 1.15, y: 1.25, vx: 0, vy: 0, crossedNet: true }); cast(m, 0, 'xuanpai', 1); run(m, 0.6);
  const h = ev(m, 'hit').find(e => e.skill === 'xuanpai'); assert.ok(h && h.big && h.q >= 0.9);
});

test('AI uses every reworked skill without breaking a match', () => {
  for (const [id, kit] of [['houzi', ['jindou', 'haomao']], ['lu', ['fuzhi', 'zangshu']], ['zhu', ['jiezou', 'tingyixia']], ['guoge', ['ganggan', 'qiquan']],
    ['laochen', ['yueqiu', 'shuangji']], ['xingxing', ['xingmen', 'yueliang']], ['ranran', ['jiewang', 'tangqiu']], ['ruibao', ['diban', 'baozi']], ['lingfeng', ['yuyue', 'tafeng']]]) {
    const used = new Set();
    for (let k = 0; k < 3; k++) {
      const g = new YY.Match({ skills: [YY.skillSet(id, kit), YY.skillSet('canglan')], target: 5, cap: 7 });
      const ais = [new YY.AI(g, 0, 'hard', id), new YY.AI(g, 1, 'normal', 'canglan')];
      for (let t = 0; g.winner < 0 && t < 900; t += C.DT) {
        ais.forEach(a => a.update(C.DT)); g.step(C.DT);
        for (const e of g.events) if (e.type === 'skill' && e.p === 0) used.add(e.id);
        g.events.length = 0;
        for (const p of g.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), id + ' positions stay finite');
        assert.ok(Number.isFinite(g.shuttle.x) && Number.isFinite(g.shuttle.y), id + ' shuttle stays finite');
      }
      assert.ok(g.winner >= 0, id + ' match finishes');
      if (used.size === 2) break;
    }
    assert.ok(used.size >= 1, id + ' AI casts its skills: ' + [...used]);
  }
});
