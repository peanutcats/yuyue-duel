/* 羽跃对决 · 剧情场景：手绘风格的背景（烘焙缓存）+ 动态氛围层 + 视觉小说式人物站位与演出
 * 每个场景：bake(g, W, H, rnd) 画静态背景；fx(g, W, H, t, st) 画动态层（back 在人物后，front 在人物前）。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const { clamp, lerp } = YY;
  const TAU = Math.PI * 2;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
  const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
  const box = (g, x, y, w, h, fill, r) => { g.fillStyle = fill; if (r) { YY.rr(g, x, y, w, h, r); g.fill(); } else g.fillRect(x, y, w, h); };
  const glow = (g, x, y, r, rgb, a) => { g.fillStyle = rad(g, x, y, 0, r, [[0, `rgba(${rgb},${a})`], [1, `rgba(${rgb},0)`]]); g.fillRect(x - r, y - r, r * 2, r * 2); };
  const add = (g, fn) => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };

  // ---------- 通用元素 ----------
  function woodFloor(g, W, H, y0, c0, c1) {
    g.fillStyle = lin(g, 0, y0, 0, H, [[0, c0], [1, c1]]); g.fillRect(0, y0, W, H - y0);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.02, y0); g.lineTo(W / 2 + i * W * 0.16, H); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y0, W, 2);
  }
  function courtLines(g, W, H, y0) {
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W * 0.08, H); g.lineTo(W * 0.3, y0 + 4); g.lineTo(W * 0.7, y0 + 4); g.lineTo(W * 0.92, H); g.stroke();
    g.beginPath(); g.moveTo(W * 0.5, y0 + 4); g.lineTo(W * 0.5, H); g.stroke();
  }
  function net(g, W, H, y0, h) {
    const x0 = W * 0.22, x1 = W * 0.78, top = y0 - h;
    g.strokeStyle = 'rgba(30,30,40,0.9)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x0, y0 + 10); g.lineTo(x0, top); g.moveTo(x1, y0 + 10); g.lineTo(x1, top); g.stroke();
    g.strokeStyle = 'rgba(230,235,255,0.22)'; g.lineWidth = 1;
    for (let x = x0; x <= x1; x += 9) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + h * 0.45); g.stroke(); }
    for (let y = top; y <= top + h * 0.45; y += 8) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    box(g, x0, top - 2, x1 - x0, 5, '#f4f6ff');
  }
  function windows(g, x, y, w, h, cols, rows, frame, glass) {
    box(g, x - 4, y - 4, w + 8, h + 8, frame);
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) box(g, x + i * cw + 2, y + j * ch + 2, cw - 4, ch - 4, glass);
  }
  function stars(g, W, H, n, rnd, maxY) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * maxY, r = rnd() * 1.3 + 0.3;
      g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }
  function skyline(g, W, base, rnd, col, lit) {
    let x = -10;
    while (x < W + 10) {
      const w = 24 + rnd() * 60, h = 40 + rnd() * 130;
      box(g, x, base - h, w, h + 2, col);
      if (lit) for (let yy = base - h + 8; yy < base - 8; yy += 11) for (let xx = x + 5; xx < x + w - 6; xx += 9) if (rnd() < 0.35) box(g, xx, yy, 4, 5, lit);
      x += w + rnd() * 6;
    }
  }
  function tree(g, x, y, s, c0, c1) {
    box(g, x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5, '#3a2a20');
    for (const [dx, dy, r] of [[0, -0.75, 0.38], [-0.25, -0.58, 0.28], [0.26, -0.6, 0.3]]) {
      g.fillStyle = rad(g, x + dx * s - r * s * 0.3, y + dy * s - r * s * 0.3, 0, r * s * 1.2, [[0, c1], [1, c0]]);
      g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill();
    }
  }
  function lamp(g, x, y, h, on) {
    g.strokeStyle = '#2a2f3d'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.quadraticCurveTo(x, y - h - 14, x + 16, y - h - 14); g.stroke();
    box(g, x + 10, y - h - 16, 16, 6, '#3a4052', 2);
    if (on) {
      add(g, () => {
        glow(g, x + 18, y - h - 8, 60, '255,220,150', 0.5);
        g.fillStyle = lin(g, 0, y - h - 8, 0, y, [[0, 'rgba(255,220,150,0.22)'], [1, 'rgba(255,220,150,0)']]);
        g.beginPath(); g.moveTo(x + 12, y - h - 10); g.lineTo(x + 24, y - h - 10); g.lineTo(x + 80, y); g.lineTo(x - 44, y); g.closePath(); g.fill();
      });
    }
  }
  function shelfItems(g, x, y, w, rnd) {
    let xx = x + 4;
    while (xx < x + w - 14) {
      const k = rnd();
      if (k < 0.4) { const h = 18 + rnd() * 10; box(g, xx, y - h, 10, h, ['#2f6fd6', '#d9443e', '#e9b23a', '#3fae6b'][(rnd() * 4) | 0], 3); box(g, xx, y - h, 10, 3, '#f2f2f2'); xx += 13; }
      else if (k < 0.7) { g.strokeStyle = ['#ff6a6a', '#6ad1ff', '#ffd25a'][(rnd() * 3) | 0]; g.lineWidth = 2; g.beginPath(); g.ellipse(xx + 8, y - 26, 7, 10, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(xx + 8, y - 16); g.lineTo(xx + 8, y); g.stroke(); xx += 18; }
      else { box(g, xx, y - 12, 20, 12, '#a07a52', 2); xx += 24; }
    }
  }
  function bunting(g, W, y, cols) {
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(W / 2, y + 30, W, y); g.stroke();
    for (let i = 0; i < 24; i++) {
      const u = (i + 0.5) / 24, x = u * W, yy = y + 30 * 2 * u * (1 - u) * 1.0;
      g.fillStyle = cols[i % cols.length];
      g.beginPath(); g.moveTo(x - 8, yy); g.lineTo(x + 8, yy); g.lineTo(x, yy + 14); g.closePath(); g.fill();
    }
  }
  function crowd(g, W, y0, y1, rnd, cols) {
    for (let y = y0; y < y1; y += 14) for (let x = -6; x < W + 6; x += 11 + rnd() * 4) {
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.beginPath(); g.arc(x, y + rnd() * 3, 5, 0, TAU); g.fill();
      g.fillRect(x - 6, y + 4, 12, 10);
    }
  }

  // ---------- 场景 ----------
  const S = {};
  S.storage = {
    name: '体育馆储物间',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#2a2433'], [1, '#17131d']]); g.fillRect(0, 0, W, H);
      // 墙砖
      g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
      for (let y = 0; y < H * 0.72; y += 22) for (let x = (y / 22) % 2 ? -20 : 0; x < W; x += 40) g.strokeRect(x, y, 40, 22);
      // 高窗与光束
      windows(g, W * 0.62, H * 0.08, W * 0.16, H * 0.18, 3, 2, '#3b3445', 'rgba(255,226,170,0.55)');
      // 货架
      for (const sx of [W * 0.04, W * 0.8]) {
        box(g, sx, H * 0.18, W * 0.17, H * 0.6, '#3a2c22');
        for (let i = 0; i < 4; i++) { const y = H * (0.3 + i * 0.13); box(g, sx, y, W * 0.17, 5, '#5b4532'); shelfItems(g, sx, y, W * 0.17, rnd); }
      }
      // 地上的球筐
      box(g, W * 0.3, H * 0.62, W * 0.12, H * 0.14, '#6b4a2e', 6);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(W * 0.31 + rnd() * W * 0.1, H * 0.62 + rnd() * 8, 6, 0, TAU); g.fill(); }
      woodFloor(g, W, H, H * 0.74, '#5a4030', '#2c1f17');
      // 旧海报
      box(g, W * 0.3, H * 0.14, W * 0.1, H * 0.2, '#d8c8a0', 3);
      g.fillStyle = '#b8473a'; g.font = `bold ${Math.round(H * 0.03)}px sans-serif`; g.textAlign = 'center';
      g.fillText('星光杯', W * 0.35, H * 0.2); g.fillText('1996', W * 0.35, H * 0.26);
    },
    back(g, W, H, t) {
      add(g, () => {
        g.fillStyle = lin(g, W * 0.7, H * 0.17, W * 0.45, H, [[0, 'rgba(255,220,160,0.28)'], [1, 'rgba(255,220,160,0)']]);
        g.beginPath(); g.moveTo(W * 0.62, H * 0.1); g.lineTo(W * 0.78, H * 0.1); g.lineTo(W * 0.62, H); g.lineTo(W * 0.2, H); g.closePath(); g.fill();
      });
    },
    front(g, W, H, t) {
      for (let i = 0; i < 26; i++) {
        const u = (i * 0.618 + t * 0.03) % 1, x = W * (0.25 + 0.5 * ((i * 0.37) % 1)) + Math.sin(t * 0.7 + i) * 12, y = H * (0.15 + 0.8 * u);
        g.fillStyle = `rgba(255,236,200,${0.25 + 0.25 * Math.sin(t * 2 + i)})`; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
      }
    },
  };
  function gymBake(g, W, H, rnd, night) {
    g.fillStyle = lin(g, 0, 0, 0, H, night ? [[0, '#141a33'], [1, '#0b0f20']] : [[0, '#34507a'], [1, '#1d2c48']]); g.fillRect(0, 0, W, H);
    // 屋顶桁架
    g.strokeStyle = night ? 'rgba(160,180,255,0.12)' : 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
    for (let x = 0; x < W; x += W / 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + W / 20, H * 0.12); g.lineTo(x + W / 10, 0); g.stroke(); }
    g.beginPath(); g.moveTo(0, H * 0.12); g.lineTo(W, H * 0.12); g.stroke();
    // 高窗
    for (let i = 0; i < 6; i++) windows(g, W * (0.05 + i * 0.16), H * 0.17, W * 0.12, H * 0.16, 2, 2, night ? '#1d2440' : '#2a3a5c', night ? 'rgba(40,60,120,0.75)' : 'rgba(190,225,255,0.75)');
    // 看台
    box(g, 0, H * 0.4, W, H * 0.2, night ? '#1a2036' : '#2a3a5a');
    crowd(g, W, H * 0.42, H * 0.56, rnd, night ? ['#232a44'] : ['#3b4d72', '#4a5f88', '#344466']);
    box(g, 0, H * 0.58, W, H * 0.05, night ? '#2a1d1d' : '#c0392b');
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `bold ${Math.round(H * 0.03)}px sans-serif`; g.textAlign = 'center';
    g.fillText('星 光 体 育 馆', W * 0.5, H * 0.615);
    woodFloor(g, W, H, H * 0.63, night ? '#5a4128' : '#c98b4e', night ? '#2b1d12' : '#7a4f2a');
    courtLines(g, W, H, H * 0.63);
    net(g, W, H, H * 0.75, H * 0.12);
  }
  S.gym = {
    name: '星光体育馆',
    bake(g, W, H, rnd) { gymBake(g, W, H, rnd, false); },
    back(g, W, H, t) { add(g, () => { for (let i = 0; i < 4; i++) glow(g, W * (0.15 + i * 0.23), H * 0.06, H * 0.2, '255,250,230', 0.35 + 0.04 * Math.sin(t * 3 + i)); }); },
  };
  S.gymnight = {
    name: '夜晚的球馆',
    bake(g, W, H, rnd) { gymBake(g, W, H, rnd, true); },
    back(g, W, H, t) {
      add(g, () => { glow(g, W * 0.5, H * 0.05, H * 0.5, '255,230,180', 0.35); });
      rainOnWindows(g, W, H, t, 0.5);
    },
  };
  function rainOnWindows(g, W, H, t, k) {
    g.strokeStyle = `rgba(190,210,255,${0.35 * k})`; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
      const x = W * (0.05 + i * 0.16) + ((j * 37) % 100) / 100 * W * 0.12, y = H * 0.17 + ((t * 0.6 + j * 0.31 + i * 0.17) % 1) * H * 0.16;
      g.moveTo(x, y); g.lineTo(x - 2, y + 8);
    }
    g.stroke();
  }
  S.gymrain = {
    name: '风雨老球馆',
    bake(g, W, H, rnd) { gymBake(g, W, H, rnd, true); },
    back(g, W, H, t, st) {
      rainOnWindows(g, W, H, t, 1.4);
      const f = st.flash || 0;
      if (f > 0) { g.fillStyle = `rgba(200,220,255,${f * 0.35})`; g.fillRect(0, 0, W, H * 0.4); }
    },
    front(g, W, H, t, st) {
      // 穿堂风：被吹起的纸屑与风线
      g.strokeStyle = 'rgba(220,230,255,0.18)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const x = ((t * 0.5 + i * 0.15) % 1.2 - 0.1) * W, y = H * (0.2 + i * 0.1); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 8, x + 90, y); g.stroke(); }
      st.flashT = (st.flashT == null ? 3 : st.flashT) - st.dt;
      if (st.flashT <= 0) { st.flash = 1; st.flashT = 4 + Math.random() * 5; }
      st.flash = Math.max(0, (st.flash || 0) - st.dt * 3);
    },
  };
  S.gymdark = {
    name: '停电的球馆',
    bake(g, W, H, rnd) { gymBake(g, W, H, rnd, true); g.fillStyle = 'rgba(0,0,8,0.55)'; g.fillRect(0, 0, W, H); },
    back(g, W, H, t, st) {
      // 应急灯与手电光
      add(g, () => {
        glow(g, W * 0.06, H * 0.1, 50, '120,255,150', 0.5);
        const a = Math.sin(t * 0.6) * 0.35;
        g.fillStyle = lin(g, W * 0.95, H * 0.3, W * 0.5, H * 0.9, [[0, 'rgba(255,240,200,0.32)'], [1, 'rgba(255,240,200,0)']]);
        g.beginPath(); g.moveTo(W * 0.95, H * 0.3); g.lineTo(W * (0.35 + a), H); g.lineTo(W * (0.65 + a), H); g.closePath(); g.fill();
      });
      const f = st.flash || 0;
      if (f > 0) { g.fillStyle = `rgba(210,225,255,${f * 0.45})`; g.fillRect(0, 0, W, H); }
    },
    front: S.gymrain.front,
  };
  S.rooftop = {
    name: '教学楼天台',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H * 0.7, [[0, '#3a3f8f'], [0.45, '#e9789a'], [0.8, '#ffc27a'], [1, '#ffe0a0']]); g.fillRect(0, 0, W, H);
      glow(g, W * 0.72, H * 0.52, H * 0.4, '255,230,170', 0.7);
      g.fillStyle = '#fff1c9'; g.beginPath(); g.arc(W * 0.72, H * 0.52, H * 0.07, 0, TAU); g.fill();
      skyline(g, W, H * 0.62, rnd, 'rgba(70,50,90,0.85)', 'rgba(255,220,150,0.6)');
      // 天台地面、栏杆、水箱
      box(g, 0, H * 0.62, W, H * 0.38, '#8b7f8a');
      g.fillStyle = lin(g, 0, H * 0.62, 0, H, [[0, '#a99aa3'], [1, '#5a4e5a']]); g.fillRect(0, H * 0.62, W, H * 0.38);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(i * W / 13, H * 0.62); g.lineTo(i * W / 13 + (i - 6.5) * 40, H); g.stroke(); }
      g.strokeStyle = '#4a4058'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, H * 0.55); g.lineTo(W, H * 0.55); g.moveTo(0, H * 0.6); g.lineTo(W, H * 0.6); g.stroke();
      for (let x = 0; x < W; x += 26) { g.beginPath(); g.moveTo(x, H * 0.55); g.lineTo(x, H * 0.62); g.stroke(); }
      box(g, W * 0.04, H * 0.3, W * 0.12, H * 0.24, '#5c6b8a', 8); box(g, W * 0.06, H * 0.54, 6, H * 0.08, '#3d4660'); box(g, W * 0.13, H * 0.54, 6, H * 0.08, '#3d4660');
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = `bold ${Math.round(H * 0.035)}px sans-serif`; g.textAlign = 'center'; g.fillText('羽跃社', W * 0.1, H * 0.44);
      // 招新横幅
      box(g, W * 0.6, H * 0.5, W * 0.3, H * 0.06, '#ffd23f', 4);
      g.fillStyle = '#b8243a'; g.font = `bold ${Math.round(H * 0.035)}px sans-serif`; g.fillText('羽跃社招新！包教包会', W * 0.75, H * 0.545);
    },
    back(g, W, H, t) {
      g.fillStyle = 'rgba(255,240,240,0.55)';
      for (let i = 0; i < 4; i++) { const x = ((t * 0.012 + i * 0.27) % 1.3 - 0.15) * W, y = H * (0.1 + i * 0.07); g.beginPath(); g.ellipse(x, y, 60, 12, 0, 0, TAU); g.ellipse(x + 34, y - 6, 40, 12, 0, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(40,30,60,0.6)'; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const x = ((t * 0.04 + i * 0.2) % 1.2) * W, y = H * (0.22 + i * 0.04) + Math.sin(t * 2 + i) * 6, w = 6 + Math.sin(t * 9 + i) * 3; g.beginPath(); g.moveTo(x - 7, y - w * 0.5); g.quadraticCurveTo(x - 3, y, x, y); g.quadraticCurveTo(x + 3, y, x + 7, y - w * 0.5); g.stroke(); }
    },
  };
  S.cafe = {
    name: '甜心奶茶店',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#ffd9e6'], [1, '#f7b5cb']]); g.fillRect(0, 0, W, H);
      // 墙纸条纹
      for (let x = 0; x < W; x += 34) box(g, x, 0, 16, H * 0.66, 'rgba(255,255,255,0.28)');
      // 菜单板
      box(g, W * 0.36, H * 0.07, W * 0.28, H * 0.26, '#4a2f3a', 10);
      g.fillStyle = '#ffe9f0'; g.font = `bold ${Math.round(H * 0.04)}px sans-serif`; g.textAlign = 'center'; g.fillText('★ 今日推荐', W * 0.5, H * 0.14);
      g.font = `${Math.round(H * 0.03)}px sans-serif`;
      ['草莓奶盖 · 16', '芋泥波波 · 15', '无糖柠檬茶 · 12'].forEach((s, i) => g.fillText(s, W * 0.5, H * (0.2 + i * 0.045)));
      // 窗与街景
      windows(g, W * 0.04, H * 0.1, W * 0.26, H * 0.36, 2, 2, '#ffffff', 'rgba(255,214,170,0.7)');
      windows(g, W * 0.7, H * 0.1, W * 0.26, H * 0.36, 2, 2, '#ffffff', 'rgba(255,214,170,0.7)');
      // 吧台
      box(g, 0, H * 0.58, W, H * 0.08, '#c56b8a');
      box(g, 0, H * 0.56, W, H * 0.03, '#fff3f7');
      for (let i = 0; i < 7; i++) { const x = W * (0.1 + i * 0.13); box(g, x, H * 0.49, 14, H * 0.07, i % 2 ? '#ffb3cf' : '#c79a6a', 4); box(g, x - 1, H * 0.48, 16, 4, '#ffffff', 2); g.strokeStyle = '#ff5a8a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 9, H * 0.48); g.lineTo(x + 12, H * 0.44); g.stroke(); }
      woodFloor(g, W, H, H * 0.66, '#e7c0a3', '#b88566');
    },
    back(g, W, H, t) {
      // 彩灯串
      for (let i = 0; i < 30; i++) {
        const u = i / 29, x = u * W, y = H * 0.035 + Math.sin(u * Math.PI) * H * 0.04;
        const on = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        add(g, () => glow(g, x, y, 10, ['255,200,120', '255,140,190', '160,220,255'][i % 3], 0.4 + on * 0.5));
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i += 2) { const x = W * (0.1 + i * 0.13) + 7; g.beginPath(); for (let k = 0; k < 3; k++) { const yy = H * 0.47 - k * 12 - ((t * 20) % 12); g.moveTo(x + Math.sin(t * 2 + k) * 4, yy); g.lineTo(x + Math.sin(t * 2 + k + 1) * 4, yy - 8); } g.stroke(); }
    },
  };
  S.canteen = {
    name: '学校食堂',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#f3ead6'], [1, '#d9c9a5']]); g.fillRect(0, 0, W, H);
      box(g, 0, 0, W, H * 0.06, '#d1bf96');
      for (let i = 0; i < 5; i++) { box(g, W * (0.06 + i * 0.2), H * 0.02, W * 0.12, 6, '#ffffff'); }
      // 窗口与菜单
      box(g, W * 0.05, H * 0.12, W * 0.9, H * 0.12, '#c0392b', 6);
      g.fillStyle = '#ffe9b0'; g.font = `bold ${Math.round(H * 0.045)}px sans-serif`; g.textAlign = 'center';
      ['鲜肉包 1.5', '奶黄包 2', '豆浆 1', '米线 8'].forEach((s, i) => g.fillText(s, W * (0.16 + i * 0.23), H * 0.195));
      box(g, W * 0.05, H * 0.26, W * 0.9, H * 0.22, '#b7c4c9');
      box(g, W * 0.05, H * 0.44, W * 0.9, H * 0.08, '#8e9ea5');
      // 蒸笼
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const x = W * (0.12 + i * 0.22), y = H * (0.42 - k * 0.045); box(g, x, y, W * 0.12, H * 0.045, k % 2 ? '#c99b5e' : '#b88848', 6); g.strokeStyle = 'rgba(80,50,20,0.4)'; g.strokeRect(x, y, W * 0.12, H * 0.045); }
      woodFloor(g, W, H, H * 0.6, '#cfd7da', '#9aa6ab');
      // 餐桌
      for (const x of [W * 0.02, W * 0.78]) { box(g, x, H * 0.62, W * 0.2, H * 0.04, '#e9a23b', 4); box(g, x + 10, H * 0.66, 8, H * 0.2, '#7a6a5a'); box(g, x + W * 0.2 - 18, H * 0.66, 8, H * 0.2, '#7a6a5a'); }
    },
    back(g, W, H, t) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) {
        const u = ((t * 0.25 + k / 5) % 1), x = W * (0.18 + i * 0.22) + Math.sin(t * 1.5 + k + i) * 10, y = H * 0.33 - u * H * 0.22;
        g.beginPath(); g.arc(x, y, 8 + u * 14, 0, TAU); g.globalAlpha = 0.5 * (1 - u); g.fill();
      }
      g.globalAlpha = 1;
    },
  };
  S.classroom = {
    name: '晚自习教室',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#d8dfe6'], [1, '#b9c2cc']]); g.fillRect(0, 0, W, H);
      // 黑板与公式
      box(g, W * 0.18, H * 0.1, W * 0.5, H * 0.34, '#3f5a4a', 4); box(g, W * 0.17, H * 0.44, W * 0.52, 8, '#8a6a4a');
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(W * 0.22, H * 0.4);
      for (let i = 0; i <= 40; i++) { const u = i / 40, x = W * (0.22 + u * 0.3), y = H * (0.4 - Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5) * 0.22 + Math.max(0, u - 0.6) * 0.5); g.lineTo(x, Math.min(H * 0.4, y)); }
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `${Math.round(H * 0.035)}px serif`; g.textAlign = 'left';
      g.fillText('F = ½ρv²C·A', W * 0.52, H * 0.18); g.fillText('比较落点与时间', W * 0.52, H * 0.25);
      g.fillStyle = '#ffd36e'; g.fillText('晚自习 · 物理', W * 0.2, H * 0.15);
      // 夜色窗户
      windows(g, W * 0.74, H * 0.08, W * 0.22, H * 0.42, 2, 3, '#e6ebf0', 'rgba(24,34,72,0.95)');
      // 课桌
      for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { const x = W * (0.04 + i * 0.25) + r * 30, y = H * (0.58 + r * 0.12); box(g, x, y, W * 0.16, H * 0.035, '#d9a85b', 3); box(g, x + 6, y + H * 0.035, 6, H * 0.12, '#6b6f78'); box(g, x + W * 0.16 - 12, y + H * 0.035, 6, H * 0.12, '#6b6f78'); box(g, x + 14, y - 10, 26, 10, ['#5b8de0', '#e06b5b', '#f4d35e'][i % 3]); }
      box(g, 0, H * 0.55, W, 2, 'rgba(0,0,0,0.1)');
    },
    back(g, W, H, t) {
      for (let i = 0; i < 8; i++) { const x = W * (0.76 + ((i * 0.37) % 1) * 0.18), y = H * (0.1 + ((i * 0.53) % 1) * 0.36); g.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; g.fillRect(x, y, 2, 2); }
      const fl = Math.sin(t * 37) > 0.97 ? 0.05 : 0.14;
      add(g, () => { glow(g, W * 0.3, 0, H * 0.5, '230,245,255', fl); glow(g, W * 0.7, 0, H * 0.5, '230,245,255', 0.14); });
    },
  };
  S.nightroad = {
    name: '校门外的小路',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H * 0.7, [[0, '#0b1030'], [0.6, '#24305e'], [1, '#4a3f6e']]); g.fillRect(0, 0, W, H);
      stars(g, W, H, 140, rnd, H * 0.5);
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(W * 0.82, H * 0.14, H * 0.05, 0, TAU); g.fill();
      g.fillStyle = '#24305e'; g.beginPath(); g.arc(W * 0.835, H * 0.13, H * 0.045, 0, TAU); g.fill();
      // 教学楼剪影与亮着的窗
      box(g, W * 0.05, H * 0.28, W * 0.4, H * 0.32, '#151a35');
      for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) box(g, W * 0.07 + i * W * 0.038, H * 0.31 + j * H * 0.07, W * 0.022, H * 0.04, rnd() < 0.55 ? 'rgba(255,224,150,0.85)' : 'rgba(60,70,110,0.8)');
      for (let x = 0; x < W; x += 60) tree(g, x + rnd() * 30, H * 0.64, 90 + rnd() * 30, '#0f2a24', '#1f4a3c');
      // 道路
      g.fillStyle = lin(g, 0, H * 0.62, 0, H, [[0, '#2d2f45'], [1, '#14151f']]); g.fillRect(0, H * 0.62, W, H * 0.38);
      g.strokeStyle = 'rgba(255,230,160,0.4)'; g.setLineDash([24, 18]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, H * 0.83); g.lineTo(W, H * 0.83); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 4; i++) lamp(g, W * (0.08 + i * 0.3), H * 0.66, H * 0.38, false);
    },
    back(g, W, H, t, st) {
      for (let i = 0; i < 4; i++) {
        const x = W * (0.08 + i * 0.3), y = H * 0.66, h = H * 0.38;
        add(g, () => {
          glow(g, x + 18, y - h - 8, 70, '255,215,140', 0.55 + 0.04 * Math.sin(t * 5 + i));
          g.fillStyle = lin(g, 0, y - h, 0, y + 30, [[0, 'rgba(255,215,140,0.22)'], [1, 'rgba(255,215,140,0)']]);
          g.beginPath(); g.moveTo(x + 12, y - h - 10); g.lineTo(x + 24, y - h - 10); g.lineTo(x + 100, y + 30); g.lineTo(x - 64, y + 30); g.closePath(); g.fill();
        });
        // 路灯下的飞虫
        for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(255,240,200,0.8)'; g.fillRect(x + 18 + Math.sin(t * 3 + k * 2 + i) * 14, y - h + 10 + Math.cos(t * 2.3 + k) * 10, 2, 2); }
      }
      // 流星
      const u = (t * 0.13) % 1;
      if (u < 0.12) { const k = u / 0.12, x = W * (0.2 + k * 0.4), y = H * (0.05 + k * 0.15); g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 60, y - 22); g.stroke(); }
    },
  };
  S.shop = {
    name: '霓虹穿线铺',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#1b1530'], [1, '#0d0a1a']]); g.fillRect(0, 0, W, H);
      // 球拍墙
      box(g, W * 0.04, H * 0.08, W * 0.58, H * 0.48, '#2a2140', 6);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) {
        const x = W * (0.08 + i * 0.062), y = H * (0.2 + r * 0.22), col = ['#ff4f7b', '#4fd1ff', '#c6ff5c', '#ffd23f', '#b48cff'][(i + r * 2) % 5];
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, W * 0.018, H * 0.05, 0, 0, TAU); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + H * 0.05); g.lineTo(x, y + H * 0.13); g.stroke();
      }
      // 穿线机
      box(g, W * 0.68, H * 0.38, W * 0.26, H * 0.06, '#5a6070', 4); box(g, W * 0.79, H * 0.44, W * 0.04, H * 0.22, '#3a3f4c'); box(g, W * 0.73, H * 0.66, W * 0.16, H * 0.03, '#3a3f4c', 3);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.81, H * 0.35, W * 0.06, H * 0.03, 0, 0, TAU); g.stroke();
      woodFloor(g, W, H, H * 0.66, '#3a2c3a', '#1a141e');
      box(g, 0, H * 0.6, W, H * 0.06, '#24183a');
    },
    back(g, W, H, t) {
      const flick = Math.sin(t * 23) > 0.92 ? 0.3 : 1;
      add(g, () => {
        g.font = `bold ${Math.round(H * 0.07)}px sans-serif`; g.textAlign = 'center';
        g.shadowColor = '#ff4fd8'; g.shadowBlur = 18; g.fillStyle = `rgba(255,120,230,${flick})`; g.fillText('丁丁穿线', W * 0.81, H * 0.16);
        g.shadowColor = '#4fd1ff'; g.fillStyle = 'rgba(120,230,255,0.95)'; g.font = `bold ${Math.round(H * 0.04)}px sans-serif`; g.fillText('24h · 精准磅数', W * 0.81, H * 0.24);
        g.shadowBlur = 0;
        glow(g, W * 0.33, H * 0.32, W * 0.3, '160,120,255', 0.12);
      });
    },
  };
  S.lab = {
    name: '电脑社机房',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#13202e'], [1, '#0a1119']]); g.fillRect(0, 0, W, H);
      // 海报
      box(g, W * 0.04, H * 0.08, W * 0.12, H * 0.2, '#ffd23f', 3);
      g.fillStyle = '#13202e'; g.font = `bold ${Math.round(H * 0.03)}px monospace`; g.textAlign = 'center'; g.fillText('Hello', W * 0.1, H * 0.16); g.fillText('World!', W * 0.1, H * 0.21);
      box(g, W * 0.84, H * 0.08, W * 0.12, H * 0.18, '#4fd1ff', 3);
      g.fillStyle = '#13202e'; g.fillText('404', W * 0.9, H * 0.18);
      // 显示器排
      for (let i = 0; i < 5; i++) { const x = W * (0.07 + i * 0.18); box(g, x, H * 0.36, W * 0.14, H * 0.16, '#1c2733', 6); box(g, x + W * 0.06, H * 0.52, W * 0.02, H * 0.04, '#2a3644'); }
      box(g, 0, H * 0.56, W, H * 0.06, '#2b3a4a');
      // 零食
      for (let i = 0; i < 6; i++) box(g, W * (0.1 + i * 0.15), H * 0.52, 18, 12, ['#ff6a3d', '#ffd23f', '#3fd18a'][i % 3], 3);
      woodFloor(g, W, H, H * 0.62, '#26313d', '#121920');
    },
    back(g, W, H, t) {
      for (let i = 0; i < 5; i++) {
        const x = W * (0.07 + i * 0.18) + 6, y = H * 0.36 + 6, w = W * 0.14 - 12, h = H * 0.16 - 12;
        box(g, x, y, w, h, '#06131c');
        g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
        const off = (t * 18 + i * 13) % 10;
        for (let k = 0; k < 9; k++) {
          const yy = y + k * 10 - off, len = ((k * 7 + i * 3 + Math.floor(t * 1.8)) % 9 + 3) / 12;
          g.fillStyle = ['#3fd18a', '#4fd1ff', '#ffd23f', '#c88cff'][(k + i) % 4]; g.fillRect(x + 4 + (k % 3) * 6, yy, w * len * 0.8, 3);
        }
        g.restore();
        add(g, () => glow(g, x + w / 2, y + h / 2, w, '80,200,255', 0.14));
      }
    },
  };
  S.fitness = {
    name: '铁力健身房',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#24242e'], [1, '#121218']]); g.fillRect(0, 0, W, H);
      // 镜墙与霓虹灯条
      box(g, W * 0.05, H * 0.1, W * 0.9, H * 0.42, '#2f3542', 4);
      for (let i = 0; i < 6; i++) { const x = W * (0.06 + i * 0.148); box(g, x, H * 0.12, W * 0.14, H * 0.38, '#3d4a5c', 2); g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(x + W * 0.02, H * 0.12); g.lineTo(x + W * 0.06, H * 0.12); g.lineTo(x + W * 0.02, H * 0.5); g.lineTo(x, H * 0.5); g.closePath(); g.fill(); }
      // 哑铃架
      box(g, W * 0.06, H * 0.5, W * 0.4, H * 0.025, '#5a5f6b', 3); box(g, W * 0.06, H * 0.56, W * 0.4, H * 0.025, '#5a5f6b', 3);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { const x = W * (0.085 + i * 0.054), y = H * (0.49 + r * 0.06); box(g, x - 9, y - 9, 6, 16, '#1b1b22', 2); box(g, x + 7, y - 9, 6, 16, '#1b1b22', 2); box(g, x - 4, y - 3, 12, 4, '#9aa0ad'); }
      // 卧推凳与杠铃
      box(g, W * 0.6, H * 0.58, W * 0.2, H * 0.035, '#ff3d6b', 6); box(g, W * 0.62, H * 0.615, 8, H * 0.06, '#3a3a44'); box(g, W * 0.77, H * 0.615, 8, H * 0.06, '#3a3a44');
      box(g, W * 0.58, H * 0.47, 6, H * 0.12, '#3a3a44'); box(g, W * 0.81, H * 0.47, 6, H * 0.12, '#3a3a44');
      box(g, W * 0.55, H * 0.465, W * 0.3, 6, '#c8ccd6', 3); box(g, W * 0.555, H * 0.43, 12, 44, '#1b1b22', 3); box(g, W * 0.835, H * 0.43, 12, 44, '#1b1b22', 3);
      // 地胶
      g.fillStyle = lin(g, 0, H * 0.66, 0, H, [[0, '#2b2b33'], [1, '#18181e']]); g.fillRect(0, H * 0.66, W, H * 0.34);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, H * (0.68 + i * 0.04)); g.lineTo(W, H * (0.68 + i * 0.04)); g.stroke(); }
    },
    back(g, W, H, t) {
      const pulse = 0.75 + Math.sin(t * 3) * 0.25;
      add(g, () => {
        g.font = `bold ${Math.round(H * 0.06)}px sans-serif`; g.textAlign = 'center';
        g.shadowColor = '#ff3d6b'; g.shadowBlur = 16; g.fillStyle = `rgba(255,90,140,${pulse})`; g.fillText('铁力健身 · 24H', W * 0.5, H * 0.08);
        g.shadowBlur = 0; glow(g, W * 0.5, H * 0.06, W * 0.25, '255,61,107', 0.12);
      });
    },
  };
  S.gameroom = {
    name: '开黑小屋',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#191530'], [1, '#0c0a18']]); g.fillRect(0, 0, W, H);
      // 海报：原创游戏“遗迹守卫战”
      box(g, W * 0.05, H * 0.08, W * 0.16, H * 0.24, '#8a2a2a', 3); g.fillStyle = '#ffd9a0'; g.font = `bold ${Math.round(H * 0.03)}px sans-serif`; g.textAlign = 'center'; g.fillText('遗迹', W * 0.13, H * 0.17); g.fillText('守卫战', W * 0.13, H * 0.22);
      box(g, W * 0.79, H * 0.08, W * 0.16, H * 0.24, '#24406e', 3); g.fillStyle = '#d6ecff'; g.fillText('五黑', W * 0.87, H * 0.17); g.fillText('来不来', W * 0.87, H * 0.22);
      // 两台电脑 + 手机支架
      for (const x of [W * 0.27, W * 0.52]) { box(g, x, H * 0.33, W * 0.2, H * 0.17, '#1c2032', 6); box(g, x + W * 0.09, H * 0.5, W * 0.02, H * 0.05, '#2a3044'); }
      box(g, 0, H * 0.55, W, H * 0.05, '#2b2440');
      for (let i = 0; i < 5; i++) box(g, W * (0.3 + i * 0.09), H * 0.53, 22, 9, ['#ffcf5a', '#ff6a3d', '#7dffb0'][i % 3], 3); // 零食
      woodFloor(g, W, H, H * 0.6, '#2b2440', '#141022');
    },
    back(g, W, H, t) {
      for (const [k, x0] of [[0, W * 0.27], [1, W * 0.52]]) {
        const x = x0 + 6, y = H * 0.33 + 6, w = W * 0.2 - 12, h = H * 0.17 - 12;
        g.fillStyle = k ? '#132a1c' : '#2a1414'; g.fillRect(x, y, w, h);
        g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
        for (let i = 0; i < 6; i++) { const px = x + ((t * (20 + i * 7) + i * 40) % w), py = y + h * (0.2 + (i % 3) * 0.28); g.fillStyle = i % 2 ? '#7dffb0' : '#ff6a6a'; g.beginPath(); g.arc(px, py, 3, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = `${Math.round(H * 0.022)}px sans-serif`; g.textAlign = 'left'; g.fillText(k ? '胜利 · 推掉主堡' : '团战 3 : 5', x + 4, y + h - 6);
        g.restore();
        add(g, () => glow(g, x + w / 2, y + h / 2, w * 0.8, k ? '120,255,170' : '255,110,110', 0.12));
      }
    },
  };
  S.mountain = {
    name: '春城集训营',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H * 0.6, [[0, '#3f8fe0'], [1, '#bfe6ff']]); g.fillRect(0, 0, W, H);
      const ridge = (base, amp, col, seed) => { const r = rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, H); let y = base; for (let x = 0; x <= W + 20; x += 20) { y = clamp(y + (r() - 0.5) * amp, base - amp * 2, base + amp); g.lineTo(x, y); } g.lineTo(W, H); g.closePath(); g.fill(); };
      ridge(H * 0.36, 30, '#8fb3d6', 3); ridge(H * 0.44, 26, '#6f9a8a', 5); ridge(H * 0.52, 18, '#4f8a5a', 7);
      // 户外球场
      g.fillStyle = lin(g, 0, H * 0.6, 0, H, [[0, '#3c8f63'], [1, '#2a6a49']]); g.fillRect(0, H * 0.6, W, H * 0.4);
      g.fillStyle = '#2f7fb8'; g.beginPath(); g.moveTo(W * 0.14, H); g.lineTo(W * 0.3, H * 0.62); g.lineTo(W * 0.7, H * 0.62); g.lineTo(W * 0.86, H); g.closePath(); g.fill();
      courtLines(g, W, H, H * 0.6);
      net(g, W, H, H * 0.72, H * 0.11);
      // 花丛与横幅
      for (let i = 0; i < 60; i++) { g.fillStyle = ['#ff7fa8', '#ffd23f', '#ffffff', '#c58cff'][i % 4]; g.beginPath(); g.arc(rnd() * W * 0.12 + (i % 2 ? W * 0.88 : 0), H * (0.62 + rnd() * 0.36), 3 + rnd() * 2, 0, TAU); g.fill(); }
      box(g, W * 0.32, H * 0.48, W * 0.36, H * 0.06, '#c0392b', 4);
      g.fillStyle = '#fff'; g.font = `bold ${Math.round(H * 0.035)}px sans-serif`; g.textAlign = 'center'; g.fillText('羽跃社 · 春城高原集训营', W * 0.5, H * 0.525);
    },
    back(g, W, H, t) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) { const x = ((t * 0.01 + i * 0.23) % 1.3 - 0.15) * W, y = H * (0.08 + (i % 3) * 0.06); g.beginPath(); g.ellipse(x, y, 50, 14, 0, 0, TAU); g.ellipse(x + 30, y - 8, 30, 14, 0, 0, TAU); g.ellipse(x - 28, y - 4, 26, 10, 0, 0, TAU); g.fill(); }
      glow(g, W * 0.12, H * 0.08, H * 0.25, '255,250,220', 0.5);
    },
  };
  S.stars = {
    name: '高原星空',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#050818'], [0.6, '#101a3a'], [1, '#1a2a3a']]); g.fillRect(0, 0, W, H);
      // 银河
      g.save(); g.translate(W * 0.5, H * 0.3); g.rotate(-0.35);
      g.fillStyle = rad(g, 0, 0, 0, W * 0.5, [[0, 'rgba(180,170,255,0.28)'], [1, 'rgba(180,170,255,0)']]); g.scale(1, 0.18); g.beginPath(); g.arc(0, 0, W * 0.55, 0, TAU); g.fill();
      g.restore();
      stars(g, W, H, 320, rnd, H * 0.62);
      // 夏季大三角
      const tri = [[W * 0.32, H * 0.12], [W * 0.58, H * 0.24], [W * 0.44, H * 0.36]];
      g.strokeStyle = 'rgba(255,226,122,0.35)'; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); tri.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); g.setLineDash([]);
      for (const [x, y] of tri) { glow(g, x, y, 14, '255,240,200', 0.9); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
      // 山的剪影和草地
      g.fillStyle = '#081020'; g.beginPath(); g.moveTo(0, H * 0.6); for (let x = 0; x <= W; x += 30) g.lineTo(x, H * (0.56 + 0.05 * Math.sin(x * 0.01) + rnd() * 0.02)); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      g.fillStyle = '#0d1d1a'; g.fillRect(0, H * 0.7, W, H * 0.3);
      // 帐篷
      g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(W * 0.82, H * 0.7); g.lineTo(W * 0.9, H * 0.56); g.lineTo(W * 0.98, H * 0.7); g.closePath(); g.fill();
      g.fillStyle = '#ffd59a'; g.beginPath(); g.moveTo(W * 0.88, H * 0.7); g.lineTo(W * 0.9, H * 0.62); g.lineTo(W * 0.92, H * 0.7); g.closePath(); g.fill();
    },
    back(g, W, H, t) {
      for (let i = 0; i < 30; i++) { const x = (i * 97) % W, y = (i * 53) % (H * 0.5); const a = 0.5 + 0.5 * Math.sin(t * (1 + i % 3) + i); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, 2, 2); }
      const u = (t * 0.18) % 1;
      if (u < 0.1) { const k = u / 0.1, x = W * (0.7 - k * 0.3), y = H * (0.05 + k * 0.18); g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y - 24); g.stroke(); }
    },
    front(g, W, H, t) {
      for (let i = 0; i < 14; i++) { const x = W * ((i * 0.37 + t * 0.01 * (i % 2 ? 1 : -1)) % 1), y = H * (0.6 + ((i * 0.29) % 1) * 0.3) + Math.sin(t + i) * 10; add(g, () => glow(g, x, y, 8, '200,255,140', 0.5 + 0.4 * Math.sin(t * 3 + i))); }
    },
  };
  S.stadium = {
    name: '星光杯决赛场',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#0a0d24'], [1, '#1a1440']]); g.fillRect(0, 0, W, H);
      // 环形看台
      for (let r = 0; r < 3; r++) { box(g, 0, H * (0.12 + r * 0.12), W, H * 0.12, r % 2 ? '#1e1a44' : '#241f52'); crowd(g, W, H * (0.13 + r * 0.12), H * (0.23 + r * 0.12), rnd, ['#3a3470', '#4b3f88', '#2c2a5a', '#ff6a8a', '#ffd23f']); }
      // 大屏幕
      box(g, W * 0.36, H * 0.02, W * 0.28, H * 0.1, '#05070f', 6);
      g.fillStyle = '#ffd23f'; g.font = `bold ${Math.round(H * 0.045)}px sans-serif`; g.textAlign = 'center'; g.fillText('★ 星光杯 · 决赛 ★', W * 0.5, H * 0.085);
      // 横幅
      box(g, W * 0.06, H * 0.47, W * 0.4, H * 0.06, '#c0392b', 4); g.fillStyle = '#fff'; g.font = `bold ${Math.round(H * 0.032)}px sans-serif`; g.fillText('星光体育馆，我们守护！', W * 0.26, H * 0.51);
      box(g, W * 0.56, H * 0.47, W * 0.38, H * 0.06, '#2f6fd6', 4); g.fillStyle = '#fff'; g.fillText('寒星中学 必胜', W * 0.75, H * 0.51);
      g.fillStyle = lin(g, 0, H * 0.55, 0, H, [[0, '#2c7a5a'], [1, '#174a36']]); g.fillRect(0, H * 0.55, W, H * 0.45);
      courtLines(g, W, H, H * 0.56);
      net(g, W, H, H * 0.7, H * 0.12);
    },
    back(g, W, H, t) {
      add(g, () => {
        for (let i = 0; i < 4; i++) {
          const x0 = W * (0.1 + i * 0.27), a = Math.sin(t * 0.7 + i * 1.3) * 0.25;
          g.fillStyle = lin(g, x0, 0, x0, H, [[0, 'rgba(200,220,255,0.28)'], [1, 'rgba(200,220,255,0)']]);
          g.beginPath(); g.moveTo(x0 - 8, 0); g.lineTo(x0 + 8, 0); g.lineTo(x0 + W * (a + 0.12), H); g.lineTo(x0 + W * (a - 0.12), H); g.closePath(); g.fill();
        }
        for (let i = 0; i < 6; i++) { const ph = (t * 1.7 + i * 0.37) % 1; if (ph < 0.08) glow(g, W * ((i * 0.41) % 1), H * (0.15 + ((i * 0.23) % 1) * 0.3), 16, '255,255,255', 0.9); }
      });
    },
  };
  S.festival = {
    name: '庆功夜 · 天台',
    bake(g, W, H, rnd) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#090b26'], [0.7, '#2a1f55'], [1, '#41306a']]); g.fillRect(0, 0, W, H);
      stars(g, W, H, 90, rnd, H * 0.45);
      skyline(g, W, H * 0.62, rnd, '#141632', 'rgba(255,214,140,0.7)');
      g.fillStyle = lin(g, 0, H * 0.62, 0, H, [[0, '#5a4e6e'], [1, '#2a2338']]); g.fillRect(0, H * 0.62, W, H * 0.38);
      net(g, W, H, H * 0.76, H * 0.11);
      // 小桌：奶茶、蛋糕
      box(g, W * 0.02, H * 0.66, W * 0.14, H * 0.03, '#f4e6d0', 3);
      box(g, W * 0.04, H * 0.62, 12, H * 0.04, '#ffb3cf', 3); box(g, W * 0.07, H * 0.63, 22, H * 0.03, '#fff3f7', 3); box(g, W * 0.07, H * 0.625, 22, 4, '#ff5a8a', 2);
    },
    back(g, W, H, t, st) {
      bunting(g, W, H * 0.05, ['#ff5a8a', '#ffd23f', '#4fd1ff', '#7dffb0']);
      for (let i = 0; i < 24; i++) { const u = (i + 0.5) / 24, x = u * W, y = H * 0.05 + 60 * u * (1 - u) + 14; add(g, () => glow(g, x, y + 4, 9, ['255,200,120', '255,140,190', '160,220,255'][i % 3], 0.5 + 0.4 * Math.sin(t * 4 + i))); }
      // 烟花
      st.fw = st.fw || [];
      st.fwT = (st.fwT == null ? 0.2 : st.fwT) - st.dt;
      if (st.fwT <= 0) { st.fwT = 0.7 + Math.random() * 0.9; st.fw.push({ x: W * (0.15 + Math.random() * 0.7), y: H * (0.12 + Math.random() * 0.2), t: 0, c: ['255,120,160', '255,220,120', '140,220,255', '180,255,160', '210,160,255'][(Math.random() * 5) | 0], n: 26 + ((Math.random() * 14) | 0) }); }
      add(g, () => {
        for (const f of st.fw) {
          f.t += st.dt; const k = f.t / 1.6, R = Math.sqrt(k) * H * 0.18, a = Math.max(0, 1 - k);
          glow(g, f.x, f.y, R * 1.2, f.c, a * 0.25);
          g.fillStyle = `rgba(${f.c},${a})`;
          for (let i = 0; i < f.n; i++) { const an = (i / f.n) * TAU; g.beginPath(); g.arc(f.x + Math.cos(an) * R, f.y + Math.sin(an) * R + k * k * 30, 2, 0, TAU); g.fill(); }
        }
      });
      st.fw = st.fw.filter((f) => f.t < 1.6);
    },
  };
  YY.SCENES = S;

  // ---------- 演出 ----------
  const WHO_ME = 'lingfeng';
  /** 由对话步骤与当前行，算出场人物（开场 cast + 已说过话的人，按出场顺序） */
  YY.storyCast = function (step, i) {
    const cast = (step.cast || []).slice();
    for (let k = 0; k <= i && k < step.lines.length; k++) { const w = step.lines[k][0]; if (w !== 'nar' && w !== 'mm' && !cast.includes(w)) cast.push(w); }
    return cast;
  };
  function lookFor(id) { return id === 'me' ? YY.lookOf(WHO_ME) : YY.lookOf(id); }

  /** 毛毛：会说话的羽毛球 */
  function drawMaomao(g, x, y, s, t, talking, mood) {
    g.save(); g.translate(x, y + Math.sin(t * 2.4) * s * 0.08); g.rotate(Math.sin(t * 1.7) * 0.12 + (mood === 'cheer' ? Math.sin(t * 12) * 0.15 : 0));
    // 羽毛裙
    for (let i = -3; i <= 3; i++) {
      g.fillStyle = i % 2 ? '#e6eef7' : '#ffffff'; g.strokeStyle = 'rgba(120,130,160,0.6)'; g.lineWidth = s * 0.012;
      g.beginPath(); g.moveTo(i * s * 0.05, -s * 0.05); g.lineTo(i * s * 0.16 - s * 0.05, -s * 0.62); g.quadraticCurveTo(i * s * 0.16, -s * 0.7, i * s * 0.16 + s * 0.05, -s * 0.62); g.lineTo(i * s * 0.05 + s * 0.04, -s * 0.05); g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = '#e04848'; g.fillRect(-s * 0.2, -s * 0.1, s * 0.4, s * 0.09);
    // 球头脸
    g.fillStyle = rad(g, -s * 0.06, s * 0.05, s * 0.02, s * 0.24, [[0, '#fff5e2'], [1, '#e8cfa5']]);
    g.beginPath(); g.arc(0, s * 0.1, s * 0.22, 0, TAU); g.fill(); g.strokeStyle = 'rgba(120,80,40,0.6)'; g.lineWidth = s * 0.015; g.stroke();
    g.fillStyle = '#2b1a12';
    if (mood === 'happy' || mood === 'cheer' || mood === 'smile') { g.lineWidth = s * 0.025; g.strokeStyle = '#2b1a12'; for (const ex of [-0.08, 0.08]) { g.beginPath(); g.arc(ex * s, s * 0.08, s * 0.035, Math.PI + 0.3, -0.3); g.stroke(); } }
    else for (const ex of [-0.08, 0.08]) { g.beginPath(); g.ellipse(ex * s, s * 0.07, s * 0.03, s * (mood === 'surprise' ? 0.05 : 0.04), 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex * s + s * 0.01, s * 0.055, s * 0.01, 0, TAU); g.fill(); g.fillStyle = '#2b1a12'; }
    g.fillStyle = 'rgba(255,120,120,0.45)'; for (const ex of [-0.15, 0.15]) { g.beginPath(); g.ellipse(ex * s, s * 0.16, s * 0.04, s * 0.022, 0, 0, TAU); g.fill(); }
    const open = talking ? 0.02 + Math.abs(Math.sin(t * 16)) * 0.04 : mood === 'surprise' ? 0.04 : 0.012;
    g.fillStyle = '#7a2a2a'; g.beginPath(); g.ellipse(0, s * 0.2, s * 0.04, s * open, 0, 0, TAU); g.fill();
    g.restore();
  }

  YY.Renderer.prototype.drawStory = function (info, dt) {
    const g = this.ctx, W = this.W, H = this.H, d = this.dpr;
    const sc = S[info.scene] || S.gym;
    this.time += dt;
    const t = this.time;
    if(this.storyLineKey!==info.lineKey){this.storyLineKey=info.lineKey;this.storyLineAt=t;}
    const actionAge=t-(this.storyLineAt||t);
    // 烘焙背景
    const c = this.storyBg;
    if (!c || c.id !== info.scene || c.W !== W || c.H !== H || c.dpr !== d) {
      const cv = YY.platform.createCanvas(); cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      const bg = cv.getContext('2d'); bg.setTransform(d, 0, 0, d, 0, 0);
      sc.bake(bg, W, H, rng(info.scene.length * 977 + 13));
      // 暗角
      bg.fillStyle = rad(bg, W / 2, H * 0.45, Math.min(W, H) * 0.4, Math.max(W, H) * 0.8, [[0, 'rgba(0,0,10,0)'], [1, 'rgba(0,0,10,0.45)']]); bg.fillRect(0, 0, W, H);
      this.storyBg = { id: info.scene, W, H, dpr: d, cv };
      this.storyFx = { dt: 0 };
      this.storyPos = {};
    }
    const st = this.storyFx; st.dt = dt;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.drawImage(this.storyBg.cv, 0, 0, W, H);
    if (sc.back) sc.back(g, W, H, t, st);

    // 人物站位：平均分布在画面中部，左半边的人面朝右，右半边的面朝左
    const cast = info.cast || [], n = cast.length, pos = this.storyPos;
    const k = H * (n >= 5 ? 0.37 : n >= 4 ? 0.41 : n >= 3 ? 0.44 : 0.47);
    const span = Math.min(info.mm ? W * 0.68 : W * 0.78, n * k * 0.95), cx = info.mm ? W * 0.46 : W / 2;
    const order = [];
    cast.forEach((id, i) => {
      const tx = cx + (n === 1 ? -W * 0.08 : (i / (n - 1) - 0.5) * span);
      let p = pos[id];
      if (!p) p = pos[id] = { x: tx + (tx < W / 2 ? -W * 0.12 : W * 0.12), a: 0, mood: i % 2 ? 'rest' : 'smile', seen: t };
      p.x += (tx - p.x) * Math.min(1, dt * 7);
      p.a = Math.min(1, p.a + dt * 3.5);
      p.f = tx <= cx ? 1 : -1;
      if (id === info.who && info.mood) p.mood = info.mood;
      order.push(id);
    });
    const speaking = cast.includes(info.who) ? info.who : null;
    const drawOne = (id, focus) => {
      const p = pos[id], look = lookFor(id);
      if (!look) return;
      const walking=focus&&['steps','door'].includes(info.action)&&actionAge<1;
      const fake = { idx: cast.indexOf(id), dir: 1, vx: walking?1.2:0, vy: 0, onGround: true, swing: null, runPhase: walking?actionAge*8:0, land: 0, x: 0, y: 0 };
      const mood = focus ? info.mood || 'talk' : p.mood === 'talk' ? 'smile' : p.mood;
      const hop = mood === 'cheer' ? Math.abs(Math.sin(t * 7 + fake.idx)) * 0.07 : focus ? Math.abs(Math.sin(t * 2.2)) * 0.012 : 0;
      const kk = k * (focus ? 1.05 : 1);
      g.save();
      g.globalAlpha = p.a;
      g.translate(p.x, H * 0.99 - hop * kk);
      if (this.quality) {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, -2 + hop * kk, kk * 0.32, kk * 0.05, 0, 0, TAU); g.fill();
      }
      g.scale(p.f * kk, -kk);
      const blink = ((t + fake.idx * 1.3) % 3.6) < 0.12;
      const holdingPaper=focus&&['paper','page','rustle'].includes(info.action);
      const conversational=['notice','archive','hearing','cafe','canteen','classroom','nightroad','lab','stars','locker','gameroom','fitness'].includes(info.scene);
      const pose=YY.drawCharacter(g, fake, look, { time: t, mood, gazeX: 1, gazeY: mood === 'think' ? 0.6 : 0, spring: [Math.sin(t * 1.3 + fake.idx) * 0.02, 0], f: p.f, talk: focus && info.talking, blink,hideRacket:holdingPaper||conversational });
      if(focus&&['paper','page','rustle'].includes(info.action)){
        g.save();g.translate(pose.W[0],pose.W[1]);g.rotate(Math.sin(actionAge*7)*.035);g.fillStyle='#efe2bc';g.fillRect(-.16,-.16,.32,.42);g.strokeStyle='#9e936f';g.lineWidth=.012;
        for(let i=0;i<4;i++){g.beginPath();g.moveTo(-.1,-.08+i*.065);g.lineTo(.1,-.08+i*.065);g.stroke();}g.restore();
      }
      g.restore();
    };
    for (const id of order) if (id !== speaking) drawOne(id, false);
    if (speaking && info.who !== 'nar') {
      g.fillStyle = 'rgba(4,6,18,0.22)'; g.fillRect(0, 0, W, H);
      drawOne(speaking, true);
    }
    // 毛毛：浮在画面右上方，说话时跳到中间
    if (info.mm) {
      const m = this.storyMM || (this.storyMM = { x: W * 0.86, y: H * 0.3 });
      const tx = info.who === 'mm' ? W * 0.74 : W * 0.88, ty = info.who === 'mm' ? H * 0.36 : H * 0.34;
      m.x += (tx - m.x) * Math.min(1, dt * 5); m.y += (ty - m.y) * Math.min(1, dt * 5);
      if (info.who === 'mm') add(g, () => glow(g, m.x, m.y, H * 0.16, '255,230,140', 0.35));
      drawMaomao(g, m.x, m.y, H * (info.who === 'mm' ? 0.26 : 0.18), t, info.who === 'mm' && info.talking, info.who === 'mm' ? info.mood : 'smile');
    }
    if (sc.front) sc.front(g, W, H, t, st);
    // 情绪符号
    if (speaking && info.mood) {
      const p = pos[speaking], hx = p.x + p.f * k * 0.15, hy = H * 0.99 - k * 1.98;
      const sym = { surprise: '！', angry: '!!', shy: '♡', think: '…', cheer: '♪', happy: '♪', fist: '★', sad: '…' }[info.mood];
      if (sym) {
        const bob = Math.sin(t * 6) * 4;
        g.font = `bold ${Math.round(k * 0.2)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = info.mood === 'shy' ? '#ff6f9a' : info.mood === 'angry' ? '#ff4b55' : '#ffd23f';
        g.fillText(sym, hx + p.f * k * 0.25, hy + bob);
      }
    }
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
