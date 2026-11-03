/* 羽跃对决 · 渲染器：镜头、分层场景、角色、羽毛球、粒子特效与 HUD */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, lerp } = YY;
  const FONT = YY.FONT, NUMF = YY.NUMF;
  const rr = YY.rr;

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false }); // 不透明画布：合成时省去与页面的混合
      this.mirror = false;
      this.touch = false;
      this.time = 0;
      this.quality = 1;
      this.venueId = 'arena';
      this.trail = [];
      this.parts = [];
      this.texts = [];
      this.lines = [];
      this.banner = null;
      this.shake = 0;
      this.flash = 0;
      this.flashCol = '255,240,220';
      this.netWob = 0;
      this.shx = 0; this.shy = 0;
      this.cam = { z: 1, px: 0, py: 0, kick: 0, fx: 0, fy: 0, serve: 0 };
      this.springs = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];
      this.ghosts = [[], []];
      this.ghostT = [0, 0];
      this.scoreSeen = null;
      this.scorePop = [-9, -9];
      this.lastWinner = -1;
      this.columns = [];
      this.frameAvg = 0.016;
      this.portraits = YY.LOOKS.map((l) => YY.portrait(l, 96));
      this.resize();
    }

    // ---------- 尺寸与缓存 ----------
    resize() {
      const vp = YY.viewport ? YY.viewport() : { W: window.innerWidth, H: window.innerHeight };
      const W = vp.W, H = vp.H;
      // 像素预算：渲染开销与画布像素数成正比（高分屏 / Windows 缩放下画布可达 800 万像素）
      const budget = this.quality ? 2.4e6 : 1.15e6;
      const dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(budget / (W * H))));
      this.W = W; this.H = H; this.dpr = dpr;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.width = W + 'px';
      this.cv.style.height = H + 'px';
      const V = YY.geometry(W, H, this.touch);
      V.dpr = dpr;
      this.V = V;
      this.sc = V.sc; this.gy = V.gy; this.cx = V.cx; this.ox = V.ox; this.oy = V.oy;
      this.cam.px = this.cx; this.cam.py = this.gy - 2 * this.sc;
      this.buildLayers();
    }
    setVenue(id) {
      if (!YY.VENUES[id]) id = 'arena';
      if (id === this.venueId && this.far) return;
      this.venueId = id;
      this.buildLayers();
    }
    get venue() { return YY.VENUES[this.venueId]; }
    layer(paint) {
      const c = document.createElement('canvas');
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      const g = c.getContext('2d');
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paint(g);
      return c;
    }
    /** 静态内容全部预先烘焙进缓存层：每帧只需两次贴图，不再逐帧画光柱、暗角、整片观众 */
    buildLayers() {
      const v = this.venue, V = this.V, W = this.W, H = this.H;
      const vignette = (g, atop) => {
        const gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.78);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.55)');
        g.save();
        if (atop) g.globalCompositeOperation = 'source-atop';
        if (v.tint) v.tint(g, V);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.restore();
      };
      const base = this.layer((g) => { v.paintFar(g, V); if (v.bakeFar) v.bakeFar(g, V); });
      this.vst = v.init(V, this);
      const strips = this.vst.strips;
      this.far = this.layer((g) => { g.drawImage(base, 0, 0, W, H); vignette(g); });
      // 观众静止时直接用烘焙好的整片观众；只有欢呼时才逐排绘制做波浪
      this.farCrowd = strips ? this.layer((g) => {
        g.drawImage(base, 0, 0, W, H);
        for (const st of strips) g.drawImage(st.c, 0, st.y, W, st.h);
        if (v.afterCrowd) v.afterCrowd(g, V);
        vignette(g);
      }) : null;
      this.near = this.layer((g) => { v.paintNear(g, V); vignette(g, true); });
      this.nearTop = clamp(Math.floor(v.nearTop ? v.nearTop(V) : V.adTop - 0.8 * V.sc), 0, H);
    }
    venueEvent(type, d) { const v = this.venue; if (v.event) v.event(this.vst, type, d || {}); }

    sx(x) { return this.cx + (this.mirror ? -x : x) * this.sc; }
    sy(y) { return this.gy - y * this.sc; }
    P(x, y, z) { return [this.cx + (this.mirror ? -x : x) * this.sc + z * this.ox, this.gy - y * this.sc + z * this.oy]; }

    clearFx() { this.trail = []; this.parts = []; this.texts = []; this.banner = null; this.lines = []; this.columns = []; this.ghosts = [[], []]; this.lastWinner = -1; this.scoreSeen = null; }

    // ---------- 特效接口 ----------
    add(p) { if (this.parts.length < (this.quality ? 420 : 180)) this.parts.push(p); }
    burst(x, y, n, color, spd, size) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.9);
        this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.3, t: 0, color, size: size || 0.03, g: 4, drag: 3 });
      }
    }
    dust(x, n, big) {
      for (let i = 0; i < n; i++) {
        this.add({ type: 'dust', x: x + (Math.random() - 0.5) * 0.4, y: 0.03, vx: (Math.random() - 0.5) * (big ? 3 : 1.6), vy: Math.random() * (big ? 1.2 : 0.6), life: 0.5 + Math.random() * 0.4, t: 0, size: (big ? 0.12 : 0.07) + Math.random() * 0.06, g: 0.6, drag: 2.5 });
      }
    }
    feathers(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.add({ type: 'feather', x, y, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, life: 1.2 + Math.random() * 0.8, t: 0, size: 0.07 + Math.random() * 0.04, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: 1.2, drag: 3.5 });
      }
    }
    confetti(x, y, n, cols) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 4 + Math.random() * 5;
        this.add({ type: 'confetti', x: x + (Math.random() - 0.5) * 1.5, y, vx: Math.cos(a) * v * 0.6, vy: -Math.sin(a) * v, life: 1.8 + Math.random() * 1.2, t: 0, size: 0.06 + Math.random() * 0.05, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, g: 4, drag: 1.6, color: cols[i % cols.length] });
      }
    }
    ring(x, y, color, size, life, floor) { this.add({ type: floor ? 'fring' : 'ring', x, y, life, t: 0, size, color, vx: 0, vy: 0, g: 0 }); }
    glow(x, y, color, size, life) { this.add({ type: 'glow', x, y, life, t: 0, size, color, vx: 0, vy: 0, g: 0 }); }
    popText(text, x, y, color, size, life) {
      this.texts.push({ text, x, y, color: color || '#fff', size: size || 1, life: life || 1.1, t: 0 });
      if (this.texts.length > 8) this.texts.shift();
    }
    showBanner(text, sub, color, life) { this.banner = { text, sub: sub || '', color: color || '#ffffff', t: 0, life: life || 1.7 }; }
    kick(amount, x, y) {
      this.cam.kick = Math.max(this.cam.kick, amount);
      this.cam.fx = this.sx(x); this.cam.fy = this.sy(y);
    }

    /** 击球特效 */
    hitFx(e) {
      const smash = e.shot === 'smash';
      if (e.feed) { this.burst(e.x, e.y, 5, '255,255,255', 2.5); return; }
      if (smash) {
        this.burst(e.x, e.y, 30, '255,190,90', 9, 0.05);
        this.burst(e.x, e.y, 14, '255,255,255', 6, 0.03);
        this.glow(e.x, e.y, '255,200,120', 1.6, 0.35);
        this.ring(e.x, e.y, '255,220,160', 0.35, 0.4);
        this.feathers(e.x, e.y, 4);
        this.shake = 0.95; this.flash = 0.22; this.flashCol = '255,235,210';
        this.kick(1, e.x, e.y);
        this.lines.push({ x: this.sx(e.x), y: this.sy(e.y), t: 0, life: 0.38 });
        this.venueEvent('smash');
      } else if (e.q >= 0.85) {
        this.burst(e.x, e.y, 14, '255,225,120', 5, 0.035);
        this.ring(e.x, e.y, '255,214,90', 0.25, 0.35);
        this.glow(e.x, e.y, '255,220,120', 0.8, 0.25);
      } else {
        this.burst(e.x, e.y, 8, '255,255,255', 3.5, 0.028);
        this.glow(e.x, e.y, '255,255,255', 0.5, 0.18);
      }
      if (e.save || e.lowSave) { this.ring(e.x, e.y, '120,240,255', 0.3, 0.45); this.kick(0.5, e.x, e.y); }
      this.venueEvent('hit');
    }
    netFx(e) {
      this.netWob = 1;
      this.burst(e.x, e.y, 6, '230,230,255', 1.5, 0.02);
      this.feathers(e.x, e.y, 2);
    }
    landFx(x, inB) {
      this.dust(x, 12, true);
      this.ring(x, 0, inB ? '120,255,170' : '255,110,110', 0.25, 0.7, true);
      this.columns.push({ x, inB, t: 0, life: 1.4 });
    }
    pointFx(winner, m, label) {
      this.lastWinner = winner;
      const look = YY.LOOKS[winner];
      const p = m.players[winner];
      this.confetti(p.x, 2.6, 26, [look.shirt, look.trim, '#ffffff', look.racket]);
      this.venueEvent('point', { text: label || '得分！', color: look.shirt });
      this.kick(0.45, m.landMark ? m.landMark.x : 0, 0.6);
    }
    victoryFx(winner, m, text) {
      this.lastWinner = winner;
      const look = YY.LOOKS[winner];
      for (let i = 0; i < 4; i++) this.confetti(-6 + i * 4, 6.5, 30, [look.shirt, look.trim, '#ffffff', '#ffd23f', look.racket]);
      this.venueEvent('over', { text: text || '胜利', color: look.shirt });
      this.flash = 0.3; this.flashCol = '255,255,255';
    }

    // ---------- 镜头 ----------
    updateCam(m, dt) {
      const c = this.cam;
      c.kick = Math.max(0, c.kick - dt * 2.4);
      const serving = m.phase === 'serve' ? 1 : 0;
      c.serve += (serving - c.serve) * Math.min(1, dt * 2.5);
      let tx = this.cx, ty = this.gy - 2 * this.sc;
      if (c.serve > 0.05 && m.players) { const sp = m.players[m.server]; tx = lerp(tx, this.sx(sp.x * 0.7), c.serve); ty = lerp(ty, this.gy - 1.2 * this.sc, c.serve); }
      if (c.kick > 0.02) { tx = lerp(tx, c.fx, Math.min(1, c.kick * 1.5)); ty = lerp(ty, c.fy, Math.min(1, c.kick * 1.5)); }
      const k = Math.min(1, dt * 5);
      c.px += (tx - c.px) * k; c.py += (ty - c.py) * k;
      const tz = 1 + c.serve * 0.04 + c.kick * 0.06;
      c.z += (tz - c.z) * Math.min(1, dt * 8);
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = this.shake * this.shake * this.sc * 0.22;
      this.shx = (Math.random() - 0.5) * sh;
      this.shy = (Math.random() - 0.5) * sh;
    }
    applyCam(par) {
      const c = this.cam, d = this.dpr;
      const z = 1 + (c.z - 1) * par;
      this.ctx.setTransform(d * z, 0, 0, d * z, d * (c.px * (1 - z) + this.shx * par), d * (c.py * (1 - z) + this.shy * par));
    }

    // ---------- 场景元素 ----------
    drawNet(ctx) {
      const HW = 3.05;
      const wob = this.netWob, t = this.time;
      // 晃动对 z 为奇函数：z=0 处（真实过网位置）不偏移；网带上沿始终等于物理网高
      const dx = (z) => Math.sin(z * 1.03) * Math.cos(t * 22) * wob * 0.09;
      const top = (z) => this.P(dx(z), C.NET_H, z);
      const bot = (z) => this.P(dx(z) * 0.6, 0.79, z);
      const t0 = top(-HW), b1 = bot(HW), b0 = bot(-HW);
      ctx.beginPath();
      ctx.moveTo(t0[0], t0[1]);
      for (let i = 1; i <= 12; i++) { const p = top(-HW + (i / 12) * HW * 2); ctx.lineTo(p[0], p[1]); }
      ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(b0[0], b0[1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15,15,25,0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,235,250,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) { const z = -HW + (i / 18) * HW * 2; const a = top(z), b = bot(z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let j = 1; j < 7; j++) {
        const y = 0.79 + (j / 7) * (C.NET_H - 0.79);
        for (let i = 0; i <= 12; i++) { const z = -HW + (i / 12) * HW * 2; const p = this.P(dx(z) * (0.6 + 0.4 * j / 7), y, z); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      }
      ctx.stroke();
      // 网带：向下填充 6cm，上沿即物理网高
      const tape = 0.06, t1 = top(HW);
      const d0 = this.P(dx(-HW), C.NET_H - tape, -HW), d1 = this.P(dx(HW), C.NET_H - tape, HW);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d0[0], d0[1]);
      ctx.closePath(); ctx.fill();
      for (const z of [-HW, HW]) {
        const a = this.P(0, 0, z), b = this.P(0, C.NET_H + 0.06, z);
        const w = Math.max(3, this.sc * 0.075);
        const g = ctx.createLinearGradient(a[0] - w, 0, a[0] + w, 0);
        g.addColorStop(0, '#9aa2b8'); g.addColorStop(0.5, '#f4f6ff'); g.addColorStop(1, '#8a92a8');
        ctx.strokeStyle = g; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.fillStyle = '#2a2f45';
        ctx.beginPath(); ctx.ellipse(a[0], a[1], w * 1.4, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    updateSpring(p, dt) {
      const s = this.springs[p.idx];
      const tx = clamp(-p.vx * p.dir * 0.03, -0.12, 0.12), ty = clamp(-p.vy * 0.025, -0.1, 0.1) + Math.sin(this.time * 6 + p.idx) * 0.01;
      s.vx += ((tx - s.x) * 90 - s.vx * 9) * dt;
      s.vy += ((ty - s.y) * 90 - s.vy * 9) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
    }

    moodOf(p, m) {
      if (m.practice) return 'play';
      if ((m.phase === 'point' || m.phase === 'over') && this.lastWinner >= 0) return p.idx === this.lastWinner ? 'happy' : 'sad';
      return 'play';
    }

    charOpts(p, m, extra) {
      const s = m.shuttle;
      const gx = (s.x - p.x) * p.dir, gyv = s.y - (p.y + 1.6);
      const L = Math.hypot(gx, gyv) || 1;
      return Object.assign({ time: this.time, mood: this.moodOf(p, m), gazeX: gx / L, gazeY: gyv / L, spring: [this.springs[p.idx].x, this.springs[p.idx].y], f: (this.mirror ? -1 : 1) * p.dir, glow: Math.max(0, p.flash || 0) * 4 }, extra || {});
    }

    drawCharAt(ctx, p, look, o) {
      const k = this.sc;
      const f = (this.mirror ? -1 : 1) * p.dir;
      ctx.save();
      ctx.translate(this.sx(p.x), this.sy(p.y));
      ctx.scale(f * k, -k);
      YY.drawCharacter(ctx, p, look, o);
      ctx.restore();
    }

    /** 绘制单个选手（不依赖比赛对象，回归测试使用） */
    drawPlayer(ctx, p, look) {
      const sp = this.springs ? this.springs[p.idx] : null;
      this.drawCharAt(ctx, p, look, { time: this.time || 0, mood: 'play', f: (this.mirror ? -1 : 1) * p.dir, spring: sp ? [sp.x, sp.y] : [0, 0] });
    }

    drawShadow(ctx, p) {
      const sh = this.venue.shadow;
      const X = this.sx(p.x), Y = this.sy(0), k = this.sc;
      const a = clamp(1 - p.y / 1.6, 0.25, 1);
      const len = sh.len, sk = sh.skew * k * 0.25;
      const R = k * 0.45 * len;
      const g = ctx.createRadialGradient(X + sk, Y, 0, X + sk, Y, R);
      g.addColorStop(0, `rgba(0,0,0,${sh.alpha * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(X + sk, Y);
      ctx.scale(1, 0.2 / len);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
    }

    drawSwoosh(ctx, p, look) {
      const sw = p.swing;
      if (!sw || sw.t < 0.02 || sw.t > 0.24) return;
      const k = this.sc, f = (this.mirror ? -1 : 1) * p.dir;
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const tt = sw.t - i * 0.016;
        if (tt < 0) break;
        const q = Object.assign({}, p, { swing: Object.assign({}, sw, { t: tt }) });
        pts.push(YY.racketHead(YY.charPose(q, this.time, { mood: 'play' })));
      }
      if (pts.length < 3) return;
      ctx.save();
      ctx.translate(this.sx(p.x), this.sy(p.y));
      ctx.scale(f * k, -k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const smash = sw.dur > 0.4;
      const col = smash ? '255,170,70' : look.hair === 'spiky' ? '255,130,130' : '120,220,255';
      for (let i = 1; i < pts.length; i++) {
        const u = 1 - i / pts.length;
        ctx.strokeStyle = `rgba(${col},${0.55 * u})`;
        ctx.lineWidth = (smash ? 0.22 : 0.15) * u;
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      }
      ctx.restore();
    }

    drawShuttle(ctx, s) {
      const k = this.sc;
      const X = this.sx(s.x), Y = this.sy(s.y);
      const spd = s.speed || 0;
      if (s.y > 0.02) {
        const a = clamp(0.4 - s.y * 0.04, 0.08, 0.4);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.beginPath(); ctx.ellipse(X, this.sy(0), 0.09 * k, 0.025 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
      let ang;
      if (s.held) ang = Math.PI / 2;
      else if (!s.live) ang = 0.25;
      else ang = Math.atan2(-s.vy, this.mirror ? -s.vx : s.vx);
      const R = C.SHUTTLE_R * k; // 球头半径与碰撞一致
      const sz = R / 3;
      if (s.live && spd > 14) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(X, Y, 0, X, Y, sz * 16);
        gr.addColorStop(0, 'rgba(255,200,120,0.55)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = gr; ctx.fillRect(X - sz * 16, Y - sz * 16, sz * 32, sz * 32);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(ang);
      const wob = s.live ? Math.sin(this.time * 40) * 0.6 : 0;
      const sk = ctx.createLinearGradient(-14 * sz, 0, -2 * sz, 0);
      sk.addColorStop(0, 'rgba(232,238,250,0.95)'); sk.addColorStop(1, '#ffffff');
      ctx.fillStyle = sk;
      ctx.strokeStyle = 'rgba(140,150,175,0.9)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-2 * sz, -2.3 * sz);
      ctx.lineTo(-14 * sz, -6.4 * sz - wob);
      ctx.quadraticCurveTo(-15.5 * sz, 0, -14 * sz, 6.4 * sz + wob);
      ctx.lineTo(-2 * sz, 2.3 * sz);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,160,185,0.65)';
      ctx.beginPath();
      for (const yy of [-3.6, -1.2, 1.2, 3.6]) { ctx.moveTo(-2.5 * sz, yy * 0.45 * sz); ctx.lineTo(-14 * sz, yy * sz * 1.6); }
      ctx.moveTo(-8.5 * sz, -4.3 * sz); ctx.lineTo(-8.5 * sz, 4.3 * sz);
      ctx.stroke();
      ctx.fillStyle = '#f7e9cf';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.3, R * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-2.4 * sz, -2.6 * sz, 1.3 * sz, 5.2 * sz);
      ctx.restore();
    }

    drawTrail(ctx) {
      const tr = this.trail;
      if (tr.length < 3) return;
      const pts = tr.map((p) => [this.sx(p.x), this.sy(p.y), p.v]);
      const fast = pts[pts.length - 1][2] > 15;
      const n = pts.length;
      const wMax = (fast ? 0.16 : 0.08) * this.sc;
      const left = [], right = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const L = Math.hypot(nx, ny) || 1;
        nx /= L; ny /= L;
        const w = wMax * (i / (n - 1)) ** 1.4;
        left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
        right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
      }
      ctx.globalCompositeOperation = 'lighter';
      const head = pts[n - 1], tail = pts[0];
      const gr = ctx.createLinearGradient(tail[0], tail[1], head[0], head[1]);
      if (fast) { gr.addColorStop(0, 'rgba(255,60,40,0)'); gr.addColorStop(0.6, 'rgba(255,140,60,0.55)'); gr.addColorStop(1, 'rgba(255,240,200,0.95)'); }
      else { gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(220,240,255,0.55)'); }
      ctx.fillStyle = gr;
      ctx.beginPath();
      left.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fill();
      if (fast) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); pts.slice(-8).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawColumns(ctx, dt) {
      for (let i = this.columns.length - 1; i >= 0; i--) {
        const c = this.columns[i];
        c.t += dt;
        if (c.t > c.life) { this.columns.splice(i, 1); continue; }
        const a = Math.sin(Math.min(1, c.t / c.life) * Math.PI) * 0.6;
        const X = this.sx(c.x), Y = this.sy(0), w = this.sc * 0.22, h = this.sc * 2.4;
        const col = c.inB ? '90,255,160' : '255,90,90';
        const g = ctx.createLinearGradient(0, Y, 0, Y - h);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g; ctx.fillRect(X - w, Y - h, w * 2, h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    drawLandMark(ctx, lm, now) {
      const age = now - lm.t;
      if (age > 2.6) return;
      const a = this.P(lm.x, 0, 0);
      const col = lm.inB ? '#5cff9d' : '#ff5d5d';
      ctx.globalAlpha = clamp(1.8 - age * 0.7, 0, 1);
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      const r = 0.24 * this.sc;
      ctx.beginPath(); ctx.ellipse(a[0], a[1], r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(a[0], a[1], r * 0.45, r * 0.13, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      const fs = Math.max(13, Math.round(0.26 * this.sc));
      ctx.font = `900 ${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const label = lm.inB ? '界内' : '出界';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      rr(ctx, a[0] - tw / 2 - 8, a[1] + 0.13 * this.sc, tw + 16, fs + 8, (fs + 8) / 2); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(label, a[0], a[1] + 0.13 * this.sc + 4);
      ctx.globalAlpha = 1;
    }

    drawHint(ctx, m, idx, h, full) {
      const k = this.sc;
      if (h.landX != null && Math.sign(h.landX) === m.players[idx].side) {
        const a = this.P(h.landX, 0, 0);
        const pulse = 1 + Math.sin(this.time * 10) * 0.12;
        const out = Math.abs(h.landX) > C.HALF + C.LINE_TOL;
        const col = out ? '255,110,110' : '255,214,63';
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, a[1], 0, a[1] - k * 0.9);
        g.addColorStop(0, `rgba(${col},0.35)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(a[0] - k * 0.12, a[1] - k * 0.9, k * 0.24, k * 0.9);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.22 * k * pulse, 0.065 * k * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(${col},0.35)`;
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.1 * k, 0.03 * k, 0, 0, Math.PI * 2); ctx.fill();
        if (out) {
          ctx.fillStyle = '#ff8b8b';
          ctx.font = `900 ${Math.max(11, Math.round(0.2 * k))}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('会出界', a[0], a[1] + 0.1 * k);
        }
      }
      if (!full) return;
      if (h.standX != null) {
        const a = this.P(h.standX, 0, 0);
        ctx.fillStyle = 'rgba(80,230,255,0.22)';
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.32 * k, 0.08 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,240,255,0.85)';
        for (const dx of [-0.11, 0.11]) { ctx.beginPath(); ctx.ellipse(a[0] + dx * k, a[1], 0.05 * k, 0.025 * k, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(80,230,255,0.6)'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 1.8 * k); ctx.stroke();
        ctx.setLineDash([]);
      }
      const p = m.players[idx];
      const t = m.time;
      let cue = null, col = '#fff';
      if (h.jumpAt != null && t > h.jumpAt - 0.12 && t < h.jumpAt + 0.06 && p.onGround) { cue = '起跳！'; col = '#ffd23f'; }
      else if (t > h.swingAt - 0.1 && t < h.swingAt + 0.05) { cue = '挥拍！'; col = '#5cff9d'; }
      else if (t < h.swingAt - 0.1 && h.swingAt - t < 0.6) {
        const u = clamp((h.swingAt - t) / 0.6, 0, 1);
        const X = this.sx(p.x), Y = this.sy(p.y + C.SHOULDER);
        ctx.strokeStyle = `rgba(92,255,157,${0.9 - u * 0.5})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X, Y, (0.3 + u * 1.0) * k, 0, Math.PI * 2); ctx.stroke();
      }
      if (cue) this.drawCue(ctx, cue, this.sx(p.x), this.sy(p.y + 2.35), col);
    }
    drawCue(ctx, text, X, Y, col) {
      const fs = Math.max(18, Math.round(0.42 * this.sc));
      ctx.font = `italic 900 ${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineJoin = 'round';
      ctx.strokeText(text, X, Y);
      ctx.fillStyle = col; ctx.fillText(text, X, Y);
    }

    drawZone(ctx, zone, side) {
      const a = this.P(side * zone[0], 0, -2.59), b = this.P(side * zone[1], 0, -2.59), c = this.P(side * zone[1], 0, 2.59), d = this.P(side * zone[0], 0, 2.59);
      ctx.fillStyle = `rgba(255,210,63,${0.16 + Math.sin(this.time * 4) * 0.06})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
    }

    drawMachine(ctx, p) {
      const k = this.sc;
      const X = this.sx(p.x), Y = this.sy(0);
      const f = this.mirror ? 1 : -1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(X, Y, 0.55 * k, 0.09 * k, 0, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createLinearGradient(X - 0.4 * k, 0, X + 0.4 * k, 0);
      body.addColorStop(0, '#3a4262'); body.addColorStop(0.5, '#69739a'); body.addColorStop(1, '#2c3350');
      ctx.fillStyle = body; rr(ctx, X - 0.38 * k, Y - 0.95 * k, 0.76 * k, 0.8 * k, 0.12 * k); ctx.fill();
      ctx.fillStyle = '#1b2036'; rr(ctx, X - 0.26 * k, Y - 0.78 * k, 0.52 * k, 0.22 * k, 0.05 * k); ctx.fill();
      ctx.fillStyle = '#5cff9d'; ctx.font = `bold ${Math.round(0.13 * k)}px ${NUMF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FEED', X, Y - 0.67 * k);
      const tube = ctx.createLinearGradient(0, Y - 1.8 * k, 0, Y - 0.95 * k);
      tube.addColorStop(0, 'rgba(220,235,255,0.5)'); tube.addColorStop(1, 'rgba(160,180,220,0.35)');
      ctx.fillStyle = tube; rr(ctx, X - 0.14 * k, Y - 1.85 * k, 0.28 * k, 0.9 * k, 0.1 * k); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(X, Y - (1.05 + i * 0.15) * k, 0.06 * k, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.rect(Math.min(X + f * 0.05 * k, X + f * 0.5 * k), Y - 1.25 * k, 0.45 * k, 0.16 * k); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.05 * k;
      ctx.beginPath(); ctx.moveTo(X - 0.3 * k, Y - 0.15 * k); ctx.lineTo(X - 0.3 * k, Y); ctx.moveTo(X + 0.3 * k, Y - 0.15 * k); ctx.lineTo(X + 0.3 * k, Y); ctx.stroke();
    }

    drawServeMeter(ctx, m, label) {
      const p = m.players[m.server];
      const k = this.sc;
      const X = this.sx(p.x), Y = this.sy(2.6);
      const w = 1.8 * k, h = Math.max(10, 0.17 * k);
      ctx.fillStyle = 'rgba(6,8,24,0.7)';
      rr(ctx, X - w / 2 - 5, Y - h / 2 - 5, w + 10, h + 10, (h + 10) / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      const g = ctx.createLinearGradient(X - w / 2, 0, X + w / 2, 0);
      g.addColorStop(0, '#ff4d5e'); g.addColorStop(0.28, '#ffc94d'); g.addColorStop(0.5, '#4dffa0'); g.addColorStop(0.72, '#ffc94d'); g.addColorStop(1, '#ff4d5e');
      ctx.fillStyle = g; rr(ctx, X - w / 2, Y - h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, X - w / 2 + 2, Y - h / 2 + 1, w - 4, h * 0.38, h * 0.19); ctx.fill();
      const mx = X - w / 2 + m.serveMeter() * w;
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(mx, Y, 0, mx, Y, h * 1.4);
      gl.addColorStop(0, 'rgba(255,255,255,0.8)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(mx - h * 1.4, Y - h * 1.4, h * 2.8, h * 2.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff'; rr(ctx, mx - 2.5, Y - h / 2 - 6, 5, h + 12, 2.5); ctx.fill();
      if (label) {
        const fs = Math.max(11, Math.round(0.18 * k));
        ctx.font = `bold ${fs}px ${FONT}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(6,8,24,0.75)'; rr(ctx, X - tw / 2 - 10, Y - h / 2 - fs - 18, tw + 20, fs + 10, (fs + 10) / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, X, Y - h / 2 - fs / 2 - 13);
      }
    }

    // ---------- 粒子 ----------
    drawParts(ctx, dt) {
      const k = this.sc;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const q = this.parts[i];
        q.t += dt;
        if (q.t >= q.life) { this.parts.splice(i, 1); continue; }
        const dr = Math.exp(-(q.drag || 0) * dt);
        q.vx *= dr; q.vy = q.vy * dr - q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.rot != null) q.rot += q.vr * dt;
        const u = q.t / q.life, a = 1 - u;
        const X = this.sx(q.x), Y = this.sy(q.y);
        switch (q.type) {
          case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(${q.color},${a})`;
            ctx.lineWidth = Math.max(1, q.size * k * a);
            const vx = this.mirror ? -q.vx : q.vx;
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - vx * 0.035 * k, Y + q.vy * 0.035 * k); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'dust': {
            const r = q.size * k * (1 + u * 1.5);
            ctx.fillStyle = `rgba(225,215,200,${0.35 * a})`;
            ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'feather': {
            q.vx += Math.sin(this.time * 5 + i) * dt * 2;
            if (q.y < 0.02) { q.y = 0.02; q.vy = 0; q.vx *= 0.9; }
            ctx.save(); ctx.translate(X, Y); ctx.rotate(q.rot);
            ctx.globalAlpha = Math.min(1, a * 2);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(0, 0, q.size * k, q.size * k * 0.32, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(150,160,190,0.8)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-q.size * k, 0); ctx.lineTo(q.size * k * 1.2, 0); ctx.stroke();
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          }
          case 'confetti': {
            if (q.y < 0.02) { q.y = 0.02; q.vy = 0; q.vx = 0; q.vr = 0; }
            ctx.save(); ctx.translate(X, Y); ctx.rotate(q.rot);
            ctx.globalAlpha = Math.min(1, a * 3);
            ctx.fillStyle = q.color;
            const s = q.size * k, c = Math.abs(Math.cos(q.rot * 1.7));
            ctx.fillRect(-s, -s * 0.35 * c, s * 2, s * 0.7 * c + 1);
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          }
          case 'ring': {
            const r = q.size * k * (1 + u * 5);
            ctx.strokeStyle = `rgba(${q.color},${a})`; ctx.lineWidth = Math.max(1, 4 * a);
            ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'fring': {
            const r = q.size * k * (1 + u * 4);
            ctx.strokeStyle = `rgba(${q.color},${a})`; ctx.lineWidth = Math.max(1, 3 * a);
            ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'glow': {
            ctx.globalCompositeOperation = 'lighter';
            const r = q.size * k * (0.6 + u * 0.8);
            const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
            g.addColorStop(0, `rgba(${q.color},${a * 0.9})`); g.addColorStop(1, `rgba(${q.color},0)`);
            ctx.fillStyle = g; ctx.fillRect(X - r, Y - r, r * 2, r * 2);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
        }
      }
    }

    drawTexts(ctx, dt) {
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t += dt;
        if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
        const u = t.t / t.life;
        const X = this.sx(t.x), Y = this.sy(t.y + u * 0.55);
        const pop = u < 0.12 ? 0.5 + (u / 0.12) * 0.7 : u < 0.2 ? 1.2 - ((u - 0.12) / 0.08) * 0.2 : 1;
        const sz = Math.max(13, Math.round(0.3 * this.sc * t.size)) * pop;
        ctx.globalAlpha = u > 0.72 ? (1 - u) / 0.28 : 1;
        ctx.font = `italic 900 ${Math.round(sz)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, sz * 0.18); ctx.strokeStyle = 'rgba(8,6,20,0.75)';
        ctx.strokeText(t.text, X, Y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, X, Y);
      }
      ctx.globalAlpha = 1;
    }

    // ---------- HUD ----------
    drawScoreboard(ctx, m) {
      const W = this.W;
      const order = this.mirror ? [1, 0] : [0, 1];
      const u = clamp(Math.round(this.H * 0.043), 15, 30);
      const bw = Math.min(W * 0.64, 660), bh = u * 2.15;
      const bx = W / 2 - bw / 2, by = 8;
      if (!this.scoreSeen) this.scoreSeen = m.score.slice();
      for (let i = 0; i < 2; i++) if (m.score[i] !== this.scoreSeen[i]) { this.scoreSeen[i] = m.score[i]; this.scorePop[i] = this.time; }
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, bx + 2, by + 5, bw - 4, bh, bh * 0.28); ctx.fill(); // 廉价投影（不用 shadowBlur）
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, 'rgba(24,28,62,0.94)'); bg.addColorStop(1, 'rgba(8,10,28,0.94)');
      ctx.fillStyle = bg; rr(ctx, bx, by, bw, bh, bh * 0.28); ctx.fill();
      ctx.restore();
      const cw = bh * 2.2;
      ctx.save();
      rr(ctx, bx, by, bw, bh, bh * 0.28); ctx.clip();
      for (let j = 0; j < 2; j++) {
        const i = order[j], look = YY.LOOKS[i], left = j === 0;
        const x0 = left ? bx : W / 2 + cw / 2 - bh * 0.3, x1 = left ? W / 2 - cw / 2 + bh * 0.3 : bx + bw;
        const g = ctx.createLinearGradient(left ? x0 : x1, 0, left ? x1 : x0, 0);
        g.addColorStop(0, YY.shade(look.shirt, 0.85)); g.addColorStop(0.7, YY.shade(look.shirt2, 0.6)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        if (left) { ctx.moveTo(x0, by); ctx.lineTo(x1, by); ctx.lineTo(x1 - bh * 0.4, by + bh); ctx.lineTo(x0, by + bh); }
        else { ctx.moveTo(x0 + bh * 0.4, by); ctx.lineTo(x1, by); ctx.lineTo(x1, by + bh); ctx.lineTo(x0, by + bh); }
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(bx, by, bw, 1.5);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
      rr(ctx, bx, by, bw, bh, bh * 0.28); ctx.stroke();

      for (let j = 0; j < 2; j++) {
        const i = order[j], left = j === 0, p = m.players[i];
        const ar = bh * 0.38;
        const ax = left ? bx + bh * 0.55 : bx + bw - bh * 0.55, ay = by + bh / 2;
        ctx.save();
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(this.portraits[i], ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
        const nx = left ? ax + ar + 10 : ax - ar - 10;
        ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.round(u * 0.6)}px ${FONT}`;
        ctx.fillStyle = '#fff';
        ctx.fillText(m.names[i], nx, by + bh * 0.35);
        const sw = Math.max(46, Math.min(bw * 0.19, W / 2 - cw / 2 - (left ? nx - bx : bx + bw - nx) - 24 + bx)), sh = Math.max(5, u * 0.24);
        const sx0 = left ? nx : nx - sw, sy0 = by + bh * 0.62;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, sx0, sy0, sw, sh, sh / 2); ctx.fill();
        const r = clamp(p.stamina / C.STAM_MAX, 0, 1);
        const col = p.stamina >= C.JUMP_COST + C.SMASH_COST ? ['#5cffa8', '#1fc77a'] : p.stamina >= C.SMASH_COST ? ['#ffd96b', '#ffa53d'] : ['#ff7a7a', '#e2384a'];
        const sg = ctx.createLinearGradient(0, sy0, 0, sy0 + sh);
        sg.addColorStop(0, col[0]); sg.addColorStop(1, col[1]);
        ctx.fillStyle = sg;
        const fw = Math.max(sh, sw * r);
        rr(ctx, left ? sx0 : sx0 + sw - fw, sy0, fw, sh, sh / 2); ctx.fill();
        const need = (C.JUMP_COST + C.SMASH_COST) / C.STAM_MAX;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(left ? sx0 + sw * need : sx0 + sw - sw * need, sy0 - 2, 1.5, sh + 4);
        const sx = W / 2 + (left ? -1 : 1) * cw * 0.27;
        const age = this.time - this.scorePop[i];
        const pop = age < 0.5 ? 1 + Math.sin((age / 0.5) * Math.PI) * 0.4 : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        rr(ctx, sx - bh * 0.42, by + bh * 0.14, bh * 0.84, bh * 0.72, bh * 0.16); ctx.fill();
        if (age < 0.8) {
          ctx.globalCompositeOperation = 'lighter';
          const gl = ctx.createRadialGradient(sx, by + bh / 2, 0, sx, by + bh / 2, bh);
          gl.addColorStop(0, `rgba(255,220,120,${0.6 * (1 - age / 0.8)})`); gl.addColorStop(1, 'rgba(255,220,120,0)');
          ctx.fillStyle = gl; ctx.fillRect(sx - bh, by - bh * 0.5, bh * 2, bh * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.save();
        ctx.translate(sx, by + bh / 2 + 1);
        ctx.scale(pop, pop);
        ctx.font = `900 ${Math.round(bh * 0.6)}px ${NUMF}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(m.score[i]), 0, 0);
        ctx.restore();
        if (m.server === i && (m.phase === 'serve' || m.phase === 'rally')) this.shuttleIcon(ctx, sx + (left ? -1 : 1) * bh * 0.62, by + bh * 0.3, u * 0.36);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(W / 2, by + bh * 0.4, 2.5, 0, Math.PI * 2); ctx.arc(W / 2, by + bh * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();

      let chip = `${m.opt.target} 分制 · 领先 2 分 · ${m.opt.cap} 分封顶`, chipCol = 'rgba(255,255,255,0.7)', chipBg = 'rgba(8,10,28,0.72)';
      const gp = (i) => { const me = m.score[i] + 1, ot = m.score[1 - i]; return me >= m.opt.cap || (me >= m.opt.target && me - ot >= 2); };
      if (m.phase !== 'over' && !(m.winner >= 0) && (gp(0) || gp(1))) {
        chip = m.score[0] === m.opt.cap - 1 && m.score[1] === m.opt.cap - 1 ? '决胜分' : '赛点';
        chipCol = '#1a1000'; chipBg = `rgba(255,${(200 + Math.sin(this.time * 6) * 30) | 0},60,0.95)`;
      }
      const fs = Math.max(10, Math.round(u * 0.42));
      ctx.font = `900 ${fs}px ${FONT}`;
      const tw = ctx.measureText(chip).width;
      const cy = by + bh + 6;
      ctx.fillStyle = chipBg; rr(ctx, W / 2 - tw / 2 - 12, cy, tw + 24, fs + 10, (fs + 10) / 2); ctx.fill();
      ctx.fillStyle = chipCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(chip, W / 2, cy + (fs + 10) / 2);
      if (m.rally >= 3 && m.phase === 'rally') {
        const txt = `回合 ${m.rally}`;
        const w2 = ctx.measureText(txt).width;
        const y2 = cy + fs + 16;
        const rg = ctx.createLinearGradient(W / 2 - w2, 0, W / 2 + w2, 0);
        rg.addColorStop(0, '#ff5a3c'); rg.addColorStop(1, '#ffae3c');
        ctx.fillStyle = rg; rr(ctx, W / 2 - w2 / 2 - 12, y2, w2 + 24, fs + 10, (fs + 10) / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, W / 2, y2 + (fs + 10) / 2);
      }
    }
    shuttleIcon(ctx, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.lineTo(-s * 1.4, -s * 0.6); ctx.lineTo(-s * 1.4, s * 0.6); ctx.lineTo(-s * 0.3, s * 0.2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawPracticeHUD(ctx, pr) {
      const W = this.W;
      const u = clamp(Math.round(this.H * 0.04), 14, 26);
      const bw = Math.min(W * 0.68, 620), bh = u * 2.7;
      const bx = W / 2 - bw / 2, by = 8;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, bx + 2, by + 5, bw - 4, bh, 14); ctx.fill();
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, 'rgba(24,28,62,0.94)'); bg.addColorStop(1, 'rgba(8,10,28,0.94)');
      ctx.fillStyle = bg; rr(ctx, bx, by, bw, bh, 14); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; rr(ctx, bx, by, bw, bh, 14); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; rr(ctx, bx, by + bh * 0.18, 5, bh * 0.3, 2.5); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(u * 0.78)}px ${FONT}`;
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(pr.def.name, bx + 16, by + bh * 0.33);
      ctx.textAlign = 'right';
      const score = `${pr.ok} / ${pr.att}`;
      ctx.font = `900 ${Math.round(u * 0.85)}px ${NUMF}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(score, bx + bw - 16, by + bh * 0.33);
      const tw = ctx.measureText(score).width;
      ctx.font = `bold ${Math.round(u * 0.48)}px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`连续 ${pr.streak} · 最佳 ${pr.best} · 成功`, bx + bw - 24 - tw, by + bh * 0.34);
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(u * 0.6)}px ${FONT}`;
      ctx.fillStyle = pr.msgColor;
      ctx.fillText(pr.msg, W / 2, by + bh * 0.74);
    }

    drawBanner(ctx, dt) {
      const b = this.banner;
      if (!b) return;
      b.t += dt;
      if (b.t >= b.life) { this.banner = null; return; }
      const u = b.t / b.life;
      const inK = Math.min(1, b.t / 0.22), outK = u > 0.82 ? (u - 0.82) / 0.18 : 0;
      const e = 1 - (1 - inK) ** 3;
      const fs = clamp(Math.round(this.H * 0.085), 28, 70);
      const Y = this.H * 0.37;
      const h = fs * (b.sub ? 2.1 : 1.55);
      const W = this.W;
      const base = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#ffd23f';
      ctx.save();
      ctx.globalAlpha = 1 - outK;
      ctx.translate((1 - e) * -W + outK * W * 0.4, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(-20, Y - h / 2 + 8); ctx.lineTo(W + 20, Y - h / 2 + 4); ctx.lineTo(W + 20, Y + h / 2 + 8); ctx.lineTo(-20, Y + h / 2 + 12); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(0, Y - h / 2, 0, Y + h / 2);
      g.addColorStop(0, YY.shade(base, 1.08)); g.addColorStop(1, YY.shade(base, 0.5));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-20, Y - h / 2); ctx.lineTo(W + 20, Y - h / 2 - 4); ctx.lineTo(W + 20, Y + h / 2); ctx.lineTo(-20, Y + h / 2 + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-20, Y - h / 2 - 6, W + 40, 2); ctx.fillRect(-20, Y + h / 2 + 5, W + 40, 2);
      const sx = ((b.t * 1.6) % 1.6 - 0.3) * W;
      const sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.3)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 80, Y - h / 2 - 4, 160, h + 8);
      ctx.font = `italic 900 ${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(10,5,20,0.5)';
      const ty = b.sub ? Y - fs * 0.28 : Y;
      ctx.strokeText(b.text, W / 2, ty);
      ctx.fillStyle = '#ffffff'; ctx.fillText(b.text, W / 2, ty);
      if (b.sub) {
        ctx.font = `bold ${Math.round(fs * 0.36)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillText(b.sub, W / 2, Y + fs * 0.6);
      }
      ctx.restore();
    }

    drawSpeedLines(ctx, dt) {
      for (let i = this.lines.length - 1; i >= 0; i--) {
        const L = this.lines[i];
        L.t += dt;
        if (L.t > L.life) { this.lines.splice(i, 1); continue; }
        const a = 1 - L.t / L.life;
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * a})`;
        const R0 = this.sc * (1.2 + L.t * 8), R1 = R0 + this.sc * 2.4;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 26; k++) {
          const ang = (k / 26) * Math.PI * 2 + k * 0.37;
          const r0 = R0 * (0.8 + ((k * 7) % 5) * 0.08);
          ctx.moveTo(L.x + Math.cos(ang) * r0, L.y + Math.sin(ang) * r0);
          ctx.lineTo(L.x + Math.cos(ang) * R1, L.y + Math.sin(ang) * R1);
        }
        ctx.stroke();
      }
    }

    // ---------- 主绘制 ----------
    draw(m, o, dt) {
      o = o || {};
      this.time += dt;
      // 自动画质：只统计正常帧（后台节流 / 卡顿帧不算），持续偏慢才降级，恢复流畅后再升回
      const raw = o.rawDt != null ? o.rawDt : dt;
      if (dt > 0 && raw < 0.12 && !document.hidden) {
        this.frameAvg = this.frameAvg * 0.98 + raw * 0.02;
        this.slowT = this.frameAvg > 0.028 ? (this.slowT || 0) + raw : 0;
        this.fastT = this.frameAvg < 0.019 ? (this.fastT || 0) + raw : 0;
        if (this.quality && this.slowT > 4) { this.quality = 0; this.slowT = 0; this.fastT = 0; this.resize(); }
        else if (!this.quality && this.fastT > 8 && !this.downgradedTwice) { this.quality = 1; this.fastT = 0; this.downgradedTwice = this.everDowngraded; this.everDowngraded = true; this.resize(); }
      }
      const ctx = this.ctx;
      const v = this.venue;
      this.updateCam(m, dt);

      this.applyCam(0.45);
      const st = this.vst;
      st.liveCrowd = !!(this.farCrowd && st.cheer > 0.02);
      ctx.drawImage(st.liveCrowd || !this.farCrowd ? this.far : this.farCrowd, 0, 0, this.W, this.H);
      if (v.drawFar) v.drawFar(ctx, this, this.time, this.vst, dt);

      this.applyCam(1);
      const nt = this.nearTop, d = this.dpr; // 近景层只贴有内容的下半部分
      ctx.drawImage(this.near, 0, Math.round(nt * d), this.near.width, this.near.height - Math.round(nt * d), 0, Math.round(nt * d) / d, this.W, this.H - Math.round(nt * d) / d);
      if (v.drawNear) v.drawNear(ctx, this, this.time, this.vst, dt);

      if (o.zone) this.drawZone(ctx, o.zone, 1);
      if (m.landMark && (m.phase === 'point' || m.phase === 'over' || m.phase === 'idle')) this.drawLandMark(ctx, m.landMark, m.time);
      if (o.hintIdx != null && m.hint) this.drawHint(ctx, m, o.hintIdx, m.hint, true);
      else if (o.landHint && m.pred && m.shuttle.live) {
        for (const i of o.landHint) if (m.shuttle.lastHitter !== i) this.drawHint(ctx, m, i, { landX: m.pred.landX }, false);
      }

      const humans = m.players.filter((p) => !(m.practice && p.idx === 1));
      for (const p of humans) {
        this.updateSpring(p, dt);
        const fast = (p.swing && p.swing.dur > 0.4 && p.swing.t < 0.3) || (!p.onGround && Math.abs(p.vy) > 1.5);
        this.ghostT[p.idx] -= dt;
        if (this.quality && fast && this.ghostT[p.idx] <= 0) {
          this.ghostT[p.idx] = 0.04;
          this.ghosts[p.idx].push({ p: Object.assign({}, p, { swing: p.swing ? Object.assign({}, p.swing) : null }), t: 0 });
          if (this.ghosts[p.idx].length > 4) this.ghosts[p.idx].shift();
        }
      }

      // 地板倒影
      if (this.quality && v.glossy > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(-50, this.gy, this.W + 100, this.H); ctx.clip();
        ctx.translate(0, 2 * this.gy); ctx.scale(1, -1);
        ctx.globalAlpha = v.glossy;
        for (const p of humans) this.drawCharAt(ctx, p, YY.LOOKS[p.idx], this.charOpts(p, m));
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      for (const p of humans) this.drawShadow(ctx, p);
      this.drawColumns(ctx, dt);
      this.drawNet(ctx);
      this.netWob = Math.max(0, this.netWob - dt * 1.8);

      const s = m.shuttle;
      if (s.live) {
        this.trail.push({ x: s.x, y: s.y, v: s.speed || 0 });
        if (this.trail.length > 22) this.trail.shift();
      } else if (this.trail.length) this.trail.splice(0, 2);

      for (const p of m.players) {
        if (m.practice && p.idx === 1) { this.drawMachine(ctx, p); continue; }
        const look = YY.LOOKS[p.idx];
        const gs = this.ghosts[p.idx];
        for (let i = gs.length - 1; i >= 0; i--) {
          const gh = gs[i];
          gh.t += dt;
          if (gh.t > 0.2) { gs.splice(i, 1); continue; }
          ctx.globalAlpha = 0.28 * (1 - gh.t / 0.2) * ((i + 1) / gs.length);
          this.drawCharAt(ctx, gh.p, look, this.charOpts(gh.p, m, { flat: look.shirt }));
        }
        ctx.globalAlpha = 1;
        this.drawCharAt(ctx, p, look, this.charOpts(p, m));
        this.drawSwoosh(ctx, p, look);
        if (o.labels && o.labels[p.idx]) {
          const X = this.sx(p.x), Y = this.sy(p.y + 2.2);
          const fs = Math.max(11, Math.round(0.19 * this.sc));
          ctx.font = `900 ${fs}px ${FONT}`;
          const tw = ctx.measureText(o.labels[p.idx]).width;
          ctx.fillStyle = look.shirt; rr(ctx, X - tw / 2 - 7, Y - fs - 6, tw + 14, fs + 6, (fs + 6) / 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(X - 4, Y); ctx.lineTo(X + 4, Y); ctx.lineTo(X, Y + 5); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(o.labels[p.idx], X, Y - fs / 2 - 3);
        }
      }
      this.drawTrail(ctx);
      this.drawShuttle(ctx, s);
      this.drawParts(ctx, dt);
      if (m.phase === 'serve' && !m.serving && o.meterFor && o.meterFor.includes(m.server)) this.drawServeMeter(ctx, m, o.serveLabel);
      this.drawTexts(ctx, dt);

      // 屏幕空间
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (v.drawFront && this.quality) v.drawFront(ctx, this, this.time, this.vst, dt);
      this.drawSpeedLines(ctx, dt);
      if (s.live && this.sy(s.y) < 4) {
        const X = this.sx(s.x);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(X, 6); ctx.lineTo(X - 8, 20); ctx.lineTo(X + 8, 20); ctx.closePath(); ctx.fill();
        ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(s.y.toFixed(1) + 'm', X, 22);
      }
      if (!o.noHud) {
        if (o.practice) this.drawPracticeHUD(ctx, o.practice);
        else this.drawScoreboard(ctx, m);
      }
      this.drawBanner(ctx, dt);
      if (o.waitText) {
        const fs = clamp(Math.round(this.H * 0.032), 14, 24);
        const Y = this.H * 0.5;
        ctx.fillStyle = 'rgba(6,8,24,0.78)';
        ctx.fillRect(0, Y - fs * 1.6, this.W, fs * 3.2);
        ctx.font = `bold ${fs}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd23f';
        const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
        ctx.fillText(o.waitText.replace(/…$/, dots), this.W / 2, Y);
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(${this.flashCol},${this.flash})`;
        ctx.fillRect(0, 0, this.W, this.H);
        this.flash = Math.max(0, this.flash - dt * 3);
      }
      if (o.overlayText) {
        const fs = Math.max(12, Math.round(this.H * 0.022));
        ctx.font = `bold ${fs}px ${FONT}`;
        const tw = ctx.measureText(o.overlayText).width;
        const y = this.H - (this.touch ? this.H * 0.21 : 12) - fs - 10;
        ctx.fillStyle = 'rgba(6,8,24,0.6)'; rr(ctx, this.W / 2 - tw / 2 - 14, y, tw + 28, fs + 12, (fs + 12) / 2); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(o.overlayText, this.W / 2, y + (fs + 12) / 2);
      }
    }
  }

  YY.Renderer = Renderer;
})(window);
