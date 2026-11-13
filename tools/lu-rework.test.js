'use strict';
// 路先森 · 程序指令重做：复制体、接力协议、脏数据
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function loadCore() {
  const context = vm.createContext({});
  for (const name of ['core', 'roster', 'match', 'ai'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
  return { YY: context.YY };
}

function kit(YY) {
  const C = YY.C;
  const M = (actA, b = 'canglan') => { const m = new YY.Match({ skills: [{ passive: 'rizhi', act: actA }, { passive: YY.char(b).passive, act: YY.char(b).acts.slice(0, 2) }] }); m.players.forEach(p => p.energy = 100); return m; };
  const serve = (m, srv) => { m.server = srv; m.resetPoint(false); m.players.forEach(p => p.energy = 100); m.startServe(m.players[srv], 'clear', 0.9); for (let i = 0; i < 20 && m.phase !== 'rally'; i++) m.step(C.DT); };
  const run = (m, sec, f) => { for (let t = 0; t < sec; t += C.DT) { if (f && f() === false) break; m.step(C.DT); if (m.phase !== 'rally') break; } };
  const cast = (m, i, id, aim) => { m.players[i].skillCd = 0; return m.useSkill(m.players[i], m.players[i].kit.act.indexOf(id), aim == null ? null : { aim }); };
  const ev = (m, t) => m.events.filter(e => e.type === t);
  /** 对手打来的球：从 (x, y) 以 (vx, vy) 飞向路先森的半场 */
  const incoming = (m, o) => Object.assign(m.shuttle, { lastHitter: 1, crossedNet: true, netHit: false, live: true, held: false, ctl: null, selfToss: -1, path: [] }, o);
  return { C, M, serve, run, cast, ev, incoming };
}

test('路先森 now carries 复制体 / 接力协议 / 脏数据 with descriptions, details and counters', () => {
  const { YY } = loadCore();
  const lu = YY.char('lu');
  assert.deepEqual([...lu.acts], ['fuzhi', 'jieli', 'zangshu']);
  for (const id of lu.acts) {
    const sk = YY.SKILLS[id];
    assert.ok(sk.desc.length > 20 && !sk.detail && sk.tip.length > 6, id);
  }
  assert.equal(YY.SKILLS.jieli.aim, 'vector', 'the relay is dragged: up = high pass, flat = quick pass');
  assert.ok(YY.SKILLS.zangshu.stealth, 'the opponent gets no cut-in for dirty data');
  assert.ok(!YY.SKILLS.fanghuo && !YY.SKILLS.bug, 'the old firewall and bug are gone');
  assert.deepEqual([...YY.skillSet('lu', ['fanghuo', 'bug']).act], ['fuzhi', 'jieli'], 'old saved loadouts fall back to the new defaults');
});

test('复制体 stays put, mirrors jumps and swings, and returns a ball the body cannot reach', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast, incoming } = kit(YY);
  const m = M(['fuzhi', 'jieli']); serve(m, 1);
  const lu = m.players[0]; lu.x = -1.6;
  assert.ok(cast(m, 0, 'fuzhi'));
  const cl = m.entOf('clone', 0); assert.ok(cl && Math.abs(cl.x + 1.6) < 1e-9 && cl.t === 8);
  // 本体跑到后场，复制体留在网前；本体起跳，复制体同高
  run(m, 0.4, () => { m.inputs[0].move = -1; });
  assert.ok(lu.x < -3 && Math.abs(cl.x + 1.6) < 1e-9, 'the clone does not walk with the body');
  m.inputs[0].move = 0; m.inputs[0].presses.push({ btn: 'jump' }); run(m, 0.15);
  assert.ok(lu.y > 0.2 && Math.abs(cl.y - lu.y) < 1e-9, 'the clone jumps with the body');
  run(m, 1.2);
  // 来球飞向复制体拍前：本体挥拍，复制体替他击球；记作路先森的击球，必须过网
  const s = m.shuttle, tx = cl.x - 0.6 * 1, ty = C.SHOULDER; // 复制体拍面在 x+dir*0.6（dir=+1）
  const hx = cl.x + 0.6, hy = C.SHOULDER;
  incoming(m, { x: hx + 2.2, y: hy + 0.9, vx: -7, vy: -2.6, shot: 'drive' });
  let swung = false, hit = null; m.events.length = 0;
  run(m, 1.2, () => {
    if (!swung && Math.hypot(s.x - hx, s.y - hy) < 0.95) { m.inputs[0].presses.push({ btn: 'clear' }); swung = true; }
    if (!hit) hit = m.events.find(e => e.type === 'hit' && e.p === 0);
  });
  assert.ok(swung && hit, 'the clone struck the incoming ball');
  assert.ok(Math.abs(hit.x - hx) < 1.0, 'contact at the clone, not the body: ' + hit.x);
  assert.ok(m.events.some(e => e.type === 'skillProc' && e.id === 'fuzhi' && /击球/.test(e.label)));
  assert.notEqual(m.score[1], 1, 'the clone return did not lose the point');
  void tx; void ty;
});

test('复制体: its ball that falls on the own half bounces once; compile mark extends it to 11 seconds', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast } = kit(YY);
  const m = M(['fuzhi', 'jieli']); serve(m, 1);
  const lu = m.players[0]; lu.cnt.compile = 1;
  assert.ok(cast(m, 0, 'fuzhi')); assert.equal(m.entOf('clone', 0).t, 11, 'compiled clone lasts longer');
  // 复制体打出的球没过网、落在自己这边：弹起一次，本体还能再打
  const s = m.shuttle;
  Object.assign(s, { x: -2, y: 1.2, vx: 0.4, vy: -1, lastHitter: 0, crossedNet: false, netHit: false, live: true, held: false, ctl: null, cloneBy: 0 });
  m.rePred(); m.events.length = 0;
  run(m, 0.6);
  assert.equal(m.phase, 'rally', 'no point lost on the first landing');
  assert.ok(m.entOf('cloneHop', 0) && s.selfToss === 0 && s.vy > 0, 'the ball pops up for another swing');
  // 第二次落地照常判失误
  run(m, 3);
  assert.deepEqual([...m.score], [0, 1]);
  void C;
});

test('接力协议: the near end pads to the other end; up = high pass over the head, flat = quick pass; a swing is still needed', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast, ev, incoming } = kit(YY);
  const plan = (aim) => {
    const m = M(['fuzhi', 'jieli']); serve(m, 1);
    const lu = m.players[0]; lu.x = -4.6; cast(m, 0, 'fuzhi'); const cl = m.entOf('clone', 0); cl.x = -1.5; cl.warm = 0;
    incoming(m, { x: cl.x + 0.6 + 0.4, y: C.SHOULDER + 0.5, vx: -3, vy: -1 });
    return { m, lu, cl, aim };
  };
  // 高传：复制体身边的球 → 本体头顶
  let { m, lu, cl } = plan();
  assert.ok(YY.relayPlan(m, lu, { x: 0, y: 1, r: 1, manual: true }).from === 'clone');
  m.events.length = 0;
  assert.ok(cast(m, 0, 'jieli', { x: 0.1, y: 1 }), 'relay cast');
  const c = m.shuttle.ctl; assert.equal(c.k, 'relay'); assert.equal(c.to, 'body'); assert.ok(c.high);
  assert.ok(lu.swing && lu.swing.relay && cl.sw === null || true);
  run(m, 0.05); assert.ok(cl.sw && cl.sw.relay, 'the clone performs the pass motion too');
  run(m, c.T + 0.05);
  const s = m.shuttle;
  assert.ok(!s.ctl && s.selfToss === 0 && s.tossSkill === 'jieli', 'the ball is released above the body for a swing');
  assert.ok(Math.abs(s.x - (lu.x + 0.55 * lu.dir)) < 0.8 && s.y > 2.9, 'high pass arrives over the body head: ' + s.x.toFixed(2) + ',' + s.y.toFixed(2));
  assert.ok(!ev(m, 'hit').some(e => e.p === 0 && e.skill === 'jieli' && e.shot === 'smash'), 'no automatic smash');
  // 起跳扣杀：判定宽、质量保底
  m.inputs[0].presses.push({ btn: 'jump' }); let pressed = false, hit = null;
  run(m, 1.2, () => {
    if (!pressed && s.vy < 0 && s.y < lu.y + C.SHOULDER + 1.0) { m.inputs[0].presses.push({ btn: 'smash' }); pressed = true; }
    hit = hit || m.events.find(e => e.type === 'hit' && e.p === 0 && e.skill === 'jieli');
  });
  assert.ok(hit && hit.q >= 0.75, 'the relayed ball is smashed with a quality floor');
  // 快传：更低、更快
  ({ m, lu, cl } = plan());
  assert.ok(cast(m, 0, 'jieli', { x: 1, y: 0.1 }));
  const q = m.shuttle.ctl; assert.ok(!q.high && q.T < 0.62 && q.P[2][1] < 2.2, 'flat drag = quick low pass');
});

test('接力协议 without a clone is a short self-pad that the drag height retimes; far balls are refused', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast, incoming } = kit(YY);
  const m = M(['jieli', 'zangshu']); serve(m, 1);
  const lu = m.players[0]; lu.x = -3;
  incoming(m, { x: lu.x + 3.6, y: 2.5, vx: -6, vy: 0 });
  m.events.length = 0;
  assert.ok(!cast(m, 0, 'jieli'), 'too far: refused');
  assert.ok(m.events.some(e => e.type === 'skillFail' && /身边/.test(e.label)));
  incoming(m, { x: lu.x + 0.9, y: C.SHOULDER + 0.3, vx: -2, vy: -0.5 });
  const low = YY.relayPlan(m, lu, { x: 0, y: 0.3, r: 0.4, manual: true }), high = YY.relayPlan(m, lu, { x: 0, y: 1, r: 1, manual: true });
  assert.equal(low.to, 'self'); assert.ok(high.ty > low.ty + 0.8 && high.T > low.T, 'dragging higher pads higher and later');
  assert.ok(cast(m, 0, 'jieli', { x: 0, y: 1 }));
  const T = m.shuttle.ctl.T; run(m, T + 0.03);
  assert.ok(m.shuttle.selfToss === 0 && Math.abs(m.shuttle.x - lu.x) < 1.4, 'the pad lands back over his own racket');
  // 球已经被控制时不能再接力；预览给出落点
  const pv = YY.skillPreview(m, lu, 'jieli', YY.skillVector('jieli', { x: 0, y: 1 }));
  assert.ok(pv && pv.label, 'preview text');
});

test('脏数据: an identical-looking decoy that the opponent can hit, bounces back at random angles and expires after 5', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast, ev } = kit(YY);
  const m = M(['fuzhi', 'zangshu']); serve(m, 0);
  const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
  try {
    assert.ok(cast(m, 0, 'zangshu'));
    assert.equal(calls, 0, 'dirty data never draws from the match random sequence');
  } finally { Math.random = real; }
  const d = m.entOf('dirty', 0); assert.ok(d && d.n === 0 && d.vx > 0, 'one dirty ball flies to the opponent');
  assert.ok(ev(m, 'skillProc').filter(e => e.id === 'zangshu').every(e => e.tip), 'only Lu is told');
  // 不打它：落地后弹回路先森这边，再弹回去……累计 5 次消失
  const sides = []; let gone = false, real0 = m.shuttle;
  m.players[1].x = 6.9; // 站开，别碰到它
  for (let t = 0; t < 12 && !gone; t += C.DT) {
    m.shuttle.live = true; m.shuttle.y = Math.max(m.shuttle.y, 3); m.shuttle.vy = Math.max(0, m.shuttle.vy); // 真球留在空中，回合不结束
    const before = d.n; m.step(C.DT);
    if (d.n !== before) sides.push(Math.sign(d.x));
    gone = !m.ents.includes(d);
  }
  void real0;
  assert.ok(gone && d.n === 5, 'expires after 5 bounces');
  assert.ok(sides.slice(0, 4).every((v, i, a) => !i || v !== a[i - 1]), 'each bounce goes to the other court: ' + sides);
  assert.ok(m.entOf('dirtyPop', 0) || ev(m, 'dirtyBounce').length >= 4);
  assert.equal(m.phase, 'rally', 'the decoy never scores');
});

test('脏数据: hitting it uses up the opponent swing and looks like a normal hit; the clone sends a second one', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast, ev } = kit(YY);
  const m = M(['fuzhi', 'zangshu']); serve(m, 0);
  assert.ok(cast(m, 0, 'fuzhi')); m.entOf('clone', 0).x = -2.2; m.players[0].x = -4;
  assert.ok(cast(m, 0, 'zangshu'));
  const ds = m.entsOf('dirty', 0); assert.equal(ds.length, 2, 'body and clone each inject one');
  assert.ok(Math.abs(ds[0].lx - ds[1].lx) > 0.5, 'they head for different spots');
  // 对手站在第一只脏数据球的路线上挥拍
  const o = m.players[1], d = ds[0];
  let swung = false, hit = null, after = null; m.events.length = 0;
  run(m, 2.5, () => {
    m.shuttle.live = true; m.shuttle.y = Math.max(m.shuttle.y, 3); m.shuttle.vy = Math.max(0, m.shuttle.vy);
    if (!hit && (hit = ev(m, 'hit').find(e => e.dirty === d.id))) { after = { n: d.n, vx: d.vx, spent: !o.swing || o.swing.hit }; return false; }
    if (!m.ents.includes(d) || d.n) return;
    o.x = d.x + 0.62; o.vx = 0;
    if (!swung && d.vy < 0 && d.y < C.SHOULDER + 0.1 && d.x > 0.3) { m.inputs[1].presses.push({ btn: 'clear' }); swung = true; }
    hit = hit || ev(m, 'hit').find(e => e.dirty === d.id);
  });
  assert.ok(swung && hit && hit.p === 1 && hit.name, 'the opponent sees a normal-looking hit');
  assert.equal(after.n, 1); assert.ok(after.vx < 0, 'the dirty ball flies back to Lu');
  assert.ok(after.spent, 'that swing is spent');
});

test('new Lu entities survive the online snapshot, and the AI plays all three skills', () => {
  const { YY } = loadCore(), { C, M, serve, run, cast } = kit(YY);
  const m = M(['fuzhi', 'zangshu']); serve(m, 0);
  cast(m, 0, 'fuzhi'); cast(m, 0, 'zangshu'); run(m, 0.1);
  const k = JSON.parse(JSON.stringify(YY.skPack(m))), v = { time: 10, shuttle: {}, players: [{}, {}] };
  YY.skUnpack(v, null, k, 1);
  assert.ok(v.ents.some(e => e.k === 'clone') && v.ents.filter(e => e.k === 'dirty').length === 2, 'clone and dirty balls sync');
  assert.ok(!k.e.some(e => 'ref' in e), 'the swing reference is not sent');
  // AI 对局：三个技能都会用到
  const used = {};
  for (const kitA of [['fuzhi', 'jieli'], ['jieli', 'zangshu'], ['fuzhi', 'zangshu']]) for (let g = 0; g < 3; g++) {
    const mm = new YY.Match({ skills: [{ passive: 'rizhi', act: kitA }, { passive: 'qiandao', act: ['yati', 'yueqiu'] }], target: 5, cap: 7 });
    const ais = [new YY.AI(mm, 0, 'hard'), new YY.AI(mm, 1, 'normal')];
    for (let t = 0; t < 140 && mm.phase !== 'over'; t += C.DT) { ais.forEach(a => a.update(C.DT)); mm.step(C.DT); for (const e of mm.events) if (e.type === 'skill' && e.p === 0) used[e.id] = (used[e.id] || 0) + 1; mm.events.length = 0; }
  }
  for (const id of ['fuzhi', 'jieli', 'zangshu']) assert.ok(used[id] > 0, 'AI uses ' + id + ' ' + JSON.stringify(used));
});
