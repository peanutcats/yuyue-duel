/* 羽跃对决 · 渲染器：镜头、分层场景、角色、羽毛球、粒子特效与 HUD */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, lerp } = YY;
  const FONT = YY.FONT, NUMF = YY.NUMF;
  const rr = YY.rr;

  /** 跑动时的日常步伐痕迹（很淡）：[类型, 颜色] */
  const STEP_FX = { sh_light: ['streak', '120,230,240'], sh_butterfly: ['petal', '#ffc4d8'], sh_moon: ['moon', '225,232,248'] };
  /** 果哥各档装备的特效颜色：c 主色，hot 高光（-1 负债入狱） */
  const MARKET_FX = {
    '-1': { c: '176,182,194', hot: '255,176,96' },
    0: { c: '176,126,80', hot: '235,205,160' }, 1: { c: '214,173,117', hot: '255,236,190' }, 2: { c: '255,207,90', hot: '255,246,214' },
    3: { c: '100,234,255', hot: '224,252,255' }, 4: { c: '120,255,191', hot: '234,255,196' }, 5: { c: '199,160,255', hot: '168,244,255' }, 6: { c: '255,150,50', hot: '255,240,170' },
  };
  const MARKET_SOLID = new Set(['chip', 'print', 'sweat', 'smoke', 'flame', 'iron']);
  const SMASH_SHOTS = new Set(['smash', 'halfsmash', 'kill']);
  const rotV = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  class Renderer {
    constructor(canvas) {
      this.gearLooks = new WeakMap(); this.gearT = [0, 0]; this.marketFxState = [{},{}]; this.marketSeed = 1907;
      this.cv = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false }); // 不透明画布：合成时省去与页面的混合
      this.mirror = false;
      this.touch = false;
      this.hudK = 1; // HUD 文字倍率：网页 1，微信小游戏手机横屏放大
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
      this.portraitCache = new Map();
      this.cutin = null;
      this.hudSafe = 0; // 屏幕左右的安全区（刘海）宽度，由宿主设置
      this.hudAvoid = null; // () => [{x,y,w,h}]：技能播报卡要让开的屏幕区域（触屏按键）
      this.windLines = [];
      this.resize();
    }

    // ---------- 尺寸与缓存 ----------
    resize() {
      const vp = YY.viewport ? YY.viewport() : YY.platform.viewport();
      const W = Math.max(vp.W, 160), H = Math.max(vp.H, 120); // 隐藏 / 零尺寸窗口下也能初始化
      // 像素预算：渲染开销与画布像素数成正比（高分屏 / Windows 缩放下画布可达 800 万像素）
      const budget = this.quality ? 2.4e6 : 1.15e6;
      const dpr = Math.max(0.7, Math.min(YY.platform.viewport().dpr || 1, 2, Math.sqrt(budget / (W * H))));
      this.W = W; this.H = H; this.dpr = dpr;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      if (this.cv.style) { this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px'; }
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
      const c = YY.platform.createCanvas();
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
    /** 本场比赛中选手 i 的外观（故事模式、角色选择可替换） */
    lookOf(m, i) {
      const look = (m && m.looks && m.looks[i]) || YY.LOOKS[i], p = m && m.players && m.players[i], g = p && p.gear;
      if ((!g && !p?.market) || !look || !YY.GEAR_ART) return look;
      const debt = !!p.market && YY.marketDebt(p.market.coins), tier = p.market ? (debt ? -2 : YY.marketTier(p.market)) : -1, market = tier >= 0 ? YY.MARKET_TIERS[tier] : null;
      const racket = YY.GEAR_ART.racket[tier >= 3 ? ['r_light','r_prism','r_star','r_heavy'][tier-3] : g?.r], shoe = YY.GEAR_ART.shoe[tier >= 3 ? ['sh_light','sh_stable','sh_moon','sh_cushion'][tier-3] : g?.s];
      if (debt) return this.prisonLook(look);
      if (!racket && !shoe && !market) return look;
      let by = this.gearLooks.get(look); if (!by) { by = new Map(); this.gearLooks.set(look, by); }
      const key = g?.r + '|' + g?.s + '|' + tier; let lk = by.get(key);
      if (!lk) {
        lk = { ...look, racketArt: racket, shoeArt: shoe };
        if (racket) Object.assign(lk, { racket: racket.frame[0], racket2: racket.accent, grip: racket.grip, shaft: racket.shaft[0] });
        if (shoe) Object.assign(lk, { shoe: shoe.upper[0], sole: shoe.out });
        if (market) {
          Object.assign(lk, { marketTier:tier, marketColor:market.color, tank:tier<2, num:tier<2?'':tier>=3?'¥':look.num });
          if(tier<2) Object.assign(lk,{racketArt:null,shoeArt:null,racket:'#986338',racket2:'#d1aa70',shaft:'#946137',grip:'#785132',sock:look.skin,shoe:look.skin,sole:'#795736',shirt:tier===0?look.skin:'#f7efd5',shirt2:tier===0?look.skin2:'#bdb38f',panel:tier===0?look.skin:'#f7efd5',trim:tier===0?look.skin2:'#605947'});
          else if(tier>=3) Object.assign(lk,{shirt:tier===6?'#222938':'#1d3145',shirt2:'#091622',panel:market.color,trim:market.color,racket:market.color,racket2:'#ffffff',shoe:market.color,shorts:'#142635',stripe:market.color,swoosh:YY.MarketArt?.themes[tier].rgb});
        }
        by.set(key, lk);
      }
      return lk;
    }
    /** 负债入狱：黑白条纹囚服、编号牌，手铐脚镣（char.js / market-art.js 画） */
    prisonLook(look) {
      let by = this.gearLooks.get(look); if (!by) { by = new Map(); this.gearLooks.set(look, by); }
      let lk = by.get('prison');
      if (!lk) by.set('prison', lk = { ...look, prison: true, marketTier: undefined, racketArt: null, shoeArt: null, tank: false, headband: false,
        shirt: '#eef0f3', shirt2: '#c3c8d1', panel: '#eef0f3', trim: '#2a2e38', stripe: '#2a2e38', shorts: '#5a606c', shorts2: '#3f444e', num: '',
        racket: '#8a6440', racket2: '#c9a173', shaft: '#7d5a38', grip: '#5b4027', sock: '#d9dce2', shoe: '#5d636e', sole: '#33373f', wrist: '#9aa1ad' });
      return lk;
    }
    portraitOf(look) {
      let c = this.portraitCache.get(look);
      if (!c) { c = YY.portrait(look, 96); this.portraitCache.set(look, c); }
      return c;
    }
    /** 技能发动：横幅切入 */
    skillCutIn(look, skill, left) {
      // 不再整屏闪白、不再横穿球场：只在施放者一侧弹出小卡片（见 drawCutIn）
      this.cutin = { t: 0, life: 1.1, look, name: skill.name, color: /^#[0-9a-f]{6}$/i.test(skill.color) ? skill.color : '#ffd23f', left };
    }
    venueEvent(type, d) { const v = this.venue; if (v.event) v.event(this.vst, type, d || {}); }

    // netOff：坐标平移时球网在画面上移动的距离（物理里网始终在 x=0，两侧半场长度不同）
    sx(x) { x += this.netOff || 0; return this.cx + (this.mirror ? -x : x) * this.sc; }
    sy(y) { return this.gy - y * this.sc; }
    P(x, y, z) { x += this.netOff || 0; const k = this.V && this.V.depth ? this.V.depth(z) : 1; return [this.cx + (this.mirror ? -x : x) * this.sc * k + z * this.ox, this.gy - y * this.sc * k + z * this.oy]; }

    clearFx() { this.emotes = []; this.emoteMood = [null, null]; this.gearPulse = [{}, {}]; this.gearT = [0, 0]; this.marketFxState = [{},{}]; this.marketSeed = 1907; this.trail = []; this.parts = []; this.texts = []; this.banner = null; this.lines = []; this.columns = []; this.ghosts = [[], []]; this.lastWinner = -1; this.scoreSeen = null; }

    /** 固定物理步之间只插值显示；绝不把绘制坐标写回比赛。 */
    capture(m) {
      this.previous = { source: m, time: m.time, phase: m.phase, hits: m.hitCount,
        players: m.players.map(p => ({ ...p, swing: p.swing ? { ...p.swing } : null })), shuttle: { ...m.shuttle } };
    }
    interpolate(m, alpha) {
      const old = this.previous;
      if (alpha == null || !old || old.source !== m || old.phase !== m.phase || old.hits !== m.hitCount || old.time >= m.time) return m;
      const u = clamp(alpha, 0, 1), view = Object.create(m);
      view.players = m.players.map((p, i) => {
        const a = old.players[i];
        if (Math.hypot(p.x-a.x,p.y-a.y) > .6) return p; // 闪现、换位等技能不用插值穿场
        const q = { ...p, x: lerp(a.x,p.x,u), y: lerp(a.y,p.y,u), vx: lerp(a.vx,p.vx,u), vy: lerp(a.vy,p.vy,u), runPhase: lerp(a.runPhase,p.runPhase,u) };
        if (p.motion && a.motion) { q.motion = {}; for (const key of Object.keys(p.motion)) q.motion[key] = lerp(a.motion[key] || 0, p.motion[key], u); }
        if (p.swing && a.swing && p.swing.t >= a.swing.t && p.swing.style === a.swing.style && p.swing.contact === a.swing.contact)
          q.swing = { ...p.swing, t: lerp(a.swing.t,p.swing.t,u) };
        return q;
      });
      const s = m.shuttle, a = old.shuttle;
      if (s.live === a.live && s.held === a.held && s.ver === a.ver && s.netHit === a.netHit && !s.ctl && Math.hypot(s.x-a.x,s.y-a.y) < 1.5)
        view.shuttle = { ...s, x: lerp(a.x,s.x,u), y: lerp(a.y,s.y,u) };
      return view;
    }

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
    /** 沿出球方向喷射的火花（击球反馈：让人“看见”力量的方向） */
    jet(x, y, vx, vy, n, color, spd, spread) {
      const L = Math.hypot(vx, vy) || 1, a0 = Math.atan2(vy, vx);
      for (let i = 0; i < n; i++) {
        const a = a0 + (Math.random() - 0.5) * (spread || 0.9), v = spd * (0.5 + Math.random() * 0.8);
        this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.18 + Math.random() * 0.22, t: 0, color, size: 0.035, g: 2, drag: 5 });
      }
      return L;
    }
    impact(x, y, color, size, life) { this.add({ type: 'star', x, y, life: life || 0.22, t: 0, size, color, vx: 0, vy: 0, g: 0, rot: Math.random() * 0.8 }); }
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

    /** 击球特效：力度越大，闪光、火花、镜头冲击越强；不同球路有不同的颜色与形态 */
    hitFx(e) {
      const smash = e.shot === 'smash';
      if (e.feed) { this.burst(e.x, e.y, 5, '255,255,255', 2.5); return; }
      const vx = e.vx || 0, vy = e.vy || 0;
      this.hitPulse = 1; this.hitShot = e.shot;
      if (smash || e.shot === 'kill') {
        const col = e.fire ? '255,140,40' : e.shot === 'kill' ? '255,90,90' : '255,190,90';
        this.burst(e.x, e.y, 22, col, 9, 0.05);
        this.jet(e.x, e.y, vx, vy, 18, '255,240,200', 14, 0.5);
        this.impact(e.x, e.y, '255,230,170', 1.1, 0.26);
        this.glow(e.x, e.y, '255,200,120', 1.6, 0.35);
        this.ring(e.x, e.y, '255,220,160', 0.35, 0.4);
        this.feathers(e.x, e.y, 4);
        this.shake = e.shot === 'kill' ? 0.65 : 0.8; this.flash = 0.12; this.flashCol = '255,235,210';
        this.kick(1, e.x, e.y);
        this.lines.push({ x: this.sx(e.x), y: this.sy(e.y), t: 0, life: 0.22 });
        this.venueEvent('smash');
      } else if (e.shot === 'halfsmash') {
        this.jet(e.x, e.y, vx, vy, 12, '255,200,120', 11, 0.5);
        this.impact(e.x, e.y, '255,220,150', 0.8, 0.22);
        this.ring(e.x, e.y, '255,200,120', 0.25, 0.32);
        this.shake = 0.45; this.kick(0.55, e.x, e.y);
      } else if (e.shot === 'tumble') {
        // 搓球：紫色小旋涡
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.add({ type: 'spark', x: e.x + Math.cos(a) * 0.12, y: e.y + Math.sin(a) * 0.12, vx: -Math.sin(a) * 2.2, vy: Math.cos(a) * 2.2, life: 0.35, t: 0, color: '200,160,255', size: 0.03, g: 0, drag: 2 }); }
        this.impact(e.x, e.y, '220,190,255', 0.5, 0.2);
      } else if (e.shot === 'push' || e.shot === 'drive' || e.shot === 'flatclear') {
        this.jet(e.x, e.y, vx, vy, 10, '140,230,255', 9, 0.35);
        this.impact(e.x, e.y, '170,235,255', 0.6, 0.2);
        if (e.shot === 'drive') { this.shake = Math.max(this.shake, 0.25); this.kick(0.25, e.x + Math.sign(vx) * 0.6, e.y); }
      } else if (e.shot === 'net' || e.shot === 'drop' || e.shot === 'block' || e.shot === 'slice') {
        // 轻球：只有一圈柔和的白色气浪和几片飘落的羽毛，没有冲击和震屏
        this.impact(e.x, e.y, '235,245,255', e.shot === 'slice' ? 0.42 : 0.32, 0.16);
        this.burst(e.x, e.y, 5, '255,255,255', 1.6, 0.022);
        if (e.shot === 'slice') this.jet(e.x, e.y, vx, vy, 6, '200,240,255', 5, 0.25);
        if (e.q >= 0.85) this.ring(e.x, e.y, '170,255,210', 0.18, 0.3);
      } else if ((e.shot === 'clear' || e.shot === 'lift' || e.shot === 'lserve') && e.q >= 0.6) {
        // 发力高球：向上的气流与沉闷的冲击圈
        this.jet(e.x, e.y, vx, vy, 9, '255,240,200', 7, 0.45);
        this.impact(e.x, e.y, '255,235,170', 0.7, 0.22);
        this.ring(e.x, e.y, e.q >= 0.85 ? '255,214,90' : '255,255,255', 0.25, 0.32);
        this.kick(e.q >= 0.85 ? 0.3 : 0.15, e.x, e.y);
      } else if (e.q >= 0.85) {
        this.burst(e.x, e.y, 12, '255,225,120', 5, 0.035);
        this.jet(e.x, e.y, vx, vy, 8, '255,240,180', 7, 0.6);
        this.impact(e.x, e.y, '255,230,140', 0.75, 0.24);
        this.ring(e.x, e.y, '255,214,90', 0.25, 0.35);
        this.glow(e.x, e.y, '255,220,120', 0.8, 0.25);
        this.kick(0.3, e.x, e.y);
      } else {
        this.burst(e.x, e.y, 8, '255,255,255', 3.5, 0.028);
        this.impact(e.x, e.y, '255,255,255', 0.45, 0.16);
        this.glow(e.x, e.y, '255,255,255', 0.5, 0.18);
      }
      if (e.meteor) { this.jet(e.x, e.y, vx, vy, 16, '255,226,122', 10, 0.4); this.impact(e.x, e.y, '255,226,122', 1, 0.3); }
      if (e.save || e.lowSave) { this.ring(e.x, e.y, '120,240,255', 0.3, 0.45); this.kick(0.5, e.x, e.y); }
      this.venueEvent('hit');
    }
    /** 器械击球特效：按击球者的球拍叠一层小而精致的标志性效果（只在球附近，不遮挡球路） */
    gearHit(e, m) {
      const p = m && m.players && m.players[e.p], r = p && p.gear && p.gear.r;
      if(p?.market){ if(!e.feed && this.marketHit(p,e)) return; if(this.marketKey(p)!==2) return; }
      if (!r || e.feed || !YY.GEAR_ART?.racket[r]) return;
      const x = e.x, y = e.y, vx = e.vx || 0, vy = e.vy || 0, smash = e.shot === 'smash' || e.shot === 'halfsmash' || e.shot === 'kill';
      switch (r) {
        case 'r_flex': // 柔风：一团柔和的薄荷绿光
          this.glow(x, y, '150,240,200', 0.42, 0.3); this.ring(x, y, '190,255,225', 0.1, 0.32); break;
        case 'r_heavy': // 雷霆：沿出球方向的熔岩火星
          this.jet(x, y, vx, vy, smash ? 8 : 4, '255,96,52', smash ? 9 : 6, 0.35); break;
        case 'r_light': // 疾风：短而利落的青色弧线
          this.add({ type: 'arc', x, y, ang: Math.atan2(vy, vx), life: 0.2, t: 0, size: 0.32, color: '95,215,255', vx: 0, vy: 0, g: 0 }); break;
        case 'r_silk': // 绣羽：短促细碎的粉白光
          for (let i = 0; i < 7; i++) { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.2; this.add({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22 + Math.random() * 0.12, t: 0, color: i % 3 ? '255,190,215' : '255,255,255', size: 0.022, g: 0.5, drag: 4 }); }
          break;
        case 'r_tide': // 潮汐：一圈很淡的水纹
          this.add({ type: 'wave', x, y, life: 0.42, t: 0, size: 0.14, color: '127,233,255', vx: 0, vy: 0, g: 0 }); break;
        case 'r_prism': // 棱镜：极小的十字光点
          this.add({ type: 'cross', x, y, life: 0.18, t: 0, size: 0.2, color: '255,170,80', vx: 0, vy: 0, g: 0 }); break;
        case 'r_star': { // 星轨：最近三拍分属几类，就点亮几颗星
          const n = Math.max(1, new Set((p.gt && p.gt.cats) || []).size);
          for (let i = 0; i < 3; i++) this.add({ type: 'gstar', x: p.x + (i - 1) * 0.26 * p.dir, y: p.y + 2.15 + (i === 1 ? 0.08 : 0), life: 0.7, t: 0, delay: i * 0.07, size: 0.065, color: i < n ? '255,207,74' : '150,140,200', on: i < n, vx: 0, vy: 0, g: 0 });
          break;
        }
        case 'r_shield': // 磐盾：银绿色折线
          if (p.gt && p.gt.hq && p.gt.hq.counter) this.add({ type: 'zig', x, y, ang: Math.atan2(vy, vx), life: 0.22, t: 0, size: 0.34, color: '190,255,220', vx: 0, vy: 0, g: 0 });
          else this.impact(x, y, '190,255,220', 0.25, 0.14);
          break;
      }
    }
    /** 器械特性触发：击球类在球边，移动类贴着地板，都只持续一瞬 */
    gearFx(e, m) {
      const p = m && m.players && m.players[e.p]; if (!p) return;
      const x = e.x, y = e.y, fx = p.x, dir = e.w || Math.sign(p.vx) || p.dir;
      const slot = ['home','pivot','rebound','retreat','calm','moon'].includes(e.k) ? 'shoe' : 'racket';
      this.gearPulse = this.gearPulse || [{}, {}];
      this.gearPulse[e.p][slot] = this.time + 0.45;
      switch (e.k) {
        case 'steady': this.ring(x, y, '170,255,215', 0.16, 0.36); break;
        case 'press': this.glow(x, y, '255,90,46', 0.9, 0.3); this.ring(x, y, '255,120,70', 0.22, 0.32); break;
        case 'pressReady': this.add({ type: 'gstar', x: p.x, y: p.y + 2.3, life: 0.6, t: 0, size: 0.07, color: '255,96,52', on: true, vx: 0, vy: 0.4, g: 0 }); break;
        case 'quick': this.add({ type: 'arc', x, y, ang: Math.PI * (p.side > 0 ? 1 : 0), life: 0.24, t: 0, size: 0.42, color: '140,235,255', vx: 0, vy: 0, g: 0, twin: true }); break;
        case 'needle': for (let i = 0; i < 4; i++) this.add({ type: 'petal', x: x + (Math.random() - 0.5) * 0.3, y: y + 0.05, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.4, life: 0.8, t: 0, size: 0.045, color: '#ffc4d8', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, g: 0.9, drag: 3 }); break;
        case 'precise': this.add({ type: 'cross', x, y, life: 0.3, t: 0, size: 0.38, color: '255,150,40', vx: 0, vy: 0, g: 0 }); break;
        case 'third': for (let i = 0; i < 3; i++) this.add({ type: 'gstar', x: x + (i - 1) * 0.22, y: y + 0.25, life: 0.6, t: 0, delay: i * 0.06, size: 0.08, color: '255,220,110', on: true, vx: (i - 1) * 0.6, vy: 0.8, g: 0, drag: 2 }); break;
        case 'counter': this.add({ type: 'zig', x, y, ang: Math.atan2(m.shuttle.vy || 0, m.shuttle.vx || 1), life: 0.3, t: 0, size: 0.5, color: '170,255,210', vx: 0, vy: 0, g: 0 }); this.ring(x, y, '170,240,200', 0.2, 0.3); break;
        case 'tide': for (let i = 0; i < 2; i++) this.add({ type: 'wave', x: fx, y: 0.02, life: 0.7, t: 0, delay: i * 0.18, size: 0.22, color: '127,233,255', floor: true, vx: 0, vy: 0, g: 0 }); break;
        // —— 移动 ——
        case 'home': this.add({ type: 'streak', x: fx, y: 0.03, w: dir, life: 0.32, t: 0, size: 0.55, color: '120,230,240', vx: 0, vy: 0, g: 0 }); break;
        case 'pivot':
          this.add({ type: 'hexf', x: fx, y: 0.01, life: 0.45, t: 0, size: 0.2, color: '255,176,46', vx: 0, vy: 0, g: 0 });
          for (let i = 0; i < 4; i++) this.add({ type: 'spark', x: fx - dir * 0.1, y: 0.04, vx: -dir * (1 + Math.random() * 1.5), vy: 0.4 + Math.random() * 0.8, life: 0.2, t: 0, color: '255,200,90', size: 0.02, g: 4, drag: 3 });
          break;
        case 'rebound': for (let i = 0; i < 5; i++) this.add({ type: 'puff', x: fx + (i - 2) * 0.12, y: 0.06, vx: (i - 2) * 0.5, vy: 0.25, life: 0.45, t: 0, size: 0.07, color: '200,180,255', g: 0, drag: 3 }); break;
        case 'retreat': for (let i = 0; i < 3; i++) this.add({ type: 'petal', x: fx + dir * 0.1, y: 0.25 + i * 0.12, vx: -dir * (0.5 + Math.random() * 0.6), vy: 0.2, life: 0.65, t: 0, size: 0.04, color: '#ffb3cf', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, g: 0.8, drag: 2.5 }); break;
        case 'calm': this.add({ type: 'wave', x: fx, y: 0.02, life: 1.1, t: 0, size: 0.24, color: '160,205,230', floor: true, soft: true, vx: 0, vy: 0, g: 0 }); break;
        case 'moon': this.add({ type: 'crescent', x: fx, y: 0.02, w: dir, life: 0.45, t: 0, size: 0.3, color: '225,232,248', vx: 0, vy: 0, g: 0 }); break;
      }
    }
    /** 果哥粒子独立随机序列，画面帧率与画质不改变行情或击球的随机结果。 */
    marketRandom() { this.marketSeed=(Math.imul(this.marketSeed,1664525)+1013904223)>>>0;return this.marketSeed/4294967296; }
    /** 果哥当前的特效档：-1 负债入狱，0–6 对应装备档；不是果哥返回 null */
    marketKey(p) { return p?.market ? (YY.marketDebt(p.market.coins) ? -1 : YY.marketTier(p.market)) : null; }
    marketParticle(p,form,x,y,vx,vy,size,life,extra) {
      const key=this.marketKey(p),fx=MARKET_FX[key];if(!fx)return;
      if(this.parts.length>=(this.quality?300:110))return; // 给球、击球和得分粒子预留空间
      let count=0;for(const q of this.parts)if(q.marketOwner!=null)count++;
      if(count>=(this.quality?130:40))return;
      this.add({type:'market',form,x,y,vx,vy,size,life,t:0,g:0,drag:1,color:fx.c,marketOwner:p.idx,marketTier:key,rot:this.marketRandom()*6.28,vr:2,...extra});
    }
    /** 击球：每一档装备都有自己的“手感”——木屑、电弧、刀光、粒子坍缩、火焰 */
    marketHit(p,e) {
      const key=this.marketKey(p),F=MARKET_FX[key];if(!F)return false;
      if(key===2 && p.gear?.r && YY.GEAR_ART?.racket[p.gear.r])return false; // 标准档用的是自己带的器械拍
      const rnd=()=>this.marketRandom(),hq=!!this.quality,n=(lo,hi)=>hq?hi:lo;
      const x=e.x,y=e.y,vx=e.vx||0,vy=e.vy||0,a=Math.atan2(vy,vx||p.dir),smash=SMASH_SHOTS.has(e.shot);
      const P=(form,xx,yy,ux,uy,size,life,extra)=>this.marketParticle(p,form,xx,yy,ux,uy,size,life,extra);
      const spray=(form,count,spread,v0,v1,size,life,extra)=>{
        for(let i=0;i<count;i++){const an=a+(rnd()-.5)*spread,v=v0+rnd()*(v1-v0);P(form,x,y,Math.cos(an)*v,Math.sin(an)*v,size*(.7+rnd()*.6),life*(.75+rnd()*.5),extra);}
      };
      switch(key){
        case -1: // 铐着的旧木拍：铁链“哐”一声，溅出几粒铁屑
          P('clank',x,y,0,0,.2,.26,{vr:0,color:'215,220,230'});
          spray('iron',n(3,6),2.6,1.5,4.5,.03,.4,{g:6,drag:2,color:'255,176,96'});
          break;
        case 0: // 破烂木拍：木屑乱飞，拍面“噗”地冒一口灰
          spray('chip',n(4,smash?11:7),2.8,1.5,smash?6.5:4.5,.05,.7,{g:7,drag:1.4,vr:16});
          this.add({type:'puff',x,y,vx:0,vy:.15,life:.45,t:0,size:.09,color:'214,196,166',g:0,drag:2});
          break;
        case 1: // 木拍：几片小木屑 + 一圈暖黄的拍响
          spray('chip',n(2,smash?7:4),2.2,1.5,4.5,.036,.55,{g:7,drag:1.5,vr:13});
          this.ring(x,y,F.c,.13,.26);
          break;
        case 2: // 合金拍：一道干净的金色挥拍弧
          this.add({type:'arc',x,y,ang:a,life:.24,t:0,size:smash?.42:.32,color:F.c,vx:0,vy:0,g:0,twin:smash});
          this.add({type:'star',x,y,life:.18,t:0,size:smash?.7:.42,color:F.hot,vx:0,vy:0,g:0,rot:rnd()*.8});
          break;
        case 3: // 碳光拍：青色电弧朝四周劈开
          P('shock',x,y,0,0,.22,.32,{ang:a,vr:0});
          for(let i=0;i<n(2,smash?5:3);i++)P('bolt',x,y,0,0,.5+rnd()*.45,.2+rnd()*.12,{ang:a+(rnd()-.5)*2.8,seed:rnd()*1e6|0,vr:0});
          spray('ion',n(4,9),1.4,2,7,.04,.35,{drag:4});
          break;
        case 4: // 纳米光刃：沿出球方向一道新月刀光，纳米六角散开
          P('slash',x,y,0,0,smash?.6:.44,.28,{ang:a,vr:0});
          if(smash)P('slash',x,y,0,0,.42,.22,{ang:a+.5,vr:0,color:F.hot});
          spray('hex',n(4,smash?12:9),2.4,1,5,.045,.6,{drag:3,vr:5});
          break;
        case 5: // 粒子加速拍：粒子绕环加速后坍缩，出球瞬间量子错位
          P('orbit',x,y,0,0,smash?.42:.32,.34,{vr:0});
          P('glitch',x,y,0,0,.32,.24,{vr:0,seed:rnd()*1e6|0});
          spray('shard',n(4,10),1.3,3,8,.04,.42,{drag:4});
          break;
        case 6: { // 等离子火箭拍：火焰顺着出球方向喷出，火星四溅、腾起黑烟
          const big=smash?1.55:1;
          P('shock',x,y,0,0,.24*big,.28,{ang:a,vr:0,color:'255,214,130'});
          for(let i=0;i<n(1,3);i++)P('flame',x,y,Math.cos(a)*(.5+i*.6),Math.sin(a)*(.5+i*.6)+.3,(.26-i*.04)*big,.32,{drag:2.5,g:-1.4}); // 拍面上炸开的火球
          spray('flame',n(5,Math.round(12*big)),1.1,1.5,6.5*big,.15,.46,{drag:3,g:-1.6});
          spray('ember',n(4,Math.round(10*big)),2.4,2,8.5,.03,.65,{g:5,drag:1.5});
          for(let i=0;i<n(1,smash?4:2);i++)P('smoke',x-Math.cos(a)*.12,y,(rnd()-.5)*.7,.35+rnd()*.4,.13,1+rnd()*.5,{drag:1.4,vr:.8,color:'78,74,80'});
          this.glow(x,y,'255,140,50',smash?1.5:.85,.32);
          if(smash){this.ring(x,y,'255,190,90',.3,.36);this.kick(.35,x,y);}
          break;
        }
      }
      return true;
    }
    /** 果哥飞行中的球：火箭档整颗球着火，高科技档拖着各自颜色的能量尾迹 */
    marketBall(m,dt) {
      const s=m.shuttle,p=s.live&&!s.held&&s.lastHitter>=0?m.players[s.lastHitter]:null,key=p?this.marketKey(p):null;
      this.ballFx=key>=3?key:null;
      if(this.ballFx==null || !(dt>0) || m.phase==='over')return;
      this.marketBallT=(this.marketBallT||0)+Math.min(dt,.05);
      const iv=this.quality?(key===6?.028:.05):(key===6?.07:.12);if(this.marketBallT<iv)return;this.marketBallT=0;
      const rnd=()=>this.marketRandom(),x=s.x,y=s.y,bx=-(s.vx||0)*.12,by=-(s.vy||0)*.12,L=Math.hypot(s.vx||0,s.vy||0)||1,nx=-(s.vy||0)/L,ny=(s.vx||0)/L;
      const P=(form,xx,yy,ux,uy,size,life,extra)=>this.marketParticle(p,form,xx,yy,ux,uy,size,life,extra);
      if(key===3){P('ion',x,y,bx+(rnd()-.5),by+(rnd()-.5),.03,.3,{drag:3});if(rnd()<.22)P('bolt',x,y,0,0,.24,.12,{ang:Math.atan2(by,bx)+(rnd()-.5)*1.6,seed:rnd()*1e6|0,vr:0});}
      else if(key===4)P('hex',x+(rnd()-.5)*.08,y+(rnd()-.5)*.08,bx*.5,by*.5+.2,.035,.5,{drag:2,vr:4});
      else if(key===5){const w=Math.sin(this.time*18)*.13;P('shard',x+nx*w,y+ny*w,bx*.4,by*.4,.03,.36,{drag:3});P('ion',x-nx*w,y-ny*w,bx*.4,by*.4,.028,.32,{drag:3,color:MARKET_FX[5].hot});}
      else{
        P('flame',x+(rnd()-.5)*.06,y+(rnd()-.5)*.06,bx+(rnd()-.5)*.8,by+.4+rnd()*.5,.075+rnd()*.04,.3+rnd()*.12,{drag:2.4,g:-2});
        if(rnd()<.35)P('ember',x,y,bx+(rnd()-.5)*2,by+rnd()*1.5,.024,.5,{g:4,drag:1.4});
        if(this.quality && rnd()<.18)P('smoke',x,y,bx*.3,.3,.08,.8,{drag:1.6,vr:.6,color:'82,78,86'});
      }
    }
    /** 移动：脚印、汗珠、拖鞋、急停、离子光痕、磁悬浮、反重力、火箭喷射 */
    marketFx(m,dt) {
      for(const p of m.players){
        const key=this.marketKey(p),state=this.marketFxState[p.idx];
        if(state.tier!==key){
          this.parts=this.parts.filter(q=>q.marketOwner!==p.idx);
          if(dt>0 && state.tier!=null && key!=null && key>state.tier && key>=3){
            this.marketParticle(p,'ascend',p.x,p.y+.9,0,0,.35,.65,{vr:0});
            for(let i=0;i<(this.quality?16:6);i++){const a=i*Math.PI*2/(this.quality?16:6);this.marketParticle(p,'shard',p.x+Math.cos(a)*.3,p.y+.8+Math.sin(a)*.6,Math.cos(a)*1.3,1.1+Math.sin(a)*1.2,.04,.65,{drag:2});}
          }
          Object.assign(state,{tier:key,timer:0,seq:0,step:0,sweat:0,foot:0,peak:0,sv:0,air:!p.onGround});
        }
        if(key==null || !(dt>0) || m.phase==='over' || m.practice && !m.tutorial && p.idx===1)continue;
        const h=Math.min(dt,.05),vx=p.vx||0,speed=Math.abs(vx),air=!p.onGround,moving=speed>1.4,active=moving||air,d=p.dir,sv=Math.sign(vx);
        const lift=air&&!state.air,land=!air&&state.air;
        // 急停 / 急转：从高速里猛地刹住，或者跑着跑着突然掉头
        const skid=!air && state.peak>3 && (speed<state.peak*.4 || speed>1 && state.sv && sv!==state.sv);
        if(skid)state.peak=speed;else state.peak=Math.max(state.peak*Math.exp(-2.5*h),air?0:speed);
        state.air=air;if(speed>1)state.sv=sv;
        let pose=null;const P0=()=>pose||(pose=YY.charPose(p,this.time,{mood:'play'}));
        const at=(pt,ox=0,oy=0)=>[p.x+d*(pt[0]+ox),p.y+pt[1]+oy];
        const rnd=()=>this.marketRandom(),hq=!!this.quality,P=(form,x,y,ux,uy,size,life,extra)=>this.marketParticle(p,form,x,y,ux,uy,size,life,extra);
        const back=sv||-d; // 往身后喷：跑动时朝跑动反方向
        state.step+=h;state.sweat+=h;
        if(key<=2){
          if(key===2 && p.gear?.s && STEP_FX[p.gear.s]){/* 标准档穿自己的器械鞋：交给 gearSteps */}
          else if(key===-1){
            // 拖着铁球跑：地上刮出火星和灰
            if(!air && speed>1.2 && state.step>.1){
              state.step=0;const Q=P0(),bx=p.x+d*(Math.min(Q.F1[0],Q.F2[0])-.3);
              P('iron',bx,.04,-sv*(1+rnd()*2.2),.7+rnd()*1.6,.024,.32,{g:6,drag:1.5,color:'255,176,96'});
              this.add({type:'dust',x:bx,y:.03,vx:-sv*.5,vy:.25,life:.5,t:0,size:.06,g:.6,drag:2.5});
            }
          }else if(key===0){
            // 光脚：每一步一个脚印
            if(!air && speed>1.2 && state.step>.24){
              state.step=0;state.foot^=1;const Q=P0(),f=at(state.foot?Q.F1:Q.F2);
              P('print',f[0],.012,0,0,.08,1.8,{w:sv||d,vr:0,drag:0,color:'96,64,40'});
            }
          }else if(key===1){
            // 人字拖：啪嗒啪嗒，鞋跟扬起小灰
            if(!air && speed>1.2 && state.step>.22){
              state.step=0;state.foot^=1;const Q=P0(),f=at(state.foot?Q.F1:Q.F2,-.08);
              this.add({type:'puff',x:f[0],y:.05,vx:-sv*.45,vy:.16,life:.36,t:0,size:.045,color:'228,206,166',g:0,drag:2.5});
            }
            if(skid){for(let i=0;i<3;i++)this.add({type:'dust',x:p.x-state.sv*.1*i,y:.03,vx:-state.sv*(.6+rnd()),vy:.2+rnd()*.4,life:.55,t:0,size:.07,g:.6,drag:2.5});this.add({type:'streak',x:p.x,y:.02,w:-state.sv,life:.4,t:0,size:.45,color:'214,173,117',vx:0,vy:0,g:0,soft:true});}
          }else if(key===2 && skid){
            // 运动鞋急停：一道白色刹车痕 + 两粒灰
            this.add({type:'streak',x:p.x,y:.02,w:-state.sv,life:.32,t:0,size:.5,color:'255,255,255',vx:0,vy:0,g:0});
            for(let i=0;i<2;i++)this.add({type:'dust',x:p.x,y:.03,vx:-state.sv*(.4+rnd()),vy:.2+rnd()*.3,life:.45,t:0,size:.06,g:.6,drag:2.5});
          }
          // 破产 / 入狱：跑起来汗如雨下
          if((key===0||key===-1) && (speed>2.6||air) && state.sweat>.38){
            state.sweat=0;const Q=P0(),hd=at(Q.hd,-.04,.05);
            for(let i=0;i<(hq?2:1);i++)P('sweat',hd[0],hd[1],-(sv||d)*(.8+rnd()*1.2)+(rnd()-.5),1+rnd()*1.2,.032,.75,{g:6,drag:.6,vr:0,color:'170,218,255'});
          }
          if(land && key<=1)for(let i=0;i<3;i++)this.add({type:'dust',x:p.x+(i-1)*.15,y:.03,vx:(i-1)*.8,vy:.2,life:.5,t:0,size:.07,g:.6,drag:2.5});
          continue;
        }
        const interval=key===6?(hq?(active?.03:.075):(active?.08:.18)):(hq?(active?.045:.11):(active?.12:.25));
        state.timer+=h;
        // 起跳 / 落地：每档的脚下各有一下
        if(lift){
          const fx=MARKET_FX[key];
          if(key===3){this.ring(p.x,.02,fx.c,.16,.34,true);for(let i=0;i<2;i++)P('bolt',p.x+(i-.5)*.2,.3,0,0,.3,.16,{ang:-Math.PI/2+(i-.5)*.6,seed:rnd()*1e6|0,vr:0});}
          else if(key===4){P('magring',p.x,.015,0,0,.42,.5,{vr:0});P('magring',p.x,.015,0,0,.28,.4,{vr:0,color:fx.hot});}
          else if(key===5)P('orbit',p.x,.12,0,0,.3,.36,{vr:0});
          else{
            // 火箭起飞：地面炸开一圈烟和火
            for(let i=0;i<(hq?6:3);i++){const s=i%2?1:-1;P('smoke',p.x+s*.1,.08,s*(1.2+rnd()*2),.25+rnd()*.4,.15,1.1+rnd()*.4,{drag:1.8,vr:.8,color:'92,88,96'});}
            for(let i=0;i<(hq?8:4);i++){const s=i%2?1:-1;P('flame',p.x,.05,s*(2+rnd()*3.5),.25+rnd()*.5,.08,.32,{drag:3,g:-1.2});}
            this.ring(p.x,.02,'255,170,70',.2,.4,true);this.glow(p.x,.1,'255,150,60',1,.3);
          }
        }
        if(land && key===6)for(let i=0;i<(hq?3:2);i++){const s=i%2?1:-1;P('smoke',p.x+s*.12,.06,s*(.8+rnd()),.2,.11,.8,{drag:2,vr:.8,color:'92,88,96'});}
        if(state.timer<interval)continue;state.timer-=interval;state.seq++;
        const Q=P0(),fx=MARKET_FX[key],foot=state.seq%2?Q.F1:Q.F2,fw=at(foot,0,.03);
        if(key===6){
          // 背包两只引擎：沿真实喷口方向喷火，跑动 / 腾空时火焰更长、带黑烟
          const L=-Q.lean*.65;
          for(let i=0;i<2;i++){
            const ea=-.14-i*.12,o=rotV([0,-.32],ea),v=rotV([-.26-i*.25+o[0],.12-i*.12+o[1]],L),dir=rotV(rotV([0,-1],ea),L);
            const nz=at([Q.H[0]-.13+v[0],Q.H[1]+.34+v[1]]),sp=(active?4.6:2)*(.8+rnd()*.4);
            P('flame',nz[0],nz[1],d*dir[0]*sp-vx*.3,dir[1]*sp,(active?.13:.075)+rnd()*.04,(active?.42:.26)+rnd()*.1,{drag:1.5,g:-1});
            if(hq && active)P('plasma',nz[0],nz[1],d*dir[0]*sp*.7-vx*.2,dir[1]*sp*.7,.04,.14,{drag:1,vr:0,color:'255,214,150'});
            if(active && hq && state.seq%3===i)P('smoke',nz[0]+d*dir[0]*.35,nz[1]+dir[1]*.35,-vx*.15+(rnd()-.5)*.4,-.2+rnd()*.3,.09,.9,{drag:1.5,vr:.7,color:'92,88,96'});
          }
          // 鞋跟助推器：跑动时朝后喷，腾空时朝下喷
          if(active){
            for(const F of hq?[Q.F1,Q.F2]:[foot]){
              const heel=at(F,-.22,.05),ux=air?-d*.35:-(sv||d),uy=air?-1:-.12,sp=air?3.6:2.6+speed*.3;
              P('flame',heel[0],heel[1],ux*sp,uy*sp,.075+rnd()*.03,.26+rnd()*.08,{drag:2,g:-.8});
            }
            if(!air && hq && state.seq%4===0)P('ember',fw[0],.05,-(sv||d)*(1+rnd()*2),.5+rnd(),.022,.35,{g:5,drag:1.6});
          }
          continue;
        }
        // 高科技 / 纳米 / 量子：背后的能量体绕圈散出粒子
        const an=state.seq*2.4,bx=p.x+d*(Q.H[0]-.3)+Math.cos(an)*.26,by=p.y+Q.H[1]+.1+Math.sin(an)*.4;
        P(key===3?'ion':key===4?'hex':'shard',bx,by,-d*.25-vx*.14,.4+rnd()*.45,.026+rnd()*.025,.55+rnd()*.25);
        if(key===3){
          // 动力球鞋：鞋边一道青色光痕，鞋底迸离子
          if(active){
            this.add({type:'streak',x:fw[0],y:fw[1]+.02,w:sv||d,life:.24,t:0,size:.5+speed*.05,color:fx.c,vx:0,vy:0,g:0});
            P('ion',fw[0],fw[1],-vx*.2,air?-.8:.4,.032,.38);
          }
          if(skid)P('bolt',p.x,.1,0,0,.4,.16,{ang:state.sv>0?Math.PI:0,seed:rnd()*1e6|0,vr:0});
        }else if(key===4){
          // 磁悬浮靴：脚下一圈圈磁场，跑动时纳米六角从鞋底浮起
          if(active || state.seq%4===0)P('magring',p.x,.015,0,0,active?.3:.24,active?.45:.7,{vr:0});
          if(active)P('hex',fw[0],fw[1],-vx*.2,.5+rnd()*.4,.032,.5,{drag:2,vr:4});
        }else{
          // 反重力靴：粒子从鞋底往上飘；高速时留下紫色量子残影
          if(active)for(let i=0;i<(hq?2:1);i++)P('ion',fw[0]+(rnd()-.5)*.15,fw[1],-vx*.15+(rnd()-.5)*.4,.3+rnd()*.5,.028,.6,{g:-2.4,drag:1.2,color:i?fx.hot:fx.c});
          if(hq && (speed>2.8||air) && state.seq%2===0){
            const gs=this.ghosts[p.idx];gs.push({p:Object.assign({},p,{swing:p.swing?Object.assign({},p.swing):null}),t:0,tint:'#b48cff'});if(gs.length>5)gs.shift();
          }
        }
      }
    }
    /** 装备粒子的形状。不发光的（木屑、脚印、汗珠、黑烟）正常叠加，其余用 lighter 发光 */
    drawMarketPart(ctx,q,X,Y,u,a,k) {
      const r=q.size*k,mx=this.mirror?-1:1,f=q.form,TAU=Math.PI*2;
      ctx.save();ctx.translate(X,Y);
      if(!MARKET_SOLID.has(f))ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=`rgb(${q.color})`;ctx.fillStyle=`rgb(${q.color})`;ctx.lineWidth=Math.max(1,r*.25);ctx.lineCap='round';ctx.lineJoin='round';
      switch(f){
        case 'chip': { // 木屑：翻滚着落地的细木条
          if(q.y<.02){q.y=.02;q.vy=0;q.vx*=.75;q.vr*=.7;}
          ctx.rotate(q.rot);ctx.globalAlpha=Math.min(1,a*2.5);
          ctx.fillRect(-r,-r*.22,r*2,r*.44);ctx.fillStyle='rgba(70,42,20,.6)';ctx.fillRect(-r,r*.04,r*2,r*.18);
          break;
        }
        case 'print': { // 光脚脚印：脚掌 + 四个脚趾，慢慢淡掉
          ctx.scale((q.w>0?1:-1)*mx,1);ctx.globalAlpha=.5*Math.min(1,a*1.8);
          ctx.beginPath();ctx.ellipse(0,0,r,r*.26,0,0,TAU);ctx.fill();
          for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(r*(1.12+i*.03),-r*.16+i*r*.1,r*(.13-i*.015),0,TAU);ctx.fill();}
          break;
        }
        case 'sweat': { // 汗珠：沿速度方向拉长的水滴，落地就没
          if(q.y<.03)q.life=Math.min(q.life,q.t+.04);
          ctx.rotate(Math.atan2(-q.vy,mx*q.vx));ctx.globalAlpha=Math.min(1,a*2);
          ctx.fillStyle=`rgba(${q.color},.9)`;ctx.beginPath();ctx.moveTo(-r*2.2,0);ctx.quadraticCurveTo(0,-r,r,0);ctx.quadraticCurveTo(0,r,-r*2.2,0);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(r*.15,-r*.28,r*.26,0,TAU);ctx.fill();
          break;
        }
        case 'smoke': { // 黑烟：越飘越大、越淡
          const rr=r*(1+u*2.4),g=ctx.createRadialGradient(0,0,0,0,0,rr);
          ctx.globalAlpha=.5*a*Math.min(1,u*5+.25);
          g.addColorStop(0,`rgba(${q.color},.85)`);g.addColorStop(.6,`rgba(${q.color},.45)`);g.addColorStop(1,`rgba(${q.color},0)`);
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rr,0,TAU);ctx.fill();
          break;
        }
        case 'clank': { // 铁链一响：灰白的短促闪光
          ctx.globalAlpha=a;ctx.rotate(q.rot);
          for(let j=0;j<4;j++){const an=j*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(an)*r*.3,Math.sin(an)*r*.3);ctx.lineTo(Math.cos(an)*r*(.8+u*.6),Math.sin(an)*r*(.8+u*.6));ctx.stroke();}
          ctx.beginPath();ctx.arc(0,0,r*(.4+u*.9),0,TAU);ctx.stroke();
          break;
        }
        case 'iron': case 'ember': { // 铁屑火星 / 火箭火星：拖着短尾的亮点，越飞越红
          const col=f==='ember'?(u<.35?'255,236,170':u<.7?'255,150,50':'230,70,30'):q.color;
          const dx=mx*q.vx*k*.03,dy=-q.vy*k*.03;
          ctx.globalAlpha=a;ctx.strokeStyle=`rgb(${col})`;ctx.lineWidth=Math.max(1,r*.7);
          ctx.beginPath();ctx.moveTo(-dx,-dy);ctx.lineTo(0,0);ctx.stroke();
          ctx.fillStyle='rgba(255,250,225,.95)';ctx.beginPath();ctx.arc(0,0,Math.max(.8,r*.45),0,TAU);ctx.fill();
          break;
        }
        case 'flame': { // 火焰：白黄的芯 → 橙 → 暗红，顺着速度拖出火舌
          const flick=1+Math.sin(this.time*41+q.rot*9)*.12,grow=u<.22?.55+u*2:1-(u-.22)*.55,rr=r*grow*flick;
          const col=u<.2?'255,214,110':u<.55?'255,128,36':'214,54,22';
          ctx.rotate(Math.atan2(-q.vy,mx*q.vx));
          // 火身用正常叠加保住橙红色（绿地板上不会被 lighter 染成黄绿），只有白热的芯发光
          const g=ctx.createRadialGradient(rr*.3,0,0,0,0,rr*1.8);g.addColorStop(0,`rgba(${col},${.95*a})`);g.addColorStop(.7,`rgba(${col},${.5*a})`);g.addColorStop(1,`rgba(${col},0)`);
          ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(rr*1.15,0);ctx.quadraticCurveTo(rr*.25,-rr,-rr*1.9,0);ctx.quadraticCurveTo(rr*.25,rr,rr*1.15,0);ctx.fill();
          if(u<.5){ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,240,200,${a*(1-u*2)})`;ctx.beginPath();ctx.ellipse(rr*.3,0,rr*.55,rr*.32,0,0,TAU);ctx.fill();}
          break;
        }
        case 'bolt': { // 电弧：每帧重新折一次，带一根小分叉
          let s=(q.seed+Math.floor(q.t*30)*977)>>>0;const R=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
          const L=r*(.55+u*.6),cx=mx*Math.cos(q.ang),cy=-Math.sin(q.ang),pts=[[0,0]];
          for(let i=1;i<=6;i++){const t=i/6,off=(R()-.5)*L*.4*(i<6?1:.3);pts.push([cx*L*t-cy*off,cy*L*t+cx*off]);}
          const br=pts[3],ba=Math.atan2(cy,cx)+(R()>.5?.7:-.7),fork=[br,[br[0]+Math.cos(ba)*L*.25,br[1]+Math.sin(ba)*L*.25],[br[0]+Math.cos(ba)*L*.42+(R()-.5)*L*.1,br[1]+Math.sin(ba)*L*.42]];
          ctx.globalAlpha=a*(R()>.18?1:.35);
          for(const [w,c] of [[r*.11,`rgb(${q.color})`],[r*.04,'rgb(240,255,255)']]){
            ctx.lineWidth=Math.max(1,w);ctx.strokeStyle=c;
            for(const line of [pts,fork]){ctx.beginPath();line.forEach((pt,i)=>i?ctx.lineTo(pt[0],pt[1]):ctx.moveTo(pt[0],pt[1]));ctx.stroke();}
          }
          break;
        }
        case 'slash': { // 纳米光刃：朝出球方向鼓起的新月刀光
          ctx.rotate(Math.atan2(-Math.sin(q.ang),mx*Math.cos(q.ang)));
          const R1=r*(.75+u*.55),sw=1.2,th=r*.32*(1-u*.65),c=-R1*.55;
          ctx.globalAlpha=a;
          const g=ctx.createLinearGradient(c,0,c+R1,0);g.addColorStop(0,`rgba(${q.color},0)`);g.addColorStop(.7,`rgba(${q.color},.85)`);g.addColorStop(1,'rgba(245,255,240,1)');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(c,0,R1,-sw,sw);ctx.arc(c-th,0,R1-th*.25,sw,-sw,true);ctx.closePath();ctx.fill();
          ctx.strokeStyle='rgba(245,255,240,.95)';ctx.lineWidth=Math.max(1,r*.05);ctx.beginPath();ctx.arc(c,0,R1,-sw*.8,sw*.8);ctx.stroke();
          break;
        }
        case 'magring': { // 磁悬浮：地面上一圈慢慢扩开的磁场，带六颗磁极点
          const rr=r*(1+u*.9),ry=rr*.22;ctx.globalAlpha=.6*a;ctx.lineWidth=Math.max(1,r*.06);
          ctx.beginPath();ctx.ellipse(0,0,rr,ry,0,0,TAU);ctx.stroke();
          ctx.globalAlpha=.3*a;ctx.beginPath();ctx.ellipse(0,0,rr*.62,ry*.62,0,0,TAU);ctx.stroke();
          ctx.globalAlpha=.8*a;for(let j=0;j<6;j++){const an=j*TAU/6+this.time*1.6;ctx.fillRect(Math.cos(an)*rr-1.5,Math.sin(an)*ry-1.5,3,3);}
          break;
        }
        case 'orbit': { // 粒子加速环：环越收越紧，最后在中心闪一下
          const rr=r*(1.25-u*.95),spin=this.time*14;ctx.globalAlpha=a;ctx.lineWidth=Math.max(1,r*.07);
          ctx.beginPath();ctx.ellipse(0,0,rr,rr*.42,-.35,0,TAU);ctx.stroke();
          ctx.fillStyle=`rgb(${MARKET_FX[5].hot})`;
          for(let j=0;j<5;j++){const an=spin+j*TAU/5,px=Math.cos(an)*rr,py=Math.sin(an)*rr*.42,c=Math.cos(-.35),s=Math.sin(-.35);ctx.beginPath();ctx.arc(px*c-py*s,px*s+py*c,Math.max(1.2,r*.07),0,TAU);ctx.fill();}
          if(u>.6){ctx.globalAlpha=(1-u)*2.5;ctx.fillStyle='rgb(245,235,255)';ctx.beginPath();ctx.arc(0,0,r*(u-.6)*1.8,0,TAU);ctx.fill();}
          break;
        }
        case 'glitch': { // 量子错位：几条品红 / 青色的错位横条，闪烁
          let s=(q.seed+Math.floor(q.t*26)*613)>>>0;const R=()=>(s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296;
          for(let j=0;j<4;j++){
            ctx.globalAlpha=a*(.5+R()*.5);ctx.fillStyle=j%2?'rgb(90,240,255)':'rgb(255,96,220)';
            ctx.fillRect((R()-.6)*r*1.6,(R()-.5)*r*1.4,r*(.6+R()*1.2),Math.max(1.5,r*.1));
          }
          break;
        }
        case 'shock': {
          ctx.globalAlpha=a*a;ctx.rotate(Math.atan2(-Math.sin(q.ang),mx*Math.cos(q.ang)));
          ctx.beginPath();ctx.ellipse(0,0,r*(.35+u*1.7),r*(1+u*3),0,0,TAU);ctx.stroke();
          ctx.strokeStyle='#f2fcff';ctx.beginPath();ctx.moveTo(-r*.2,0);ctx.lineTo(r*(1+u*3),0);ctx.stroke();
          break;
        }
        case 'ascend': {
          ctx.globalAlpha=a*a;
          ctx.beginPath();ctx.ellipse(0,-u*k*.45,r*(1+u*1.7),r*.3,0,0,TAU);ctx.stroke();
          ctx.globalAlpha*=.4;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.45,k*.5);ctx.lineTo(i*r*.45,-k*(.2+u));ctx.stroke();}
          break;
        }
        case 'plasma': {
          ctx.globalAlpha=a*a;ctx.rotate(Math.atan2(-q.vy,mx*q.vx));
          ctx.beginPath();ctx.ellipse(0,0,r*(2.4-u),r*(1-u*.4),0,0,TAU);ctx.fill();
          ctx.fillStyle='#d6fcff';ctx.beginPath();ctx.ellipse(-r*.2,0,r*1.25,r*.4,0,0,TAU);ctx.fill();
          break;
        }
        case 'ion': {
          ctx.globalAlpha=a*a;const dx=mx*q.vx*k*.045,dy=-q.vy*k*.045;
          ctx.beginPath();ctx.moveTo(-dx,-dy);ctx.lineTo(dx,dy);ctx.stroke();ctx.fillStyle='#efffff';ctx.fillRect(-r*.35,-r*.35,r*.7,r*.7);
          break;
        }
        default: { // hex 纳米六角 / shard 量子碎片
          ctx.globalAlpha=a*a;ctx.rotate(q.rot);ctx.beginPath();const n=f==='hex'?6:4;
          for(let j=0;j<n;j++){const an=j*TAU/n;ctx.lineTo(Math.cos(an)*r,Math.sin(an)*r*(n===4?1.7:1));}ctx.closePath();ctx.stroke();
          if(n===4){ctx.globalAlpha*=.55;ctx.fill();}
        }
      }
      ctx.restore();
    }
    drawMarketAura(ctx,p) {
      const tier=p.market?YY.marketTier(p.market):-1,t=YY.MarketArt?.themes[tier];if(!t || YY.marketDebt(p.market.coins))return;
      const k=this.sc,x=this.sx(p.x),y=this.sy(p.y+.015),angle=this.time*.8;
      ctx.save();ctx.globalCompositeOperation='lighter';
      if(tier===6){
        // 火箭档：脚下的地板被尾焰烤亮，离地越近越亮
        const hgt=Math.max(0,p.y),heat=(!p.onGround?.75:Math.abs(p.vx||0)>1.4?.45:.22)/(1+hgt*.8),X=x,Y=this.sy(.01),R=k*(.55+hgt*.15);
        const g=ctx.createRadialGradient(X,Y,0,X,Y,R);g.addColorStop(0,`rgba(255,170,70,${heat})`);g.addColorStop(.5,`rgba(255,90,30,${heat*.4})`);g.addColorStop(1,'rgba(255,60,20,0)');
        ctx.fillStyle=g;ctx.save();ctx.translate(X,Y);ctx.scale(1,.24);ctx.translate(-X,-Y);ctx.fillRect(X-R,Y-R,R*2,R*2);ctx.restore();
      }
      ctx.strokeStyle=t.light;ctx.lineWidth=Math.max(1,k*.012);ctx.globalAlpha=.45;
      const r=tier>=5?.66:.48;
      ctx.beginPath();ctx.ellipse(x,y,k*r,k*r*.23,0,angle,angle+Math.PI*1.6);ctx.stroke();
      if(tier>=4){
        ctx.beginPath();ctx.ellipse(x,y,k*(r+.09),k*r*.26,0,-angle,-angle+Math.PI*1.3);ctx.stroke();
        for(let i=0;i<(this.quality?6:3);i++){
          const a=angle+i*Math.PI/3,xx=x+Math.cos(a)*k*r,yy=y+Math.sin(a)*k*r*.23;
          ctx.fillStyle=t.hot;ctx.beginPath();ctx.moveTo(xx,yy-3);ctx.lineTo(xx+3,yy);ctx.lineTo(xx,yy+3);ctx.lineTo(xx-3,yy);ctx.closePath();ctx.fill();
        }
      }
      ctx.restore();
    }
    /** 球鞋的日常步伐：跑动时脚下留下极淡的标志性痕迹（不触发特性也有，但很克制） */
    gearSteps(m, dt) {
      if (!(dt > 0)) return;
      for (const p of m.players) {
        const sh = p.gear && p.gear.s, i = p.idx;
        if(p.market && this.marketKey(p)!==2){this.gearT[i]=0;continue;} // 果哥：装备档自己管脚下的特效
        if (!sh || !STEP_FX[sh] || !p.onGround || Math.abs(p.vx || 0) < 3.2) { this.gearT[i] = 0; continue; }
        this.gearT[i] += dt; if (this.gearT[i] < (this.quality ? 0.14 : 0.28)) continue; this.gearT[i] = 0;
        const [kind, col] = STEP_FX[sh], d = Math.sign(p.vx);
        if (kind === 'streak') this.add({ type: 'streak', x: p.x - d * 0.1, y: 0.02, w: d, life: 0.18, t: 0, size: 0.28, color: col, vx: 0, vy: 0, g: 0, soft: true });
        else if (kind === 'petal') { this.add({ type: 'petal', x: p.x - d * 0.15, y: 0.08, vx: -d * 0.3, vy: 0.2, life: 0.5, t: 0, size: 0.03, color: col, rot: Math.random() * 6, vr: 3, g: 0.6, drag: 2 }); }
        else if (kind === 'moon') this.add({ type: 'crescent', x: p.x - d * 0.12, y: 0.02, w: d, life: 0.22, t: 0, size: 0.16, color: col, vx: 0, vy: 0, g: 0, soft: true });
      }
    }
    /** 雷霆·赤脊：“压后再杀”机会在手时，拍头带一点熔岩红光 */
    drawGearGlow(ctx, p) {
      if(p.market && this.marketKey(p)!==2)return;
      if (!p.gt || !p.gt.press || !p.gear || p.gear.r !== 'r_heavy') return;
      const pose = this.poseCache && this.poseCache.get(p); if (!pose) return;
      const h = YY.racketHead(pose), k = this.sc, f = (this.mirror ? -1 : 1) * p.dir;
      const X = this.sx(p.x) + f * k * h[0], Y = this.sy(p.y) - k * h[1], r = k * (0.2 + Math.sin(this.time * 9) * 0.03);
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, 'rgba(255,110,60,.55)'); g.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(X - r, Y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
    }
    // ---------- 互动表情 ----------
    /** 收到 / 发出一个表情：self 在头顶冒泡；throw 飞过网落到对手身上 */
    emote(ev) {
      const e = YY.emote && YY.emote(ev.id); if (!e || !(ev.p === 0 || ev.p === 1)) return;
      if (!this.emotes) this.emotes = [];
      // 同一人连发时替换头顶的旧贴纸，避免叠成一摞
      if (e.kind === 'self') this.emotes = this.emotes.filter((x) => !(x.kind === 'self' && x.p === ev.p));
      this.emotes.push({ id: e.id, e, p: ev.p, kind: e.kind, t: 0, flight: e.kind === 'throw' ? 0.8 : 0, life: e.kind === 'throw' ? 2.3 : 2.4, hit: false });
      if (this.emotes.length > 6) this.emotes.shift();
      this.emoteMood = this.emoteMood || [null, null];
      if (e.mood) this.emoteMood[ev.p] = { mood: e.mood, t: 1.6 };
    }
    /** 贴纸半径：随球场缩放，手机上约 18–30 像素，始终小巧 */
    emoteSize() { return clamp(this.sc * 0.32, 15, 30) * (this.hudK > 1 ? 1.05 : 1); }
    headOf(p) { return { x: p.x, y: p.y + 2.05 }; }
    /** 气泡落点：优先头顶，碰到触屏按键就依次试 偏向球网 / 偏向底线 / 更高 */
    emoteSpot(X, Y, r, inward) {
      const rects = (typeof this.hudAvoid === 'function' && this.hudAvoid()) || [];
      if (!rects.length) return [X, Y];
      const hit = (x, y) => rects.some((b) => x + r > b.x && x - r < b.x + b.w && y + r * 1.7 > b.y && y - r * 1.7 < b.y + b.h);
      const d = r * 2.6;
      for (const [dx, dy] of [[0, 0], [inward * d, 0], [-inward * d, 0], [0, -d * .8], [inward * d, -d * .8], [-inward * d, -d * .8]]) if (!hit(X + dx, Y + dy)) return [X + dx, Y + dy];
      return [X, Y];
    }
    drawEmoteBubble(ctx, x, y, s, id, t, label, color, alpha) {
      const pop = YY.emotePop(t / 0.3), r = s * 1.28 * pop;
      if (r <= 0.5) return;
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x, y + 3, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - r * .28, y + r * .82); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x + r * .28, y + r * .82); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
      YY.drawEmote(ctx, id, x, y, s * .82 * pop, t);
      if (label && pop > .5) {
        const fs = Math.round(clamp(s * .62, 10, 15)); ctx.font = `900 ${fs}px ${FONT}`;
        const tw = ctx.measureText(label).width, ly = y - r - fs * .75;
        ctx.fillStyle = 'rgba(12,18,38,.82)'; rr(ctx, x - tw / 2 - 7, ly - fs * .62, tw + 14, fs * 1.3, fs * .65); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, ly + 1);
      }
      ctx.restore();
    }
    /** 头顶转圈的小星星（羽球敲头） */
    drawDizzy(ctx, x, y, s, t, alpha) {
      ctx.save(); ctx.globalAlpha *= alpha;
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * Math.PI * 2 / 3, px = x + Math.cos(a) * s * 1.1, py = y + Math.sin(a) * s * .35;
        ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd84a'; ctx.beginPath();
        for (let j = 0; j < 10; j++) { const an = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? s * .14 : s * .32; ctx.lineTo(px + Math.cos(an) * q, py + Math.sin(an) * q); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    drawEmotes(ctx, m, dt) {
      const list = this.emotes; if (this.emoteMood) for (const em of this.emoteMood) if (em) em.t -= dt;
      if (!list || !list.length || !m.players || !YY.drawEmote) return;
      const s = this.emoteSize(), sh = m.shuttle;
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i]; q.t += dt;
        if (q.t >= q.life) { list.splice(i, 1); continue; }
        const from = m.players[q.p], to = m.players[1 - q.p]; if (!from || !to) continue;
        const fade = Math.min(1, (q.life - q.t) / 0.35);
        // 球飞过贴纸附近时变淡，不挡球
        const near = (x, y) => (sh && sh.live && Math.hypot(sh.x - x, sh.y - y) < 1.3 ? 0.3 : 1);
        if (q.kind === 'self') {
          const h = this.headOf(from), wy = h.y + 0.75, inward = Math.sign(this.sx(0) - this.sx(h.x)) || 1;
          const X0 = this.sx(h.x), Y0 = this.sy(wy);
          if (!q.off) { const sp = this.emoteSpot(X0, Y0, s * 1.3, inward); q.off = [sp[0] - X0, sp[1] - Y0]; } // 选定后跟着人走，不再跳位
          const X = X0 + q.off[0], Y = Y0 + q.off[1];
          this.drawEmoteBubble(ctx, X, Y, s, q.id, q.t, q.t < 1.6 ? q.e.name : '', q.e.color, fade * near(h.x, wy));
          continue;
        }
        // —— 投掷类：飞行 ——
        const floor = q.e.floor, a = floor ? { x: from.x + from.dir * 0.3, y: 0.08 } : { x: from.x + from.dir * 0.35, y: from.y + 1.55 };
        const b = floor ? { x: to.x - to.dir * 0.05, y: 0.08 } : this.headOf(to);
        if (q.t < q.flight) {
          const u = q.t / q.flight, k = 1 - Math.pow(1 - u, 1.6);
          const x = a.x + (b.x - a.x) * k, y = floor ? 0.1 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.12 * (1 - u) : a.y + (b.y - a.y) * k + Math.sin(u * Math.PI) * (2.2 + Math.abs(b.x - a.x) * 0.08);
          const X = this.sx(x), Y = this.sy(y);
          ctx.save(); ctx.translate(X, Y); ctx.rotate((floor ? 2 : 1.2) * Math.PI * u * Math.sign(b.x - a.x || 1) * (this.mirror ? -1 : 1));
          YY.drawEmote(ctx, q.id, 0, 0, s * (floor ? 0.62 : 0.72), q.t); ctx.restore();
          // 一道淡淡的拖尾
          ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - u)})`; ctx.beginPath(); ctx.arc(X, Y, s * 0.3, 0, Math.PI * 2); ctx.fill();
          continue;
        }
        // —— 命中：一次性效果 ——
        const ht = q.t - q.flight;
        if (!q.hit) {
          q.hit = true; this.emoteMood = this.emoteMood || [null, null];
          if (q.e.hitMood) this.emoteMood[1 - q.p] = { mood: q.e.hitMood, t: 1.6 };
          if (q.id === 'flower') for (let j = 0; j < 7; j++) this.add({ type: 'petal', x: b.x + (Math.random() - 0.5) * 0.5, y: b.y + 0.2, vx: (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 0.8, life: 1.1, t: 0, size: 0.05, color: j % 2 ? '#ff9cc2' : '#ffd1e3', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: 1.2, drag: 2 });
          else if (q.id === 'milktea') for (let j = 0; j < 5; j++) this.add({ type: 'gstar', x: b.x + (j - 2) * 0.18, y: b.y + 0.3, vx: 0, vy: 0.9, life: 0.9, t: 0, delay: j * 0.06, size: 0.06, color: '255,170,200', on: true, g: 0 });
          else if (q.id === 'bonk') { this.add({ type: 'cross', x: b.x, y: b.y + 0.15, life: 0.2, t: 0, size: 0.35, color: '255,240,180', vx: 0, vy: 0, g: 0 }); }
          else if (q.id === 'banana') this.dust(b.x, 4, false);
        }
        const hx = this.sx(b.x), alpha = fade;
        if (q.id === 'bonk') { // 球从头顶弹开，星星绕头转
          const h = this.headOf(to), bx = h.x + to.dir * -ht * 1.4, by = h.y + 0.25 + ht * 2.2 - ht * ht * 6;
          if (by > 0.1) { ctx.save(); ctx.translate(this.sx(bx), this.sy(by)); ctx.rotate(ht * 10); YY.drawEmote(ctx, 'bonk', 0, 0, s * 0.62, q.t); ctx.restore(); }
          this.drawDizzy(ctx, this.sx(h.x), this.sy(h.y + 0.25), s, q.t, alpha);
        } else if (q.id === 'banana') { // 香蕉皮停在脚边，对手头上冒汗
          ctx.save(); ctx.globalAlpha *= alpha; YY.drawEmote(ctx, 'banana', hx + Math.sin(ht * 20) * 2, this.sy(0.08), s * 0.62, q.t); ctx.restore();
        }
        // 收到的反应气泡偏向球网一侧，不和对方自己头顶的表情叠在一起
        const h = this.headOf(to), wy = h.y + 0.6, rx = h.x - (to.side || Math.sign(to.x) || 1) * 0.95, RX = this.sx(rx), RY = this.sy(wy);
        if (!q.roff) { const sp = this.emoteSpot(RX, RY, s * 1.2, Math.sign(this.sx(0) - RX) || 1); q.roff = [sp[0] - RX, sp[1] - RY]; }
        this.drawEmoteBubble(ctx, RX + q.roff[0], RY + q.roff[1], s * 0.9, q.id, ht, q.e.hit, q.e.color, alpha * near(rx, wy) * (q.id === 'bonk' || q.id === 'banana' ? 0 : 1));
        if (q.id === 'bonk' || q.id === 'banana') { // 只有一句短短的反应字
          const fs = Math.round(clamp(s * .8, 12, 20)), Y = this.sy(wy - 0.1) - ht * 10;
          ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,18,38,.85)'; ctx.strokeText(q.e.hit, this.sx(h.x), Y); ctx.fillStyle = q.id === 'bonk' ? '#ffe066' : '#ffffff'; ctx.fillText(q.e.hit, this.sx(h.x), Y);
          if (q.id === 'banana') { ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.ellipse(this.sx(h.x) + fs, this.sy(h.y + 0.2), fs * .18, fs * .28, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
      }
    }
    /** 急停折返：脚下擦出一道地板尘 */
    skid(p, v) {
      if (!p) return;
      const n = Math.round(clamp((v || 3) / 1.2, 2, 6));
      for (let i = 0; i < n; i++) this.add({ type: 'dust', x: p.x - Math.sign(p.vx || 1) * 0.1, y: 0.03, vx: -Math.sign(p.vx || 1) * (0.6 + Math.random() * 1.4), vy: 0.3 + Math.random() * 0.6, life: 0.32 + Math.random() * 0.2, t: 0, size: 0.06 + Math.random() * 0.05, color: '220,220,230', g: 2.2, drag: 3 });
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
      this.lastWinner = winner; this.pointSeq = (this.pointSeq || 0) + 1;
      const look = this.lookOf(m, winner);
      const p = m.players[winner];
      this.confetti(p.x, 2.6, 26, [look.shirt, look.trim, '#ffffff', look.racket]);
      this.venueEvent('point', { text: label || '得分！', color: look.shirt });
      this.kick(0.45, m.landMark ? m.landMark.x : 0, 0.6);
    }
    victoryFx(winner, m, text) {
      this.lastWinner = winner;
      const look = this.lookOf(m, winner);
      for (let i = 0; i < 4; i++) this.confetti(-6 + i * 4, 6.5, 30, [look.shirt, look.trim, '#ffffff', '#ffd23f', look.racket]);
      this.venueEvent('over', { text: text || '胜利', color: look.shirt });
      this.flash = 0.3; this.flashCol = '255,255,255';
    }

    // ---------- 镜头 ----------
    updateCam(m, dt) {
      const c = this.cam;
      c.kick = Math.max(0, c.kick - dt * 2.4);
      const serving = m.phase === 'serve' ? 1 : 0;
      c.serve += (serving - c.serve) * (1 - Math.exp(-2.5 * dt));
      let tx = this.cx, ty = this.gy - 2 * this.sc;
      if (c.serve > 0.05 && m.players) { const sp = m.players[m.server]; tx = lerp(tx, this.sx(sp.x * 0.7), c.serve); ty = lerp(ty, this.gy - 1.2 * this.sc, c.serve); }
      if (c.kick > 0.02) { tx = lerp(tx, c.fx, Math.min(1, c.kick * 1.5)); ty = lerp(ty, c.fy, Math.min(1, c.kick * 1.5)); }
      const k = 1 - Math.exp(-5 * dt);
      c.px += (tx - c.px) * k; c.py += (ty - c.py) * k;
      const tz = 1 + c.serve * 0.04 + c.kick * 0.06;
      c.z += (tz - c.z) * (1 - Math.exp(-8 * dt));
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = this.shake * this.shake * Math.min(6, this.sc * .12);
      this.shx = Math.sin(this.time * 72) * sh;
      this.shy = Math.sin(this.time * 91 + .7) * sh * .45;
    }
    applyCam(par) {
      const c = this.cam, d = this.dpr;
      const z = 1 + (c.z - 1) * par;
      this.ctx.setTransform(d * z, 0, 0, d * z, d * (c.px * (1 - z) + this.shx * par), d * (c.py * (1 - z) + this.shy * par));
    }

    screenPoint(x, y) {
      const c = this.cam;
      return { x: this.sx(x) * c.z + c.px * (1-c.z) + this.shx,
        y: this.sy(y) * c.z + c.py * (1-c.z) + this.shy };
    }
    scoreboardBounds() {
      const u = clamp(Math.round(this.H * .043 * this.hudK), 15, 30);
      const w = Math.min(this.W * .64, 660), h = u * 2.15 + Math.max(10*this.hudK,u*.42)*2 + 42;
      return { x: (this.W-w)/2, y: 8, w, h };
    }
    /** 顶部高球优先于 HUD；仅重绘顶部区域，不改变球的位置与碰撞半径。 */
    drawHighShuttle(ctx, m, s=m.shuttle, trail=this.trail) {
      if (!s.live || s.held || s.hide || s.veil > 0) return;
      const pt = this.screenPoint(s.x,s.y), bounds = this.scoreboardBounds();
      if (pt.y > bounds.y + bounds.h + 22) return;
      ctx.save();
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      if (pt.y < 10) {
        const x = clamp(pt.x, 22, this.W-22), y = bounds.y+bounds.h+14;
        ctx.fillStyle = 'rgba(7,15,29,.9)'; rr(ctx,x-25,y-10,50,42,12); ctx.fill();
        ctx.fillStyle = '#fff2ac'; ctx.beginPath(); ctx.moveTo(x,y-6);ctx.lineTo(x-7,y+5);ctx.lineTo(x+7,y+5);ctx.closePath();ctx.fill();
        ctx.font = `bold ${Math.round(11*this.hudK)}px ${FONT}`; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.y.toFixed(1)+'m',x,y+20);
      } else {
        ctx.beginPath();ctx.rect(0,0,this.W,bounds.y+bounds.h+30);ctx.clip();
        this.applyCam(1);
        this.drawTrail(ctx,trail.slice(-7),s.shot,false);
        this.drawShuttle(ctx,s);
      }
      ctx.restore();
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
      // 互动表情：死球间隙做个小动作（回合进行中不打断击球动作）
      const em = this.emoteMood && this.emoteMood[p.idx];
      if (em && em.t > 0 && m.phase !== 'rally' && !p.swing) return em.mood;
      if ((m.phase === 'point' || m.phase === 'over') && this.lastWinner >= 0) {
        const n = (this.pointSeq || 0) + p.idx * 2;
        if (p.idx === this.lastWinner) return m.phase === 'over' ? 'cheer' : ['happy', 'fist', 'cheer', 'point'][n % 4];
        return m.phase === 'over' ? 'tired' : ['sad', 'tired', 'sad', 'angry'][n % 4];
      }
      if (p.buff && (p.buff.prone > 0 || p.buff.tripped > 0)) return 'sad';
      // 体能透支：死球间隙弯腰喘气
      if (m.phase === 'serve' && p.idx !== m.server && !p.swing && p.stamina != null && p.stamina < 22) return 'tired';
      return 'play';
    }

    charOpts(p, m, extra) {
      const pulse = this.gearPulse && this.gearPulse[p.idx];
      const shoePulse = clamp(((pulse?.shoe || 0)-this.time)/.45,0,1), racketPulse = clamp(((pulse?.racket || 0)-this.time)/.45,0,1);
      const s = m.shuttle;
      const gx = (s.x - p.x) * p.dir, gyv = s.y - (p.y + 1.6);
      const L = Math.hypot(gx, gyv) || 1;
      const o = Object.assign({ shoePulse, racketPulse, time: this.time, mood: this.moodOf(p, m), gazeX: gx / L, gazeY: gyv / L, spring: [this.springs[p.idx].x, this.springs[p.idx].y], f: (this.mirror ? -1 : 1) * p.dir, glow: Math.max(0, p.flash || 0) * 4 }, extra || {});
      if (s.live && !s.netHit && s.lastHitter !== p.idx && p.swing && !p.swing.contact && !s.ctl) {
        const lead = clamp(C.SW_SWEET - p.swing.t, 0, .08);
        const x = s.x + s.vx * lead, y = s.y + s.vy * lead - .5 * C.G * lead * lead;
        if (p.side*x > C.SHUTTLE_R && Math.hypot(x-p.x,y-p.y-C.SHOULDER)<1.5) o.aim={x,y};
      }
      // 自抛的球还在头顶：缓入/缓出蓄势举拍姿态。
      { const want = s.live && s.selfToss === p.idx && s.y > p.y + 0.9 ? 1 : 0;
        const k = this.tossK || (this.tossK = [0, 0]), last = this.tossT || (this.tossT = [this.time, this.time]);
        const dt = clamp(this.time - last[p.idx], 0, 0.1); last[p.idx] = this.time;
        k[p.idx] += clamp(want - k[p.idx], -dt * 5, dt * 6); o.tossReady = k[p.idx]; }
      // 同一帧人物与地板倒影共用骨骼，避免重复求解。
      if (this.poseCache && !extra?.mood) {
        let pose = this.poseCache.get(p);
        if (!pose) { pose = YY.charPose(p, this.time, o); this.poseCache.set(p, pose); }
        o.pose = pose;
      }
      return o;
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

    /** 技能生效中的光环 */
    drawAura(ctx, p, color, dt) {
      const k = this.sc, X = this.sx(p.x), Y = this.sy(0);
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 1 + Math.sin(this.time * 10) * 0.1;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, k * 0.7 * pulse);
      g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(X, Y); ctx.scale(1, 0.3); ctx.translate(-X, -Y);
      ctx.fillRect(X - k, Y - k, k * 2, k * 2);
      ctx.restore();
      const g2 = ctx.createLinearGradient(0, Y, 0, Y - k * 2.2);
      g2.addColorStop(0, color + '55'); g2.addColorStop(1, color + '00');
      ctx.fillStyle = g2; ctx.fillRect(X - k * 0.35, Y - k * 2.2, k * 0.7, k * 2.2);
      ctx.globalCompositeOperation = 'source-over';
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0 && this.parts.length < 300) {
        this.auraT = 0.05;
        const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).join(',');
        this.add({ type: 'spark', x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + Math.random() * 1.6, vx: 0, vy: 1.2, life: 0.5, t: 0, color: rgb, size: 0.035, g: -1, drag: 1 });
      }
    }

    drawSwoosh(ctx, p, look) {
      const sw = p.swing;
      if (!sw || sw.t < 0.02 || sw.t > 0.24) return;
      const k = this.sc, f = (this.mirror ? -1 : 1) * p.dir;
      const pts = [];
      for (let i = 0; i < (this.quality ? 5 : 3); i++) {
        const tt = sw.t - i * 0.012;
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
      const smash = sw.style === 'smash' || (!sw.style && sw.dur > 0.4);
      // 拍风按技术动作区分：重杀橙色宽弧，平抽青色短平，吊/搓/放网细而淡
      const st = sw.style, soft = st === 'net' || st === 'tumble' || st === 'block' || st === 'drop';
      const col = smash || st === 'kill' || st === 'halfsmash' ? '255,170,70' : st === 'drive' || st === 'push' ? '140,230,255' : st === 'tumble' ? '210,180,255' : look.swoosh || (look.hair === 'spiky' ? '255,130,130' : '120,220,255');
      const width = smash ? 0.22 : st === 'kill' || st === 'halfsmash' || st === 'clear' || st === 'lift' ? 0.17 : soft ? 0.07 : 0.13;
      for (let i = 1; i < pts.length; i++) {
        const u = 1 - i / pts.length;
        ctx.strokeStyle = `rgba(${col},${(soft ? 0.35 : 0.55) * u})`;
        ctx.lineWidth = width * u;
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
      if (s.live && s.shot === 'tumble' && Math.abs(s.x) < 1.2) ang += this.time * 28; // 搓球：翻着跟头过网
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

    drawTrail(ctx, tr = this.trail, kind = this.trailKind, fire = this.trailFire) {
      if (tr.length < 3) return;
      const pts = tr.map((p) => [this.sx(p.x), this.sy(p.y), p.v]);
      const fast = fire || pts[pts.length - 1][2] > 15;
      const n = pts.length;
      const wMax = (fire ? 0.28 : fast ? 0.16 : 0.08) * this.sc;
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
      if (fire) { gr.addColorStop(0, 'rgba(255,30,0,0)'); gr.addColorStop(0.5, 'rgba(255,90,20,0.75)'); gr.addColorStop(1, 'rgba(255,230,120,1)'); }
      else if (kind === 'meteor') { gr.addColorStop(0, 'rgba(255,200,60,0)'); gr.addColorStop(0.5, 'rgba(255,226,122,0.7)'); gr.addColorStop(1, 'rgba(255,255,230,1)'); }
      else if (kind === 'mk3') { gr.addColorStop(0, 'rgba(60,200,255,0)'); gr.addColorStop(0.55, 'rgba(100,234,255,0.6)'); gr.addColorStop(1, 'rgba(230,252,255,1)'); }
      else if (kind === 'mk4') { gr.addColorStop(0, 'rgba(60,220,150,0)'); gr.addColorStop(0.55, 'rgba(120,255,191,0.6)'); gr.addColorStop(1, 'rgba(236,255,210,1)'); }
      else if (kind === 'mk5') { gr.addColorStop(0, 'rgba(255,96,220,0)'); gr.addColorStop(0.5, 'rgba(199,160,255,0.65)'); gr.addColorStop(1, 'rgba(180,246,255,1)'); }
      else if (kind === 'tumble') { gr.addColorStop(0, 'rgba(160,110,255,0)'); gr.addColorStop(1, 'rgba(210,180,255,0.75)'); }
      else if (kind === 'push' || kind === 'drive') { gr.addColorStop(0, 'rgba(80,200,255,0)'); gr.addColorStop(1, 'rgba(170,235,255,0.75)'); }
      else if (fast) { gr.addColorStop(0, 'rgba(255,60,40,0)'); gr.addColorStop(0.6, 'rgba(255,140,60,0.55)'); gr.addColorStop(1, 'rgba(255,240,200,0.95)'); }
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
      const fs = Math.round(Math.max(13, 0.26 * this.sc) * Math.min(this.hudK, 1.15));
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
        const out = Math.abs(h.landX) > (m.halfOf ? m.halfOf(idx) : C.HALF) + C.LINE_TOL;
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
          ctx.font = `900 ${Math.round(Math.max(11, 0.2 * k) * this.hudK)}px ${FONT}`;
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
        const fs = Math.round(Math.max(11, 0.18 * k) * this.hudK);
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
        if (q.delay && q.t < q.delay) continue;
        const u = q.delay ? (q.t - q.delay) / Math.max(0.01, q.life - q.delay) : q.t / q.life, a = 1 - u;
        const X = this.sx(q.x), Y = this.sy(q.y);
        switch (q.type) {
          case 'market': this.drawMarketPart(ctx,q,X,Y,u,a,k); break;
          case 'arc': case 'zig': { // 疾风的青色弧线 / 磐盾的银绿折线
            const sxd = this.sx(q.x + Math.cos(q.ang)) - X, ang = Math.atan2(-Math.sin(q.ang), sxd), r = q.size * k * (0.8 + u * 0.5);
            ctx.save(); ctx.translate(X, Y); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(${q.color},${a * 0.9})`;
            if (q.type === 'arc') {
              for (const o of q.twin ? [0, 0.18] : [0]) { ctx.lineWidth = Math.max(1, 0.045 * k * a); ctx.beginPath(); ctx.arc(-r * (0.55 + o), 0, r, -0.85, 0.85); ctx.stroke(); }
            } else {
              ctx.lineWidth = Math.max(1, 0.035 * k * a); ctx.beginPath(); ctx.moveTo(-r * 0.2, 0);
              for (let j = 1; j <= 4; j++) ctx.lineTo(r * (j / 4) * 0.9, (j % 2 ? -1 : 1) * r * 0.16); ctx.stroke();
            }
            ctx.restore(); ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'cross': { // 棱镜：细十字光点
            const r = q.size * k * (0.6 + u * 0.5);
            ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${q.color},${a})`; ctx.lineWidth = Math.max(1, 0.02 * k * a);
            ctx.beginPath(); ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${a * 0.8})`; ctx.beginPath(); ctx.moveTo(X - r * 0.3, Y - r * 0.3); ctx.lineTo(X + r * 0.3, Y + r * 0.3); ctx.moveTo(X + r * 0.3, Y - r * 0.3); ctx.lineTo(X - r * 0.3, Y + r * 0.3); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'gstar': { // 星轨的小星
            const r = q.size * k * (u < 0.2 ? 0.6 + u * 2 : 1), al = Math.min(1, a * 2.2) * (q.on ? 1 : 0.45);
            ctx.save(); ctx.translate(X, Y); ctx.rotate(this.time * 0.6);
            ctx.fillStyle = `rgba(${q.color},${al})`; ctx.beginPath();
            for (let j = 0; j < 10; j++) { const an = -Math.PI / 2 + j * Math.PI / 5, rr2 = j % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); }
            ctx.closePath(); ctx.fill(); ctx.restore();
            break;
          }
          case 'wave': { // 潮汐 / 巡航：很淡的水纹或呼吸涟漪
            const r = q.size * k * (1 + u * 2.4), al = (q.soft ? 0.32 : 0.6) * a;
            ctx.strokeStyle = `rgba(${q.color},${al})`; ctx.lineWidth = Math.max(1, 2 * a);
            ctx.beginPath(); ctx.ellipse(X, Y, r, q.floor ? r * 0.26 : r, 0, 0, Math.PI * 2); ctx.stroke();
            if (!q.soft) { ctx.strokeStyle = `rgba(${q.color},${al * 0.5})`; ctx.beginPath(); ctx.ellipse(X, Y, r * 0.65, (q.floor ? r * 0.26 : r) * 0.65, 0, 0, Math.PI * 2); ctx.stroke(); }
            break;
          }
          case 'petal': { // 蝶步 / 绣羽：粉色花瓣
            if (q.y < 0.02) { q.y = 0.02; q.vy = 0; q.vx *= 0.9; }
            ctx.save(); ctx.translate(X, Y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 2);
            ctx.fillStyle = q.color; ctx.beginPath(); ctx.ellipse(0, 0, q.size * k, q.size * k * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          }
          case 'puff': { // 云垫：淡紫色云团
            const r = q.size * k * (1 + u * 1.6);
            ctx.fillStyle = `rgba(${q.color},${0.45 * a})`; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'streak': { // 羽翼：鞋跟一道很短的浅青光痕
            const len = q.size * k * (0.6 + u * 0.4), d = Math.sign(this.sx(q.x + q.w) - X) || 1, al = (q.soft ? 0.35 : 0.75) * a;
            const g = ctx.createLinearGradient(X, Y, X - d * len, Y); g.addColorStop(0, `rgba(${q.color},${al})`); g.addColorStop(1, `rgba(${q.color},0)`);
            ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, 0.035 * k); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - d * len, Y); ctx.stroke();
            break;
          }
          case 'hexf': { // 磐石：地板上的六边形稳定标记
            const r = q.size * k * (1 + u * 0.4);
            ctx.strokeStyle = `rgba(${q.color},${0.8 * a})`; ctx.lineWidth = Math.max(1, 2.2 * a); ctx.beginPath();
            for (let j = 0; j <= 6; j++) { const an = j * Math.PI / 3; ctx.lineTo(X + Math.cos(an) * r, Y + Math.sin(an) * r * 0.28); }
            ctx.stroke();
            break;
          }
          case 'crescent': { // 逐月：身后地板上的银色月牙
            const r = q.size * k * (1 + u * 0.3), d = Math.sign(this.sx(q.x + q.w) - X) || 1, al = (q.soft ? 0.3 : 0.7) * a;
            ctx.save(); ctx.translate(X - d * r * 0.3, Y); ctx.scale(d, 0.3);
            ctx.fillStyle = `rgba(${q.color},${al})`; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(r * 0.35, 0, r * 0.82, Math.PI * 1.5, Math.PI * 0.5, true); ctx.fill();
            ctx.restore();
            break;
          }
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
          case 'star': {
            // 四角星形的击球闪光
            ctx.globalCompositeOperation = 'lighter';
            const r = q.size * k * (0.7 + u * 0.9), w = r * 0.16 * a;
            ctx.save(); ctx.translate(X, Y); ctx.rotate(q.rot);
            ctx.fillStyle = `rgba(${q.color},${a})`;
            ctx.beginPath();
            for (let j = 0; j < 4; j++) { const an = j * Math.PI / 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); ctx.lineTo(Math.cos(an + Math.PI / 4) * w, Math.sin(an + Math.PI / 4) * w); }
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.globalCompositeOperation = 'source-over';
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
      const u = clamp(Math.round(this.H * 0.043 * this.hudK), 15, 30);
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
        const i = order[j], look = this.lookOf(m, i), left = j === 0;
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
        ctx.drawImage(this.portraitOf(this.lookOf(m, i)), ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
        if (m.skillsOn && p.skill) this.drawEnergy(ctx, p, ax, ay, ar);
        const nx = left ? ax + ar + 10 : ax - ar - 10;
        ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.round(u * 0.6)}px ${FONT}`;
        ctx.fillStyle = '#fff';
        ctx.fillText(m.names[i], nx, by + bh * 0.35);
        const sw = Math.max(46, Math.min(bw * 0.19, W / 2 - cw / 2 - (left ? nx - bx : bx + bw - nx) - 24 + bx)), sh = Math.max(5, u * 0.24);
        const sx0 = left ? nx : nx - sw, sy0 = by + bh * 0.62;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, sx0, sy0, sw, sh, sh / 2); ctx.fill();
        const r = clamp(p.stamina / C.STAM_MAX, 0, 1);
        // 绿：状态充沛（无惩罚）；黄：开始疲劳（移动、挥拍、发力逐渐下降）；红：体力透支
        const col = p.stamina >= C.STAM_FRESH ? ['#5cffa8', '#1fc77a'] : p.stamina >= C.STAM_FRESH * 0.45 ? ['#ffd96b', '#ffa53d'] : ['#ff7a7a', '#e2384a'];
        if (p.stamina < C.STAM_FRESH * 0.45 && (m.phase === 'rally' || m.phase === 'serve')) {
          ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 9);
          ctx.fillStyle = '#ff4a5a'; rr(ctx, sx0 - 2, sy0 - 2, sw + 4, sh + 4, sh / 2 + 2); ctx.fill(); ctx.restore();
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, sx0, sy0, sw, sh, sh / 2); ctx.fill();
        }
        const sg = ctx.createLinearGradient(0, sy0, 0, sy0 + sh);
        sg.addColorStop(0, col[0]); sg.addColorStop(1, col[1]);
        ctx.fillStyle = sg;
        const fw = Math.max(sh, sw * r);
        rr(ctx, left ? sx0 : sx0 + sw - fw, sy0, fw, sh, sh / 2); ctx.fill();
        const need = C.STAM_FRESH / C.STAM_MAX; // 刻度：低于此处开始疲劳
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
      const fs = Math.max(Math.round(10 * this.hudK), Math.round(u * 0.42));
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
    /** 头像外圈的技能能量环；充满后彩色流转 */
    drawEnergy(ctx, p, ax, ay, ar) {
      const sk = YY.SKILLS[p.skill] || { color: '#ffd23f' };
      const e = clamp(p.energy / 100, 0, 1), full = e >= 1;
      const R = ar + 4;
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.arc(ax, ay, R, 0, Math.PI * 2); ctx.stroke();
      if (e > 0.01) {
        ctx.strokeStyle = full ? `hsl(${(this.time * 260) % 360},100%,66%)` : sk.color;
        ctx.beginPath(); ctx.arc(ax, ay, R, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); ctx.stroke();
      }
      const active = Object.keys(p.buff || {}).some((k) => p.buff[k] > 0);
      if (full || active) {
        ctx.globalCompositeOperation = 'lighter';
        const a = full ? 0.45 + Math.sin(this.time * 8) * 0.25 : 0.35;
        const g = ctx.createRadialGradient(ax, ay, ar * 0.8, ax, ay, ar * 1.9);
        g.addColorStop(0, `rgba(255,255,255,${a * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(ax - ar * 2, ay - ar * 2, ar * 4, ar * 4);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.lineCap = 'butt';
    }
    /** 技能播报：贴在施放者一侧、记分牌下方的小卡片，不横穿球场；球或选手经过时自动变淡 */
    cutInBounds(c) {
      const k = this.hudK, u = clamp(Math.round(this.H * 0.043 * k), 15, 30), bar = { x: (this.W - Math.min(this.W * 0.64, 660)) / 2, y: 8, w: Math.min(this.W * 0.64, 660), h: u * 2.15 };
      const h = clamp(Math.round(this.H * 0.07 * k), 30, 50), fs = Math.round(h * 0.42);
      const g = this.ctx; g.save();
      g.font = `italic 900 ${fs}px ${FONT}`; let tw = g.measureText(c.name).width;
      g.font = `800 ${Math.round(fs * 0.6)}px ${FONT}`; tw = Math.max(tw, g.measureText(c.look.name + ' · 技能').width); g.restore();
      const w = Math.min(this.W * 0.4, h * 1.2 + tw + h * 0.45), side = Math.max(12, this.hudSafe || 0), y0 = bar.y + bar.h + 6, edge = c.left ? side : this.W - side - w;
      // 要让开的：宿主的触屏按键 / 暂停键（hudAvoid）、风向牌；记分牌下的规则提示是静态信息，可以被短暂压住
      const avoid = (typeof this.hudAvoid === 'function' ? this.hudAvoid() : []).concat(this.windRect && this.time - this.windRect.t < 0.3 ? [this.windRect] : []);
      const hitAt = (x, y) => avoid.find(r => x < r.x + r.w + 3 && x + w > r.x - 3 && y < r.y + r.h + 3 && y + h > r.y - 3);
      // ① 贴着记分牌下沿，从屏幕边向内让（不越过中线）
      for (let x = edge, i = 0; i < 6; i++) {
        const hit = hitAt(x, y0); if (!hit) return { x, y: y0, w, h, fs };
        x = c.left ? hit.x + hit.w + 6 : hit.x - w - 6;
        if (c.left ? x + w > this.W / 2 : x < this.W / 2) break;
      }
      // ② 贴着屏幕边往下让（不超过上半屏）
      for (let y = y0, i = 0; i < 6; i++) {
        const hit = hitAt(edge, y); if (!hit) return { x: edge, y, w, h, fs };
        y = hit.y + hit.h + 6;
        if (y + h > this.H * 0.48) break;
      }
      return { x: edge, y: y0, w, h, fs };
    }
    drawCutIn(ctx, dt, m) {
      const c = this.cutin;
      if (!c) return;
      c.t += dt;
      if (c.t > c.life) { this.cutin = null; return; }
      const b = this.cutInBounds(c), { x, y, w, h, fs } = b, dir = c.left ? 1 : -1;
      const inK = Math.min(1, c.t / 0.16), outK = c.t > c.life - 0.22 ? (c.t - (c.life - 0.22)) / 0.22 : 0;
      const e = 1 - (1 - inK) ** 3;
      // 球（含假球）或选手进入卡片附近：卡片退到很淡，不挡视线
      let veil = 1;
      if (m) {
        const pts = [m.shuttle, ...(m.ents || []).filter(q => q.k === 'fake')].filter(q => q && q.live !== false).map(q => this.screenPoint(q.x, q.y));
        for (const p of m.players || []) pts.push(this.screenPoint(p.x, p.y + 1.8));
        if (pts.some(pt => pt.x > x - 30 && pt.x < x + w + 30 && pt.y > y - 30 && pt.y < y + h + 40)) veil = 0.22;
      }
      c.veil = c.veil == null ? veil : c.veil + (veil - c.veil) * Math.min(1, dt * 14);
      ctx.save();
      ctx.translate(-dir * (1 - e) * (w + 20), 0);
      ctx.globalAlpha = (1 - outK) * c.veil;
      // 侧边的一道细光：只在屏幕边缘，提示“对方 / 我方放技能了”
      const edge = c.left ? 0 : this.W, eg = ctx.createLinearGradient(edge, 0, edge + dir * 26, 0);
      eg.addColorStop(0, c.color + '66'); eg.addColorStop(1, c.color + '00');
      ctx.fillStyle = eg; ctx.fillRect(c.left ? 0 : this.W - 26, y - h * 0.6, 26, h * 2.2);
      ctx.fillStyle = 'rgba(6,8,22,0.66)'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = c.color; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, h / 2); ctx.stroke();
      // 扫光
      const sx = x + ((c.t * 1.4) % 1.4 - 0.2) * w;
      ctx.save(); rr(ctx, x, y, w, h, h / 2); ctx.clip();
      const sg = ctx.createLinearGradient(sx - h, 0, sx + h, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.16)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - h, y, h * 2, h);
      ctx.restore();
      const ps = h - 6, px = c.left ? x + 3 : x + w - 3 - ps, py = y + 3;
      ctx.save(); ctx.beginPath(); ctx.arc(px + ps / 2, py + ps / 2, ps / 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(this.portraitOf(c.look), px, py, ps, ps); ctx.restore();
      ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px + ps / 2, py + ps / 2, ps / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = c.left ? 'left' : 'right'; ctx.textBaseline = 'middle';
      const tx = c.left ? px + ps + h * 0.22 : px - h * 0.22;
      ctx.font = `italic 900 ${fs}px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(c.name, tx, y + h * 0.4);
      ctx.font = `800 ${Math.round(fs * 0.6)}px ${FONT}`; ctx.fillStyle = c.color;
      ctx.fillText(c.look.name + ' · 技能', tx, y + h * 0.78);
      ctx.restore();
    }
    /** 风向标（右上角）与风的流线 */
    drawWind(ctx, w, dt) {
      const W = this.W, H = this.H;
      const sw = this.mirror ? -w : w;
      // 流线
      const L = this.windLines;
      while (L.length < 14) L.push({ x: Math.random() * W, y: H * (0.15 + Math.random() * 0.65), len: 30 + Math.random() * 60, a: 0.08 + Math.random() * 0.12 });
      ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 1.2;
      for (const l of L) {
        l.x += sw * (90 + l.len) * dt;
        if (l.x > W + 80) l.x = -80; else if (l.x < -80) l.x = W + 80;
        ctx.globalAlpha = l.a * Math.min(1, Math.abs(w) / 1.2);
        ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x - Math.sign(sw) * l.len, l.y + Math.sin(this.time * 2 + l.y) * 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 风向牌
      const fs = clamp(Math.round(H * 0.03 * this.hudK), 12, 18);
      ctx.font = `900 ${fs}px ${FONT}`;
      const label = `${(Math.sign(sw) || 1) > 0 ? '向右' : '向左'}风 ${Math.abs(w).toFixed(1)} m/s`;
      const bh = fs * 2, bw = bh * 1.5 + ctx.measureText(label).width + fs, bx = W - bw - 14, by = clamp(Math.round(H * 0.043 * this.hudK), 15, 30) * 2.15 + 18;
      this.windRect = { x: bx, y: by, w: bw, h: bh, t: this.time };
      ctx.fillStyle = 'rgba(8,10,28,0.78)'; rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,220,255,0.5)'; ctx.lineWidth = 1; rr(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
      const ax = bx + bh * 0.75, ay = by + bh / 2, d = Math.sign(sw) || 1;
      ctx.strokeStyle = '#9fdcff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const wob = Math.sin(this.time * 9) * 2;
      ctx.beginPath(); ctx.moveTo(ax - d * bh * 0.4, ay + wob * 0.3); ctx.lineTo(ax + d * bh * 0.4, ay - wob * 0.3);
      ctx.moveTo(ax + d * bh * 0.4, ay); ctx.lineTo(ax + d * bh * 0.12, ay - bh * 0.25);
      ctx.moveTo(ax + d * bh * 0.4, ay); ctx.lineTo(ax + d * bh * 0.12, ay + bh * 0.25); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, bx + bh * 1.5, ay);
    }
    /** 停电：低分辨率遮罩，只在球和选手周围留光 */
    drawDark(ctx, m, dark) {
      const W = this.W, H = this.H;
      const sc = 6;
      if (!this.darkCv) { this.darkCv = YY.platform.createCanvas(); }
      const cv = this.darkCv, w = Math.ceil(W / sc), h = Math.ceil(H / sc);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d');
      const bolt = dark.flash > 0 ? dark.flash : 0;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.fillStyle = `rgba(2,3,10,${0.93 * (1 - bolt)})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r0, r1, a) => {
        const X = x / sc, Y = y / sc;
        const gr = g.createRadialGradient(X, Y, r0 / sc, X, Y, r1 / sc);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(X - r1 / sc, Y - r1 / sc, (r1 * 2) / sc, (r1 * 2) / sc);
      };
      const s = m.shuttle, k = this.sc;
      hole(this.sx(s.x), this.sy(s.y), k * 0.25, k * (s.live ? 1.9 : 1.2), 1);
      for (const p of m.players) hole(this.sx(p.x), this.sy(p.y + 1), k * 0.3, k * 1.25, 0.75);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(cv, 0, 0, w, h, 0, 0, w * sc, h * sc);
    }
    /** 步法训练的地面标记 */
    drawMarks(ctx, marks) {
      const k = this.sc;
      for (const mk of marks) {
        const a = this.P(mk.x, 0, 0);
        const u = clamp(mk.t / mk.life, 0, 1);
        const col = mk.done ? '92,255,157' : mk.kind === 'jump' ? '255,210,63' : mk.kind === 'swing' ? '255,140,110' : '120,220,255';
        const pulse = 1 + Math.sin(this.time * 9) * 0.08;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, a[1], 0, a[1] - k * 1.3);
        g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(a[0] - k * 0.28, a[1] - k * 1.3, k * 0.56, k * 1.3);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 3; ctx.strokeStyle = `rgb(${col})`;
        ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.34 * k * pulse, 0.1 * k * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        if (!mk.done) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(a[0], a[1], 0.44 * k, 0.13 * k, 0, -Math.PI / 2, -Math.PI / 2 + (1 - u) * Math.PI * 2); ctx.stroke();
        }
        const fs = Math.max(14, Math.round(0.3 * k));
        ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = `rgb(${col})`;
        ctx.fillText(mk.done ? '✓' : mk.label, a[0], a[1] - 0.18 * k);
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
      const u = clamp(Math.round(this.H * 0.04 * this.hudK), 14, 26);
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
      const g = pr.goal;
      const score = pr.tutorial ? `${pr.completed} / 3` : g ? `${pr.ok} / ${g.need}` : `${pr.ok} / ${pr.att}`;
      ctx.font = `900 ${Math.round(u * 0.85)}px ${NUMF}`;
      ctx.fillStyle = g && pr.ok >= g.need ? '#7dffb0' : '#fff';
      ctx.fillText(score, bx + bw - 16, by + bh * 0.33);
      const tw = ctx.measureText(score).width;
      ctx.font = `bold ${Math.round(u * 0.48)}px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const sub = pr.progressText || (g ? `剩余 ${Math.max(0, g.total - pr.att)} ${g.unit || '球'} · 连续 ${pr.streak} · 目标` : `连续 ${pr.streak} · 最佳 ${pr.best} · 成功`);
      ctx.fillText(sub, bx + bw - 24 - tw, by + bh * 0.34);
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
      m = this.interpolate(m, o.alpha);
      this.poseCache = new Map();
      this.time += dt;
      // 自动画质：只统计正常帧（后台节流 / 卡顿帧不算），持续偏慢才降级，恢复流畅后再升回
      const raw = o.rawDt != null ? o.rawDt : dt;
      if (dt > 0 && raw < 0.12 && !YY.platform.hidden()) {
        this.frameAvg = this.frameAvg * 0.98 + raw * 0.02;
        this.slowT = this.frameAvg > 0.028 ? (this.slowT || 0) + raw : 0;
        this.fastT = this.frameAvg < 0.019 ? (this.fastT || 0) + raw : 0;
        if (this.quality && this.slowT > 4) { this.quality = 0; this.slowT = 0; this.fastT = 0; this.resize(); }
        else if (!this.quality && this.fastT > 8 && !this.downgradedTwice) { this.quality = 1; this.fastT = 0; this.downgradedTwice = this.everDowngraded; this.everDowngraded = true; this.resize(); }
      }
      const ctx = this.ctx;
      const v = this.venue;
      const half = m.sk && m.sk.half, offT = half && Math.abs(half[0] + half[1] - 2 * C.HALF) < 0.01 ? (half[0] - half[1]) / 2 : 0;
      this.netOff = (this.netOff || 0) + (offT - (this.netOff || 0)) * Math.min(1, dt * 6);
      if (Math.abs(this.netOff - offT) < 0.002) this.netOff = offT;
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
      if (o.marks) this.drawMarks(ctx, o.marks);
      if (m.landMark && (m.phase === 'point' || m.phase === 'over' || m.phase === 'idle')) this.drawLandMark(ctx, m.landMark, m.time);
      if (o.hintIdx != null && m.hint) this.drawHint(ctx, m, o.hintIdx, m.hint, true);
      else if (o.landHint && m.pred && m.shuttle.live && !m.pred.hidden) {
        for (const i of o.landHint) if (m.shuttle.lastHitter !== i) this.drawHint(ctx, m, i, { landX: m.pred.landX }, false);
      }
      // 镜像假球带着一模一样的落点提示：提示不再能替你分辨真假
      if (o.landHint && m.ents) for (const e of m.ents) if (e.k === 'fake' && e.lx != null) for (const i of o.landHint) if (e.o !== i) this.drawHint(ctx, m, i, { landX: e.lx }, false);

      const humans = m.players.filter((p) => !(m.practice && !m.tutorial && p.idx === 1));
      for (const p of humans) {
        this.updateSpring(p, dt);
        const fast = (p.swing && (p.swing.style === 'smash' || (!p.swing.style && p.swing.dur > 0.4)) && p.swing.t < 0.3) || (!p.onGround && Math.abs(p.vy) > 1.5);
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
        for (const p of humans) { const lk = this.lookOf(m, p.idx); if (!(YY.SkillFX && YY.SkillFX.pose(this, ctx, p, lk, m))) this.drawCharAt(ctx, p, lk, this.charOpts(p, m)); }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (YY.SkillFX && m.ents) YY.SkillFX.ground(this, ctx, m, o, dt);
      this.marketFx(m,dt);
      this.marketBall(m,dt);
      for(const p of humans)this.drawMarketAura(ctx,p);
      for (const p of humans) this.drawShadow(ctx, p);
      this.gearSteps(m, dt);
      this.drawColumns(ctx, dt);
      this.drawNet(ctx);
      if (YY.SkillFX && m.ents) YY.SkillFX.net(this, ctx, m, o, dt);
      this.netWob = Math.max(0, this.netWob - dt * 1.8);

      const s = m.shuttle;
      if (!(dt > 0)) { /* 暂停时拖尾保持原样（镜像假球的拖尾同样只在时间推进时更新） */ }
      else if (s.live) {
        this.trail.push({ x: s.x, y: s.y, v: s.speed || 0 });
        if (this.trail.length > 22) this.trail.shift();
      } else if (this.trail.length) this.trail.splice(0, 2);

      for (const p of m.players) {
        if (m.practice && !m.tutorial && p.idx === 1) { if (!m.hideOpp) this.drawMachine(ctx, p); continue; }
        const look = this.lookOf(m, p.idx);
        const gs = this.ghosts[p.idx];
        const bk = p.buff ? Object.keys(p.buff).find((k) => p.buff[k] > 0 && YY.SKILLS && YY.SKILLS[k]) : null;
        if (bk) this.drawAura(ctx, p, YY.SKILLS[bk].color, dt);
        for (let i = gs.length - 1; i >= 0; i--) {
          const gh = gs[i];
          gh.t += dt;
          if (gh.t > 0.2) { gs.splice(i, 1); continue; }
          ctx.globalAlpha = 0.28 * (1 - gh.t / 0.2) * ((i + 1) / gs.length);
          this.drawCharAt(ctx, gh.p, look, this.charOpts(gh.p, m, { flat: gh.tint || look.shirt }));
        }
        ctx.globalAlpha = 1;
        if (!(YY.SkillFX && YY.SkillFX.pose(this, ctx, p, look, m))) this.drawCharAt(ctx, p, look, this.charOpts(p, m));
        this.drawGearGlow(ctx, p);
        this.drawSwoosh(ctx, p, look);
        if (o.labels && o.labels[p.idx]) {
          const X = this.sx(p.x), Y = this.sy(p.y + 2.2);
          const fs = Math.round(Math.max(11, 0.19 * this.sc) * this.hudK);
          ctx.font = `900 ${fs}px ${FONT}`;
          const tw = ctx.measureText(o.labels[p.idx]).width;
          ctx.fillStyle = look.shirt; rr(ctx, X - tw / 2 - 7, Y - fs - 6, tw + 14, fs + 6, (fs + 6) / 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(X - 4, Y); ctx.lineTo(X + 4, Y); ctx.lineTo(X, Y + 5); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(o.labels[p.idx], X, Y - fs / 2 - 3);
        }
      }
      this.trailFire = false;
      this.trailKind = s.live ? s.shot : null;
      if (this.ballFx === 6) this.trailFire = true; else if (this.ballFx) this.trailKind = 'mk' + this.ballFx; // 果哥打出的球
      this.drawTrail(ctx);
      if (YY.SkillFX && m.ents) YY.SkillFX.air(this, ctx, m, o, dt);
      this.drawShuttle(ctx, s);
      if (YY.SkillFX && m.ents) YY.SkillFX.top(this, ctx, m, o, dt);
      this.drawParts(ctx, dt);
      if (m.phase === 'serve' && !m.serving && o.meterFor && o.meterFor.includes(m.server)) this.drawServeMeter(ctx, m, o.serveLabel);
      this.drawEmotes(ctx, m, dt);
      this.drawTexts(ctx, dt);

      // 屏幕空间
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (o.dark) this.drawDark(ctx, m, o.dark);
      if (YY.SkillFX && m.ents) YY.SkillFX.screen(this, ctx, m, o, dt);
      if (m.env && m.env.wind) this.drawWind(ctx, m.env.wind, dt);
      if (v.drawFront && this.quality) v.drawFront(ctx, this, this.time, this.vst, dt);
      this.drawSpeedLines(ctx, dt);
      if (!o.noHud) {
        ctx.save();
        const hb = this.scoreboardBounds(), high = [s,...(m.ents||[]).filter(e=>e.k==='fake')].some(q=>{
          const pt=this.screenPoint(q.x,q.y);
          return pt.x>hb.x-22 && pt.x<hb.x+hb.w+22 && pt.y>0 && pt.y<hb.y+hb.h+22;
        });
        if (!o.dark && s.live && !s.hide && !(s.veil>0) && high) ctx.globalAlpha=.28;
        if (o.practice) this.drawPracticeHUD(ctx, o.practice);
        else this.drawScoreboard(ctx, m);
        ctx.restore();
      }
      this.drawBanner(ctx, dt);
      this.drawCutIn(ctx, dt, m);
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
        const fs = Math.round(Math.max(12, this.H * 0.022) * this.hudK);
        ctx.font = `bold ${fs}px ${FONT}`;
        const tw = ctx.measureText(o.overlayText).width;
        const y = this.H - (this.touch ? this.H * 0.21 : 12) - fs - 10;
        ctx.fillStyle = 'rgba(6,8,24,0.6)'; rr(ctx, this.W / 2 - tw / 2 - 14, y, tw + 28, fs + 12, (fs + 12) / 2); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(o.overlayText, this.W / 2, y + (fs + 12) / 2);
      }
      if (!o.dark) {
        this.drawHighShuttle(ctx,m);
        // 镜像假球同样优先显示，不能用 HUD 遮挡泄露哪只是真球。
        for(const e of m.ents||[]) if(e.k==='fake') this.drawHighShuttle(ctx,m,
          {x:e.x,y:e.y,vx:e.vx,vy:e.vy,live:true,held:false,shot:e.kind||s.shot,speed:Math.hypot(e.vx,e.vy)},this.fakeTrails?.[e.id]||[]);
      }
    }
  }

  /** 击球震动强度：重杀 / 扑球最重，发力球与平抽中等，吊、搓、放网只轻点一下 */
  YY.hitWeight = (e) => {
    if (!e || e.feed) return null;
    if (e.shot === 'smash' || e.shot === 'kill') return 'heavy';
    if (e.shot === 'halfsmash' || e.shot === 'drive' || e.shot === 'push' || e.q >= 0.85) return 'medium';
    return 'light';
  };
  YY.Renderer = Renderer;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
