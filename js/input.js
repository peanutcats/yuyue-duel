/* 羽跃对决 · 输入：键盘与触屏 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const ACTS = ['jump', 'clear', 'drop', 'smash'];

  const KEYMAPS = {
    solo: {
      left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      jump: ['KeyW', 'ArrowUp', 'Space'], clear: ['KeyJ', 'KeyZ'], drop: ['KeyK', 'KeyX'], smash: ['KeyL', 'KeyC'],
    },
    p1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], clear: ['KeyF'], drop: ['KeyG'], smash: ['KeyH'] },
    p2: {
      left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'],
      clear: ['Numpad1', 'Comma'], drop: ['Numpad2', 'Period'], smash: ['Numpad3', 'Slash'],
    },
  };
  YY.KEYMAPS = KEYMAPS;

  class HumanCtrl {
    constructor(map, netRight) {
      this.map = map || { left: [], right: [], jump: [], clear: [], drop: [], smash: [] };
      this.netRight = netRight; // 屏幕上球网是否在该选手右侧
      this.queue = [];
      this.touchDir = 0;
      this.counts = { jump: 0, clear: 0, drop: 0, smash: 0 };
    }
    held(list) { for (const k of list) if (Input.held.has(k)) return true; return false; }
    move() {
      let r = 0;
      if (this.held(this.map.right)) r += 1;
      if (this.held(this.map.left)) r -= 1;
      r = YY.clamp(r + this.touchDir, -1, 1);
      return this.netRight ? r : -r; // 转为“向网为正”
    }
    push(act) { this.queue.push(act); this.counts[act]++; }
    onKey(code) {
      for (const a of ACTS) if (this.map[a].includes(code)) { this.push(a); return true; }
      return this.map.left.includes(code) || this.map.right.includes(code);
    }
    drain() { const q = this.queue; this.queue = []; return q; }
  }

  const Input = (YY.Input = {
    held: new Set(),
    ctrls: [],
    onAny: null,
    init() {
      G.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (this.onAny && this.onAny(e)) return;
        let used = false;
        if (!e.repeat) for (const c of this.ctrls) used = c.onKey(e.code) || used;
        else for (const c of this.ctrls) used = c.map && Object.values(c.map).some((l) => l.includes(e.code)) || used;
        this.held.add(e.code);
        if (used || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      });
      G.addEventListener('keyup', (e) => this.held.delete(e.code));
      G.addEventListener('blur', () => this.held.clear());
    },
    setCtrls(list) { this.ctrls = list; },
  });
  YY.HumanCtrl = HumanCtrl;

  // ---------- 触屏 ----------
  const LABELS = { jump: '跳', clear: '高远', drop: '吊球', smash: '扣杀' };
  const isTouch = () => 'ontouchstart' in G || navigator.maxTouchPoints > 0 || G.matchMedia('(pointer: coarse)').matches;
  YY.isTouch = isTouch;

  function makePad(ctrl) {
    const pad = document.createElement('div');
    pad.className = 'pad';
    pad.innerHTML = '<span class="pl">◀</span><span class="pr">▶</span>';
    let active = null;
    const set = (e) => {
      const r = pad.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width - 0.5;
      ctrl.touchDir = Math.abs(u) < 0.06 ? 0 : u > 0 ? 1 : -1;
      pad.classList.toggle('l', ctrl.touchDir < 0);
      pad.classList.toggle('r', ctrl.touchDir > 0);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); active = e.pointerId; pad.setPointerCapture(e.pointerId); set(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === active) set(e); });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = null; ctrl.touchDir = 0; pad.classList.remove('l', 'r');
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    return pad;
  }
  function makeBtn(ctrl, act) {
    const b = document.createElement('div');
    b.className = 'tbtn t-' + act;
    b.textContent = LABELS[act];
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ctrl.push(act);
      b.classList.add('down');
      if (navigator.vibrate) try { navigator.vibrate(act === 'smash' ? 18 : 8); } catch (_) {}
    });
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    return b;
  }

  /** 构建触屏控制：layout 'solo' 一人（左摇杆右按键），'duo' 两人各一组 */
  YY.buildTouch = function (root, ctrls, layout) {
    root.innerHTML = '';
    if (layout === 'solo') {
      const L = document.createElement('div'); L.className = 'tcl left';
      L.appendChild(makePad(ctrls[0]));
      const R = document.createElement('div'); R.className = 'tcl right acts';
      for (const a of ['clear', 'drop', 'smash', 'jump']) R.appendChild(makeBtn(ctrls[0], a));
      root.appendChild(L); root.appendChild(R);
    } else {
      ctrls.forEach((c, i) => {
        const g = document.createElement('div'); g.className = 'tcl duo ' + (i === 0 ? 'left' : 'right');
        g.appendChild(makePad(c));
        const acts = document.createElement('div'); acts.className = 'mini';
        for (const a of ['jump', 'clear', 'drop', 'smash']) acts.appendChild(makeBtn(c, a));
        g.appendChild(acts);
        root.appendChild(g);
      });
    }
  };
})(window);
