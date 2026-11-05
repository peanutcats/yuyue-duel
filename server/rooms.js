'use strict';
const crypto = require('node:crypto');
const YY = require('../js/core.js');
YY.platform = { getStorage: () => null, setStorage() {}, createCanvas() { throw Error('no canvas on server'); }, viewport: () => ({ W: 1, H: 1, dpr: 1 }), hidden: () => false };
require('../js/roster.js'); require('../js/match.js'); require('../js/state.js');
const BUTTONS = new Set(['jump', 'clear', 'drop', 'smash', 'skill', 'skill2']);
const ROOM_PROTOCOL = 2, FEATURES = ['skills', 'ready-room-v1', 'skill-kit-v2'];
const charId = id => typeof id === 'string' && YY.CHARS.some(c => c.id === id) ? id : null;
// 携带的两个主动技能：只接受该角色自己的技能，不合法时用默认组合
const kitOf = (char, kit) => YY.skillSet(char, Array.isArray(kit) ? kit.filter(k => typeof k === 'string').slice(0, 3) : null).act;
const VENUES = ['arena', 'sunset', 'neon'];
const now = () => performance.now() / 1000;
const token = () => crypto.randomBytes(24).toString('base64url');

class Rooms {
  constructor({ maxRooms = 20, clock = now } = {}) { this.rooms = new Map(); this.maxRooms = maxRooms; this.now = clock; }
  send(ws, msg) { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); }
  error(ws, message) { this.send(ws, { t: 'error', message }); }
  notice(ws, message) { this.send(ws, { t: 'notice', message }); }
  slot(ws, room, i) {
    return { ws, room, i, char: i ? 'canglan' : 'lingfeng', kit: kitOf(i ? 'canglan' : 'lingfeng'), ready: false, token: token(), seq: 0, ack: 0, action: 0, move: 0, queue: [], seen: this.now(), away: false, disconnected: null, events: [], lastSent: this.now() };
  }
  attach(ws, p) {
    p.ws = ws; ws.slot = p; p.disconnected = null; p.seen = this.now(); p.away = false;
    p.lastSent = this.now(); p.move = 0; p.queue = []; p.events = [];
    if (p.room.match) { p.room.match.inputs[p.i] = YY.blankInput(); p.ack = p.seq; }
    this.send(ws, { t: 'welcome', room: p.room.code, player: p.i, token: p.token, matchId: p.room.id, seq: p.seq, action: p.action, features: FEATURES, roomProtocol: ROOM_PROTOCOL });
  }
  create(ws, d) {
    if (this.rooms.size >= this.maxRooms) return this.error(ws, '房间已满，请稍后再试');
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let code;
    do { code = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
    const room = { code, id: token(), phase: 'lobby', revision: 1, rules: { skills: d.skills !== false, target: 7, cap: 11 }, wins: [0, 0], round: 0, players: [], match: null, tick: 0, eventId: 0, created: this.now(), activity: this.now(), venue: VENUES.includes(d.venue) ? d.venue : VENUES[crypto.randomInt(VENUES.length)] };
    this.rooms.set(code, room);
    const p = this.slot(ws, room, 0); p.char = charId(d.char) || p.char; p.kit = kitOf(p.char, d.kit); room.players.push(p); this.attach(ws, p); this.broadcastRoom(room);
  }
  join(ws, d) {
    const room = this.rooms.get(String(d.room || '').toUpperCase());
    if (!room) return this.error(ws, '房间不存在或已经结束');
    if (room.players.length !== 1 || room.phase !== 'lobby') return this.error(ws, '房间已满');
    const p = this.slot(ws, room, 1); p.char = charId(d.char) || p.char; p.kit = kitOf(p.char, d.kit); room.players.push(p); this.attach(ws, p);
    this.invalidate(room); this.broadcastRoom(room);
  }
  resume(ws, d) {
    const room = this.rooms.get(String(d.room || ''));
    const p = room?.players.find(p => typeof d.token === 'string' && p.token === d.token);
    if (!p || (p.disconnected != null && this.now() - p.disconnected >= 20)) return this.error(ws, '重连凭证已失效，请重新创建房间');
    if (p.ws?.readyState === 1) return this.error(ws, '该玩家已经在线');
    this.attach(ws, p); this.broadcastRoom(room);
    if (room.match) this.send(ws, this.startMessage(room));
    this.broadcast(room);
  }
  invalidate(room) {
    room.revision++; room.countdownAt = null; room.phase = 'lobby'; room.activity = this.now();
    for (const p of room.players) p.ready = false;
  }
  configure(p, d) {
    const room = p.room;
    if (!['lobby', 'countdown'].includes(room.phase)) return this.notice(p.ws, '请在赛后返回房间再调整角色和规则');
    if (d.revision !== room.revision) return this.notice(p.ws, '房间已更新，请查看最新设置');
    let changed = false;
    const id = charId(d.char);
    if (id && id !== p.char) { p.char = id; p.kit = kitOf(id, d.kit); changed = true; }
    else if (Array.isArray(d.kit)) { const kit = kitOf(p.char, d.kit); if (kit.join() !== p.kit.join()) { p.kit = kit; changed = true; } }
    if (p.i === 0 && typeof d.skills === 'boolean' && d.skills !== room.rules.skills) { room.rules.skills = d.skills; changed = true; }
    if (changed) { this.invalidate(room); this.broadcastRoom(room); }
  }
  ready(p, d) {
    const room = p.room;
    if (!['lobby', 'countdown'].includes(room.phase)) return;
    if (d.revision !== room.revision) return this.notice(p.ws, '角色或规则已变化，请重新确认');
    if (typeof d.ready !== 'boolean' || p.away || p.ws?.readyState !== 1) return;
    p.ready = d.ready; p.seen = this.now(); room.activity = this.now();
    if (!p.ready) { room.phase = 'lobby'; room.countdownAt = null; }
    else if (room.phase === 'lobby' && room.players.length === 2 && room.players.every(q => q.ready && q.ws?.readyState === 1 && !q.away)) {
      room.phase = 'countdown'; room.countdownAt = this.now() + 3;
    }
    this.broadcastRoom(room);
  }
  startMessage(room) { return { t: 'start', matchId: room.id, venue: room.venue, chars: room.chars, kits: room.kits, rules: { ...room.rules }, wins: [...room.wins], round: room.round }; }
  start(room) {
    if (room.phase !== 'countdown' || !room.players.every(p => p.ready && p.ws?.readyState === 1 && !p.away)) return;
    room.id = token(); room.tick = 0; room.eventId = 0; room.ended = null; room.phase = 'playing'; room.countdownAt = null; room.round++;
    room.chars = room.players.map(p => p.char); room.kits = room.players.map(p => kitOf(p.char, p.kit));
    room.match = new YY.Match({ names: ['红方', '蓝方'], firstServer: crypto.randomInt(2), skills: room.rules.skills ? room.players.map((p, i) => YY.skillSet(p.char, room.kits[i])) : null, target: room.rules.target, cap: room.rules.cap });
    this.broadcastRoom(room);
    for (const p of room.players) {
      p.lastSent = p.seen = this.now(); p.move = 0; p.queue = []; p.events = []; p.ack = p.seq;
      this.send(p.ws, this.startMessage(room));
    }
    this.collect(room); this.broadcast(room);
  }
  recordResult(room) {
    if (!room.match || room.match.phase !== 'over' || room.recordedId === room.id) return;
    const winner = room.match.winner;
    if (winner !== 0 && winner !== 1) return;
    room.recordedId = room.id; room.wins[winner]++; room.phase = 'over'; room.ended = this.now();
    room.lastResult = { score: [...room.match.score], winner, chars: [...room.chars], round: room.round };
    this.broadcastRoom(room);
  }
  rematch(room) {
    this.recordResult(room);
    if (room.phase !== 'over') return;
    room.match = null; room.ended = null;
    for (const p of room.players) { p.move = 0; p.queue = []; p.events = []; }
    this.invalidate(room); this.broadcastRoom(room);
  }
  input(p, d) {
    if (p.room.phase !== 'playing' || d.matchId !== p.room.id) return;
    if (!Number.isSafeInteger(d.seq) || d.seq <= p.seq || d.seq > p.seq + 10000 || !Number.isFinite(d.move) || Math.abs(d.move) > 1 || !Array.isArray(d.presses) || d.presses.length > 8) return;
    let last = p.action; const accepted = [];
    for (const a of d.presses) {
      if (!a || !Number.isSafeInteger(a.id) || a.id < 1 || !BUTTONS.has(a.btn)) return;
      if (a.id <= last) continue;
      if (a.id > last + 64) return;
      last = a.id; if ((a.btn !== 'skill' && a.btn !== 'skill2') || p.room.rules.skills) accepted.push({ btn: a.btn });
    }
    if (p.queue.length + accepted.length > 32) return;
    p.seq = d.seq; p.action = last; p.move = d.move; p.seen = this.now(); p.away = false; p.queue.push(...accepted);
  }
  message(ws, d) {
    if (!d || typeof d !== 'object') return;
    const p = ws.slot;
    if (d.t === 'ping') {
      if (p && p.ws === ws && p.room.phase !== 'playing') { p.seen = this.now(); if (typeof d.active === 'boolean') p.away = !d.active; }
      return this.send(ws, { t: 'pong', ts: d.ts, nt: this.now() });
    }
    if (!p) {
      if (['create', 'join', 'resume'].includes(d.t) && d.roomProtocol !== ROOM_PROTOCOL) return this.error(ws, '小游戏版本需要更新，请退出后重新进入 1.0.7 或更新版本');
      if (d.t === 'create') this.create(ws, d);
      else if (d.t === 'join') this.join(ws, d);
      else if (d.t === 'resume') this.resume(ws, d);
      return;
    }
    if (p.ws !== ws) return;
    if (d.t === 'in') this.input(p, d);
    else if (d.t === 'configure') this.configure(p, d);
    else if (d.t === 'ready') this.ready(p, d);
    else if (d.t === 'away') {
      p.away = true; p.move = 0; p.queue = [];
      if (['lobby', 'countdown'].includes(p.room.phase)) { this.invalidate(p.room); this.broadcastRoom(p.room); }
    } else if (d.t === 'leave') this.destroy(p.room, '好友已离开房间');
    else if (d.t === 'rematch') this.rematch(p.room);
  }
  disconnected(ws) {
    const p = ws.slot; if (!p || p.ws !== ws) return;
    p.ws = null; p.disconnected = this.now(); p.move = 0; p.queue = [];
    if (['lobby', 'countdown'].includes(p.room.phase)) this.invalidate(p.room);
    this.broadcastRoom(p.room);
  }
  remaining(p, t = this.now()) { return p.disconnected == null ? null : Math.max(0, Math.ceil(20 - (t - p.disconnected))); }
  waiting(room, t = this.now()) {
    if (room.players.length < 2) return '等待好友加入…';
    const gone = room.players.find(p => p.disconnected != null);
    if (gone) return `好友连接中断，等待重连（剩余 ${this.remaining(gone, t)} 秒）`;
    if (room.players.some(p => p.away || t - p.seen > 1.2)) return '好友暂时离开或网络不稳定，比赛已暂停…';
    return null;
  }
  roomState(room) {
    const t = this.now();
    return { t: 'room', room: room.code, phase: room.phase, revision: room.revision, rules: { ...room.rules }, wins: [...room.wins], round: room.round, lastResult: room.lastResult || null, countdown: room.phase === 'countdown' ? Math.max(0, Math.ceil(room.countdownAt - t)) : null,
      players: room.players.map(p => ({ char: p.char, kit: p.kit, ready: p.ready, connected: p.ws?.readyState === 1, away: p.away, reconnect: this.remaining(p, t) })) };
  }
  broadcastRoom(room) {
    const state = this.roomState(room); room.lastRoomSent = this.now();
    for (const p of room.players) if (!(p.ws?.bufferedAmount > 32768)) this.send(p.ws, state);
  }
  collect(room) {
    // Gameplay uses id for skills; the wire protocol uses id for deduplication.
    // Preserve the skill separately before assigning the transport sequence.
    const events = room.match.events.splice(0).map(e => ({ ...e, ...(typeof e.id === 'string' ? { skillId: e.id } : {}), id: ++room.eventId }));
    for (const p of room.players) { p.events.push(...events); if (p.events.length > 256) p.events = p.events.slice(-256); }
  }
  step() {
    const t = this.now();
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.disconnected != null && t - p.disconnected >= 20) || (!room.match && t - room.activity > 600) || t - room.created > 7200 || (room.ended != null && t - room.ended > 120)) {
        this.destroy(room, '房间已结束，请重新创建'); continue;
      }
      if (room.phase === 'countdown') {
        if (room.players.some(p => p.away || p.ws?.readyState !== 1 || t - p.seen > 3)) { this.invalidate(room); this.broadcastRoom(room); }
        else if (t >= room.countdownAt) this.start(room);
      }
      if (!room.match || room.phase !== 'playing') continue;
      const wait = this.waiting(room, t);
      for (const p of room.players) {
        room.match.inputs[p.i].move = wait ? 0 : p.move;
        if (!wait) room.match.inputs[p.i].presses.push(...p.queue); else room.match.inputs[p.i].presses.length = 0;
        p.queue = []; if (wait) p.ack = p.seq;
      }
      if (!wait) { room.match.step(YY.C.DT); room.tick++; this.collect(room); for (const p of room.players) if (!room.match.inputs[p.i].presses.length) p.ack = p.seq; }
      this.recordResult(room);
    }
  }
  broadcast(room) {
    const t = this.now();
    if (room.phase !== 'playing' && t - (room.lastRoomSent ?? -1) >= .2) this.broadcastRoom(room);
    if (!room.match) return;
    const state = { ...YY.snapshot(room.match, [], t), matchId: room.id, tick: room.tick, ack: room.players.map(p => p.ack), wait: this.waiting(room, t), vn: room.venue, ch: room.chars, wins: [...room.wins], round: room.round, reconnect: room.players.map(p => this.remaining(p, t)), stats: room.match.stats, longest: room.match.longest };
    for (const p of room.players) {
      const ws = p.ws; if (ws?.readyState !== 1) continue;
      if (ws.bufferedAmount > 262144 || t - p.lastSent > 5) { ws.close(1013, 'slow connection'); continue; }
      if (ws.bufferedAmount > 32768) continue;
      this.send(ws, { ...state, ev: p.events }); p.events = []; p.lastSent = t;
    }
  }
  broadcastAll() { for (const r of this.rooms.values()) this.broadcast(r); }
  destroy(room, reason) {
    if (!this.rooms.delete(room.code)) return;
    for (const p of room.players) { this.send(p.ws, { t: 'ended', message: reason }); if (p.ws) p.ws.slot = null; p.ws?.close(1000); }
  }
}
module.exports = { Rooms, YY, ROOM_PROTOCOL };
