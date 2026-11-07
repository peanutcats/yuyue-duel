'use strict';
// 首批 8 支球拍、6 双球鞋的核心特性：逐个验证触发条件、数值与代价
const test = require('node:test'), assert = require('node:assert/strict');
const YY = require('../js/core'); require('../js/roster'); require('../js/match'); require('../js/ai'); require('../js/char');
const C = YY.C;

function seeded(seed, fn) {
  const random = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + .5) / 4294967296; };
  try { return fn(); } finally { Math.random = random; }
}
/** 双方各带一套器械的回合中比赛 */
function geared(r0 = 'r_basic', s0 = 'sh_basic', r1 = 'r_basic', s1 = 'sh_basic') {
  const m = new YY.Match({ gear: [{ racket: r0, shoe: s0 }, { racket: r1, shoe: s1 }] });
  m.phase = 'rally'; m.events = [];
  return m;
}
const gearEvents = (m, k) => m.events.filter(e => e.type === 'gear' && (!k || e.k === k));

test('every trait gear carries base stats, one core trait and a stated cost; stats keep the cost side', () => {
  for (const it of [...YY.GEAR.racket, ...YY.GEAR.shoe].filter(it => it.trait)) {
    const LOWER = { land: 1, handling: 1, stamCost: 1, lunge: 1 }, good = Object.entries(it.fx).map(([k, v]) => LOWER[k] ? -v : v);
    assert.ok(good.some(v => v > 0) && good.some(v => v < 0), it.id + ' has upside and downside stats');
    assert.ok(it.trait.k && it.trait.name && it.trait.desc && it.cost, it.id);
  }
  const base = YY.gearStats({ racket: 'r_basic', shoe: 'sh_basic' });
  assert.ok(YY.gearStats({ racket: 'r_heavy' }).power > base.power && YY.gearStats({ racket: 'r_heavy' }).handling > base.handling, '雷霆：更重更慢');
  assert.ok(YY.gearStats({ racket: 'r_light' }).handling < base.handling && YY.gearStats({ racket: 'r_light' }).power < base.power, '疾风：快但轻');
  assert.ok(YY.gearStats({ racket: 'r_prism' }).reach < base.reach, '棱镜：甜区更小');
  assert.ok(YY.gearStats({ shoe: 'sh_light' }).land > base.land, '羽翼：落地恢复更慢');
  assert.ok(YY.gearStats({ shoe: 'sh_cushion' }).land < base.land && YY.gearStats({ shoe: 'sh_cushion' }).move < base.move, '云垫：缓震但慢');
  assert.ok(YY.gearStats({ shoe: 'sh_butterfly' }).jump < base.jump && YY.gearStats({ shoe: 'sh_moon' }).jump < base.jump);
});

test('players carry their gear ids into the match and reset trait state every point', () => {
  const m = geared('r_star', 'sh_moon', 'r_tide', 'sh_cruise');
  assert.deepEqual({ ...m.players[0].gear }, { r: 'r_star', s: 'sh_moon' }); assert.deepEqual({ ...m.players[1].gear }, { r: 'r_tide', s: 'sh_cruise' });
  m.players[0].gt.cats.push('A'); m.players[1].gt.tideN = 5; m.resetPoint?.(0);
  assert.equal(m.players[0].gt.cats.length, 0); assert.equal(m.players[1].gt.tideN, 0);
  const plain = new YY.Match(); assert.ok(!plain.players[0].gear?.r && !plain.players[0].gear?.s);
});

test('racket traits: needle, precise, third, press and counter only fire under their conditions', () => {
  // 绣羽·细雨：网前甜区搓 / 放
  let m = geared('r_silk'), p = m.players[0];
  p.gt.hq = { pq: 0.8, tq: 0.5 }; assert.equal(m.gearShotMods(p, 'net').err, 0.8); assert.deepEqual(m.gearShotMods(p, 'tumble').keys, ['needle']);
  assert.equal(m.gearShotMods(p, 'clear').err, 1); p.gt.hq = { pq: 0.5, tq: 1 }; assert.equal(m.gearShotMods(p, 'net').err, 1, 'off the sweet spot');
  // 棱镜·定点：甜区 + 最佳时机同时满足
  m = geared('r_prism'); p = m.players[0];
  p.gt.hq = { pq: 0.9, tq: 0.9 }; assert.equal(m.gearShotMods(p, 'drop').err, 0.75);
  p.gt.hq = { pq: 0.9, tq: 0.6 }; assert.equal(m.gearShotMods(p, 'drop').err, 1);
  // 星轨·变奏：三拍分属三类
  m = geared('r_star'); p = m.players[0]; p.gt.hq = { pq: 0.5, tq: 0.5 };
  p.gt.cats = ['A', 'B']; assert.deepEqual(m.gearShotMods(p, 'smash').keys, ['third']); assert.ok(Math.abs(m.gearShotMods(p, 'smash').err - 0.8) < 1e-9);
  assert.equal(m.gearShotMods(p, 'clear').err, 1, 'repeating a category gives nothing'); p.gt.cats = ['A', 'A']; assert.equal(m.gearShotMods(p, 'smash').err, 1);
  // 雷霆·赤脊：机会在手时跳杀加速，其他球路不加
  m = geared('r_heavy'); p = m.players[0]; p.gt.hq = { pq: 0.5, tq: 0.5 };
  assert.equal(m.gearShotMods(p, 'smash').spd, 1); p.gt.press = 1;
  assert.ok(Math.abs(m.gearShotMods(p, 'smash').spd - 1.06) < 1e-9); assert.equal(m.gearShotMods(p, 'drop').spd, 1);
  // 磐盾·折返：站稳甜区接杀 + 平抽
  m = geared('r_shield'); p = m.players[0];
  p.gt.hq = { pq: 0.8, tq: 0.8, counter: true }; assert.ok(Math.abs(m.gearShotMods(p, 'drive').spd - 1.08) < 1e-9); assert.equal(m.gearShotMods(p, 'lift').spd, 1);
  p.gt.hq = { pq: 0.8, tq: 0.8, counter: false }; assert.equal(m.gearShotMods(p, 'drive').spd, 1);
  // 无器械：毫无影响
  m = geared(); p = m.players[0]; p.gt.hq = { pq: 1, tq: 1, counter: true }; assert.deepEqual(m.gearShotMods(p, 'drive'), { err: 1, spd: 1, keys: [] });
});

test('tide restores 3 stamina every 3 own returns that cross the net, capped at 9 per rally', () => {
  const m = geared('r_tide'), p = m.players[0], s = m.shuttle;
  p.stamina = 50;
  for (let i = 1; i <= 12; i++) {
    s.ver = i; s.live = true; s.lastHitter = 0; s.netHit = false; s.crossedNet = true; p.gt.pend = i;
    m.gearStep(); m.gearStep(); // 同一拍只算一次
  }
  assert.equal(p.gt.tideN, 12); assert.equal(p.gt.tideGain, 9); assert.equal(p.stamina, 59); assert.equal(gearEvents(m, 'tide').length, 3);
  // 过网失败（挂网）不计
  const m2 = geared('r_tide'), q = m2.players[0]; Object.assign(m2.shuttle, { ver: 1, live: true, lastHitter: 0, netHit: true, crossedNet: true }); q.gt.pend = 1; m2.gearStep(); assert.equal(q.gt.tideN, 0);
});

test('shoe traits: home, retreat, moon and pivot boost the first step for a moment, then cool down', () => {
  const dt = C.DT;
  // 羽翼·流步：回球后首次朝半场中心移动
  let m = geared('r_basic', 'sh_light'), p = m.players[0];
  p.x = p.side * 5.5; p.onGround = true; p.gt.home = 1;
  const toward = Math.sign(p.side * C.HALF * 0.5 - p.x) * p.dir;
  assert.ok(Math.abs(m.gearMove(p, toward, dt) - 1.1) < 1e-9); assert.equal(p.gt.home, 0); assert.equal(gearEvents(m, 'home').length, 1);
  for (let t = 0; t < 0.4; t += dt) m.gearMove(p, toward, dt);
  assert.equal(m.gearMove(p, toward, dt), 1, 'boost lasts 0.35 s'); m.gearAfterHit(p, { type: 'clear' }); assert.equal(p.gt.home, 0, 'cooldown: 3 s'); assert.equal(m.gearMove(p, toward, dt), 1);
  // 蝶步·探网：前场回球后首次后撤
  m = geared('r_basic', 'sh_butterfly'); p = m.players[0]; p.onGround = true; p.x = p.side * 1.5;
  m.shuttle.hitX = p.x; m.gearAfterHit(p, { type: 'net' }); assert.equal(p.gt.back, 1);
  assert.equal(m.gearMove(p, -p.side * p.dir, dt), 1, 'moving forward is not a retreat');
  assert.ok(Math.abs(m.gearMove(p, p.side * p.dir, dt) - 1.15) < 1e-9); assert.equal(gearEvents(m, 'retreat').length, 1);
  // 逐月·后撤：对手击球后 0.6 秒内首次后撤
  m = geared('r_basic', 'sh_moon'); p = m.players[0]; const o = m.players[1]; p.onGround = true;
  m.afterHit(o, { type: 'clear' }, 0.8, {}); assert.equal(p.gt.moonW, 0.6);
  assert.ok(Math.abs(m.gearMove(p, p.side * p.dir, dt) - 1.15) < 1e-9);
  m.afterHit(o, { type: 'clear' }, 0.8, {}); for (let t = 0; t < 0.62; t += dt) m.gearMove(p, 0, dt);
  p.gt.bt = 0; assert.equal(m.gearMove(p, p.side * p.dir, dt), 1, 'window closed after 0.6 s');
  // 磐石·定轴：持续跑动 0.3 秒后反向
  m = geared('r_basic', 'sh_stable'); p = m.players[0]; p.onGround = true;
  p.vx = 4; const fwd = Math.sign(p.vx) * p.dir;
  for (let t = 0; t < 0.35; t += dt) m.gearMove(p, fwd, dt);
  assert.ok(Math.abs(m.gearMove(p, -fwd, dt) - 1.15) < 1e-9); assert.equal(gearEvents(m, 'pivot').length, 1);
  p.vx = 4; p.gt.bt = 0; for (let t = 0; t < 0.35; t += dt) m.gearMove(p, fwd, dt);
  assert.equal(m.gearMove(p, -fwd, dt), 1, 'cooldown: 1.5 s');
  // 不在回合中不触发
  m = geared('r_basic', 'sh_light'); m.phase = 'serve'; p = m.players[0]; p.onGround = true; p.x = p.side * 5.5; p.gt.home = 1; assert.equal(m.gearMove(p, toward, dt), 1);
});

test('cruise breathes easier after 3 calm seconds; cushion makes the next jump within 2 s cheaper', () => {
  let m = geared('r_basic', 'sh_cruise'), p = m.players[0];
  let k = 1; for (let t = 0; t < 2.9; t += 0.1) k = m.gearRegen(p, 0.1); assert.equal(k, 1);
  for (let t = 0; t < 0.2; t += 0.1) k = m.gearRegen(p, 0.1); assert.equal(k, 1.15); assert.equal(gearEvents(m, 'calm').length, 1);
  m.gearJump(p); assert.equal(m.gearRegen(p, 0.1), 1, 'jumping ends it');
  m = geared('r_basic', 'sh_cushion'); p = m.players[0]; m.time = 10;
  assert.equal(m.gearJump(p), 1, 'first jump: no landing yet'); m.gearLanded(p); m.time = 11;
  assert.ok(Math.abs(m.gearJump(p) - 0.85) < 1e-9); assert.equal(gearEvents(m, 'rebound').length, 1);
  m.gearLanded(p); m.time = 12; assert.equal(m.gearJump(p), 1, 'cooldown: 6 s');
  m.gearLanded(p); m.time = 20.5; assert.equal(m.gearJump(p), 1, 'window: 2 s after landing');
});

test('full AI rallies with every trait gear stay valid and actually trigger the traits', () => {
  const seen = new Set();
  const sets = [['r_flex', 'sh_light', 'r_heavy', 'sh_cushion'], ['r_light', 'sh_stable', 'r_silk', 'sh_butterfly'], ['r_tide', 'sh_cruise', 'r_prism', 'sh_moon'], ['r_star', 'sh_moon', 'r_shield', 'sh_light']];
  seeded(4242, () => {
    for (const [r0, s0, r1, s1] of sets) {
      const m = new YY.Match({ target: 5, cap: 7, gear: [{ racket: r0, shoe: s0 }, { racket: r1, shoe: s1 }] });
      const bots = [new YY.AI(m, 0, 'hard', 'lingfeng'), new YY.AI(m, 1, 'hard', 'canglan')];
      for (let n = 0; n < 120 * 240 && m.phase !== 'over'; n++) {
        for (const ai of bots) ai.update(C.DT); m.step(C.DT);
        for (const e of m.events) if (e.type === 'gear') seen.add(e.k);
        m.events.length = 0;
        assert.ok(m.players.every(p => Number.isFinite(p.x) && p.stamina >= 0 && p.stamina <= C.STAM_MAX + 1e-9));
      }
      assert.equal(m.phase, 'over', r0 + ' vs ' + r1);
    }
  });
  for (const k of ['home', 'steady', 'tide', 'calm', 'moon']) assert.ok(seen.has(k), 'trait seen in play: ' + k + ' (' + [...seen].join(',') + ')');
  assert.ok(seen.size >= 9, [...seen].join(','));
});
