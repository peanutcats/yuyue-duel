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
    push(act) { this.queue.push(act); this.counts[act]++; Input.changed(); }
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
    onChange: null,
    touchResets: [],
    changed() { if (this.onChange) this.onChange(); },
    releaseAll() {
      this.held.clear();
      for (const reset of this.touchResets) reset();
      for (const c of this.ctrls) { c.touchDir = 0; c.queue = []; }
      this.changed();
    },
    init() {
      G.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (this.onAny && this.onAny(e)) return;
        this.held.add(e.code);
        let used = false;
        if (!e.repeat) for (const c of this.ctrls) used = c.onKey(e.code) || used;
        else for (const c of this.ctrls) used = c.map && Object.values(c.map).some((l) => l.includes(e.code)) || used;
        this.changed();
        if (used || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      });
      G.addEventListener('keyup', (e) => { this.held.delete(e.code); this.changed(); });
      G.addEventListener('blur', () => this.releaseAll());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    },
    setCtrls(list) { this.releaseAll(); this.touchResets = []; this.ctrls = list; },
  });
  YY.HumanCtrl = HumanCtrl;

  // ---------- 视口（支持竖屏下用 CSS 旋转模拟横屏） ----------
  YY.forceLand = false;
  /** 游戏使用的逻辑视口；rot=true 时整个界面顺时针旋转 90° 显示 */
  YY.viewport = function () {
    const w = G.innerWidth, h = G.innerHeight;
    const rot = YY.forceLand && h > w;
    return rot ? { W: h, H: w, rot } : { W: w, H: h, rot: false };
  };
  /** 屏幕坐标 → 游戏坐标 */
  YY.toApp = function (cx, cy) {
    return YY.viewport().rot ? { x: cy, y: G.innerWidth - cx } : { x: cx, y: cy };
  };
  /** 元素在游戏坐标系中的矩形 */
  YY.appRect = function (el) {
    const r = el.getBoundingClientRect();
    if (!YY.viewport().rot) return { left: r.left, top: r.top, width: r.width, height: r.height };
    return { left: r.top, top: G.innerWidth - r.right, width: r.height, height: r.width };
  };

  // ---------- 触屏 ----------
  const LABELS = { jump: '跳', clear: '高远', drop: '吊球', smash: '扣杀' };
  const SUBS = { jump: '上滑也可', clear: '挑球', drop: '放网', smash: '先起跳' };
  const isTouch = () => 'ontouchstart' in G || navigator.maxTouchPoints > 0 || G.matchMedia('(pointer: coarse)').matches;
  YY.isTouch = isTouch;
  const buzz = (ms) => { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} };

  /**
   * 浮动摇杆：在区域内任意位置按下即以该点为中心；左右拖动移动（模拟量），向上快速拖动起跳。
   * 拇指不必对准固定按钮，左右切换只需几毫米位移。
   */
  function makeJoystick(ctrl, opts) {
    const zone = document.createElement('div');
    zone.className = 'joy-zone ' + (opts.cls || '');
    const base = document.createElement('div');
    base.className = 'joy';
    base.innerHTML = '<i class="ja l">◀</i><i class="ja r">▶</i><i class="ja u">▲</i><b class="knob"></b>';
    zone.appendChild(base);
    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'joy-hint';
      h.textContent = opts.hint;
      zone.appendChild(h);
    }
    const knob = base.querySelector('.knob');
    let id = null, ox = 0, oy = 0, jumped = false;
    const R = () => base.offsetWidth / 2 || 50;
    const rest = () => { base.style.left = ''; base.style.top = ''; base.classList.remove('on'); knob.style.transform = ''; };
    const place = (x, y) => {
      const zr = YY.appRect(zone), r = R();
      const lx = Math.max(r, Math.min(zr.width - r, x - zr.left));
      const ly = Math.max(r, Math.min(zr.height - r, y - zr.top));
      base.style.left = lx - r + 'px'; base.style.top = ly - r + 'px';
      return { x: zr.left + lx, y: zr.top + ly };
    };
    const update = (x, y) => {
      let dx = x - ox;
      const dy = y - oy;
      const r = R();
      // 拇指漂移过远时让中心跟随，永远保持一推即动
      if (Math.abs(dx) > r * 1.3) { ox += dx - Math.sign(dx) * r * 1.3; dx = x - ox; }
      const dead = 7, full = r * 0.45;
      const m = Math.abs(dx) < dead ? 0 : Math.sign(dx) * Math.min(1, (Math.abs(dx) - dead) / (full - dead));
      ctrl.touchDir = opts.flip ? -m : m;
      Input.changed();
      base.classList.toggle('l', m < -0.2);
      base.classList.toggle('r', m > 0.2);
      if (!jumped && -dy > r * 0.75) { jumped = true; ctrl.push('jump'); buzz(8); base.classList.add('u'); }
      else if (jumped && -dy < r * 0.3) { jumped = false; base.classList.remove('u'); }
      const kx = Math.max(-r * 0.6, Math.min(r * 0.6, dx)), ky = Math.max(-r * 0.6, Math.min(r * 0.35, dy));
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { zone.setPointerCapture(id); } catch (_) {}
      const p = YY.toApp(e.clientX, e.clientY);
      const br = YY.appRect(base);
      const bx = br.left + br.width / 2, by = br.top + br.height / 2;
      const onBase = Math.hypot(p.x - bx, p.y - by) <= R();
      // 点左右箭头即移动；区域空白处按下则启用浮动摇杆。
      ox = onBase ? bx : p.x; oy = onBase ? by : p.y;
      place(ox, oy); jumped = false;
      base.classList.add('on');
      update(p.x, p.y);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) { const p = YY.toApp(e.clientX, e.clientY); update(p.x, p.y); } });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; ctrl.touchDir = 0; jumped = false;
      base.classList.remove('l', 'r', 'u');
      rest();
      Input.changed();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
    Input.touchResets.push(() => end({ pointerId: id }));
    return zone;
  }

  function makeBtn(ctrl, act, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', LABELS[act]);
    b.className = 'tbtn t-' + act + (cls ? ' ' + cls : '');
    b.innerHTML = `<b>${LABELS[act]}</b>` + (cls === 'mini' ? '' : `<small>${SUBS[act]}</small>`);
    let pointer = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointer !== null) return;
      pointer = e.pointerId;
      try { b.setPointerCapture(pointer); } catch (_) {}
      ctrl.push(act);
      b.classList.add('down');
      buzz(act === 'smash' ? 18 : 8);
    });
    const up = (e) => { if (e && e.pointerId !== pointer) return; pointer = null; b.classList.remove('down'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('click', (e) => { if (e.detail === 0) ctrl.push(act); });
    Input.touchResets.push(() => up());
    return b;
  }

  /** 构建触屏控制：layout 'solo' 一人（左摇杆 + 右手弧形按键），'duo' 两人各一组 */
  YY.buildTouch = function (root, ctrls, layout) {
    for (const reset of Input.touchResets) reset();
    Input.touchResets = [];
    root.innerHTML = '';
    if (layout === 'solo') {
      root.appendChild(makeJoystick(ctrls[0], { cls: 'solo', hint: '左右滑动移动 · 上滑起跳' }));
      const arc = document.createElement('div');
      arc.className = 'arc';
      for (const a of ['clear', 'drop', 'smash', 'jump']) arc.appendChild(makeBtn(ctrls[0], a));
      root.appendChild(arc);
    } else {
      ctrls.forEach((c, i) => {
        const side = i === 0 ? 'left' : 'right';
        root.appendChild(makeJoystick(c, { cls: 'duo ' + side }));
        const g = document.createElement('div');
        g.className = 'mini-arc ' + side;
        for (const a of ['clear', 'drop', 'smash', 'jump']) g.appendChild(makeBtn(c, a, 'mini'));
        root.appendChild(g);
      });
    }
  };
})(window);
