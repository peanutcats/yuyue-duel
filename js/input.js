/* 羽跃对决 · 输入：键盘与触屏 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const ACTS = ['jump', 'clear', 'drop', 'smash', 'skill', 'skill2'];

  const KEYMAPS = {
    solo: {
      left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      jump: ['KeyW', 'ArrowUp', 'Space'], clear: ['KeyJ', 'KeyZ'], drop: ['KeyK', 'KeyX'], smash: ['KeyL', 'KeyC'],
      skill: ['KeyI', 'KeyV'], skill2: ['KeyO', 'KeyB'],
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
    push(act) { this.queue.push(act); if (act in this.counts) this.counts[act]++; Input.changed(); }
    onKey(code) {
      for (const a of ACTS) if ((this.map[a] || []).includes(code)) { this.push(a); return true; }
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
      // Safari 等浏览器可能忽略 viewport 的缩放限制。游戏触控已由 Pointer Events
      // 处理，取消 touchend 默认行为可阻止双击缩放/合成鼠标点击，不吞菜单 click。
      const gameSurface = (target) => target && target.closest && target.closest('#touch, #game');
      const preventGesture = (e) => { if (gameSurface(e.target) && e.cancelable) e.preventDefault(); };
      document.addEventListener('touchend', preventGesture, { passive: false });
      document.addEventListener('touchmove', preventGesture, { passive: false });
      document.addEventListener('gesturestart', preventGesture, { passive: false });
      document.addEventListener('gesturechange', preventGesture, { passive: false });
      document.addEventListener('dblclick', (e) => {
        if (!e.target.closest('input, textarea, [contenteditable="true"]') && e.cancelable) e.preventDefault();
      }, { passive: false });
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
  const LABELS = { jump: '跳', clear: '高远', drop: '吊球', smash: '扣杀', skill: '技能', skill2: '技能' };
  const SUBS = { jump: 'JUMP', clear: '挑球', drop: '放网', smash: '强攻', skill: 'SKILL', skill2: 'SKILL 2' };
  const ICONS = {
    jump: '<path d="m6 12 6-6 6 6M6 18l6-6 6 6"/>',
    clear: '<path d="M4 19C6 5 14 2 20 7m-5-1 5 1-1 5"/>',
    drop: '<path d="M4 8c8-7 14-3 14 11m-4-4 4 4 4-4"/>',
    smash: '<path d="m14 3-8 11h6l-2 7L21 9h-7l2-6Z"/>',
    skill: '<path d="M12 2.5l2.6 6 6.4.6-4.9 4.2 1.5 6.3L12 16.3 6.4 19.6l1.5-6.3L3 9.1l6.4-.6Z"/>',
  };
  const isTouch = () => 'ontouchstart' in G || navigator.maxTouchPoints > 0 || G.matchMedia('(pointer: coarse)').matches;
  YY.isTouch = isTouch;
  const buzz = (ms) => { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} };

  /** 独立方向键：每根手指单独记录，后按方向优先；可以滑到另一箭头换向。 */
  function makeMovePad(ctrl, cls) {
    const pad = document.createElement('div');
    pad.className = 'move-pad ' + cls;
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', '左右移动');
    const buttons = [-1, 1].map(dir => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'move-btn move-' + (dir < 0 ? 'left' : 'right');
      b.dataset.dir = dir;
      b.setAttribute('aria-label', dir < 0 ? '向左移动' : '向右移动');
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${dir < 0 ? 'M20 7 11 16 20 25M11 16h15' : 'M12 7 21 16 12 25M21 16H6'}"/></svg>`;
      pad.appendChild(b);
      return b;
    });
    const pointers = new Map(), keys = new Map();
    let order = 0;
    const update = (notify = true) => {
      const active = [...pointers.values(), ...keys.values()].filter(p => p.dir);
      const last = active.reduce((a, b) => !a || b.order > a.order ? b : a, null);
      ctrl.touchDir = last ? last.dir : 0;
      for (const b of buttons) {
        const held = active.some(p => p.dir === +b.dataset.dir);
        b.classList.toggle('down', held);
        b.classList.toggle('active-dir', ctrl.touchDir === +b.dataset.dir);
        b.setAttribute('aria-pressed', String(held));
      }
      if (notify) Input.changed();
    };
    pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('.move-btn');
      if (!b || !pad.contains(b) || e.button !== 0 || pointers.has(e.pointerId)) return;
      e.preventDefault();
      pointers.set(e.pointerId, { dir: +b.dataset.dir, order: ++order });
      try { pad.setPointerCapture(e.pointerId); } catch (_) {}
      update();
    });
    pad.addEventListener('pointermove', e => {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      e.preventDefault();
      const pos = YY.toApp(e.clientX, e.clientY);
      const b = buttons.find(b => {
        const r = YY.appRect(b);
        return pos.x >= r.left && pos.x <= r.left + r.width && pos.y >= r.top && pos.y <= r.top + r.height;
      });
      const dir = b ? +b.dataset.dir : 0;
      if (dir !== pointer.dir) { pointer.dir = dir; pointer.order = ++order; update(); }
    });
    const end = e => {
      if (!pointers.delete(e.pointerId)) return;
      try { if (pad.hasPointerCapture(e.pointerId)) pad.releasePointerCapture(e.pointerId); } catch (_) {}
      update();
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(name, end);
    // Focused buttons also support keyboard activation, without Space triggering a jump.
    for (const b of buttons) {
      b.addEventListener('keydown', e => {
        if (!['Space', 'Enter'].includes(e.code)) return;
        e.preventDefault(); e.stopPropagation();
        if (!keys.has(b)) { keys.set(b, { dir: +b.dataset.dir, order: ++order }); update(); }
      });
      b.addEventListener('keyup', e => {
        if (!['Space', 'Enter'].includes(e.code)) return;
        e.preventDefault(); e.stopPropagation(); keys.delete(b); update();
      });
      b.addEventListener('blur', () => { if (keys.delete(b)) update(); });
    }
    Input.touchResets.push(() => {
      const ids = [...pointers.keys()]; pointers.clear(); keys.clear();
      for (const id of ids) try { if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id); } catch (_) {}
      update(false);
    });
    return pad;
  }

  function makeBtn(ctrl, act, cls, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label || LABELS[act]);
    b.className = 'tbtn t-' + act + (cls ? ' ' + cls : '');
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[act]}</svg><b>${label || LABELS[act]}</b>` + (cls === 'mini' ? '' : `<small>${SUBS[act]}</small>`);
    const pointers = new Set();
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (e.button !== 0 || pointers.has(e.pointerId)) return;
      pointers.add(e.pointerId);
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      ctrl.push(act);
      b.classList.add('down');
      buzz(act === 'smash' ? 18 : 8);
    });
    const up = e => {
      if (!pointers.delete(e.pointerId)) return;
      try { if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); } catch (_) {}
      b.classList.toggle('down', pointers.size > 0);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(name, up);
    b.addEventListener('click', e => { if (e.detail === 0 && !e.pointerType) ctrl.push(act); });
    Input.touchResets.push(() => {
      const ids = [...pointers]; pointers.clear(); b.classList.remove('down');
      for (const id of ids) try { if (b.hasPointerCapture(id)) b.releasePointerCapture(id); } catch (_) {}
    });
    return b;
  }

  /** 构建触屏控制：layout 'solo' 一人（左方向键 + 右手弧形按键），'duo' 两人各一组。
   * opt.skill：技能短名（有则在扣杀键上方加技能键，能量用 --e 显示） */
  YY.buildTouch = function (root, ctrls, layout, opt) {
    for (const reset of Input.touchResets) reset();
    Input.touchResets = [];
    root.innerHTML = '';
    if (layout === 'solo') {
      root.appendChild(makeMovePad(ctrls[0], 'solo'));
      const arc = document.createElement('div');
      arc.className = 'arc';
      for (const a of ['clear', 'drop', 'smash', 'jump']) arc.appendChild(makeBtn(ctrls[0], a));
      if (opt && opt.skill) {
        const sb = makeBtn(ctrls[0], 'skill', null, opt.skill);
        sb.style.setProperty('--sk', opt.color || '#ffd23f');
        arc.appendChild(sb);
      }
      if (opt && opt.skill2) {
        const sb = makeBtn(ctrls[0], 'skill2', null, opt.skill2);
        sb.style.setProperty('--sk', opt.color2 || '#ffd23f');
        arc.appendChild(sb);
      }
      root.appendChild(arc);
    } else {
      ctrls.forEach((c, i) => {
        const side = i === 0 ? 'left' : 'right';
        root.appendChild(makeMovePad(c, 'duo ' + side));
        const g = document.createElement('div');
        g.className = 'mini-arc ' + side;
        for (const a of ['clear', 'drop', 'smash', 'jump']) g.appendChild(makeBtn(c, a, 'mini'));
        root.appendChild(g);
      });
    }
  };
})(window);
