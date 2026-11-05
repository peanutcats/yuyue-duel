'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { Rooms } = require('../server/rooms');
const { loadGame } = require('./wechat-test-harness');
const fake = () => ({ readyState: 1, bufferedAmount: 0, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); }, close() { this.readyState = 3; } });
function roomHarness() {
  let time = 100;
  const r = new Rooms({ clock: () => time }), a = fake(), b = fake();
  r.create(a, { char: 'xiaohong' }); const room = a.slot.room;
  r.join(b, { room: room.code, char: 'ranran' });
  const ready = () => { for (const ws of [a, b]) r.message(ws, { t: 'ready', ready: true, revision: room.revision }); };
  const advance = seconds => { time += seconds; r.step(); };
  const alive = () => { for (const ws of [a, b]) if (ws.readyState === 1) r.message(ws, { t: 'ping', ts: 1, active: true }); };
  return { r, a, b, room, ready, advance, alive };
}

test('room waits for both confirmations of the current revision, counts down, and cancels on character/rule changes', () => {
  const h = roomHarness(), { r, a, b, room } = h;
  assert.equal(room.match, null); assert.equal(room.phase, 'lobby');
  r.message(a, { t: 'ready', ready: true, revision: room.revision }); h.advance(2);
  assert.equal(room.phase, 'lobby');
  r.message(b, { t: 'configure', skills: false, revision: room.revision });
  assert.equal(room.rules.skills, true, 'guest cannot change host rules');
  h.ready(); assert.equal(r.roomState(room).countdown, 3); h.advance(1); h.alive();
  assert.equal(r.roomState(room).countdown, 2); assert.equal(room.match, null);
  const stale = room.revision;
  r.message(b, { t: 'configure', char: 'zhu', revision: stale });
  assert.equal(room.phase, 'lobby'); assert.ok(room.players.every(p => !p.ready));
  r.message(a, { t: 'ready', ready: true, revision: stale }); assert.equal(a.slot.ready, false);
  h.ready(); h.advance(1.5); h.alive(); h.advance(1.49);
  assert.equal(room.match, null); h.advance(.02);
  assert.equal(room.phase, 'playing'); assert.deepEqual(room.chars, ['xiaohong', 'zhu']);
  assert.equal(room.round, 1);
  assert.deepEqual(room.match.players.map(p => p.skill), ['lieyan', 'jiaoke']);
  r.message(a, { t: 'configure', char: 'lu', skills: false, revision: room.revision });
  assert.deepEqual(room.chars, ['xiaohong', 'zhu']); assert.equal(room.rules.skills, true);
});

test('countdown cancels on background/disconnect; reconnect expires exactly at deadline and old socket cannot mutate seat', () => {
  const h = roomHarness(), { r, a, b, room } = h;
  h.ready(); r.message(a, { t: 'away' }); assert.equal(room.phase, 'lobby');
  h.alive(); h.ready(); const token = b.slot.token;
  b.readyState = 3; r.disconnected(b); assert.equal(room.phase, 'lobby');
  h.advance(7); assert.equal(r.roomState(room).players[1].reconnect, 13);
  const resumed = fake(); r.resume(resumed, { room: room.code, token });
  assert.equal(resumed.slot, b.slot); assert.equal(resumed.slot.ready, false);
  r.message(b, { t: 'configure', char: 'lu', revision: room.revision });
  assert.equal(resumed.slot.char, 'ranran');
  resumed.readyState = 3; r.disconnected(resumed); h.advance(19.9);
  assert.equal(r.roomState(room).players[1].reconnect, 1);
  h.advance(.1); assert.equal(r.rooms.size, 0);
  const expired = fake(); r.resume(expired, { room: room.code, token }); assert.equal(expired.slot, undefined);
});

test('rules apply on server; results count once; changing character for a rematch retains room series', () => {
  const h = roomHarness(), { r, a, b, room } = h;
  r.message(a, { t: 'configure', skills: false, revision: room.revision });
  h.ready(); r.start(room); assert.equal(room.match.skillsOn, false);
  r.message(a, { t: 'in', matchId: room.id, seq: 1, move: 0, presses: [{ id: 1, btn: 'skill' }] });
  assert.equal(a.slot.queue.length, 0);
  const id = room.id;
  room.match.phase = 'over'; room.match.winner = 1; room.match.score = [4, 7];
  r.step(); r.step(); r.recordResult(room); assert.deepEqual(room.wins, [0, 1]);
  r.message(a, { t: 'rematch', wins: [99, 0] }); r.message(b, { t: 'rematch' });
  assert.equal(room.phase, 'lobby'); assert.equal(room.match, null); assert.deepEqual(room.wins, [0, 1]);
  assert.deepEqual(room.lastResult.score, [4, 7]);
  r.message(b, { t: 'configure', char: 'lu', revision: room.revision });
  r.message(a, { t: 'configure', skills: true, revision: room.revision });
  h.ready(); r.start(room); assert.notEqual(room.id, id); assert.equal(room.round, 2);
  assert.equal(room.match.players[1].skill, 'lengxiao'); assert.deepEqual(room.wins, [0, 1]);
  r.message(a, { t: 'in', matchId: id, seq: 2, move: 1, presses: [] }); assert.equal(a.slot.seq, 1);
});

function seeded(h, seed) { vm.runInContext(`Math.random = (() => { let s = ${seed}; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })()`, h.context); }

test('AI personalities have measurable shot preferences and recovery weaknesses without changing physics stats', () => {
  const h = loadGame(), { YY } = h; seeded(h, 1105);
  const distributions = {};
  for (const id of YY.CHARS.map(c => c.id)) {
    const m = new YY.Match({}), ai = new YY.AI(m, 1, 'normal', id), count = { clear: 0, drop: 0, smash: 0 };
    m.players[0].x = -3.3;
    for (let n = 0; n < 1200; n++) count[ai.decideShot({ band: 'over', x: 3.5, y: 2.2 })]++;
    distributions[id] = count;
    assert.deepEqual({ ...m.players[0].st }, { ...m.players[1].st });
  }
  assert.ok(distributions.ranran.drop > distributions.ruibao.drop * 1.8);
  assert.ok(distributions.xiaohong.smash > distributions.ruibao.smash * 3);
  assert.ok(distributions.ruibao.clear > distributions.xiaohong.clear * 1.3);
  const m = new YY.Match({}), attack = new YY.AI(m, 1, 'normal', 'xiaohong'), defense = new YY.AI(m, 1, 'normal', 'ruibao');
  m.players[1].lastShot = 'smash'; attack.setHome(); defense.setHome();
  assert.ok(attack.homeAt > defense.homeAt); assert.ok(attack.homeD < defense.homeD);
  const net = new YY.AI(m, 1, 'normal', 'ranran'); m.players[1].lastShot = 'drop'; net.setHome(); defense.setHome();
  assert.ok(net.homeD < defense.homeD - .5);
  const pro = new YY.AI(m, 1, 'hard', 'zhu');
  m.history[0] = ['clear', 'clear']; vm.runInContext('Math.random = () => .1', h.context); pro.setHome(); assert.equal(pro.homeD, 4.2);
  m.history[0] = ['clear', 'drop']; pro.setHome(); assert.ok(pro.homeD < 3.2, 'changing depth breaks the read');
  h.app.destroy();
});

test('all character AI matches finish with valid scores and stamina under actual fixed-step simulation', () => {
  const h = loadGame(), { YY } = h; seeded(h, 876);
  for (const char of YY.CHARS) {
    const m = new YY.Match({ target: 3, cap: 5, skills: ['pokong', char.skill] });
    const bots = [new YY.AI(m, 0, 'hard', 'lingfeng'), new YY.AI(m, 1, 'normal', char.id)];
    for (let n = 0; n < 120 * 180 && m.phase !== 'over'; n++) {
      for (const ai of bots) ai.update(YY.C.DT); m.step(YY.C.DT); m.events.length = 0;
      assert.ok(m.players.every(p => Number.isFinite(p.x) && p.stamina >= 0), char.id);
    }
    assert.equal(m.phase, 'over', char.id); assert.ok(m.score[m.winner] >= 3 && m.score[m.winner] <= 5);
  }
  h.app.destroy();
});

test('tactical lesson keeps completed steps on a miss and requires the right shot in the right zone', () => {
  const h = loadGame(), { YY } = h, m = new YY.Match({ practice: true }), pr = new YY.TacticsPractice(m);
  const land = x => ({ type: 'pland', hitter: 0, x, inB: true });
  pr.fed = true; pr.playerHit = { shot: 'drop', name: '吊球' }; pr.evaluate(land(5)); assert.equal(pr.completed, 0);
  pr.fed = true; pr.playerHit = { shot: 'clear', name: '高远' }; pr.evaluate(land(3)); assert.equal(pr.completed, 0);
  pr.fed = true; pr.playerHit = { shot: 'clear', name: '高远' }; pr.evaluate(land(5.2)); assert.equal(pr.completed, 1);
  pr.feed(); assert.equal(pr.stage, 1);
  pr.playerHit = null; pr.evaluate({ ...land(-4), hitter: 1 }); assert.equal(pr.stage, 1); assert.equal(pr.completed, 1);
  pr.fed = true; pr.playerHit = { shot: 'drop', name: '吊球' }; pr.evaluate(land(1.4)); pr.feed();
  assert.equal(pr.stage, 2); assert.equal(pr.completed, 2);
  pr.playerHit = { shot: 'halfsmash', name: '点杀' }; pr.evaluate(land(3)); assert.equal(pr.done, false);
  pr.fed = true; pr.playerHit = { shot: 'smash', speed: 20 }; pr.evaluate(land(3));
  assert.equal(pr.done, true); assert.equal(pr.completed, 3); assert.ok(m.events.some(e => e.type === 'tacticsDone'));
  h.app.destroy();
});

test('tactical lesson is physically completable following the displayed cues across seeded feeds', () => {
  const attempts = [];
  for (let seed = 1; seed <= 5; seed++) {
    const h = loadGame(), { YY } = h; seeded(h, seed);
    const m = new YY.Match({ practice: true }), pr = new YY.TacticsPractice(m);
    let hit = -1, jumped = false, swung = false;
    for (let n = 0; n < 120 * 90 && !pr.done; n++) {
      const inp = m.inputs[0], p = m.players[0], hint = m.hint;
      if (hit !== m.hitCount) { hit = m.hitCount; jumped = swung = false; }
      if (hint && m.shuttle.lastHitter === 1) {
        if (hint.standX != null) { const dx = hint.standX - p.x; inp.move = Math.abs(dx) < .05 ? 0 : YY.clamp(dx / .3, -1, 1); }
        if (hint.jumpAt != null && !jumped && m.time >= hint.jumpAt) { inp.presses.push({ btn: 'jump' }); jumped = true; }
        if (!swung && m.time >= hint.swingAt) { inp.presses.push({ btn: pr.drill === 'smash' ? 'smash' : pr.drill }); swung = true; }
      } else inp.move = 0;
      pr.update(YY.C.DT); m.step(YY.C.DT);
      for (const event of m.events.splice(0)) pr.onEvent(event);
    }
    assert.ok(pr.done, `seed ${seed}: step ${pr.stage}, attempts ${pr.att}, ${pr.msg}`);
    assert.equal(pr.completed, 3); attempts.push(pr.att); h.app.destroy();
  }
  assert.ok(Math.max(...attempts) <= 8, 'hint-following learner should not need excessive retries');
});

function bridge(h, rooms) {
  const ws = fake(), app = h.app, net = app.net;
  net.status = 'connected'; net.manual = false; net.awaitingWelcome = false;
  ws.send = raw => {
    const d = JSON.parse(raw);
    if (d.t === 'welcome') Object.assign(net, { code: d.room, player: d.player, token: d.token, features: d.features, seq: d.seq, action: d.action, status: 'connected' });
    else if (d.t === 'start') { net.matchId = d.matchId; app.startOnline(d); }
    else if (d.t !== 'pong') app.serverMessage(d);
  };
  net.send = d => { rooms.message(ws, d); return true; };
  return ws;
}

test('two native clients can select, confirm, cancel, start without skills and change characters for the next round', () => {
  const a = loadGame(), b = loadGame(); let time = 100;
  const r = new Rooms({ clock: () => time }), wa = bridge(a, r), wb = bridge(b, r);
  r.create(wa, { char: 'xiaohong' }); r.join(wb, { room: a.app.net.code, char: 'ranran' });
  const room = wa.slot.room;
  assert.equal(a.app.screen, 'lobby'); assert.equal(b.app.screen, 'lobby');
  a.click('room-ready'); assert.ok(a.app.roomState.players[0].ready);
  b.click('room-next'); assert.equal(a.app.roomState.players[0].ready, false);
  assert.equal(a.app.roomState.players[1].char, 'ruibao');
  a.click('room-rules'); assert.equal(b.app.roomState.rules.skills, false);
  a.click('room-ready'); b.click('room-ready'); assert.equal(a.app.roomState.countdown, 3);
  time += 3; for (const ws of [wa, wb]) r.message(ws, { t: 'ping', active: true }); r.step();
  for (const h of [a, b]) { assert.equal(h.app.mode, 'online'); assert.equal(h.app.onlineSkills(), false); assert.ok(!h.app.ui.controls.some(c => c.action === 'skill')); }
  room.match.phase = 'over'; room.match.winner = 1; room.match.score = [2, 7]; r.recordResult(room); r.broadcast(room);
  assert.match(a.app.roomScore(), /你 0 : 1 好友/); assert.match(b.app.roomScore(), /你 1 : 0 好友/);
  a.app.restart(); assert.equal(a.app.screen, 'lobby'); assert.equal(b.app.screen, 'lobby');
  a.click('room-next'); a.click('room-rules'); a.click('room-ready'); b.click('room-ready');
  time += 3; for (const ws of [wa, wb]) r.message(ws, { t: 'ping', active: true }); r.step();
  assert.equal(room.round, 2); assert.equal(a.app.onlineChars[0], 'ranran');
  assert.ok(a.app.ui.controls.some(c => c.action === 'skill' && c.label === '缓时'));
  assert.deepEqual(room.wins, [0, 1]);
  a.app.destroy(); b.app.destroy();
});

test('outdated clients get an upgrade message instead of entering an unstartable room', () => {
  const r = new Rooms(), old = fake(), current = fake();
  r.message(old, { t: 'create' }); assert.equal(r.rooms.size, 0);
  assert.equal(old.messages.at(-1).t, 'error'); assert.match(old.messages.at(-1).message, /版本需要更新/);
  r.message(current, { t: 'create', roomProtocol: 2 }); assert.equal(r.rooms.size, 1);
});

test('result screen keeps opponent reconnect countdown visible and tutorial completion cannot reopen a discarded lesson', () => {
  const h = loadGame(), { app } = h;
  app.mode = 'online'; app.playerIndex = 0; app.net.player = 0;
  app.result = { title: '胜利', won: true, score: [7, 3], names: ['你', '好友'], stats: [{}, {}], note: '训练提示' };
  app.serverWait = '好友连接中断，等待重连（剩余 13 秒）'; app.show('result'); app.ui.draw();
  assert.ok(h.texts.includes(app.serverWait));
  app.startPractice('tactics'); app.startAttract(); app.show('menu'); app.finishTactics();
  assert.equal(app.screen, 'menu'); app.destroy();
});
