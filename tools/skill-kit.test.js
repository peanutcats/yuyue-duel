'use strict';
// 技能系统 v2：被动 + 三选二主动、按消耗释放、新机制与联机携带
const test = require('node:test'), assert = require('node:assert/strict');
const { loadGame } = require('./wechat-test-harness');
const { Rooms, YY: SERVER } = require('../server/rooms');

// 游戏代码运行在独立 VM 上下文里，比较前先转成本上下文的普通对象
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
const rally = (YY, kits) => { const m = new YY.Match({ skills: kits }); m.phase = 'rally'; return m; };

test('every character has one passive and three distinct, affordable actives with full descriptions', () => {
  const { YY, app } = loadGame();
  const seen = new Set();
  for (const c of YY.CHARS) {
    const pas = YY.SKILLS[c.passive];
    assert.ok(pas && pas.passive && pas.desc.length > 10, c.id + ' passive');
    assert.equal(c.acts.length, 3, c.id + ' has three actives');
    for (const id of c.acts) {
      const sk = YY.SKILLS[id];
      assert.ok(sk && !sk.passive, id);
      assert.ok(!seen.has(id), id + ' is unique to one character'); seen.add(id);
      assert.ok(sk.cost >= 20 && sk.cost <= 60, id + ' cost keeps casts frequent');
      assert.ok(sk.short.length <= 3 && sk.desc.length > 15 && sk.ai, id + ' has button label, description and AI timing');
    }
    assert.equal(c.skill, c.acts[0], 'legacy primary skill stays the first active');
  }
  app.destroy();
});

test('loadout picks two of three, persists per character, and rejects foreign skills', () => {
  const storage = new Map();
  const { YY, app } = loadGame({ storage });
  const P = YY.Profile;
  same(P.kit('houzi'), ['shanxian', 'duzi']);
  same(P.toggleKit('houzi', 'huicheng'), ['duzi', 'huicheng']);
  same(P.toggleKit('houzi', 'pokong'), ['duzi', 'huicheng'], 'other characters\' skills are ignored');
  same(P.cycleKit('laochen'), ['shuju', 'rebei']);
  same(P.cycleKit('laochen'), ['qingxi', 'rebei']);
  same(YY.skillSet('guoge', ['x', 'tangping', 'tangping']), { passive: 'benneng', act: ['tangping', 'touji'] });
  app.destroy();
  const again = loadGame({ storage });
  same(again.YY.Profile.kit('houzi'), ['duzi', 'huicheng'], 'saved locally');
  same(again.YY.Profile.kit('laochen'), ['qingxi', 'rebei']);
  again.app.destroy();
});

test('both slots cast by their own cost; energy is shared and casts are frequent', () => {
  const { YY, app } = loadGame();
  const m = rally(YY, [YY.skillSet('lingfeng', ['huiwei', 'quanli']), null]), p = m.players[0];
  p.energy = 70;
  m.handlePress(p, { btn: 'skill2' }); // 全力以赴 55
  assert.ok(p.buff.quanli > 0); assert.equal(p.energy, 15);
  p.skillCd = 0; m.handlePress(p, { btn: 'skill' }); // 回位 25：能量不够
  assert.ok(!(p.buff.huiwei > 0));
  p.energy = 25; m.handlePress(p, { btn: 'skill' });
  assert.ok(p.buff.huiwei > 0 && p.energy === 0);
  // 一局 7 分的 AI 对战里，每人能放好几次技能
  let casts = 0;
  for (let k = 0; k < 4; k++) {
    const g = new YY.Match({ skills: [YY.skillSet('lu'), YY.skillSet('zhu')], target: 7, cap: 11 });
    const ais = [new YY.AI(g, 0, 'normal', 'lu'), new YY.AI(g, 1, 'normal', 'zhu')];
    for (let t = 0; g.winner < 0 && t < 500; t += YY.C.DT) { ais.forEach(a => a.update(YY.C.DT)); g.step(YY.C.DT); casts += g.events.filter(e => e.type === 'skill').length; g.events.length = 0; }
  }
  assert.ok(casts / 8 >= 4, 'about one cast every couple of points, got ' + casts / 8);
  app.destroy();
});

test('control skills: root, whistle, 404 curse, cleanse and drain change the opponent', () => {
  const { YY, app } = loadGame();
  const m = rally(YY, [{ act: ['hanxing', 'shaosheng'] }, { act: ['lieyan'] }]), [a, b] = m.players;
  a.energy = 100; b.energy = 100; b.buff.lieyan = 5;
  m.useSkill(a, 0); assert.ok(b.buff.root > 0);
  m.inputs[1].move = 1; const x = b.x; m.updatePlayer(b, 0.1); assert.equal(b.x, x, 'rooted player cannot move');
  m.handlePress(b, { btn: 'jump' }); assert.ok(b.onGround, 'rooted player cannot jump');
  a.skillCd = 0; m.useSkill(a, 1); assert.ok(b.buff.stun > 0 && !(b.buff.lieyan > 0), 'whistle stuns and cancels buffs');
  m.handlePress(b, { btn: 'clear' }); assert.equal(b.swing, null, 'stunned player cannot swing');

  const c = rally(YY, [{ act: ['err404', 'qingxi'] }, { act: ['huanshi'] }]), [p, o] = c.players;
  p.energy = 100; o.energy = 80; c.useSkill(o, 0); assert.ok(c.slowT > 0);
  c.useSkill(p, 1); assert.equal(c.slowT, 0, 'cleanse removes slow time'); assert.ok(o.energy <= 40); assert.ok(p.buff.read > 0);
  p.skillCd = 0; p.energy = 100; c.useSkill(p, 0); assert.ok(o.buff.curse > 0);
  Object.assign(c.shuttle, { x: 3, y: 1.6, vx: 6, vy: 0, speed: 6, live: true, held: false, lastHitter: 0, crossedNet: true });
  o.x = 3.8; o.swing = { t: YY.C.SW_SWEET, btn: 'clear', kind: 'side', dur: YY.C.SW_DUR, hit: false, prevE: 99 };
  c.doHit(o, o.swing, 0, YY.C.REACH);
  const hit = c.events.find(e => e.type === 'hit' && e.p === 1);
  assert.ok(hit.q <= 0.35 && hit.cursed, '404 forces a weak return');

  const d = rally(YY, [{ act: ['tuichao'] }, null]);
  d.players[0].energy = 100; d.useSkill(d.players[0]);
  assert.equal(d.players[1].stamina, 50); assert.ok(d.players[1].buff.drained > 0);
  d.players[1].stamDelay = 0; d.updatePlayer(d.players[1], 0.5); assert.equal(d.players[1].stamina, 50, 'drained stamina does not recover');
  app.destroy();
});

test('guards save one landing shuttle, rally keeps going and no point is awarded', () => {
  const { YY, app } = loadGame();
  for (const [id, x] of [['baoxian', -5.6], ['rebei', -1.2]]) {
    const m = rally(YY, [{ act: [id] }, null]), p = m.players[0];
    p.energy = 100; m.useSkill(p);
    Object.assign(m.shuttle, { x: 0.5, y: 2, vx: -6, vy: 0, live: true, held: false, lastHitter: 1, crossedNet: false, netHit: false });
    m.onLand(x);
    assert.equal(m.phase, 'rally', id + ' keeps the rally alive');
    same(m.score, [0, 0]);
    assert.equal(m.shuttle.lastHitter, 0); assert.ok(!(p.buff[id] > 0), id + ' is consumed');
    let r = null; for (let t = 0; t < 5 && !r; t += YY.C.DT) r = YY.stepShuttle(m.shuttle, YY.C.DT);
    assert.ok(m.shuttle.x > 0 && Math.abs(m.shuttle.x) <= YY.C.HALF + YY.C.LINE_TOL, id + ' return lands in the opponent court');
  }
  const m = rally(YY, [{ act: ['rebei'] }, null]); m.players[0].energy = 100; m.useSkill(m.players[0]);
  Object.assign(m.shuttle, { lastHitter: 1, live: true, netHit: false }); m.onLand(-5.5);
  assert.equal(m.phase, 'point', 'front-court backup does not cover the rear court');
  app.destroy();
});

test('special shots stay playable: net crawl, quick drives, counters and the wobble land in court', () => {
  const { YY, app } = loadGame(), C = YY.C;
  const land = (m, sh) => { const s = { x: m.shuttle.x, y: m.shuttle.y, vx: sh.vx, vy: sh.vy, netHit: false }; let r = null; for (let t = 0; t < 5 && !r; t += C.DT) r = YY.stepShuttle(s, C.DT); return s; };
  let ok = 0, n = 0;
  for (const [buff, btn] of [['cuoqiu', 'drop'], ['pingchou', 'clear'], ['fantan', 'clear']]) for (let x = 0.6; x <= 6; x += 0.6) for (const h of [0.9, 1.4, 1.9, 2.4]) {
    const m = rally(YY, null), p = m.players[0]; p.x = -x - 0.7; p.buff[buff] = 5;
    Object.assign(m.shuttle, { x: -x, y: h, live: true, held: false, lastHitter: 1, crossedNet: true, shot: 'smash', speed: 20 });
    const s = land(m, m.resolveShot(p, btn, 0.8, false, { counter: buff === 'fantan' }));
    n++; if (!s.netHit && s.x > 0 && s.x <= C.HALF + C.LINE_TOL) ok++;
  }
  assert.ok(ok / n > 0.93, 'special shots land in ' + (ok / n * 100).toFixed(0) + '%');
  for (let i = 0; i < 20; i++) {
    const m = rally(YY, null);
    Object.assign(m.shuttle, { x: -0.05, y: 2.2, vx: 7 + i * 0.3, vy: 1, live: true, held: false, lastHitter: 0, wobble: true });
    let r = null; for (let t = 0; t < 5 && !r; t += C.DT) { m.step(C.DT); r = !m.shuttle.live; }
    assert.ok(m.landMark && m.landMark.inB, 'wobbled shuttle still lands in');
  }
  app.destroy();
});

test('jump smash is the hardest ball to defend while drives and half smashes give more time', () => {
  const { YY, app } = loadGame(), C = YY.C;
  const m = new YY.Match(), p = m.players[1];
  const fly = (btn, x, y, air) => {
    m.phase = 'rally'; p.x = x + 0.6; p.onGround = !air; m.players[0].x = -3;
    Object.assign(m.shuttle, { x, y, live: true, held: false });
    const sh = m.resolveShot(p, btn, 0.8, false), s = { x, y, vx: sh.vx, vy: sh.vy, netHit: false };
    let t = 0; while (s.x > -3 && t < 2) { YY.stepShuttle(s, C.DT); t += C.DT; }
    return { type: sh.type, t, v: Math.hypot(sh.vx, sh.vy) };
  };
  const smash = fly('smash', 4.6, 3.2, true), half = fly('smash', 4.6, 2.2, false), drive = fly('smash', 4.0, 1.7, false);
  assert.equal(smash.type, 'smash'); assert.equal(half.type, 'halfsmash'); assert.equal(drive.type, 'drive');
  assert.ok(smash.v > half.v * 1.4 && smash.v > drive.v * 1.5, 'jump smash is much faster');
  assert.ok(half.t > smash.t + 0.06 && drive.t > smash.t + 0.04, 'flat attacks arrive later than a jump smash');
  // 接跳杀：判定更紧、回球质量下降更多
  const r = new YY.Match(); r.phase = 'rally'; const q = r.players[0];
  Object.assign(r.shuttle, { speed: 20, shot: 'smash' }); const rs = r.reachFor(q);
  r.shuttle.shot = 'drive'; const rd = r.reachFor(q);
  assert.ok(rd > rs * 1.2);
  app.destroy();
});

test('online rooms carry each player\'s two skills; second skill key works and foreign kits are rejected', () => {
  const rooms = new Rooms({ clock: () => 0 }), socks = [0, 1].map(() => ({ readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); }, close() {} }));
  rooms.message(socks[0], { t: 'create', roomProtocol: 2, char: 'houzi', kit: ['duzi', 'huicheng'] });
  const room = [...rooms.rooms.values()][0];
  rooms.message(socks[1], { t: 'join', roomProtocol: 2, room: room.code, char: 'zhu', kit: ['pokong', 'lieyan'] });
  same(room.players.map(p => p.kit), [['duzi', 'huicheng'], ['jiaoke', 'shaosheng']]);
  assert.ok(socks[0].sent.find(m => m.t === 'welcome').features.includes('skill-kit-v2'));
  rooms.message(socks[1], { t: 'configure', revision: room.revision, kit: ['baowen', 'shaosheng'] });
  same(room.players[1].kit, ['baowen', 'shaosheng']);
  for (const ws of socks) rooms.message(ws, { t: 'ready', revision: room.revision, ready: true });
  room.countdownAt = 0; rooms.step();
  same(room.match.players[0].kit, { passive: 'wenti', act: ['duzi', 'huicheng'] });
  same(socks[1].sent.find(m => m.t === 'start').kits, [['duzi', 'huicheng'], ['baowen', 'shaosheng']]);
  room.match.phase = 'rally'; room.match.players[0].energy = 100;
  rooms.message(socks[0], { t: 'in', matchId: room.id, seq: 1, move: 0, presses: [{ id: 1, btn: 'skill2' }] });
  rooms.step();
  assert.ok(room.match.players[0].buff.huicheng > 0, 'second skill cast on the server');
  assert.equal(room.match.players[0].energy, 80);
  assert.ok(SERVER.SKILLS.huicheng);
});

test('mini-game shows two skill keys with costs, and the team screen switches the carried pair', () => {
  const h = loadGame(), { app, YY } = h;
  YY.Profile.unlock('char', 'houzi'); YY.Profile.choose('char', 'houzi');
  app.settings.skills = true; app.startAI('normal');
  const keys = app.ui.controls.filter(b => b.action === 'skill' || b.action === 'skill2');
  same(keys.map(b => [b.action, b.label, b.cost]), [['skill', '闪现', 35], ['skill2', '肚弹', 40]]);
  app.match.players[0].energy = 40; app.match.phase = 'rally';
  app.ctrlFor[0].push('skill2'); app.tick(YY.C.DT);
  assert.ok(app.match.players[0].buff.duzi > 0, 'second key casts the second carried skill');
  h.frames(3); // 对局画面（含两枚技能键与能量环）能正常绘制
  app.quit(); app.teamBack = 'menu'; app.gearTab = 'skills'; app.show('team'); h.frames(2);
  const btn = app.ui.buttons.find(b => b.id === 'kit-huicheng');
  assert.ok(btn, 'skills tab lists every active'); h.click('kit-huicheng');
  same(YY.Profile.kit('houzi'), ['duzi', 'huicheng']);
  h.app.destroy();
});

test('skill picker: tap to choose two skills in quick match and duo, with passive and full descriptions shown', () => {
  const h = loadGame(), { app, YY } = h;
  YY.Profile.unlock('char', 'laochen'); YY.Profile.choose('char', 'laochen');
  app.settings.skills = true; app.show('ai'); h.frames(1);
  h.click('loadout');
  assert.ok(app.ui.picker, 'picker opens from the quick-match row');
  for (const k of ['shuju', 'qingxi', 'rebei']) assert.ok(app.ui.buttons.some(b => b.id === 'pick-' + k), 'all three actives are selectable');
  assert.ok(!app.ui.buttons.some(b => b.id === 'easy'), 'picker is modal: page buttons underneath are disabled');
  const shown = h.texts ? h.texts.join('\n') : '';
  if (shown) assert.match(shown, /被动/);
  h.click('pick-shuju'); same(app.ui.picker.sel, ['qingxi']);
  assert.ok(app.ui.buttons.find(b => b.id === 'kit-ok').disabled, 'confirm needs exactly two');
  h.click('pick-rebei'); same(app.ui.picker.sel, ['qingxi', 'rebei']);
  h.click('pick-shuju'); same(app.ui.picker.sel, ['rebei', 'shuju'], 'a third tap replaces the earlier pick');
  h.click('kit-ok'); assert.equal(app.ui.picker, null);
  same(YY.Profile.kit('laochen'), ['rebei', 'shuju']);
  // 取消不保存
  h.click('loadout'); h.click('pick-rebei'); h.click('pick-qingxi'); h.click('kit-cancel');
  same(YY.Profile.kit('laochen'), ['rebei', 'shuju']);
  // 同屏：每位玩家各自打开面板
  app.show('duo'); h.frames(1);
  const id = app.duoChars().pick[1];
  h.click('duo-kit-1'); assert.equal(app.ui.picker.char, id);
  const acts = YY.char(id).acts;
  h.click('pick-' + acts[0]); h.click('pick-' + acts[2]);
  if (app.ui.picker.sel.length < 2) h.click('pick-' + acts[0]);
  const want = JSON.parse(JSON.stringify(app.ui.picker.sel));
  h.click('kit-ok'); same(YY.Profile.kit(id), want);
  // 离开页面时面板自动关闭
  h.click('duo-kit-0'); app.show('menu'); h.frames(1); assert.equal(app.ui.picker, null);
  h.app.destroy();
});

test('online lobby: pick my skills by tapping and view the friend\'s passive and carried skills read-only', () => {
  const fake = () => ({ readyState: 1, bufferedAmount: 0, send() {}, close() { this.readyState = 3; } });
  const bridge = (h, rooms) => {
    const ws = fake(), app = h.app, net = app.net;
    net.status = 'connected'; net.manual = false; net.awaitingWelcome = false;
    ws.send = raw => {
      const d = JSON.parse(raw);
      if (d.t === 'welcome') Object.assign(net, { code: d.room, player: d.player, token: d.token, features: d.features, seq: d.seq, action: d.action, status: 'connected' });
      else if (d.t !== 'pong' && d.t !== 'start') app.serverMessage(d);
    };
    net.send = d => { rooms.message(ws, d); return true; };
    return ws;
  };
  const a = loadGame(), b = loadGame(), r = new Rooms({ clock: () => 100 }), wa = bridge(a, r), wb = bridge(b, r);
  r.create(wa, { char: 'houzi', kit: ['shanxian', 'duzi'] }); r.join(wb, { room: a.app.net.code, char: 'guoge', kit: ['touji', 'tangping'] });
  a.click('room-ready'); assert.ok(a.app.roomState.players[0].ready);
  a.click('room-kit'); a.click('pick-shanxian'); a.click('pick-huicheng'); a.click('kit-ok');
  same(wa.slot.room.players[0].kit, ['duzi', 'huicheng']);
  assert.equal(a.app.roomState.players[0].ready, false, 'changing skills un-readies');
  b.click('room-peek');
  const pk = b.app.ui.picker; assert.ok(pk.readOnly); assert.equal(pk.char, 'houzi');
  same(pk.sel, ['duzi', 'huicheng']);
  assert.ok(!b.app.ui.buttons.some(btn => btn.id.startsWith('pick-')), 'friend\'s skills cannot be changed');
  b.click('kit-ok'); assert.equal(b.app.ui.picker, null);
  a.app.destroy(); b.app.destroy();
});
