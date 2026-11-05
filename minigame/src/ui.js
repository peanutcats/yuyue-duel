'use strict';
const ControlLayout = require('./control-layout');
/*
 * 羽跃对决 · 微信小游戏 Canvas 界面
 * 逻辑坐标以 380 高（或 700 宽）为基准，手机横屏下约 1 逻辑像素 = 1pt，正文 ≥ 14pt。
 * 视觉：夜场球馆深蓝玻璃卡片 + 羽毛球金主色，矢量图标全部用 Canvas 绘制，不依赖图片资源。
 */
const C = {
  ink: '#111726', text: '#f5f7fc', sub: '#c2cce0', dim: '#8693ad', line: 'rgba(150,180,240,.18)',
  panelTop: 'rgba(36,52,92,.94)', panelBot: 'rgba(18,27,52,.95)',
  gold: '#ffcf4a', goldHi: '#ffe48a', goldLo: '#ffad1f', goldLip: '#b86e10',
  red: '#ff5d6c', cyan: '#5fd4ff', green: '#5fe3a1', purple: '#b59cff', orange: '#ff9a52',
};
const HELP = [
  '左手按住方向区移动：按在左半边向左，右半边向右；手指在方向区内左右滑动即可换向，不必松开。',
  '右手点「跳」起跳；点「高远」「吊球」「扣杀」击球。支持多指同时操作。',
  '发球时观察头顶指针：靠近中间时点高远或吊球，发球更稳。',
  '球必须过网并进入己方半场，靠近肩部甜区时挥拍。太早、太晚都会落空。',
  '扣杀需要先起跳，在足够高的位置击球。起跳与扣杀消耗体力，稍作停顿就会恢复。',
  '向球网移动时击球，可打出平高、劈吊或近网扣杀；向后移动时扣杀打得更深。',
  '每名角色有 1 个被动和 3 个主动技能，赛前在「角色装备 · 技能」里选 2 个携带；能量环达到技能消耗即可按对应技能键。故事模式可以解锁新角色、球拍、球线和球鞋。',
  '快速对战为 7 分制，需领先 2 分，10:10 后先得 11 分者获胜。压线算界内。',
  '同屏和在线对战采用相同基础能力，不带入装备加成；角色技能按赛前确认的规则启用。',
];
const PAD = 20;
const KIND = { inspect:['调查','eye',C.gold], board:['战术板','map',C.cyan], lab:['实验','spark',C.purple], combo:['三拍战术','racket',C.green], pick:['选择','book',C.gold], drill: ['训练', 'target', C.cyan], quiz: ['问答', 'help', C.purple], match: ['比赛', 'racket', C.red], footwork: ['步法', 'steps', C.green], serve: ['发球', 'up', C.orange], special: ['特殊', 'spark', C.gold] };
const DRILL_LOOK = { receive: ['target', C.cyan], clear: ['up', C.gold], drop: ['down', C.green], net: ['spark', C.purple], smash: ['bolt', C.red] };

class UI {
  constructor(YY, app, platform) {
    this.YY = YY; this.app = app; this.P = platform;
    this.buttons = []; this.regions = []; this.scroll = {}; this.pointers = new Map(); this.portraits = new Map();
    this.now = 0;
    this.savedControls = ControlLayout.clean(platform.read(ControlLayout.KEY, null));
    this.resize();
  }
  resize() {
    this.cancel();
    const v = this.P.viewport(); this.v = v; this.isPortrait = v.H > v.W;
    // Use equal gutters even if the device has a cutout on only one side.
    // The capsule limits the header locally; it must not push the entire page left.
    const side = Math.max(v.left, v.right, this.isPortrait ? 12 : 16);
    const sw = Math.max(1, v.W - side * 2), sh = Math.max(1, v.H - v.top - v.bottom);
    this.scale = this.isPortrait ? Math.min(sw / 360, sh / 560) : Math.min(sh / 380, sw / 700);
    this.W = sw / this.scale; this.H = sh / this.scale;
    this.originX = (v.W - sw) / 2; this.originY = v.top;
    const cap = v.capsule;
    const hasCap = cap && cap.left > v.W * .5 && cap.bottom > 0;
    this.capL = hasCap ? Math.min(this.W - 8, (cap.left - this.originX) / this.scale - 10) : this.W - PAD;
    this.capB = hasCap ? Math.max(0, (cap.bottom - this.originY) / this.scale + 6) : 0;
    this.pointers.clear();
    if (this.editor) this.refreshControlEditor();
  }
  point(x, y) { return { x: (x - this.originX) / this.scale, y: (y - this.originY) / this.scale }; }
  reset() { this.scroll = {}; this.buttons = []; this.regions = []; this.pointers.clear(); }
  cancel() {
    if (this.editor?.drag) { this.editor.drag = null; this.refreshControlEditor(); }
    this.pointers?.clear();
  }

  // ---------- 触摸 ----------
  touchStart(id, p) {
    if (this.isPortrait) return;
    const list = [...this.buttons].reverse();
    // 精确命中优先；其次给手指 8 逻辑像素的容差，避免点在按钮边缘没反应。
    const b = list.find(b => this.contains(b, p)) || list.find(b => !b.disabled && b.h > 0 && this.contains(b, p, 8));
    if (this.app.screen === 'controlEditor' && !b) {
      const e = this.editor;
      if (e.drag) return;
      const hit = [...e.groups].reverse().find(g => Math.hypot(Math.max(0, Math.abs(p.x - g.x) - g.off), p.y - g.y) <= g.r + 8);
      if (hit) { e.selected = hit.id; e.drag = { id, group: hit, dx: p.x - hit.x, dy: p.y - hit.y }; }
      return;
    }
    const region = [...this.regions].reverse().find(r => this.contains(r, p));
    this.pointers.set(id, { x: p.x, y: p.y, lastY: p.y, b, region, moved: false, screen: this.app.screen });
  }
  touchMove(id, p) {
    const e = this.editor;
    if (this.app.screen === 'controlEditor' && e?.drag?.id === id) {
      ControlLayout.move(e.drag.group, p.x - e.drag.dx, p.y - e.drag.dy, this.W, this.H, e.mode);
      e.conflicts = ControlLayout.conflicts(e.groups); return;
    }
    const s = this.pointers.get(id); if (!s) return;
    if (Math.hypot(p.x - s.x, p.y - s.y) > 10) s.moved = true;
    if (s.region && s.moved) this.scroll[s.region.id] = Math.max(0, Math.min(s.region.max, (this.scroll[s.region.id] || 0) + s.lastY - p.y));
    s.lastY = p.y;
  }
  touchEnd(id, p, cancelled) {
    const e = this.editor;
    if (this.app.screen === 'controlEditor' && e?.drag?.id === id) {
      const group = e.drag.group;
      if (!cancelled) this.touchMove(id, p);
      if (!cancelled && !e.conflicts.size) e.draft[e.mode][group.id] = ControlLayout.encode(group, this.W, this.H, e.mode);
      else if (!cancelled) this.P.toast('按键不能重叠，请换个位置');
      e.drag = null; this.refreshControlEditor(); return;
    }
    const s = this.pointers.get(id); this.pointers.delete(id);
    if (!s || cancelled || s.moved || s.screen !== this.app.screen || !s.b || !this.contains(s.b, p, 14)) return;
    const current = this.buttons.find(b => b.id === s.b.id);
    if (current && !current.disabled) { this.YY.Audio.click(); current.onClick(); }
  }
  contains(b, p, slop = 0) { return p.x >= b.x - slop && p.x <= b.x + b.w + slop && p.y >= b.y - slop && p.y <= b.y + b.h + slop; }
  isPressed(id) { for (const p of this.pointers.values()) if (p.b?.id === id && !p.moved) return true; return false; }

  // ---------- 绘制基础 ----------
  font(size, weight = 500) { this.g.font = `${weight} ${size}px ${this.YY.FONT}`; }
  measure(text, size, weight = 500) { this.font(size, weight); return this.g.measureText(String(text)).width; }
  grad(x0, y0, x1, y1, stops) { const gr = this.g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; }
  rect(x, y, w, h, fill, radius = 14, stroke, lineWidth = 1) {
    const g = this.g; this.YY.rr(g, x, y, w, h, Math.max(0, Math.min(radius, w / 2, h / 2)));
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lineWidth; g.stroke(); }
  }
  circle(x, y, r, fill, stroke, lineWidth = 1) {
    const g = this.g; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lineWidth; g.stroke(); }
  }
  text(text, x, y, size = 16, color = C.text, weight = 500, align = 'left', maxWidth) {
    const g = this.g; this.font(size, weight); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    let str = String(text);
    if (maxWidth && g.measureText(str).width > maxWidth) {
      while (str.length > 1 && g.measureText(str + '…').width > maxWidth) str = str.slice(0, -1);
      str += '…';
    }
    g.fillText(str, x, y);
  }
  lines(text, width, size, weight = 500) {
    this.font(size, weight);
    const g = this.g, out = []; let line = '';
    for (const c of String(text == null ? '' : text)) {
      if (c === '\n') { out.push(line); line = ''; continue; }
      if (line && g.measureText(line + c).width > width) {
        // 中文标点不放在行首
        if ('，。、；：！？）》」』,.;:!?)'.includes(c)) { out.push(line + c); line = ''; continue; }
        out.push(line); line = c;
      } else line += c;
    }
    if (line) out.push(line);
    return out;
  }
  wrap(text, x, y, width, size = 16, color = C.sub, leading = Math.round(size * 1.5), maxLines = Infinity, weight = 500) {
    let ls = this.lines(text, width, size, weight);
    if (ls.length > maxLines) {
      ls = ls.slice(0, maxLines); let last = ls[maxLines - 1];
      while (last.length > 1 && this.g.measureText(last + '…').width > width) last = last.slice(0, -1);
      ls[maxLines - 1] = last + '…';
    }
    ls.forEach((l, i) => this.text(l, x, y + i * leading, size, color, weight));
    return ls.length * leading;
  }
  /** 玻璃卡片：投影 + 竖向渐变 + 顶部高光 + 细描边 */
  card(x, y, w, h, opt = {}) {
    const g = this.g, r = opt.radius != null ? opt.radius : 18;
    if (!opt.flat) this.rect(x, y + 4, w, h, 'rgba(0,0,0,.30)', r);
    this.rect(x, y, w, h, this.grad(0, y, 0, y + h, [[0, opt.top || C.panelTop], [1, opt.bottom || C.panelBot]]), r);
    g.save(); this.YY.rr(g, x, y, w, h, Math.min(r, w / 2, h / 2)); g.clip();
    g.fillStyle = this.grad(0, y, 0, y + Math.min(h, 46), [[0, 'rgba(255,255,255,.09)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(x, y, w, Math.min(h, 46));
    if (opt.accent) { g.fillStyle = opt.accent; g.fillRect(x, y, w, 3); }
    if (opt.glow) {
      const gl = g.createRadialGradient(x + w, y, 0, x + w, y, Math.max(w, h) * .9);
      gl.addColorStop(0, opt.glow); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(x, y, w, h);
    }
    g.restore();
    this.rect(x + .5, y + .5, w - 1, h - 1, null, r, opt.stroke || C.line);
  }
  panel(x, y, w, h) { this.card(x, y, w, h); }
  chip(label, x, y, color = C.gold, opt = {}) {
    const size = opt.size || 12, h = opt.h || size + 10, w = this.measure(label, size, 700) + (opt.icon ? size + 22 : 18);
    const left = opt.align === 'right' ? x - w : opt.align === 'center' ? x - w / 2 : x;
    this.rect(left, y - h / 2, w, h, opt.fill || this.alpha(color, .16), h / 2, opt.stroke || this.alpha(color, .45));
    if (opt.icon) this.icon(opt.icon, left + 9 + size / 2, y, size + 1, opt.color || color);
    this.text(label, left + (opt.icon ? size + 15 : 9), y + .5, size, opt.color || color, 700);
    return w;
  }
  alpha(hex, a) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  bar(x, y, w, h, ratio, color = C.gold) {
    this.rect(x, y, w, h, 'rgba(0,0,0,.35)', h / 2);
    const r = Math.max(0, Math.min(1, ratio));
    if (r > 0) this.rect(x, y, Math.max(h, w * r), h, this.grad(x, 0, x + w, 0, [[0, this.alpha(color, .75)], [1, color]]), h / 2);
  }
  stars(n, x, y, size, align = 'left', gap = 4) {
    const total = size * 3 + gap * 2, left = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (let i = 0; i < 3; i++) this.icon('star', left + size / 2 + i * (size + gap), y, size, i < n ? C.gold : 'rgba(255,255,255,.2)');
  }
  /** 统一按钮：primary 金色实体，selected 金色描边，danger 红色，默认玻璃。按下时下沉 2px。 */
  button(id, label, x, y, w, h, onClick, opt = {}) {
    const g = this.g, disabled = !!opt.disabled, pressed = !disabled && this.isPressed(id);
    const r = opt.radius != null ? opt.radius : Math.min(14, h / 2), dy = pressed ? 2 : 0;
    g.globalAlpha = disabled ? .42 : 1;
    if (opt.primary) {
      this.rect(x, y + 3, w, h, C.goldLip, r);
      this.rect(x, y + dy, w, h, this.grad(0, y, 0, y + h, [[0, C.goldHi], [1, C.goldLo]]), r);
      this.rect(x + 2, y + dy + 1.5, w - 4, h * .42, 'rgba(255,255,255,.28)', r - 2);
    } else {
      const tone = opt.tone === 'good' ? C.green : opt.tone === 'bad' ? C.red : null;
      const top = opt.danger ? 'rgba(102,36,58,.96)' : tone ? this.alpha(tone, .22) : opt.selected ? 'rgba(92,80,40,.95)' : 'rgba(52,72,120,.95)';
      const bot = opt.danger ? 'rgba(66,22,40,.96)' : tone ? this.alpha(tone, .12) : opt.selected ? 'rgba(54,46,24,.95)' : 'rgba(30,44,80,.96)';
      if (!opt.flat) this.rect(x, y + 3, w, h, 'rgba(0,0,0,.32)', r);
      this.rect(x, y + dy, w, h, this.grad(0, y, 0, y + h, [[0, top], [1, bot]]), r);
      this.rect(x + 1, y + dy + 1, w - 2, Math.min(h * .45, 18), 'rgba(255,255,255,.06)', r - 1);
      const stroke = opt.danger ? 'rgba(255,93,108,.55)' : tone ? this.alpha(tone, .8) : opt.selected ? C.gold : 'rgba(160,190,255,.22)';
      this.rect(x + .5, y + dy + .5, w - 1, h - 1, null, r, stroke, opt.selected || tone ? 1.6 : 1);
    }
    if (pressed) this.rect(x, y + dy, w, h, 'rgba(255,255,255,.10)', r);
    const size = opt.size || 16, weight = opt.weight || 700;
    const color = opt.primary ? C.ink : opt.danger ? '#ffc3ca' : opt.tone === 'good' ? C.green : opt.selected ? C.gold : opt.color || C.text;
    const cy = y + dy + h / 2;
    if (opt.icon && !label) this.icon(opt.icon, x + w / 2, cy, opt.iconSize || size + 4, color);
    else if (opt.align === 'left') {
      let tx = x + 14;
      if (opt.icon) { this.icon(opt.icon, tx + 9, cy, size + 2, opt.iconColor || color); tx += size + 12; }
      if (opt.sub) { this.text(label, tx, cy - 9, size, color, weight, 'left', x + w - tx - 10); this.text(opt.sub, tx, cy + 11, 12, opt.primary ? 'rgba(17,23,38,.7)' : C.dim, 500, 'left', x + w - tx - 10); }
      else this.text(label, tx, cy + .5, size, color, weight, 'left', x + w - tx - 10);
    } else {
      const iconW = opt.icon ? size + 8 : 0, tw = Math.min(this.measure(label, size, weight), w - 20 - iconW);
      const left = x + w / 2 - (tw + iconW) / 2;
      if (opt.icon) this.icon(opt.icon, left + size / 2, cy, size + 1, color);
      this.text(label, left + iconW + tw / 2, cy + .5, size, color, weight, 'center', w - 20 - iconW);
    }
    g.globalAlpha = 1;
    this.buttons.push({ id, x, y, w, h, onClick, disabled });
  }
  /** 整张卡片可点击的入口：图标方块 + 标题 + 副标题 + 右箭头 */
  tile(id, x, y, w, h, o) {
    const pressed = !o.disabled && this.isPressed(id), dy = pressed ? 2 : 0, g = this.g, color = o.color || C.gold;
    g.globalAlpha = o.disabled ? .45 : 1;
    if (o.primary) {
      this.rect(x, y + 4, w, h, C.goldLip, 20);
      this.rect(x, y + dy, w, h, this.grad(x, y, x + w, y + h, [[0, C.goldHi], [.55, C.gold], [1, C.goldLo]]), 20);
      g.save(); this.YY.rr(g, x, y + dy, w, h, 20); g.clip();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + w * .55, y + dy); g.lineTo(x + w * .75, y + dy); g.lineTo(x + w * .6, y + dy + h); g.lineTo(x + w * .4, y + dy + h); g.fill();
      this.shuttle(x + w - 58, y + dy + h * .52, h * .95, .18);
      g.restore();
    } else this.card(x, y + dy, w, h, { radius: 18, glow: this.alpha(color, .16), flat: pressed });
    if (pressed) this.rect(x, y + dy, w, h, 'rgba(255,255,255,.08)', 18);
    const s = Math.min(46, h - 22), ix = x + 14, iy = y + dy + (h - s) / 2;
    this.rect(ix, iy, s, s, o.primary ? 'rgba(17,23,38,.88)' : this.alpha(color, .18), 13, o.primary ? null : this.alpha(color, .4));
    this.icon(o.icon, ix + s / 2, iy + s / 2, s * .52, o.primary ? C.gold : color);
    const tx = ix + s + 13, ink = o.primary ? C.ink : C.text;
    const titleSize = o.titleSize || 18;
    if (o.sub) {
      this.text(o.title, tx, y + dy + h / 2 - 10, titleSize, ink, 800, 'left', x + w - tx - 30);
      this.text(o.sub, tx, y + dy + h / 2 + 13, 13, o.primary ? 'rgba(17,23,38,.72)' : C.dim, 500, 'left', x + w - tx - 30);
    } else this.text(o.title, tx, y + dy + h / 2, titleSize, ink, 800, 'left', x + w - tx - 30);
    if (!o.noArrow) this.icon('next', x + w - 18, y + dy + h / 2, 14, o.primary ? C.ink : C.dim);
    g.globalAlpha = 1;
    this.buttons.push({ id, x, y, w, h, onClick: o.onClick, disabled: !!o.disabled });
  }
  toggle(x, y, on) {
    const w = 44, h = 26;
    this.rect(x, y - h / 2, w, h, on ? this.grad(x, 0, x + w, 0, [[0, C.goldLo], [1, C.goldHi]]) : 'rgba(0,0,0,.35)', h / 2, on ? null : 'rgba(255,255,255,.18)');
    this.circle(on ? x + w - h / 2 : x + h / 2, y, h / 2 - 3, on ? '#fff' : '#9aa6bf');
  }
  header(title, subtitle, back) {
    this.button('back', '', PAD, 10, 44, 40, back || (() => this.app.show('menu')), { icon: 'back', iconSize: 20, radius: 14 });
    const tx = PAD + 58;
    this.text(title, tx, 30, 23, C.text, 800, 'left', this.capL - tx - 20);
    if (subtitle) {
      const tw = this.measure(title, 23, 800), sx = tx + tw + 14, room = this.capL - sx - 8;
      if (room > 90) { this.rect(sx - 7, 22, 1.5, 16, 'rgba(255,255,255,.2)', 1); this.text(subtitle, sx + 2, 31, 14, C.dim, 500, 'left', room); }
    }
  }
  portrait(id, x, y, size, ring) {
    if (id === 'mm' || id === 'nar') {
      this.rect(x, y, size, size, this.grad(0, y, 0, y + size, [[0, '#2c4374'], [1, '#162544']]), size * .22);
      this.shuttle(x + size * .5, y + size * .52, size * .62);
    } else {
      id = id === 'me' ? 'lingfeng' : id;
      let cv = this.portraits.get(id);
      if (!cv) { cv = this.YY.portrait(this.YY.lookOf(id), 160); this.portraits.set(id, cv); }
      const g = this.g; g.save(); this.YY.rr(g, x, y, size, size, size * .22); g.clip(); g.drawImage(cv, x, y, size, size); g.restore();
    }
    if (ring) this.rect(x, y, size, size, null, size * .22, ring, 2);
  }
  shuttle(x, y, size, alpha = 1) {
    const g = this.g; g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(.56); g.scale(size / 100, size / 100);
    for (let i = -2; i <= 2; i++) {
      g.fillStyle = i % 2 ? '#d0e7ef' : '#f5fcff'; g.beginPath(); g.moveTo(-10 + i * 3, 14); g.lineTo(i * 14 - 9, -42); g.quadraticCurveTo(i * 14, -55, i * 14 + 9, -42); g.lineTo(10 + i * 3, 14); g.fill();
    }
    g.fillStyle = C.red; g.fillRect(-16, 10, 32, 10); g.fillStyle = '#ffe8b1'; g.beginPath(); g.arc(0, 23, 16, 0, Math.PI); g.fill(); g.restore();
  }
  /** 矢量图标，s 为外框尺寸 */
  icon(name, x, y, s, color = C.text) {
    const g = this.g; g.save(); g.translate(x, y); const k = s / 24; g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
    const P = pts => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); };
    const ring = (cx, cy, r) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };
    const dot = (cx, cy, r) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
    switch (name) {
      case 'back': P([[5, -9], [-4, 0], [5, 9]]); g.lineWidth = 3; g.stroke(); break;
      case 'pin': g.beginPath(); g.arc(0, -3, 6.5, Math.PI * .85, Math.PI * 2.15); g.lineTo(0, 10); g.closePath(); g.stroke(); dot(0, -3, 2.4); break;
      case 'next': P([[-4, -8], [4, 0], [-4, 8]]); g.lineWidth = 3; g.stroke(); break;
      case 'left': P([[6, -10], [-7, 0], [6, 10]]); g.closePath(); g.fill(); break;
      case 'right': P([[-6, -10], [7, 0], [-6, 10]]); g.closePath(); g.fill(); break;
      case 'pause': this.YY.rr(g, -7, -9, 5, 18, 2); g.fill(); this.YY.rr(g, 2, -9, 5, 18, 2); g.fill(); break;
      case 'play': P([[-6, -9], [9, 0], [-6, 9]]); g.closePath(); g.fill(); break;
      case 'book':
        g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-5, -9.5, -11, -8); g.lineTo(-11, 8); g.quadraticCurveTo(-5, 6.5, 0, 9.5);
        g.quadraticCurveTo(5, 6.5, 11, 8); g.lineTo(11, -8); g.quadraticCurveTo(5, -9.5, 0, -6); g.lineTo(0, 9.5); g.stroke(); break;
      case 'bolt': P([[3, -12], [-8, 2], [-1, 2], [-3, 12], [8, -2], [1, -2]]); g.closePath(); g.fill(); break;
      case 'target': ring(0, 0, 10); ring(0, 0, 5.5); dot(0, 0, 2); break;
      case 'users':
        ring(-4, -4, 4.2); g.beginPath(); g.arc(-4, 11, 8, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        ring(7, -5, 3.2); g.beginPath(); g.arc(8, 9, 6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
      case 'shirt': P([[-4, -10], [-12, -5], [-8.5, 1], [-6, -.5], [-6, 10], [6, 10], [6, -.5], [8.5, 1], [12, -5], [4, -10]]); g.quadraticCurveTo(0, -5.5, -4, -10); g.stroke(); break;
      case 'cards':
        g.save(); g.rotate(-.22); this.YY.rr(g, -10, -9, 12, 17, 2.5); g.stroke(); g.restore();
        g.save(); g.rotate(.18); this.YY.rr(g, -1, -10, 12, 17, 2.5); g.fillStyle = color; g.globalAlpha *= .25; g.fill(); g.globalAlpha /= .25; g.stroke(); g.restore(); break;
      case 'help': ring(0, 0, 10.5); g.beginPath(); g.arc(0, -2.5, 3.6, Math.PI * 1.05, Math.PI * .45); g.lineTo(0, 3); g.stroke(); dot(0, 7, 1.6); break;
      case 'info': ring(0, 0, 10.5); dot(0, -5.5, 1.7); P([[0, -1.5], [0, 6]]); g.stroke(); break;
      case 'gear':
        for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); this.YY.rr(g, -2.2, -12, 4.4, 5, 1.2); g.fill(); g.restore(); }
        ring(0, 0, 7.6); ring(0, 0, 3); break;
      case 'lock': this.YY.rr(g, -8, -1, 16, 12, 3); g.fill(); g.beginPath(); g.arc(0, -3, 5.2, Math.PI, 0); g.lineTo(5.2, 0); g.moveTo(-5.2, -3); g.lineTo(-5.2, 0); g.stroke(); break;
      case 'star':
        g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 11.5, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); break;
      case 'share': dot(-7, 0, 3); dot(7, -7, 3); dot(7, 7, 3); P([[-7, 0], [7, -7]]); g.stroke(); P([[-7, 0], [7, 7]]); g.stroke(); break;
      case 'check': P([[-8, 0], [-2.5, 6], [9, -6]]); g.lineWidth = 3; g.stroke(); break;
      case 'cross': P([[-7, -7], [7, 7]]); g.stroke(); P([[7, -7], [-7, 7]]); g.stroke(); break;
      case 'racket':
        g.save(); g.rotate(-.75); g.beginPath(); g.ellipse(0, -4.5, 6.5, 8.5, 0, 0, Math.PI * 2); g.stroke();
        P([[0, 4], [0, 13]]); g.lineWidth = 3; g.stroke(); g.lineWidth = 1; P([[-3, -9], [-3, 0]]); g.stroke(); P([[3, -9], [3, 0]]); g.stroke(); P([[-5, -4.5], [5, -4.5]]); g.stroke(); g.restore(); break;
      case 'up': P([[0, 11], [0, -8]]); g.stroke(); P([[-7, -2], [0, -10], [7, -2]]); g.stroke(); break;
      case 'down': g.beginPath(); g.arc(-2, 4, 11, Math.PI * 1.25, Math.PI * 1.9); g.stroke(); P([[4, -3], [8.5, 1.5], [9, -5]]); g.stroke(); break;
      case 'steps': this.YY.rr(g, -9, -10, 6, 10, 3); g.fill(); this.YY.rr(g, 3, -2, 6, 10, 3); g.fill(); dot(-6, 3, 2.2); dot(6, 11, 2.2); break;
      case 'spark': P([[0, -11], [2.5, -2.5], [11, 0], [2.5, 2.5], [0, 11], [-2.5, 2.5], [-11, 0], [-2.5, -2.5]]); g.closePath(); g.fill(); break;
      case 'trophy':
        P([[-7, -10], [7, -10], [6, 0]]); g.quadraticCurveTo(0, 6, -6, 0); g.closePath(); g.fill();
        g.beginPath(); g.arc(-8, -5, 3.5, Math.PI * .5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(8, -5, 3.5, -Math.PI * .5, Math.PI * .5); g.stroke();
        P([[0, 3], [0, 8]]); g.stroke(); P([[-6, 10], [6, 10]]); g.lineWidth = 3; g.stroke(); break;
      case 'home': P([[-10, -1], [0, -10], [10, -1]]); g.stroke(); P([[-7, -3], [-7, 9], [7, 9], [7, -3]]); g.stroke(); break;
      case 'map': P([[-10, -7], [-3.5, -10], [3.5, -7], [10, -10], [10, 7], [3.5, 10], [-3.5, 7], [-10, 10]]); g.closePath(); g.stroke(); P([[-3.5, -10], [-3.5, 7]]); g.stroke(); P([[3.5, -7], [3.5, 10]]); g.stroke(); break;
      case 'retry': g.beginPath(); g.arc(0, 0, 8.5, -Math.PI * .1, Math.PI * 1.55); g.stroke(); P([[5, -12], [8.5, -3], [-.5, -3.5]]); g.stroke(); break;
      case 'sound': P([[-10, -4], [-5, -4], [1, -9], [1, 9], [-5, 4], [-10, 4]]); g.closePath(); g.fill(); g.beginPath(); g.arc(2, 0, 6, -.8, .8); g.stroke(); g.beginPath(); g.arc(2, 0, 10.5, -.8, .8); g.stroke(); break;
      case 'vibrate': this.YY.rr(g, -5, -10, 10, 20, 2.5); g.stroke(); P([[-9, -5], [-9, 5]]); g.stroke(); P([[9, -5], [9, 5]]); g.stroke(); break;
      case 'eye': g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(0, -11, 11, 0); g.quadraticCurveTo(0, 11, -11, 0); g.stroke(); dot(0, 0, 3.4); break;
      case 'shield': g.beginPath(); g.moveTo(0, -11); g.lineTo(9, -7); g.quadraticCurveTo(9, 6, 0, 11); g.quadraticCurveTo(-9, 6, -9, -7); g.closePath(); g.stroke(); P([[-4, 0], [-1, 3.5], [5, -3]]); g.stroke(); break;
      case 'trash': P([[-10, -6], [10, -6]]); g.stroke(); P([[-7, -6], [-6, 10], [6, 10], [7, -6]]); g.stroke(); P([[-3, -6], [-3, -10], [3, -10], [3, -6]]); g.stroke(); break;
      case 'flag': P([[-7, 11], [-7, -10]]); g.stroke(); P([[-7, -10], [9, -6], [-7, -1]]); g.closePath(); g.fill(); break;
      case 'stats': this.YY.rr(g, -10, 0, 5, 10, 1.5); g.fill(); this.YY.rr(g, -2.5, -6, 5, 16, 1.5); g.fill(); this.YY.rr(g, 5, -10, 5, 20, 1.5); g.fill(); break;
      case 'key': ring(-4, 0, 5.5); P([[1.5, 0], [11, 0], [11, 4]]); g.stroke(); P([[7, 0], [7, 3.5]]); g.stroke(); break;
      default: dot(0, 0, 4);
    }
    g.restore();
  }
  scrollArea(id, x, y, w, h, contentHeight, draw) {
    const max = Math.max(0, contentHeight - h), off = Math.min(max, this.scroll[id] || 0); this.scroll[id] = off;
    this.regions.push({ id, x, y, w, h, max });
    this.g.save(); this.g.beginPath(); this.g.rect(x - 6, y, w + 12, h); this.g.clip();
    const start = this.buttons.length; draw(y - off);
    for (let i = start; i < this.buttons.length; i++) {
      const b = this.buttons[i], top = Math.max(b.y, y), bottom = Math.min(b.y + b.h, y + h);
      b.y = top; b.h = Math.max(0, bottom - top); if (b.h === 0) b.disabled = true;
    }
    this.g.restore();
    if (max > 0) {
      // 底部渐隐提示还有更多内容
      if (off < max - 2) { this.g.fillStyle = this.grad(0, y + h - 22, 0, y + h, [[0, 'rgba(8,13,30,0)'], [1, 'rgba(8,13,30,.75)']]); this.g.fillRect(x - 6, y + h - 22, w + 12, 22); }
      const th = Math.max(28, h * h / contentHeight);
      this.rect(x + w + 2, y, 3, h, 'rgba(255,255,255,.07)', 2);
      this.rect(x + w + 2, y + off / max * (h - th), 3, th, 'rgba(255,207,74,.7)', 2);
    }
  }
  backdrop(kind) {
    const g = this.g, x = -this.originX / this.scale, y = -this.originY / this.scale, w = this.v.W / this.scale, h = this.v.H / this.scale;
    if (kind === 'dialog') {
      g.fillStyle = this.grad(0, y + h * .3, 0, y + h, [[0, 'rgba(5,9,22,0)'], [.55, 'rgba(5,9,22,.7)'], [1, 'rgba(5,9,22,.92)']]); g.fillRect(x, y, w, h);
      g.fillStyle = this.grad(0, y, 0, y + 70, [[0, 'rgba(5,9,22,.7)'], [1, 'rgba(5,9,22,0)']]); g.fillRect(x, y, w, 70);
      return;
    }
    g.fillStyle = kind === 'menu' ? this.grad(x, 0, x + w, 0, [[0, 'rgba(6,10,26,.95)'], [.45, 'rgba(6,10,26,.80)'], [1, 'rgba(6,10,26,.68)']]) : 'rgba(6,10,26,.88)';
    g.fillRect(x, y, w, h);
    let gl = g.createRadialGradient(x + w * .12, y, 0, x + w * .12, y, h * 1.1);
    gl.addColorStop(0, 'rgba(255,190,60,.13)'); gl.addColorStop(1, 'rgba(255,190,60,0)'); g.fillStyle = gl; g.fillRect(x, y, w, h);
    gl = g.createRadialGradient(x + w, y + h, 0, x + w, y + h, h * 1.2);
    gl.addColorStop(0, 'rgba(70,150,255,.14)'); gl.addColorStop(1, 'rgba(70,150,255,0)'); g.fillStyle = gl; g.fillRect(x, y, w, h);
    // 斜向球场线装饰
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + w * (.3 + i * .22), y + h); g.lineTo(x + w * (.5 + i * .22), y); g.stroke(); }
  }

  // ---------- 对局触控 ----------
  makeControls(mode, preview = false) {
    const controls = [], W = this.W, H = this.H;
    const circle = (id, action, player, x, y, r, label, color, extra) => controls.push({ id, action, player, x, y, r, hitR: r + 12, label, color, ...extra });
    const SK = this.YY.SKILLS, kits = this.app.input.skill;
    // 携带的两个主动技能：kits 单人为 [a, b]，双人为 [[a, b], [c, d]]
    const list = (k) => Array.isArray(k) ? k : typeof k === 'string' ? [k] : [];
    const kitOf = (i) => mode === 'duo' ? list(Array.isArray(kits) ? kits[i] : null) : i === 0 ? list(kits) : [];
    const skillKey = (id, slot, player, x, y, r) => {
      const sk = SK[kitOf(player)[slot]];
      if (sk || preview) circle(id, slot ? 'skill2' : 'skill', player, x, y, r, preview ? (slot ? '技能二' : '技能一') : sk.short, sk?.color || C.purple, { cost: sk?.cost || 100 });
    };
    // 方向区：左右两半共用一块大判定区，手指在区内左右滑动即换向，压在中缝也不会丢方向。
    const pad = (prefix, player, cx, cy, r, off, zone) => {
      zone.cx = cx;
      controls.push({ id: prefix + 'left', player, x: cx - off, y: cy, r, dir: -1, label: '‹', zone, pad: { cx, cy, r, off } });
      controls.push({ id: prefix + 'right', player, x: cx + off, y: cy, r, dir: 1, label: '›', zone, pad: { cx, cy, r, off } });
    };
    if (mode === 'duo') {
      for (let i = 0; i < 2; i++) {
        const base = i * W / 2, half = W / 2;
        pad(`p${i}-`, i, base + 108, H - 72, 32, 36, { x: base, y: H * .45, w: half * .55, h: H * .55 });
        circle(`p${i}-jump`, 'jump', i, base + half - 50, H - 62, 34, '跳', C.gold);
        circle(`p${i}-clear`, 'clear', i, base + half - 128, H - 56, 28, '高远', C.cyan);
        circle(`p${i}-drop`, 'drop', i, base + half - 118, H - 128, 28, '吊球', C.green);
        circle(`p${i}-smash`, 'smash', i, base + half - 48, H - 140, 28, '扣杀', C.red);
        skillKey(`p${i}-skill`, 0, i, base + half - 124, H - 196, 23);
        skillKey(`p${i}-skill2`, 1, i, base + half - 58, H - 208, 23);
      }
      for (const b of controls) if (b.hitR) b.hitR = b.r + 8;
    } else {
      // Bring the visible pad under the resting thumb; keep the wider slide
      // target so drifting fingers still move without requiring an exact hit.
      const cx = Math.min(164, W * .24);
      pad('', 0, cx, H - 84, 44, 50, { x: 0, y: H * .45, w: cx + 94 + 40, h: H * .55 });
      circle('jump', 'jump', 0, W - 86, H - 74, 42, '跳', C.gold);
      circle('clear', 'clear', 0, W - 182, H - 62, 34, '高远', C.cyan);
      circle('drop', 'drop', 0, W - 170, H - 150, 34, '吊球', C.green);
      circle('smash', 'smash', 0, W - 82, H - 174, 34, '扣杀', C.red);
      skillKey('skill', 0, 0, W - 84, H - 260, 27);
      skillKey('skill2', 1, 0, W - 168, H - 250, 27);
    }
    return controls;
  }
  arrangedControls(mode, saved, preview = false) {
    const result = ControlLayout.apply(this.makeControls(mode, preview), saved, this.W, this.H, mode);
    if (result.fits) return result;
    // A much narrower screen may no longer fit a stored layout. Use a valid
    // default without deleting the saved layout for the original screen.
    return { ...ControlLayout.apply(this.makeControls(mode, preview), {}, this.W, this.H, mode), adapted: true };
  }
  layoutControls() {
    if (!this.app.input) return;
    const mode = this.app.input.layout;
    const { controls } = this.arrangedControls(mode, this.savedControls[mode]);
    this.controls = controls; this.app.input.setControls(controls);
  }
  openControlEditor(back = 'settings') {
    this.app.show('controlEditor');
    this.editor = { back, mode: back === 'pause' ? this.app.input.layout : 'solo', draft: ControlLayout.clean(this.savedControls), selected: null, drag: null };
    this.refreshControlEditor();
  }
  refreshControlEditor() {
    const e = this.editor; if (!e) return;
    const layout = this.arrangedControls(e.mode, e.draft[e.mode], true);
    if (layout.adapted) e.draft[e.mode] = {};
    e.controls = layout.controls; e.groups = layout.groups; e.adapted = layout.adapted;
    e.conflicts = new Set();
  }
  closeControlEditor(save = false) {
    const e = this.editor; if (!e) return;
    if (save) {
      if (e.drag || e.conflicts.size) return this.P.toast('请先松开按键，完成位置调整');
      if (!this.P.write(ControlLayout.KEY, e.draft)) return this.P.toast('保存失败，请检查设备存储空间');
      this.savedControls = ControlLayout.clean(e.draft);
    }
    this.editor = null; this.app.show(e.back); this.layoutControls();
    if (save) this.P.toast('键位已保存在本机');
  }
  controlEditor() {
    const e = this.editor; if (!e) return;
    const g = this.g, W = this.W, H = this.H;
    this.header('自定义键位', '', () => this.closeControlEditor(false));
    this.button('layout-save', '保存', this.capL - 96, 10, 96, 40, () => this.closeControlEditor(true), { primary: true, size: 16 });
    for (const [i, mode] of ['solo', 'duo'].entries()) this.button('layout-' + mode, i ? '同屏双人' : '单人 / 联机', PAD + i * 116, 62, 108, 28, () => {
      this.cancel(); e.mode = mode; e.selected = null; this.refreshControlEditor();
    }, { selected: e.mode === mode, size: 12, radius: 10 });
    this.button('layout-reset', '恢复默认', W - PAD - 100, 62, 100, 28, () => {
      this.cancel(); e.draft[e.mode] = {}; e.selected = null; this.refreshControlEditor();
    }, { size: 12, radius: 10 });
    const hint = e.conflicts.size ? '位置重叠，松手将回到原位' : e.adapted ? '当前屏幕使用默认布局，可重新拖动调整' : '拖动按键 · 移动区整体调整';
    this.text(hint, 262, 76, 12, e.conflicts.size ? C.red : C.sub, 500, 'left', W - 390);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (let x = PAD; x < W; x += 32) { g.beginPath(); g.moveTo(x, 100); g.lineTo(x, H - 12); g.stroke(); }
    for (let y = 100; y < H; y += 32) { g.beginPath(); g.moveTo(PAD, y); g.lineTo(W - PAD, y); g.stroke(); }
    if (e.mode === 'duo') { g.strokeStyle = 'rgba(255,207,74,.35)'; g.beginPath(); g.moveTo(W / 2, 100); g.lineTo(W / 2, H - 12); g.stroke(); }
    g.restore();
    this.drawControls(e.controls, true);
    for (const item of e.groups) {
      const color = e.conflicts.has(item.id) ? C.red : item.id === e.selected ? C.gold : 'rgba(220,235,255,.48)';
      this.rect(item.x - item.off - item.r - 4, item.y - item.r - 4, (item.off + item.r + 4) * 2, (item.r + 4) * 2, null, item.r + 4, color, item.id === e.selected ? 2 : 1);
      if (item.off) this.text(e.mode === 'duo' ? `P${item.player + 1} 移动` : '移动区', item.x, item.y, 11, color, 700, 'center');
    }
  }
  drawControls(controls = this.controls, editing = false) {
    const g = this.g, a = this.app;
    if (!controls) { this.layoutControls(); controls = this.controls; }
    const held = b => { if (editing) return false; for (const p of a.input.pointers.values()) if (p.hit?.id === b.id || (b.dir && p.hit?.player === b.player && p.dir === b.dir)) return true; for (const k of a.input.keys.values()) if (b.dir ? k.hit?.player === b.player && k.dir === b.dir : false) return true; return false; };
    const pads = new Set();
    for (const b of controls) {
      if (b.dir) {
        if (pads.has(b.zone)) continue; pads.add(b.zone);
        const { cx, cy, r, off } = b.pad, left = controls.find(c => c.zone === b.zone && c.dir < 0), right = controls.find(c => c.zone === b.zone && c.dir > 0);
        const x = cx - off - r, w = (off + r) * 2, h = r * 2, y = cy - r;
        this.rect(x, y, w, h, this.grad(0, y, 0, y + h, [[0, 'rgba(210,230,255,.06)'], [1, 'rgba(12,18,38,.12)']]), r, 'rgba(210,230,255,.38)', 1.2);
        for (const [c, d] of [[left, -1], [right, 1]]) {
          const on = held(c);
          if (on) {
            g.save(); this.YY.rr(g, x, y, w, h, r); g.clip();
            g.fillStyle = this.grad(cx, 0, cx + d * w / 2, 0, [[0, 'rgba(255,207,74,.04)'], [1, 'rgba(255,207,74,.18)']]);
            g.fillRect(d < 0 ? x : cx, y, w / 2, h); g.restore();
          }
          g.save(); g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 3;
          this.icon(d < 0 ? 'left' : 'right', cx + d * off, cy, r * .62, on ? C.gold : 'rgba(235,242,255,.92)'); g.restore();
        }
        this.rect(cx - .75, cy - r * .55, 1.5, r * 1.1, 'rgba(255,255,255,.18)', 1);
        continue;
      }
      const on = held(b), r = b.r * (on ? .94 : 1), color = b.color || C.text;
      this.circle(b.x, b.y + 3, r, 'rgba(0,0,0,.28)');
      if (b.action === 'jump') {
        this.circle(b.x, b.y, r, this.grad(0, b.y - r, 0, b.y + r, on ? [[0, C.gold], [1, C.goldLip]] : [[0, C.goldHi], [1, C.goldLo]]));
        this.circle(b.x, b.y - r * .25, r * .7, 'rgba(255,255,255,.16)');
        this.text(b.label, b.x, b.y + 1, Math.round(r * .62), C.ink, 900, 'center');
      } else {
        this.circle(b.x, b.y, r, this.grad(0, b.y - r, 0, b.y + r, on ? [[0, this.alpha(color, .55)], [1, this.alpha(color, .3)]] : [[0, 'rgba(34,48,86,.80)'], [1, 'rgba(10,16,34,.84)']]));
        this.circle(b.x, b.y, r - 1.5, null, color, on ? 3.5 : 2.2);
        const isSkill = b.action === 'skill' || b.action === 'skill2';
        this.text(b.label, b.x, b.y + (isSkill && !editing ? -4 : 1), isSkill ? (b.label.length > 2 ? 11 : 13) : Math.round(r * .46), on ? '#fff' : color, 800, 'center');
      }
      if ((b.action === 'skill' || b.action === 'skill2') && !editing) {
        const m = a.isOnline() ? a.view : a.match, energy = m?.players[a.isOnline() ? a.playerIndex : b.player]?.energy || 0;
        const cost = b.cost || 100, ready = energy >= cost;
        if (ready) { g.save(); g.globalAlpha = .35 + .3 * Math.sin(this.now * 8); this.circle(b.x, b.y, b.r + 9, null, color, 3); g.restore(); }
        else { g.save(); g.globalAlpha = .45; this.circle(b.x, b.y, b.r - 2, 'rgba(0,0,0,.5)'); g.restore(); }
        g.lineCap = 'round'; g.beginPath(); g.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, energy / cost)); g.strokeStyle = color; g.lineWidth = 4; g.stroke(); g.lineCap = 'butt';
        this.text(String(cost), b.x, b.y + b.r * .48, 10, ready ? '#fff' : 'rgba(255,255,255,.6)', 800, 'center');
        if (a.input.layout !== 'duo' && b.action === 'skill2') this.text('能量 ' + Math.floor(energy), b.x - b.r - 10, b.y, 13, C.gold, 800, 'right');
      }
    }
    if (!editing) this.button('pause', '', PAD - 6, 10, 42, 40, () => a.togglePause(), { icon: 'pause', iconSize: 18, radius: 14 });
    if (!editing && a.isOnline()) this.chip(a.net.connectionText(), this.W / 2, this.H - 14, a.net.reconnectRemaining() != null ? C.red : C.green, { align: 'center' });
  }

  draw() {
    const a = this.app, g = this.g = a.R.ctx, dpr = a.R.dpr;
    this.buttons = []; this.regions = []; this.now = this.P.now() / 1000;
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(this.originX, this.originY); g.scale(this.scale, this.scale);
    g.textBaseline = 'middle';
    if (this.isPortrait) { this.portraitHint(); g.restore(); return; }
    if (this.picker && this.picker.screen !== a.screen) this.picker = null;
    if (!a.screen) this.drawControls();
    else {
      if (a.screen === 'controlEditor') {
        g.fillStyle = 'rgba(6,10,26,.18)'; g.fillRect(-this.originX / this.scale, -this.originY / this.scale, this.v.W / this.scale, this.v.H / this.scale);
        this.rect(0, 0, this.W, 96, 'rgba(6,10,26,.92)', 12);
      } else this.backdrop(['dialog','inspect'].includes(a.screen) ? 'dialog' : a.screen === 'menu' ? 'menu' : 'page');
      const screen = this[a.screen];
      if (typeof screen === 'function') screen.call(this);
      if (this.picker) this.kitPicker();
    }
    g.restore();
  }
  // ---------- 技能选择面板（同屏 / 联机准备 / 快速对战共用） ----------
  /**
   * 打开技能面板。opt: { char, kit, title, readOnly, onDone(kit) }
   * 可编辑时：点卡片选中/取消，选满 2 个后点未选的卡片会替换较早选中的那个；确认后回调。
   * 只读时：仅查看对方的被动与携带的技能。
   */
  openKitPicker(opt) {
    const YY = this.YY, char = YY.char(opt.char);
    this.picker = { char: char.id, sel: YY.skillSet(char.id, opt.kit).act.slice(), title: opt.title || '选择技能', readOnly: !!opt.readOnly, live: opt.live, onDone: opt.onDone, screen: this.app.screen };
  }
  closeKitPicker() { this.picker = null; }
  pickSkill(k) {
    const pk = this.picker; if (!pk || pk.readOnly) return;
    const i = pk.sel.indexOf(k);
    if (i >= 0) pk.sel.splice(i, 1);
    else if (pk.sel.length < 2) pk.sel.push(k);
    else pk.sel = [pk.sel[1], k];
  }
  kitPicker() {
    const a = this.app, YY = this.YY, W = this.W, H = this.H, g = this.g, pk = this.picker;
    if (pk.live) { const cur = pk.live(); if (!cur) { this.picker = null; return; } pk.char = cur.char; pk.sel = cur.kit.slice(); }
    // 面板是模态的：底层页面的按钮与滚动区全部失效
    this.buttons = []; this.regions = [];
    g.fillStyle = 'rgba(4,8,20,.78)'; g.fillRect(-this.originX / this.scale, -this.originY / this.scale, this.v.W / this.scale, this.v.H / this.scale);
    const char = YY.char(pk.char), look = YY.lookOf(char.id), pas = YY.SKILLS[char.passive] || { name: '—', desc: '' };
    const x = PAD, y = 12, w = W - PAD * 2, h = H - 24;
    this.card(x, y, w, h, { glow: this.alpha(look.shirt, .18), stroke: this.alpha(look.shirt, .5) });
    // 顶部：角色 + 被动
    const cx = Math.min(x + w - 52, this.capL - 44); // 避开微信右上角胶囊
    this.portrait(char.id, x + 14, y + 12, 50, look.shirt);
    this.text(pk.title, x + 76, y + 24, 13, C.gold, 700, 'left', cx - x - 90);
    this.text(YY.charName(char.id) + ' · ' + char.title, x + 76, y + 48, 19, C.text, 800, 'left', cx - x - 90);
    this.button('kit-close', '', cx, y + 12, 40, 40, () => this.closeKitPicker(), { icon: 'cross', radius: 14 });
    const py = y + 72;
    this.rect(x + 14, py, w - 28, 44, 'rgba(255,255,255,.05)', 12, 'rgba(255,255,255,.1)');
    this.chip('被动 · ' + pas.name, x + 24, py + 22, pas.color || C.gold, { size: 12, h: 24 });
    const pw = this.measure('被动 · ' + pas.name, 12, 700) + 30;
    this.wrap(pas.desc, x + 24 + pw, py + 13, w - 62 - pw, 12, C.sub, 17, 2);
    // 中部：三张主动技能卡
    const footH = 54, cy = py + 54, chH = h - (cy - y) - footH, gap = 10, cw = (w - 28 - gap * 2) / 3;
    (char.acts || []).forEach((k, i) => {
      const sk = YY.SKILLS[k]; if (!sk) return;
      const on = pk.sel.indexOf(k), id = 'pick-' + k, pressed = !pk.readOnly && this.isPressed(id);
      const bx = x + 14 + i * (cw + gap), by = cy + (pressed ? 2 : 0), dim = pk.readOnly && on < 0;
      g.globalAlpha = dim ? .5 : 1;
      this.card(bx, by, cw, chH, { radius: 14, accent: on >= 0 ? sk.color : null, glow: on >= 0 ? this.alpha(sk.color, .2) : null, stroke: on >= 0 ? this.alpha(sk.color, .85) : 'rgba(255,255,255,.12)', flat: pressed });
      if (!pk.readOnly) this.buttons.push({ id, x: bx, y: cy, w: cw, h: chH, onClick: () => this.pickSkill(k), disabled: false });
      this.rect(bx + 12, by + 13, 4, 20, sk.color, 2);
      this.text(sk.name, bx + 22, by + 23, 15, on >= 0 ? C.gold : C.text, 800, 'left', cw - 84);
      this.chip('能量 ' + sk.cost, bx + cw - 10, by + 23, sk.color, { align: 'right', size: 11, h: 20 });
      const lines = Math.max(1, Math.floor((chH - 82) / 17));
      this.wrap(sk.desc, bx + 12, by + 48, cw - 24, 12, on >= 0 ? C.text : C.sub, 17, lines);
      const ly = by + chH - 20;
      if (on >= 0) this.chip((pk.readOnly ? '携带 · ' : '已选 · ') + (on ? '技能二' : '技能一'), bx + cw / 2, ly, C.green, { align: 'center', size: 12, h: 24 });
      else this.text(pk.readOnly ? '未携带' : '点击选择', bx + cw / 2, ly, 12, C.dim, 600, 'center');
      g.globalAlpha = 1;
    });
    // 底部：说明 + 确认
    const fy = y + h - footH + 6;
    if (pk.readOnly) {
      this.text('能量够即可释放 · 对手携带的两个技能已高亮', x + 18, fy + 21, 12, C.dim, 500, 'left', w - 200);
      this.button('kit-ok', '知道了', x + w - 150, fy, 136, 42, () => this.closeKitPicker(), { primary: true, size: 15 });
    } else {
      const n = pk.sel.length;
      this.text(n === 2 ? '已选 2 / 2 · 先选的是技能一（右下大键）' : `还需选择 ${2 - n} 个 · 点卡片选中，再点一次取消`, x + 18, fy + 21, 12, n === 2 ? C.sub : C.gold, 600, 'left', w - 330);
      this.button('kit-cancel', '取消', x + w - 290, fy, 120, 42, () => this.closeKitPicker(), { size: 15 });
      this.button('kit-ok', '确认携带', x + w - 160, fy, 146, 42, () => { const kit = pk.sel.slice(); this.closeKitPicker(); if (pk.onDone) pk.onDone(kit); }, { primary: true, disabled: n !== 2, size: 15, icon: 'check' });
    }
  }
  portraitHint() {
    const g = this.g, x = -this.originX / this.scale, y = -this.originY / this.scale;
    g.fillStyle = this.grad(0, y, 0, y + this.v.H / this.scale, [[0, '#0d1834'], [1, '#060b1c']]); g.fillRect(x, y, this.v.W / this.scale, this.v.H / this.scale);
    const cx = this.W / 2, cy = this.H / 2 - 60, t = this.now % 2.4, k = Math.min(1, Math.max(0, (t - .4) / .8)), ang = -Math.PI / 2 * (k * k * (3 - 2 * k));
    g.save(); g.translate(cx, cy); g.rotate(ang);
    this.rect(-30, -50, 60, 100, 'rgba(255,255,255,.06)', 12, C.gold, 3); this.rect(-10, -43, 20, 4, C.gold, 2);
    g.restore();
    this.text('请横屏游玩', cx, cy + 90, 26, C.gold, 800, 'center');
    this.text('旋转手机，展开你的羽毛球场', cx, cy + 126, 16, C.sub, 500, 'center');
  }

  // ---------- 页面 ----------
  menu() {
    const a = this.app, YY = this.YY, W = this.W, H = this.H, split = Math.max(250, W * .42);
    const hy = Math.max(0, (H - 380) / 2);
    // 左侧主视觉
    this.rect(PAD, 30 + hy, 22, 4, C.gold, 2);
    this.text('BADMINTON DUEL', PAD + 30, 32 + hy, 12, C.gold, 800);
    this.text('羽跃', PAD - 3, 88 + hy, 60, C.text, 900);
    const g = this.g; this.font(60, 900); g.fillStyle = this.grad(0, 124 + hy, 0, 180 + hy, [[0, C.goldHi], [1, C.goldLo]]); g.textAlign = 'left'; g.fillText('对决', PAD - 3, 152 + hy);
    const bob = Math.sin(this.now * 1.8) * 5;
    this.shuttle(PAD + 170, 112 + hy + bob, 96);
    this.text('每一次跃起，都有新的可能。', PAD, 202 + hy, 16, C.sub, 500, 'left', split - PAD - 10);
    const done = YY.STAGES.filter(s => YY.Profile.stars(s.id)).length, stars = YY.STAGES.reduce((n, s) => n + YY.Profile.stars(s.id), 0);
    const cw = Math.min(260, split - PAD - 6), cy = 226 + hy;
    this.card(PAD, cy, cw, 66, { radius: 16 });
    this.icon('trophy', PAD + 24, cy + 24, 20, C.gold);
    this.text('星光回响', PAD + 42, cy + 24, 14, C.sub, 600);
    this.text(`${done}/${YY.STAGES.length} 关`, PAD + cw - 14, cy + 24, 15, C.text, 800, 'right');
    this.bar(PAD + 14, cy + 44, cw - 28 - 46, 7, done / YY.STAGES.length);
    this.icon('star', PAD + cw - 40, cy + 47.5, 12, C.gold); this.text(String(stars), PAD + cw - 14, cy + 48, 13, C.gold, 700, 'right');
    this.icon('map', PAD + 9, 316 + hy, 15, C.dim);
    this.text(YY.VENUES[a.R.venueId].name, PAD + 24, 316 + hy, 14, C.dim, 500);
    this.text('v' + a.net.config.version, PAD, H - 14, 12, 'rgba(160,175,205,.55)', 500);
    // 右侧入口
    const x = split + 8, w = W - x - PAD, top = Math.max(56, this.capB + 8, (H - 304) / 2), gw = (w - 10) / 2;
    const chap = (YY.STAGES.find(s => !YY.Profile.stars(s.id)) || YY.STAGES[YY.STAGES.length - 1]).chapter;
    this.tile('story', x, top, w, 92, { primary: true, icon: 'book', title: '故事模式', sub: chap.title.replace(' · ', '  ·  '), titleSize: 24, onClick: () => a.show('story') });
    this.tile('ai', x, top + 102, gw, 70, { icon: 'bolt', title: '快速对战', sub: '三档 AI 对手', color: C.red, onClick: () => a.show('ai') });
    this.tile('practice', x + gw + 10, top + 102, gw, 70, { icon: 'target', title: '自由练习', sub: '训练与战术教学', color: C.cyan, onClick: () => a.show('practice') });
    this.tile('friend', x, top + 182, gw, 70, { icon: 'users', title: '好友对战', sub: '同屏 · 在线', color: C.green, onClick: () => a.show('friend') });
    this.tile('team', x + gw + 10, top + 182, gw, 70, { icon: 'shirt', title: '角色装备', sub: `${YY.CHARS.filter(c => YY.Profile.has('char', c.id)).length}/${YY.CHARS.length} 位角色`, color: C.purple, onClick: () => a.show('team') });
    const sw = (w - 20) / 3;
    this.button('codex', '图鉴', x, top + 262, sw, 42, () => a.show('codex'), { icon: 'cards', size: 15 });
    this.button('help', '玩法', x + sw + 10, top + 262, sw, 42, () => a.show('help'), { icon: 'help', size: 15 });
    this.button('settings', '设置', x + 2 * (sw + 10), top + 262, sw, 42, () => a.show('settings'), { icon: 'gear', size: 15 });
  }
  ai() {
    const a = this.app, YY = this.YY, W = this.W, H = this.H; this.header('快速对战', '7 分制 · 10:10 后先得 11 分者胜');
    const venueY = H - 54, rowY = venueY - 72, top = 64, cardH = rowY - 12 - top, cardW = (W - 2 * PAD - 24) / 3;
    [['easy', '轻松热身', '慢一点，看清落点。', C.green], ['normal', '认真切磋', '变换球路，寻找空当。', C.gold], ['hard', '高手过招', '抓住每一个击球窗口。', C.red]].forEach(([id, title, text, color], i) => {
      const x = PAD + i * (cardW + 12), pressed = this.isPressed(id), y = top + (pressed ? 2 : 0);
      this.card(x, y, cardW, cardH, { accent: color, glow: this.alpha(color, .14), flat: pressed });
      this.text('0' + (i + 1), x + 16, y + 28, 22, color, 900);
      for (let k = 0; k < 3; k++) this.rect(x + cardW - 18 - (2 - k) * 14, y + 24, 10, 10, k <= i ? color : 'rgba(255,255,255,.14)', 3);
      this.text(title, x + 16, y + 62, 20, C.text, 800, 'left', cardW - 32);
      this.wrap(text, x + 16, y + 90, cardW - 32, 14, C.sub, 20, cardH > 150 ? 2 : 1);
      const by = y + cardH - 44;
      if (i === 1) { this.rect(x + 14, by, cardW - 28, 32, this.grad(0, by, 0, by + 32, [[0, C.goldHi], [1, C.goldLo]]), 16); this.text('开始对战', x + cardW / 2, by + 16.5, 15, C.ink, 800, 'center'); }
      else { this.rect(x + 14, by, cardW - 28, 32, this.alpha(color, .14), 16, this.alpha(color, .5)); this.text('开始对战', x + cardW / 2, by + 16.5, 15, color, 800, 'center'); }
      this.buttons.push({ id, x, y: top, w: cardW, h: cardH, onClick: () => a.startAI(id), disabled: false });
    });
    const id = YY.Profile.sel.char, kit = YY.skillSet(id, YY.Profile.kit(id)), skill = YY.SKILLS[kit.act[0]];
    this.card(PAD, rowY, W - 2 * PAD, 60, { radius: 16 });
    this.portrait(id, PAD + 10, rowY + 8, 44, 'rgba(255,255,255,.35)');
    const bx = W - PAD - 10, sx = bx - 112 - 10 - 168;
    this.text(YY.charName(id), PAD + 66, rowY + 21, 17, C.text, 800);
    this.text('携带 ' + kit.act.map(k => YY.SKILLS[k].name).join(' + '), PAD + 66, rowY + 42, 13, skill.color || C.gold, 600, 'left', sx - PAD - 76);
    this.button('loadout', '选择技能', bx - 112, rowY + 10, 112, 40, () => this.openKitPicker({ char: id, kit: kit.act, title: '快速对战 · 选择携带的 2 个技能', onDone: k => YY.Profile.setKit(id, k) }), { icon: 'spark', size: 14 });
    this.button('skills', '角色技能', sx, rowY + 10, 168, 40, () => { a.settings.skills = !a.settings.skills; a.saveSettings(); }, { align: 'left', icon: 'spark', size: 14, iconColor: a.settings.skills ? C.gold : C.dim });
    this.toggle(sx + 168 - 54, rowY + 30 + (this.isPressed('skills') ? 2 : 0), a.settings.skills);
    this.venues(venueY);
  }
  venues(y) {
    const a = this.app, ids = ['random', ...this.YY.VENUE_IDS], names = ['随机', ...this.YY.VENUE_IDS.map(id => this.YY.VENUES[id].name)];
    const x = PAD + 48, w = this.W - x - PAD, bw = (w - 8 - (ids.length - 1) * 4) / ids.length;
    this.icon('map', PAD + 9, y + 20, 16, C.dim); this.text('场馆', PAD + 22, y + 20, 13, C.dim, 600);
    this.rect(x, y, w, 40, 'rgba(0,0,0,.28)', 14, 'rgba(255,255,255,.08)');
    ids.forEach((id, i) => {
      const sel = a.settings.venue === id, bx = x + 4 + i * (bw + 4);
      if (sel) this.rect(bx, y + 4, bw, 32, this.grad(0, y, 0, y + 36, [[0, 'rgba(255,207,74,.28)'], [1, 'rgba(255,207,74,.12)']]), 11, C.gold);
      else if (this.isPressed('venue-' + id)) this.rect(bx, y + 4, bw, 32, 'rgba(255,255,255,.08)', 11);
      this.text(names[i], bx + bw / 2, y + 20.5, 14, sel ? C.gold : C.sub, sel ? 800 : 600, 'center', bw - 10);
      this.buttons.push({ id: 'venue-' + id, x: bx, y, w: bw, h: 40, onClick: () => a.setVenueSetting(id), disabled: false });
    });
  }
  practice() {
    this.header('自由练习', '跟随落点与挥拍提示，找到你的节奏');
    const W = this.W, H = this.H, entries = Object.entries(this.YY.DRILLS), venueY = H - 54, top = 64;
    const cols = entries.length > 4 ? 3 : 2, rows = Math.ceil(entries.length / cols);
    const w = (W - 2 * PAD - 12 * (cols - 1)) / cols, h = (venueY - 12 - top - 12 * (rows - 1)) / rows;
    entries.forEach(([id, def], i) => {
      const [icon, color] = DRILL_LOOK[id] || ['target', C.gold], bid = 'drill-' + id, pressed = this.isPressed(bid);
      const x = PAD + (i % cols) * (w + 12), y0 = top + Math.floor(i / cols) * (h + 12), y = y0 + (pressed ? 2 : 0);
      this.card(x, y, w, h, { glow: this.alpha(color, .14), flat: pressed });
      this.icon(icon, x + 25, y + 30, 20, color);
      this.text(def.name, x + 48, y + 30, 17, C.text, 800, 'left', w - 80);
      this.wrap(def.tip, x + 16, y + 62, w - 32, 13, C.sub, 19, Math.max(1, Math.floor((h - 56) / 19)));
      this.circle(x + w - 22, y + 30, 12, C.gold);
      this.icon('play', x + w - 21, y + 30, 10, C.ink);
      this.buttons.push({ id: bid, x, y: y0, w, h, onClick: () => this.app.startPractice(id), disabled: false });
    });
    this.venues(venueY);
  }
  tacticsComplete() {
    const a = this.app, W = this.W, H = this.H;
    this.header('三拍战术 · 已掌握', '把三个动作连起来，制造属于你的进攻机会', () => { a.startAttract(); a.show('practice'); });
    const w = (W - PAD * 2 - 24) / 3, top = 68, h = H - 152;
    this.YY.TACTIC_LESSON.forEach((step, i) => {
      const x = PAD + i * (w + 12);
      this.card(x, top, w, h, { glow: 'rgba(255,207,74,.12)' });
      this.chip('0' + (i + 1) + '  已完成', x + 16, top + 24, C.green);
      this.text(step.title, x + 16, top + 64, 20, C.gold, 800, 'left', w - 32);
      this.wrap(step.why, x + 16, top + 100, w - 32, 14, C.sub, 22, Math.floor((h - 100) / 22) + 1);
    });
    const bw = (W - PAD * 2 - 24) / 3;
    this.button('tactics-back', '返回训练', PAD, H - 62, bw, 46, () => { a.startAttract(); a.show('practice'); }, { icon: 'back' });
    this.button('tactics-retry', '再练一遍', PAD + bw + 12, H - 62, bw, 46, () => a.startPractice('tactics'), { icon: 'retry' });
    this.button('tactics-match', '实战试一试', PAD + 2 * (bw + 12), H - 62, bw, 46, () => a.startAI('easy'), { primary: true, icon: 'play' });
  }
  friend() {
    const a = this.app, W = this.W, H = this.H; this.header('好友对战', '同样的能力，只比拼操作与判断');
    const top = 64, w = (W - 2 * PAD - 14) / 2, h = H - top - 46, online = a.net.configured();
    this.card(PAD, top, w, h, { glow: 'rgba(255,207,74,.16)' });
    this.rect(PAD + 18, top + 18, 46, 46, 'rgba(255,207,74,.18)', 14, 'rgba(255,207,74,.45)'); this.icon('users', PAD + 41, top + 41, 26, C.gold);
    this.text('同屏切磋', PAD + 78, top + 41, 22, C.text, 800);
    this.wrap('和身边的好友共用一块屏幕，左右各一套按键，各自选择角色、发动技能。', PAD + 20, top + 92, w - 40, 15, C.sub, 23, 3);
    this.button('local', '选择角色', PAD + 18, top + h - 66, w - 36, 48, () => a.show('duo'), { primary: true, size: 17, icon: 'users' });
    const x = PAD + w + 14;
    this.card(x, top, w, h, { glow: 'rgba(95,212,255,.14)' });
    this.rect(x + 18, top + 18, 46, 46, 'rgba(95,212,255,.18)', 14, 'rgba(95,212,255,.45)'); this.icon('share', x + 41, top + 41, 24, C.cyan);
    this.text('在线约球', x + 78, top + 41, 22, C.text, 800);
    if (!online) this.chip('即将开放', x + w - 18, top + 41, C.cyan, { align: 'right', size: 12 });
    this.wrap(online ? '创建房间，把邀请发给好友；或输入好友的 4 位房间码加入。' : '在线房间即将开放。先和 AI 练练手，或邀请身边的好友同屏切磋。', x + 20, top + 92, w - 40, 15, C.sub, 23, 3);
    const bw = (w - 46) / 2;
    this.button('host', '创建房间', x + 18, top + h - 66, bw, 48, () => a.hostOnline(), { disabled: !online, size: 16 });
    this.button('join', '加入房间', x + 28 + bw, top + h - 66, bw, 48, () => { a.roomInput = ''; a.show('join'); }, { disabled: !online, size: 16 });
    this.icon('info', PAD + 8, H - 20, 14, C.dim);
    this.text('统一基础能力，不计装备加成；在线房间由双方确认技能规则', PAD + 22, H - 20, 13, C.dim);
  }
  duo() {
    const a = this.app, YY = this.YY, W = this.W, H = this.H, { pick } = a.duoChars();
    this.header('同屏对战', '左右玩家各选一名角色', () => a.show('friend'));
    const top = 62, w = (W - 2 * PAD - 70) / 2, h = H - top - 74;
    pick.forEach((id, i) => {
      const x = i ? W - PAD - w : PAD, c = YY.char(id), look = YY.lookOf(id), kit = YY.Profile.kit(id);
      this.card(x, top, w, h, { glow: this.alpha(look.shirt, .2), stroke: this.alpha(look.shirt, .5) });
      this.chip(i ? 'P2 · 右侧' : 'P1 · 左侧', x + 16, top + 22, i ? C.cyan : C.red, { size: 12, h: 24 });
      const ps = Math.min(108, h - 92);
      this.portrait(id, x + w / 2 - ps / 2, top + 40, ps, look.shirt);
      this.button(`duo-prev-${i}`, '', x + 12, top + 40 + ps / 2 - 22, 40, 44, () => a.duoCycle(i, -1), { icon: 'back', radius: 14 });
      this.button(`duo-next-${i}`, '', x + w - 52, top + 40 + ps / 2 - 22, 40, 44, () => a.duoCycle(i, 1), { icon: 'next', radius: 14 });
      this.text(look.name, x + w / 2, top + ps + 58, 20, C.text, 800, 'center');
      this.text(c.title, x + w / 2, top + ps + 80, 13, C.sub, 600, 'center');
      if (a.settings.skills) this.button(`duo-kit-${i}`, kit.map(k => YY.SKILLS[k].name).join(' + ') + '  ›', x + 18, top + ps + 92, w - 36, 32, () => this.openKitPicker({ char: id, kit, title: (i ? 'P2' : 'P1') + ' · 选择携带的 2 个技能', onDone: k => YY.Profile.setKit(id, k) }), { icon: 'spark', size: 13, radius: 12 });
    });
    this.text('VS', W / 2, top + h / 2, 30, C.gold, 900, 'center');
    const by = H - 58;
    this.button('duo-skills', '角色技能', PAD, by, 168, 44, () => { a.settings.skills = !a.settings.skills; a.saveSettings(); }, { align: 'left', icon: 'spark', size: 14, iconColor: a.settings.skills ? C.gold : C.dim });
    this.toggle(PAD + 168 - 54, by + 22 + (this.isPressed('duo-skills') ? 2 : 0), a.settings.skills);
    this.button('duo-start', '开始对战', W - PAD - 200, by, 200, 44, () => a.startLocal(), { primary: true, size: 17, icon: 'play' });
  }
  join() {
    const a = this.app, W = this.W; this.header('加入房间', '输入好友分享的 4 位房间码', () => a.show('friend'));
    const code = a.roomInput || '', alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const sw = 50, gap = 12, sx = W / 2 - (sw * 4 + gap * 3) / 2;
    for (let i = 0; i < 4; i++) {
      const x = sx + i * (sw + gap), active = i === code.length;
      this.rect(x, 62, sw, 58, code[i] ? 'rgba(255,207,74,.14)' : 'rgba(0,0,0,.3)', 14, code[i] || active ? C.gold : 'rgba(255,255,255,.16)', active ? 2 : 1.2);
      if (code[i]) this.text(code[i], x + sw / 2, 92, 30, C.gold, 900, 'center');
      else if (active && Math.floor(this.now * 2) % 2) this.rect(x + sw / 2 - 1, 78, 2, 28, C.gold, 1);
    }
    const kw = Math.min(64, (W - 2 * PAD - 9 * 6) / 10), kh = 42, kx = W / 2 - (kw * 10 + 54) / 2, ky = 136;
    [...alphabet].forEach((char, i) => this.button('key-' + char, char, kx + (i % 10) * (kw + 6), ky + Math.floor(i / 10) * (kh + 7), kw, kh, () => { if ((a.roomInput || '').length < 4) a.roomInput = (a.roomInput || '') + char; }, { size: 19, radius: 11 }));
    const ly = ky + 3 * (kh + 7), lx = kx + kw + 6, right = kx + kw * 10 + 54;
    this.button('erase', '删除', lx, ly, kw * 2 + 6, kh, () => { a.roomInput = code.slice(0, -1); }, { size: 15, icon: 'back' });
    this.button('enter', '加入比赛', lx + kw * 2 + 12, ly, right - (lx + kw * 2 + 12), kh, () => a.joinOnline(a.roomInput), { primary: true, disabled: code.length !== 4, size: 16 });
  }
  lobby() {
    const a = this.app, YY = this.YY, W = this.W, H = this.H, room = a.roomState, me = a.net.player || 0;
    const online = a.net.status === 'connected' && a.net.reconnectRemaining() == null && !a.net.awaitingWelcome;
    const last = room?.lastResult, sub = a.roomScore() + (last ? ` · 上局 ${last.score[me]}:${last.score[1 - me]}` : ' · 双方确认后开局');
    this.header('房间 ' + (a.net.code || '····'), sub, () => { a.net.close(); a.roomState = null; a.startAttract(); a.show('friend'); });
    const top = 64, w = (W - PAD * 2 - 14) / 2, h = H - 224;
    [me, 1 - me].forEach((idx, col) => {
      const p = room?.players[idx], x = PAD + col * (w + 14), mine = idx === me;
      this.card(x, top, w, h, { glow: this.alpha(mine ? C.gold : C.cyan, .14) });
      this.text((mine ? '你' : '好友') + (idx === 0 ? ' · 房主' : ''), x + 16, top + 21, 13, C.sub, 700);
      if (!p) { this.text('等待好友加入', x + w / 2, top + 82, 20, C.dim, 700, 'center'); return; }
      const status = !p.connected ? `重连 ${p.reconnect} 秒` : p.away ? '暂时离开' : p.ready ? '已准备' : '未准备';
      this.chip(status, x + w - 14, top + 21, p.ready && p.connected && !p.away ? C.green : C.gold, { align: 'right', size: 12 });
      this.portrait(p.char, x + 14, top + 43, 52, mine ? C.gold : C.cyan);
      const kit = a.roomKit(idx).map(k => YY.SKILLS[k]).filter(Boolean), pas = YY.SKILLS[YY.char(p.char).passive] || { name: '' };
      this.text(YY.charName(p.char), x + 82, top + 55, 21, C.text, 800, 'left', w - 98);
      this.text(room.rules.skills ? kit.map(k => k.name).join(' + ') : '标准对战 · 技能关闭', x + 82, top + 81, 13, room.rules.skills ? (kit[0]?.color || C.gold) : C.dim, 600, 'left', w - 98);
      if (mine) {
        this.button('room-prev', '', x + 14, top + h - 46, 40, 34, () => a.roomCycle(-1), { icon: 'back', disabled: !online });
        this.button('room-next', '', x + 62, top + h - 46, 40, 34, () => a.roomCycle(1), { icon: 'next', disabled: !online });
        if (room.rules.skills) this.button('room-kit', '选技能', x + 110, top + h - 46, 86, 34, () => this.openKitPicker({ char: p.char, kit: a.roomKit(idx), title: '房间 ' + (a.net.code || '') + ' · 选择携带的 2 个技能', onDone: k => a.roomSetKit(k) }), { icon: 'spark', size: 13, disabled: !online });
        this.wrap(room.rules.skills ? '被动 · ' + pas.name + '\n换角色或技能后重新准备' : '全角色可试用\n换角色后重新准备', x + (room.rules.skills ? 206 : 116), top + h - 35, w - (room.rules.skills ? 222 : 132), 12, C.dim, 17, 2);
      } else if (room.rules.skills) {
        this.button('room-peek', '查看对手技能', x + 14, top + h - 46, 128, 34, () => this.openKitPicker({ char: p.char, kit: a.roomKit(idx), title: '好友的技能 · 被动与携带', readOnly: true, live: () => { const q = a.roomState?.players[idx]; return q && { char: q.char, kit: a.roomKit(idx) }; } }), { icon: 'info', size: 13 });
        this.wrap('被动 · ' + pas.name, x + 152, top + h - 35, w - 168, 12, C.sub, 17, 2);
      } else this.wrap('统一基础能力，不计装备加成。', x + 16, top + h - 36, w - 32, 12, C.sub, 17, 2);
    });
    const ry = H - 150, skills = room?.rules.skills;
    if (me === 0) this.button('room-rules', skills ? '角色技能对战' : '标准对战 · 关闭技能', PAD, ry, W - PAD * 2, 50, () => a.roomConfigure({ skills: !skills }), { align: 'left', icon: 'spark', disabled: !room || !online, size: 16 });
    else {
      this.card(PAD, ry, W - PAD * 2, 50, { radius: 14 });
      this.icon('spark', PAD + 24, ry + 25, 18, C.gold);
      this.text(skills ? '角色技能对战' : '标准对战 · 关闭技能', PAD + 44, ry + 25, 16, C.text, 700);
    }
    this.text(me === 0 ? '点此切换 · 7 分制 · 改规则后双方重新准备' : '房主选择规则 · 7 分制 · 准备即确认以上设置', W - PAD - 16, ry + 25, 12, C.sub, 500, 'right', W - PAD * 2 - 245);
    const countdown = room?.phase === 'countdown';
    this.text(countdown ? `${room.countdown} 秒后开局 · 可取消准备` : a.net.connectionText(), W / 2, H - 82, countdown ? 20 : 13, countdown ? C.gold : online ? C.green : C.red, 700, 'center');
    this.button('invite', '分享邀请', PAD, H - 62, 170, 46, () => this.P.share(a.net.code), { disabled: !a.net.code, icon: 'share', size: 16 });
    const ready = room?.players[me]?.ready;
    this.button('room-ready', ready ? '取消准备' : '确认角色与规则 · 准备', PAD + 182, H - 62, W - PAD * 2 - 182, 46, () => a.roomReady(), { primary: !ready, disabled: !online || !room || !!room.players[me]?.away, icon: ready ? 'cross' : 'check', size: 17 });
  }
  story() {
    const YY = this.YY, a = this.app, W = this.W, H = this.H, total = YY.STAGES.reduce((n, s) => n + YY.Profile.stars(s.id), 0);
    this.header('星光回响', `12 章故事  ★ ${total} / ${YY.STAGES.length * 3}`);
    this.button('story-journal','球馆手记',this.capL-116,12,110,36,()=>a.show('journal'),{size:13,icon:'book'});
    const railW = 172, ch = YY.STORY.find(ch => ch.id === a.storyChap) || YY.STORY[0], top = 62;
    this.scrollArea('chapters', PAD, top, railW, H - top - 12, YY.STORY.length * 60 - 8, y => YY.STORY.forEach((c, i) => {
      const open = YY.stageOpen(c.stages[0].id), parts = c.title.split(' · '), sel = ch.id === c.id;
      const got = c.stages.reduce((n, s) => n + YY.Profile.stars(s.id), 0);
      this.button('chapter-' + c.id, open ? parts.pop() : '未解锁', PAD, y + i * 60, railW, 52, () => { a.storyChap = c.id; this.scroll.stages = 0; }, { selected: sel, disabled: !open, size: 15, align: 'left', sub: open ? `${parts[0]} · ★ ${got}/${c.stages.length * 3}` : parts[0], icon: open ? null : 'lock' });
    }));
    const x = PAD + railW + 16, w = W - x - PAD;
    const parts = ch.title.split(' · ');
    this.chip(parts[0], x, top + 12, C.gold, { size: 12 });
    this.text(parts.slice(1).join(' · ') || ch.title, x + this.measure(parts[0], 12, 700) + 28, top + 12, 18, C.text, 800, 'left', w - 100);
    this.wrap(ch.blurb, x, top + 40, w, 14, C.sub, 20, 2);
    const ly = top + 80, ih = 70;
    this.scrollArea('stages', x, ly, w - 6, H - ly - 12, ch.stages.length * (ih + 10) - 10, y => ch.stages.forEach((st, i) => {
      const open = YY.stageOpen(st.id), stars = YY.Profile.stars(st.id), id = 'stage-' + st.id, pressed = open && this.isPressed(id), yy = y + i * (ih + 10) + (pressed ? 2 : 0);
      const [kindName, kindIcon, kindColor] = KIND[st.kind] || KIND.special, cw = w - 6;
      this.g.globalAlpha = open ? 1 : .55;
      this.card(x, yy, cw, ih, { radius: 16, flat: pressed, glow: open && !stars ? 'rgba(255,207,74,.12)' : null });
      this.rect(x + 12, yy + 13, 44, 44, open ? this.alpha(kindColor, .18) : 'rgba(255,255,255,.06)', 12, open ? this.alpha(kindColor, .45) : null);
      if (open) this.icon(kindIcon, x + 34, yy + 30, 18, kindColor); else this.icon('lock', x + 34, yy + 30, 16, C.dim);
      this.text(st.id, x + 34, yy + 48, 11, open ? kindColor : C.dim, 800, 'center');
      const tx = x + 68, right = x + cw - 14;
      this.text(st.title, tx, yy + 25, 16, open ? C.text : C.dim, 800, 'left', cw - 68 - 150);
      const continuing=YY.Profile.d.campaign.checkpoint?.stage===st.id;
      this.text(open ? `${continuing?'继续上次 · ':kindName+' · '}${st.desc}` : '完成上一关后解锁', tx, yy + 48, 13, continuing?C.gold:C.dim, 500, 'left', cw - 68 - 120);
      if (open) {
        this.stars(stars, right - 52, yy + 25, 13, 'right', 3);
        const pr = 17, px = right - pr, py = yy + ih / 2;
        this.circle(px, py + 2, pr, C.goldLip); this.circle(px, py, pr, this.grad(0, py - pr, 0, py + pr, [[0, C.goldHi], [1, C.goldLo]]));
        this.icon('play', px + 1.5, py, 13, C.ink);
      }
      this.g.globalAlpha = 1;
      this.buttons.push({ id, x, y: y + i * (ih + 10), w: cw, h: ih, onClick: () => a.startStage(st.id), disabled: !open });
    }));
  }
  journal() {
    const a=this.app,YY=this.YY,W=this.W,H=this.H,save=YY.Profile.d.campaign;
    this.header('球馆手记',`${save.clues.length} 条线索 · 选择与阶段进度自动保存`,()=>a.show('story'));
    const items=YY.STAGES.flatMap(st=>st.steps.filter(s=>s.t==='inspect').flatMap(s=>s.items)).filter(i=>save.clues.includes(i.clue));
    const cp=save.checkpoint, current=cp&&YY.stage(cp.stage);
    const text=[current?'正在进行：'+current.title+'（第 '+(cp.index+1)+' 个环节）':'尚无进行中的关卡。',...Object.entries(save.choices).map(([k,v])=>'我们的约定：'+v),...items.map(i=>i.label+'\n'+i.text)].join('\n\n');
    const top=70,tw=W-PAD*2-40;
    this.card(PAD,top,W-PAD*2,H-top-76,{radius:18});
    this.scrollArea('journal',PAD+20,top+15,tw,H-top-110,this.lines(text,tw,15).length*24+8,y=>this.wrap(text,PAD+20,y+12,tw,15,C.sub,24));
    this.button('journal-return',current?'继续：'+current.title:'返回故事地图',PAD,H-54,W-PAD*2,40,()=>current?a.startStage(current.id):a.show('story'),{primary:true,size:15});
  }
  dialog() {
    const a = this.app, d = a.dlg; if (!d) return;
    const W = this.W, H = this.H, [who, text] = d.lines[d.i], YY = this.YY;
    const name = who === 'nar' ? '旁白' : who === 'mm' ? '毛毛' : who === 'me' ? '凌风（你）' : YY.charName(who);
    const staged = !!(d.step && d.step.scene && YY.SCENES);
    const tone = who === 'nar' ? 'rgba(255,255,255,.75)' : who === 'mm' ? C.gold : (YY.lookOf(who === 'me' ? 'lingfeng' : who)?.shirt || C.gold);
    const sceneName = staged ? YY.SCENES[d.step.scene]?.name : null;
    this.chip(a.story?.st.title || '星光故事', PAD, 30, C.gold, { size: 14, h: 30, icon: 'book', fill: 'rgba(8,13,30,.72)' });
    if (sceneName) this.chip(sceneName, PAD, 66, C.sub, { size: 12, h: 24, icon: 'pin', fill: 'rgba(8,13,30,.55)' });
    this.button('voice', a.settings.voice===false?'配音关':'配音开', this.capL - 256, 12, 78, 36, () => a.toggleStoryVoice(), { size: 12 });
    this.button('replay-voice', '重听', this.capL - 170, 12, 76, 36, () => a.repeatStoryVoice(), { size: 12, disabled:a.settings.voice===false });
    this.button('skip', '跳过', this.capL - 86, 12, 86, 36, () => a.dlgFinish(), { size: 14, icon: 'next' });
    const ph = 132, py = H - ph - 10, px = PAD, pw = W - 2 * PAD, ps = staged ? 0 : 112;
    const nar = who === 'nar';
    this.card(px, py, pw, ph, { radius: 20, top: nar ? 'rgba(14,18,34,.9)' : 'rgba(24,34,66,.93)', bottom: 'rgba(10,15,32,.96)', stroke: nar ? 'rgba(255,255,255,.18)' : 'rgba(255,207,74,.3)' });
    if (!staged) this.portrait(who, px + 16, py - 30, ps, C.gold);
    // 名牌：用角色的主色，说话人一眼就能认出来
    const tx = staged ? px + 24 : px + ps + 34, nw = this.measure(name, 16, 800) + 28;
    if (!nar) {
      this.rect(tx - 4, py - 15, nw, 30, tone, 15);
      this.rect(tx - 4, py - 15, nw, 15, 'rgba(255,255,255,.18)', 15);
      this.text(name, tx + nw / 2 - 4, py + .5, 16, '#fff', 800, 'center');
    }
    const textW = pw - (tx - px) - 24, size = 17, lead = 26, shown = text.slice(0, Math.floor(d.progress));
    const contentHeight = this.lines(text, textW, size).length * lead;
    const color = nar ? 'rgba(235,240,255,.9)' : C.text;
    this.scrollArea('dialog-text', tx, py + (nar ? 14 : 24), textW + 4, nar ? 88 : 76, contentHeight, y => this.wrap(shown, tx, y + 12, textW, size, color, lead));
    const doneTyping = d.progress >= text.length;
    this.button('advance', doneTyping ? (d.i + 1 < d.lines.length ? '继续' : '完成') : '显示全文', px + pw - 120, py + ph - 42, 108, 32, () => a.dlgAdvance(), { size: 14, icon: doneTyping ? 'next' : null, primary: doneTyping });
    this.text(`${d.i + 1} / ${d.lines.length}`, tx, py + ph - 24, 12, C.dim, 600);
    this.text(a.settings.voice===false?'配音已关闭 · 自动存进度':YY.Audio.speech?.state==='loading'?'配音加载中 · 可继续阅读':YY.Audio.speech?.failed?'配音暂不可用 · 字幕可继续':'合成配音 · 自动存进度', tx+60, py+ph-24, 11, C.dim, 500);
    if (doneTyping) { const bob = Math.sin(this.now * 6) * 2; this.text('▼', px + pw - 132, py + ph - 26 + bob, 11, C.gold, 800, 'center'); }
    // 整块对话框都可以点击推进；显式按钮优先命中。
    this.buttons.unshift({ id: 'dialogue', x: px, y: staged ? 0 : py - 30, w: pw, h: staged ? py + ph - 46 : ph - 14, onClick: () => a.dlgAdvance() });
  }
  inspect() {
    const a=this.app,v=a.activity;if(!v)return;const W=this.W,H=this.H;
    this.header(v.step.title,`调查 ${v.found.length}/${v.step.items.length} · 点击场景标记`,()=>a.quit());
    const panelY=H-154;
    v.step.items.forEach((item,i)=>{
      const x=Math.max(PAD,Math.min(W-PAD-142,item.x*W-71)),y=72+item.y*Math.max(30,panelY-112),seen=v.found.includes(item.id);
      this.button('inspect-'+item.id,(seen?'✓ ':'')+item.label,x,y,142,40,()=>a.inspectItem(item.id),{selected:v.selected===item.id,icon:seen?'check':'target',size:14});
    });
    this.card(PAD,panelY,W-PAD*2,91,{radius:16,top:'rgba(12,23,39,.94)',bottom:'rgba(10,18,33,.96)'});
    const item=v.step.items.find(i=>i.id===v.selected);
    this.text(item?item.label:'从可以确认的事实开始',PAD+18,panelY+23,17,C.gold,800);
    this.wrap(item?item.text:'点击三个标记，阅读线索与知识。每次发现会自动保存，回来可以接着调查。',PAD+18,panelY+51,W-PAD*2-36,14,C.text,21,2);
    this.text('已收集 '+this.YY.Profile.d.campaign.clues.length+' 条球馆线索',PAD,H-30,12,C.sub,500);
    this.button('inspect-done','整理线索 · 继续',W-PAD-235,H-52,235,40,()=>a.finishInspect(),{primary:true,disabled:v.found.length!==v.step.items.length,size:15});
  }
  board() {
    const a=this.app,v=a.activity;if(!v)return;const W=this.W,H=this.H,c=v.step.cases[v.index],left=W*.37,x=left+30,rw=W-x-PAD;
    this.header(v.step.title,`${v.index+1}/${v.step.cases.length} · 判断后看解析，不设倒计时`,()=>a.quit());
    this.YY.drawLessonBoard(this.g,c.picture,PAD,66,left-PAD,H-82,v.selected!=null);
    this.wrap(c.q,x,83,rw,16,C.text,22,3,700);
    c.options.forEach((option,i)=>this.button('board-'+i,option,x,143+i*43,rw,36,()=>a.boardAnswer(i),{size:14,align:'left',selected:v.selected===i,disabled:v.selected!=null&&i!==c.answer&&i!==v.selected,tone:v.selected!=null&&i===c.answer?'good':null}));
    if(v.selected!=null){this.wrap(c.explanation,x,H-100,rw,12,C.sub,18,2);this.button('board-next',v.index+1<v.step.cases.length?'下一幕':'完成学习',x,H-49,rw,36,()=>a.boardNext(),{primary:true,size:15});}
    else this.text('看清图示，再做决定',x,H-29,12,C.dim,500);
  }
  lab() {
    const a=this.app,v=a.activity;if(!v)return;const W=this.W,H=this.H,d=this.YY.LABS[v.experiment],left=W*.60,x=left+16,w=W-x-PAD;
    this.header(v.step.title,'先试验，再比较，最后作出选择',()=>a.quit());
    this.wrap(d.hint,PAD,75,W-2*PAD,14,C.sub,20,2);
    this.YY.drawLab(this.g,v,PAD,115,left-PAD-4,H-181);
    d.labels.forEach((label,i)=>this.button('lab-'+i,(v.tried.includes(i)?'✓ ':'')+label,x,115+i*45,w,36,()=>a.labSelect(i),{selected:v.selected===i,size:14}));
    this.wrap(v.note||'点击设置，再点「试打一球」',x,260,w,12,C.sub,18,3);
    this.button('lab-try','试打一球',PAD,H-53,left-PAD-4,40,()=>a.labTry(),{icon:'play',size:15});
    this.button('lab-done','提交我的选择',x,H-53,w,40,()=>a.finishLab(),{primary:true,size:15,disabled:v.tried.length<3});
  }
  quiz() {
    const a = this.app, q = a.quiz; if (!q) return;
    const W = this.W, H = this.H, question = q.step.qs[q.i];
    this.header(a.story?.st.title || '羽球问答', q.pick ? '队友会记住你的回应' : `第 ${q.i + 1} / ${q.step.qs.length} 题 · 答对 ${q.step.need} 题过关`, () => a.quit());
    const qLines = Math.min(3, this.lines(question.q, W - 2 * PAD - 70, 18, 700).length), qh = 26 + qLines * 26;
    this.card(PAD, 62, W - 2 * PAD, qh, { accent: q.pick ? C.cyan : C.purple });
    this.chip(q.pick ? '选择' : 'Q' + (q.i + 1), PAD + 16, 62 + qh / 2, q.pick ? C.cyan : C.purple, { size: 12 });
    this.wrap(question.q, PAD + 70, 62 + qh / 2 - (qLines - 1) * 13, W - 2 * PAD - 86, 18, C.text, 26, 3, 700);
    const w = (W - 2 * PAD - 12) / 2, oy = 62 + qh + 14, oh = 50;
    question.o.forEach((option, i) => {
      const x = PAD + i % 2 * (w + 12), y = oy + Math.floor(i / 2) * (oh + 10);
      const good = q.answered && i === question.a && !q.pick, bad = q.answered && i === q.selected && !q.correct && !q.pick, chosen = q.answered && q.pick && i === q.selected;
      this.button('answer-' + i, option, x, y, w, oh, () => a.quizAnswer(i), { disabled: q.answered && !good && !bad && !chosen, tone: good ? 'good' : bad ? 'bad' : null, selected: chosen, size: 15, align: 'left', icon: null });
      const badge = good ? 'check' : bad ? 'cross' : null;
      if (badge) this.icon(badge, x + w - 22, y + oh / 2, 16, good ? C.green : C.red);
      else this.text('ABCD'[i], x + w - 22, y + oh / 2, 13, C.dim, 800, 'center');
    });
    if (q.answered) {
      const info = q.pick ? q.pick.o[q.selected].note + ' ' + q.pick.exp : (q.correct ? '答对了！' : '再想想：') + question.exp;
      const fy = oy + 2 * (oh + 10) + 6, fw = W - 2 * PAD - 190;
      this.wrap(info, PAD + 4, fy + 12, fw, 14, q.pick || q.correct ? C.green : C.gold, 21, Math.max(2, Math.floor((H - fy - 12) / 21)));
      this.button('next-question', q.pick ? '继续故事' : q.i + 1 < q.step.qs.length ? '下一题' : '查看结果', W - PAD - 170, H - 60, 170, 46, () => a.quizNext(), { primary: true, size: 16, icon: 'next' });
    }
  }
  resultCard(h) {
    const w = Math.min(600, this.W - 2 * PAD), x = (this.W - w) / 2;
    this.card(x, 62, w, h, { glow: 'rgba(255,207,74,.14)' });
    return { x, w };
  }
  step() {
    const a = this.app, r = a.stepRes; if (!r) return;
    const W = this.W, H = this.H; this.header(r.win ? '挑战成功！' : '再试一次', a.story?.st.title, () => a.quit());
    const { x, w } = this.resultCard(H - 62 - 76);
    this.stars(r.stars, W / 2, 104, 38, 'center', 10);
    this.text(r.main, W / 2, 148, 20, C.text, 800, 'center', w - 40);
    r.goals.forEach((goal, i) => {
      const y = 182 + i * 30, gw = Math.min(w - 40, this.measure(goal.text, 15, 500) + 30), gx = W / 2 - gw / 2;
      this.icon(goal.ok ? 'check' : 'cross', gx + 8, y, 13, goal.ok ? C.green : C.dim);
      this.text(goal.text, gx + 26, y, 15, goal.ok ? C.green : C.sub, 500, 'left', gw - 26);
    });
    const bw = (w - 24) / 3, by = H - 60;
    this.button('retry-step', '重新挑战', x, by, bw, 46, () => a.stepRetry(), { icon: 'retry', size: 15 });
    this.button('exit-step', '故事地图', x + bw + 12, by, bw, 46, () => a.quit(), { icon: 'map', size: 15 });
    this.button('continue-step', '继续故事', x + 2 * (bw + 12), by, bw, 46, () => a.stepContinue(), { primary: true, disabled: !r.win, icon: 'next', size: 15 });
  }
  clear() {
    const a = this.app, r = a.clearResult, W = this.W, H = this.H; this.header('关卡完成', r.title, () => a.show('story'));
    const { x, w } = this.resultCard(H - 62 - 76);
    this.stars(r.stars, W / 2, 100, 34, 'center', 10);
    this.text('获得奖励', x + 24, 136, 13, C.dim, 700);
    const ly = 150, lh = H - 76 - ly - 10, icons = { char: ['users', C.purple], gear: ['racket', C.cyan], card: ['cards', C.green], feat: ['spark', C.gold] };
    this.scrollArea('rewards', x + 20, ly, w - 46, lh, Math.max(1, r.rewards.length) * 50 - 8, y => r.rewards.forEach((item, i) => {
      const [icon, color] = icons[item.kind] || icons.feat, yy = y + i * 50;
      this.rect(x + 20, yy, w - 46, 42, 'rgba(0,0,0,.24)', 12, 'rgba(255,255,255,.06)');
      this.icon(icon, x + 42, yy + 21, 18, color);
      this.text(item.name, x + 62, yy + 21, 15, C.text, 700, 'left', w - 190);
      this.chip(item.isNew ? '新获得' : '已解锁', x + w - 38, yy + 21, item.isNew ? C.gold : C.dim, { align: 'right' });
    }));
    if (!r.rewards.length) this.text('本关没有新物品，继续前进吧！', W / 2, ly + 30, 14, C.dim, 500, 'center');
    const bw = (w - 12) / 2;
    this.button('map', '返回地图', x, H - 60, bw, 46, () => a.show('story'), { icon: 'map', size: 16 });
    this.button('next-stage', a.clearNextId ? '下一关' : '重温故事', x + bw + 12, H - 60, bw, 46, () => a.clearNext(), { primary: true, icon: 'next', size: 16 });
  }
  team() {
    const YY = this.YY, a = this.app, p = YY.Profile, W = this.W, H = this.H, char = YY.char(a.teamPeek || p.sel.char), owned = p.has('char', char.id), skill = YY.SKILLS[char.skill], passive = YY.SKILLS[char.passive] || skill;
    this.header('角色与装备', '通过故事解锁队友与装备', () => { a.show(a.teamBack || 'menu'); a.teamBack = null; });
    const rail = 150, top = 62;
    this.scrollArea('roster', PAD, top, rail, H - top - 12, YY.CHARS.length * 56 - 8, y => YY.CHARS.forEach((c, i) => {
      const has = p.has('char', c.id), yy = y + i * 56, sel = char.id === c.id, inUse = p.sel.char === c.id;
      this.button('char-' + c.id, '', PAD, yy, rail, 48, () => { a.teamPeek = c.id; if (has) p.choose('char', c.id); this.scroll.gear = 0; }, { selected: sel });
      this.g.globalAlpha = has ? 1 : .5;
      this.portrait(c.id, PAD + 7, yy + 7, 34);
      if (!has) { this.rect(PAD + 7, yy + 7, 34, 34, 'rgba(0,0,0,.45)', 8); this.icon('lock', PAD + 24, yy + 24, 13, C.text); }
      this.text(has ? YY.charName(c.id) : '未解锁', PAD + 50, yy + (inUse ? 17 : 24), 14, sel ? C.gold : C.text, 700, 'left', rail - 58);
      if (inUse) this.text('出战中', PAD + 50, yy + 34, 11, C.green, 600);
      this.g.globalAlpha = 1;
    }));
    const x = PAD + rail + 16, w = W - x - PAD;
    this.portrait(char.id, x, top, 60, skill.color || C.gold);
    this.text(YY.charName(char.id), x + 74, top + 16, 20, C.text, 800, 'left', w - 190);
    this.chip('被动 · ' + passive.name, x + 74, top + 44, passive.color || C.gold, { icon: 'spark', size: 12 });
    this.button('character-bio', '角色介绍', x + w - 100, top, 100, 34, () => a.message(YY.charName(char.id), char.title + '\n' + char.bio + '\n被动「' + passive.name + '」：' + passive.desc + '\n主动：' + (char.acts || []).map(k => YY.SKILLS[k].name).join('、'), 'team'), { size: 13, icon: 'info' });
    this.wrap(owned ? passive.desc : YY.lockText(char.lock), x, top + 82, w, 13, C.sub, 19, 2);
    const tabs = ['skills', 'racket', 'string', 'tension', 'shoe', 'stats'], names = Object.assign({ skills: '技能', stats: '能力' }, YY.GEAR_CATS);
    a.gearTab = a.gearTab || 'skills';
    const ty = top + 112, tw = (w - 8) / tabs.length;
    this.rect(x, ty, w, 38, 'rgba(0,0,0,.28)', 13, 'rgba(255,255,255,.08)');
    tabs.forEach((tab, i) => {
      const sel = a.gearTab === tab, bx = x + 4 + i * tw;
      if (sel) this.rect(bx, ty + 4, tw, 30, this.grad(0, ty, 0, ty + 34, [[0, 'rgba(255,207,74,.28)'], [1, 'rgba(255,207,74,.12)']]), 10, C.gold);
      this.text(names[tab], bx + tw / 2, ty + 19.5, 14, sel ? C.gold : C.sub, sel ? 800 : 600, 'center');
      this.buttons.push({ id: 'tab-' + tab, x: bx, y: ty, w: tw, h: 38, onClick: () => { a.gearTab = tab; this.scroll.gear = 0; }, disabled: false });
    });
    const cy = ty + 50, chH = H - cy - 12;
    if (a.gearTab === 'skills') {
      // 三张技能卡并排：点卡片切换携带（始终携带 2 个，对应对局里的两个技能键）
      const acts = char.acts || [], kit = p.kit(char.id), gap = 8, cw = (w - gap * 2) / 3;
      acts.forEach((k, i) => {
        const sk = YY.SKILLS[k], on = kit.includes(k), bx = x + i * (cw + gap), id = 'kit-' + k;
        const pressed = this.isPressed(id), yy = cy + (pressed ? 2 : 0);
        this.card(bx, yy, cw, chH, { radius: 14, accent: on ? sk.color : null, glow: on ? this.alpha(sk.color, .16) : null, stroke: on ? this.alpha(sk.color, .7) : 'rgba(255,255,255,.1)', flat: pressed });
        this.buttons.push({ id, x: bx, y: cy, w: cw, h: chH, onClick: () => { if (owned) p.toggleKit(char.id, k); else this.P.toast(YY.lockText(char.lock)); }, disabled: false });
        this.g.globalAlpha = owned ? 1 : .55;
        this.rect(bx + 12, yy + 12, 4, 20, sk.color, 2);
        this.text(sk.name, bx + 22, yy + 22, 14, on ? C.gold : C.text, 800, 'left', cw - 74);
        this.chip(String(sk.cost), bx + cw - 10, yy + 22, sk.color, { align: 'right', size: 11, h: 18, icon: 'spark' });
        const lines = Math.max(1, Math.floor((chH - 68) / 16));
        this.wrap(sk.desc, bx + 12, yy + 46, cw - 24, 12, on ? C.sub : C.dim, 16, lines);
        if (on) this.chip('携带 · 技能' + (kit.indexOf(k) ? '二' : '一'), bx + cw / 2, yy + chH - 16, C.green, { align: 'center', size: 11, h: 20 });
        else this.text(owned ? '点击携带' : '未解锁', bx + cw / 2, yy + chH - 16, 12, C.dim, 600, 'center');
        this.g.globalAlpha = 1;
      });
    } else if (a.gearTab === 'tension') {
      const can = p.canTune(), val = can ? p.sel.tension : 24;
      this.card(x, cy, w, chH, { radius: 16 });
      this.button('tension-minus', '−', x + 16, cy + 14, 56, 46, () => p.choose('tension', Math.max(20, p.sel.tension - 1)), { disabled: !can || p.sel.tension <= 20, size: 26 });
      this.button('tension-plus', '+', x + w - 72, cy + 14, 56, 46, () => p.choose('tension', Math.min(30, p.sel.tension + 1)), { disabled: !can || p.sel.tension >= 30, size: 26 });
      this.text(val, x + w / 2 - 14, cy + 37, 34, C.gold, 900, 'center'); this.text('磅', x + w / 2 + 22, cy + 41, 14, C.sub, 600, 'center');
      this.bar(x + 90, cy + 66, w - 180, 5, (val - 20) / 10);
      this.wrap(can ? YY.tensionNote(val) : '完成故事 2-2 后，可以调整球线磅数。', x + 16, cy + 90, w - 32, 13, C.sub, 19, Math.max(1, Math.floor((chH - 90) / 19)));
    } else if (a.gearTab === 'stats') {
      const stats = p.stats(), cols = 3, cw = (w - 12) / cols, rh = Math.min(42, (chH - 4) / 3);
      YY.STAT_VIEW.forEach(([label, fn], i) => {
        const bx = x + (i % cols) * (cw + 6), by = cy + Math.floor(i / cols) * rh, v = Math.round(fn(stats) * 100);
        this.rect(bx, by, cw, rh - 6, 'rgba(0,0,0,.24)', 10);
        this.text(label, bx + 12, by + (rh - 6) / 2 - 6, 13, C.sub, 600);
        this.text(v, bx + cw - 12, by + (rh - 6) / 2 - 6, 15, v > 100 ? C.green : v < 100 ? C.orange : C.text, 800, 'right');
        this.bar(bx + 12, by + (rh - 6) / 2 + 8, cw - 24, 4, v / 140, v > 100 ? C.green : v < 100 ? C.orange : C.gold);
      });
    } else {
      const gear = YY.GEAR[a.gearTab], ih = 60;
      this.scrollArea('gear', x, cy, w - 6, chH, gear.length * (ih + 8) - 8, y => gear.forEach((item, i) => {
        const has = p.has('gear', item.id), selected = p.sel[a.gearTab] === item.id, yy = y + i * (ih + 8), cw = w - 6;
        this.button('gear-' + item.id, '', x, yy, cw - 46, ih, () => { if (has) p.choose(a.gearTab, item.id); else this.P.toast(YY.lockText(item.lock)); }, { selected });
        this.g.globalAlpha = has ? 1 : .55;
        this.text(item.name, x + 14, yy + 20, 15, selected ? C.gold : C.text, 800, 'left', cw * .42);
        if (selected) this.chip('使用中', x + cw - 58, yy + 20, C.green, { align: 'right', size: 11, h: 18 });
        else if (!has) this.icon('lock', x + cw - 66, yy + 20, 13, C.dim);
        const fx = has ? YY.fxTags(item.fx).map(t => t.text).join(' · ') || '均衡基础配置' : YY.lockText(item.lock);
        this.text(has ? item.spec : '', x + 14 + Math.min(cw * .42, this.measure(item.name, 15, 800)) + 12, yy + 20.5, 12, C.dim, 500, 'left', cw - 200 - Math.min(cw * .42, this.measure(item.name, 15, 800)));
        this.text(fx, x + 14, yy + 42, 13, selected ? C.gold : C.sub, 500, 'left', cw - 76);
        this.g.globalAlpha = 1;
        this.button('info-' + item.id, '', x + cw - 40, yy + 10, 40, 40, () => a.message(item.name, item.spec + '\n' + item.desc + '\n' + YY.fxTags(item.fx).map(t => t.text).join(' · '), 'team'), { icon: 'info', iconSize: 18 });
      }));
    }
  }
  codex() {
    const YY = this.YY, a = this.app, p = YY.Profile, W = this.W, H = this.H, selected = YY.card(a.codexSel);
    this.header('羽球图鉴', `已收集 ${p.d.cards.length} / ${YY.CARDS.length} 张`);
    const top = 62, listW = Math.round((W - 2 * PAD) * .46), ih = 58, cw = (listW - 10) / 2;
    this.scrollArea('cards', PAD, top, listW, H - top - 12, Math.ceil(YY.CARDS.length / 2) * (ih + 8) - 8, y => YY.CARDS.forEach((card, i) => {
      const own = p.has('card', card.id), x = PAD + i % 2 * (cw + 10), yy = y + Math.floor(i / 2) * (ih + 8), cat = YY.CARD_CATS[card.cat];
      this.button('card-' + card.id, '', x, yy, cw, ih, () => { a.codexSel = card.id; p.d.seen['card:' + card.id] = true; p.save(); }, { selected: a.codexSel === card.id, disabled: !own });
      if (own) {
        this.rect(x + 10, yy + 12, 4, ih - 24, cat[1], 2);
        this.text(cat[0], x + 22, yy + 19, 11, cat[1], 700);
        this.text(card.title, x + 22, yy + 39, 14, a.codexSel === card.id ? C.gold : C.text, 700, 'left', cw - 32);
        if (!p.d.seen['card:' + card.id]) this.circle(x + cw - 10, yy + 10, 4, C.red);
      } else { this.icon('lock', x + 22, yy + ih / 2, 13, C.dim); this.text('尚未收集', x + 36, yy + ih / 2, 13, C.dim, 600); }
    }));
    const x = PAD + listW + 16, w = W - x - PAD, h = H - top - 12;
    this.card(x, top, w, h);
    if (!selected || !p.has('card', selected.id)) {
      this.shuttle(x + w / 2, top + h * .38, 96, .9);
      this.wrap('完成故事挑战，收集属于你的羽球知识卡。', x + 28, top + h * .7, w - 56, 15, C.sub, 23);
      return;
    }
    const cat = YY.CARD_CATS[selected.cat];
    this.chip(cat[0], x + 20, top + 26, cat[1]);
    this.text(selected.title, x + 20, top + 58, 21, C.text, 800, 'left', w - 40);
    this.rect(x + 20, top + 78, 36, 3, cat[1], 2);
    const ty = top + 92, th = h - 92 - 42, size = 15, lead = 24, tw = w - 46;
    this.scrollArea('card-detail', x + 20, ty, tw + 4, th, this.lines(selected.text, tw, size).length * lead + 8, y => this.wrap(selected.text, x + 20, y + 12, tw, size, C.sub, lead));
    this.text(YY.KNOWLEDGE_SOURCES[selected.source]?.name||'羽球知识',x+20,H-29,11,C.dim,500,'left',w-40);
  }
  result() {
    const a = this.app, r = a.result; if (!r) return;
    const W = this.W, H = this.H; this.header(r.title, a.isOnline() ? a.roomScore() : `最长回合 ${r.longest || 0} 拍 · 用时 ${Math.floor(r.seconds / 60)} 分 ${r.seconds % 60} 秒`, () => a.quit());
    const { x, w } = this.resultCard(H - 62 - 76);
    if (r.won) this.icon('trophy', W / 2, 86, 26, C.gold);
    this.text(r.score[0], W / 2 - 46, 122, 52, r.won ? C.gold : C.text, 900, 'right');
    this.text(':', W / 2, 119, 40, C.dim, 800, 'center');
    this.text(r.score[1], W / 2 + 46, 122, 52, r.won ? C.text : C.gold, 900, 'left');
    this.text(r.names?.[0] || '你', W / 2 - 120, 122, 14, C.sub, 700, 'right', 120);
    this.text(r.names?.[1] || '对手', W / 2 + 120, 122, 14, C.sub, 700, 'left', 120);
    const rows = [['击球', 'hits'], ['完美', 'perfect'], ['扣杀', 'smash'], ['致胜', 'winners'], ['失误', 'errors']];
    const sw = (w - 40 - 32) / 5, sy = 160;
    rows.forEach(([label, key], i) => {
      const sx = x + 20 + i * (sw + 8);
      this.rect(sx, sy, sw, 58, 'rgba(0,0,0,.26)', 12, 'rgba(255,255,255,.06)');
      this.text(label, sx + sw / 2, sy + 18, 12, C.dim, 600, 'center');
      this.text(`${r.stats[0][key] || 0}`, sx + sw / 2 - 8, sy + 40, 18, C.text, 800, 'right');
      this.text('/', sx + sw / 2, sy + 40, 13, C.dim, 600, 'center');
      this.text(`${r.stats[1][key] || 0}`, sx + sw / 2 + 8, sy + 40, 15, C.dim, 700, 'left');
    });
    this.icon('spark', x + 30, sy + 84, 14, C.gold);
    const connectionNote = a.isOnline() ? (a.net.reconnectRemaining() != null ? a.net.connectionText() : a.serverWait) : null;
    this.wrap(connectionNote || r.note, x + 44, sy + 84, w - 64, 14, C.sub, 21, Math.max(1, Math.floor((H - 76 - sy - 76) / 21) + 1));
    const bw = (w - 12) / 2;
    this.button('result-menu', '返回主页', x, H - 60, bw, 46, () => a.quit(), { icon: 'home', size: 16 });
    this.button('again', a.isOnline() ? '换角色再战' : '再来一局', x + bw + 12, H - 60, bw, 46, () => a.restart(), { primary: true, icon: 'retry', size: 16, disabled: a.isOnline() && a.net.reconnectRemaining() != null });
  }
  pause() {
    const a = this.app, W = this.W, H = this.H, w = Math.min(400, W - 2 * PAD), h = 344, x = (W - w) / 2, y = Math.max(12, (H - h) / 2);
    this.card(x, y, w, h, { glow: 'rgba(255,207,74,.14)', radius: 22 });
    this.icon('pause', W / 2, y + 30, 20, C.gold);
    this.text('稍作休息', W / 2, y + 62, 24, C.text, 800, 'center');
    this.text(a.isOnline() ? (a.net.reconnectRemaining() != null ? a.net.connectionText() : a.serverWait || '比赛已暂停，返回后继续') : '准备好了，就继续上场', W / 2, y + 90, 13, C.dim, 500, 'center', w - 30);
    this.button('resume', '继续比赛', x + 22, y + 112, w - 44, 50, () => a.togglePause(), { primary: true, size: 18, icon: 'play' });
    const bw = (w - 54) / 2;
    this.button('help-pause', '查看操作', x + 22, y + 174, bw, 44, () => { a.helpFromPause = true; a.show('help'); }, { icon: 'help', size: 15 });
    this.button('restart', '重新开始', x + 32 + bw, y + 174, bw, 44, () => a.restart(), { disabled: a.isOnline(), icon: 'retry', size: 15 });
    this.button('layout-pause', '调整键位', x + 22, y + 230, w - 44, 44, () => this.openControlEditor('pause'), { icon: 'gear', size: 15 });
    this.button('quit', '离开对局', x + 22, y + 282, w - 44, 44, () => a.quit(), { danger: true, icon: 'home', size: 15 });
  }
  help() {
    const a = this.app, W = this.W, H = this.H;
    this.header('玩法说明', '先站对位置，再抓住击球时机', () => { a.show(a.helpFromPause ? 'pause' : 'menu'); a.helpFromPause = false; });
    const top = 62, tw = W - 2 * PAD - 70, size = 15, lead = 23;
    const heights = HELP.map(line => this.lines(line, tw, size).length * lead + 22);
    this.scrollArea('help-text', PAD, top, W - 2 * PAD - 6, H - top - 12, heights.reduce((s, h) => s + h + 8, -8), y => {
      let yy = y;
      HELP.forEach((line, i) => {
        this.card(PAD, yy, W - 2 * PAD - 6, heights[i], { radius: 14, flat: true });
        this.circle(PAD + 26, yy + 23, 13, 'rgba(255,207,74,.16)', 'rgba(255,207,74,.5)');
        this.text(i + 1, PAD + 26, yy + 23.5, 13, C.gold, 900, 'center');
        this.wrap(line, PAD + 52, yy + 22, tw, size, C.text, lead);
        yy += heights[i] + 8;
      });
    });
  }
  settings() {
    const a = this.app, W = this.W, H = this.H; this.header('设置', '按你的习惯，调整每一场对局');
    const w = (W - 2 * PAD - 12) / 2, top = 64;
    [['sound', '游戏音效', 'sound'], ['haptics', '击球振动', 'vibrate'], ['hint', '落点提示', 'eye'], ['skills', '对战角色技能', 'spark']].forEach(([key, label, icon], i) => {
      const x = PAD + i % 2 * (w + 12), y = top + Math.floor(i / 2) * 64;
      this.button('setting-' + key, label, x, y, w, 54, () => { a.settings[key] = !a.settings[key]; a.saveSettings(); }, { align: 'left', icon, size: 16, iconColor: a.settings[key] ? C.gold : C.dim });
      this.toggle(x + w - 58, y + 27 + (this.isPressed('setting-' + key) ? 2 : 0), a.settings[key]);
    });
    const by = top + 2 * 64 + 8;
    this.button('data', '数据与隐私说明', PAD, by, w, 48, () => a.message('数据与隐私', '故事星级、角色和装备解锁、图鉴及装备选择会自动保存在本机。剧情会保存当前环节、对话位置、调查发现和人物选择；重新进入可继续该环节。未打完的比赛与训练从本环节开头重来。当前没有微信账号云存档，换手机不会自动同步，清除小游戏数据会丢失本机进度。当前版本不索取头像、昵称、手机号或位置。在线比赛处理房间码、操作指令和临时重连凭证；云通道可能附带微信身份信息，但本游戏没有用它保存个人进度。', 'settings'), { icon: 'shield', size: 15 });
    this.button('share-game', '分享游戏', PAD + w + 12, by, w, 48, () => this.P.share(), { icon: 'share', size: 15 });
    this.button('reset-save', '重置故事进度', PAD, by + 60, w, 46, () => this.P.confirm('重置故事进度', '这会清空已解锁的角色、装备和图鉴，无法撤销。', () => { this.YY.Profile.reset(); a.storyChap = null; a.teamPeek = null; a.codexSel = null; this.P.toast('故事进度已重置'); }), { danger: true, icon: 'trash', size: 15 });
    this.button('layout-settings', '自定义键位', PAD + w + 12, by + 60, w, 46, () => this.openControlEditor('settings'), { icon: 'gear', size: 15 });
    this.icon('info', PAD + 8, H - 20, 14, C.dim);
    this.text(`本机自动存档 · 暂无跨设备同步 · v${a.net.config.version}`, PAD + 22, H - 20, 13, C.dim);
  }
  message() {
    const a = this.app, m = a.messageData, W = this.W, H = this.H;
    this.header(m.title, '', () => a.show(m.back));
    const top = 62, h = H - top - 76, tw = W - 2 * PAD - 48, size = 16, lead = 26;
    this.card(PAD, top, W - 2 * PAD, h);
    this.scrollArea('message', PAD + 24, top + 16, tw + 4, h - 32, this.lines(m.text, tw, size).length * lead + 6, y => this.wrap(m.text, PAD + 24, y + 13, tw, size, C.text, lead));
    this.button('message-ok', '知道了', W / 2 - 120, H - 60, 240, 46, () => a.show(m.back), { primary: true, size: 16 });
  }
}
module.exports = UI;
