/* 羽跃对决 · 场馆：静态层（缓存）+ 动态层（灯光、观众、天气、霓虹） */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
  const NUMF = '"DIN Alternate","Bahnschrift","Arial Black",sans-serif';
  YY.FONT = FONT; YY.NUMF = NUMF;

  /** 屏幕几何：世界坐标 → 屏幕（不含镜像与镜头） */
  YY.geometry = function (W, H, touch) {
    const bottom = touch ? H * 0.2 : H * 0.06;
    const top = touch ? Math.max(40, H * 0.08) : Math.max(58, H * 0.11);
    const sc = Math.min(W / 17.4, (H - bottom - top) / (touch ? 6.4 : 7.4));
    const gy = H - bottom - 0.35 * sc;
    const V = { W, H, sc, gy, cx: W / 2, ox: 0.1 * sc, oy: 0.085 * sc };
    V.standTop = gy - 5.8 * sc;
    V.adTop = gy - 1.3 * sc;
    V.adH = 0.55 * sc;
    V.floorTop = V.adTop + V.adH;
    V.P = (x, y, z) => [V.cx + x * sc + z * V.ox, gy - y * sc + z * V.oy];
    return V;
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  YY.rr = rr;
  function quad(g, V, x0, x1, z0, z1) {
    const a = V.P(x0, 0, z0), b = V.P(x1, 0, z0), c = V.P(x1, 0, z1), d = V.P(x0, 0, z1);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
  }
  function seg(g, V, x0, z0, x1, z1) {
    const a = V.P(x0, 0, z0), b = V.P(x1, 0, z1);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  }
  const HW = 3.05, SW = 2.59;
  /** 球场线 */
  function courtLines(g, V, col, w) {
    g.beginPath();
    for (const z of [-HW, HW, -SW, SW]) seg(g, V, -C.HALF, z, C.HALF, z);
    for (const x of [-C.HALF, C.HALF, -C.SHORT_LINE, C.SHORT_LINE, -C.LONG_LINE, C.LONG_LINE]) seg(g, V, x, -HW, x, HW);
    seg(g, V, -C.HALF, 0, -C.SHORT_LINE, 0);
    seg(g, V, C.SHORT_LINE, 0, C.HALF, 0);
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  }
  function court(g, V, surround, main, line, noise) {
    quad(g, V, -C.HALF - 0.9, C.HALF + 0.9, -HW - 0.9, HW + 0.9);
    g.fillStyle = surround; g.fill();
    quad(g, V, -C.HALF, C.HALF, -HW, HW);
    const a = V.P(0, 0, -HW), b = V.P(0, 0, HW);
    const gr = g.createLinearGradient(0, a[1], 0, b[1]);
    gr.addColorStop(0, YY.shade(main, 0.88)); gr.addColorStop(1, YY.shade(main, 1.08));
    g.fillStyle = gr; g.fill();
    if (noise) {
      const r = rng(7);
      g.save(); quad(g, V, -C.HALF, C.HALF, -HW, HW); g.clip();
      g.fillStyle = 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 900; i++) {
        const p = V.P(-C.HALF + r() * C.HALF * 2, 0, -HW + r() * HW * 2);
        g.fillRect(p[0], p[1], 1.2, 1.2);
      }
      g.restore();
    }
    if (line) courtLines(g, V, line, Math.max(1.5, V.sc * 0.045));
  }

  /** 观众条带（每排一张画布，便于做欢呼波浪） */
  function crowdStrips(V, seed, opts) {
    const r = rng(seed);
    const rows = 6;
    const top = V.standTop + V.sc * 0.5, bot = V.adTop + V.sc * 0.1;
    const rh = (bot - top) / rows;
    const strips = [];
    for (let row = 0; row < rows; row++) {
      const c = YY.platform.createCanvas();
      const dpr = V.dpr || 1;
      const h = rh * 1.9;
      c.width = Math.max(1, Math.round(V.W * dpr)); c.height = Math.max(1, Math.round(h * dpr));
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = rh * (0.34 + row * 0.03);
      const n = Math.floor(V.W / (s * 1.25));
      const light = (opts.light || 0.55) + row * (opts.lightStep || 0.08);
      for (let i = 0; i < n; i++) {
        if (r() < (opts.empty || 0.05)) continue;
        const x = (i + 0.5 + (r() - 0.5) * 0.5) * (V.W / n);
        const y = h - rh * 0.25 + (r() - 0.5) * rh * 0.15;
        const shirt = opts.shirts[Math.floor(r() * opts.shirts.length)];
        const skin = opts.skins[Math.floor(r() * opts.skins.length)];
        g.globalAlpha = opts.alpha != null ? opts.alpha : 1;
        g.fillStyle = YY.shade(shirt, light);
        rr(g, x - s * 0.62, y - s * 1.1, s * 1.24, s * 1.4, s * 0.45); g.fill();
        g.fillStyle = YY.shade(skin, light);
        g.beginPath(); g.arc(x, y - s * 1.45, s * 0.42, 0, Math.PI * 2); g.fill();
        g.fillStyle = YY.shade(opts.hairs[Math.floor(r() * opts.hairs.length)], light);
        g.beginPath(); g.arc(x, y - s * 1.55, s * 0.42, Math.PI * 1.05, Math.PI * 1.95); g.fill();
        if (r() < (opts.flags != null ? opts.flags : 0.1)) { // 举旗 / 灯牌
          g.fillStyle = YY.shade(r() < 0.5 ? '#ff4b55' : '#2f9bff', light + 0.1);
          g.fillRect(x + s * 0.3, y - s * 3.1, s * 1.3, s * 0.85);
          g.fillStyle = 'rgba(255,255,255,0.7)';
          g.fillRect(x + s * 0.3, y - s * 3.1, s * 0.08, s * 2.2);
        }
      }
      strips.push({ c, y: top + row * rh + rh - h, h, row });
    }
    return strips;
  }

  // ======================================================================
  // 场馆一：星光体育馆（夜场室内）
  // ======================================================================
  const arena = {
    id: 'arena', name: '星光体育馆', desc: '夜场聚光灯 · 抛光木地板', glossy: 0.22,
    shadow: { skew: 0, len: 1, alpha: 0.38 },
    paintFar(g, V) {
      const { W, H, sc } = V;
      const bg = g.createLinearGradient(0, 0, 0, V.adTop);
      bg.addColorStop(0, '#05071a'); bg.addColorStop(0.5, '#10143a'); bg.addColorStop(1, '#1b1d4c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // 屋顶桁架
      const ty = Math.max(14, V.standTop - 1.7 * sc);
      g.strokeStyle = 'rgba(120,130,190,0.28)'; g.lineWidth = Math.max(1, sc * 0.03);
      g.beginPath(); g.moveTo(0, ty); g.lineTo(W, ty); g.moveTo(0, ty + sc * 0.32); g.lineTo(W, ty + sc * 0.32);
      for (let x = 0; x < W; x += sc * 0.6) { g.moveTo(x, ty); g.lineTo(x + sc * 0.3, ty + sc * 0.32); g.lineTo(x + sc * 0.6, ty); }
      g.stroke();
      V.lamps = [];
      for (let i = 0; i < 6; i++) {
        const lx = W * (0.09 + i * 0.164), ly = ty + sc * 0.42;
        V.lamps.push([lx, ly]);
        const gl = g.createRadialGradient(lx, ly, 2, lx, ly, sc * 1.6);
        gl.addColorStop(0, 'rgba(255,244,214,0.5)'); gl.addColorStop(1, 'rgba(255,244,214,0)');
        g.fillStyle = gl; g.fillRect(lx - sc * 1.6, ly - sc * 1.6, sc * 3.2, sc * 3.2);
        g.fillStyle = '#2a2f55'; rr(g, lx - sc * 0.28, ly - sc * 0.14, sc * 0.56, sc * 0.2, 3); g.fill();
        g.fillStyle = '#fffbe8'; rr(g, lx - sc * 0.22, ly + sc * 0.02, sc * 0.44, sc * 0.07, 2); g.fill();
      }
      // 看台
      const st = V.standTop, sb = V.adTop + V.adH * 0.5;
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const y0 = st + (i / tiers) * (sb - st), y1 = st + ((i + 1) / tiers) * (sb - st);
        const gr = g.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, i % 2 ? '#1c2155' : '#20265e'); gr.addColorStop(1, '#141842');
        g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y0, W, 1);
      }
      for (let i = 1; i < 6; i++) {
        const x = (W / 6) * i;
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x - sc * 0.18, st, sc * 0.36, sb - st);
      }
      // 上层看台横幅
      const by = st - sc * 0.32;
      const ban = g.createLinearGradient(0, by, 0, by + sc * 0.3);
      ban.addColorStop(0, '#ff4b55'); ban.addColorStop(1, '#a3152a');
      g.fillStyle = ban; g.fillRect(0, by, W, sc * 0.3);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = `900 ${Math.round(sc * 0.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) g.fillText(i % 2 ? 'YUYUE OPEN · 羽跃杯' : '羽跃杯 · 全国羽毛球公开赛', W * (0.125 + i * 0.25), by + sc * 0.155);
      // 两侧挂旗
      for (const [x, col] of [[W * 0.04, '#ff4b55'], [W * 0.96, '#2f9bff']]) {
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x - sc * 0.35, ty + sc * 0.4); g.lineTo(x + sc * 0.35, ty + sc * 0.4);
        g.lineTo(x + sc * 0.35, ty + sc * 2.6); g.lineTo(x, ty + sc * 2.3); g.lineTo(x - sc * 0.35, ty + sc * 2.6); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.font = `900 ${Math.round(sc * 0.3)}px ${FONT}`;
        g.fillText(col === '#ff4b55' ? '羽' : '跃', x, ty + sc * 1.2);
      }
    },
    paintNear(g, V) {
      const { W, H, sc } = V;
      // LED 广告板框
      g.fillStyle = '#0b0d1c'; g.fillRect(0, V.adTop - 3, W, V.adH + 6);
      g.fillStyle = '#05060f'; g.fillRect(0, V.adTop, W, V.adH);
      // 木地板
      const ft = V.floorTop;
      const fl = g.createLinearGradient(0, ft, 0, H);
      fl.addColorStop(0, '#4a2a14'); fl.addColorStop(0.4, '#7a4724'); fl.addColorStop(1, '#a8693a');
      g.fillStyle = fl; g.fillRect(0, ft, W, H - ft);
      const r = rng(3);
      let y = ft + 3, k = 0;
      while (y < H) {
        const h = 4 + (y - ft) * 0.07;
        g.fillStyle = k % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,220,170,0.03)';
        g.fillRect(0, y, W, h);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, W, 1);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = r() * 80; x < W; x += 60 + r() * 120) g.fillRect(x, y, 1, h);
        y += h; k++;
      }
      // 地板反光
      const sh = g.createRadialGradient(V.cx, V.gy, 10, V.cx, V.gy, W * 0.55);
      sh.addColorStop(0, 'rgba(255,240,210,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = sh; g.fillRect(0, ft, W, H - ft);
      court(g, V, '#155a3f', '#1f8a5c', 'rgba(255,255,255,0.95)', true);
      // 裁判椅（球网后方）
      const base = V.P(0, 0, -4.6), seat = V.P(0, 1.55, -4.6);
      g.strokeStyle = '#3a3f5c'; g.lineWidth = Math.max(2, sc * 0.05);
      g.beginPath();
      g.moveTo(base[0] - sc * 0.3, base[1]); g.lineTo(seat[0] - sc * 0.18, seat[1]);
      g.moveTo(base[0] + sc * 0.3, base[1]); g.lineTo(seat[0] + sc * 0.18, seat[1]);
      for (let i = 1; i < 4; i++) { const yy = base[1] - (base[1] - seat[1]) * (i / 4); g.moveTo(base[0] - sc * 0.25, yy); g.lineTo(base[0] + sc * 0.25, yy); }
      g.stroke();
      g.fillStyle = '#2a2f4a'; rr(g, seat[0] - sc * 0.28, seat[1] - sc * 0.08, sc * 0.56, sc * 0.12, 3); g.fill();
      g.fillStyle = '#e8e8f0'; rr(g, seat[0] - sc * 0.16, seat[1] - sc * 0.62, sc * 0.32, sc * 0.55, sc * 0.1); g.fill();
      g.fillStyle = '#e7b993'; g.beginPath(); g.arc(seat[0], seat[1] - sc * 0.78, sc * 0.13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(seat[0], seat[1] - sc * 0.83, sc * 0.13, Math.PI, 0); g.fill();
    },
    init(V, R) {
      const st = { cheer: 0, flashes: [], motes: [], led: null };
      st.strips = crowdStrips(V, 11, {
        shirts: ['#ff4b55', '#2f9bff', '#d9dce8', '#ffd23f', '#3a3f6b', '#ff8a3d', '#6a4cd6', '#3a3f6b', '#2a2f55'],
        skins: ['#f1c7a1', '#e0ac85', '#c98e64', '#f5d4b5'], hairs: ['#1b1416', '#3a2a20', '#6b4a2d', '#111'],
        light: 0.3, lightStep: 0.055,
      });
      for (let i = 0; i < 46; i++) st.motes.push({ x: Math.random(), y: Math.random(), s: Math.random() });
      return st;
    },
    event(st, type, d) {
      if (type === 'point') { st.cheer = 1; st.led = { text: d.text, color: d.color, t: 0 }; }
      if (type === 'smash') st.cheer = Math.max(st.cheer, 0.45);
      if (type === 'over') { st.cheer = 1.4; st.led = { text: d.text, color: d.color, t: -1.5 }; }
    },
    nearTop(V) { return Math.min(V.adTop - 6, V.P(0, 2.6, -4.6)[1]); },
    bakeFar(g, V) {
      // 聚光灯光柱（静态烘焙，省去每帧大面积叠加混合）
      g.globalCompositeOperation = 'lighter';
      for (const [lx, ly] of V.lamps || []) {
        const fx = V.cx + (lx - V.cx) * 0.35, fy = V.gy;
        const w0 = V.sc * 0.2, w1 = V.sc * 1.5;
        const gr = g.createLinearGradient(lx, ly, fx, fy);
        gr.addColorStop(0, 'rgba(255,240,205,0.16)'); gr.addColorStop(1, 'rgba(255,240,205,0.0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(lx - w0, ly); g.lineTo(lx + w0, ly); g.lineTo(fx + w1, fy); g.lineTo(fx - w1, fy); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    },
    afterCrowd(g, V) {
      // 看台暗部：让视觉焦点回到明亮的球场
      const hz = g.createLinearGradient(0, V.standTop, 0, V.adTop);
      hz.addColorStop(0, 'rgba(6,8,26,0.55)'); hz.addColorStop(1, 'rgba(6,8,26,0.12)');
      g.fillStyle = hz; g.fillRect(0, V.standTop - V.sc * 0.4, V.W, V.adTop - V.standTop + V.sc * 0.4);
    },
    drawFar(ctx, R, t, st, dt) {
      st.cheer = Math.max(0, st.cheer - dt * 0.45);
      if (st.liveCrowd) {
        for (const s of st.strips) {
          const bounce = Math.abs(Math.sin(t * 11 + s.row * 0.9)) * st.cheer * s.h * 0.16;
          ctx.drawImage(s.c, 0, s.y - bounce, R.W, s.h);
        }
        this.afterCrowd(ctx, R.V);
      }
      // 观众闪光灯
      const rate = 0.6 + st.cheer * 26;
      if (Math.random() < rate * dt) st.flashes.push({ x: Math.random() * R.W, y: R.V.standTop + Math.random() * (R.V.adTop - R.V.standTop), t: 0 });
      ctx.globalCompositeOperation = 'lighter';
      for (let i = st.flashes.length - 1; i >= 0; i--) {
        const f = st.flashes[i];
        f.t += dt;
        if (f.t > 0.25) { st.flashes.splice(i, 1); continue; }
        const a = 1 - f.t / 0.25, s = R.sc * 0.18 * a;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(f.x - s, f.y - 1, s * 2, 2); ctx.fillRect(f.x - 1, f.y - s, 2, s * 2);
      }
      // 光柱中的浮尘
      for (const m of st.motes) {
        m.y -= dt * 0.01 * (0.5 + m.s); m.x += Math.sin(t + m.s * 10) * dt * 0.004;
        if (m.y < 0) m.y = 1;
        const x = m.x * R.W, y = R.V.standTop + m.y * (R.gy - R.V.standTop);
        ctx.fillStyle = `rgba(255,240,210,${0.25 + 0.3 * Math.sin(t * 2 + m.s * 9) ** 2})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    drawNear(ctx, R, t, st, dt) {
      const V = R.V;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, V.adTop, R.W, V.adH); ctx.clip();
      const h = V.adH;
      if (st.led && st.led.t < 2.2) {
        st.led.t += dt;
        const on = Math.floor(t * 8) % 2 === 0;
        const gr = ctx.createLinearGradient(0, V.adTop, 0, V.adTop + h);
        gr.addColorStop(0, st.led.color); gr.addColorStop(1, YY.shade(st.led.color, 0.45));
        ctx.fillStyle = on ? gr : '#05060f';
        ctx.fillRect(0, V.adTop, R.W, h);
        ctx.fillStyle = on ? '#fff' : st.led.color;
        ctx.font = `italic 900 ${Math.round(h * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 3; i++) ctx.fillText(st.led.text, R.W * (0.17 + i * 0.33), V.adTop + h / 2);
      } else {
        const words = [['羽跃对决', '#ffd23f'], ['YUYUE DUEL', '#ffffff'], ['SMASH!', '#ff4b55'], ['调动 · 空当 · 抓机会', '#7dfcff'], ['羽跃杯公开赛', '#ffffff']];
        ctx.font = `italic 900 ${Math.round(h * 0.5)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const gap = R.W * 0.26;
        const off = (t * 50) % (gap * words.length);
        for (let i = -1; i < words.length * 2; i++) {
          const x = i * gap - off;
          if (x > R.W || x < -gap) continue;
          const w = words[((i % words.length) + words.length) % words.length];
          ctx.fillStyle = w[1];
          ctx.fillText(w[0], x, V.adTop + h / 2);
        }
      }
      // LED 点阵质感
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = V.adTop; y < V.adTop + h; y += 3) ctx.fillRect(0, y, R.W, 1);
      ctx.restore();
    },
  };

  // ======================================================================
  // 场馆二：落日天台（户外黄昏）
  // ======================================================================
  const sunset = {
    id: 'sunset', name: '落日天台', desc: '城市黄昏 · 串灯与晚风', glossy: 0,
    shadow: { skew: -1.6, len: 2.4, alpha: 0.32 },
    paintFar(g, V) {
      const { W, H, sc } = V;
      const hz = V.adTop + V.adH * 0.3;
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#1c1a4d'); sky.addColorStop(0.35, '#5b3478'); sky.addColorStop(0.68, '#e5615f'); sky.addColorStop(1, '#ffc178');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const r = rng(21);
      // 星星
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) { const y = r() * hz * 0.3; g.globalAlpha = 0.3 + r() * 0.6; g.fillRect(r() * W, y, 1.4, 1.4); }
      g.globalAlpha = 1;
      // 太阳
      const sx = W * 0.7, sy = hz - sc * 1.0, sr = sc * 0.95;
      V.sun = [sx, sy, sr];
      const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
      glow.addColorStop(0, 'rgba(255,214,140,0.65)'); glow.addColorStop(1, 'rgba(255,140,90,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, hz + sc);
      const sun = g.createRadialGradient(sx, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
      sun.addColorStop(0, '#fffbe4'); sun.addColorStop(0.7, '#ffd37a'); sun.addColorStop(1, '#ff9f5a');
      g.fillStyle = sun; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(229,97,95,0.35)';
      for (let i = 0; i < 4; i++) g.fillRect(sx - sr, sy + sr * (0.15 + i * 0.22), sr * 2, sr * 0.06);
      // 远景云层
      for (let i = 0; i < 9; i++) {
        const cx = r() * W, cy = hz * (0.25 + r() * 0.45), w = sc * (1.5 + r() * 2.5);
        g.fillStyle = `rgba(255,${150 + r() * 60 | 0},${150 + r() * 40 | 0},${0.18 + r() * 0.15})`;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + (k - 1.5) * w * 0.35, cy + (r() - 0.5) * sc * 0.2, w * 0.4, sc * 0.18, 0, 0, Math.PI * 2); g.fill(); }
      }
      // 城市天际线（两层）
      const sky1 = (col, base, maxH, minW, maxW, lit) => {
        let x = -10;
        while (x < W + 10) {
          const w = sc * (minW + r() * (maxW - minW)), h = sc * (maxH * (0.35 + r() * 0.65));
          g.fillStyle = col; g.fillRect(x, base - h, w, h + 2);
          if (r() < 0.25) { g.fillRect(x + w * 0.45, base - h - sc * 0.5, sc * 0.04, sc * 0.5); }
          if (lit) {
            for (let yy = base - h + sc * 0.15; yy < base - sc * 0.1; yy += sc * 0.18)
              for (let xx = x + sc * 0.08; xx < x + w - sc * 0.08; xx += sc * 0.16)
                if (r() < 0.32) { g.fillStyle = r() < 0.8 ? 'rgba(255,214,130,0.85)' : 'rgba(170,220,255,0.8)'; g.fillRect(xx, yy, sc * 0.07, sc * 0.08); }
            g.fillStyle = col;
          }
          x += w + sc * r() * 0.15;
        }
      };
      sky1('rgba(108,64,120,0.85)', hz, 3.4, 0.6, 1.4, false);
      // 电视塔
      const tx = W * 0.22;
      g.fillStyle = '#3c2752';
      g.beginPath(); g.moveTo(tx - sc * 0.12, hz); g.lineTo(tx - sc * 0.05, hz - sc * 3.6); g.lineTo(tx + sc * 0.05, hz - sc * 3.6); g.lineTo(tx + sc * 0.12, hz); g.fill();
      g.beginPath(); g.ellipse(tx, hz - sc * 2.6, sc * 0.3, sc * 0.18, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(tx - 1, hz - sc * 4.4, 2, sc * 0.8);
      V.towerTip = [tx, hz - sc * 4.4];
      sky1('#2a1d43', hz + 2, 2.2, 0.5, 1.2, true);
      // 水塔
      const wx = W * 0.88, wy = hz;
      g.fillStyle = '#1d1430';
      g.fillRect(wx - sc * 0.5, wy - sc * 1.9, sc * 1.0, sc * 0.9);
      g.beginPath(); g.moveTo(wx - sc * 0.55, wy - sc * 1.9); g.lineTo(wx, wy - sc * 2.3); g.lineTo(wx + sc * 0.55, wy - sc * 1.9); g.fill();
      g.fillRect(wx - sc * 0.4, wy - sc * 1.0, sc * 0.05, sc * 1.0); g.fillRect(wx + sc * 0.35, wy - sc * 1.0, sc * 0.05, sc * 1.0);
    },
    paintNear(g, V) {
      const { W, H, sc } = V;
      // 女儿墙 + 栏杆
      const pt = V.adTop + V.adH * 0.3;
      g.strokeStyle = 'rgba(40,25,50,0.9)'; g.lineWidth = Math.max(1.5, sc * 0.035);
      g.beginPath(); g.moveTo(0, pt - sc * 0.55); g.lineTo(W, pt - sc * 0.55);
      for (let x = 0; x < W; x += sc * 0.45) { g.moveTo(x, pt - sc * 0.55); g.lineTo(x, pt); }
      g.stroke();
      const wall = g.createLinearGradient(0, pt, 0, V.floorTop);
      wall.addColorStop(0, '#8a6f73'); wall.addColorStop(1, '#5a4552');
      g.fillStyle = wall; g.fillRect(0, pt, W, V.floorTop - pt);
      g.fillStyle = 'rgba(255,200,150,0.35)'; g.fillRect(0, pt, W, 2);
      // 屋顶地砖
      const ft = V.floorTop;
      const fl = g.createLinearGradient(0, ft, 0, H);
      fl.addColorStop(0, '#7d6870'); fl.addColorStop(1, '#b39a8f');
      g.fillStyle = fl; g.fillRect(0, ft, W, H - ft);
      g.strokeStyle = 'rgba(40,25,30,0.18)'; g.lineWidth = 1;
      g.beginPath();
      for (let z = -9; z <= 8; z += 1.2) seg(g, V, -12, z, 12, z);
      for (let x = -12; x <= 12; x += 1.2) seg(g, V, x, -9, x, 8);
      g.stroke();
      const warm = g.createLinearGradient(W, ft, 0, H);
      warm.addColorStop(0, 'rgba(255,170,100,0.3)'); warm.addColorStop(1, 'rgba(60,20,60,0.25)');
      g.fillStyle = warm; g.fillRect(0, ft, W, H - ft);
      court(g, V, '#2a6e66', '#33978a', 'rgba(255,250,240,0.9)', true);
      // 道具：盆栽、空调外机、长椅、灯杆
      const pot = (x, z, s) => {
        const p = V.P(x, 0, z);
        g.fillStyle = '#5b3a2e'; rr(g, p[0] - sc * 0.25 * s, p[1] - sc * 0.4 * s, sc * 0.5 * s, sc * 0.4 * s, 4); g.fill();
        g.fillStyle = '#2f5d3a';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(p[0] + (i - 2.5) * sc * 0.1 * s, p[1] - sc * (0.65 + (i % 3) * 0.15) * s, sc * 0.16 * s, sc * 0.34 * s, (i - 2.5) * 0.25, 0, Math.PI * 2); g.fill(); }
      };
      pot(-8.2, -3.5, 1.1); pot(8.3, -3.2, 1.0);
      const ac = V.P(-7.3, 0, -7);
      g.fillStyle = '#6d6470'; g.fillRect(ac[0] - sc * 0.5, ac[1] - sc * 0.6, sc * 1.0, sc * 0.6);
      g.strokeStyle = '#4a424f'; g.beginPath(); g.arc(ac[0], ac[1] - sc * 0.3, sc * 0.2, 0, Math.PI * 2); g.stroke();
    },
    nearTop(V) { return V.adTop + V.adH * 0.3 - V.sc * 0.62; },
    tint(g, V) {
      // 夕阳暖光（烘焙进缓存层，不再逐帧全屏叠加）
      const w = g.createLinearGradient(V.W, 0, V.W * 0.3, V.H);
      w.addColorStop(0, 'rgba(255,150,80,0.12)'); w.addColorStop(1, 'rgba(255,150,80,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = w; g.fillRect(0, 0, V.W, V.H); g.restore();
    },
    init(V) {
      const st = { clouds: [], birds: [], flies: [], cheer: 0 };
      for (let i = 0; i < 5; i++) st.clouds.push({ x: Math.random(), y: 0.15 + Math.random() * 0.4, w: 1.5 + Math.random() * 2, s: 0.004 + Math.random() * 0.006 });
      for (let i = 0; i < 26; i++) st.flies.push({ x: Math.random() * 18 - 9, y: Math.random() * 5, ph: Math.random() * 6 });
      return st;
    },
    event(st, type) { if (type === 'point' || type === 'over') st.cheer = 1; },
    drawFar(ctx, R, t, st, dt) {
      const V = R.V, hz = V.adTop;
      for (const c of st.clouds) {
        c.x += c.s * dt; if (c.x > 1.2) c.x = -0.2;
        const x = c.x * R.W, y = c.y * hz, w = c.w * R.sc;
        ctx.fillStyle = 'rgba(255,190,170,0.16)';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x + (k - 1) * w * 0.4, y + (k % 2) * R.sc * 0.08, w * 0.45, R.sc * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      if (Math.random() < dt * 0.12 && st.birds.length < 4) st.birds.push({ x: -0.05, y: 0.15 + Math.random() * 0.3, s: 0.04 + Math.random() * 0.03, ph: Math.random() * 6 });
      ctx.strokeStyle = 'rgba(40,20,50,0.75)'; ctx.lineWidth = 1.5;
      for (let i = st.birds.length - 1; i >= 0; i--) {
        const b = st.birds[i];
        b.x += b.s * dt; if (b.x > 1.1) { st.birds.splice(i, 1); continue; }
        const x = b.x * R.W, y = b.y * hz, f = Math.sin(t * 9 + b.ph) * R.sc * 0.08, w = R.sc * 0.14;
        ctx.beginPath(); ctx.moveTo(x - w, y - f); ctx.quadraticCurveTo(x - w * 0.4, y - f * 0.3 - 2, x, y); ctx.quadraticCurveTo(x + w * 0.4, y - f * 0.3 - 2, x + w, y - f); ctx.stroke();
      }
      // 电视塔航标灯
      if (V.towerTip && Math.floor(t * 1.2) % 2 === 0) {
        ctx.fillStyle = '#ff5050';
        ctx.beginPath(); ctx.arc(V.towerTip[0], V.towerTip[1], 2.5, 0, Math.PI * 2); ctx.fill();
      }
    },
    drawNear(ctx, R, t, st, dt) {
      // 串灯（世界坐标，随风轻摆）
      const V = R.V;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#2a1d35'; ctx.lineWidth = Math.max(2, R.sc * 0.06);
      ctx.beginPath();
      for (const x of [-8.6, 8.6]) { const a = V.P(x, 0, -3.4), b = V.P(x, 5.6, -3.4); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      for (let line = 0; line < 2; line++) {
        const z = -3.4, h = 5.5 - line * 0.35, sag = 0.9 + line * 0.25;
        const pts = [];
        for (let i = 0; i <= 28; i++) {
          const u = i / 28, x = -8.6 + u * 17.2;
          const y = h - Math.sin(u * Math.PI) * sag + Math.sin(t * 1.4 + u * 6 + line) * 0.05 * Math.sin(u * Math.PI);
          pts.push(V.P(x, y, z));
        }
        ctx.strokeStyle = 'rgba(30,18,30,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < pts.length; i += 2) {
          const p = pts[i];
          const fl = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7 + line) + st.cheer * 0.4 * Math.sin(t * 20 + i);
          const r = R.sc * 0.22;
          const gr = ctx.createRadialGradient(p[0], p[1] + 3, 0, p[0], p[1] + 3, r);
          const col = i % 6 === 1 ? '255,120,140' : i % 6 === 3 ? '140,220,255' : '255,214,140';
          gr.addColorStop(0, `rgba(${col},${0.85 * fl})`); gr.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = gr; ctx.fillRect(p[0] - r, p[1] + 3 - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      st.cheer = Math.max(0, st.cheer - dt * 0.6);
      // 萤火 / 暖光尘
      ctx.globalCompositeOperation = 'lighter';
      for (const f of st.flies) {
        f.y += dt * 0.15; f.x += Math.sin(t * 0.7 + f.ph) * dt * 0.2;
        if (f.y > 6) { f.y = 0; f.x = Math.random() * 18 - 9; }
        const p = V.P(f.x, f.y, -1);
        const a = 0.35 + 0.35 * Math.sin(t * 2.5 + f.ph);
        ctx.fillStyle = `rgba(255,210,140,${a})`;
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    drawFront(ctx, R, t) {
      const s = R.V.sun;
      if (!s) return;
      ctx.globalCompositeOperation = 'lighter';
      // 镜头光晕
      const vx = R.W / 2 - s[0], vy = R.H / 2 - s[1];
      [[0.4, 0.12, '255,200,140'], [0.75, 0.06, '255,140,180'], [1.2, 0.18, '180,200,255']].forEach(([k, r, col]) => {
        ctx.fillStyle = `rgba(${col},0.07)`;
        ctx.beginPath(); ctx.arc(s[0] + vx * k, s[1] + vy * k, R.sc * r * 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  // ======================================================================
  // 场馆三：霓虹电竞场
  // ======================================================================
  function neonText(g, text, x, y, size, col, font) {
    g.font = font || `italic 900 ${size}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const [w, a] of [[size * 0.5, 0.06], [size * 0.28, 0.12], [size * 0.14, 0.25], [size * 0.06, 0.6]]) {
      g.strokeStyle = col.replace('A', a); g.lineWidth = w; g.strokeText(text, x, y);
    }
    g.fillStyle = '#ffffff'; g.fillText(text, x, y);
  }
  const neon = {
    id: 'neon', name: '霓虹电竞场', desc: '霓虹激光 · 发光球场线', glossy: 0.3,
    shadow: { skew: 0, len: 1, alpha: 0.5 },
    paintFar(g, V) {
      const { W, H, sc } = V;
      const bg = g.createLinearGradient(0, 0, 0, V.adTop);
      bg.addColorStop(0, '#030010'); bg.addColorStop(0.6, '#0b0425'); bg.addColorStop(1, '#170735');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // 背墙几何面板
      const r = rng(5);
      g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = r() * W, y = r() * V.standTop, s = sc * (0.6 + r() * 1.6);
        g.strokeStyle = r() < 0.5 ? 'rgba(0,240,255,0.14)' : 'rgba(255,0,170,0.14)';
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; k ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath(); g.stroke();
      }
      // 看台
      const st = V.standTop, sb = V.adTop + V.adH * 0.5;
      for (let i = 0; i < 6; i++) {
        const y0 = st + (i / 6) * (sb - st), y1 = st + ((i + 1) / 6) * (sb - st);
        g.fillStyle = i % 2 ? '#0d0826' : '#110a2f'; g.fillRect(0, y0, W, y1 - y0);
        g.fillStyle = i % 2 ? 'rgba(0,240,255,0.35)' : 'rgba(255,0,170,0.35)'; g.fillRect(0, y1 - 1.5, W, 1.5);
      }
    },
    nearTop(V) { return V.adTop - 4; },
    paintNear(g, V) {
      const { W, H, sc } = V;
      g.fillStyle = '#05020f'; g.fillRect(0, V.adTop - 3, W, V.adH + 6);
      const edge = g.createLinearGradient(0, 0, W, 0);
      edge.addColorStop(0, '#ff00aa'); edge.addColorStop(0.5, '#00f0ff'); edge.addColorStop(1, '#ff00aa');
      g.fillStyle = edge; g.fillRect(0, V.adTop - 3, W, 2); g.fillRect(0, V.adTop + V.adH + 1, W, 2);
      // 地面
      const ft = V.floorTop;
      const fl = g.createLinearGradient(0, ft, 0, H);
      fl.addColorStop(0, '#05030f'); fl.addColorStop(1, '#0d0a26');
      g.fillStyle = fl; g.fillRect(0, ft, W, H - ft);
      g.lineWidth = 1;
      for (let z = -9; z <= 8; z += 1) { g.strokeStyle = `rgba(0,240,255,${0.05 + (z + 9) * 0.008})`; g.beginPath(); seg(g, V, -12, z, 12, z); g.stroke(); }
      g.strokeStyle = 'rgba(0,240,255,0.1)';
      g.beginPath(); for (let x = -12; x <= 12; x += 1) seg(g, V, x, -9, x, 8); g.stroke();
      court(g, V, '#0a0d2a', '#0d1a46', null, false);
      courtLines(g, V, 'rgba(0,240,255,0.18)', Math.max(5, sc * 0.2));
      courtLines(g, V, 'rgba(0,240,255,0.45)', Math.max(2.5, sc * 0.08));
      courtLines(g, V, 'rgba(220,255,255,0.95)', Math.max(1, sc * 0.03));
      // 场边灯带
      g.strokeStyle = 'rgba(255,0,170,0.5)'; g.lineWidth = Math.max(2, sc * 0.05);
      g.beginPath(); seg(g, V, -C.HALF - 0.9, -HW - 0.9, C.HALF + 0.9, -HW - 0.9); seg(g, V, -C.HALF - 0.9, HW + 0.9, C.HALF + 0.9, HW + 0.9); g.stroke();
    },
    init(V) {
      const st = { pulse: 0, cheer: 0, parts: [], sticks: [] };
      // 霓虹招牌单独缓存，便于做闪烁
      const sc = V.sc, w = Math.round(sc * 9), h = Math.round(sc * 2.2);
      const dpr = V.dpr || 1;
      const c = YY.platform.createCanvas();
      c.width = Math.max(1, w * dpr); c.height = Math.max(1, h * dpr);
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      neonText(g, '羽跃', w * 0.3, h * 0.5, sc * 1.05, 'rgba(255,0,170,A)');
      neonText(g, 'DUEL', w * 0.72, h * 0.52, sc * 0.95, 'rgba(0,240,255,A)', `italic 900 ${sc * 0.95}px ${NUMF}`);
      st.sign = { c, w, h };
      const r = rng(9);
      const top = V.standTop + sc * 0.4, bot = V.adTop;
      for (let i = 0; i < 70; i++) st.sticks.push({ x: r() * V.W, y: top + r() * (bot - top), ph: r() * 6, col: r() < 0.5 ? '0,240,255' : r() < 0.5 ? '255,0,170' : '255,230,90' });
      st.strips = crowdStrips(V, 31, { shirts: ['#1a1238', '#22184a', '#140e30'], skins: ['#2c2050', '#33255a'], hairs: ['#0d0820'], alpha: 1, flags: 0 });
      for (let i = 0; i < 40; i++) st.parts.push({ x: Math.random() * 18 - 9, y: Math.random() * 7, s: Math.random() });
      return st;
    },
    event(st, type) {
      if (type === 'hit') st.pulse = Math.max(st.pulse, 0.5);
      if (type === 'smash') st.pulse = 1.3;
      if (type === 'point' || type === 'over') { st.pulse = 1.5; st.cheer = 1; }
    },
    drawFar(ctx, R, t, st, dt) {
      const V = R.V;
      st.cheer = Math.max(0, st.cheer - dt * 0.5);
      if (st.liveCrowd) {
        for (const s of st.strips) {
          const bounce = Math.abs(Math.sin(t * 11 + s.row)) * st.cheer * s.h * 0.15;
          ctx.drawImage(s.c, 0, s.y - bounce, R.W, s.h);
        }
      }
      // 招牌
      const sg = st.sign;
      const flick = Math.random() < 0.015 ? 0.35 : 0.92 + Math.sin(t * 30) * 0.04;
      ctx.globalAlpha = flick;
      ctx.drawImage(sg.c, R.cx - sg.w / 2, Math.max(4, V.standTop - sg.h - R.sc * 0.2), sg.w, sg.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      // 荧光棒
      for (const s of st.sticks) {
        const a = Math.sin(t * (2 + st.cheer * 6) + s.ph) * 0.6;
        const L = R.sc * 0.28;
        ctx.strokeStyle = `rgba(${s.col},${0.55 + st.cheer * 0.4})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.sin(a) * L, s.y - Math.cos(a) * L); ctx.stroke();
      }
      // 激光
      for (let i = 0; i < 4; i++) {
        const left = i % 2 === 0;
        const ox = left ? 0 : R.W, oy = 0;
        const ang = Math.sin(t * (0.5 + i * 0.13) + i * 2) * 0.5 + (left ? 0.9 : Math.PI - 0.9);
        const L = R.W * 1.2;
        const ex = ox + Math.cos(ang) * L, ey = oy + Math.sin(ang) * L;
        const col = i < 2 ? '0,240,255' : '255,0,170';
        const gr = ctx.createLinearGradient(ox, oy, ex, ey);
        gr.addColorStop(0, `rgba(${col},0.55)`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.strokeStyle = gr; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 8; ctx.globalAlpha = 0.15; ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    drawNear(ctx, R, t, st, dt) {
      const V = R.V;
      st.pulse = Math.max(0, st.pulse - dt * 1.6);
      ctx.globalCompositeOperation = 'lighter';
      // 球场线脉冲
      if (st.pulse > 0.02) courtLines(ctx, V, `rgba(0,240,255,${0.35 * st.pulse})`, Math.max(6, R.sc * 0.26));
      // 扫描线
      const sx = ((t * 0.18) % 1.4 - 0.2) * 26 - 13;
      ctx.strokeStyle = 'rgba(255,0,170,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); seg(ctx, V, sx, -9, sx, 8); ctx.stroke();
      // 浮动粒子
      for (const p of st.parts) {
        p.y += dt * (0.2 + p.s * 0.3); if (p.y > 7.5) { p.y = 0; p.x = Math.random() * 18 - 9; }
        const q = V.P(p.x, p.y, -2);
        ctx.fillStyle = p.s < 0.5 ? 'rgba(0,240,255,0.5)' : 'rgba(255,0,170,0.5)';
        ctx.fillRect(q[0], q[1], 2, 2);
      }
      // LED 条
      ctx.font = `italic 900 ${Math.round(V.adH * 0.5)}px ${NUMF}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const msg = 'YUYUE DUEL  ✦  SMASH  ✦  羽跃对决  ✦  ';
      const w = ctx.measureText(msg).width;
      const off = (t * 70) % w;
      ctx.fillStyle = `rgba(0,240,255,${0.55 + st.pulse * 0.3})`;
      ctx.save(); ctx.beginPath(); ctx.rect(0, V.adTop, R.W, V.adH); ctx.clip();
      for (let x = -off; x < R.W; x += w) ctx.fillText(msg, x, V.adTop + V.adH / 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  YY.VENUES = { arena, sunset, neon };
  YY.VENUE_IDS = ['arena', 'sunset', 'neon'];

  /** 场馆缩略图（菜单用） */
  YY.venueThumb = function (id, w, h) {
    const v = YY.VENUES[id];
    const c = YY.platform.createCanvas();
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const V = YY.geometry(w, h, false);
    V.dpr = 1;
    v.paintFar(g, V);
    if (v.bakeFar) v.bakeFar(g, V);
    const st = v.init(V);
    if (st.strips) for (const s of st.strips) g.drawImage(s.c, 0, s.y, w, s.h);
    if (v.afterCrowd) v.afterCrowd(g, V);
    const fakeR = { W: w, H: h, sc: V.sc, cx: V.cx, gy: V.gy, V };
    if (v.drawFar) v.drawFar(g, fakeR, 2, st, 0);
    v.paintNear(g, V);
    if (v.tint) v.tint(g, V);
    if (v.drawNear) v.drawNear(g, fakeR, 2, st, 0);
    if (v.drawFront) v.drawFront(g, fakeR, 2, st);
    return c;
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
