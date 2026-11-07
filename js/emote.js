// 对局互动表情：数据（服务器也会读取）+ 矢量贴纸绘制（只在客户端调用）
(function (G) {
  const YY = G.YY || (G.YY = {});
  const TAU = Math.PI * 2;
  /**
   * kind：self 在自己头顶冒出；throw 从自己手里飞过网，落到对手身上并引起反应。
   * mood / hitMood：死球间隙时双方角色的表情动作（回合进行中只显示贴纸，不打断动作）。
   */
  const EMOTES = [
    { id: 'nice', name: '好球！', kind: 'self', color: '#ffd84a', sfx: 'emote-pop', mood: 'point' },
    { id: 'haha', name: '哈哈哈', kind: 'self', color: '#ffd84a', sfx: 'emote-pop', mood: 'happy' },
    { id: 'again', name: '再来！', kind: 'self', color: '#ff8a3d', sfx: 'emote-pop', mood: 'fist' },
    { id: 'oops', name: '手滑了', kind: 'self', color: '#8fd3ff', sfx: 'emote-pop', mood: 'sad' },
    { id: 'tired', name: '累瘫…', kind: 'self', color: '#b9a8ff', sfx: 'emote-pop', mood: 'tired' },
    { id: 'cool', name: '稳！', kind: 'self', color: '#5fe3a1', sfx: 'emote-pop', mood: 'smile' },
    { id: 'heart', name: '比心', kind: 'self', color: '#ff7eb3', sfx: 'emote-sparkle', mood: 'shy' },
    { id: 'shock', name: '震惊！', kind: 'self', color: '#5fd4ff', sfx: 'emote-pop', mood: 'surprise' },
    { id: 'flower', name: '送你花花', kind: 'throw', color: '#ff9cc2', sfx: 'emote-sparkle', mood: 'wave', hitMood: 'shy', hit: '收到花花' },
    { id: 'milktea', name: '请你喝奶茶', kind: 'throw', color: '#ffb3c7', sfx: 'emote-sip', mood: 'wave', hitMood: 'happy', hit: '+1 快乐' },
    { id: 'bonk', name: '羽球敲头', kind: 'throw', color: '#ffffff', sfx: 'emote-bonk', mood: 'happy', hitMood: 'surprise', hit: '咚！' },
    { id: 'banana', name: '香蕉皮', kind: 'throw', color: '#ffe066', sfx: 'emote-slip', mood: 'happy', hitMood: 'surprise', hit: '哎呀！', floor: true },
  ];
  const BY = {}; for (const e of EMOTES) BY[e.id] = e;
  YY.EMOTES = EMOTES;
  YY.emote = (id) => BY[id] || null;
  /** 发送频率：两次之间至少 1.2 秒，10 秒内最多 4 个（客户端与服务器同一规则） */
  YY.EMOTE_LIMIT = { gap: 1.2, window: 10, max: 4 };
  YY.emoteAllowed = function (log, t) {
    const L = YY.EMOTE_LIMIT, recent = log.filter((x) => t - x < L.window);
    return !(recent.length && t - recent[recent.length - 1] < L.gap) && recent.length < L.max;
  };

  // ====================== 贴纸绘制 ======================
  // 坐标：原点在贴纸中心，s 为半径（像素）；t 为贴纸已显示的秒数，用于循环小动画。
  const ease = (u) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);
  function face(g, s, fill = '#ffd84a', shade = '#f5a623') {
    const gr = g.createRadialGradient(-s * .3, -s * .35, s * .1, 0, 0, s);
    gr.addColorStop(0, '#fff6c2'); gr.addColorStop(.45, fill); gr.addColorStop(1, shade);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
    g.strokeStyle = '#7a4a12'; g.lineWidth = Math.max(1.2, s * .07); g.stroke();
  }
  function blush(g, s, a = .55) {
    g.fillStyle = `rgba(255,120,140,${a})`;
    for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * s * .52, s * .2, s * .16, s * .09, 0, 0, TAU); g.fill(); }
  }
  function eyes(g, s, kind) {
    g.strokeStyle = g.fillStyle = '#3b2208'; g.lineWidth = Math.max(1.2, s * .085); g.lineCap = 'round';
    for (const d of [-1, 1]) {
      const x = d * s * .34, y = -s * .14;
      if (kind === 'happy') { g.beginPath(); g.arc(x, y + s * .06, s * .14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (kind === 'x') { const r = s * .11; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }
      else if (kind === 'wide') { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, s * .17, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3b2208'; g.beginPath(); g.arc(x, y + s * .02, s * .07, 0, TAU); g.fill(); }
      else if (kind === 'flat') { g.beginPath(); g.moveTo(x - s * .13, y + s * .04); g.lineTo(x + s * .13, y + s * .04); g.stroke(); }
      else { g.beginPath(); g.ellipse(x, y, s * .075, s * .11, 0, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - s * .025, y - s * .04, s * .028, 0, TAU); g.fill(); g.fillStyle = '#3b2208'; }
    }
  }
  function sparkle(g, x, y, r, color = '#ffffff') {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }
  function heartPath(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y + r * .9);
    g.bezierCurveTo(x - r * 1.5, y - r * .1, x - r * .7, y - r * 1.25, x, y - r * .45);
    g.bezierCurveTo(x + r * .7, y - r * 1.25, x + r * 1.5, y - r * .1, x, y + r * .9); g.closePath();
  }
  function shuttle(g, s) { // 羽毛球：球托朝下
    g.fillStyle = '#ffffff'; g.strokeStyle = '#8aa0c0'; g.lineWidth = Math.max(1, s * .06);
    g.beginPath(); g.moveTo(-s * .32, s * .25); g.lineTo(-s * .7, -s * .75); g.quadraticCurveTo(0, -s * .95, s * .7, -s * .75); g.lineTo(s * .32, s * .25); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); for (const x of [-.35, 0, .35]) { g.moveTo(x * s * .5, s * .2); g.lineTo(x * s * 1.6, -s * .8); } g.stroke();
    g.fillStyle = '#e84a5f'; g.fillRect(-s * .34, s * .2, s * .68, s * .12);
    g.fillStyle = '#ffe8b1'; g.beginPath(); g.arc(0, s * .32, s * .34, 0, Math.PI); g.fill(); g.strokeStyle = '#b98b4a'; g.stroke();
  }
  const DRAW = {
    nice(g, s, t) { // 竖大拇指 + 闪光
      g.save(); g.rotate(Math.sin(t * 7) * .08);
      g.fillStyle = '#ffd27a'; g.strokeStyle = '#8a5a1c'; g.lineWidth = Math.max(1.2, s * .07);
      g.beginPath(); g.moveTo(-s * .55, -s * .05); g.lineTo(-s * .55, s * .7); g.lineTo(s * .45, s * .7);
      g.quadraticCurveTo(s * .72, s * .68, s * .7, s * .4); g.quadraticCurveTo(s * .82, s * .2, s * .66, s * .05); g.quadraticCurveTo(s * .76, -s * .2, s * .5, -s * .25);
      g.lineTo(s * .02, -s * .25); g.quadraticCurveTo(s * .2, -s * .65, s * .05, -s * .9); g.quadraticCurveTo(-s * .12, -s * .98, -s * .2, -s * .7); g.quadraticCurveTo(-s * .3, -s * .3, -s * .55, -s * .05);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e84a5f'; g.fillRect(-s * .85, -s * .1, s * .3, s * .85); g.strokeRect(-s * .85, -s * .1, s * .3, s * .85);
      g.beginPath(); for (const y of [.12, .3, .48]) { g.moveTo(s * .1, y * s); g.lineTo(s * .62, y * s); } g.stroke();
      g.restore();
      const k = (t * 1.6) % 1; sparkle(g, s * .75, -s * .75, s * .28 * (1 - Math.abs(k - .5) * 1.4), '#fff7b0'); sparkle(g, -s * .8, -s * .55, s * .16 * (Math.abs(k - .5) * 1.4 + .3), '#ffffff');
    },
    haha(g, s, t) { // 笑出眼泪，上下颠
      g.translate(0, -Math.abs(Math.sin(t * 9)) * s * .12); g.rotate(Math.sin(t * 9) * .1);
      face(g, s); eyes(g, s, 'happy'); blush(g, s);
      g.fillStyle = '#7a2a1a'; g.beginPath(); g.moveTo(-s * .42, s * .14); g.quadraticCurveTo(0, s * .95, s * .42, s * .14); g.closePath(); g.fill();
      g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(0, s * .5, s * .18, s * .1, 0, 0, TAU); g.fill();
      g.fillStyle = '#7fd6ff'; for (const d of [-1, 1]) { const y = -s * .02 + ((t * 2) % 1) * s * .35; g.beginPath(); g.ellipse(d * s * .62, y, s * .09, s * .14, 0, 0, TAU); g.fill(); }
    },
    again(g, s, t) { // 握拳 + 火焰
      const p = 1 + Math.sin(t * 10) * .06;
      for (const [c, k] of [['#ff6a2b', 1], ['#ffc23a', .68]]) {
        g.fillStyle = c; g.beginPath(); g.moveTo(-s * .75 * k, s * .55);
        for (let i = 0; i <= 6; i++) { const x = (-.75 + i * .25) * s * k, h = (i % 2 ? .95 : .55) * s * k * p + Math.sin(t * 12 + i) * s * .06; g.lineTo(x, s * .55 - h - s * .2); }
        g.lineTo(s * .75 * k, s * .55); g.closePath(); g.fill();
      }
      g.fillStyle = '#ffd27a'; g.strokeStyle = '#8a5a1c'; g.lineWidth = Math.max(1.2, s * .07);
      g.beginPath(); g.roundRect ? g.roundRect(-s * .45, -s * .15, s * .9, s * .72, s * .18) : g.rect(-s * .45, -s * .15, s * .9, s * .72); g.fill(); g.stroke();
      g.beginPath(); for (const x of [-.22, 0, .22]) { g.moveTo(x * s, -s * .15); g.lineTo(x * s, s * .12); } g.moveTo(-s * .45, s * .2); g.quadraticCurveTo(-s * .1, s * .3, s * .1, s * .14); g.stroke();
    },
    oops(g, s, t) { // 冒汗 + 球拍脱手飞走
      face(g, s, '#ffe27a'); eyes(g, s, 'x');
      g.strokeStyle = '#3b2208'; g.lineWidth = Math.max(1.2, s * .08); g.beginPath();
      for (let i = 0; i <= 4; i++) { const x = -s * .32 + i * s * .16; if (i) g.lineTo(x, s * .38 + (i % 2 ? -1 : 1) * s * .06); else g.moveTo(x, s * .38); } g.stroke();
      g.fillStyle = '#7fd6ff'; g.beginPath(); g.moveTo(s * .72, -s * .62); g.quadraticCurveTo(s * .95, -s * .25, s * .72, -s * .18); g.quadraticCurveTo(s * .5, -s * .25, s * .72, -s * .62); g.fill();
      const k = (t * .9) % 1; g.save(); g.translate(-s * .9 - k * s * .4, -s * .7 - k * s * .5); g.rotate(-t * 9); g.globalAlpha *= 1 - k * .6;
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, s * .07); g.beginPath(); g.ellipse(0, -s * .2, s * .18, s * .24, 0, 0, TAU); g.moveTo(0, s * .04); g.lineTo(0, s * .45); g.stroke(); g.restore();
    },
    tired(g, s, t) { // 融化的脸 + 冒烟
      g.save(); g.scale(1, .82 + Math.sin(t * 3) * .03); face(g, s, '#e8d6ff', '#a98bf0'); g.restore();
      g.fillStyle = '#c4adf7'; for (const [x, h] of [[-.45, .35], [.1, .5], [.5, .25]]) { g.beginPath(); g.ellipse(x * s, s * .8 + h * s * .3, s * .1, h * s * .45, 0, 0, TAU); g.fill(); }
      eyes(g, s, 'flat');
      g.strokeStyle = '#3b2208'; g.lineWidth = Math.max(1.2, s * .07); g.beginPath(); g.ellipse(0, s * .32, s * .12, s * .07, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, s * .06);
      for (let i = 0; i < 3; i++) { const k = (t * .8 + i / 3) % 1; g.globalAlpha = Math.sin(k * Math.PI); g.beginPath(); g.moveTo(s * (.3 + i * .25), -s * .9 - k * s * .5); g.quadraticCurveTo(s * (.42 + i * .25), -s * 1.05 - k * s * .5, s * (.3 + i * .25), -s * 1.2 - k * s * .5); g.stroke(); }
      g.globalAlpha = 1;
    },
    cool(g, s, t) { // 墨镜 + 反光
      face(g, s, '#bff5d9', '#3fc787');
      g.fillStyle = '#14171f'; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * s * .34, -s * .12, s * .3, s * .2, 0, 0, TAU); g.fill(); }
      g.fillRect(-s * .1, -s * .18, s * .2, s * .06);
      const k = (t * .7) % 1; g.save(); g.beginPath(); for (const d of [-1, 1]) g.ellipse(d * s * .34, -s * .12, s * .3, s * .2, 0, 0, TAU); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = s * .1; g.beginPath(); g.moveTo(-s + k * s * 3, -s * .4); g.lineTo(-s * 1.3 + k * s * 3, s * .2); g.stroke(); g.restore();
      g.strokeStyle = '#2a4a3a'; g.lineWidth = Math.max(1.2, s * .08); g.lineCap = 'round'; g.beginPath(); g.moveTo(-s * .25, s * .38); g.quadraticCurveTo(s * .1, s * .5, s * .32, s * .3); g.stroke();
    },
    heart(g, s, t) { // 跳动的大心 + 上升的小心
      const b = 1 + Math.max(0, Math.sin(t * 8)) * .1;
      g.save(); g.scale(b, b);
      const gr = g.createLinearGradient(0, -s, 0, s); gr.addColorStop(0, '#ff9cc2'); gr.addColorStop(1, '#ff4f8b');
      g.fillStyle = gr; heartPath(g, 0, 0, s * .75); g.fill(); g.strokeStyle = '#b8285c'; g.lineWidth = Math.max(1.2, s * .06); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-s * .35, -s * .35, s * .14, s * .08, -.6, 0, TAU); g.fill(); g.restore();
      for (let i = 0; i < 3; i++) { const k = (t * .9 + i / 3) % 1; g.globalAlpha = Math.sin(k * Math.PI); g.fillStyle = '#ffb3cf'; heartPath(g, (i - 1) * s * .7 + Math.sin(t * 4 + i) * s * .1, -s * .6 - k * s * .8, s * .16); g.fill(); }
      g.globalAlpha = 1;
    },
    shock(g, s, t) { // 瞪大眼 + 张嘴 + 闪电线
      const j = Math.sin(t * 40) * s * .03; g.translate(j, 0);
      face(g, s, '#c8f0ff', '#5fb8e8'); eyes(g, s, 'wide');
      g.fillStyle = '#3b2208'; g.beginPath(); g.ellipse(0, s * .42, s * .14, s * .2, 0, 0, TAU); g.fill();
      g.strokeStyle = '#ffd84a'; g.lineWidth = Math.max(1.2, s * .08); g.lineJoin = 'round';
      for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * s * 1.05, -s * .9); g.lineTo(d * s * .85, -s * .6); g.lineTo(d * s * 1.05, -s * .5); g.lineTo(d * s * .82, -s * .2); g.stroke(); }
    },
    flower(g, s, t) { // 花束
      g.fillStyle = '#6fd18a'; for (const a of [-.5, 0, .5]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, s * .35, s * .1, s * .45, 0, 0, TAU); g.fill(); g.restore(); }
      for (const [x, y, c] of [[-.38, -.2, '#ff7eb3'], [.38, -.2, '#ffcf4a'], [0, -.5, '#ff5d8f'], [0, -.05, '#ffffff']]) {
        g.save(); g.translate(x * s, y * s); g.rotate(t * .8); g.fillStyle = c;
        for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -s * .17, s * .12, s * .17, 0, 0, TAU); g.fill(); }
        g.fillStyle = '#ffe066'; g.beginPath(); g.arc(0, 0, s * .09, 0, TAU); g.fill(); g.restore();
      }
      g.fillStyle = '#ff9cc2'; g.beginPath(); g.moveTo(-s * .4, s * .3); g.lineTo(s * .4, s * .3); g.lineTo(s * .18, s * .95); g.lineTo(-s * .18, s * .95); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, s * .45, s * .1, 0, TAU); g.fill();
    },
    milktea(g, s, t) { // 草莓奶茶：杯子 + 吸管 + 珍珠 + 草莓
      g.fillStyle = 'rgba(255,255,255,.85)'; g.strokeStyle = '#c96a8a'; g.lineWidth = Math.max(1.2, s * .07);
      g.beginPath(); g.moveTo(-s * .5, -s * .45); g.lineTo(s * .5, -s * .45); g.lineTo(s * .38, s * .9); g.lineTo(-s * .38, s * .9); g.closePath(); g.fill();
      g.save(); g.clip(); const gr = g.createLinearGradient(0, -s * .3, 0, s * .9); gr.addColorStop(0, '#ffd1df'); gr.addColorStop(1, '#ff8fb0'); g.fillStyle = gr; g.fillRect(-s, -s * .25 + Math.sin(t * 4) * s * .03, s * 2, s * 1.3);
      g.fillStyle = '#4a2a2a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((-.25 + (i % 3) * .25) * s, (.62 + Math.floor(i / 3) * .16) * s, s * .07, 0, TAU); g.fill(); } g.restore();
      g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -s * .48, s * .56, s * .12, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#ff5d8f'; g.lineWidth = s * .12; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * .1, -s * .45); g.lineTo(s * .3, -s * 1.0); g.stroke();
      g.fillStyle = '#ff4060'; g.beginPath(); g.moveTo(-s * .42, -s * .7); g.quadraticCurveTo(-s * .72, -s * .5, -s * .42, -s * .28); g.quadraticCurveTo(-s * .12, -s * .5, -s * .42, -s * .7); g.fill();
      g.fillStyle = '#5fd17a'; g.beginPath(); g.ellipse(-s * .42, -s * .7, s * .12, s * .05, 0, 0, TAU); g.fill();
    },
    bonk(g, s, t) { g.rotate(Math.sin(t * 6) * .25); shuttle(g, s * .9); },
    banana(g, s, t) { // 香蕉皮
      g.rotate(Math.sin(t * 5) * .08);
      g.fillStyle = '#ffe066'; g.strokeStyle = '#a07a12'; g.lineWidth = Math.max(1.2, s * .06);
      for (const a of [-1.1, 0, 1.1]) { g.save(); g.rotate(a * .55); g.beginPath(); g.moveTo(-s * .12, s * .2); g.quadraticCurveTo(-s * .3, -s * .3, a * s * .2, -s * .8); g.quadraticCurveTo(s * .3, -s * .3, s * .12, s * .2); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      g.fillStyle = '#fff6c8'; g.beginPath(); g.ellipse(0, s * .3, s * .32, s * .18, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#6b4a12'; g.fillRect(-s * .06, s * .42, s * .12, s * .16);
    },
  };
  /** 画一个表情贴纸：x,y 为中心，s 为半径（像素），t 为已显示秒数 */
  YY.drawEmote = function (g, id, x, y, s, t = 0) {
    const draw = DRAW[id]; if (!draw) return;
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g, s, t); g.restore();
  };
  /** 弹出缩放：0→1.15→1 */
  YY.emotePop = (u) => (u < .6 ? ease(u / .6) * 1.15 : 1.15 - .15 * ease((u - .6) / .4));
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
