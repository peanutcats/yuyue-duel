/* 羽跃对决 · 技能装置与特效绘制
 * 所有技能装置都要“看得见、读得懂”：形状 + 颜色 + 倒计时 / 状态，并在旁边标出名字。
 * 只负责画面；数据来自 match.ents、match.sk、shuttle.ctl 与选手 buff（联机快照同样带有这些字段）。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp } = YY;
  const HW = 3.05; // 场地半宽（纵深）
  const TAU = Math.PI * 2;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const colOf = (id, fb) => ((YY.SKILLS && YY.SKILLS[id]) || {}).color || fb || '#ffd23f';

  function W(R, x, y) { return [R.sx(x), R.sy(y)]; }
  function font(R, px, w) { return `${w || 800} ${Math.round(px * (R.hudK || 1))}px ${YY.FONT}`; }
  /** 小标签（技能名 / 状态） */
  function tag(R, ctx, text, x, y, color, alpha) {
    const fs = Math.max(10, R.sc * 0.15);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = font(R, fs, 800);
    const [X, Y] = W(R, x, y), tw = ctx.measureText(text).width, h = fs + 6;
    ctx.fillStyle = 'rgba(8,10,28,0.72)'; YY.rr(ctx, X - tw / 2 - 6, Y - h / 2, tw + 12, h, h / 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, X, Y + 0.5);
    ctx.restore();
  }
  /** 拍头：椭圆拍框 + 网线；ang 为拍杆方向 */
  function racketHead(ctx, X, Y, ang, k, color, flash) {
    ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
    if (flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, k * 0.28, k * 0.22, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = 'rgba(232,255,247,0.18)'; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, k * 0.035);
    ctx.beginPath(); ctx.ellipse(0, 0, k * 0.17, k * 0.13, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,255,247,0.55)'; ctx.lineWidth = 1;
    for (const d of [-0.08, 0, 0.08]) { ctx.beginPath(); ctx.moveTo(d * k, -k * 0.12); ctx.lineTo(d * k, k * 0.12); ctx.moveTo(-k * 0.15, d * k * 0.8); ctx.lineTo(k * 0.15, d * k * 0.8); ctx.stroke(); }
    ctx.restore();
  }
  /** 倒计时圆环：u = 剩余比例 */
  function timer(R, ctx, x, y, r, u, color) {
    const [X, Y] = W(R, x, y), rr = r * R.sc;
    ctx.save();
    ctx.lineWidth = Math.max(2, R.sc * 0.035);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(X, Y, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(X, Y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(u, 0, 1)); ctx.stroke();
    ctx.restore();
  }
  /** 地面横条（沿场地纵深铺满） */
  function floorBand(R, ctx, x0, x1, fill, z0, z1) {
    const a = R.P(x0, 0, z0 == null ? -HW : z0), b = R.P(x1, 0, z0 == null ? -HW : z0), c = R.P(x1, 0, z1 == null ? HW : z1), d = R.P(x0, 0, z1 == null ? HW : z1);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  function floorLine(R, ctx, x, color, width, dash) {
    const a = R.P(x, 0, -HW), b = R.P(x, 0, HW);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
  }
  /** 地面上的椭圆（透视压扁） */
  function floorOval(R, ctx, x, r, fill, stroke, lw) {
    const [X, Y] = W(R, x, 0);
    ctx.beginPath(); ctx.ellipse(X, Y, r * R.sc, r * R.sc * 0.28, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function star(ctx, X, Y, r, n, inner) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * (inner || 0.45) : r; ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  /** 赌场筹码：彩色圆片 + 白色边齿 */
  function chip(ctx, X, Y, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, r * .28); ctx.setLineDash([r * .42, r * .42]); ctx.beginPath(); ctx.arc(X, Y, r * .8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(X, Y, r * .38, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.stroke();
  }
  /** 拖动预览：轨迹虚线、落点（绿 = 好、红 = 会丢分）、墙、反弹点、冰窗、文字 */
  function previewDraw(R, ctx, m, p, pv, color) {
    const k = R.sc, col = pv.good === false ? '#ff6e6e' : color;
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = .9;
    if (pv.walls) for (const w of pv.walls) { // 地板开球：预览两面墙的位置
      ctx.save(); ctx.globalAlpha = .45; ctx.setLineDash([5, 5]); ctx.strokeStyle = '#ffb36a';
      const a = w.v ? W(R, w.x, 0) : W(R, w.x0, w.y), b = w.v ? W(R, w.x, w.y1 * .82) : W(R, w.x1, w.y);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
    }
    if (pv.pts && pv.pts.length > 1) {
      ctx.setLineDash(pv.bun ? [2, 6] : [6, 5]); ctx.beginPath();
      pv.pts.forEach((q, i) => { const [X, Y] = W(R, q.x, q.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); ctx.setLineDash([]);
    }
    if (pv.line) {
      const [[x0, y0], [x1, y1]] = pv.line, [X0, Y0] = W(R, x0, y0), [X1, Y1] = W(R, x1, y1);
      ctx.setLineDash(pv.ruler ? [10, 5] : [4, 4]); ctx.lineWidth = pv.ruler ? 2.5 : 3; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); ctx.setLineDash([]);
      if (pv.ruler) { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X0, Y0, k * .42, 0, TAU); ctx.globalAlpha = .4; ctx.stroke(); ctx.globalAlpha = .9; }
    }
    for (const h of pv.hits || []) { const [X, Y] = W(R, h.x, h.y); ctx.beginPath(); ctx.arc(X, Y, k * .09, 0, TAU); ctx.fillStyle = '#fff3e0'; ctx.fill(); ctx.strokeStyle = '#ff9a3d'; ctx.stroke(); }
    if (pv.mark) { const [X, Y] = W(R, pv.mark.x, pv.mark.y); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(X, Y, k * .2, 0, TAU); ctx.stroke(); }
    if (pv.land != null) { const [LX, LY] = W(R, pv.land, 0); ctx.fillStyle = pv.good ? '#7dffb0' : '#ff6e6e'; ctx.beginPath(); ctx.ellipse(LX, LY, k * .2, k * .065, 0, 0, TAU); ctx.fill(); }
    if (pv.rect) { const r = pv.rect, [X0, Y0] = W(R, r.x - r.h, r.y + r.h), [X1, Y1] = W(R, r.x + r.h, r.y - r.h); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#bfefff'; ctx.fillStyle = 'rgba(191,239,255,.15)'; ctx.beginPath(); ctx.rect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0)); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    if (pv.label) tag(R, ctx, pv.label, p.x, p.y + 2.5, col, .95);
  }
  /** 大肉包：白胖的包子 + 顶上的褶子 */
  function bunDraw(ctx, r) {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#ecd3ad');
    ctx.globalAlpha = 0.95; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.86, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#c9a477'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.quadraticCurveTo(Math.cos(a) * r * 0.4, -r * 0.5, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.2 - r * 0.35); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,140,120,0.35)'; for (const sx of [-0.45, 0.45]) { ctx.beginPath(); ctx.ellipse(sx * r, r * 0.25, r * 0.16, r * 0.09, 0, 0, TAU); ctx.fill(); }
  }
  function ghostOf(R, ctx, m, p, x, y, alpha, tint, extra) {
    const look = R.lookOf(m, p.idx), q = Object.assign({}, p, { x, y: y || 0, vx: 0, vy: 0, onGround: !(y > 0), swing: extra && extra.swing || null, buff: {} });
    ctx.save(); ctx.globalAlpha = alpha;
    R.drawCharAt(ctx, q, look, R.charOpts(q, m, Object.assign({ flat: tint || look.shirt }, extra && extra.opts)));
    ctx.restore();
  }

  /** 果哥头顶的钱包：金币数 + 装备档；负债时变红；押注时旁边叠一摞筹码 */
  function wallet(R, ctx, p, t) {
    const a = p.market, debt = YY.marketDebt(a.coins), st = YY.marketStyle(a), k = R.sc;
    const fs = Math.max(10, k * .15), [X, Y] = W(R, p.x, p.y + 2.85);
    ctx.save(); ctx.font = font(R, fs, 900);
    const num = (debt ? '负债 ' : '') + Math.round(a.coins), name = st.name, w1 = ctx.measureText(num).width;
    ctx.font = font(R, fs * .82, 700); const w2 = ctx.measureText(name).width;
    const h = fs + 8, cr = h * .36, w = cr * 2 + 8 + w1 + 10 + w2 + 12, x0 = X - w / 2;
    ctx.fillStyle = debt ? 'rgba(40,6,8,.82)' : 'rgba(8,10,28,.78)'; YY.rr(ctx, x0, Y - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = debt ? '#ff5a4a' : st.color; ctx.lineWidth = 1.4; ctx.stroke();
    const cx = x0 + 6 + cr, flip = Math.abs(Math.cos(t * 3)); // 旋转的金币
    ctx.fillStyle = debt ? '#8a8f99' : '#ffd23f'; ctx.beginPath(); ctx.ellipse(cx, Y, cr * (.35 + .65 * flip), cr, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = debt ? '#4a4f58' : '#b8860b'; ctx.lineWidth = 1; ctx.stroke();
    if (flip > .5) { ctx.fillStyle = debt ? '#4a4f58' : '#b8860b'; ctx.font = font(R, cr * 1.2, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(debt ? '欠' : '¥', cx, Y + .5); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = font(R, fs, 900); ctx.fillStyle = debt ? '#ff8a7a' : '#fff1b8'; ctx.fillText(num, cx + cr + 6, Y + .5);
    ctx.font = font(R, fs * .82, 700); ctx.fillStyle = debt ? '#ff5a4a' : st.color; ctx.fillText(name, cx + cr + 6 + w1 + 10, Y + .5);
    if (a.bet) { // 押注筹码
      const bx = x0 + w + 4 + k * .1;
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(bx, Y + h * .25 - i * k * .045); ctx.scale(1, .45); chip(ctx, 0, 0, k * .1, i % 2 ? '#ffd23f' : '#ff3f6f'); ctx.restore(); }
      ctx.font = font(R, fs * .85, 900); ctx.fillStyle = '#ff9ab0'; ctx.fillText('押 ×' + a.bet.odds, bx + k * .14, Y + .5);
    }
    ctx.restore();
    if (a.flash > 0 && a.delta) tag(R, ctx, (a.delta > 0 ? '+' : '') + a.delta, p.x + .7, p.y + 3.3 - (a.flash * .25), a.delta > 0 ? '#7dffb0' : '#ff7777', Math.min(1, a.flash * 2));
  }

  const FX = {
    // ---------------- 地面层（在选手和球网之前） ----------------
    ground(R, ctx, m, o, dt) {
      const t = R.time, sk = m.sk || {}, k = R.sc;
      // 规则：半场被改短（短场练习）时，标出原网位置
      if (sk.half) {
        if (Math.abs(sk.half[0] - sk.half[1]) > 0.05) {
          const g = -(R.netOff || 0); // 原来的球网位置
          const a = R.P(g, 0, -HW), b = R.P(g, C.NET_H, -HW), c = R.P(g, C.NET_H, HW), d = R.P(g, 0, HW);
          ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,210,63,0.55)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); ctx.restore();
          tag(R, ctx, '原网位置', 0, C.NET_H + 0.75, '#ffd23f');
        }
      }
      for (const e of m.ents) {
        const p = m.players[e.o], c = colOf(KIND_SKILL[e.k], '#ffd23f');
        switch (e.k) {
          case 'packet': { // 红包雨：从天上飘下，落地躺着，金光一闪一闪
            const fall = clamp(e.age / (e.fall || .45), 0, 1), y = (1 - fall * fall) * 3.4, fade = clamp(e.t / .35, 0, 1), sz = k * .2;
            const [X, Y] = W(R, e.x, y), landed = fall >= 1;
            ctx.save(); ctx.globalAlpha = fade;
            if (landed) { floorOval(R, ctx, e.x, .32, 'rgba(255,210,80,.18)', `rgba(255,220,120,${.35 + .25 * Math.sin(t * 6 + e.ph)})`, 1.5); }
            else floorOval(R, ctx, e.x, .18 * fall, 'rgba(0,0,0,.25)');
            ctx.translate(X, Y - (landed ? sz * .28 : 0));
            ctx.rotate(landed ? -.12 + Math.sin(t * 2 + e.ph) * .04 : Math.sin(t * 8 + e.ph) * .7);
            if (landed) ctx.scale(1, .62); // 平躺在地板上
            const w = sz * 1.0, h = sz * 1.36;
            const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#ff5a4a'); g.addColorStop(1, '#c4161c');
            YY.rr(ctx, -w / 2, -h / 2, w, h, sz * .14); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a0a10'; ctx.stroke();
            ctx.fillStyle = '#a80f18'; ctx.beginPath(); ctx.moveTo(-w / 2 + 1, -h / 2 + sz * .1); ctx.quadraticCurveTo(0, -h * .02, w / 2 - 1, -h / 2 + sz * .1); ctx.lineTo(w / 2 - 1, -h / 2 + 2); ctx.lineTo(-w / 2 + 1, -h / 2 + 2); ctx.fill();
            ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -h * .04, sz * .27, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#a80f18'; ctx.font = font(R, Math.max(8, sz * .36), 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¥', 0, -h * .03);
            ctx.restore();
            if (landed && (t * 3 + e.ph) % 1 < .12) { const [GX, GY] = W(R, e.x + .1, .18); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,170,.9)'; star(ctx, GX, GY, k * .07, 4, .25); ctx.fill(); ctx.restore(); }
            break;
          }
          case 'foot': { // 遗憾脚印
            const [X, Y] = W(R, e.x, 0), a = e.n >= 1 ? 0.75 + Math.sin(t * 5) * 0.2 : 0.35;
            ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c;
            for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X + s * k * 0.09, Y + s * k * 0.02, k * 0.06, k * 0.025, 0.2 * s, 0, TAU); ctx.fill(); }
            ctx.restore();
            if (e.n >= 1) tag(R, ctx, '+15', e.x, 0.35, c, a);
            break;
          }
          case 'drop': { // 水滴
            const [X, Y] = W(R, e.x, 0.12 + Math.sin(t * 3 + e.id) * 0.03), r = k * 0.07;
            floorOval(R, ctx, e.x, 0.12, 'rgba(92,200,255,0.25)');
            ctx.fillStyle = 'rgba(120,215,255,0.9)';
            ctx.beginPath(); ctx.moveTo(X, Y - r * 1.8); ctx.quadraticCurveTo(X + r * 1.1, Y - r * 0.2, X, Y + r); ctx.quadraticCurveTo(X - r * 1.1, Y - r * 0.2, X, Y - r * 1.8); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(X - r * 0.3, Y - r * 0.1, r * 0.25, 0, TAU); ctx.fill();
            break;
          }
          case 'sign': { // 签到表编号
            const [X, Y] = W(R, e.x, 0), r = k * 0.11;
            ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * (4 - (e.n || 1)) / 3;
            ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(X, Y, r * 1.3, r * 0.45, 0, 0, TAU); ctx.fill();
            ctx.font = font(R, k * 0.16, 900); ctx.fillStyle = '#0a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(e.n || 1), X, Y);
            ctx.restore();
            break;
          }
          case 'coin': { // 机会价金币
            const [X, Y] = W(R, e.x, 0.35 + Math.sin(t * 4) * 0.05), sq = Math.abs(Math.cos(t * 4)), r = k * 0.1;
            floorOval(R, ctx, e.x, 0.12, 'rgba(0,0,0,0.25)');
            ctx.fillStyle = e.got ? '#7dffb0' : '#ffd23f'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(X, Y, r * Math.max(0.15, sq), r, 0, 0, TAU); ctx.fill(); ctx.stroke();
            if (sq > 0.5) { ctx.fillStyle = '#b8860b'; ctx.font = font(R, k * 0.12, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¥', X, Y + 1); }
            if (e.got) tag(R, ctx, '回球兑现', e.x, 0.75, '#7dffb0');
            break;
          }
          case 'pool': { // 潮来：己方半场一层积水，波光粼粼；倒计时
            const H = m.sk && m.sk.half ? m.sk.half[e.o] : C.HALF, fade = clamp(e.t / 0.6, 0, 1) * clamp(e.age / 0.35, 0, 1), sd = p.side;
            ctx.save(); ctx.globalAlpha = fade;
            floorBand(R, ctx, sd * 0.08, sd * H, 'rgba(50,140,255,0.42)'); floorBand(R, ctx, sd * 0.08, sd * H, `rgba(170,230,255,${0.08 + 0.06 * Math.sin(t * 2.4)})`);
            for (let i = 0; i < 9; i++) { // 水面高光：一条条斜斜的波纹在移动
              const u = ((t * 0.18 + i / 9) % 1), x = sd * (0.3 + u * (H - 0.5)), z = -HW + ((i * 0.77) % 1) * HW * 2;
              const a1 = R.P(x - 0.35, 0, z), a2 = R.P(x + 0.35, 0, z + 0.12);
              ctx.strokeStyle = `rgba(200,240,255,${0.5 * Math.sin(u * Math.PI)})`; ctx.lineWidth = Math.max(1.5, k * 0.025);
              ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
            }
            floorLine(R, ctx, sd * H, 'rgba(150,220,255,0.6)', 2, [6, 5]);
            ctx.restore();
            timer(R, ctx, sd * H * 0.5, 0.55, 0.16, e.t / 8, '#7fd0ff');
            tag(R, ctx, '积水 ' + Math.ceil(e.t) + 's · 剩余 ' + (e.n ?? 2) + ' 次', sd * H * 0.5, 0.95, '#8fdcff', 0.9 * fade);
            break;
          }
          case 'ripplePool': { // 球落水：一圈圈涟漪
            const u = 1 - clamp(e.t / 0.8, 0, 1);
            for (let i = 0; i < 3; i++) { const q = clamp(u * 1.4 - i * 0.2, 0, 1); if (q <= 0) continue; floorOval(R, ctx, e.x, 0.15 + q * 0.75, null, `rgba(200,240,255,${(1 - q) * 0.9})`, 2.5); }
            break;
          }
          case 'ghost': { // 水中月：原落点的虚影
            const a = clamp(e.t / 1.6, 0, 1) * 0.7;
            floorOval(R, ctx, e.x, 0.3, null, `rgba(160,230,255,${a})`, 2);
            floorOval(R, ctx, e.x, 0.15, `rgba(160,230,255,${a * 0.4})`);
            tag(R, ctx, '虚影', e.x, 0.3, '#a8eaff', a);
            break;
          }
          case 'afterimg': { // 闪现起点
            const u = 1 - clamp(e.t / 0.5, 0, 1);
            floorOval(R, ctx, e.x, 0.2 + u * 0.5, null, `rgba(255,159,47,${1 - u})`, 3);
            break;
          }
          case 'cone': { // 标志桶
            const [X, Y] = W(R, e.x, 0), h = k * 0.48, w = k * 0.17, sh = 0;
            floorOval(R, ctx, e.x, 0.22, 'rgba(0,0,0,0.28)');
            ctx.save(); ctx.translate(X + sh, Y);
            ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.2, -h); ctx.lineTo(w * 0.2, -h); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffffff'; for (const f of [0.35, 0.65]) { const a0 = w * (1 - f * 0.8), a1 = w * (1 - (f + 0.1) * 0.8); ctx.beginPath(); ctx.moveTo(-a0, -h * f); ctx.lineTo(-a1, -h * (f + 0.1)); ctx.lineTo(a1, -h * (f + 0.1)); ctx.lineTo(a0, -h * f); ctx.closePath(); ctx.fill(); }
            ctx.fillStyle = '#d95d0f'; ctx.fillRect(-w * 1.25, -k * 0.03, w * 2.5, k * 0.04);
            ctx.restore();
            timer(R, ctx, e.x, 0.75, 0.14, e.t / 4.5, '#ff8f3a');
            tag(R, ctx, '标志桶 · 跳过去', e.x, 1.08, '#ff8f3a', 0.9);
            break;
          }
          case 'appoint': { // 预约的半场 + 投影脚下
            const H = m.sk && m.sk.half ? m.sk.half[e.o] : C.HALF, a = e.zone ? [0.2, 3.3] : [3.3, H];
            floorBand(R, ctx, p.side * a[0], p.side * a[1], `rgba(143,240,220,${e.armed ? 0.16 : 0.07})`);
            floorLine(R, ctx, p.side * 3.3, 'rgba(143,240,220,0.5)', 1.5, [5, 6]);
            floorOval(R, ctx, e.x, 0.42, 'rgba(143,240,220,0.15)', 'rgba(143,240,220,0.6)', 1.5);
            break;
          }
          case 'quake': { // 地板开球的震波
            const u = clamp(e.t / 1.6, 0, 1), [X, Y] = W(R, e.x, 0);
            floorOval(R, ctx, e.x, 0.45, `rgba(255,154,61,${0.3 * u})`, `rgba(255,224,170,${u})`, 3);
            ctx.save(); ctx.strokeStyle = `rgba(255,190,110,${u})`; ctx.lineWidth = Math.max(2, k * 0.03);
            for (let i = 0; i < 4; i++) { const dx = -Math.sign(e.v) * i * 0.22, [AX, AY] = W(R, e.x + dx, 0); ctx.beginPath(); ctx.moveTo(AX - k * 0.05, AY); ctx.lineTo(AX, AY - k * (0.18 - i * 0.03)); ctx.lineTo(AX + k * 0.05, AY); ctx.stroke(); }
            ctx.restore();
            if (!e.hit) tag(R, ctx, '震波 · 跳！', e.x, 0.6, '#ffb36a', u);
            break;
          }
          case 'peel': { // 香蕉皮：飞过去，落地后躺在那里
            const fly = e.fly > 0, u = fly ? 1 - e.fly / 0.55 : 1, x = fly ? e.x0 + (e.x - e.x0) * u : e.x, y = fly ? e.y : 0.02;
            if (!fly) floorOval(R, ctx, x, 0.2, 'rgba(0,0,0,0.2)');
            const [X, Y] = W(R, x, y), r = k * 0.13;
            ctx.save(); ctx.translate(X, Y); if (fly) ctx.rotate(R.time * 12);
            ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#8a6a12'; ctx.lineWidth = 1.2;
            for (const a of [-2.3, -1.57, -0.85]) { ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.45 + r * 0.25, r * 0.75, r * 0.26, a, 0, TAU); ctx.fill(); ctx.stroke(); }
            ctx.fillStyle = '#6b4a10'; ctx.fillRect(-r * 0.12, -r * 0.1, r * 0.24, r * 0.3);
            ctx.restore();
            if (!fly) tag(R, ctx, '香蕉皮', x, 0.4, '#ffd84a', 0.8);
            break;
          }
          case 'bug': { // Bug：贴地爬
            const [X, Y] = W(R, e.x, 0.06), r = k * 0.1, f = Math.sign((m.players[1 - e.o].x - e.x) || 1) * (R.mirror ? -1 : 1);
            floorOval(R, ctx, e.x, 0.16, 'rgba(0,0,0,0.25)');
            ctx.save(); ctx.translate(X, Y);
            ctx.strokeStyle = '#1b2a3a'; ctx.lineWidth = Math.max(1.5, k * 0.018);
            for (let i = -1; i <= 1; i++) for (const sg of [-1, 1]) { const w = Math.sin(R.time * 30 + i * 2 + sg) * r * 0.25; ctx.beginPath(); ctx.moveTo(i * r * 0.5, 0); ctx.lineTo(i * r * 0.5 + w, sg * r * 0.9); ctx.stroke(); }
            ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 1.0, r * 0.62, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#1b2a3a'; ctx.beginPath(); ctx.arc(f * r * 0.95, -r * 0.25, r * 0.38, 0, TAU); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = font(R, k * 0.08, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('404', -f * r * 0.1, -r * 0.2);
            ctx.restore();
            tag(R, ctx, 'BUG · 跳起来踩', e.x, 0.42, '#bfe8ff', 0.85);
            break;
          }

        }
      }
    },

    // ---------------- 球网层 ----------------
    net(R, ctx, m, o, dt) {
      const t = R.time, k = R.sc, sk = m.sk || {}, s = m.shuttle;
      // 防火墙：网上方的程序屏障
      if (sk.netUp > 0) {
        const a = clamp(sk.netUp / 0.3, 0, 1), top = C.NET_H + 0.9;
        const p0 = R.P(0, C.NET_H, -HW), p1 = R.P(0, top, -HW), p2 = R.P(0, top, HW), p3 = R.P(0, C.NET_H, HW);
        ctx.save(); ctx.globalAlpha = 0.85 * a;
        const g = ctx.createLinearGradient(0, p1[1], 0, p0[1]); g.addColorStop(0, 'rgba(79,224,255,0.05)'); g.addColorStop(1, 'rgba(79,224,255,0.35)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4fe0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
        ctx.font = font(R, k * 0.11, 700); ctx.fillStyle = 'rgba(180,245,255,0.7)'; ctx.textAlign = 'center';
        for (let i = 0; i < 6; i++) { const z = -HW + (i + 0.5) * HW / 3, y = C.NET_H + ((t * 0.8 + i * 0.37) % 1) * 0.85, q = R.P(0, y, z); ctx.fillText(i % 2 ? '01' : '10', q[0], q[1]); }
        ctx.restore();
        tag(R, ctx, '防火墙 · 挑高越墙', 0, top + 0.25, '#4fe0ff', a);
      }
      for (const e of m.ents) if (e.k === 'netTwang') { // 借网：网绳一弹
        const u = clamp(e.t / 0.5, 0, 1), a = R.P(0, C.NET_H, -HW), c2 = R.P(0, C.NET_H, HW), mid = R.P(0, C.NET_H + Math.sin(e.age * 40) * 0.25 * u, 0);
        ctx.save(); ctx.strokeStyle = `rgba(255,194,220,${u})`; ctx.lineWidth = Math.max(3, k * 0.06);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mid[0], mid[1], c2[0], c2[1]); ctx.stroke(); ctx.restore();
      }
      // 网带上的蝴蝶结
      for (const e of m.ents) if (e.k === 'bow') {
        const [X, Y] = R.P(0, C.NET_H, e.z || 0), r = k * 0.07;
        ctx.fillStyle = '#ff8fbf'; ctx.strokeStyle = '#c2457f'; ctx.lineWidth = 1;
        for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + sgn * r * 1.6, Y - r); ctx.lineTo(X + sgn * r * 1.6, Y + r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(X, Y, r * 0.45, 0, TAU); ctx.fill();
      }
      for (const p of m.players) {
        const b = p.buff || {};
        if (b.tangqiu > 0) { // 糖球挂网：网带变成糖浆
          const a = R.P(0, C.NET_H, -HW), c = R.P(0, C.NET_H, HW);
          ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6); ctx.strokeStyle = '#ff6fae'; ctx.lineWidth = Math.max(4, k * 0.07);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.restore();
          tag(R, ctx, '糖网 ' + b.tangqiu.toFixed(0) + 's', 0, C.NET_H + 0.4, '#ff6fae', 0.9);
        }
        if (b.jiewang > 0) { // 借网：网带被拉成弹弓
          const a = R.P(0, C.NET_H, -HW), c = R.P(0, C.NET_H, HW), mid = R.P(0, C.NET_H - 0.18 - 0.04 * Math.sin(t * 8), 0);
          ctx.strokeStyle = '#ffc2dc'; ctx.lineWidth = Math.max(3, k * 0.05);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mid[0], mid[1], c[0], c[1]); ctx.stroke();
          tag(R, ctx, '借网 ' + Math.ceil(b.jiewang) + 's · 贴网球会被弹', 0, C.NET_H + 0.4, '#ffc2dc', 0.9);
        }
      }
      // 挂网的球：糖浆包裹 + 滑落方向 + 倒计时
      const c = s.ctl;
      if (s.live && c && c.k === 'stick') {
        const [X, Y] = W(R, s.x, s.y);
        ctx.fillStyle = 'rgba(255,111,174,0.55)'; ctx.beginPath(); ctx.arc(X, Y, k * 0.16, 0, TAU); ctx.fill();
        const [AX] = W(R, c.side * 0.7, s.y);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, k * 0.04);
        ctx.beginPath(); ctx.moveTo(X, Y - k * 0.3); ctx.lineTo(AX, Y - k * 0.3); ctx.lineTo(AX - Math.sign(AX - X) * k * 0.12, Y - k * 0.42); ctx.moveTo(AX, Y - k * 0.3); ctx.lineTo(AX - Math.sign(AX - X) * k * 0.12, Y - k * 0.18); ctx.stroke();
        timer(R, ctx, s.x, s.y, 0.24, c.t / 1.0, '#ff6fae');
      }
    },

    // ---------------- 空中层（真球之前） ----------------
    air(R, ctx, m, o, dt) {
      const t = R.time, k = R.sc, s = m.shuttle;
      for (const e of m.ents) {
        const p = m.players[e.o], c = colOf(KIND_SKILL[e.k], '#ffd23f');
        switch (e.k) {
          case 'star': { // 夜空记事星点
            const [X, Y] = W(R, e.x, e.y), r = k * (0.09 + 0.02 * Math.sin(t * 4 + e.id));
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,226,122,0.85)'; star(ctx, X, Y, r, 4, 0.35); ctx.fill(); ctx.restore();
            break;
          }
          case 'firewall': {
            const [X,Y]=W(R,0,2.0); ctx.save();ctx.strokeStyle='#4fe0ff';ctx.fillStyle='rgba(40,170,220,.16)';ctx.lineWidth=2;
            ctx.fillRect(X-k*.22,Y-k*.6,k*.44,k*1.2);ctx.setLineDash([4,5]);ctx.strokeRect(X-k*.22,Y-k*.6,k*.44,k*1.2);ctx.restore();
            tag(R,ctx,'过滤 ×1 · '+Math.ceil(e.t)+'s',0,2.9,'#8fefff',.85);break;
          }
          case 'wind': { // 风口：一列流动的箭头
            const dir = Math.sign(e.push) * (R.mirror ? -1 : 1), [X] = W(R, e.x, 0);
            ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, k * 0.04); ctx.globalAlpha = 0.85;
            for (let i = 0; i < 6; i++) {
              const y = e.y - .7 + i * .28, Y = R.sy(y), off = ((t * 2.5 + i * 0.3) % 1 - 0.5) * k * 0.4 * dir;
              ctx.beginPath(); ctx.moveTo(X + off - dir * k * 0.12, Y - k * 0.1); ctx.lineTo(X + off + dir * k * 0.06, Y); ctx.lineTo(X + off - dir * k * 0.12, Y + k * 0.1); ctx.stroke();
            }
            ctx.restore();
            tag(R, ctx, e.used ? '风道助跑 · 已吹球' : (Math.sign(e.push) === Math.sign(p.dir) ? '风道 → 网 · 1次' : '风道 → 后场 · 1次'), e.x, e.y+1.2, c, 0.9);
            break;
          }
          case 'gust': { const [X, Y] = W(R, e.x, e.y); ctx.save(); ctx.globalAlpha = clamp(e.t / 0.5, 0, 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, k * (0.5 - e.t) * 1.2, 0, TAU); ctx.stroke(); ctx.restore(); break; }
          case 'board': { // 几何反射板：旋转的晶体棱镜；编号 = 弹射顺序，虚线 = 线路
            const mine = m.ents.filter(q => q.k === 'board' && q.o === e.o).sort((u, v) => u.id - v.id), idx = mine.indexOf(e), next = mine[idx + 1];
            const [X, Y] = W(R, e.x, e.y), r = k * 0.34, hot = e.hitT == null || m.time == null ? 0 : clamp(1 - (m.time - e.hitT) / .5, 0, 1);
            if (next) { // 线路：流动的箭头虚线
              const [NX, NY] = W(R, next.x, next.y);
              ctx.save(); ctx.strokeStyle = 'rgba(255,170,120,.55)'; ctx.lineWidth = Math.max(1.5, k * .025); ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 30;
              ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(NX, NY); ctx.stroke(); ctx.restore();
            }
            ctx.save(); ctx.translate(X, Y);
            ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (2 + hot)); gl.addColorStop(0, `rgba(255,140,80,${.32 + hot * .5})`); gl.addColorStop(1, 'rgba(255,140,80,0)');
            ctx.fillStyle = gl; ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
            ctx.globalCompositeOperation = 'source-over';
            ctx.rotate(t * .8 + e.id);
            const pts = [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6) * r, Math.sin(i * TAU / 6) * r * .78]);
            const fg = ctx.createLinearGradient(-r, -r, r, r); fg.addColorStop(0, 'rgba(255,236,220,.92)'); fg.addColorStop(.5, 'rgba(255,128,70,.78)'); fg.addColorStop(1, 'rgba(255,214,90,.9)');
            ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
            ctx.fillStyle = fg; ctx.fill(); ctx.lineWidth = Math.max(2, k * .03); ctx.strokeStyle = '#fff4ea'; ctx.stroke();
            ctx.strokeStyle = 'rgba(160,50,20,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); // 晶面
            for (const q of pts) { ctx.moveTo(0, 0); ctx.lineTo(q[0], q[1]); } ctx.stroke();
            ctx.rotate(-(t * .8 + e.id));
            ctx.fillStyle = '#3a1206'; ctx.font = font(R, Math.max(10, k * .2), 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(idx + 1), 0, 1);
            for (let i = 0; i < 2; i++) { ctx.fillStyle = i < e.n ? '#ffe0a0' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc((i - .5) * r * .5, r * 1.02, Math.max(2.2, k * .035), 0, TAU); ctx.fill(); }
            ctx.restore();
            if (idx === mine.length - 1) tag(R, ctx, mine.length > 1 ? '弹射线路 ×' + mine.length : '反射板', e.x, e.y + .7, c, .85);
            break;
          }
          case 'shards': {
            const u = clamp(e.t / 0.6, 0, 1);
            for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + e.id, d = (0.6 - e.t) * 1.8, [X, Y] = W(R, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d); ctx.save(); ctx.translate(X, Y); ctx.rotate(a + t * 6); ctx.fillStyle = i % 2 ? `rgba(255,216,196,${u})` : `rgba(255,150,80,${u})`; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0); ctx.fill(); ctx.restore(); }
            if (e.n) { const [X, Y] = W(R, e.x, e.y + .45 + (0.6 - e.t) * .6); ctx.save(); ctx.globalAlpha = u; ctx.font = font(R, Math.max(12, k * .2), 900); ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#3a1206'; ctx.strokeText('储能 ×' + e.n, X, Y); ctx.fillStyle = '#ffd9a0'; ctx.fillText('储能 ×' + e.n, X, Y); ctx.restore(); }
            break;
          }
          case 'whirl': { // 凌风的旋风：鱼跃卷起一股龙卷，踏风在脚下踩出一团
            if (!p) break;
            const life = e.big ? .75 : .6, u = clamp(e.t / life, 0, 1), grow = clamp(e.age / .14, 0, 1), base = e.big ? 0 : Math.max(0, p.y - .15);
            const H = e.big ? 2.0 : 1.4, cx = e.big ? p.x - (e.w || 0) * .25 : p.x;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            for (let i = 0; i < 8; i++) {
              const h = i / 7, yy = base + (e.big ? h : (1 - h)) * H * (e.big ? 1 : .55), rx = (e.big ? .2 + h * .62 : .62 - h * .38) * grow, sway = Math.sin(t * 7 + i) * .06;
              const [X, Y] = W(R, cx + sway + (e.big ? (e.w || 0) * h * .35 : 0), yy), a0 = t * (14 - i) + i * .9;
              ctx.strokeStyle = `rgba(255,${205 + i * 6},${175 + i * 9},${(.8 - h * .35) * u})`; ctx.lineWidth = Math.max(1.5, k * (.05 - h * .025));
              ctx.beginPath(); ctx.ellipse(X, Y, rx * k, rx * k * .3, 0, a0, a0 + TAU * .68); ctx.stroke();
            }
            ctx.restore();
            if (R.parts.length < 300 && Math.random() < .7 * u) {
              const a = Math.random() * TAU, rr = .3 + Math.random() * .5;
              R.add({ type: 'spark', x: cx + Math.cos(a) * rr, y: base + Math.random() * H * .8, vx: -Math.sin(a) * 3, vy: 1.2 + Math.random(), life: .4, t: 0, color: Math.random() < .5 ? '255,214,190' : '255,255,255', size: .03, g: 0, drag: 2 });
            }
            break;
          }
          case 'chips': { // 押注：一摞筹码从手里抛起，落进头顶的注码
            const u = 1 - clamp(e.t / 1, 0, 1);
            for (let i = 0; i < 6; i++) {
              const a = -Math.PI / 2 + (i - 2.5) * .35, d = Math.sin(u * Math.PI) * .9, [X, Y] = W(R, e.x + Math.cos(a) * d * .6, e.y - .6 + u * .6 + Math.sin(u * Math.PI) * (.6 + i * .08));
              ctx.save(); ctx.globalAlpha = 1 - u * .6; ctx.translate(X, Y); ctx.scale(1, Math.abs(Math.cos(t * 10 + i)) * .8 + .2);
              chip(ctx, 0, 0, k * .1, i % 2 ? '#ff3f6f' : '#ffd23f'); ctx.restore();
            }
            if (u < .7) { const [X, Y] = W(R, e.x, e.y + .5 + u * .4); ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = font(R, Math.max(14, k * .26), 900); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#3a0a14'; ctx.strokeText('×' + e.odds, X, Y); ctx.fillStyle = '#ffd23f'; ctx.fillText('×' + e.odds, X, Y); ctx.restore(); }
            break;
          }
          case 'jail': { // 负债入狱：铁栏“哐”地落下，再慢慢散去
            if (!p) break;
            const u = 1 - clamp(e.t / 1.2, 0, 1), drop = clamp(u / .18, 0, 1), fade = u < .6 ? 1 : 1 - (u - .6) / .4;
            ctx.save(); ctx.globalAlpha = fade;
            const top = 2.6 + (1 - drop * drop) * 3, [, YT] = W(R, p.x, top), [, YB] = W(R, p.x, Math.max(0, top - 2.6));
            for (let i = -2; i <= 2; i++) { const [X] = W(R, p.x + i * .22, 0); const g = ctx.createLinearGradient(X - 4, 0, X + 4, 0); g.addColorStop(0, '#5a606c'); g.addColorStop(.5, '#d6dbe4'); g.addColorStop(1, '#4a4f5a'); ctx.fillStyle = g; ctx.fillRect(X - k * .035, YT, k * .07, YB - YT); }
            const [XL] = W(R, p.x - .55, 0), [XR] = W(R, p.x + .55, 0);
            ctx.fillStyle = '#3b404a'; ctx.fillRect(Math.min(XL, XR), YT - k * .08, Math.abs(XR - XL), k * .1); ctx.fillRect(Math.min(XL, XR), YB - k * .06, Math.abs(XR - XL), k * .08);
            ctx.restore();
            break;
          }
          case 'moon': { // 月亮
            const [X, Y] = W(R, e.x, e.y), r = k * 0.3;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 2.4); g.addColorStop(0, 'rgba(255,243,168,0.5)'); g.addColorStop(1, 'rgba(255,243,168,0)');
            ctx.fillStyle = g; ctx.fillRect(X - r * 2.4, Y - r * 2.4, r * 4.8, r * 4.8); ctx.restore();
            ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(20,24,60,0.95)'; ctx.beginPath(); ctx.arc(X + r * 0.42 * (R.mirror ? -1 : 1) * p.dir, Y - r * 0.15, r * 0.85, 0, TAU); ctx.fill();
            if (s.ctl && s.ctl.k === 'orbit' && s.ctl.o === e.o) {
              const oc = s.ctl, turns = (oc.spun || 0) / TAU, heat = clamp(turns / 2.2, 0, 1);
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
              for (let i = 0; i < 3; i++) { // 越转越亮的月轨拖影
                const a1 = oc.a, a0 = a1 - Math.sign(oc.w) * (0.9 + heat * 1.6) * (1 - i * .25);
                ctx.strokeStyle = `rgba(255,${243 - heat * 60},${168 - heat * 90},${.55 - i * .15})`; ctx.lineWidth = Math.max(2, k * (.07 - i * .02));
                const sa = (q) => R.mirror ? Math.PI + q : -q; ctx.beginPath(); ctx.arc(X, Y, oc.r * k, Math.min(sa(a0), sa(a1)), Math.max(sa(a0), sa(a1))); ctx.stroke();
              }
              ctx.restore();
              ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,243,168,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, oc.r * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
              timer(R, ctx, e.x, e.y, 0.42, oc.t / 3.4, '#fff3a8');
              const sp = clamp(6 + (oc.spun || 0) * 1.25, 6, 24);
              tag(R, ctx, turns.toFixed(1) + ' 圈 · ' + Math.round(sp * 3.6) + ' km/h', e.x, e.y + oc.r + .55, heat > .7 ? '#ffb46a' : '#fff3a8', .95);
            }
            else tag(R, ctx, e.charged?'引力月亮 · 扩大捕获':'月亮 · 等球入轨', e.x, e.y + 0.6, c, 0.85);
            if(e.charged){ctx.save();ctx.strokeStyle='rgba(160,185,255,.5)';ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(X,Y,k*1.15,0,TAU);ctx.stroke();ctx.restore();}
            break;
          }
          case 'gate': { // 星门：入口在她拍前，出口在对手身后
            const [X, Y] = W(R, e.x, e.y), r = k * (e.pair ? 0.46 : 0.36);
            ctx.save(); ctx.translate(X, Y); ctx.rotate(t * 1.5 * (e.pair ? -1 : 1));
            ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = Math.max(2, k * 0.04);
            ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, TAU); ctx.stroke();
            ctx.fillStyle = 'rgba(120,80,255,0.25)'; ctx.fill();
            for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; ctx.fillStyle = '#fff'; star(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.75, k * 0.05, 4, 0.4); ctx.fill(); }
            ctx.restore();
            const other = m.ents.find(g => g.k === 'gate' && g.o === e.o && g !== e);
            if (other && e.pair === 0) { const [OX, OY] = W(R, other.x, other.y); ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = 'rgba(201,168,255,0.45)'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(OX, OY); ctx.stroke(); ctx.restore(); }
            if (e.pair) tag(R, ctx, e.charged?'星坠出口':'星门出口', e.x, e.y + 0.65, e.charged?'#fff3a8':'#c9a8ff', 0.9);
            break;
          }
          case 'gale': { // 鱼跃挂起的风：整片场地的风线
            const u = clamp(e.t / 0.6, 0, 1) * clamp(e.age / 0.3, 0, 1), d = Math.sign(e.w) || 1;
            ctx.save(); ctx.strokeStyle = `rgba(255,220,200,${0.45 * u})`; ctx.lineWidth = Math.max(1.5, k * 0.02); ctx.lineCap = 'round';
            for (let i = 0; i < 14; i++) {
              const y = 0.6 + (i * 0.37) % 4.2, z = -HW + (i * 1.13) % (HW * 2), x = -7 + ((t * 5 * d + i * 1.9) % 14 + 14) % 14;
              const a = R.P(x, y, z), b = R.P(x - d * 0.9, y + Math.sin(t * 3 + i) * 0.08, z);
              ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            }
            ctx.restore();
            tag(R, ctx, (d * (R.mirror ? -1 : 1) > 0 ? '风 →' : '← 风') + ' ' + Math.ceil(e.t) + 's', 0, 4.6, '#ffd0a8', u);
            break;
          }
          case 'gateFlash': { const [X, Y] = W(R, e.x, e.y); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(201,168,255,${clamp(e.t / 0.5, 0, 1) * 0.7})`; ctx.beginPath(); ctx.arc(X, Y, k * 0.5 * (1.2 - e.t), 0, TAU); ctx.fill(); ctx.restore(); break; }
          case 'pole': { // 伸缩长拍：伸长的拍杆 + 拍头
            const [HX, HY] = W(R, p.x + p.dir * 0.25, p.y + 1.35), [X, Y] = W(R, e.x, e.y), ang = Math.atan2(Y - HY, X - HX);
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = '#d9fff0'; ctx.lineWidth = Math.max(2, k * 0.03); ctx.beginPath(); ctx.moveTo(HX, HY); ctx.lineTo(X, Y); ctx.stroke();
            ctx.strokeStyle = '#2fd38a'; ctx.lineWidth = Math.max(3, k * 0.045); // 伸缩节
            for (let i = 1; i < 4; i++) { const u = i / 4, x = HX + (X - HX) * u, y = HY + (Y - HY) * u; ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 3, y - Math.sin(ang) * 3); ctx.lineTo(x + Math.cos(ang) * 3, y + Math.sin(ang) * 3); ctx.stroke(); }
            ctx.restore();
            racketHead(ctx, X, Y, ang, k, e.ph === 1 ? '#ffffff' : c, e.ph === 1);
            if (e.ph === 0 && (o && o.landHint || []).includes(e.o)) tag(R, ctx, '再按：拍头击球', e.x, e.y + 0.45, c, 0.9);
            break;
          }
          case 'spin': { // 双头旋拍：两只拍头绕身体转一圈，身后拖出扫过的轨迹
            const cy = p.y + 1.25, ph = e.ph0 + e.w * (e.age || 0), at = (a) => W(R, p.x + p.dir * e.r * Math.cos(a), cy + e.r * Math.sin(a));
            const [CX, CY] = W(R, p.x, cy);
            ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(125,255,207,0.45)'; ctx.lineWidth = 2; ctx.beginPath();
            for (let i = 0; i <= 24; i++) { const [X, Y] = at(i / 24 * TAU); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); ctx.restore();
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(125,255,207,0.3)'; ctx.lineWidth = k * 0.12; ctx.lineCap = 'round';
            for (const d of [0, Math.PI]) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const [X, Y] = at(ph + d - Math.sign(e.w) * i * 0.15); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); }
            ctx.restore();
            const ends = [0, Math.PI].map(d => at(ph + d));
            ctx.save(); ctx.strokeStyle = '#e8fff7'; ctx.lineWidth = Math.max(2, k * 0.035); ctx.beginPath(); ctx.moveTo(ends[0][0], ends[0][1]); ctx.lineTo(ends[1][0], ends[1][1]); ctx.stroke(); ctx.restore();
            ends.forEach(([X, Y], i) => racketHead(ctx, X, Y, Math.atan2(Y - CY, X - CX), k, e.hit && e.hit.k === i ? '#ffffff' : c, !!(e.hit && e.hit.k === i)));
            break;
          }
          case 'yoyo': { // 悠悠球拍：球线 + 旋转的拍头
            const [HX, HY] = W(R, p.x + p.dir * 0.2, p.y + 1.5), [X, Y] = W(R, e.x, e.y);
            ctx.save(); ctx.strokeStyle = 'rgba(232,255,247,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(HX, HY); ctx.lineTo(X, Y); ctx.stroke(); ctx.restore();
            racketHead(ctx, X, Y, (R.time || 0) * (e.ph === 2 ? -16 : 16), k, c, false);
            if (e.ph < 2 && (o && o.landHint || []).includes(e.o)) tag(R, ctx, '再按：拉回', e.x, e.y + 0.45, c, 0.85);
            break;
          }
          case 'wokArc': { // 回锅再炒：折返的弧线
            ctx.save(); ctx.strokeStyle = `rgba(255,106,61,${clamp(e.t / 0.4, 0, 1) * 0.85})`; ctx.lineWidth = Math.max(2, k * 0.04); ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 50;
            ctx.beginPath(); e.pts.forEach((q, i) => { const [X, Y] = W(R, q[0], q[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); ctx.restore();
            break;
          }
          case 'crumbs': { // 包子皮碎开
            const u = 1 - clamp(e.t / 0.7, 0, 1), [X, Y] = W(R, e.x, e.y);
            ctx.save(); ctx.globalAlpha = 1 - u;
            for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + e.id, d = k * (0.15 + u * 0.7); ctx.fillStyle = i % 3 ? '#fff4e0' : '#e8cfa8'; ctx.beginPath(); ctx.ellipse(X + Math.cos(a) * d, Y + Math.sin(a) * d + u * u * k * 0.5, k * 0.07, k * 0.05, a, 0, TAU); ctx.fill(); }
            ctx.restore();
            break;
          }
          case 'fake': { // 镜像假球：和真球一模一样（拖尾、落点提示都有），下落到 1 米高时碎成水花
            const tr = fakeTrail(R, e), sp = Math.hypot(e.vx, e.vy);
            if (tr.length > 2) R.drawTrail(ctx, tr, e.kind, false);
            R.drawShuttle(ctx, { x: e.x, y: Math.max(0.07, e.y), vx: e.vx, vy: e.vy, live: true, speed: sp, shot: e.kind });
            break;
          }
          case 'splash': { // 水花
            const u = 1 - clamp(e.t / 0.6, 0, 1), [X, Y] = W(R, e.x, e.y);
            ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#bff0ff';
            for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, d = k * (0.1 + u * 0.45); ctx.beginPath(); ctx.arc(X + Math.cos(a) * d, Y + Math.sin(a) * d * 0.7 - u * k * 0.15, k * 0.035 * (1 - u * 0.5), 0, TAU); ctx.fill(); }
            ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(X, Y, k * (0.1 + u * 0.5), k * (0.05 + u * 0.18), 0, 0, TAU); ctx.stroke();
            ctx.restore();
            break;
          }
          case 'coins': { // 套牢：金币四散
            const u = 1 - clamp(e.t / 0.9, 0, 1);
            ctx.save(); ctx.globalAlpha = 1 - u * 0.8;
            for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.3, d = u * 1.1, [X, Y] = W(R, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.8 - u * u * 0.8); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b8860b'; ctx.beginPath(); ctx.ellipse(X, Y, k * 0.05 * Math.abs(Math.cos(t * 9 + i)), k * 0.05, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
            ctx.restore();
            break;
          }
          case 'afterimg': ghostOf(R, ctx, m, p, e.x, e.y, clamp(e.t / 0.5, 0, 1) * 0.5, '#ffb347'); break;
          case 'vine': { // 荡藤：从高处垂下的藤蔓
            const [AX, AY] = W(R, e.x, e.y), cut = !!e.cut || !(p.buff && p.buff.vine > 0);
            const hx = cut ? e.x : p.x, hy = cut ? e.y - 1.2 * clamp(e.t / 0.35, 0, 1) : p.y + 1.9, [HX, HY] = W(R, hx, hy);
            ctx.save(); ctx.strokeStyle = '#5c8a2e'; ctx.lineWidth = Math.max(3, k * 0.05); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(AX, AY - k * 1.2); ctx.lineTo(AX, AY); ctx.quadraticCurveTo((AX + HX) / 2 + Math.sin(t * 7) * 3, (AY + HY) / 2, HX, HY); ctx.stroke();
            ctx.fillStyle = '#7dd35a';
            for (let i = 1; i <= 4; i++) { const f = i / 5, X = AX + (HX - AX) * f, Y = AY + (HY - AY) * f; ctx.beginPath(); ctx.ellipse(X + (i % 2 ? 5 : -5), Y, k * 0.07, k * 0.035, i % 2 ? 0.6 : -0.6, 0, TAU); ctx.fill(); }
            ctx.restore();
            if (!cut) tag(R, ctx, '荡藤 · 再按松手', e.x, e.y + 0.25, '#7dd35a', 0.85);
            break;
          }
          case 'mini': { // 毫毛小猴
            const hop = e.hop > 0 ? Math.sin(clamp(1 - e.hop / 0.6, 0, 1) * Math.PI) * 1.1 : Math.abs(Math.sin(t * 7)) * 0.08;
            const [X, Y] = W(R, e.x, hop), r = k * 0.25, f = (R.mirror ? -1 : 1) * p.dir;
            floorOval(R, ctx, e.x, 0.26, 'rgba(0,0,0,0.25)');
            ctx.save(); ctx.translate(X, Y);
            ctx.strokeStyle = '#9c5416'; ctx.lineWidth = Math.max(2, k * 0.03); ctx.beginPath(); ctx.moveTo(-f * r * 0.6, -r * 0.6); ctx.quadraticCurveTo(-f * r * 1.8, -r * 0.4, -f * r * 1.4, -r * 1.6); ctx.stroke(); // 尾巴
            ctx.fillStyle = '#d9822b'; ctx.beginPath(); ctx.ellipse(0, -r * 0.8, r * 0.7, r * 0.85, 0, 0, TAU); ctx.fill(); // 身子
            ctx.beginPath(); ctx.arc(0, -r * 2.0, r * 0.62, 0, TAU); ctx.fill(); // 头
            for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(s2 * r * 0.66, -r * 2.05, r * 0.24, 0, TAU); ctx.fill(); }
            ctx.fillStyle = '#e8b78e'; ctx.beginPath(); ctx.ellipse(f * r * 0.15, -r * 1.9, r * 0.38, r * 0.32, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#24160c'; for (const s2 of [-0.18, 0.18]) { ctx.beginPath(); ctx.arc(f * r * 0.15 + s2 * r, -r * 2.05, r * 0.07, 0, TAU); ctx.fill(); }
            ctx.strokeStyle = '#ff9d2e'; ctx.lineWidth = Math.max(2, k * 0.025); ctx.beginPath(); ctx.moveTo(f * r * 0.5, -r * 1.0); ctx.lineTo(f * r * 1.2, -r * (e.hop ? 2.6 : 1.9)); ctx.stroke(); // 小球拍
            ctx.beginPath(); ctx.ellipse(f * r * 1.25, -r * (e.hop ? 2.85 : 2.15), r * 0.22, r * 0.3, 0, 0, TAU); ctx.stroke();
            ctx.restore();
            if (e.n > 0) { timer(R, ctx, e.x, 1.45, 0.14, e.t / 7, '#ffcf5a'); tag(R, ctx, e.warm>0?'准备协防…':'守场 · 剩余 1 次', e.x, 1.8, '#ffcf5a', 0.9); }
            break;
          }
          case 'shadow': ghostOf(R, ctx, m, p, e.x, e.y, clamp(e.t / 0.55, 0, 1) * 0.38, '#9ff0ff'); break;
          case 'ribbon': { // 冉冉的红丝带：一条飘动的缎带，头上一个蝴蝶结
            const ox = e.ox ?? p.x + p.dir * 0.3, oy = e.oy ?? p.y + 1.45, [AX, AY] = W(R, ox, oy), [X, Y] = W(R, e.x, e.y);
            const L = Math.hypot(X - AX, Y - AY) || 1, nx = -(Y - AY) / L, ny = (X - AX) / L;
            ctx.save(); ctx.lineCap = 'round';
            for (const [w, col] of [[k * 0.09, 'rgba(255,77,122,0.25)'], [k * 0.045, '#ff4d7a'], [k * 0.015, '#ffc2d4']]) {
              ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, w); ctx.beginPath();
              for (let i = 0; i <= 14; i++) { const u = i / 14, wv = Math.sin(u * 9 - t * 14) * k * 0.08 * Math.sin(u * Math.PI); const x = AX + (X - AX) * u + nx * wv, y = AY + (Y - AY) * u + ny * wv; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
              ctx.stroke();
            }
            ctx.fillStyle = '#ff4d7a'; ctx.strokeStyle = '#fff0f4'; ctx.lineWidth = 1.2; // 蝴蝶结
            for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + sg * k * 0.14, Y - k * 0.08); ctx.lineTo(X + sg * k * 0.14, Y + k * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            ctx.beginPath(); ctx.arc(X, Y, k * 0.04, 0, TAU); ctx.fill();
            ctx.restore();
            if (e.ph === 1 && s.ctl && s.ctl.k === 'tether') {
              timer(R, ctx, s.x, s.y, 0.24, s.ctl.t / 1.6, '#ff4d7a');
              if ((o && o.landHint || []).includes(e.o)) tag(R, ctx, '拖动再按：选方向甩出', s.x, s.y + 0.55, '#ff8fb0', 0.95);
              else tag(R, ctx, '红丝牵住了', s.x, s.y + 0.55, '#ff8fb0', 0.9);
            }
            break;
          }
          case 'bunFly': { // 飞行中的大肉包
            const [X, Y] = W(R, e.x, e.y), r = k * 0.3;
            ctx.save(); ctx.translate(X, Y); ctx.rotate(e.age * 7 * (p.dir * (R.mirror ? -1 : 1)));
            bunDraw(ctx, r);
            ctx.restore();
            if (R.parts.length < 300 && Math.random() < .5) R.add({ type: 'spark', x: e.x, y: e.y, vx: -e.vx * .1, vy: .8, life: .5, t: 0, color: '255,250,240', size: .05, g: -1, drag: 2 });
            break;
          }
          case 'wall': { // 地板开球的临时墙：砖墙 + 蒸汽管，撞过一次就碎
            const fade = clamp(e.t / 0.3, 0, 1) * clamp(e.age / 0.15, 0, 1), hit = e.hitT != null;
            ctx.save(); ctx.globalAlpha = fade * (hit ? 0.55 : 0.9);
            if (e.v) { // 竖墙：沿纵深立起来
              const a = R.P(e.x, 0, -HW * .7), b2 = R.P(e.x, e.y1 * .82, -HW * .7), c2 = R.P(e.x, e.y1 * .82, HW * .7), d = R.P(e.x, 0, HW * .7);
              const g = ctx.createLinearGradient(a[0], b2[1], a[0], a[1]); g.addColorStop(0, 'rgba(255,170,90,0.12)'); g.addColorStop(1, 'rgba(255,154,61,0.42)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = '#ffd2a0'; ctx.lineWidth = Math.max(2, k * 0.035); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,220,180,0.45)'; ctx.lineWidth = 1;
              for (let i = 1; i < 6; i++) { const yy = e.y1 * .82 * i / 6, l = R.P(e.x, yy, -HW * .7), r2 = R.P(e.x, yy, HW * .7); ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke(); }
              tag(R, ctx, hit ? '后墙 · 碎了' : '后墙', e.x, e.y1 * .82 + 0.25, '#ffb36a', fade);
            } else { // 横墙：头顶的一块天花板
              const a = R.P(e.x0, e.y, -HW * .7), b2 = R.P(e.x1, e.y, -HW * .7), c2 = R.P(e.x1, e.y, HW * .7), d = R.P(e.x0, e.y, HW * .7);
              ctx.fillStyle = 'rgba(255,154,61,0.26)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = '#ffd2a0'; ctx.lineWidth = Math.max(2, k * 0.035); ctx.stroke();
              tag(R, ctx, hit ? '顶墙 · 碎了' : '顶墙', e.x, e.y + 0.3, '#ffb36a', fade);
            }
            ctx.restore();
            break;
          }
          case 'steam': { // 每弹一次喷一团蒸汽
            const u = 1 - clamp(e.t / 0.8, 0, 1), n = e.big ? 10 : 7;
            ctx.save(); ctx.globalAlpha = (1 - u) * 0.85;
            for (let i = 0; i < n; i++) { const a = i / n * TAU + e.id, d = u * (e.big ? 1.1 : 0.75), [X, Y] = W(R, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6 + u * 0.6); ctx.fillStyle = i % 2 ? '#ffffff' : '#ffe9d2'; ctx.beginPath(); ctx.arc(X, Y, k * (0.08 + u * 0.12), 0, TAU); ctx.fill(); }
            ctx.restore();
            if (e.n) tag(R, ctx, '×' + e.n + ' 加速', e.x, e.y + 0.5, '#ffb36a', 1 - u);
            break;
          }
          case 'guide': { // 辅助线：量角器 + 一条长长的虚线（对手也看得见）
            const pl = p, ox = pl.x + pl.dir * 0.6, oy = pl.y + C.SHOULDER + 0.2, a = e.auto ? null : e.a, len = 5.5;
            const ex = a == null ? ox + pl.dir * len : ox + Math.cos(a) * len * pl.dir, ey = a == null ? oy : Math.max(0, oy + Math.sin(a) * len);
            const [X, Y] = W(R, ox, oy), [EX, EY] = W(R, ex, ey);
            ctx.save(); ctx.globalAlpha = 0.85 * clamp(e.t / 0.5, 0, 1); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, k * 0.03); ctx.setLineDash(a == null ? [3, 9] : [10, 6]); ctx.lineDashOffset = -t * 30;
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(EX, EY); ctx.stroke(); ctx.setLineDash([]);
            const rr = k * 0.42, base = (pl.dir * (R.mirror ? -1 : 1)) > 0 ? 0 : Math.PI; // 量角器半圆
            ctx.strokeStyle = 'rgba(255,210,63,0.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, rr, base - Math.PI / 2, base + Math.PI / 2, base !== 0); ctx.stroke();
            for (let d = -60; d <= 60; d += 15) { const q = base === 0 ? -d * Math.PI / 180 : Math.PI + d * Math.PI / 180; ctx.beginPath(); ctx.moveTo(X + Math.cos(q) * rr * .82, Y + Math.sin(q) * rr * .82); ctx.lineTo(X + Math.cos(q) * rr, Y + Math.sin(q) * rr); ctx.stroke(); }
            ctx.restore();
            tag(R, ctx, a == null ? '辅助线 · 自动' : '辅助线 ' + Math.round(a * 180 / Math.PI) + '°', ox, oy + 0.75, '#ffd23f', 0.9);
            break;
          }
          case 'lineFlash': { // 沿辅助线射出的一道光
            const u = clamp(e.t / 0.7, 0, 1), [X, Y] = W(R, e.x, e.y), [EX, EY] = W(R, e.x + Math.cos(e.a) * 4 * e.d, e.y + Math.sin(e.a) * 4);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,220,90,${u})`; ctx.lineWidth = Math.max(2, k * 0.08 * u); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(EX, EY); ctx.stroke(); ctx.restore();
            break;
          }
          case 'pane': { // 冻结窗格：带表格线的冰窗；冻住球后结霜
            const h = e.half || 0.62, [X0, Y0] = W(R, e.x - h, e.y + h), [X1, Y1] = W(R, e.x + h, e.y - h);
            const x0 = Math.min(X0, X1), y0 = Math.min(Y0, Y1), w = Math.abs(X1 - X0), hh = Math.abs(Y1 - Y0), held = s.ctl && s.ctl.k === 'freeze' && s.ctl.e === e.id;
            const fade = clamp(e.t / 0.3, 0, 1) * clamp(e.age / 0.2, 0, 1);
            ctx.save(); ctx.globalAlpha = fade;
            const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + hh); g.addColorStop(0, 'rgba(210,245,255,0.38)'); g.addColorStop(1, 'rgba(120,200,255,0.18)');
            ctx.fillStyle = g; YY.rr(ctx, x0, y0, w, hh, k * 0.06); ctx.fill();
            ctx.strokeStyle = held ? '#ffffff' : '#bfefff'; ctx.lineWidth = Math.max(2, k * 0.03); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; // 表格线
            for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x0 + w * i / 3, y0); ctx.lineTo(x0 + w * i / 3, y0 + hh); ctx.moveTo(x0, y0 + hh * i / 3); ctx.lineTo(x0 + w, y0 + hh * i / 3); ctx.stroke(); }
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + w * .12, y0 + hh * .3); ctx.lineTo(x0 + w * .3, y0 + hh * .12); ctx.stroke(); // 冰面反光
            ctx.restore();
            if (held) { timer(R, ctx, s.x, s.y, 0.3, s.ctl.t / 1.2, '#dff7ff'); tag(R, ctx, s.ctl.thaw ? '即将解冻！' : (o && o.landHint || []).includes(e.o) ? '冻住 · 再按解冻' : '冻住了', e.x, e.y + h + 0.3, '#bfefff', 0.95); }
            else if (!e.used) { timer(R, ctx, e.x + h * .75, e.y + h * .75, 0.11, e.t / 7, '#bfefff'); tag(R, ctx, e.age<(e.warm??.25)?'冰窗准备中':'冻结窗格', e.x, e.y + h + 0.3, '#bfefff', 0.85 * fade); }
            break;
          }
          case 'iceShard': { // 解冻：冰渣四溅
            const u = 1 - clamp(e.t / 0.6, 0, 1);
            ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = '#e8fbff';
            for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .4, d = u * 0.8, [X, Y] = W(R, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - u * u * .5); ctx.save(); ctx.translate(X, Y); ctx.rotate(a + u * 6); ctx.fillRect(-k * .04, -k * .015, k * .08, k * .03); ctx.restore(); }
            ctx.restore();
            break;
          }
          case 'replace': { // 查找替换：对手头顶挂着 Ctrl+H
            const fade = clamp(e.t / 0.4, 0, 1), [X, Y] = W(R, e.x, e.y + 0.15), fs = Math.max(10, k * 0.14);
            ctx.save(); ctx.globalAlpha = fade; ctx.font = font(R, fs, 900);
            const txt = (e.age<.3?'准备中 · ':'') + 'Ctrl+H  进攻 → ' + (e.mode ? '网前' : '高球'), tw = ctx.measureText(txt).width, h = fs + 10;
            ctx.fillStyle = 'rgba(4,40,36,0.85)'; YY.rr(ctx, X - tw / 2 - 10, Y - h / 2, tw + 20, h, 6); ctx.fill();
            ctx.strokeStyle = '#4fd8c0'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#b9fff0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, X, Y + .5);
            ctx.restore();
            break;
          }
          case 'replaceHit': { // 替换成功：划掉原球路，写上新球路
            const u = 1 - clamp(e.t / 1.2, 0, 1);
            tag(R, ctx, e.from + ' → ' + e.to, e.x, e.y + u * 0.6, '#4fd8c0', 1 - u * u);
            const [X, Y] = W(R, e.x, e.y + u * 0.6); ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - k * .55, Y); ctx.lineTo(X - k * .05, Y); ctx.stroke(); ctx.restore();
            break;
          }
          case 'appoint': {
            ghostOf(R, ctx, m, p, e.x, 0, 0.45, '#8ff0dc');
            timer(R, ctx, e.x, 2.1, 0.18, e.t / 8, '#8ff0dc');
            tag(R, ctx, (e.zone ? '预约：网前' : '预约：后场') + (e.armed ? ' · 出动' : ''), e.x, 2.55, '#8ff0dc', 0.9);
            break;
          }
          case 'appointGo': ghostOf(R, ctx, m, p, e.x, 0, clamp(e.t / 0.35, 0, 1) * 0.6, '#8ff0dc', { swing: { t: 0.35 - e.t, dur: 0.3, kind: 'over', btn: 'clear' } }); break;
          case 'ring': { const [X, Y] = W(R, e.x, e.y), u = 1 - e.t / 0.45; ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffd0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(X, Y, k * (0.25 + u * 0.5), k * (0.08 + u * 0.12), 0, 0, TAU); ctx.stroke(); ctx.restore(); break; }
          case 'rewind': { // 回潮：倒流的原路
            ctx.save(); ctx.strokeStyle = `rgba(47,224,255,${clamp(e.t / 0.5, 0, 1) * 0.8})`; ctx.lineWidth = Math.max(2, k * 0.035); ctx.setLineDash([3, 7]); ctx.lineDashOffset = -t * 40;
            ctx.beginPath(); e.pts.forEach((q, i) => { const [X, Y] = W(R, q[0], q[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); ctx.restore();
            if (s.live && s.ctl && s.ctl.k === 'rewind') tag(R, ctx, '倒流中 · 随时会放下', s.x, s.y + 0.45, '#2fe0ff', 0.9);
            break;
          }
          case 'ripple': { // 水中月：水纹预警（还没变轨）
            const [X, Y] = W(R, e.x, e.y);
            ctx.save(); ctx.strokeStyle = '#a8eaff'; ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) { const u = (e.age * 2.2 + i / 3) % 1; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.ellipse(X, Y, k * (0.15 + u * 0.5), k * (0.08 + u * 0.25), 0, 0, TAU); ctx.stroke(); }
            ctx.restore();
            tag(R, ctx, '水中月', e.x, e.y + 0.45, '#5fd0ff', 0.8);
            break;
          }
        }
      }
      // 牵引中的红丝带、哨停的球
      const c = s.ctl;
      if (s.live && c && c.k === 'tether' && !m.ents.some(e => e.k === 'ribbon' && e.o === c.o)) { // 好友端没有丝带装置时的兜底
        const p = m.players[c.o], [HX, HY] = W(R, p.x + p.dir * 0.3, p.y + 1.5), [X, Y] = W(R, s.x, s.y);
        ctx.strokeStyle = '#ff4d7a'; ctx.lineWidth = Math.max(2, k * 0.03);
        ctx.beginPath(); ctx.moveTo(HX, HY); ctx.quadraticCurveTo((HX + X) / 2, Math.max(HY, Y) + k * 0.2 + Math.sin(t * 9) * 4, X, Y); ctx.stroke();
      }
      if (s.live && c && c.k === 'warp') { // 星门穿越：球在出口里打转，出口越来越亮
        const [X, Y] = W(R, s.x, s.y), u = 1 - clamp(c.t / 0.35, 0, 1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, k * (0.4 + u * 0.4)); g.addColorStop(0, `rgba(255,255,255,${0.5 + u * 0.4})`); g.addColorStop(1, 'rgba(160,120,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, k * (0.4 + u * 0.4), 0, TAU); ctx.fill(); ctx.restore();
        tag(R, ctx, '穿越中…', s.x, s.y + 0.7, '#c9a8ff', 0.95);
      }
      if (s.live && c && c.k === 'freeze') { // 冻住的球：冰块
        const [X, Y] = W(R, s.x, s.y), r = k * 0.2;
        ctx.save(); ctx.fillStyle = 'rgba(220,248,255,0.55)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, rr = r * (i % 2 ? .85 : 1.1); i ? ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr) : ctx.moveTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (s.live && s.grav && !c) { // 重力球：紫色光晕 + 绕球转的小星；重力翻转时变金色、火花往上飘
        const flip = !!(m.players[s.grav.o] && m.players[s.grav.o].buff && m.players[s.grav.o].buff.gravOn > 0);
        const [X, Y] = W(R, s.x, s.y), r = k * (flip ? 0.28 : 0.24);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 1.8);
        g.addColorStop(0, flip ? 'rgba(255,226,140,0.8)' : 'rgba(170,150,255,0.7)'); g.addColorStop(1, flip ? 'rgba(255,170,90,0)' : 'rgba(120,90,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 1.8, 0, TAU); ctx.fill();
        ctx.fillStyle = flip ? '#fff3c4' : '#e4dcff'; for (let i = 0; i < 3; i++) { const a = t * (flip ? -10 : 8) + i * TAU / 3; star(ctx, X + Math.cos(a) * r, Y + Math.sin(a) * r * .6, k * .045, 4, .45); ctx.fill(); }
        if (flip) { // 头顶一枚向上的小箭头：重力翻转中
          const ay = Y - r * 2.1 - Math.sin(t * 9) * k * .04; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(X - k * .07, ay + k * .06); ctx.lineTo(X, ay); ctx.lineTo(X + k * .07, ay + k * .06); ctx.stroke();
        }
        ctx.restore();
        if (R.parts.length < 300 && Math.random() < .5) R.add({ type: 'spark', x: s.x, y: s.y, vx: -s.vx * .08, vy: flip ? 1.4 : -1.2, life: .45, t: 0, color: flip ? '255,220,140' : '175,160,255', size: .04, g: flip ? -3 : 3, drag: 1 });
      }
      if (s.live && s.tide != null && !c) { // 浪涌球：拖着水花
        if (R.parts.length < 300 && Math.random() < .7) R.add({ type: 'spark', x: s.x, y: s.y, vx: -s.vx * .1 + (Math.random() - .5), vy: Math.random() * .8, life: .45, t: 0, color: '150,220,255', size: .05, g: 5, drag: 1 });
      }
      if (s.live && s.slam && !c) { // 地板球：一路冒蒸汽
        if (R.parts.length < 300 && Math.random() < .8) R.add({ type: 'spark', x: s.x, y: s.y, vx: -s.vx * .06, vy: .6, life: .5, t: 0, color: '255,240,225', size: .07, g: -1.5, drag: 2 });
      }
      if (s.live && c && c.k === 'cradle') { // 停一下：球停在拍面上
        const [X, Y] = W(R, s.x, s.y);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(184,255,208,0.35)'; ctx.beginPath(); ctx.arc(X, Y, k * 0.2, 0, TAU); ctx.fill(); ctx.restore();
        timer(R, ctx, s.x, s.y, 0.26, c.t / 1.0, '#b8ffd0');
        tag(R, ctx, '持球 · 看站位', s.x, s.y + 0.6, '#b8ffd0', 0.9);
      }
      if (s.live && s.gust && !c) { // 疾风球：旋风
        const [X, Y] = W(R, s.x, s.y);
        ctx.save(); ctx.translate(X, Y); ctx.strokeStyle = 'rgba(255,208,168,0.85)'; ctx.lineWidth = Math.max(2, k * 0.03);
        for (let i = 0; i < 3; i++) { ctx.rotate(t * 14 + i * 2.1); ctx.beginPath(); ctx.arc(0, 0, k * (0.16 + i * 0.07), 0, TAU * 0.55); ctx.stroke(); }
        ctx.restore();
        if (R.parts.length < 300 && Math.random() < 0.6) R.add({ type: 'spark', x: s.x, y: s.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 0.35, t: 0, color: '255,208,168', size: 0.035, g: 0, drag: 2 });
      }
      if (s.live && s.monkey && !c) tag(R, ctx, '猴毛球', s.x, s.y + 0.4, '#ffcf5a', 0.8);
      if (s.live && s.wok && !s.wok.used) { // 回锅再炒：球上明显的回旋圈
        const [X, Y] = W(R, s.x, s.y), r = k * 0.26;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(t * 9); ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = Math.max(2, k * 0.035);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU * 0.75); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r - k * 0.07, -k * 0.06); ctx.lineTo(r + k * 0.05, -k * 0.07); ctx.closePath(); ctx.fillStyle = '#ff6a3d'; ctx.fill();
        ctx.restore();
        tag(R, ctx, '回锅 · 可能收回', s.x, s.y + 0.48, '#ff6a3d', 0.85);
      }
    },

    // ---------------- 最上层（真球之后）：提示与状态条 ----------------
    // （镜像假球的拖尾由 fakeTrail 维护）
    top(R, ctx, m, o, dt) {
      const t = R.time, k = R.sc, s = m.shuttle, sk = m.sk || {};
      const humans = o && o.landHint ? o.landHint : [];
      FX.aim(R,ctx,m,o);
      FX.tossHint(R, ctx, m, humans);
      if (s.live && s.bun) { // 超大肉包球：真球裹在包子里；包子越鼓说明吸收的力量越多
        const bz = s.bun, st = bz.st || 0, swell = 1 + Math.min(0.35, st / 60), [X, Y] = W(R, s.x, s.y), r = k * 0.38 * swell, jit = st > 12 ? Math.sin(R.time * 60) * 1.5 : 0;
        ctx.save(); ctx.translate(X + jit, Y); ctx.rotate(Math.sin(R.time * 2) * 0.2); bunDraw(ctx, r); ctx.restore();
        if (st > 3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,190,110,${0.35 + 0.3 * Math.sin(t * 12)})`; ctx.lineWidth = Math.max(2, k * .04); ctx.beginPath(); ctx.arc(X, Y, r * 1.25, 0, TAU); ctx.stroke(); ctx.restore(); }
        timer(R, ctx, s.x, s.y, 0.5 * swell, (bz.t || 0) / 5, '#ffd28a');
        const mine = humans.includes(bz.o);
        tag(R, ctx, (st > 3 ? '蓄力 ' + Math.round(st * 3.6) + ' km/h' : '大肉包 · 慢') + (mine ? (s.lastHitter===bz.o?' · 再按拆包':' · 先亲手回球') : ''), s.x, s.y + 0.7 * swell, colOf('baozi'), 0.95);
      }
      for (const p of m.players) {
        const b = p.buff || {}, cnt = p.cnt || {};
        if (p.market) wallet(R, ctx, p, t);
        if (b.grab > 0) tag(R, ctx, '弯腰捡红包…', p.x, p.y + 2.3, '#ff7a6a', 0.95);
        if(cnt.calibrate) tag(R,ctx,'校准 ×1',p.x,p.y+2.8,'#ffb02e',.8);
        if(cnt.compile) tag(R,ctx,'编译 ×1',p.x,p.y+2.8,'#7fd6ff',.8);
        if(b.rocketReady>0) tag(R,ctx,'火箭推进就绪',p.x,p.y+2.5,'#ffcf5a',.9);
        if(b.teacherCalm>0) tag(R,ctx,'稳住 · 下一拍',p.x,p.y+2.6,'#8ff0b0',.8);
        if(b.overclock>0) tag(R,ctx,'机械过载',p.x,p.y+2.4,'#7dffcf',.85);
        if(b.bunSteam>0) tag(R,ctx,'蒸汽蓄力',p.x,p.y+2.4,'#ffd28a',.85);
        if(b.vineStrike>0) {
          ctx.save();ctx.strokeStyle='#b3ff82';ctx.globalAlpha=.6;ctx.lineWidth=2;
          const [x,y]=W(R,p.x,p.y+.8);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-p.vx*k*.08,y+p.vy*k*.04);ctx.stroke();ctx.restore();
        }
        const bar = (u, color, label) => {
          const [X, Y] = W(R, p.x, p.y + 2.25), w = k * 0.7, h = Math.max(4, k * 0.06);
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; YY.rr(ctx, X - w / 2, Y, w, h, h / 2); ctx.fill();
          ctx.fillStyle = color; YY.rr(ctx, X - w / 2, Y, w * clamp(u, 0, 1), h, h / 2); ctx.fill();
          if (label) tag(R, ctx, label, p.x, p.y + 2.55, color, 0.9);
        };
        if (cnt.clip) tag(R, ctx, '📋 ' + (YY.SHOT_NAMES[cnt.clip.type] || '球路') + ' · 待粘贴', p.x, p.y + 2.6, colOf('fuzhi'), 0.95);
        if (cnt.combo > 0 && b.jiezou > 0) tag(R, ctx, '节拍 ' + ['', '一', '二、一', '一、二、一'][cnt.combo], p.x, p.y + 2.6, colOf('jiezou'), 0.95);
        if (b.xingmen > 0) { // 星门已开：入口跟在她拍前
          const [X, Y] = W(R, p.x + p.dir * 0.9, p.y + 2.0), r = k * 0.28;
          ctx.save(); ctx.translate(X, Y); ctx.rotate(t * 2); ctx.strokeStyle = 'rgba(201,168,255,0.8)'; ctx.lineWidth = Math.max(2, k * 0.03); ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, TAU); ctx.stroke(); ctx.restore();
          tag(R, ctx, '星门 · 下一拍穿越', p.x, p.y + 2.6, '#c9a8ff', 0.9);
        }
        if (cnt.cloud) { // 筋斗云
          const [X, Y] = W(R, p.x, p.y - 0.05), r = k * 0.28;
          ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2;
          for (const [dx, dy, rr] of [[-1, 0, 0.7], [0, -0.25, 0.9], [1, 0, 0.7], [-0.5, 0.25, 0.6], [0.55, 0.25, 0.6]]) { ctx.beginPath(); ctx.arc(X + dx * r, Y + dy * r, rr * r, 0, TAU); ctx.fill(); ctx.stroke(); }
          ctx.restore();
          if (R.parts.length < 300 && Math.random() < 0.5) R.add({ type: 'spark', x: p.x + (Math.random() - 0.5) * 0.6, y: p.y - 0.05, vx: -p.vx * 0.2, vy: -0.4, life: 0.5, t: 0, color: '255,255,255', size: 0.05, g: 0, drag: 1 });
        }
        if (b.knock > 0) tag(R, ctx, '被击退', p.x, p.y + 2.3, '#ffd0a8', 0.9);
        if (b.stun > 0) tag(R, ctx, '震麻了', p.x, p.y + 2.3, '#ffb36a', 0.95);
        if (b.slip > 0) tag(R, ctx, '滑倒！', p.x, p.y + 2.3, '#ffd84a', 0.95);
        if (b.bugged > 0) tag(R, ctx, 'BUG · 卡顿', p.x, p.y + 2.3, '#bfe8ff', 0.9);
        if (b.margin > 0) tag(R, ctx, '爆仓！', p.x, p.y + 2.3, '#ff4d6d');
        if (b.taolao > 0) tag(R, ctx, '被套牢', p.x, p.y + 2.3, '#ff7aa8', 0.9);
        if (b.lag > 0) tag(R, ctx, '押错 · 卡顿', p.x, p.y + 2.3, '#ff8a95', 0.9);
        if (b.gravOn > 0) { // 重力换班开着：脚下一圈紫色引力环
          const [X, Y] = W(R, p.x, p.y + 0.05);
          ctx.save(); ctx.strokeStyle = 'rgba(159,180,255,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.lineDashOffset = t * 20;
          ctx.beginPath(); ctx.ellipse(X, Y, k * 0.5, k * 0.14, 0, 0, TAU); ctx.stroke(); ctx.restore();
          tag(R, ctx, '重力翻转 · 耗能', p.x, p.y + 2.45, '#ffe27a', 0.9);
        }
        if (cnt.streak >= 2 && p.kit && p.passive === 'liansha') tag(R, ctx, '🔥 ' + cnt.streak + ' 连杀', p.x, p.y + 2.75, '#ffb347', 0.95);
        if (cnt.recall && !cnt.recall.done && humans.includes(p.idx)) { // 箭头按屏幕方向画：反向移动 = 网向 -ref，换算到屏幕是 -ref·dir
          tag(R, ctx, '再按回收 · +6', p.x, p.y + 2.3, colOf('jixie'), 0.9);
        }
        if (b.shoushi > 0) tag(R, ctx, '收招', p.x, p.y + 2.3, '#b8ffde', 0.8);

        if (b.tripped > 0) tag(R, ctx, '绊到了', p.x, p.y + 2.3, '#ff8a95', 0.9);
        if (b.prone > 0) tag(R, ctx, '起身中', p.x, 0.9, '#ffb199', 0.9);
      }
      // 一掷千金：金砖球——金色光晕 + 撒出的金币
      if (s.live && s.gold && !s.ctl) {
        const [X, Y] = W(R, s.x, s.y), r = k * .3;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 1.6); g.addColorStop(0, 'rgba(255,236,140,.75)'); g.addColorStop(.5, 'rgba(255,190,40,.35)'); g.addColorStop(1, 'rgba(255,190,40,0)');
        ctx.fillStyle = g; ctx.fillRect(X - r * 2, Y - r * 2, r * 4, r * 4);
        ctx.strokeStyle = 'rgba(255,230,140,.85)'; ctx.lineWidth = Math.max(2, k * .03); ctx.beginPath(); ctx.arc(X, Y, r * (.7 + .1 * Math.sin(t * 20)), 0, TAU); ctx.stroke();
        ctx.restore();
        if (R.parts.length < 300 && Math.random() < .8) R.add({ type: 'spark', x: s.x, y: s.y, vx: -s.vx * .1 + (Math.random() - .5), vy: -s.vy * .1 + Math.random(), life: .5, t: 0, color: '255,210,63', size: .045, g: 4, drag: 1 });
      }
      // 月亮里的球：本机星星看得到“现在甩出去会飞到哪”（绿 = 落进对面，红 = 会丢分）
      if (s.live && s.ctl && s.ctl.k === 'orbit' && humans.includes(s.ctl.o) && YY.Match) {
        const oc = s.ctl, p = m.players[oc.o], dir = Math.sign(oc.w) || 1, sp = clamp(6 + (oc.spun || 0) * 1.25, 6, 24);
        const vx = -Math.sin(oc.a) * dir * sp, vy = Math.cos(oc.a) * dir * sp;
        const sim = YY.simulate(s.x, s.y, vx, vy, 3, true, false, m.physEnv ? m.physEnv() : undefined), land = sim.landX, H = (m.sk && m.sk.half ? m.sk.half[1 - oc.o] : C.HALF);
        const good = !sim.netHit && p.side * land < 0 && Math.abs(land) <= H;
        ctx.save(); ctx.strokeStyle = good ? 'rgba(125,255,176,.75)' : 'rgba(255,110,110,.7)'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.beginPath();
        sim.pts.forEach((q, i) => { if (i % 2) return; const [X, Y] = W(R, q.x, q.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); ctx.setLineDash([]);
        const [LX, LY] = W(R, land, 0); ctx.fillStyle = good ? '#7dffb0' : '#ff6e6e'; ctx.beginPath(); ctx.ellipse(LX, LY, k * .18, k * .06, 0, 0, TAU); ctx.fill(); ctx.restore();
        tag(R, ctx, good ? '现在甩：好球' : '现在甩：会丢分', s.x, s.y + .55, good ? '#7dffb0' : '#ff8a8a', .9);
      }
      // 角度标尺：本机玩家（小红）看到击球点到网带的参考线
      for (const i of humans) {
        const p = m.players[i];
        if (!p || !p.kit || p.passive !== 'biaochi' || !s.live || s.ctl || s.lastHitter === i || p.side * s.x < 0.2) continue;
        const dy = C.NET_H + 0.05 - s.y, ang = Math.atan2(dy, Math.abs(s.x));
        const col = ang < -0.12 ? '#ff6a52' : ang < 0.12 ? '#5fd0ff' : '#7dffb0', tip = ang < -0.12 ? '可下压' : ang < 0.12 ? '可平推' : '宜挑高';
        const [X, Y] = W(R, s.x, s.y), [NX, NY] = W(R, 0, C.NET_H + 0.05);
        ctx.save(); ctx.setLineDash([8, 5]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(NX, NY); ctx.stroke(); ctx.restore();
        tag(R, ctx, tip, s.x * 0.5, (s.y + C.NET_H) / 2 + 0.3, col, 0.85);
      }
    },

    // ---------------- 屏幕层 ----------------
    aim(R,ctx,m,o) {
      for(const a of o?.skillAims || []) {
        const p=m.players[a.player];if(!p)continue;
        const v=YY.skillVector(a.id,a.aim),color=a.cancelled?'#ff606b':colOf(a.id),k=R.sc;
        const pv=!a.cancelled && YY.skillPreview ? YY.skillPreview(m,p,a.id,v) : null;
        if(pv){previewDraw(R,ctx,m,p,pv,color);continue;}
        const origin=safeOrigin();
        function safeOrigin(){return m.shuttle?.ctl?.k==='orbit' && m.shuttle.ctl.o===p.idx && a.id==='yueliang'?{x:m.shuttle.x,y:m.shuttle.y}:{x:p.x+p.dir*.25,y:p.y+1.35};}
        let target={x:origin.x+p.dir*v.x*3.8,y:Math.max(.25,origin.y+v.y*3.8)};
        if(a.id==='fanshe' || a.id==='yueliang' && origin.y===p.y+1.35) target=YY.Match.prototype.skillTarget.call({halfOf:i=>m.sk?.half?.[i] || C.HALF},p,a.id,v);
        if(a.id==='youyou'){const d=v.manual?1.6+3.2*v.r:4.2;target={x:p.x+p.dir*v.x*d,y:Math.max(.25,p.y+1.5+v.y*d)};}
        if(['shensuo','youyou'].includes(a.id))target.x=p.side*clamp(p.side*target.x,.25,(m.sk?.half?.[p.idx]||C.HALF)+.4);
        const [X,Y]=W(R,origin.x,origin.y),[TX,TY]=W(R,target.x,target.y);
        ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=a.cancelled?.4:.8;ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(TX,TY);ctx.stroke();ctx.setLineDash([]);
        if(a.id==='fanshe') {
          const dx=-v.y*k*.6*(R.mirror?-1:1)*p.dir,dy=-v.x*k*.6;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(TX-dx,TY-dy);ctx.lineTo(TX+dx,TY+dy);ctx.stroke();
          const s=m.shuttle,sp=Math.hypot(s.vx,s.vy)||1,nx=p.dir*v.x,ny=v.y,ix=s.live?s.vx/sp:-p.dir,iy=s.live?s.vy/sp:0,dot=ix*nx+iy*ny;
          const [ox,oy]=W(R,target.x+(ix-2*dot*nx)*1.8,target.y+(iy-2*dot*ny)*1.8);
          ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(TX,TY);ctx.lineTo(ox,oy);ctx.stroke();ctx.setLineDash([]);
        }
        else {ctx.beginPath();ctx.arc(TX,TY,k*(a.id==='yueliang'?.85:.2),0,TAU);ctx.stroke();}
        const angle=Math.atan2(TY-Y,TX-X);ctx.beginPath();ctx.moveTo(TX,TY);ctx.lineTo(TX-12*Math.cos(angle-.45),TY-12*Math.sin(angle-.45));ctx.moveTo(TX,TY);ctx.lineTo(TX-12*Math.cos(angle+.45),TY-12*Math.sin(angle+.45));ctx.stroke();ctx.restore();
        const label=a.cancelled?'取消施放':!a.aim?'默认施放':YY.SKILLS[a.id]?.aim==='choice'?(v.x<0?'后场 / 反向':'前场 / 正向'):'瞄准 · '+Math.round(Math.atan2(v.y,v.x)*180/Math.PI)+'°';
        tag(R,ctx,label,p.x,p.y+2.5,color,.95);
      }
    },
    // 自抛之后：本机小红看到最佳扣杀点
    tossHint(R, ctx, m, humans) {
      const s = m.shuttle, pr = m.pred;
      if (!s.live || s.ctl || s.tossSkill !== 'zipao' || !humans.includes(s.selfToss) || !pr || !pr.pts) return;
      const p = m.players[s.selfToss], el = (m.time || 0) - (pr.t0 ?? m.time ?? 0);
      const pt = pr.pts.find(q => q.t > el && q.vy < 0 && q.y < p.y + C.SHOULDER + 1.1 + (p.onGround ? 0.9 : 0));
      if (!pt) return;
      const [X, Y] = W(R, pt.x, pt.y), k = R.sc, u = 0.5 + 0.5 * Math.sin(R.time * 10);
      ctx.save(); ctx.strokeStyle = `rgba(255,176,46,${0.6 + 0.4 * u})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, k * (0.2 + 0.05 * u), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X - k * .3, Y); ctx.lineTo(X - k * .12, Y); ctx.moveTo(X + k * .12, Y); ctx.lineTo(X + k * .3, Y); ctx.moveTo(X, Y - k * .3); ctx.lineTo(X, Y - k * .12); ctx.moveTo(X, Y + k * .12); ctx.lineTo(X, Y + k * .3); ctx.stroke(); ctx.restore();
      tag(R, ctx, p.onGround ? '起跳扣杀点' : '扣！', pt.x, pt.y + 0.5, '#ffb02e', 0.95);
    },
    screen(R, ctx, m) {
      const s = m.shuttle;
      if (s.live && s.ctl && s.ctl.k === 'cradle') { ctx.fillStyle = 'rgba(120,255,170,0.06)'; ctx.fillRect(0, 0, R.W, R.H); }
    },

    // ---------------- 选手姿态：翻滚、飞扑、趴地 ----------------
    pose(R, ctx, p, look, m) {
      const b = p.buff || {}, k = R.sc, f = (R.mirror ? -1 : 1) * p.dir;
      const lying = b.dive > 0 || b.prone > 0;
      if (!lying) return false;
      const [X, Y] = W(R, p.x, 0);
      ctx.save();
      { // 飞扑 / 趴地
        const dw = (p.cnt && p.cnt.diveW) || p.dir, s2 = (R.mirror ? -1 : 1) * dw;
        const ease = u => { u = clamp(u, 0, 1); return u*u*(3-2*u); };
        const down = b.dive > 0 ? ease((.42-b.dive)/.1) : ease(b.prone/.24);
        // 离地先伸展再扑倒，末段撑起身体；状态结束时自然接回准备姿态。
        ctx.translate(X, Y); ctx.rotate(s2 * Math.PI / 2 * .92 * down); ctx.translate(-X, -Y + k * .18 * down);
      }
      const q = Object.assign({}, p, { y: 0, vx: 0, vy: 0, onGround: true, motion: null });
      R.drawCharAt(ctx, q, look, R.charOpts(q, m, { mood: 'play' }));
      ctx.restore();
      return true;
    },
  };
  // 装置 → 所属技能（取颜色）
  const KIND_SKILL = {
    foot: 'yihan', drop: 'dishui', sign: 'qiandao', coin: 'jihui', crumbs: 'baozi', wokArc: 'huiguo',
    pole: 'shensuo', spin: 'xuanpai', yoyo: 'youyou', ghost: 'shuizhong', afterimg: 'jindou', appoint: 'yueqiu', star: 'yekong', wind: 'fengkou', board: 'fanshe',
    moon: 'yueliang', gate: 'xingmen', vine: 'dangteng', mini: 'haomao', cone: 'biaozhi',
    firewall:'fanghuo', pool: 'chaolai', ripplePool: 'chaolai', ribbon: 'hongxian', bunFly: 'baozi', wall: 'diban', steam: 'diban', guide: 'pingyi', lineFlash: 'pingyi', pane: 'shuangji', iceShard: 'shuangji', replace: 'yati', replaceHit: 'yati',
    coins: 'jihui', packet: 'jiepan', chips: 'ganggan', jail: 'jihui', whirl: 'yuyue', splash: 'jingxiang', rewind: 'huichao', gale: 'yuyue', quake: 'diban', peel: 'haomao', bug: 'bug',
  };
  /** 假球的拖尾：第一次出现时借用真球当前的拖尾，之后自己累积，看不出先后 */
  function fakeTrail(R, e) {
    const all = R.fakeTrails || (R.fakeTrails = {});
    let tr = all[e.id];
    if (!tr) { tr = all[e.id] = (R.trail || []).map(q => Object.assign({}, q)); tr.age = 0; }
    if (tr.at !== R.time) { tr.at = R.time; tr.push({ x: e.x, y: e.y, v: Math.hypot(e.vx, e.vy) }); if (tr.length > 22) tr.shift(); }
    tr.seen = R.time;
    for (const id in all) if (R.time - all[id].seen > 1) delete all[id];
    return tr;
  }
  YY.SkillFX = FX;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
