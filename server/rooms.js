'use strict';
const crypto = require('node:crypto');
const YY = require('../js/core.js');
require('../js/match.js');
require('../js/state.js');
const BUTTONS = new Set(['jump', 'clear', 'drop', 'smash']);
const VENUES = ['arena', 'sunset', 'neon'];
const now = () => performance.now() / 1000;
const token = () => crypto.randomBytes(24).toString('base64url');

class Rooms {
  constructor({ maxRooms = 20 } = {}) { this.rooms = new Map(); this.maxRooms = maxRooms; }
  send(ws, msg) { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); }
  error(ws, message) { this.send(ws, { t: 'error', message }); }
  slot(ws, room, i) {
    return { ws, room, i, token: token(), seq: 0, ack: 0, action: 0, move: 0, queue: [], seen: now(), away: false, disconnected: 0, events: [], rematch: false, lastSent: now() };
  }
  attach(ws, slot) {
    slot.ws = ws; ws.slot = slot; slot.disconnected = 0; slot.seen = now(); slot.away = false;
    slot.lastSent = now(); slot.move = 0; slot.queue = []; slot.events = [];
    if (slot.room.match) {
      slot.room.match.inputs[slot.i] = YY.blankInput(); slot.ack = slot.seq;
    }
    this.send(ws, { t: 'welcome', room: slot.room.code, player: slot.i, token: slot.token, matchId: slot.room.id, seq: slot.seq, action: slot.action });
  }
  create(ws, d) {
    if (this.rooms.size >= this.maxRooms) return this.error(ws, '房间已满，请稍后再试');
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code;
    do { code = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
    const room = { code, id: token(), players: [], match: null, tick: 0, eventId: 0, created: now(), venue: VENUES.includes(d.venue) ? d.venue : VENUES[crypto.randomInt(VENUES.length)] };
    this.rooms.set(code, room);
    const p = this.slot(ws, room, 0); room.players.push(p); this.attach(ws, p);
  }
  join(ws, d) {
    const room = this.rooms.get(String(d.room || '').toUpperCase());
    if (!room) return this.error(ws, '房间不存在或已经结束');
    if (room.players.length !== 1) return this.error(ws, '房间已满');
    const p = this.slot(ws, room, 1); room.players.push(p); this.attach(ws, p); this.start(room);
  }
  resume(ws, d) {
    const room = this.rooms.get(String(d.room || ''));
    const p = room?.players.find(p => typeof d.token === 'string' && p.token === d.token);
    if (!p) return this.error(ws, '重连凭证已失效，请重新创建房间');
    // A live connection cannot be replaced by a second connection with a copied token.
    if (p.ws?.readyState === 1) return this.error(ws, '该玩家已经在线');
    this.attach(ws, p);
    if (room.match) this.send(ws, { t: 'start', matchId: room.id, venue: room.venue });
    this.broadcast(room);
  }
  start(room) {
    room.id = token(); room.tick = 0; room.eventId = 0; room.ended = 0;
    room.match = new YY.Match({ names: ['红方', '蓝方'], firstServer: crypto.randomInt(2) });
    for (const p of room.players) {
      p.lastSent = now(); p.move = 0; p.queue = []; p.events = []; p.rematch = false; p.ack = p.seq;
      this.send(p.ws, { t: 'start', matchId: room.id, venue: room.venue });
    }
    this.collect(room); this.broadcast(room);
  }
  input(p, d) {
    if (d.matchId !== p.room.id) return;
    if (!Number.isSafeInteger(d.seq) || d.seq <= p.seq || d.seq > p.seq + 10000 ||
        !Number.isFinite(d.move) || Math.abs(d.move) > 1 || !Array.isArray(d.presses) || d.presses.length > 8) return;
    let last = p.action;
    const accepted = [];
    for (const a of d.presses) {
      if (!a || !Number.isSafeInteger(a.id) || a.id < 1 || !BUTTONS.has(a.btn)) return;
      if (a.id <= last) continue;
      if (a.id > last + 64) return;
      last = a.id; accepted.push({ btn: a.btn });
    }
    if (p.queue.length + accepted.length > 32) return;
    p.seq = d.seq; p.action = last; p.move = d.move; p.seen = now(); p.away = false;
    p.queue.push(...accepted);
  }
  message(ws, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'ping') return this.send(ws, { t: 'pong', ts: d.ts, nt: now() });
    const p = ws.slot;
    if (!p) {
      if (d.t === 'create') this.create(ws, d);
      else if (d.t === 'join') this.join(ws, d);
      else if (d.t === 'resume') this.resume(ws, d);
      return;
    }
    if (d.t === 'in') this.input(p, d);
    else if (d.t === 'away') { p.away = true; p.move = 0; p.queue = []; }
    else if (d.t === 'leave') this.destroy(p.room, '好友已离开房间');
    else if (d.t === 'rematch' && p.room.match?.phase === 'over') {
      p.rematch = true;
      if (p.room.players.every(q => q.rematch && q.ws?.readyState === 1)) this.start(p.room);
      else for (const q of p.room.players) this.send(q.ws, { t: 'notice', message: '已请求再来一局，等待双方确认' });
    }
  }
  disconnected(ws) {
    const p = ws.slot;
    if (!p || p.ws !== ws) return;
    p.ws = null; p.disconnected = now(); p.move = 0; p.queue = [];
  }
  waiting(room, t = now()) {
    if (room.players.length < 2) return '等待好友加入…';
    if (room.players.some(p => !p.ws || p.ws.readyState !== 1)) return '好友连接中断，等待重连（最多 20 秒）…';
    if (room.players.some(p => p.away || t - p.seen > 1.2)) return '好友暂时离开或网络不稳定，比赛已暂停…';
    return null;
  }
  collect(room) {
    const events = room.match.events.splice(0).map(e => ({ ...e, id: ++room.eventId }));
    for (const p of room.players) {
      p.events.push(...events);
      if (p.events.length > 256) p.events = p.events.slice(-256); // Full snapshot recovers state on reconnect.
    }
  }
  step() {
    const t = now();
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.disconnected && t - p.disconnected > 20) ||
          (!room.match && t - room.created > 600) || t - room.created > 7200 || (room.ended && t - room.ended > 120)) {
        this.destroy(room, '房间已结束，请重新创建'); continue;
      }
      if (!room.match) continue;
      const wait = this.waiting(room, t);
      for (const p of room.players) {
        room.match.inputs[p.i].move = wait ? 0 : p.move;
        if (!wait) room.match.inputs[p.i].presses.push(...p.queue);
        else room.match.inputs[p.i].presses.length = 0;
        p.queue = []; if (wait) p.ack = p.seq;
      }
      if (!wait) { room.match.step(YY.C.DT); room.tick++; this.collect(room);
        for (const p of room.players) if (!room.match.inputs[p.i].presses.length) p.ack = p.seq; }
      if (room.match.phase === 'over' && !room.ended) room.ended = t;
    }
  }
  broadcast(room) {
    if (!room.match) return;
    const t = now();
    const state = { ...YY.snapshot(room.match, [], t), matchId: room.id, tick: room.tick,
      ack: room.players.map(p => p.ack), wait: this.waiting(room, t), vn: room.venue,
      stats: room.match.stats, longest: room.match.longest };
    for (const p of room.players) {
      const ws = p.ws;
      if (ws?.readyState !== 1) continue;
      if (ws.bufferedAmount > 262144 || t - p.lastSent > 5) { ws.close(1013, 'slow connection'); continue; }
      if (ws.bufferedAmount > 32768) continue; // Keep events until a new snapshot can be sent.
      this.send(ws, { ...state, ev: p.events }); p.events = []; p.lastSent = t;
    }
  }
  broadcastAll() { for (const r of this.rooms.values()) this.broadcast(r); }
  destroy(room, reason) {
    if (!this.rooms.delete(room.code)) return;
    for (const p of room.players) { this.send(p.ws, { t: 'ended', message: reason }); if (p.ws) p.ws.slot = null; p.ws?.close(1000); }
  }
}
module.exports = { Rooms, YY };
