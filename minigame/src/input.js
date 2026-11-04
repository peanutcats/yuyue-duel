'use strict';

class HumanCtrl {
  constructor(netRight) { this.netRight = netRight; this.touchDir = 0; this.queue = []; }
  move() { return this.netRight ? this.touchDir : -this.touchDir; }
  push(action) { this.queue.push(action); this.onChange?.(); }
  drain() { const q = this.queue; this.queue = []; return q; }
}

class Input {
  constructor(wx, callbacks) {
    this.callbacks = callbacks;
    this.controls = []; this.pointers = new Map(); this.order = 0; this.keys = new Map();
    this.ctrls = []; this.layout = 'solo'; this.skill = null;
    wx.onTouchStart(e => this.start(e.changedTouches));
    wx.onTouchMove(e => this.move(e.changedTouches));
    wx.onTouchEnd(e => this.end(e.changedTouches, false));
    wx.onTouchCancel(e => this.end(e.changedTouches, true));
    // Available in the browser preview / desktop simulator only.
    wx.onKeyDown?.(e => this.key(e, true));
    wx.onKeyUp?.(e => this.key(e, false));
  }
  setCtrls(ctrls, layout = 'solo', skill = null) {
    this.releaseAll(); this.ctrls = ctrls; this.layout = layout; this.skill = skill;
    ctrls.forEach(c => { c.onChange = () => this.callbacks.changed?.(); });
  }
  releaseAll() {
    this.pointers.clear(); this.keys.clear();
    this.ctrls.forEach(c => { c.touchDir = 0; c.queue = []; });
    this.callbacks.cancel?.(); this.callbacks.changed?.();
  }
  setControls(controls) { this.controls = controls; }
  /**
   * 动作键按「最近的圆心」判定（判定半径比视觉半径大一圈，重叠时取更近的）；
   * 方向键是一整块大判定区，按左右半边决定方向，避免手指压在缝隙里没反应。
   */
  hit(x, y, player) {
    let best = null, bestD = Infinity;
    for (const b of this.controls) {
      if (b.dir || (player != null && b.player !== player)) continue;
      if (!b.r) { if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; continue; }
      const d = Math.hypot(x - b.x, y - b.y) / (b.hitR || b.r);
      if (d <= 1 && d < bestD) { best = b; bestD = d; }
    }
    return best || this.padAt(x, y, player, 0, 0);
  }
  /** margin：按住后允许手指漂出判定区的距离；current：当前方向，中缝附近保持不变（防抖）。 */
  padAt(x, y, player, margin, current) {
    for (const b of this.controls) {
      if (!b.dir || (player != null && b.player !== player)) continue;
      const z = b.zone;
      if (!z) { if (Math.hypot(x - b.x, y - b.y) <= b.r + margin) return b; continue; }
      if (x < z.x - margin || x > z.x + z.w + margin || y < z.y - margin || y > z.y + z.h + margin) continue;
      let dir = x < z.cx ? -1 : 1;
      if (current && Math.abs(x - z.cx) < 10) dir = current;
      return this.controls.find(c => c.zone === z && c.dir === dir) || b;
    }
    return null;
  }
  point(t) { return this.callbacks.point(t.clientX ?? t.x, t.clientY ?? t.y); }
  start(touches) {
    this.callbacks.unlock?.();
    for (const t of touches || []) {
      if (this.pointers.has(t.identifier)) continue;
      const p = this.point(t), hit = this.callbacks.playing() ? this.hit(p.x, p.y) : null;
      const record = { ...p, startX: p.x, startY: p.y, hit, dir: hit?.dir || 0, order: ++this.order };
      this.pointers.set(t.identifier, record);
      if (hit && !hit.dir) { this.ctrls[hit.player]?.push(hit.action); this.callbacks.feedback?.(hit.action); }
      else if (!hit) this.callbacks.start?.(t.identifier, p);
    }
    this.updateMove();
  }
  move(touches) {
    for (const t of touches || []) {
      const r = this.pointers.get(t.identifier); if (!r) continue;
      const p = this.point(t); r.x = p.x; r.y = p.y;
      if (r.hit?.dir) {
        const target = this.padAt(p.x, p.y, r.hit.player, 56, r.dir);
        const dir = target?.dir || 0;
        if (dir !== r.dir) { r.dir = dir; r.order = ++this.order; }
      } else if (!r.hit) this.callbacks.move?.(t.identifier, p);
    }
    this.updateMove();
  }
  end(touches, cancelled) {
    for (const t of touches || []) {
      const r = this.pointers.get(t.identifier); if (!r) continue;
      this.pointers.delete(t.identifier);
      if (!r.hit) this.callbacks.end?.(t.identifier, this.point(t), cancelled);
    }
    this.updateMove();
  }
  updateMove() {
    for (let i = 0; i < this.ctrls.length; i++) {
      let latest = null;
      for (const p of [...this.pointers.values(), ...this.keys.values()]) if (p.hit?.player === i && p.dir && (!latest || p.order > latest.order)) latest = p;
      const c = this.ctrls[i], next = latest?.dir || 0;
      if (c.touchDir !== next) { c.touchDir = next; this.callbacks.changed?.(); }
    }
  }
  pressed(b) { return [...this.pointers.values()].some(p => p.hit === b || (p.hit?.player === b.player && b.dir && p.dir === b.dir)); }
  key(e, down) {
    const code = e.code || e.key;
    if (down && (code === 'Escape' || code === 'KeyP')) { this.callbacks.pause?.(); return; }
    if (!this.callbacks.playing()) return;
    const duo = this.layout === 'duo';
    const map = { KeyA: [0, -1], KeyD: [0, 1], ArrowLeft: [duo ? 1 : 0, -1], ArrowRight: [duo ? 1 : 0, 1], KeyW: [0, 'jump'], Space: [0, 'jump'], ArrowUp: [duo ? 1 : 0, 'jump'], KeyJ: [0, 'clear'], KeyK: [0, 'drop'], KeyL: [0, 'smash'], KeyI: [0, 'skill'], KeyF: [0, 'clear'], KeyG: [0, 'drop'], KeyH: [0, 'smash'], Comma: [1, 'clear'], Period: [1, 'drop'], Slash: [1, 'smash'] };
    const action = map[code]; if (!action || !this.ctrls[action[0]]) return;
    if (down && !this.keys.has(code)) {
      this.keys.set(code, { hit: { player: action[0] }, dir: typeof action[1] === 'number' ? action[1] : 0, order: ++this.order });
      if (typeof action[1] === 'string') this.ctrls[action[0]].push(action[1]);
    } else if (!down) this.keys.delete(code);
    this.updateMove();
  }
}

module.exports = { Input, HumanCtrl };
