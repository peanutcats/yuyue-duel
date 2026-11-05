'use strict';
// 故事扩写、剧情场景、对战技能、新球路的回归测试
const test = require('node:test'), assert = require('node:assert/strict');
const { loadGame } = require('./wechat-test-harness');
const { Rooms, YY: SERVER } = require('../server/rooms');

test('every story dialog has a drawable scene, known speakers and valid expressions', () => {
  const h = loadGame(), { app, YY } = h;
  const ids = new Set(YY.CHARS.map(c => c.id));
  for (const st of YY.STAGES) for (const step of st.steps) {
    if (step.t !== 'dialog') continue;
    assert.ok(YY.SCENES[step.scene], `${st.id} uses unknown scene ${step.scene}`);
    step.lines.forEach(([who, text, mood], i) => {
      assert.ok(who === 'me' || who === 'mm' || who === 'nar' || ids.has(who), `${st.id}: unknown speaker ${who}`);
      assert.ok(text.length > 0);
      if (mood) assert.ok(YY.MOODS.includes(mood) || mood === 'focus', `${st.id}: unknown mood ${mood}`);
      const view = app.storyView({ step, i, lines: step.lines }, true);
      for (let k = 0; k < 3; k++) app.R.drawStory(view, 0.2); // 入场动画、烟花、闪电等动态层都要跑到
    });
  }
  app.destroy();
});

test('new cast members are unlocked by the story and old saves migrate to the renumbered stages', () => {
  const storage = new Map([['yuyue.profile', JSON.stringify({ v: 1, chars: ['lingfeng', 'canglan', 'xiaohong'], stages: { '0-3': 3, '2-3': 2, '3-1': 1, '5-3': 1 }, sel: { char: 'xiaohong' } })]]);
  const h = loadGame({ storage }), { YY } = h;
  assert.deepEqual({ ...YY.Profile.d.stages }, { '0-3': 3, '3-3': 2, '5-1': 1, '7-3': 1 });
  for (const id of ['xingxing', 'lu', 'zhu', 'houzi', 'laochen', 'guoge']) {
    const c = YY.char(id), st = YY.stage(c.lock);
    assert.ok(st.rewards.chars.includes(id), id + ' unlocked by its stage');
    assert.ok(YY.SKILLS[c.skill], id + ' has a skill');
  }
  // 已通关的旧关卡在插入新章节后依然可以进入
  assert.ok(YY.stageOpen('3-3')); assert.ok(YY.stageOpen('0-4')); assert.ok(!YY.stageOpen('2-2'));
  h.app.destroy();
});

test('new skills change the rally: meteor drop, laughing opponent and textbook returns', () => {
  const h = loadGame(), { YY } = h, C = YY.C;
  const m = new YY.Match({ skills: ['liuxing', 'lengxiao'] });
  m.phase = 'rally';
  const [a, b] = m.players;
  a.energy = b.energy = 100;
  assert.ok(m.useSkill(b));
  assert.ok(a.buff.laugh > 0 && b.buff.lengxiao > 0);
  const x0 = a.x; m.inputs[0].move = 1; for (let i = 0; i < 30; i++) m.updatePlayer(a, C.DT);
  const slowed = Math.abs(a.x - x0);
  const n = new YY.Match({}); n.phase = 'rally'; const c = n.players[0], y0 = c.x; n.inputs[0].move = 1; for (let i = 0; i < 30; i++) n.updatePlayer(c, C.DT);
  assert.ok(slowed < Math.abs(c.x - y0) * 0.8, 'laughing player moves slower');

  assert.ok(m.useSkill(a));
  const s = m.shuttle; s.x = -3.5; s.y = 2.6; s.live = true;
  const shot = m.resolveShot(a, 'drop', 0.9, false);
  assert.ok(shot.meteor, 'next drop becomes a meteor');

  const t = new YY.Match({ skills: ['jiaoke', null] }); t.phase = 'rally'; t.players[0].energy = 100; t.useSkill(t.players[0]);
  assert.ok(t.players[0].buff.jiaoke > 0);
  h.app.destroy();
});

test('net play produces kills, tumbling net shots and pushes; ground smashes become stick smashes', () => {
  const h = loadGame(), { YY } = h;
  const m = new YY.Match({}); m.phase = 'rally';
  const p = m.players[0], s = m.shuttle;
  const shot = (btn, x, y, q = 0.9, move = 0, air = false) => { s.x = x; s.y = y; p.onGround = !air; m.inputs[0].move = move; return m.resolveShot(p, btn, q, false).type; };
  assert.equal(shot('smash', -1.0, 2.0), 'kill');
  assert.equal(shot('drop', -1.0, 1.5), 'tumble');
  assert.equal(shot('drop', -1.0, 1.5, 0.3), 'net');
  assert.equal(shot('clear', -1.2, 1.4, 0.8, 1), 'push');
  assert.equal(shot('smash', -4.0, 2.2), 'halfsmash');
  assert.equal(shot('smash', -4.0, 2.7, 0.9, 0, true), 'smash');
  for (const type of ['kill', 'tumble', 'push', 'halfsmash']) assert.ok(YY.SHOT_NAMES[type] && YY.SHOT_CAT[type]);
  h.app.destroy();
});

test('same-screen duel: both players pick characters and each gets a working skill button', () => {
  const h = loadGame(), { app, YY } = h;
  ['xingxing', 'lu'].forEach(id => YY.Profile.unlock('char', id));
  app.show('friend'); h.click('local'); assert.equal(app.screen, 'duo');
  h.click('duo-next-1'); h.frames();
  app.duoPick = ['xingxing', 'lu'];
  h.click('duo-start');
  assert.equal(app.mode, 'local');
  assert.deepEqual([...app.match.players.map(p => p.skill)], ['liuxing', 'lengxiao']);
  const btn = app.ui.controls.find(b => b.id === 'p1-skill');
  assert.ok(btn && app.ui.controls.find(b => b.id === 'p0-skill'));
  app.match.players[1].energy = 100; app.match.phase = 'rally';
  h.touch('Start', [[3, btn.x, btn.y]]); h.touch('End', [[3, btn.x, btn.y]]); h.frames(2);
  assert.ok(app.match.players[0].buff.laugh > 0, 'P2 used 冷笑话 on P1');
  for (const b of app.ui.controls) if (!b.dir) assert.ok(b.x - b.r >= 0 && b.x + b.r <= app.ui.W && b.y + b.r <= app.ui.H, b.id + ' on screen');
  app.destroy();
});

test('online rooms: confirmed characters, skill presses, snapshots and default roster fallback', () => {
  const fake = () => ({ readyState: 1, bufferedAmount: 0, messages: [], send(s) { this.messages.push(JSON.parse(s)); }, close() { this.readyState = 3; } });
  const r = new Rooms(), a = fake(), b = fake();
  r.create(a, { venue: 'neon', char: 'zhu' }); r.join(b, { room: a.slot.room.code, char: 'hacker' });
  const revision = a.slot.room.revision;
  r.ready(a.slot, { revision, ready: true }); r.ready(b.slot, { revision, ready: true }); r.start(a.slot.room);
  const room = a.slot.room;
  assert.ok(a.messages[0].features.includes('ready-room-v1'));
  assert.deepEqual(room.chars, ['zhu', 'canglan'], 'unknown characters fall back to defaults');
  assert.deepEqual(room.match.players.map(p => p.skill), ['jiaoke', 'chaoxi']);
  assert.deepEqual(room.match.players[0].st, room.match.players[1].st, 'online stats stay equal');
  room.match.players[0].energy = 100; room.match.phase = 'rally';
  r.message(a, { t: 'in', matchId: room.id, seq: 1, move: 0, presses: [{ id: 1, btn: 'skill' }] });
  r.step();
  assert.ok(room.match.players[0].buff.jiaoke > 0);
  r.broadcast(room);
  const sn = b.messages.at(-1);
  assert.deepEqual(sn.ch, ['zhu', 'canglan']);
  assert.equal(sn.fx[0][0][1], 'jiaoke');
  // No chosen character: both seats receive a valid default before confirming.
  const r2 = new Rooms(), c = fake(), d = fake();
  r2.create(c, {}); r2.join(d, { room: c.slot.room.code });
  r2.ready(c.slot, { revision: c.slot.room.revision, ready: true }); r2.ready(d.slot, { revision: c.slot.room.revision, ready: true }); r2.start(c.slot.room);
  assert.deepEqual(c.slot.room.chars, ['lingfeng', 'canglan']);
});

test('guest view applies character looks, energy and buffs from snapshots', () => {
  const h = loadGame(), { YY } = h;
  const m = new YY.Match({ skills: ['liuxing', 'lengxiao'] });
  m.players[0].energy = 64; m.players[1].buff.lengxiao = 2; m.players[0].buff.laugh = 2;
  const sn = { ...SERVER.snapshot(m, [], 10), ch: ['xingxing', 'lu'] };
  const v = new YY.GuestView(); v.push(sn, 10); v.update(10.2);
  assert.equal(v.players[0].energy, 64);
  assert.ok(v.players[0].buff.laugh > 0 && v.players[1].buff.lengxiao > 0);
  assert.equal(v.looks[1].name, '路先森');
  assert.ok(v.skillsOn);
  h.app.destroy();
});

test('new cast skills: blink repositions, data read reveals and perfects, opportunist pump refunds energy', () => {
  const h = loadGame(), { YY } = h, C = YY.C;
  // 猿人闪现：对手击球后瞬移到可击球位置
  const m = new YY.Match({ skills: ['shanxian', null] }); m.phase = 'rally';
  const [a, b] = m.players; a.energy = 100; assert.ok(m.useSkill(a)); a.x = -6.5;
  const s = m.shuttle; s.x = 1.5; s.y = 2.2; s.live = true; s.held = false; s.lastHitter = 0;
  const shot = m.resolveShot(b, 'clear', .9, false); s.vx = shot.vx; s.vy = shot.vy;
  m.afterHit(b, shot, .9, {});
  assert.notEqual(a.x, -6.5); assert.equal(a.blinks, 1); assert.ok(a.buff.blinkQ > 0);
  assert.ok(m.events.some(e => e.type === 'blink'));
  // 数据透视：隐藏落点显形，连续同类球路触发必定完美
  const d = new YY.Match({ skills: ['shuju', 'jinghua'] }); d.phase = 'rally';
  const [p, o] = d.players; p.energy = 100; d.useSkill(p);
  d.history[1] = ['drop', 'drop']; d.shuttle.feint = .5;
  d.pred = { hidden: true, pts: [], landX: 3 }; d.reactSkills(o, .9);
  assert.equal(d.pred.hidden, false); assert.equal(d.shuttle.feint, 0); assert.ok(p.buff.read > 0);
  // 投机抄底：机会球后扣杀变爆发，得分返还能量
  const g = new YY.Match({ skills: ['touji', null] }); g.phase = 'rally';
  const [q, r] = g.players; q.energy = 100; q.stamina = 30; g.useSkill(q);
  assert.equal(q.stamina, 70); g.pred = { pts: [], landX: 3 }; g.reactSkills(r, .3);
  assert.ok(q.buff.chance > 0);
  g.shuttle.x = -1.2; g.shuttle.y = 2.4; q.onGround = true;
  const k = g.resolveShot(q, 'smash', .9, false); assert.ok(k.pump && k.fire);
  h.app.destroy();
});

test('story steps can hand the player a teammate, including one chosen in the same stage', () => {
  const h = loadGame(), { YY, app } = h;
  YY.STAGES.slice(0, YY.STAGES.findIndex(s => s.id === '7-1') + 1).forEach(s => YY.Profile.setStars(s.id, 1));
  app.startStage('1-5'); app.story.i = 1; app.runStep();
  assert.equal(app.match.looks[0].name, '猴子'); assert.deepEqual(app.match.players[0].skill, 'shanxian');
  app.startStage('4-3'); app.story.i = 1; app.runStep(); assert.equal(app.match.looks[0].name, '老陈');
  app.startStage('7-1'); app.story.i = 1; app.runStep();
  app.quizAnswer(1); app.quizNext(); assert.equal(app.match.looks[0].name, '果哥');
  assert.equal(YY.Profile.sel.char, 'lingfeng', 'forced lineup does not change the saved selection');
  app.startStage('4-2'); app.story.i = 1; app.runStep(); assert.equal(app.match.players[1].energy, 100);
  h.app.destroy();
});
