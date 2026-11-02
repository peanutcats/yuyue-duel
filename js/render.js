/* 羽跃对决 · Canvas 渲染：球馆、球场、角色、羽毛球、特效与 HUD */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, lerp } = YY;

  const LOOKS = [
    { shirt: '#ff5a5f', shirt2: '#c7353a', shorts: '#2b2f4a', hair: '#2a1b14', skin: '#f1c7a1', band: '#ffffff', racket: '#ffd23f' },
    { shirt: '#3ba3ff', shirt2: '#1f6fc4', shorts: '#1e2235', hair: '#111111', skin: '#e9b98f', band: '#ffd23f', racket: '#7dffb0' },
  ];
  YY.LOOKS = LOOKS;
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 挥拍关键帧：[时间, 角度]，角度以面向球网水平为 0°，向上为正
  const SWING_KEYS = {
    over: [[0, 150], [0.05, 168], [C.SW_SWEET, 72], [0.2, -35], [0.3, 30]],
    side: [[0, 160], [0.05, 176], [C.SW_SWEET, 12], [0.2, -50], [0.3, 40]],
    under: [[0, -130], [0.05, -155], [C.SW_SWEET, -35], [0.2, 70], [0.3, 50]],
    smash: [[0, 150], [0.06, 175], [C.SW_SWEET, 80], [0.18, -60], [0.4, -40], [0.56, 40]],
  };
  function keyAngle(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a0] = keys[i - 1], [t1, a1] = keys[i];
        const u = (t - t0) / (t1 - t0);
        const e = u * u * (3 - 2 * u);
        return lerp(a0, a1, e);
      }
    }
    return keys[keys.length - 1][1];
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.mirror = false;
      this.trail = [];
      this.parts = [];
      this.texts = [];
      this.banner = null;
      this.shake = 0;
      this.flash = 0;
      this.netWob = 0;
      this.touch = false;
      this.time = 0;
      this.shx = 0; this.shy = 0;
      this.crowd = [];
      for (let i = 0; i < 260; i++) {
        this.crowd.push({ u: Math.random(), row: Math.floor(Math.random() * 5), hue: Math.floor(Math.random() * 360), ph: Math.random() * 6.28 });
      }
      this.resize();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const W = window.innerWidth, H = window.innerHeight;
      this.W = W; this.H = H; this.dpr = dpr;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.width = W + 'px';
      this.cv.style.height = H + 'px';
      const bottom = this.touch ? H * 0.2 : H * 0.06;
      const top = this.touch ? Math.max(40, H * 0.08) : Math.max(54, H * 0.1);
      // 手机上纵向空间紧张：允许高远球短暂飞出画面顶部（有指示箭头）
      this.sc = Math.min(W / 17.4, (H - bottom - top) / (this.touch ? 6.4 : 7.4));
      this.gy = H - bottom - 0.35 * this.sc;
      this.cx = W / 2;
      this.ox = 0.1 * this.sc; // 斜投影：每米纵深的屏幕偏移
      this.oy = 0.085 * this.sc;
      this.bg = null;
    }

    sx(x) { return this.cx + (this.mirror ? -x : x) * this.sc + this.shx; }
    sy(y) { return this.gy - y * this.sc + this.shy; }
    // 带纵深 z（球场宽度方向，米）的投影
    P(x, y, z) {
      return [this.cx + (this.mirror ? -x : x) * this.sc + z * this.ox + this.shx, this.gy - y * this.sc + z * this.oy + this.shy];
    }

    clearFx() { this.trail = []; this.parts = []; this.texts = []; this.banner = null; }

    // ---------- 特效 ----------
    burst(x, y, n, color, spd, size) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, t: 0, color, size: size * (0.6 + Math.random() * 0.8), g: 3 });
      }
    }
    dust(x, n) {
      for (let i = 0; i < n; i++) {
        this.parts.push({ x: x + (Math.random() - 0.5) * 0.3, y: 0.02, vx: (Math.random() - 0.5) * 1.6, vy: Math.random() * 0.8, life: 0.4 + Math.random() * 0.3, t: 0, color: 'rgba(230,220,200,0.6)', size: 0.05 + Math.random() * 0.05, g: 1, dust: true });
      }
    }
    popText(text, x, y, color, size, life) {
      this.texts.push({ text, x, y, color: color || '#fff', size: size || 1, life: life || 1.1, t: 0 });
    }
    showBanner(text, sub, color, life) {
      this.banner = { text, sub: sub || '', color: color || '#fff', t: 0, life: life || 1.6 };
    }

    // ---------- 背景（缓存） ----------
    buildBg() {
      const W = this.W, H = this.H, dpr = this.dpr;
      const c = document.createElement('canvas');
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const save = [this.shx, this.shy];
      this.shx = 0; this.shy = 0;
      // 天幕
      const sky = g.createLinearGradient(0, 0, 0, this.gy);
      sky.addColorStop(0, '#0d1030');
      sky.addColorStop(0.55, '#1c1f4f');
      sky.addColorStop(1, '#2d2560');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // 灯光
      for (let i = 0; i < 4; i++) {
        const lx = W * (0.15 + i * 0.233);
        const rg = g.createRadialGradient(lx, -20, 5, lx, -20, H * 0.75);
        rg.addColorStop(0, 'rgba(255,240,200,0.22)');
        rg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,250,230,0.9)';
        g.beginPath(); g.ellipse(lx, 8, 26, 5, 0, 0, Math.PI * 2); g.fill();
      }
      // 看台
      const standTop = this.gy - 5.6 * this.sc, standBot = this.gy - 1.3 * this.sc;
      g.fillStyle = '#191a3d';
      g.fillRect(0, standTop, W, standBot - standTop);
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y = standTop + ((r + 0.6) / rows) * (standBot - standTop);
        g.fillStyle = r % 2 ? '#1f2148' : '#23264f';
        g.fillRect(0, y - (standBot - standTop) / rows / 2, W, (standBot - standTop) / rows);
      }
      for (const p of this.crowd) {
        const y = standTop + ((p.row + 0.55) / rows) * (standBot - standTop);
        const x = p.u * W;
        const s = (standBot - standTop) / rows * 0.26;
        g.fillStyle = `hsla(${p.hue},28%,${24 + p.row * 3}%,0.8)`;
        g.beginPath(); g.arc(x, y - s * 0.95, s * 0.5, 0, Math.PI * 2); g.fill();
        rr(g, x - s * 0.65, y - s * 0.4, s * 1.3, s * 1.3, s * 0.4); g.fill();
      }
      const dimG = g.createLinearGradient(0, standTop, 0, standBot);
      dimG.addColorStop(0, 'rgba(13,16,48,0.55)'); dimG.addColorStop(1, 'rgba(13,16,48,0.15)');
      g.fillStyle = dimG;
      g.fillRect(0, standTop, W, standBot - standTop);
      // 广告板
      const adTop = standBot, adH = 0.55 * this.sc;
      const ad = g.createLinearGradient(0, adTop, 0, adTop + adH);
      ad.addColorStop(0, '#2b3a8f'); ad.addColorStop(1, '#1b2566');
      g.fillStyle = ad;
      g.fillRect(0, adTop, W, adH);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = `bold ${Math.round(adH * 0.48)}px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const words = ['羽跃对决', 'YUYUE DUEL', '调动 · 空当 · 抓机会', '羽跃对决', 'SMASH!'];
      for (let i = 0; i < 5; i++) g.fillText(words[i], W * (0.1 + i * 0.2), adTop + adH / 2);
      // 后方地板
      const floorTop = adTop + adH;
      const fl = g.createLinearGradient(0, floorTop, 0, H);
      fl.addColorStop(0, '#6b3f22'); fl.addColorStop(1, '#a8693a');
      g.fillStyle = fl;
      g.fillRect(0, floorTop, W, H - floorTop);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 1;
      for (let y = floorTop + 6; y < H; y += 9 + (y - floorTop) * 0.06) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      }
      // 球场（斜投影平行四边形）
      const HW = 3.05, SW = 2.59;
      const quad = (x0, x1, z0, z1, fill) => {
        const a = this.P(x0, 0, z0), b = this.P(x1, 0, z0), cc = this.P(x1, 0, z1), d = this.P(x0, 0, z1);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath();
        g.fillStyle = fill; g.fill();
      };
      quad(-C.HALF - 0.6, C.HALF + 0.6, -HW - 0.5, HW + 0.5, '#1d5e43');
      quad(-C.HALF, C.HALF, -HW, HW, '#22875a');
      const line = (x0, z0, x1, z1, w, col) => {
        const a = this.P(x0, 0, z0), b = this.P(x1, 0, z1);
        g.strokeStyle = col || 'rgba(255,255,255,0.92)';
        g.lineWidth = w || Math.max(1.5, this.sc * 0.04);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      };
      for (const zz of [-HW, HW]) line(-C.HALF, zz, C.HALF, zz, 0, 'rgba(255,255,255,0.55)');
      for (const zz of [-SW, SW]) line(-C.HALF, zz, C.HALF, zz);
      for (const xx of [-C.HALF, C.HALF]) line(xx, -HW, xx, HW, Math.max(2, this.sc * 0.06));
      for (const xx of [-C.SHORT_LINE, C.SHORT_LINE]) line(xx, -HW, xx, HW);
      for (const xx of [-C.LONG_LINE, C.LONG_LINE]) line(xx, -HW, xx, HW, 0, 'rgba(255,255,255,0.45)');
      line(-C.HALF, 0, -C.SHORT_LINE, 0, 0, 'rgba(255,255,255,0.7)');
      line(C.SHORT_LINE, 0, C.HALF, 0, 0, 'rgba(255,255,255,0.7)');
      // 光照
      const sh = g.createRadialGradient(this.cx, this.gy, 10, this.cx, this.gy, W * 0.6);
      sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = sh;
      g.fillRect(0, floorTop, W, H - floorTop);
      this.shx = save[0]; this.shy = save[1];
      this.bg = c;
    }

    drawNet(ctx) {
      const HW = 3.05;
      const w = Math.sin(this.time * 40) * this.netWob * 0.06;
      // 网带向下填充，上沿就是物理网高；晃动不移动 z=0 的实际过网位置。
      const tape = 0.06;
      const top = (z) => this.P(w * Math.sin(z), C.NET_H, z);
      const bot = (z) => this.P(0, 0.79, z);
      // 网面
      ctx.beginPath();
      const t0 = top(-HW), t1 = top(HW), b1 = bot(HW), b0 = bot(-HW);
      ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]); ctx.closePath();
      ctx.fillStyle = 'rgba(20,20,30,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,230,240,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 14; i++) {
        const z = -HW + (i / 14) * HW * 2;
        const a = top(z), b = bot(z);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (let j = 1; j < 6; j++) {
        const y = 0.79 + (j / 6) * (C.NET_H - 0.79);
        const a = this.P(0, y, -HW), b = this.P(0, y, HW);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // 网带
      const tape0 = this.P(w * Math.sin(-HW), C.NET_H - tape, -HW);
      const tape1 = this.P(w * Math.sin(HW), C.NET_H - tape, HW);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]);
      ctx.lineTo(tape1[0], tape1[1]); ctx.lineTo(tape0[0], tape0[1]);
      ctx.closePath(); ctx.fill();
      // 网柱
      for (const z of [-HW, HW]) {
        const a = this.P(0, 0, z), b = this.P(0, C.NET_H + 0.05, z);
        ctx.strokeStyle = '#d9dde8';
        ctx.lineWidth = Math.max(3, this.sc * 0.07);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    racketAngle(p) {
      const sw = p.swing;
      if (!sw) return 55 + Math.sin(this.time * 3 + p.idx) * 4;
      let keys = SWING_KEYS[sw.kind] || SWING_KEYS.over;
      if (sw.dur > 0.4) keys = SWING_KEYS.smash;
      return keyAngle(keys, sw.t);
    }

    racketPose(p) {
      const a = this.racketAngle(p) * Math.PI / 180;
      let x = Math.cos(a) * C.ARM, y = Math.sin(a) * C.ARM;
      const sw = p.swing;
      if (sw && sw.contact && sw.t >= sw.contact.t) {
        // 在真实击球点短暂停留，再收拍；扑救容差体现为伸手接球。
        let u = clamp((sw.t - sw.contact.t - 0.035) / 0.12, 0, 1);
        u = u * u * (3 - 2 * u);
        x = lerp((sw.contact.x - p.x) * p.dir, x, u);
        y = lerp(sw.contact.y - p.y - C.SHOULDER, y, u);
      } else if (sw && sw.serve) {
        const u = clamp((sw.t - 0.04) / 0.06, 0, 1);
        x = lerp(x, 0.42, u);
        y = lerp(y, 0.9 - C.SHOULDER, u);
      }
      return { x, y };
    }

    drawPlayer(ctx, p, look, label) {
      const k = this.sc;
      const f = (this.mirror ? -1 : 1) * p.dir;
      const X = this.sx(p.x), Y = this.sy(p.y);
      // 影子
      const gy0 = this.sy(0);
      const sa = clamp(1 - p.y / 1.5, 0.25, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.32 * sa})`;
      ctx.beginPath(); ctx.ellipse(X, gy0, 0.36 * k * sa, 0.07 * k, 0, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.translate(X, Y);
      ctx.scale(f, 1);
      const run = Math.min(1, Math.abs(p.vx) / 4);
      const ph = p.runPhase;
      const air = !p.onGround;
      const smashing = p.swing && p.swing.dur > 0.4 && p.swing.t < 0.3;
      const lean = smashing ? 0.25 : air ? -0.08 : run * 0.12 * Math.sign(p.vx * p.dir);
      const crouch = p.land > 0 ? 0.08 : 0;
      const hipY = -(0.9 - crouch) * k;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 腿
      const leg = (a1, a2, col) => {
        const kx = Math.sin(a1) * 0.45 * k, ky = hipY + Math.cos(a1) * 0.45 * k;
        const fx = kx + Math.sin(a2) * 0.45 * k, fy = ky + Math.cos(a2) * 0.45 * k;
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.13 * k;
        ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.ellipse(fx + 0.06 * k, fy, 0.11 * k, 0.055 * k, 0, 0, Math.PI * 2); ctx.fill();
      };
      if (air) {
        leg(0.5, -0.3, look.skin);
        leg(-0.2, 0.5, look.skin);
      } else {
        const s1 = Math.sin(ph) * 0.65 * run;
        leg(s1 + 0.12, s1 * 0.5 + (s1 > 0 ? -0.1 : 0.3) * run, look.skin);
        leg(-s1 - 0.05, -s1 * 0.5 + (s1 < 0 ? -0.1 : 0.3) * run, look.skin);
      }
      // 短裤
      ctx.fillStyle = look.shorts;
      rr(ctx, -0.17 * k, hipY - 0.08 * k, 0.34 * k, 0.24 * k, 0.05 * k);
      ctx.fill();
      // 躯干
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(lean);
      const torsoH = 0.55 * k;
      const grd = ctx.createLinearGradient(0, -torsoH, 0, 0);
      grd.addColorStop(0, look.shirt); grd.addColorStop(1, look.shirt2);
      ctx.fillStyle = grd;
      rr(ctx, -0.19 * k, -torsoH, 0.38 * k, torsoH + 0.04 * k, 0.1 * k);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.round(0.18 * k)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.scale(f, 1); ctx.fillText(p.idx === 0 ? '1' : '2', 0, -torsoH * 0.5); ctx.restore();
      // 头
      const hx = 0.03 * k, hy = -torsoH - 0.2 * k;
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.arc(hx, hy, 0.14 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.hair;
      ctx.beginPath(); ctx.arc(hx - 0.02 * k, hy - 0.03 * k, 0.145 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.strokeStyle = look.band;
      ctx.lineWidth = 0.035 * k;
      ctx.beginPath(); ctx.arc(hx, hy, 0.135 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(hx + 0.07 * k, hy + 0.0 * k, 0.018 * k, 0, Math.PI * 2); ctx.fill();
      // 非持拍手
      const shY = -torsoH + 0.06 * k;
      ctx.strokeStyle = look.skin;
      ctx.lineWidth = 0.08 * k;
      const offA = p.swing ? -0.3 : 0.6 + Math.sin(ph) * 0.3 * run;
      ctx.beginPath(); ctx.moveTo(-0.05 * k, shY);
      ctx.lineTo(Math.cos(offA) * 0.3 * k, shY - Math.sin(offA) * 0.3 * k + 0.1 * k);
      ctx.lineTo(Math.cos(offA) * 0.5 * k, shY - Math.sin(offA) * 0.42 * k + 0.12 * k);
      ctx.stroke();
      ctx.restore();
      // 持拍手 + 球拍
      // 回到选手坐标：肩高和拍面中心与物理甜区使用同一个坐标系。
      const pose = this.racketPose(p);
      const ang = Math.atan2(pose.y, pose.x);
      const ax = Math.cos(ang), ay = -Math.sin(ang);
      const shoulderY = -C.SHOULDER * k;
      const reach = Math.hypot(pose.x, pose.y);
      const ex = pose.x * 0.34 * k, ey = shoulderY - pose.y * 0.34 * k;
      const hx2 = pose.x * 0.62 * k, hy2 = shoulderY - pose.y * 0.62 * k;
      ctx.strokeStyle = look.skin;
      ctx.lineWidth = 0.085 * k;
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(ex, ey); ctx.lineTo(hx2, hy2); ctx.stroke();
      const rx = pose.x * k - ax * 0.15 * k, ry = shoulderY - pose.y * k - ay * 0.15 * k;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.035 * k;
      ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(rx, ry); ctx.stroke();
      const cxh = rx + ax * 0.15 * k, cyh = ry + ay * 0.15 * k;
      ctx.save();
      ctx.translate(cxh, cyh);
      ctx.rotate(Math.atan2(ay, ax));
      if (p.flash > 0) {
        ctx.fillStyle = `rgba(255,255,200,${p.flash * 4})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * k, 0.24 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = look.racket;
      ctx.lineWidth = 0.035 * k;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.15 * k, 0.11 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      // 挥拍残影
      if (p.swing && p.swing.t < 0.22 && p.swing.t > 0.03) {
        const prev = this.racketPose({ ...p, swing: { ...p.swing, t: p.swing.t - 0.05 } });
        const a0 = Math.atan2(prev.y, prev.x);
        ctx.strokeStyle = p.swing.dur > 0.4 ? 'rgba(255,170,60,0.55)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.12 * k;
        ctx.beginPath();
        ctx.arc(0, shoulderY, reach * k, -Math.max(a0, ang), -Math.min(a0, ang));
        ctx.stroke();
      }
      ctx.restore();

      // 头顶体力条（未满时）
      if (p.stamina < C.STAM_MAX - 0.5) {
        const bw = 0.7 * k, bh = Math.max(4, 0.07 * k);
        const bx = X - bw / 2, by = Y - 2.05 * k;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        rr(ctx, bx - 1, by - 1, bw + 2, bh + 2, 3); ctx.fill();
        const r = p.stamina / C.STAM_MAX;
        ctx.fillStyle = p.stamina >= C.JUMP_COST + C.SMASH_COST ? '#5cff9d' : p.stamina >= C.SMASH_COST ? '#ffc94d' : '#ff5d5d';
        rr(ctx, bx, by, bw * r, bh, 2); ctx.fill();
      }
      if (label) {
        ctx.font = `bold ${Math.max(11, Math.round(0.2 * k))}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(label, X + 1, Y - 2.12 * k + 1);
        ctx.fillStyle = look.shirt;
        ctx.fillText(label, X, Y - 2.12 * k);
      }
    }

    drawMachine(ctx, p) {
      const k = this.sc;
      const X = this.sx(p.x), Y = this.sy(0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(X, Y, 0.5 * k, 0.08 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a6380';
      rr(ctx, X - 0.35 * k, Y - 0.9 * k, 0.7 * k, 0.75 * k, 0.1 * k); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      rr(ctx, X - 0.25 * k, Y - 1.5 * k, 0.5 * k, 0.6 * k, 0.08 * k); ctx.fill();
      ctx.fillStyle = '#222';
      const f = this.mirror ? 1 : -1;
      ctx.beginPath(); ctx.arc(X + f * 0.18 * k, Y - 1.25 * k, 0.09 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(0.16 * k)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('发球机', X, Y - 0.5 * k);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.05 * k;
      ctx.beginPath(); ctx.moveTo(X - 0.3 * k, Y - 0.12 * k); ctx.lineTo(X - 0.3 * k, Y); ctx.moveTo(X + 0.3 * k, Y - 0.12 * k); ctx.lineTo(X + 0.3 * k, Y); ctx.stroke();
    }

    drawShuttle(ctx, s) {
      const k = this.sc;
      const X = this.sx(s.x), Y = this.sy(s.y);
      // 影子
      if (s.y > 0.02) {
        const a = clamp(0.35 - s.y * 0.03, 0.08, 0.35);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.beginPath(); ctx.ellipse(X, this.sy(0), 0.1 * k, 0.03 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
      let ang;
      if (s.held) ang = Math.PI / 2;
      else if (!s.live) ang = 0.2;
      else {
        const vx = this.mirror ? -s.vx : s.vx;
        ang = Math.atan2(-s.vy, vx); // 屏幕坐标中的运动方向
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      }
      const sz = k * C.SHUTTLE_R / 2.8;
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(s.held ? Math.PI / 2 : ang);
      // 羽毛裙（在球头后方）
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(160,170,190,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2 * sz, -2.2 * sz);
      ctx.lineTo(-13 * sz, -6 * sz);
      ctx.lineTo(-13 * sz, 6 * sz);
      ctx.lineTo(-2 * sz, 2.2 * sz);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,160,180,0.7)';
      ctx.beginPath(); ctx.moveTo(-8 * sz, -4.1 * sz); ctx.lineTo(-8 * sz, 4.1 * sz); ctx.stroke();
      // 球头
      ctx.fillStyle = '#f7e9cf';
      ctx.beginPath(); ctx.arc(0, 0, 2.8 * sz, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-2.2 * sz, -2.4 * sz, 1.2 * sz, 4.8 * sz);
      ctx.restore();
    }

    drawTrail(ctx, s) {
      const tr = this.trail;
      if (tr.length < 2) return;
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i];
        const u = i / tr.length;
        const fast = b.v > 16;
        ctx.strokeStyle = fast ? `rgba(255,${Math.round(120 + 80 * u)},60,${u * 0.85})` : `rgba(255,255,255,${u * 0.4})`;
        ctx.lineWidth = (fast ? 7 : 3) * u * Math.max(1, this.sc / 70);
        ctx.beginPath(); ctx.moveTo(this.sx(a.x), this.sy(a.y)); ctx.lineTo(this.sx(b.x), this.sy(b.y)); ctx.stroke();
      }
    }

    drawLandMark(ctx, lm, now) {
      const age = now - lm.t;
      if (age > 2.5) return;
      const a = this.P(lm.x, 0, 0);
      const col = lm.inB ? '#5cff9d' : '#ff5d5d';
      ctx.strokeStyle = col;
      ctx.globalAlpha = clamp(1.6 - age * 0.6, 0, 1);
      ctx.lineWidth = 3;
      const r = 0.22 * this.sc * (1 + Math.min(age, 0.3));
      ctx.beginPath(); ctx.ellipse(a[0], a[1], r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.max(12, Math.round(0.24 * this.sc))}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lm.inB ? '界内' : '出界', a[0], a[1] + 0.12 * this.sc);
      ctx.globalAlpha = 1;
    }

    drawHint(ctx, m, idx, h, full) {
      const k = this.sc;
      if (h.landX != null && Math.sign(h.landX) === m.players[idx].side) {
        const a = this.P(h.landX, 0, 0);
        const pulse = 1 + Math.sin(this.time * 10) * 0.12;
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.2 * k * pulse, 0.06 * k * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a[0] - 0.12 * k, a[1]); ctx.lineTo(a[0] + 0.12 * k, a[1]); ctx.stroke();
        const out = Math.abs(h.landX) > C.HALF + C.LINE_TOL;
        if (out) {
          ctx.fillStyle = '#ff7b7b';
          ctx.font = `bold ${Math.max(11, Math.round(0.2 * k))}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('会出界', a[0], a[1] + 0.1 * k);
        }
      }
      if (!full) return;
      if (h.standX != null) {
        const a = this.P(h.standX, 0, 0);
        ctx.strokeStyle = 'rgba(80,230,255,0.85)'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 1.75 * k); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(80,230,255,0.25)';
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.3 * k, 0.08 * k, 0, 0, Math.PI * 2); ctx.fill();
      }
      const p = m.players[idx];
      const t = m.time;
      let cue = null, col = '#fff';
      if (h.jumpAt != null && t > h.jumpAt - 0.12 && t < h.jumpAt + 0.06 && p.onGround) { cue = '起跳！'; col = '#ffd23f'; }
      else if (t > h.swingAt - 0.1 && t < h.swingAt + 0.05) { cue = '挥拍！'; col = '#5cff9d'; }
      else if (t < h.swingAt - 0.1 && h.swingAt - t < 0.6) {
        // 倒计时圆环
        const u = clamp((h.swingAt - t) / 0.6, 0, 1);
        const X = this.sx(p.x), Y = this.sy(p.y + C.SHOULDER);
        ctx.strokeStyle = 'rgba(92,255,157,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X, Y, (0.3 + u * 0.9) * k, 0, Math.PI * 2); ctx.stroke();
      }
      if (cue) {
        const X = this.sx(p.x), Y = this.sy(p.y + 2.3);
        ctx.font = `900 ${Math.max(18, Math.round(0.42 * k))}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(cue, X, Y);
        ctx.fillStyle = col; ctx.fillText(cue, X, Y);
      }
    }

    drawZone(ctx, zone, side) {
      const a = this.P(side * zone[0], 0, -2.59), b = this.P(side * zone[1], 0, -2.59), c = this.P(side * zone[1], 0, 2.59), d = this.P(side * zone[0], 0, 2.59);
      ctx.fillStyle = `rgba(255,210,63,${0.18 + Math.sin(this.time * 4) * 0.06})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    }

    drawServeMeter(ctx, m, keysLabel) {
      const p = m.players[m.server];
      const k = this.sc;
      const X = this.sx(p.x), Y = this.sy(2.55);
      const w = 1.7 * k, h = Math.max(10, 0.16 * k);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      rr(ctx, X - w / 2 - 4, Y - h / 2 - 4, w + 8, h + 8, 8); ctx.fill();
      const g = ctx.createLinearGradient(X - w / 2, 0, X + w / 2, 0);
      g.addColorStop(0, '#ff5d5d'); g.addColorStop(0.3, '#ffc94d'); g.addColorStop(0.5, '#5cff9d'); g.addColorStop(0.7, '#ffc94d'); g.addColorStop(1, '#ff5d5d');
      ctx.fillStyle = g;
      rr(ctx, X - w / 2, Y - h / 2, w, h, 4); ctx.fill();
      const mv = m.serving ? m.serving.q : null;
      const pos = m.serveMeter();
      const mx = X - w / 2 + pos * w;
      ctx.fillStyle = '#fff';
      ctx.fillRect(mx - 2, Y - h / 2 - 5, 4, h + 10);
      if (keysLabel && mv == null) {
        ctx.font = `bold ${Math.max(11, Math.round(0.19 * k))}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#fff';
        ctx.fillText(keysLabel, X, Y - h / 2 - 8);
      }
    }

    drawHUD(ctx, m, o) {
      const W = this.W;
      const order = this.mirror ? [1, 0] : [0, 1];
      const fs = clamp(Math.round(this.H * 0.045), 16, 34);
      const bw = Math.min(W * 0.5, 420), bh = fs * 1.75;
      const bx = W / 2 - bw / 2, by = 8;
      if (!m.practice) {
        ctx.fillStyle = 'rgba(8,10,30,0.72)';
        rr(ctx, bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.textBaseline = 'middle';
        for (let j = 0; j < 2; j++) {
          const i = order[j];
          const look = LOOKS[i];
          const left = j === 0;
          ctx.font = `bold ${Math.round(fs * 0.55)}px ${FONT}`;
          ctx.textAlign = left ? 'left' : 'right';
          ctx.fillStyle = look.shirt;
          ctx.fillText(m.names[i], left ? bx + 14 : bx + bw - 14, by + bh / 2);
          ctx.font = `900 ${fs}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          const sx = W / 2 + (left ? -1 : 1) * bw * 0.13;
          ctx.fillText(String(m.score[i]), sx, by + bh / 2 + 1);
          if (m.server === i && (m.phase === 'serve' || m.phase === 'rally')) {
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath(); ctx.arc(sx + (left ? -1 : 1) * fs * 0.85, by + bh / 2, fs * 0.14, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `bold ${Math.round(fs * 0.7)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(':', W / 2, by + bh / 2);
        ctx.font = `${Math.max(10, Math.round(fs * 0.38))}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(`${m.opt.target} 分制 · 需领先 2 分 · ${m.opt.cap} 分封顶`, W / 2, by + bh + fs * 0.42);
        if (m.rally >= 3 && m.phase === 'rally') {
          ctx.font = `bold ${Math.round(fs * 0.5)}px ${FONT}`;
          ctx.fillStyle = '#ffd23f';
          ctx.fillText(`回合 ${m.rally}`, W / 2, by + bh + fs * 1.05);
        }
      }
      // 角落体力条
      const sw = Math.max(60, Math.min(W * 0.2, 190, (W - (m.practice ? Math.min(W * 0.62, 560) : bw)) / 2 - (o.padLeft || 0) - 26)), shh = Math.max(8, fs * 0.32);
      for (let j = 0; j < 2; j++) {
        const i = order[j];
        if (m.practice && i === 1) continue;
        const p = m.players[i];
        const left = j === 0;
        const x0 = left ? 14 + (o.padLeft || 0) : W - 14 - sw;
        const y0 = by + 4;
        ctx.font = `bold ${Math.max(10, Math.round(fs * 0.4))}px ${FONT}`;
        ctx.textAlign = left ? 'left' : 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('体力', left ? x0 : x0 + sw, y0);
        const yb = y0 + fs * 0.55;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        rr(ctx, x0, yb, sw, shh, shh / 2); ctx.fill();
        const r = clamp(p.stamina / C.STAM_MAX, 0, 1);
        ctx.fillStyle = p.stamina >= C.JUMP_COST + C.SMASH_COST ? '#5cff9d' : p.stamina >= C.SMASH_COST ? '#ffc94d' : '#ff5d5d';
        const fw = sw * r;
        if (left) rr(ctx, x0, yb, Math.max(fw, shh), shh, shh / 2);
        else rr(ctx, x0 + sw - Math.max(fw, shh), yb, Math.max(fw, shh), shh, shh / 2);
        ctx.fill();
        // 跳杀所需体力刻度
        const need = (C.JUMP_COST + C.SMASH_COST) / C.STAM_MAX;
        const mx = left ? x0 + sw * need : x0 + sw - sw * need;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(mx - 1, yb - 2, 2, shh + 4);
      }
      // 羽毛球超出画面顶部指示
      const s = m.shuttle;
      if (s.live && this.sy(s.y) < 4) {
        const X = this.sx(s.x);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(X, 6); ctx.lineTo(X - 8, 20); ctx.lineTo(X + 8, 20); ctx.closePath(); ctx.fill();
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(s.y.toFixed(1) + 'm', X, 22);
      }
    }

    drawPracticeHUD(ctx, pr) {
      const W = this.W;
      const fs = clamp(Math.round(this.H * 0.04), 14, 28);
      const bw = Math.min(W * 0.62, 560), bh = fs * 2.6;
      const bx = W / 2 - bw / 2, by = 8;
      ctx.fillStyle = 'rgba(8,10,30,0.72)';
      rr(ctx, bx, by, bw, bh, 12); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(fs * 0.8)}px ${FONT}`;
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(`${pr.def.name}   成功 ${pr.ok} / ${pr.att}   连续 ${pr.streak}（最佳 ${pr.best}）`, W / 2, by + bh * 0.32);
      ctx.font = `${Math.round(fs * 0.62)}px ${FONT}`;
      ctx.fillStyle = pr.msgColor;
      ctx.fillText(pr.msg, W / 2, by + bh * 0.72);
    }

    // ---------- 主绘制 ----------
    draw(m, o, dt) {
      o = o || {};
      this.time += dt;
      const ctx = this.ctx;
      if (!this.bg) this.buildBg();
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const sh = this.shake * this.shake * this.sc * 0.25;
      this.shx = (Math.random() - 0.5) * sh;
      this.shy = (Math.random() - 0.5) * sh;
      this.netWob = Math.max(0, this.netWob - dt * 2.5);

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.drawImage(this.bg, this.shx, this.shy, this.W, this.H);

      if (o.zone) this.drawZone(ctx, o.zone, 1);
      if (m.landMark && (m.phase === 'point' || m.phase === 'over' || m.phase === 'idle')) this.drawLandMark(ctx, m.landMark, m.time);
      if (o.hintIdx != null && m.hint) this.drawHint(ctx, m, o.hintIdx, m.hint, true);
      else if (o.landHint && m.pred && m.shuttle.live) {
        for (const i of o.landHint) {
          if (m.shuttle.lastHitter !== i) this.drawHint(ctx, m, i, { landX: m.pred.landX }, false);
        }
      }

      this.drawNet(ctx);

      // 轨迹
      const s = m.shuttle;
      if (s.live) {
        this.trail.push({ x: s.x, y: s.y, v: s.speed || 0 });
        if (this.trail.length > 18) this.trail.shift();
      } else if (this.trail.length) this.trail.shift();
      this.drawTrail(ctx, s);

      for (const p of m.players) {
        if (m.practice && p.idx === 1) this.drawMachine(ctx, p);
        else this.drawPlayer(ctx, p, LOOKS[p.idx], o.labels ? o.labels[p.idx] : null);
      }
      this.drawShuttle(ctx, s);

      // 粒子
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const q = this.parts[i];
        q.t += dt;
        if (q.t >= q.life) { this.parts.splice(i, 1); continue; }
        q.vy -= q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        const a = 1 - q.t / q.life;
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(this.sx(q.x), this.sy(q.y), Math.max(1, q.size * this.sc), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (m.phase === 'serve' && !m.serving && o.meterFor && o.meterFor.includes(m.server)) this.drawServeMeter(ctx, m, o.serveLabel);

      // 浮动文字
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t += dt;
        if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
        const u = t.t / t.life;
        const X = this.sx(t.x), Y = this.sy(t.y + u * 0.6);
        const sz = Math.max(13, Math.round(0.3 * this.sc * t.size)) * (u < 0.12 ? 0.6 + u * 3.3 : 1);
        ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
        ctx.font = `900 ${Math.round(sz)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(t.text, X, Y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, X, Y);
      }
      ctx.globalAlpha = 1;

      if (!o.noHud) this.drawHUD(ctx, m, o);
      if (o.practice) this.drawPracticeHUD(ctx, o.practice);

      if (this.banner) {
        const b = this.banner;
        b.t += dt;
        if (b.t >= b.life) this.banner = null;
        else {
          const u = b.t / b.life;
          const a = u < 0.1 ? u / 0.1 : u > 0.8 ? (1 - u) / 0.2 : 1;
          const fs = clamp(Math.round(this.H * 0.08), 26, 64);
          const Y = this.H * 0.36;
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(0, Y - fs * 0.9, this.W, fs * (b.sub ? 2.1 : 1.6));
          ctx.font = `900 ${fs}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = b.color;
          ctx.fillText(b.text, this.W / 2 + (1 - Math.min(1, u * 8)) * 40, Y - fs * 0.1);
          if (b.sub) {
            ctx.font = `bold ${Math.round(fs * 0.42)}px ${FONT}`;
            ctx.fillStyle = '#fff';
            ctx.fillText(b.sub, this.W / 2, Y + fs * 0.72);
          }
          ctx.globalAlpha = 1;
        }
      }
      if (o.waitText) {
        const fs = clamp(Math.round(this.H * 0.032), 14, 24);
        const Y = this.H * 0.5;
        ctx.fillStyle = 'rgba(6,8,24,0.72)';
        ctx.fillRect(0, Y - fs * 1.6, this.W, fs * 3.2);
        ctx.font = `bold ${fs}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd23f';
        const dots = '.'.repeat(1 + (Math.floor(this.time * 2) % 3));
        ctx.fillText(o.waitText.replace(/…$/, dots), this.W / 2, Y);
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,240,220,${this.flash})`;
        ctx.fillRect(0, 0, this.W, this.H);
        this.flash = Math.max(0, this.flash - dt * 3);
      }
      if (o.overlayText) {
        ctx.font = `bold ${Math.max(14, Math.round(this.H * 0.03))}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(o.overlayText, this.W / 2, this.H - (this.touch ? this.H * 0.21 : 10));
      }
    }
  }

  YY.Renderer = Renderer;
})(window);
