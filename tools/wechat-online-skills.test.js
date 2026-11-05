'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { Rooms, YY } = require('../server/rooms');
const { loadGame } = require('./wechat-test-harness');
const copy = value => JSON.parse(JSON.stringify(value));

// Exercise the actual input, server event serialization, GuestView and RAF path.
// Only the socket transport and wall clock are replaced for deterministic tests.
function onlineGame(t, chars, { legacy = false, skills = true } = {}) {
  let now = .1;
  const rooms = new Rooms({ clock: () => now });
  const sockets = [0, 1].map(() => ({ readyState: 1, bufferedAmount: 0, messages: [],
    send(raw) { this.messages.push(JSON.parse(raw)); }, close() { this.readyState = 3; } }));
  rooms.create(sockets[0], { char: chars[0], skills, venue: 'neon' });
  const room = sockets[0].slot.room;
  rooms.join(sockets[1], { room: room.code, char: chars[1] });
  for (const ws of sockets) rooms.ready(ws.slot, { ready: true, revision: room.revision });
  rooms.start(room);
  const clients = sockets.map((ws, i) => {
    const h = loadGame(), { app } = h;
    t.after(() => app.destroy());
    app.net.player = i; app.net.code = room.code; app.net.features = ['skills', 'ready-room-v1'];
    app.net.serverTime = () => now;
    app.net.send = packet => { rooms.message(ws, copy(packet)); return true; };
    app.startOnline(rooms.startMessage(room));
    return h;
  });
  function deliver(i, packet) {
    const sn = copy(packet);
    if (legacy) for (const event of sn.ev || []) delete event.skillId;
    clients[i].app.serverMessage(sn);
  }
  function broadcast() {
    rooms.broadcast(room);
    sockets.forEach((ws, i) => deliver(i, ws.messages.at(-1)));
  }
  function frames(count = 1) {
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 2; j++) { now += YY.C.DT; rooms.step(); }
      broadcast();
      for (const h of clients) h.frames();
    }
  }
  function tap(i, id) {
    const h = clients[i], button = h.app.ui.controls.find(b => b.id === id);
    assert.ok(button, id + ' control exists');
    h.touch('Start', [[1, button.x, button.y]]); h.touch('End', [[1, button.x, button.y]]);
  }
  sockets.forEach((ws, i) => deliver(i, ws.messages.at(-1)));
  frames(3);
  return { rooms, room, sockets, clients, frames, broadcast, deliver, tap };
}

for (const char of YY.CHARS) for (const player of [0, 1]) {
  test(`online ${char.id}: player ${player} uses skill and both clients keep rendering and sending input`, t => {
    const chars = ['lingfeng', 'canglan']; chars[player] = char.id;
    const g = onlineGame(t, chars), effects = [[], []];
    g.clients.forEach(({ app }, i) => {
      const cutIn = app.R.skillCutIn.bind(app.R);
      app.R.skillCutIn = (look, skill, left) => { effects[i].push({ name: skill.name, left }); cutIn(look, skill, left); };
    });
    g.room.match.players[player].energy = 100;
    g.broadcast(); g.frames(3);
    g.tap(player, 'skill'); g.frames(1);
    const packets = g.sockets.map(ws => copy(ws.messages.at(-1)));
    const event = packets[0].ev.find(e => e.type === 'skill');
    assert.ok(event, 'server accepted the skill press');
    // Drain the interpolation buffer through real app frames, where the freeze occurred.
    g.frames(5);
    for (const [i, h] of g.clients.entries()) {
      assert.deepEqual(effects[i], [{ name: YY.SKILLS[char.skill].name, left: player === i }]);
      assert.ok(h.app.raf != null, 'next frame is still scheduled');
    }
    assert.equal(event.skillId, char.skill, 'wire payload preserves the skill identifier');
    assert.ok(Number.isSafeInteger(event.id), 'wire sequence is still numeric');
    assert.deepEqual(packets[0].ev, packets[1].ev);
    assert.ok(g.room.match.players[player].energy < 100, 'skill consumes authoritative energy');
    // Duplicate events in a later snapshot must not play the cut-in a second time.
    g.clients.forEach((h, i) => g.deliver(i, { ...g.sockets[i].messages.at(-1), ev: packets[i].ev }));
    g.frames(5);
    for (const list of effects) assert.equal(list.length, 1);
    const seq = g.sockets.map(ws => ws.slot.seq), ticks = g.clients.map(h => h.app.tickN);
    const time = g.room.match.time;
    // Keep the match alive beyond the server's 1.2-second input timeout.
    g.frames(90);
    assert.ok(g.room.match.time > time + 1);
    g.clients.forEach((h, i) => {
      assert.ok(h.app.tickN > ticks[i]); assert.ok(g.sockets[i].slot.seq > seq[i]);
      assert.equal(h.app.serverWait, null); assert.ok(h.app.raf != null);
    });
  });
}

test('online skill effects also work with legacy servers that only send numeric event IDs', t => {
  const g = onlineGame(t, ['lu', 'laochen'], { legacy: true });
  for (const player of [0, 1]) {
    g.room.match.players[player].energy = 100; g.broadcast(); g.frames(3);
    g.tap(player, 'skill'); g.frames(6);
    for (const { app } of g.clients) {
      assert.equal(app.R.cutin.name, YY.SKILLS[g.room.match.players[player].skill].name);
      assert.ok(app.raf != null);
    }
  }
});

test('simultaneous skills render once, resume does not replay them, and new rounds reset event deduplication', t => {
  const g = onlineGame(t, ['lingfeng', 'canglan']), effects = [[], []];
  g.clients.forEach(({ app }, i) => {
    const cutIn = app.R.skillCutIn.bind(app.R);
    app.R.skillCutIn = (look, skill, left) => { effects[i].push(skill.name); cutIn(look, skill, left); };
  });
  g.room.match.players.forEach(p => { p.energy = 100; }); g.broadcast(); g.frames(3);
  g.tap(0, 'skill'); g.tap(1, 'skill'); g.rooms.step(); g.rooms.broadcast(g.room);
  const events = copy(g.sockets[0].messages.at(-1).ev);
  assert.equal(events.filter(e => e.type === 'skill').length, 2);
  // Repetition within a single received packet must also be deduplicated.
  for (let i = 0; i < 2; i++) g.deliver(i, { ...g.sockets[i].messages.at(-1), ev: [...events, ...events] });
  g.frames(6);
  for (const list of effects) assert.deepEqual(list, [YY.SKILLS.pokong.name, YY.SKILLS.chaoxi.name]);

  const eventId = g.clients[1].app.lastEventId;
  g.clients[1].app.startOnline(g.rooms.startMessage(g.room));
  assert.equal(g.clients[1].app.lastEventId, eventId);
  g.deliver(1, { ...g.sockets[1].messages.at(-1), ev: events }); g.frames(6);
  assert.equal(effects[1].length, 2);
  g.room.match.players[1].energy = 100; g.room.match.players[1].skillCd = 0; g.broadcast(); g.frames(3); // 防连点保护过后再放
  g.tap(1, 'skill'); g.frames(6);
  for (const list of effects) assert.equal(list.length, 3, 'new events still play after resume');

  const oldMatch = g.room.id;
  g.room.match.phase = 'over'; g.room.match.winner = 0; g.rooms.rematch(g.room);
  for (const ws of g.sockets) g.rooms.ready(ws.slot, { ready: true, revision: g.room.revision });
  g.rooms.start(g.room); assert.notEqual(g.room.id, oldMatch);
  for (const { app } of g.clients) {
    app.startOnline(g.rooms.startMessage(g.room)); assert.equal(app.lastEventId, 0);
  }
  g.room.match.players[0].energy = 100; g.broadcast(); g.frames(3);
  g.tap(0, 'skill'); g.frames(6);
  for (const list of effects) { assert.equal(list.length, 4); assert.equal(list.at(-1), YY.SKILLS.pokong.name); }
});

test('unknown skill effects cannot stop later events or either client frame loop', t => {
  const g = onlineGame(t, ['lingfeng', 'canglan']);
  g.room.match.emit({ type: 'skill', p: 0, id: 'future-skill' });
  g.room.match.emit({ type: 'skill', p: 99, id: 'pokong' });
  g.room.match.emit({ type: 'skillProc', p: 99, id: 'shuju', label: 'invalid player' });
  g.room.match.emit({ type: 'skill', p: 1, id: 'chaoxi' });
  g.rooms.collect(g.room); g.broadcast(); g.frames(6);
  for (const { app } of g.clients) {
    assert.equal(app.R.cutin.name, YY.SKILLS.chaoxi.name);
    assert.ok(app.raf != null);
  }
});

test('skill proc events retain their identifier and color after server serialization', t => {
  const g = onlineGame(t, ['guoge', 'laochen']);
  for (const [p, id] of [[0, 'shuju'], [1, 'touji']]) {
    const label = 'proc-' + id;
    g.room.match.emit({ type: 'skillProc', p, id, label });
    g.rooms.collect(g.room); g.broadcast(); g.frames(6);
    for (const { app } of g.clients) {
      const effect = app.R.texts.find(effect => effect.text === label);
      assert.ok(effect); assert.equal(effect.color, YY.SKILLS[id].color);
    }
  }
});

test('disabled room skills reject skill actions and keep both clients running', t => {
  const g = onlineGame(t, ['lingfeng', 'canglan'], { skills: false });
  g.room.match.players.forEach(p => { p.energy = 100; });
  for (const [i, h] of g.clients.entries()) {
    assert.ok(!h.app.ui.controls.some(b => b.id === 'skill'));
    g.rooms.message(g.sockets[i], { t: 'in', matchId: g.room.id, seq: ++h.app.net.seq,
      move: 0, presses: [{ id: ++h.app.net.action, btn: 'skill' }] });
  }
  g.frames(90);
  for (const { app } of g.clients) { assert.equal(app.R.cutin, null); assert.ok(app.raf != null); }
  assert.ok(g.room.match.players.every(p => p.energy === 100));
});
