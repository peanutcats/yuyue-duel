'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { Rooms, YY } = require('../server/rooms');
const { createServer } = require('../server');

function fake() { return { readyState: 1, bufferedAmount: 0, messages: [], send(s) { this.messages.push(JSON.parse(s)); }, close() { this.readyState = 3; } }; }
function game() {
  const r = new Rooms(), a = fake(), b = fake();
  r.create(a, { venue: 'neon' }); r.join(b, { room: a.slot.room.code });
  return { r, a, b, room: a.slot.room };
}
function input(p, seq, move, presses = []) { return { t: 'in', matchId: p.room.id, seq, move, presses }; }

test('server is sole authority: valid inputs move players; client coordinates, score, lead and replay cannot alter results', () => {
  const { r, a, room } = game(); const p = a.slot;
  room.match.server = 1; room.match.resetPoint();
  const x = room.match.players[0].x;
  r.message(a, { ...input(p, 1, 1, [{ id: 1, btn: 'jump', lead: 999 }]), score: [99, 0], x: 900 });
  r.step();
  assert.ok(room.match.players[0].x > x); assert.ok(room.match.players[0].y > 0);
  const stamina = room.match.players[0].stamina;
  r.message(a, input(p, 1, 1, [{ id: 1, btn: 'jump' }]));
  r.step(); assert.equal(room.match.players[0].stamina, stamina);
  assert.deepEqual(room.match.score, [0, 0]); assert.equal(p.ack, 1);
  r.message(a, input(p, 2, Infinity)); assert.equal(p.seq, 1);
  r.message(a, input(p, 2, 0, [{ id: 2, btn: 'teleport' }])); assert.equal(p.seq, 1);
});

test('both clients see identical authoritative shuttle, collision and score over a full rally', () => {
  const { r, a, b, room } = game();
  const p = room.players[room.match.server];
  r.input(p, input(p, 1, 0, [{ id: 1, btn: 'clear' }]));
  for (let i = 0; i < 1800 && !room.match.score.some(Boolean); i++) r.step();
  assert.equal(room.match.score.reduce((s, n) => s + n), 1);
  r.broadcast(room);
  const sa = a.messages.at(-1), sb = b.messages.at(-1);
  assert.deepEqual(sa.s, sb.s); assert.deepEqual(sa.sc, sb.sc);
  assert.ok(sa.ev.some(e => e.type === 'hit')); assert.ok(sa.ev.some(e => e.type === 'point'));
  assert.deepEqual(sa.ev, sb.ev);
});

test('disconnect freezes match; authenticated reconnect keeps state and pending actions do not replay', () => {
  const { r, a, room } = game();
  r.input(a.slot, input(a.slot, 1, 1)); r.step();
  const state = JSON.stringify(room.match.score), time = room.match.time, token = a.slot.token;
  a.readyState = 3; r.disconnected(a);
  for (let i = 0; i < 60; i++) r.step();
  assert.equal(room.match.time, time);
  const bad = fake(); r.resume(bad, { room: room.code, token: 'wrong' }); assert.equal(bad.slot, undefined);
  const c = fake(); r.resume(c, { room: room.code, token }); r.step();
  assert.equal(c.slot.i, 0); assert.equal(c.slot.move, 0);
  assert.equal(JSON.stringify(room.match.score), state); assert.ok(room.match.time > time);
});

test('background input pauses both players and clears a held direction on return', () => {
  const { r, a, b, room } = game();
  r.message(a, { t: 'away' }); r.message(b, input(b.slot, 1, 1, [{ id: 1, btn: 'jump' }]));
  r.step(); assert.equal(room.match.time, 0); assert.equal(b.slot.queue.length, 0);
  assert.equal(room.match.inputs[1].move, 0);
  r.input(a.slot, input(a.slot, 1, 0)); r.input(b.slot, input(b.slot, 2, 0));
  r.step(); assert.ok(room.match.time > 0); assert.equal(room.match.players[1].y, 0);
});

test('congestion retains events and only sends latest snapshot; rematch requires both players', () => {
  const { r, a, b, room } = game();
  a.bufferedAmount = 40000;
  room.match.emit({ type: 'point', winner: 0 }); r.collect(room); r.broadcast(room);
  const before = a.messages.length;
  r.step(); r.broadcast(room); assert.equal(a.messages.length, before);
  a.bufferedAmount = 0; r.broadcast(room);
  assert.equal(a.messages.at(-1).ev.filter(e => e.type === 'point').length, 1);
  r.broadcast(room); assert.equal(a.messages.at(-1).ev.length, 0);
  room.match.phase = 'over'; const id = room.id;
  r.message(a, { t: 'rematch' }); assert.equal(room.id, id);
  r.message(b, { t: 'rematch' }); assert.notEqual(room.id, id);
  r.input(a.slot, { ...input(a.slot, 1, 1), matchId: id }); assert.equal(a.slot.seq, 0);
});

test('real HTTP/WebSocket server: create, join, broadcast; reject foreign origin and private files', async t => {
  const app = createServer();
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const port = app.server.address().port, url = `http://127.0.0.1:${port}`;
  assert.equal((await (await fetch(url + '/healthz')).json()).mode, 'authoritative');
  for (const file of ['/server/index.js', '/.git/config', '/package.json', '/api/turn', '/js/../server/index.js']) {
    assert.equal((await fetch(url + file)).status, 404);
  }
  const a = new WebSocket(`ws://127.0.0.1:${port}/ws`); await once(a, 'open');
  const aw = once(a, 'message'); a.send(JSON.stringify({ t: 'create' }));
  const welcome = JSON.parse((await aw)[0]); assert.equal(welcome.player, 0);
  const b = new WebSocket(`ws://127.0.0.1:${port}/ws`); await once(b, 'open');
  const bw = once(b, 'message'), started = once(a, 'message');
  b.send(JSON.stringify({ t: 'join', room: welcome.room }));
  assert.equal(JSON.parse((await bw)[0]).player, 1); assert.equal(JSON.parse((await started)[0]).t, 'start');
  const state = JSON.parse((await once(a, 'message'))[0]); assert.equal(state.t, 'st'); assert.ok(state.pp);
  const bad = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://unrelated.example' });
  bad.on('error', () => {});
  const [, response] = await once(bad, 'unexpected-response'); assert.equal(response.statusCode, 403); response.resume(); bad.terminate();
});
