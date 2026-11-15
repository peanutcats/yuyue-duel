(function(G){
'use strict';
/*
 * 羽跃对决 · 器械美术
 * 每支球拍、每卷球线、每双球鞋都有独立的造型参数（拍框形状、粗细、配色、纹样、鞋底结构……），
 * 全部用 Canvas 矢量绘制：任意尺寸都清晰，无需额外图片包体。
 * 静态图稿缓存到离屏画布；展台动画（浮动、旋转、扫光、性能演示）只做变换与少量叠加，开销很小。
 */
const UI = {sub:'#cfddec',cyan:'#8fdcff',purple:'#c9b8f7',gold:'#ffcb72',red:'#ff9c92',orange:'#f8b982',green:'#a6e2bd'};
const TAU = Math.PI * 2;
const TIERS = {
  std: { name: '标准', color: UI.sub },
  adv: { name: '进阶', color: UI.cyan },
  pro: { name: '专业', color: UI.purple },
  ltd: { name: '限定', color: UI.gold },
  warn: { name: '不推荐', color: UI.red },
};
const CATS = {
  racket: { name: '球拍', icon: 'racket', color: UI.gold },
  string: { name: '球线', icon: 'target', color: UI.cyan },
  tension: { name: '磅数', icon: 'stats', color: UI.orange },
  shoe: { name: '球鞋', icon: 'steps', color: UI.green },
};

function hex(h, a) {
  if (!/^#[0-9a-f]{6}$/i.test(h)) return h;
  const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function star4(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
}

G.YY.createGearArt = function createGearArt(YY) {
  const ART = YY.GEAR_ART, RACKETS = ART.racket, STRINGS = ART.string, SHOES = ART.shoe;
  const rr = (g, x, y, w, h, r) => YY.rr(g, x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  const font = (g, size, weight = 700) => { g.font = `${weight} ${size}px ${YY.FONT}`; };

  // ====================== 球拍 ======================
  /** 拍头轮廓：超椭圆，顶部略宽（等距拍框效果）；sq 越大越接近方圆拍框 */
  function headPath(g, rx, ry, sq, cy, N = 80) {
    const n = 2 + sq * 2.4;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a);
      const x = rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (1 - .07 * s), y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }
  /** 拍框上某个角度的点（与 headPath 同一公式），用于贴花定位 */
  function headPoint(rx, ry, sq, cy, a) {
    const n = 2 + sq * 2.4, c = Math.cos(a), s = Math.sin(a);
    return [rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (1 - .07 * s), cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
  }
  function arcOnHead(g, rx, ry, sq, cy, a0, a1) {
    g.beginPath(); const N = 18;
    for (let i = 0; i <= N; i++) { const [x, y] = headPoint(rx, ry, sq, cy, a0 + (a1 - a0) * i / N); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  }
  /** 竖直球拍，原点在拍中心，L 为全长；拍头朝上 */
  function racket(g, a, L, opt = {}) {
    const rx = .158 * L * (a.headW || 1), ry = .205 * L, cy = -.275 * L, th = .026 * L * a.thick;
    const by = cy + ry, sy = by + .085 * L, shW = .015 * L * (a.shaftW || 1), hy0 = .265 * L, hy1 = .5 * L, hw = .042 * L;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    // ---- 手柄与中杆 ----
    g.fillStyle = a.shaftV ? lin(g, 0, sy, 0, hy0, [[0, a.shaft[1]], [1, a.shaft[0]]]) : lin(g, -shW, 0, shW, 0, [[0, a.shaft[1]], [.45, a.shaft[0]], [1, a.shaft[1]]]);
    rr(g, -shW / 2, sy - 2, shW, hy0 - sy + 4, shW / 2); g.fill();
    if (a.shaftV) { g.fillStyle = lin(g, -shW / 2, 0, shW / 2, 0, [[0, 'rgba(0,0,0,.25)'], [.45, 'rgba(255,255,255,.25)'], [1, 'rgba(0,0,0,.3)']]); g.fillRect(-shW / 2, sy, shW, hy0 - sy); }
    if (a.decal === 'bolt') { // 闪电贴花
      g.fillStyle = a.accent; g.beginPath(); const z = shW * 1.2, y0 = sy + .05 * L;
      g.moveTo(z * .2, y0); g.lineTo(-z * .6, y0 + .05 * L); g.lineTo(z * .1, y0 + .05 * L); g.lineTo(-z * .4, y0 + .11 * L); g.lineTo(z * .6, y0 + .04 * L); g.lineTo(-z * .05, y0 + .04 * L); g.closePath(); g.fill();
    } else if (a.decal === 'speed') {
      g.strokeStyle = a.accent; g.lineWidth = Math.max(1, shW * .28);
      for (let i = 0; i < 3; i++) { const y = sy + .05 * L + i * .03 * L; g.beginPath(); g.moveTo(-shW * .45, y); g.lineTo(0, y + .012 * L); g.lineTo(shW * .45, y); g.stroke(); }
    } else if (a.decal === 'wind') {
      g.strokeStyle = hex(a.accent, .9); g.lineWidth = Math.max(1, shW * .25);
      for (let i = 0; i < 2; i++) { const y = sy + .06 * L + i * .05 * L; g.beginPath(); g.moveTo(-shW * .5, y); g.quadraticCurveTo(0, y - .02 * L, shW * .5, y + .01 * L); g.stroke(); }
    } else if (a.decal === 'ridge') { // 贯穿到握把的红色脊线
      g.fillStyle = lin(g, 0, sy, 0, hy0, [[0, hex(a.accent, .7)], [.5, a.accent], [1, '#ff8a52']]); g.fillRect(-Math.max(.6, shW * .16), sy - 2, Math.max(1.2, shW * .32), hy0 - sy + .03 * L);
    } else if (a.gridShaft) { // 白色中杆上的细网格纹
      g.strokeStyle = 'rgba(80,90,110,.35)'; g.lineWidth = Math.max(.4, shW * .09);
      for (let y = sy + .02 * L; y < hy0 - .01 * L; y += .02 * L) { g.beginPath(); g.moveTo(-shW / 2, y); g.lineTo(shW / 2, y); g.stroke(); }
      g.beginPath(); g.moveTo(0, sy); g.lineTo(0, hy0); g.stroke();
      g.fillStyle = a.accent; g.fillRect(-shW / 2, sy + .02 * L, shW, .01 * L);
    } else if (a.orbit) { // 三条长短不一的轨道线
      g.strokeStyle = a.accent; g.lineWidth = Math.max(.6, shW * .16);
      [[.04, .1], [.08, .2], [.12, .15]].forEach(([o, l], i) => { const xx = (i - 1) * shW * .3; g.beginPath(); g.moveTo(xx, sy + o * L); g.lineTo(xx, sy + (o + l) * L); g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(xx, sy + (o + l) * L, Math.max(.8, shW * .2), 0, TAU); g.fill(); });
    } else if (a.decal === 'ripple' || a.decal === 'shield' || a.decal === 'petals') { g.fillStyle = hex(a.accent, .85); g.fillRect(-shW / 2, sy + .06 * L, shW, .01 * L); g.fillRect(-shW / 2, sy + .085 * L, shW, .006 * L); }
    else { g.fillStyle = a.accent; g.fillRect(-shW / 2, sy + .07 * L, shW, .018 * L); }
    // 锥形过渡
    g.fillStyle = lin(g, -hw, 0, hw, 0, [[0, a.shaft[1]], [.5, a.shaft[0]], [1, a.shaft[1]]]);
    g.beginPath(); g.moveTo(-shW / 2, hy0); g.lineTo(shW / 2, hy0); g.lineTo(hw / 2, hy0 + .035 * L); g.lineTo(-hw / 2, hy0 + .035 * L); g.closePath(); g.fill();
    // 手胶：斜向缠绕纹理
    const gy = hy0 + .035 * L;
    g.save(); rr(g, -hw / 2, gy, hw, hy1 - gy, hw * .32); g.clip();
    g.fillStyle = lin(g, -hw / 2, 0, hw / 2, 0, [[0, hex(a.grip, 1)], [.5, a.grip], [1, hex(a.grip, 1)]]); g.fillRect(-hw, gy, hw * 2, hy1 - gy);
    g.strokeStyle = hex(a.wrap, .55); g.lineWidth = Math.max(1, .007 * L);
    for (let y = gy - hw; y < hy1 + hw; y += .022 * L) { g.beginPath(); g.moveTo(-hw, y + hw * .7); g.lineTo(hw, y - hw * .2); g.stroke(); }
    g.fillStyle = lin(g, -hw / 2, 0, hw / 2, 0, [[0, 'rgba(0,0,0,.35)'], [.35, 'rgba(255,255,255,.18)'], [.6, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.4)']]); g.fillRect(-hw, gy, hw * 2, hy1 - gy);
    g.restore();
    g.fillStyle = a.edge === '#000000' ? '#2a2b31' : a.edge; rr(g, -hw * .56, hy1 - .012 * L, hw * 1.12, .02 * L, .008 * L); g.fill(); // 尾盖
    g.fillStyle = a.accent; rr(g, -hw * .5, gy + .004 * L, hw, .008 * L, .003 * L); g.fill();
    // ---- 拍线 ----
    g.save(); headPath(g, rx - th * .55, ry - th * .55, a.sq, cy); g.clip();
    g.fillStyle = rad(g, -rx * .3, cy - ry * .35, 0, ry * 1.4, [[0, 'rgba(255,255,255,.10)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-rx, cy - ry, rx * 2, ry * 2);
    g.strokeStyle = hex(a.string, .78); g.lineWidth = Math.max(.6, .0034 * L);
    const step = .0205 * L;
    for (let x = -rx + step / 2; x < rx; x += step) { g.beginPath(); g.moveTo(x, cy - ry); g.lineTo(x, cy + ry); g.stroke(); }
    for (let y = cy - ry + step / 2; y < cy + ry; y += step) { g.beginPath(); g.moveTo(-rx, y); g.lineTo(rx, y); g.stroke(); }
    if (a.decal === 'ripple') { // 拍面内圈的浅青波纹
      g.strokeStyle = hex(a.accent, .35); g.lineWidth = Math.max(.6, .005 * L);
      for (let k = 1; k <= 3; k++) { g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * TAU, r = k / 3.4; const x = Math.cos(t) * rx * r, y = cy + Math.sin(t) * ry * r + Math.sin(t * 6) * .004 * L; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    }
    if (opt.logo !== false) { // 拍面印字：品牌羽毛标
      g.globalAlpha = .55; g.fillStyle = a.accent === '#0e1a12' ? '#16301e' : a.accent;
      g.beginPath(); g.ellipse(0, cy, rx * .2, ry * .3, -.5, 0, TAU); g.fill();
      g.globalAlpha = .7; g.fillStyle = hex(a.string, .9); g.beginPath(); g.ellipse(rx * .02, cy - ry * .02, rx * .06, ry * .2, -.5, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
    g.restore();
    // ---- 三叉（T 头） ----
    const fr = lin(g, -rx, cy - ry, rx, by + .05 * L, [[0, a.frame[0]], [1, a.frame[1]]]);
    g.strokeStyle = a.edge; g.lineWidth = th * .75 + 1.4;
    const throat = () => { g.beginPath(); g.moveTo(-rx * .6, by - ry * .2); g.quadraticCurveTo(-rx * .14, by + .01 * L, 0, sy); g.quadraticCurveTo(rx * .14, by + .01 * L, rx * .6, by - ry * .2); };
    throat(); g.stroke(); g.strokeStyle = fr; g.lineWidth = th * .75; throat(); g.stroke();
    // ---- 拍框 ----
    const N = a.poly || 80;
    headPath(g, rx, ry, a.sq, cy, N); g.strokeStyle = a.edge; g.lineWidth = th + 1.6; g.stroke();
    g.strokeStyle = fr; g.lineWidth = th; g.stroke();
    if (a.poly) { // 六棱切面：相邻棱面交替明暗
      g.lineWidth = th * .5; for (let i = 0; i < N; i++) { arcOnHead(g, rx, ry, a.sq, cy, i / N * TAU, (i + 1) / N * TAU); g.strokeStyle = i % 2 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)'; g.stroke(); }
    }
    // 内沿：亮色线（雷霆的熔岩红、潮汐的浅青、磐盾的深绿……）
    headPath(g, rx - th * .3, ry - th * .3, a.sq, cy, N); g.strokeStyle = a.inner ? hex(a.inner, .85) : 'rgba(255,255,255,.38)'; g.lineWidth = Math.max(.7, th * (a.inner ? .26 : .16)); g.stroke();
    if (!a.matte) { headPath(g, rx + th * .12, ry + th * .12, a.sq, cy, N); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(.5, th * .1); g.stroke(); }
    // 穿线孔
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i < 28; i++) { const [x, y] = headPoint(rx, ry, a.sq, cy, i / 28 * TAU); g.beginPath(); g.arc(x, y, Math.max(.5, th * .12), 0, TAU); g.fill(); }
    // ---- 贴花 ----
    g.lineWidth = th * 1.02;
    if (a.decal === 'band' || a.decal === 'bolt' || a.decal === 'stars') {
      g.strokeStyle = a.accent;
      const spans = a.decal === 'bolt' ? [[-.25, .25], [Math.PI - .25, Math.PI + .25]] : [[-2.5, -2.0], [-1.14, -.64]];
      for (const [s0, s1] of spans) { arcOnHead(g, rx, ry, a.sq, cy, s0, s1); g.stroke(); }
    }
    if (a.decal === 'wind') {
      g.strokeStyle = a.accent; arcOnHead(g, rx, ry, a.sq, cy, -2.9, -2.3); g.stroke(); arcOnHead(g, rx, ry, a.sq, cy, -.84, -.24); g.stroke();
    }
    if (a.decal === 'speed') {
      g.strokeStyle = a.accent; g.lineWidth = th * .38; arcOnHead(g, rx, ry, a.sq, cy, -2.6, -.54); g.stroke();
    }
    if (a.decal === 'feather') { // 绣羽纹样：沿拍框排布的小羽毛
      for (let i = 0; i < 7; i++) {
        const ang = -2.75 + i * .42, [x, y] = headPoint(rx, ry, a.sq, cy, ang);
        g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
        g.fillStyle = a.accent; g.beginPath(); g.ellipse(0, 0, th * .34, th * .95, 0, 0, TAU); g.fill();
        g.strokeStyle = a.edge; g.lineWidth = Math.max(.5, th * .08); g.beginPath(); g.moveTo(0, -th * .9); g.lineTo(0, th * .9); g.stroke(); g.restore();
      }
    }
    if (a.decal === 'blade') { // 薄刃拍框外缘的青蓝细线
      headPath(g, rx + th * .62, ry + th * .62, a.sq, cy); g.strokeStyle = a.accent; g.lineWidth = Math.max(.6, th * .2); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = th * .4; arcOnHead(g, rx, ry, a.sq, cy, -2.3, -1.9); g.stroke();
    }
    if (a.decal === 'ridge') { g.strokeStyle = hex(a.accent, .9); g.lineWidth = th * .3; arcOnHead(g, rx, ry, a.sq, cy, -1.9, -1.24); g.stroke(); }
    if (a.decal === 'feather1') { // 拍框下沿一片展开的羽毛
      const [fx0, fy0] = headPoint(rx, ry, a.sq, cy, 1.95), [fx1, fy1] = headPoint(rx, ry, a.sq, cy, 1.0);
      const mx = (fx0 + fx1) / 2, my = (fy0 + fy1) / 2 + th * .2, len = Math.hypot(fx1 - fx0, fy1 - fy0) * .55, rot = Math.atan2(fy1 - fy0, fx1 - fx0);
      g.save(); g.translate(mx, my); g.rotate(rot);
      g.fillStyle = hex(a.accent, .95); g.beginPath(); g.moveTo(-len, 0); g.quadraticCurveTo(-len * .2, -th * 1.5, len, -th * .2); g.quadraticCurveTo(-len * .1, th * .9, -len, 0); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(.5, th * .14); g.beginPath(); g.moveTo(-len * 1.1, th * .1); g.lineTo(len, -th * .2); g.stroke();
      for (let i = 1; i < 6; i++) { const u = -len + i * len * .32; g.beginPath(); g.moveTo(u, 0); g.lineTo(u + len * .12, -th * .9); g.stroke(); }
      g.restore();
    }
    if (a.decal === 'petals') { // 两侧细小花瓣纹
      for (const base of [0, Math.PI]) for (let i = -1; i <= 1; i++) {
        const ang = base + i * .3, [x, y] = headPoint(rx, ry, a.sq, cy, ang), r = th * (i ? .5 : .7);
        g.save(); g.translate(x, y); g.fillStyle = a.accent;
        for (let k = 0; k < 5; k++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -r * .7, r * .38, r * .62, 0, 0, TAU); g.fill(); }
        g.fillStyle = '#fff6b8'; g.beginPath(); g.arc(0, 0, r * .28, 0, TAU); g.fill(); g.restore();
      }
    }
    if (a.decal === 'ripple') { g.strokeStyle = hex(a.accent, .9); g.lineWidth = th * .28; for (const [s0, s1] of [[-2.6, -2.1], [-1.0, -.5]]) { arcOnHead(g, rx, ry, a.sq, cy, s0, s1); g.stroke(); } }
    if (a.decal === 'facet') { // 四角荧光橙刻度
      g.strokeStyle = a.accent; g.lineWidth = Math.max(.7, th * .22);
      for (const c of [-.8, -2.35, .8, 2.35]) for (let k = -1; k <= 1; k++) {
        const [x, y] = headPoint(rx, ry, a.sq, cy, c + k * .07), [x2, y2] = headPoint(rx + th * (k ? .5 : .9), ry + th * (k ? .5 : .9), a.sq, cy, c + k * .07);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      }
    }
    if (a.decal === 'shield') { // 两侧盾形护片纹
      for (const ang of [0, Math.PI]) {
        const [x, y] = headPoint(rx, ry, a.sq, cy, ang), s2 = th * 1.25;
        g.save(); g.translate(x, y); g.rotate(ang ? -Math.PI / 2 : Math.PI / 2);
        g.fillStyle = a.accent; g.strokeStyle = a.edge; g.lineWidth = Math.max(.5, th * .12);
        g.beginPath(); g.moveTo(-s2 * .8, -s2 * .7); g.lineTo(s2 * .8, -s2 * .7); g.lineTo(s2 * .8, 0); g.quadraticCurveTo(s2 * .6, s2 * .7, 0, s2); g.quadraticCurveTo(-s2 * .6, s2 * .7, -s2 * .8, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-s2 * .08, -s2 * .55, s2 * .16, s2 * 1.2); g.restore();
      }
    }
    if (a.decal === 'stars') {
      g.fillStyle = a.accent;
      for (let i = 0; i < 6; i++) { const [x, y] = headPoint(rx + th * .9, ry + th * .9, a.sq, cy, -2.9 + i * .55); star4(g, x, y, th * (.55 + (i % 2) * .3)); }
      g.fillStyle = '#ffffff'; star4(g, rx * .62, cy - ry * .7, th * .7);
    }
    g.restore();
  }

  // ====================== 球线（线盘） ======================
  /** 3/4 视角线盘，s 为整体尺寸，原点居中 */
  function reel(g, a, s) {
    const R = .38 * s, ry = .13 * s, cr = .29 * s, h = .4 * s, top = -h / 2 - .02 * s, bot = h / 2 + .02 * s, ft = .035 * s;
    g.save();
    // 底盘
    g.fillStyle = a.reel[1]; g.beginPath(); g.ellipse(0, bot + ft, R, ry, 0, 0, TAU); g.fill();
    g.fillStyle = lin(g, -R, 0, R, 0, [[0, a.reel[1]], [.5, a.reel[0]], [1, a.reel[1]]]); g.beginPath(); g.ellipse(0, bot, R, ry, 0, 0, Math.PI); g.lineTo(-R, bot); g.fill();
    g.fillRect(-R, bot, R * 2, ft); g.beginPath(); g.ellipse(0, bot + ft, R, ry, 0, 0, Math.PI); g.fill();
    // 缠绕的线圈：圆柱体明暗 + 线径决定纹理密度
    g.save(); g.beginPath(); g.rect(-cr, top, cr * 2, bot - top); g.ellipse(0, bot, cr, ry * cr / R, 0, 0, Math.PI); g.clip();
    g.fillStyle = lin(g, -cr, 0, cr, 0, [[0, a.shade], [.32, a.color], [.55, a.color], [1, a.shade]]); g.fillRect(-cr, top, cr * 2, bot - top + ry);
    const gap = s * .006 * (a.gauge / .66) * 1.6;
    g.strokeStyle = hex(a.shade, .55); g.lineWidth = Math.max(.5, gap * .45);
    for (let y = top; y < bot + ry; y += gap) { g.beginPath(); g.ellipse(0, y, cr, ry * cr / R, 0, .05, Math.PI - .05); g.stroke(); }
    if (!a.matte) { g.fillStyle = lin(g, -cr, 0, cr, 0, [[0, 'rgba(255,255,255,0)'], [.28, `rgba(255,255,255,${a.sheen})`], [.36, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-cr, top, cr * 2, bot - top + ry); }
    g.restore();
    // 顶盘（带厚度）
    g.fillStyle = a.reel[1]; g.beginPath(); g.ellipse(0, top + ft, R, ry, 0, 0, TAU); g.fill();
    g.fillStyle = lin(g, -R, top - ry, R, top + ry, [[0, a.reel[0]], [1, a.reel[1]]]); g.beginPath(); g.ellipse(0, top, R, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(.7, s * .006); g.beginPath(); g.ellipse(0, top, R * .93, ry * .9, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    // 标签环与轴孔
    g.strokeStyle = hex(a.label, .7); g.lineWidth = Math.max(.7, s * .008); g.beginPath(); g.ellipse(0, top, R * .7, ry * .7, 0, 0, TAU); g.stroke();
    g.fillStyle = '#05070d'; g.beginPath(); g.ellipse(0, top, R * .2, ry * .2, 0, 0, TAU); g.fill();
    g.fillStyle = a.label; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(R * .45, top); g.scale(1, ry / R * 1.5); font(g, s * .075, 900); g.fillText(a.gauge.toFixed(2), 0, 0); g.restore();
    g.save(); g.translate(-R * .45, top); g.scale(1, ry / R * 1.5); font(g, s * .06, 800); g.fillText('毫米', 0, 0); g.restore();
    // 线头
    g.strokeStyle = a.color; g.lineWidth = Math.max(1, s * .01 * a.gauge / .66); g.lineCap = 'round';
    g.beginPath(); g.moveTo(cr * .95, bot - h * .2); g.bezierCurveTo(R * 1.2, bot, R * .7, bot + ry * 2.2, R * 1.15, bot + ry * 1.6); g.stroke();
    g.restore();
  }
  /** 拍面微距：编织的拍线网格；bend 为击球形变（0~1） */
  function weave(g, a, x, y, r, bend = 0, t = 0) {
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.fillStyle = rad(g, x, y, 0, r, [[0, '#18233f'], [1, '#0a0f1f']]); g.fillRect(x - r, y - r, r * 2, r * 2);
    const n = 7, step = r * 2 / n, lw = step * .3 * (a.gauge / .66);
    const dip = (px, py) => { const d = Math.hypot(px - x, py - y) / r; return bend * Math.max(0, 1 - d * d) * r * .12; };
    for (const dir of [0, 1]) for (let i = 0; i <= n; i++) {
      const o = -r + i * step;
      g.strokeStyle = lin(g, x - r, y - r, x + r, y + r, [[0, a.color], [.5, a.shade], [1, a.color]]);
      g.lineWidth = lw; g.beginPath();
      for (let k = 0; k <= 16; k++) {
        const u = -r + k / 16 * r * 2, px = dir ? x + u : x + o, py = dir ? y + o : y + u, d = dip(px, py);
        const sx = px + (px - x) / r * -d * .4, sy = py + (py - y) / r * -d * .4;
        if (k) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      }
      g.stroke();
      if (!a.matte) { g.strokeStyle = `rgba(255,255,255,${a.sheen * .6})`; g.lineWidth = lw * .25; g.stroke(); }
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }

  // ====================== 球鞋（侧视，鞋头朝右） ======================
  function shoe(g, a, s) {
    const X = u => (u - .5) * s, Y = v => -v * s; // v：离地高度
    const out = .024, toe = a.toe || .035, mid = a.midH, heel = a.heel, collar = (a.low ? .3 : .34) + (a.heel - a.midH) * .4;
    const soleTop = u => out + heel + (mid - heel) * Math.min(1, Math.max(0, (u - .18) / .5)) + (u > .8 ? (u - .8) / .2 * toe : 0);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    // ---- 鞋面 ----
    const upper = () => {
      g.beginPath();
      g.moveTo(X(.05), Y(soleTop(.05)));
      g.bezierCurveTo(X(.015), Y(soleTop(.05) + .1), X(.02), Y(collar - .04), X(.07), Y(collar));
      g.quadraticCurveTo(X(.2), Y(collar - .085), X(.36), Y(collar - .02));
      g.lineTo(X(.41), Y(collar + .03));
      g.quadraticCurveTo(X(.47), Y(collar + .02), X(.49), Y(collar - .04));
      g.bezierCurveTo(X(.62), Y(soleTop(.7) + .17), X(.82), Y(soleTop(.86) + .14), X(.93), Y(soleTop(.93) + .085));
      g.bezierCurveTo(X(.99), Y(soleTop(.97) + .05), X(1.0), Y(soleTop(1) + .01), X(.975), Y(soleTop(.975) - .004));
      for (let u = .97; u >= .05; u -= .05) g.lineTo(X(u), Y(soleTop(u) - .004));
      g.closePath();
    };
    upper(); g.fillStyle = lin(g, 0, Y(collar + .03), 0, Y(out + mid), [[0, a.upper[0]], [1, a.upper[1]]]); g.fill();
    g.save(); upper(); g.clip();
    if (a.mesh || a.knit) { // 网眼 / 编织纹理
      g.fillStyle = a.knit ? hex(a.accent, .22) : 'rgba(0,0,0,.14)';
      const st = s * (a.knit ? .016 : .022);
      for (let yy = Y(collar + .05); yy < Y(out); yy += st) for (let xx = X(0); xx < X(1); xx += st) { g.beginPath(); g.arc(xx + ((yy / st) % 2) * st / 2, yy, st * (a.knit ? .22 : .28), 0, TAU); g.fill(); }
    }
    // 鞋头包片
    g.fillStyle = hex(a.trim, a.logo === 'cage' ? .7 : .16);
    g.beginPath(); g.moveTo(X(.76), Y(soleTop(.76))); g.quadraticCurveTo(X(.8), Y(soleTop(.8) + .11), X(.9), Y(soleTop(.9) + .1)); g.lineTo(X(1.02), Y(soleTop(1) + .08)); g.lineTo(X(1.02), Y(0)); g.lineTo(X(.76), Y(0)); g.closePath(); g.fill();
    // 后跟稳定片
    g.fillStyle = a.logo === 'cage' ? a.accent : hex(a.accent, .9);
    g.beginPath(); g.moveTo(X(0), Y(collar - .05)); g.quadraticCurveTo(X(.16), Y(collar - .1), X(.2), Y(soleTop(.2))); g.lineTo(X(0), Y(0)); g.closePath(); g.fill();
    if (a.logo === 'moon') { // 银色月牙后跟
      g.fillStyle = lin(g, X(0), 0, X(.18), 0, [[0, '#ffffff'], [1, '#aeb9cf']]); g.beginPath(); g.arc(X(.08), Y(soleTop(.08) + .1), s * .085, Math.PI * .5, Math.PI * 1.5); g.arc(X(.105), Y(soleTop(.08) + .1), s * .07, Math.PI * 1.5, Math.PI * .5, true); g.fill();
    }
    if (a.hexHeel) { // 鞋跟的六边形稳定标记
      const hx = X(.085), hy = Y(soleTop(.085) + .09), hr = s * .04; g.strokeStyle = '#ffffff'; g.lineWidth = s * .01; g.beginPath();
      for (let i = 0; i <= 6; i++) { const t = i / 6 * TAU + Math.PI / 6; if (i) g.lineTo(hx + Math.cos(t) * hr, hy + Math.sin(t) * hr); else g.moveTo(hx + Math.cos(t) * hr, hy + Math.sin(t) * hr); } g.stroke();
    }
    if (a.logo === 'cloud') { // 云朵轮廓后跟
      g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = hex(a.accent, .9); g.lineWidth = s * .008; const cx2 = X(.09), cy2 = Y(soleTop(.09) + .085);
      g.beginPath(); g.arc(cx2 - s * .03, cy2 + s * .01, s * .025, Math.PI * .5, Math.PI * 1.5); g.arc(cx2, cy2 - s * .015, s * .032, Math.PI, 0); g.arc(cx2 + s * .035, cy2 + s * .005, s * .022, Math.PI * 1.5, Math.PI * .5); g.closePath(); g.fill(); g.stroke();
    }
    if (a.fore) { g.fillStyle = hex(a.fore, .9); g.beginPath(); g.moveTo(X(.66), Y(soleTop(.66))); g.quadraticCurveTo(X(.74), Y(soleTop(.74) + .09), X(.86), Y(soleTop(.86) + .05)); g.lineTo(X(.86), Y(soleTop(.86))); g.closePath(); g.fill(); }
    // 侧面纹样
    g.strokeStyle = a.accent; g.fillStyle = a.accent;
    if (a.logo === 'arcs') {
      g.lineWidth = s * .022; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(X(.3 + i * .06), Y(soleTop(.3) + .02)); g.quadraticCurveTo(X(.48 + i * .05), Y(.24 - i * .02), X(.7 + i * .04), Y(soleTop(.7) + .13 - i * .02)); g.stroke(); }
    } else if (a.logo === 'reflect') {
      g.lineWidth = s * .014; g.beginPath(); g.moveTo(X(.22), Y(soleTop(.22) + .07));
      for (let i = 1; i <= 6; i++) g.lineTo(X(.22 + i * .08), Y(soleTop(.22 + i * .08) + (i % 2 ? .12 : .07))); g.stroke();
    } else if (a.logo === 'cloud') {
      g.lineWidth = s * .016; g.beginPath(); g.moveTo(X(.24), Y(soleTop(.24) + .06));
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(X(.3 + i * .12), Y(soleTop(.3) + .15), X(.36 + i * .12), Y(soleTop(.36 + i * .12) + .06)); g.stroke();
    } else if (a.logo === 'cage') { // 拱桥支撑网：一条贯穿中足的弧形支撑带 + 三道拱形肋骨落到鞋底
      const band = u => soleTop(u) + .1 + Math.sin((u - .2) / .62 * Math.PI) * .07;
      g.lineWidth = s * .026; g.strokeStyle = hex(a.accent, .95); g.beginPath();
      for (let u = .18; u <= .82; u += .02) { if (u > .18) g.lineTo(X(u), Y(band(u))); else g.moveTo(X(u), Y(band(u))); } g.stroke();
      g.lineWidth = s * .012; g.strokeStyle = hex(a.accent, .8);
      for (const u of [.3, .46, .62]) { g.beginPath(); g.moveTo(X(u - .06), Y(soleTop(u - .06))); g.quadraticCurveTo(X(u), Y(band(u) + .02), X(u + .06), Y(soleTop(u + .06))); g.stroke(); }
      g.fillStyle = a.trim; for (const u of [.3, .46, .62]) { g.beginPath(); g.arc(X(u), Y(band(u)), s * .011, 0, TAU); g.fill(); }
    } else if (a.logo === 'butterfly') { // 浅粉蝶翼侧纹
      const bx = X(.42), by = Y(soleTop(.42) + .1);
      for (const [dx, dy, rx2, ry2, rot] of [[-.05, -.03, .1, .06, -.5], [.06, -.035, .11, .065, .45], [-.035, .03, .07, .04, .5], [.05, .03, .075, .04, -.4]]) {
        g.fillStyle = hex(a.accent, .9); g.beginPath(); g.ellipse(bx + dx * s, by + dy * s, rx2 * s * .7, ry2 * s, rot, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(bx + dx * s * 1.1, by + dy * s * 1.1, rx2 * s * .25, ry2 * s * .35, rot, 0, TAU); g.fill();
      }
      g.fillStyle = a.trim; g.beginPath(); g.ellipse(bx, by, s * .008, s * .045, 0, 0, TAU); g.fill();
    } else if (a.logo === 'route') { // 连续起伏的路线纹
      g.lineWidth = s * .012; g.setLineDash([s * .03, s * .018]); g.beginPath();
      for (let u = .14; u <= .86; u += .02) { const v = soleTop(u) + .07 + Math.sin((u - .14) * 14) * .025; if (u > .14) g.lineTo(X(u), Y(v)); else g.moveTo(X(u), Y(v)); }
      g.stroke(); g.setLineDash([]);
      for (const u of [.14, .5, .86]) { const v = soleTop(u) + .07 + Math.sin((u - .14) * 14) * .025; g.fillStyle = a.trim; g.beginPath(); g.arc(X(u), Y(v), s * .014, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(u), Y(v), s * .006, 0, TAU); g.fill(); }
    } else if (a.logo === 'moon') { // 向后延伸的箭形支撑片
      g.fillStyle = hex(a.accent, .9);
      for (let i = 0; i < 3; i++) { const u = .62 - i * .14, v = soleTop(u) + .08; g.beginPath(); g.moveTo(X(u), Y(v + .05)); g.lineTo(X(u - .08), Y(v)); g.lineTo(X(u), Y(v - .05)); g.lineTo(X(u - .03), Y(v)); g.closePath(); g.fill(); }
    } else if (a.logo === 'wing') { // 羽翼标
      for (let i = 0; i < 4; i++) {
        g.beginPath(); const x0 = X(.3 + i * .045), y0 = Y(soleTop(.3) + .05);
        g.moveTo(x0, y0); g.quadraticCurveTo(x0 + s * .1, y0 - s * (.1 + i * .02), x0 + s * (.24 - i * .02), y0 - s * (.14 - i * .02)); g.quadraticCurveTo(x0 + s * .12, y0 - s * .03, x0, y0); g.fill();
      }
    }
    // 鞋带区
    g.strokeStyle = hex(a.trim, .55); g.lineWidth = s * .024;
    g.beginPath(); g.moveTo(X(.45), Y(collar - .02)); g.bezierCurveTo(X(.55), Y(soleTop(.6) + .2), X(.62), Y(soleTop(.66) + .18), X(.68), Y(soleTop(.7) + .16)); g.stroke();
    g.strokeStyle = a.lace; g.lineWidth = s * .011;
    for (let i = 0; i < 5; i++) {
      const u = .46 + i * .048, v = collar - .025 - i * (collar - .025 - (soleTop(.7) + .16)) / 4.6;
      g.beginPath(); g.moveTo(X(u - .025), Y(v + .012)); g.lineTo(X(u + .025), Y(v - .012)); g.stroke();
    }
    // 领口内衬
    g.strokeStyle = hex(a.trim, .8); g.lineWidth = s * .018; g.beginPath(); g.moveTo(X(.07), Y(collar)); g.quadraticCurveTo(X(.2), Y(collar - .085), X(.36), Y(collar - .02)); g.stroke();
    g.fillStyle = lin(g, 0, Y(collar + .03), 0, Y(out), [[0, 'rgba(255,255,255,.24)'], [.45, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.12)']]); g.fillRect(X(0), Y(collar + .05), s, s * collar);
    g.restore();
    upper(); g.strokeStyle = 'rgba(6,10,22,.45)'; g.lineWidth = Math.max(.8, s * .008); g.stroke();
    // 后跟提拉环
    g.strokeStyle = a.accent; g.lineWidth = s * .014; g.beginPath(); g.moveTo(X(.06), Y(collar - .01)); g.quadraticCurveTo(X(.02), Y(collar + .06), X(.1), Y(collar + .02)); g.stroke();
    // ---- 中底 ----
    const midPath = () => {
      g.beginPath(); g.moveTo(X(.03), Y(out));
      for (let u = .03; u <= .98; u += .05) g.lineTo(X(u), Y(out + (u > .8 ? (u - .8) / .2 * toe * .7 : 0)));
      g.quadraticCurveTo(X(1.0), Y(out + toe), X(.98), Y(soleTop(.98)));
      for (let u = .98; u >= .03; u -= .05) g.lineTo(X(u), Y(soleTop(u)));
      g.quadraticCurveTo(X(.005), Y(soleTop(.03) * .5), X(.03), Y(out)); g.closePath();
    };
    midPath(); g.fillStyle = lin(g, 0, Y(out + heel), 0, Y(out), [[0, a.mid[0]], [1, a.mid[1]]]); g.fill();
    g.save(); midPath(); g.clip();
    if (a.pods) { // 可视气垫窗
      for (const [u, w] of [[.12, .16], [.62, .2]]) {
        const y0 = Y(soleTop(u + w / 2) - .012), y1 = Y(out + .016);
        g.fillStyle = lin(g, 0, y0, 0, y1, [[0, 'rgba(160,215,255,.95)'], [1, 'rgba(70,150,230,.95)']]); rr(g, X(u), y0, w * s, y1 - y0, s * .02); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = s * .005; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(X(u + w * k / 4), y0 + 2); g.lineTo(X(u + w * k / 4), y1 - 2); g.stroke(); }
      }
    }
    if (a.layered) { // 淡紫色分层中底
      for (let k = 0; k < 2; k++) { g.fillStyle = hex(a.accent, k ? .55 : .3); g.beginPath(); for (let u = .03; u <= .98; u += .05) { const v = out + (soleTop(u) - out) * (.28 + k * .3); if (u > .03) g.lineTo(X(u), Y(v)); else g.moveTo(X(u), Y(v)); } for (let u = .98; u >= .03; u -= .05) g.lineTo(X(u), Y(out + (soleTop(u) - out) * (.12 + k * .3))); g.closePath(); g.fill(); }
    }
    if (a.mesh) { g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = s * .004; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(X(.03), Y(out + heel * k / 4)); g.lineTo(X(.98), Y(out + mid * k / 4)); g.stroke(); } }
    if (a.outrigger) { g.fillStyle = hex(a.accent, .85); g.beginPath(); g.moveTo(X(.7), Y(out)); g.quadraticCurveTo(X(.86), Y(soleTop(.86) + .02), X(.96), Y(out + .01)); g.closePath(); g.fill(); g.beginPath(); g.moveTo(X(.04), Y(out)); g.quadraticCurveTo(X(.1), Y(soleTop(.12) + .02), X(.24), Y(out)); g.closePath(); g.fill(); }
    g.strokeStyle = hex(a.accent, .8); g.lineWidth = s * .006; g.beginPath(); g.moveTo(X(.06), Y(out + heel * .45)); g.lineTo(X(.92), Y(out + mid * .45 + toe * .2)); g.stroke();
    g.restore();
    midPath(); g.strokeStyle = 'rgba(6,10,22,.35)'; g.lineWidth = Math.max(.6, s * .005); g.stroke();
    // ---- 大底（生胶 / 橡胶）与纹路 ----
    g.fillStyle = a.out; g.beginPath(); g.moveTo(X(.035), Y(out));
    for (let u = .035; u <= .98; u += .05) g.lineTo(X(u), Y(out + (u > .8 ? (u - .8) / .2 * toe * .7 : 0)));
    g.lineTo(X(.985), Y(toe * .7));
    for (let u = .98; u >= .04; u -= .05) g.lineTo(X(u), Y(u > .8 ? (u - .8) / .2 * toe * .7 : 0));
    g.quadraticCurveTo(X(.02), Y(.004), X(.035), Y(out)); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = Math.max(.5, s * .004);
    const toeY = u => (u > .8 ? (u - .8) / .2 * toe * .7 : 0);
    if (a.herring) { g.strokeStyle = 'rgba(255,176,46,.55)'; for (let u = .06; u < .95; u += .035) { g.beginPath(); g.moveTo(X(u), Y(.003 + toeY(u))); g.lineTo(X(u + .015), Y(out * .5 + toeY(u))); g.lineTo(X(u), Y(out * .9 + toeY(u))); g.stroke(); } }
    else if (a.spring) { g.strokeStyle = hex(a.accent, .9); g.lineWidth = Math.max(.6, s * .006); for (let u = .55; u < .95; u += .06) { g.beginPath(); g.arc(X(u), Y(out * .3 + toeY(u)), s * .018, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
    if (!a.herring) for (let u = .06; u < .95; u += .03) { g.beginPath(); g.moveTo(X(u), Y(.002 + (u > .8 ? (u - .8) / .2 * toe * .7 : 0))); g.lineTo(X(u + .012), Y(out * .7 + (u > .8 ? (u - .8) / .2 * toe * .7 : 0))); g.stroke(); }
    g.restore();
  }

  // ====================== 磅数表盘 ======================
  const ZONES = [[20, 22, '低磅', '#5fe3a1'], [23, 25, '中磅', '#ffcf4a'], [26, 27, '中高磅', '#ff9a52'], [28, 30, '高磅', '#ff5d6c']];
  const zoneOf = lbs => ZONES.find(z => lbs <= z[1]) || ZONES[3];
  const ang = v => Math.PI * .75 + (v - 20) / 10 * Math.PI * 1.5;
  /** 表盘静态部分（底盘、暗色分区带、刻度、数字），原点居中；可缓存 */
  function dialBase(g, r, mini) {
    g.fillStyle = rad(g, 0, -r * .3, 0, r * 1.2, [[0, '#1e2a4c'], [1, '#080d1d']]); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(1, r * .03); g.stroke();
    g.lineWidth = r * .12;
    for (const [lo, hi, , col] of ZONES) { g.strokeStyle = hex(col, .22); g.beginPath(); g.arc(0, 0, r * .8, ang(lo - .5 + (lo === 20 ? .5 : 0)) + .02, ang(hi + .5 - (hi === 30 ? .5 : 0)) - .02); g.stroke(); }
    for (let v = 20; v <= 30; v++) {
      const a = ang(v), major = v % 2 === 0, r1 = r * .64, r2 = major ? r * .55 : r * .6;
      g.strokeStyle = major ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, r * (major ? .025 : .015));
      g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke();
      if (major && !mini && v > 20 && v < 30) { g.fillStyle = 'rgba(220,230,255,.7)'; font(g, r * .1, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(v, Math.cos(a) * r * .44, Math.sin(a) * r * .44); }
    }
  }
  /** 动态部分：已点亮的分区色带、指针与读数 */
  function dialLive(g, x, y, r, value, mini, unit) {
    const z = zoneOf(Math.round(value));
    g.save(); g.lineWidth = r * .12;
    for (const [lo, hi, , col] of ZONES) {
      const a0 = ang(lo - .5 + (lo === 20 ? .5 : 0)) + .02, a1 = Math.min(ang(hi + .5 - (hi === 30 ? .5 : 0)) - .02, ang(value));
      if (a1 > a0) { g.strokeStyle = hex(col, .95); g.beginPath(); g.arc(x, y, r * .8, a0, a1); g.stroke(); }
    }
    const a = ang(value);
    g.strokeStyle = z[3]; g.lineWidth = Math.max(1.5, r * .045); g.lineCap = 'round';
    if (!mini) { g.globalAlpha = .35; g.lineWidth *= 2.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * .74, y + Math.sin(a) * r * .74); g.stroke(); g.globalAlpha = 1; g.lineWidth = Math.max(1.5, r * .045); }
    g.beginPath(); g.moveTo(x - Math.cos(a) * r * .1, y - Math.sin(a) * r * .1); g.lineTo(x + Math.cos(a) * r * .78, y + Math.sin(a) * r * .78); g.stroke();
    g.fillStyle = '#dfe6f4'; g.beginPath(); g.arc(x, y, r * .1, 0, TAU); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (!mini) {
      g.fillStyle = '#ffffff'; font(g, r * .3, 900); g.fillText(Math.round(value), x, y + r * .42);
      g.fillStyle = z[3]; font(g, r * .11, 800); g.fillText((unit || '磅') + ' · ' + z[2], x, y + r * .68);
    } else { g.fillStyle = '#ffffff'; font(g, r * .36, 900); g.fillText(Math.round(value), x, y + r * .5); }
    g.restore();
  }
  /** 磅数表盘：opt.res 存在时整块（迷你）或底盘（大表）走离屏缓存 */
  function dial(g, x, y, r, value, opt = {}) {
    const mini = !!opt.mini, res = opt.res;
    if (mini && res) { const v = Math.round(value); return g.drawImage(cached('dial-mini:' + v, r * 2, r * 2, res, c => { dialBase(c, r, true); dialLive(c, 0, 0, r, v, true); }), x - r, y - r, r * 2, r * 2); }
    if (res) g.drawImage(cached('dial-base' + (mini ? 'm' : ''), r * 2, r * 2, res, c => dialBase(c, r, mini)), x - r, y - r, r * 2, r * 2);
    else { g.save(); g.translate(x, y); dialBase(g, r, mini); g.restore(); }
    dialLive(g, x, y, r, value, mini, opt.unit);
  }

  // ====================== 缓存与扫光 ======================
  const cache = new Map(); let scratch = null;
  function cached(key, w, h, res, fn) {
    const pw = Math.max(1, Math.ceil(w * res)), ph = Math.max(1, Math.ceil(h * res)), k = key + '@' + pw + 'x' + ph;
    let c = cache.get(k);
    if (!c) {
      c = YY.platform.createCanvas(); c.width = pw; c.height = ph;
      const x = c.getContext('2d'); x.setTransform(res, 0, 0, res, 0, 0); x.translate(w / 2, h / 2); fn(x);
      cache.set(k, c);
      if (cache.size > 60) cache.delete(cache.keys().next().value);
    }
    return c;
  }
  /** 把缓存图稿画到主画布；phase∈[0,1] 时叠加一道斜向扫光（只照亮图稿本身） */
  function blit(g, cv, x, y, w, h, phase = -1) {
    g.drawImage(cv, x, y, w, h);
    if (!(phase >= 0 && phase <= 1)) return;
    if (!scratch || scratch.width < cv.width || scratch.height < cv.height) { scratch = YY.platform.createCanvas(); scratch.width = Math.max(cv.width, scratch?.width || 0); scratch.height = Math.max(cv.height, scratch?.height || 0); }
    const c = scratch.getContext('2d'), W = cv.width, H = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const p = -.4 + phase * 1.8, gr = c.createLinearGradient(W * p, 0, W * (p + .45), H);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, 0, 0, W, H, x, y, w, h);
  }

  /** 单件器械图稿（不含背景），适配 w×h 框，居中 */
  function art(item, w, h, res, variant = 'thumb') {
    const cat = item.cat, a = ART[cat]?.[item.id];
    return cached(cat + ':' + item.id + ':' + variant, w, h, res, g => {
      if (cat === 'racket') {
        if (variant === 'thumb') { g.rotate(-.78); racket(g, a, Math.min(w, h) * 1.12, { logo: false }); }
        else racket(g, a, h * .96);
      } else if (cat === 'string') reel(g, a, Math.min(w, h * 1.25) * .95);
      else if (cat === 'shoe') { g.translate(0, h * .18); shoe(g, a, Math.min(w * .96, h * 2.1)); }
    });
  }

  // ====================== 展台 ======================
  /** 展台背景：聚光、地台光环、上浮微粒 */
  function stageBack(g, x, y, w, h, t, color) {
    g.save();
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, UI.panelTop], [.7, UI.panelBot], [1, UI.bg]]); g.fillRect(x, y, w, h);
    g.fillStyle = rad(g, x + w / 2, y - h * .1, 0, h * 1.05, [[0, hex(color, .3)], [.5, hex(color, .08)], [1, hex(color, 0)]]); g.fillRect(x, y, w, h);
    // 光柱
    g.fillStyle = lin(g, 0, y, 0, y + h * .85, [[0, 'rgba(255,255,255,.10)'], [1, 'rgba(255,255,255,0)']]);
    g.beginPath(); g.moveTo(x + w * .42, y); g.lineTo(x + w * .58, y); g.lineTo(x + w * .78, y + h * .85); g.lineTo(x + w * .22, y + h * .85); g.closePath(); g.fill();
    // 透视地面网格
    const fy = y + h * .8;
    g.strokeStyle = hex(color, .12); g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(x + w / 2 + i * w * .04, fy); g.lineTo(x + w / 2 + i * w * .16, y + h); g.stroke(); }
    for (let k = 0; k < 3; k++) { const yy = fy + (y + h - fy) * (k + 1) / 4; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    // 地台
    const pw = w * .36, ph = h * .055;
    g.fillStyle = rad(g, x + w / 2, fy, 0, pw, [[0, hex(color, .45)], [1, hex(color, 0)]]); g.beginPath(); g.ellipse(x + w / 2, fy, pw * 1.3, ph * 2.2, 0, 0, TAU); g.fill();
    g.strokeStyle = hex(color, .75); g.lineWidth = 1.6; g.beginPath(); g.ellipse(x + w / 2, fy, pw, ph, 0, 0, TAU); g.stroke();
    g.strokeStyle = hex(color, .3); g.lineWidth = 1; g.beginPath(); g.ellipse(x + w / 2, fy, pw * (1.15 + .1 * ((t * .6) % 1)), ph * (1.15 + .1 * ((t * .6) % 1)), 0, 0, TAU); g.stroke();
    // 上浮微粒（确定性伪随机，避免每帧分配）
    for (let i = 0; i < 18; i++) {
      const s1 = Math.sin(i * 91.7) * 43758.5, r1 = s1 - Math.floor(s1), s2 = Math.sin(i * 12.9) * 9631.3, r2 = s2 - Math.floor(s2);
      const life = (t * (.08 + r2 * .1) + r1) % 1, px = x + w * (.15 + .7 * r1) + Math.sin(t + i) * 6, py = fy - life * h * .75;
      g.globalAlpha = Math.sin(life * Math.PI) * .7; g.fillStyle = i % 3 ? color : '#ffffff';
      g.beginPath(); g.arc(px, py, 1 + r2 * 1.4, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
    return fy;
  }
  /** 器械展台：主图 + 浮动/旋转/扫光 + 分类专属的性能演示 */
  function stage(g, item, x, y, w, h, t, res, info = {}) {
    const cat = item ? item.cat : 'tension', a = item ? ART[cat]?.[item.id] : null;
    const color = info.color || (a ? TIERS[a.tier].color : CATS.tension.color);
    g.save(); YY.rr(g, x, y, w, h, 4); g.clip();
    const fy = stageBack(g, x, y, w, h, t, color), cx = x + w / 2;
    const sheen = ((t % 3.6) / 1.1); // 每 3.6 秒扫一次光
    if (cat === 'racket') {
      const L = Math.min(h * .9, w * 1.3), bob = Math.sin(t * 1.5) * 4, spin = .86 + .14 * Math.cos(t * .9), tilt = -.34 + .06 * Math.sin(t * .7);
      const cv = art(item, L * .4, L, res, 'hero');
      // 投影
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, fy, L * .16 * spin, 6, 0, 0, TAU); g.fill();
      if (a.glow) { g.fillStyle = rad(g, cx, fy - L * .5, 0, L * .55, [[0, hex(a.glow, .28 + .1 * Math.sin(t * 2))], [1, hex(a.glow, 0)]]); g.fillRect(x, y, w, h); }
      const ry0 = y + h * .5; g.save(); g.translate(cx, ry0 + bob); g.rotate(tilt); g.scale(spin, 1);
      blit(g, cv, -L * .2, -L * .5, L * .4, L, sheen);
      g.restore();
      // 挥拍演示：球从拍面甜区飞出，球速与力量加成相关
      const pw = 1 + (item.fx.power || 0), cyc = (t % 3.2) / 3.2;
      if (cyc < .55) {
        const k = cyc / .55, sx = cx + Math.sin(-tilt) * -L * .27 * spin, sy = ry0 + bob - Math.cos(tilt) * L * .27;
        const dist = w * .62 * Math.pow(k, .7 / pw), px = sx + dist, py = sy - dist * .22;
        g.strokeStyle = lin(g, sx, sy, px, py, [[0, hex(color, 0)], [1, hex(color, .85)]]); g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(Math.max(sx, px - w * .3 * pw), py + (Math.min(dist, w * .3 * pw)) * .22); g.lineTo(px, py); g.stroke();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.fill();
      }
      info.readout = info.readout || `杀球初速 ${Math.round(318 * pw)} 千米/时`;
    } else if (cat === 'string') {
      const s = Math.min(h * .56, w * .5), bob = Math.sin(t * 1.4) * 3;
      const cv = art(item, s, s, res, 'hero');
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx - w * .12, fy - 2, s * .36, 7, 0, 0, TAU); g.fill();
      blit(g, cv, cx - w * .12 - s / 2, fy - s * .84 + bob, s, s, sheen);
      // 微距镜头：击球瞬间拍线下陷再回弹
      const lr = Math.min(h * .2, w * .17), lx = x + w - lr - 14, ly = y + lr + 30, cyc = (t % 2.4) / 2.4;
      const bend = cyc < .25 ? Math.sin(cyc / .25 * Math.PI) : 0, rep = 1 + (item.fx.power || 0) * 4;
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - w * .02, fy - s * .5); g.lineTo(lx - lr * .7, ly + lr * .7); g.stroke();
      weave(g, a, lx, ly, lr, bend * Math.min(1.4, .7 + rep * .3), t);
      // 球的飞入飞出
      const k = cyc < .25 ? 0 : (cyc - .25) / .75, bx = lx - lr * .1 - k * lr * 2.2 * rep * .6, by = ly - k * lr * .6;
      if (cyc >= .25 && k < .7) { g.globalAlpha = 1 - k / .7; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, by, 3, 0, TAU); g.fill(); g.globalAlpha = 1; }
      font(g, 10, 800); g.fillStyle = 'rgba(220,230,255,.7)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('微距 · 击球形变', lx, ly + lr + 12);
      info.readout = info.readout || `线径 ${a.gauge.toFixed(2)} mm · 回弹 ${Math.round(100 + (item.fx.power || 0) * 100)}%`;
    } else if (cat === 'shoe') {
      const s = Math.min(w * .78, h * 1.35), cyc = (t % 2.2) / 2.2, hop = cyc < .45 ? Math.sin(cyc / .45 * Math.PI) : 0;
      const land = cyc >= .45 && cyc < .7 ? (cyc - .45) / .25 : -1, slide = (item.fx.lunge || 0) > 0 ? (item.fx.lunge) * 30 : 0;
      const cv = art(item, s, s * .5, res, 'hero'), lift = hop * h * .1 * (1 + (item.fx.jump || 0) * 3);
      const sx = land >= 0 ? Math.sin(land * Math.PI * .5) * slide : 0;
      g.fillStyle = `rgba(0,0,0,${.4 - hop * .2})`; g.beginPath(); g.ellipse(cx + sx, fy, s * .42 * (1 - hop * .25), 6, 0, 0, TAU); g.fill();
      g.save(); g.translate(cx + sx, fy - s * .25 - s * .02 - lift); g.rotate(-hop * .08 + (land >= 0 ? Math.sin(land * Math.PI) * .03 : 0));
      blit(g, cv, -s / 2, -s * .25, s, s * .5, sheen); g.restore();
      if (land >= 0) { // 落地扬尘与打滑痕
        const cush = 1 - Math.max(-.5, Math.min(.5, item.fx.land || 0));
        for (let i = 0; i < 7; i++) { const d = land * (16 + i * 5) * cush; g.globalAlpha = (1 - land) * .55; g.fillStyle = '#d8e4ff'; g.beginPath(); g.arc(cx + sx + (i - 3) * s * .12 + Math.sign(i - 3) * d, fy - 2 - land * (6 + (i % 3) * 3), 2 + land * 3, 0, TAU); g.fill(); }
        if (slide) { g.globalAlpha = (1 - land) * .8; g.strokeStyle = '#ff7f8a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - s * .3, fy + 3); g.lineTo(cx - s * .3 + sx, fy + 3); g.stroke(); }
        g.globalAlpha = 1;
      }
      const fx = item.fx; info.readout = info.readout || `启动 ${Math.round(100 + ((fx.accel || 0) + (fx.move || 0)) * 100)} · 缓震 ${Math.round(100 - (fx.land || 0) * 100)}`;
    } else { // 磅数：表盘 + 拍线形变示意
      const v = info.value || 24, r = Math.min(h * .36, w * .25), dx = x + w * .3, dy = y + h * .46;
      dial(g, dx, dy, r, v, { res });
      const bx0 = x + w * .6, bx1 = x + w - 18, by = y + h * .4, cyc = (t % 2) / 2, push = cyc < .3 ? Math.sin(cyc / .3 * Math.PI) : 0;
      const depth = (31 - v) / 11 * h * .2 * push, mx = (bx0 + bx1) / 2, z = zoneOf(Math.round(v));
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(bx0 - 3, by - 14, 4, 28); g.fillRect(bx1 - 1, by - 14, 4, 28);
      g.strokeStyle = z[3]; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx0, by); g.quadraticCurveTo(mx, by + depth * 2, bx1, by); g.stroke();
      // 羽毛球
      const sy = by - 9 + depth - (cyc >= .3 ? (cyc - .3) / .7 * h * .25 * (1 + (31 - v) / 22) : 0);
      g.save(); g.translate(mx, sy); g.fillStyle = '#ffe8b1'; g.beginPath(); g.arc(0, 6, 5, 0, Math.PI); g.fill();
      g.fillStyle = '#f5fcff'; g.beginPath(); g.moveTo(-5, 6); g.lineTo(-8, -10); g.lineTo(8, -10); g.lineTo(5, 6); g.closePath(); g.fill(); g.restore();
      font(g, 11, 800); g.fillStyle = 'rgba(220,230,255,.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(v <= 24 ? '形变大 · 弹性足' : '形变小 · 控制准', mx, by + h * .3);
      info.readout = info.readout || '';
    }
    // 装备成功的光环
    if (info.burst != null && info.burst < 1) {
      const k = info.burst; g.strokeStyle = hex(color, 1 - k); g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath(); g.ellipse(cx, fy, w * (.2 + k * .5), h * (.05 + k * .12), 0, 0, TAU); g.stroke();
      g.fillStyle = hex('#ffffff', (1 - k) * .18); g.fillRect(x, y, w, h);
    }
    g.restore();
    return info;
  }

  return {
    TIERS, CATS, ART, ZONES, zoneOf,
    meta(item) { return ART[item.cat]?.[item.id] || { tier: 'std', tag: '' }; },
    tier(item) { return TIERS[(ART[item.cat]?.[item.id] || {}).tier || 'std']; },
    art, blit, stage, dial, racket, reel, shoe, weave,
    clear() { cache.clear(); scratch = null; },
  };
};

})(window);
