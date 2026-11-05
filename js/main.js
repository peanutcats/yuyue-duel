/* 羽跃对决 · 应用入口：模式管理、界面、主循环 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const $ = (id) => document.getElementById(id);
  const A = YY.Audio;
  const clamp = YY.clamp;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('yuyue.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('yuyue.' + k, JSON.stringify(v)); } catch (_) {} },
  };

  const App = {
    ...YY.createGameplay(),
    mode: 'attract',
    match: null,
    ais: [],
    ctrlFor: [null, null], // 本地人类控制器（按选手序号）
    practice: null,
    paused: false,
    level: 'normal',
    drill: 'receive',
    view: null,
    remote: null,
    netEvents: [],
    tickN: 0,
    resultShown: false,
    settings: { sound: store.get('sound', true), hint: store.get('hint', true), venue: store.get('venue', 'random'), skills: store.get('skills', true) },
    story: null,
    pickVenue() {
      const v = this.settings.venue;
      if (YY.VENUES[v]) return v;
      const ids = YY.VENUE_IDS.filter((id) => id !== this.R.venueId);
      return ids[Math.floor(Math.random() * ids.length)];
    },
    setVenueSetting(v) {
      this.settings.venue = v;
      store.set('venue', v);
      document.querySelectorAll('.venue-opt').forEach((el) => el.classList.toggle('on', el.dataset.venue === v));
    },

    init() {
      this.cv = $('game');
      document.body.classList.toggle('touch', YY.isTouch());
      this.R = new YY.Renderer(this.cv);
      this.R.touch = YY.isTouch();
      this.applyViewport();
      YY.Input.init();
      YY.Input.onChange = () => { if (this.mode === 'guest' && !this.paused) this.sendGuestInput(); };
      YY.Input.onAny = (e) => {
        if (this.screen === 'dialog' && ['Space', 'Enter', 'KeyJ', 'NumpadEnter'].includes(e.code)) { if (!e.repeat) this.dlgAdvance(); e.preventDefault(); return true; }
        if ((e.code === 'Escape' || e.code === 'KeyP') && this.inGame()) { this.togglePause(); return true; }
        return false;
      };
      A.enabled = this.settings.sound;
      this.bindUI();
      this.bindStoryUI();
      this.buildMenuArt();
      G.addEventListener('resize', () => this.applyViewport());
      G.addEventListener('orientationchange', () => setTimeout(() => this.applyViewport(), 250));
      // 微信等内置浏览器显示 / 隐藏底部工具栏时不一定触发 resize：再核对窗口尺寸
      const recheck = () => { if (G.innerWidth + 'x' + G.innerHeight !== this.vpKey) this.applyViewport(); };
      G.visualViewport?.addEventListener('resize', recheck);
      setInterval(recheck, 600);
      document.addEventListener('fullscreenchange', () => this.fullscreenChanged());
      document.addEventListener('webkitfullscreenchange', () => this.fullscreenChanged());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.inGame() && !this.isOnline() && !this.paused) this.togglePause();
        if (document.hidden && this.isOnline()) YY.Net.send({ t: 'away' });
      });
      // 在线模式切到后台时画面循环会停止：用定时心跳告诉对方“暂时离开”，避免被判掉线
      setInterval(() => { if (document.hidden && this.isOnline()) YY.Net.send({ t: 'away' }); }, 1000);
      const unlock = () => A.init();
      G.addEventListener('pointerdown', unlock, { passive: true });
      G.addEventListener('keydown', unlock);
      this.startAttract();
      // 邀请链接：?room=CODE
      const room = new URLSearchParams(location.search).get('room');
      if (room) { $('joinCode').value = room.toUpperCase(); this.joinOnline(room); }
      else this.show('menu');
      this.checkRotate();
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    },

    // ---------- 界面 ----------
    show(name) {
      if(name!=='dialog') A.stopVoice?.();
      if (name === 'story') this.renderStory();
      else if (name === 'team') this.renderTeam();
      else if (name === 'codex') this.renderCodex();
      else if (name === 'ai') this.renderLoadout();
      else if (name === 'menu') this.renderMenuNotes();
      for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
      if (name) $('scr-' + name).classList.remove('hidden');
      this.screen = name;
    },
    bindUI() {
      document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
        A.click();
        const go = b.dataset.go;
        if (go === 'menu' && this.helpFromPause) { this.helpFromPause = false; this.show('pause'); return; }
        this.show(go);
      }));
      document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => { A.click(); this.startAI(b.dataset.level); }));
      document.querySelectorAll('[data-drill]').forEach((b) => b.addEventListener('click', () => { A.click(); this.startPractice(b.dataset.drill); }));
      document.querySelector('[data-tactics-back]').addEventListener('click', () => { this.startAttract(); this.show('practice'); });
      $('btnLocal').addEventListener('click', () => { A.click(); this.startLocal(); });
      $('btnHost').addEventListener('click', () => { A.click(); this.hostOnline(); });
      $('btnJoin').addEventListener('click', () => { A.click(); this.joinOnline($('joinCode').value); });
      $('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.joinOnline($('joinCode').value); });
      $('btnLobbyBack').addEventListener('click', () => { YY.Net.close(); this.show('friend'); });
      $('btnCopy').addEventListener('click', () => this.copyInvite());
      $('btnPause').addEventListener('click', () => this.togglePause());
      $('btnResume').addEventListener('click', () => this.togglePause());
      $('btnRestart').addEventListener('click', () => { this.paused = false; this.restart(); });
      $('btnHelp2').addEventListener('click', () => { this.helpFromPause = true; this.show('help'); });
      $('btnQuit').addEventListener('click', () => this.quit());
      $('btnAgain').addEventListener('click', () => { A.click(); this.again(); });
      $('btnResMenu').addEventListener('click', () => this.quit());
      $('btnMsgOk').addEventListener('click', () => { this.show(this.msgBack || 'menu'); });
      $('btnRotateOk').addEventListener('click', () => { this.rotateOk = true; $('rotate').classList.add('hidden'); });
      $('btnRotateLand').addEventListener('click', () => this.goLandscape());
      $('btnLand').addEventListener('click', () => this.toggleLandscape());
      $('btnFull').addEventListener('click', () => this.toggleLandscape());
      $('optSound').checked = this.settings.sound;
      $('optHint').checked = this.settings.hint;
      $('optSound').addEventListener('change', (e) => { this.settings.sound = A.enabled = e.target.checked; store.set('sound', e.target.checked); });
      $('optHint').addEventListener('change', (e) => { this.settings.hint = e.target.checked; store.set('hint', e.target.checked); });
    },
    message(title, text, back) {
      $('msgTitle').textContent = title;
      $('msgText').textContent = text;
      this.msgBack = back;
      this.show('msg');
    },
    checkRotate() {
      const portrait = G.innerHeight > G.innerWidth * 1.05;
      $('rotate').classList.toggle('hidden', !(YY.isTouch() && portrait && !this.rotateOk && !YY.forceLand));
    },
    /** 应用视口：竖屏 + 强制横屏时整体旋转 90°，并按逻辑尺寸重建画布 */
    applyViewport() {
      const vp = YY.viewport();
      const app = $('app');
      if (YY.Input) YY.Input.releaseAll();
      this.pausedDrawn = false;
      app.classList.toggle('rot', vp.rot);
      app.style.width = vp.W + 'px';
      app.style.height = vp.H + 'px';
      app.style.setProperty('--appW', vp.W + 'px');
      app.style.setProperty('--appH', vp.H + 'px');
      // 竖屏旋转时 CSS 媒体查询仍按竖屏尺寸判断，改由逻辑视口切换紧凑布局
      const root = document.documentElement;
      root.classList.toggle('sm', vp.W <= 760 || vp.H <= 520);
      root.classList.toggle('xs', vp.W <= 640);
      root.classList.toggle('short', vp.H <= 440);
      this.vpKey = G.innerWidth + 'x' + G.innerHeight;
      if (this.R) this.R.resize();
      this.checkRotate();
      this.updateLandUI();
    },
    isLandMode() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || YY.forceLand; },
    fullscreenChanged() {
      const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (this.wasFullscreen && !full) {
        this.landRequest = (this.landRequest || 0) + 1;
        YY.forceLand = false;
        try { screen.orientation?.unlock(); } catch (_) {}
      }
      this.wasFullscreen = full;
      this.applyViewport();
    },
    /** 立即横屏；原生全屏和方向锁失败时保留 CSS 横屏。 */
    async goLandscape() {
      if (this.landBusy) return;
      A.init();
      const request = this.landRequest = (this.landRequest || 0) + 1;
      this.landBusy = true;
      YY.forceLand = true; this.rotateOk = true;
      this.applyViewport();
      const within = (p) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 1200);
        Promise.resolve(p).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
      });
      const el = document.documentElement;
      try {
        if (!document.fullscreenElement && el.requestFullscreen) await within(el.requestFullscreen({ navigationUI: 'hide' }));
        else if (!document.webkitFullscreenElement && el.webkitRequestFullscreen) await within(el.webkitRequestFullscreen());
      } catch (_) { /* 保留横屏适配 */ }
      if (request === this.landRequest) {
        try { if (screen.orientation?.lock) await within(screen.orientation.lock('landscape')); } catch (_) {}
      }
      if (request !== this.landRequest) { try { screen.orientation?.unlock(); } catch (_) {} }
      this.landBusy = false;
      this.applyViewport();
      const notice = $('landNotice');
      if (request === this.landRequest && !document.fullscreenElement && !document.webkitFullscreenElement) {
        notice.textContent = /MicroMessenger|QQ\//i.test(navigator.userAgent)
          ? '已切换横屏 · 点右上角「···」选「在浏览器打开」可全屏'
          : '已切换横屏 · 此浏览器未开启原生全屏';
        notice.classList.remove('hidden');
        clearTimeout(this.landNoticeTimer);
        this.landNoticeTimer = setTimeout(() => notice.classList.add('hidden'), 3500);
      }
    },
    async exitLandscape() {
      clearTimeout(this.landNoticeTimer);
      $('landNotice').classList.add('hidden');
      this.landRequest = (this.landRequest || 0) + 1;
      YY.forceLand = false;
      try { screen.orientation?.unlock(); } catch (_) {}
      this.applyViewport();
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (_) {}
      this.applyViewport();
    },
    toggleLandscape() { if (this.isLandMode()) this.exitLandscape(); else this.goLandscape(); },
    updateLandUI() {
      const on = this.isLandMode();
      const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const label = on ? (full ? '退出全屏' : '退出横屏') : '横屏全屏';
      const use = document.querySelector('#btnFull use');
      if (use) use.setAttribute('href', on ? '#i-unfull' : '#i-full');
      const lb = document.querySelector('#btnLand span');
      if (lb) lb.textContent = label;
      $('btnFull').setAttribute('aria-label', label);
      $('btnFull').setAttribute('aria-pressed', String(on));
    },
    inGame() { return this.mode !== 'attract'; },
    isOnline() { return this.mode === 'host' || this.mode === 'guest'; },

    // ---------- 模式 ----------
    reset() {
      this.ais = [];
      this.ctrlFor = [null, null];
      this.practice = null;
      this.view = null;
      this.remote = null;
      this.paused = false;
      this.resultShown = false;
      this.netEvents = [];
      this.R.mirror = false;
      this.R.clearFx();
      YY.Input.setCtrls([]);
      $('touch').innerHTML = '';
      $('netInfo').classList.add('hidden');
    },
    enterGame(venue) {
      this.show(null);
      $('btnPause').classList.remove('hidden');
      $('btnFull').classList.toggle('hidden', !YY.isTouch());
      if (this.R.touch !== YY.isTouch()) { this.R.touch = YY.isTouch(); this.R.resize(); }
      if (this.mode !== 'guest') this.R.setVenue(venue || this.pickVenue());
      this._skE = -1;
      this.started = performance.now();
    },
    startAttract(venue) {
      this.reset();
      this.mode = 'attract';
      this.match = new YY.Match({ names: YY.LOOKS.map((l) => l.name), firstServer: Math.random() < 0.5 ? 0 : 1 });
      this.ais = [new YY.AI(this.match, 0, 'hard'), new YY.AI(this.match, 1, 'normal')];
      this.R.setVenue(venue || YY.VENUE_IDS[(YY.VENUE_IDS.indexOf(this.R.venueId) + 1) % YY.VENUE_IDS.length]);
      const mv = document.getElementById('menuVenue');
      if (mv) mv.textContent = YY.VENUES[this.R.venueId].name;
      $('btnPause').classList.add('hidden');
      $('btnFull').classList.add('hidden');
    },
    soloCtrl(netRight, skill) {
      const c = new YY.HumanCtrl(YY.KEYMAPS.solo, netRight);
      YY.Input.setCtrls([c]);
      const ids = Array.isArray(skill) ? skill : skill && skill.act ? skill.act : skill ? [skill] : [];
      const sk = YY.SKILLS[ids[0]], sk2 = YY.SKILLS[ids[1]];
      this._kit = ids;
      if (YY.isTouch()) YY.buildTouch($('touch'), [c], 'solo', sk ? { skill: sk.short, color: sk.color, skill2: sk2 && sk2.short, color2: sk2 && sk2.color } : null);
      return c;
    },
    /** 当前选择的角色 + 装备 */

    /** 对手：标准装备 */


    startLocal() {
      this.reset();
      this.mode = 'local';
      this.match = new YY.Match({ names: ['P1 红方', 'P2 蓝方'], firstServer: 0 });
      const c1 = new YY.HumanCtrl(YY.KEYMAPS.p1, true);
      const c2 = new YY.HumanCtrl(YY.KEYMAPS.p2, false);
      this.ctrlFor = [c1, c2];
      YY.Input.setCtrls([c1, c2]);
      if (YY.isTouch()) YY.buildTouch($('touch'), [c1, c2], 'duo');
      this.enterGame();
      this.R.showBanner('同屏对战', YY.isTouch() ? '左右两侧各一套按键' : '左：A D W + F G H　右：← → ↑ + , . /', '#ffd23f', 2.6);
    },

    restart() {
      if (this.mode === 'story') { this.paused = false; this.startChallenge(this.story.st.steps[this.story.i]); return; }
      if (this.mode === 'ai') this.startAI(this.level);
      else if (this.mode === 'local') this.startLocal();
      else if (this.mode === 'practice') this.startPractice(this.drill);
      else if (this.mode === 'host') this.hostRestart();
      else if (this.mode === 'guest') { YY.Net.send({ t: 'rematch' }); this.show(null); }
    },
    again() { this.restart(); },
    quit() {
      if (this.isOnline()) YY.Net.close();
      const story = this.mode === 'story' || this.story;
      this.story = null;
      this.startAttract();
      this.show(story ? 'story' : 'menu');
    },
    togglePause() {
      if (!this.inGame() || this.screen === 'result' || this.screen === 'step') return;
      if (this.isOnline()) {
        // 在线模式不暂停模拟，只打开菜单
        if (this.screen === 'pause') this.show(null); else this.show('pause');
        $('btnRestart').classList.add('hidden');
        return;
      }
      $('btnRestart').classList.remove('hidden');
      YY.Input.releaseAll();
      this.paused = !this.paused;
      this.show(this.paused ? 'pause' : null);
    },

    // ---------- 在线 ----------
    async hostOnline() {
      this.show('lobby');
      $('lobbyTitle').textContent = '创建房间';
      $('lobbyCode').textContent = '····';
      $('lobbyStatus').textContent = '正在连接联机服务器…';
      $('btnCopy').classList.add('hidden');
      const N = YY.Net;
      N.close();
      N.onOpen = () => this.startHost();
      N.onClose = () => this.netLost();
      N.onMsg = (d) => this.hostMsg(d);
      N.onStatus = (t) => { $('lobbyStatus').textContent = t; };
      try {
        const code = await N.host();
        $('lobbyCode').textContent = code;
        $('lobbyStatus').textContent = '把房间码告诉好友，或复制邀请链接发送。等待好友加入…' +
          (N.turn === 'ok' ? '' : '\n（未获取到中转服务器，部分网络组合可能无法连接）') +
          '\n好友若在微信中打开链接，请让他点右上角选择「在浏览器打开」。';
        $('btnCopy').classList.remove('hidden');
      } catch (err) {
        this.message('无法创建房间', err.message + '。在线对战需要联网；也可以选择「同屏对战」。', 'friend');
      }
    },
    inviteLink() {
      const u = new URL(location.href);
      u.search = '?room=' + YY.Net.code;
      u.hash = '';
      return u.toString();
    },
    copyInvite() {
      const link = this.inviteLink();
      const ok = () => { $('lobbyStatus').textContent = '邀请链接已复制！发给好友，对方打开即可加入。'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, () => prompt('复制邀请链接：', link));
      else prompt('复制邀请链接：', link);
    },
    startHost() {
      this.reset();
      this.mode = 'host';
      this.match = new YY.Match({ names: ['你', '好友'], firstServer: 0 });
      this.ctrlFor[0] = this.soloCtrl(true);
      this.remote = { move: 0, counts: [0, 0, 0, 0], queue: [] };
      this.enterGame();
      this.R.showBanner('好友已加入', '你在左侧（红方）', '#ffd23f', 2);
      $('netInfo').classList.remove('hidden');
      this.pingTimer = 0;
      this.watchRoute();
      this.peerSeen = performance.now(); // 最近一次收到好友输入
      this.peerAway = 0;
    },
    hostRestart() {
      this.match = new YY.Match({ names: ['你', '好友'], firstServer: Math.random() < 0.5 ? 0 : 1 });
      this.resultShown = false;
      this.R.clearFx();
      this.show(null);
      YY.Net.send({ t: 'restart' });
    },
    hostMsg(d) {
      if (!d || this.mode !== 'host') return;
      if (d.t === 'away') { this.peerAway = performance.now(); return; }
      if (d.t === 'in') {
        this.peerSeen = performance.now();
        const r = this.remote;
        r.move = YY.clamp(+d.m || 0, -1, 1);
        const acts = ['jump', 'clear', 'drop', 'smash'];
        for (let i = 0; i < 4; i++) {
          const n = d.c[i] - r.counts[i];
          if (n > 0 && n < 5) for (let k = 0; k < n; k++) r.queue.push(acts[i]);
          r.counts[i] = d.c[i];
        }
      } else if (d.t === 'rematch' && this.match.phase === 'over') this.hostRestart();
    },
    async joinOnline(code) {
      code = (code || '').trim().toUpperCase();
      if (code.length !== 4) { $('joinCode').focus(); return; }
      this.show('lobby');
      $('lobbyTitle').textContent = '加入房间';
      $('lobbyCode').textContent = code;
      $('lobbyStatus').textContent = '正在连接房主…' + (YY.inAppHint() ? '\n' + YY.inAppHint() : '');
      $('btnCopy').classList.add('hidden');
      const N = YY.Net;
      N.close();
      N.onOpen = null;
      N.onClose = () => this.netLost();
      N.onMsg = (d) => this.guestMsg(d);
      N.onStatus = (t) => { $('lobbyStatus').textContent = t; };
      try {
        await N.join(code);
        this.startGuest();
      } catch (err) {
        N.close();
        this.message('无法加入房间', err.message, 'friend');
      }
    },
    startGuest() {
      this.reset();
      this.mode = 'guest';
      this.view = new YY.GuestView();
      this.match = null;
      this.R.mirror = true; // 好友视角：自己显示在左侧
      this.ctrlFor[1] = this.soloCtrl(true);
      this.guestCounts = [0, 0, 0, 0];
      this.enterGame();
      this.R.showBanner('已加入房间', '你在左侧（蓝方）', '#6fbaff', 2);
      $('netInfo').classList.remove('hidden');
      this.sendT = 0;
      this.watchRoute();
      this.peerSeen = performance.now(); // 最近一次收到房主快照
      this.peerAway = 0;
    },
    guestMsg(d) {
      if (!d || this.mode !== 'guest') return;
      if (d.t === 'away') { this.peerAway = performance.now(); return; }
      if (d.t === 'st') {
        this.peerSeen = performance.now();
        if (d.vn && d.vn !== this.R.venueId) this.R.setVenue(d.vn);
        this.view.push(d);
        if (d.stats) this.view.stats = d.stats;
        if (d.longest != null) this.view.longest = d.longest;
        this.guestRtt = d.rtt;
      } else if (d.t === 'restart') {
        this.view = new YY.GuestView();
        this.resultShown = false;
        this.R.clearFx();
        this.show(null);
      } else if (d.t === 'full') {
        YY.Net.close();
        this.message('房间已满', '该房间已经有两位选手。', 'friend');
        this.startAttract();
      }
    },
    /** 连接建立后查询线路（直连 / 中转），显示在延迟旁边 */
    watchRoute() {
      YY.Net.route = null;
      [1500, 6000].forEach((ms) => setTimeout(() => { if (this.isOnline()) YY.Net.detectRoute(); }, ms));
    },
    netLost(why) {
      if (!this.isOnline()) return;
      YY.Net.close();
      this.startAttract();
      this.message('连接已断开', why || '与好友的连接中断了。', 'friend');
    },
    /** 在线心跳检查：返回需要显示的等待提示（无则返回 null） */
    netWatch() {
      if (!this.isOnline()) return null;
      const N = YY.Net;
      if (N.idle() > 15) { this.netLost('超过 15 秒没有收到对方的数据，连接可能已中断。'); return null; }
      const now = performance.now();
      const who = this.mode === 'host' ? '好友' : '房主';
      const quiet = (now - this.peerSeen) / 1000;
      if (quiet < 1.2) return null;
      if (now - this.peerAway < 2500) return `${who}暂时离开了游戏画面，比赛已暂停，等待返回…`;
      return `${who}的网络不稳定，比赛已暂停，等待恢复…（${Math.ceil(15 - N.idle())} 秒后断开）`;
    },

    // ---------- 循环 ----------
    frame(now) {
      this.rawDt = (now - this.last) / 1000;
      const dt = Math.min(0.05, this.rawDt);
      this.last = now;
      this.netWait = this.netWatch();
      if (this.isOnline() && now - (this.lastRouteAt || 0) >= 5000) {
        YY.Net.detectRoute(); this.lastRouteAt = now;
      }
      if (!this.paused) {
        this.acc = (this.acc || 0) + dt;
        let n = 0;
        while (this.acc >= C.DT && n < 12) { this.tick(C.DT); this.acc -= C.DT; n++; }
        if (n >= 12) this.acc = 0;
      }
      this.sendHostSnapshot();
      this.render(dt);
      requestAnimationFrame((t) => this.frame(t));
    },
    sendGuestInput() {
      const c = this.ctrlFor[1];
      if (!c || !this.guestCounts) return;
      for (const a of c.drain()) this.guestCounts[['jump', 'clear', 'drop', 'smash'].indexOf(a)]++;
      const mv = c.move();
      if (this.sendT <= 0 || mv !== this.lastMv || this.guestCounts.join() !== this.lastCounts) {
        YY.Net.send({ t: 'in', m: mv, c: this.guestCounts.slice() });
        this.lastMv = mv; this.lastCounts = this.guestCounts.join(); this.sendT = 0.05;
      }
    },
    sendHostSnapshot() {
      if (this.mode !== 'host') return;
      const now = performance.now();
      if (now - (this.lastSnapshotAt || 0) < 1000 / 60 - 1) return;
      this.lastSnapshotAt = now;
      const m = this.match, sn = YY.snapshot(m, this.netEvents);
      sn.vn = this.R.venueId;
      if (m.phase === 'over') { sn.stats = m.stats; sn.longest = m.longest; }
      YY.Net.send(sn); this.netEvents = [];
      if (now - (this.lastPingAt || 0) >= 1000) { YY.Net.ping(); this.lastPingAt = now; }
    },
    tick(dt) {
      this.tickN++;
      if (this.mode === 'guest') {
        this.sendT -= dt;
        if (this.sendT <= 0) this.sendGuestInput();
        return;
      }
      const m = this.match;
      if (this.mode === 'host' && this.netWait) {
        // 好友无响应：冻结比赛，丢弃期间的按键，仅保持心跳与快照
        if (this.ctrlFor[0]) this.ctrlFor[0].drain();
        if (this.remote) this.remote.queue.length = 0;
        return;
      }
      for (let i = 0; i < 2; i++) {
        const c = this.ctrlFor[i];
        if (!c) continue;
        m.inputs[i].move = c.move();
        for (const a of c.drain()) m.inputs[i].presses.push({ btn: a });
      }
      if (this.mode === 'host' && this.remote) {
        m.inputs[1].move = this.remote.move;
        const lead = Math.min(0.08, YY.Net.rtt / 2 + 0.03); // 补偿好友端延迟
        for (const a of this.remote.queue) m.inputs[1].presses.push({ btn: a, lead });
        this.remote.queue.length = 0;
      }
      for (const ai of this.ais) ai.update(dt);
      if (this.practice) this.practice.update(dt);
      m.step(dt);
      if (m.events.length) {
        const evs = m.events.splice(0);
        for (const e of evs) {
          if (this.practice) this.practice.onEvent(e);
          if (this.mode !== 'attract') this.handleEvent(e, m);
          else this.attractEvent(e, m);
          if (this.mode === 'host') this.netEvents.push(e);
        }
      }
      if (this.mode === 'attract' && m.phase === 'over') this.startAttract();
    },


    playerName(i, m) {
      if (this.mode === 'ai' || this.mode === 'host') return i === 0 ? '你' : m.names[i];
      if (this.mode === 'guest') return i === 1 ? '你' : '房主';
      return m.names[i];
    },
    isMe(i) {
      if (this.mode === 'guest') return i === 1;
      if (this.mode === 'local') return true;
      return i === 0;
    },



    showResult(m) {
      if (this.resultShown || !this.inGame()) return;
      this.resultShown = true;
      const w = m.winner;
      const me = this.mode === 'guest' ? 1 : 0;
      let title;
      if (this.mode === 'local') title = m.names[w] + ' 获胜！';
      else title = w === me ? '胜利！' : '惜败';
      if (w === me || this.mode === 'local') A.win(); else A.lose();
      $('resTitle').textContent = title;
      $('resTitle').parentElement.classList.toggle('lose', !(w === me || this.mode === 'local'));
      const order = this.mode === 'guest' ? [1, 0] : [0, 1];
      $('resScore').textContent = m.score[order[0]] + ' : ' + m.score[order[1]];
      const la = this.R.lookOf(m, order[0]), lb = this.R.lookOf(m, order[1]);
      $('resAvA').src = this.lookURL(la); $('resAvB').src = this.lookURL(lb);
      $('resNameA').textContent = this.playerName(order[0], m); $('resNameB').textContent = this.playerName(order[1], m);
      $('resNameA').style.color = la.shirt; $('resNameB').style.color = lb.shirt;
      const st = m.stats || [{}, {}];
      const rows = [['击球', 'hits'], ['完美击球', 'perfect'], ['扣杀', 'smash'], ['扣杀得分', 'smashWin'], ['致胜球', 'winners'], ['失误', 'errors'], ['救球', 'saves']];
      let html = '';
      for (const [label, k] of rows) {
        const va = st[order[0]][k] || 0, vb = st[order[1]][k] || 0, mx = Math.max(1, va, vb);
        html += `<div class="sr"><span class="va" style="color:${la.shirt}">${va}</span>` +
          `<div class="bar l"><i data-w="${(va / mx) * 100}" style="width:0;background:linear-gradient(90deg,${la.shirt2},${la.shirt})"></i></div>` +
          `<label>${label}</label>` +
          `<div class="bar"><i data-w="${(vb / mx) * 100}" style="width:0;background:linear-gradient(90deg,${lb.shirt},${lb.shirt2})"></i></div>` +
          `<span class="vb" style="color:${lb.shirt}">${vb}</span></div>`;
      }
      $('resStats').innerHTML = html;
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#resStats i').forEach((el) => { el.style.width = el.dataset.w + '%'; })));
      const secs = Math.round((performance.now() - this.started) / 1000);
      $('resTip').textContent = `比赛用时 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒 · 最长回合 ${m.longest || 0} 拍\n` + this.tip(st[me], st[1 - me]);
      $('btnAgain').textContent = this.mode === 'guest' ? '请求再来一局' : '再来一局';
      this.show('result');
    },
    lookURL(look) {
      this._pu = this._pu || new Map();
      if (!this._pu.has(look)) this._pu.set(look, YY.portrait(look, 160).toDataURL());
      return this._pu.get(look);
    },
    charURL(id) { return id === 'mm' ? this.maomaoURL() : this.lookURL(YY.lookOf(id === 'me' ? 'lingfeng' : id)); },
    /** 毛毛：会说话的羽毛球 */
    maomaoURL() {
      if (this._mm) return this._mm;
      const S = 160, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const bg = g.createRadialGradient(S * 0.5, S * 0.4, 10, S * 0.5, S * 0.5, S * 0.75);
      bg.addColorStop(0, '#fff6d6'); bg.addColorStop(1, '#f0a83a');
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      g.save(); g.translate(S * 0.5, S * 0.56); g.rotate(-0.25);
      // 羽毛裙
      g.fillStyle = '#ffffff'; g.strokeStyle = '#9aa3bd'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-26, 10); g.lineTo(-50, -70); g.quadraticCurveTo(0, -92, 50, -70); g.lineTo(26, 10); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(140,150,180,.7)'; g.lineWidth = 2;
      for (const x of [-30, -12, 8, 28]) { g.beginPath(); g.moveTo(x * 0.55, 6); g.lineTo(x, -78); g.stroke(); }
      g.beginPath(); g.moveTo(-40, -38); g.quadraticCurveTo(0, -48, 40, -38); g.stroke();
      // 软木球头
      g.fillStyle = '#e04848'; g.fillRect(-28, 4, 56, 10);
      const hg = g.createRadialGradient(-8, 22, 4, 0, 30, 34);
      hg.addColorStop(0, '#fff7e6'); hg.addColorStop(1, '#e9c99a');
      g.fillStyle = hg; g.strokeStyle = '#3a2412'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 30, 30, 0, Math.PI); g.lineTo(-30, 14); g.lineTo(30, 14); g.closePath(); g.fill(); g.stroke();
      // 表情
      g.fillStyle = '#2b1a12';
      g.beginPath(); g.ellipse(-11, 30, 4.5, 6, 0, 0, Math.PI * 2); g.ellipse(11, 30, 4.5, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-9.5, 28, 1.6, 0, 7); g.arc(12.5, 28, 1.6, 0, 7); g.fill();
      g.strokeStyle = '#2b1a12'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 38, 7, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = 'rgba(255,110,110,.45)'; g.beginPath(); g.ellipse(-20, 40, 6, 3.5, 0, 0, 7); g.ellipse(20, 40, 6, 3.5, 0, 0, 7); g.fill();
      g.restore();
      return (this._mm = c.toDataURL());
    },
    /** 场馆选择条与头像（菜单） */
    buildMenuArt() {
      const thumbs = {};
      for (const id of YY.VENUE_IDS) thumbs[id] = YY.venueThumb(id, 320, 180).toDataURL('image/jpeg', 0.85);
      document.querySelectorAll('.venue-pick').forEach((box) => {
        box.innerHTML = '';
        const opts = [['random', '随机场馆', null]].concat(YY.VENUE_IDS.map((id) => [id, YY.VENUES[id].name, thumbs[id]]));
        for (const [id, name, img] of opts) {
          const b = document.createElement('button');
          b.className = 'venue-opt' + (id === 'random' ? ' random' : '');
          b.dataset.venue = id;
          if (img) b.style.backgroundImage = `url(${img})`;
          else b.innerHTML = '<svg><use href="#i-dice"/></svg>';
          const label = document.createElement('span');
          label.textContent = name;
          b.appendChild(label);
          b.addEventListener('click', () => { A.click(); this.setVenueSetting(id); });
          box.appendChild(b);
        }
      });
      this.setVenueSetting(this.settings.venue);
      document.querySelectorAll('.ai-face').forEach((el) => { el.style.backgroundImage = `url(${this.lookURL(YY.LOOKS[+el.dataset.look || 1])})`; });
    },


    // ---------- 故事模式 ----------
    bindStoryUI() {
      $('btnLoEdit').addEventListener('click', () => { A.click(); this.teamBack = 'ai'; this.show('team'); });
      $('optSkill').checked = this.settings.skills;
      $('optSkill').addEventListener('change', (e) => { this.settings.skills = e.target.checked; store.set('skills', e.target.checked); });
      $('btnTeamBack').addEventListener('click', () => { A.click(); this.show(this.teamBack || 'menu'); this.teamBack = null; });
      document.querySelectorAll('.chip-btn[data-go="team"]').forEach((b) => b.addEventListener('click', () => { this.teamBack = 'menu'; }, true));
      $('scr-dialog').addEventListener('click', (e) => { if (e.target.closest('#btnDlgSkip')) return; this.dlgAdvance(); });
      $('btnDlgSkip').addEventListener('click', () => { A.click(); this.dlgFinish(); });
      $('btnQuizNext').addEventListener('click', () => { A.click(); this.quizNext(); });
      $('btnStepNext').addEventListener('click', () => { A.click(); this.stepContinue(); });
      $('btnStepRetry').addEventListener('click', () => { A.click(); this.stepRetry(); });
      $('btnStepQuit').addEventListener('click', () => { A.click(); this.quit(); });
      $('btnClearNext').addEventListener('click', () => { A.click(); this.clearNext(); });
      $('btnClearMap').addEventListener('click', () => { A.click(); this.show('story'); });
      $('btnStoryReset').addEventListener('click', () => {
        if (!confirm('确定要重置故事进度吗？已解锁的角色、装备和图鉴都会清空。')) return;
        YY.Profile.reset(); this.storyChap = null; this.renderStory();
      });
    },
    renderMenuNotes() {
      const done = YY.STAGES.filter((s) => YY.Profile.stars(s.id) > 0).length;
      const note = $('menuStoryNote');
      if (note) note.textContent = done === 0 ? '守护星光体育馆 · 解锁角色与装备' : done >= YY.STAGES.length ? '已通关！挑战三星评价' : `进度 ${done} / ${YY.STAGES.length} · 继续冒险`;
      const nb = YY.Profile.d.cards.filter((id) => !YY.Profile.d.seen['card:' + id]).length;
      const badge = $('codexBadge');
      if (badge) { badge.textContent = nb; badge.classList.toggle('hidden', nb === 0); }
    },
    /** 故事地图 */
    renderStory() {
      const P = YY.Profile;
      const total = YY.STAGES.reduce((a, s) => a + P.stars(s.id), 0);
      $('storyStars').innerHTML = `<svg><use href="#i-star"/></svg>${total} / ${YY.STAGES.length * 3}`;
      if (!this.storyChap) {
        const next = YY.STAGES.find((s) => !P.stars(s.id)) || YY.STAGES[YY.STAGES.length - 1];
        this.storyChap = next.chapter.id;
      }
      const cl = $('chapList');
      cl.innerHTML = '';
      YY.STORY.forEach((ch, i) => {
        const open = YY.stageOpen(ch.stages[0].id);
        const got = ch.stages.reduce((a, s) => a + P.stars(s.id), 0);
        const b = document.createElement('button');
        b.className = 'chap-btn' + (ch.id === this.storyChap ? ' on' : '') + (open ? '' : ' locked');
        b.innerHTML = `<span class="cn">${i === 0 ? '序' : i === YY.STORY.length - 1 ? '终' : i}</span><span class="ct"><b>${ch.title.split(' · ')[1]}</b><small>${open ? `★ ${got}/${ch.stages.length * 3}` : '未解锁'}</small></span>`;
        b.addEventListener('click', () => { if (!open) return; A.click(); this.storyChap = ch.id; this.renderStory(); });
        cl.appendChild(b);
      });
      const ch = YY.STORY.find((c) => c.id === this.storyChap);
      $('chapTitle').textContent = ch.title;
      $('chapBlurb').textContent = ch.blurb;
      const KIND = { inspect:'调查', board:'战术板', lab:'实验', combo:'战术训练', pick:'选择', drill: '练习', quiz: '问答', match: '比赛', footwork: '步法', serve: '发球' };
      const sl = $('stageList');
      sl.innerHTML = '';
      for (const st of ch.stages) {
        const open = YY.stageOpen(st.id), stars = P.stars(st.id);
        const b = document.createElement('button');
        b.className = 'stage-card k-' + st.kind + (open ? '' : ' locked') + (open && !stars ? ' fresh' : '');
        const sv = [0, 1, 2].map((k) => `<svg class="${k < stars ? 'on' : ''}"><use href="#i-star"/></svg>`).join('');
        const who = st.steps.find((x) => x.t === 'match');
        const face = who ? `<img class="st-face" src="${this.charURL(who.opp)}" alt="">` : `<img class="st-face mm" src="${this.maomaoURL()}" alt="">`;
        b.innerHTML = `${face}<span class="st-no">${st.id}</span><span class="st-kind">${KIND[st.kind]}</span>` +
          `<b>${st.title}</b><span class="st-desc">${open ? st.desc : '完成上一关后解锁'}</span><span class="st-stars">${open ? sv : '<svg class="lock"><use href="#i-lock"/></svg>'}</span>`;
        b.addEventListener('click', () => { if (!open) return; A.click(); this.startStage(st.id); });
        sl.appendChild(b);
      }
    },




    // 对话
    playDialog(lines, done, step) {
      this.dlg = { lines, i: Math.min(lines.length-1,this.story?.resume?.line||0)-1, done, typing: null, step };
      this.show('dialog');
      this.dlgAdvance();
    },
    dlgAdvance() {
      const d = this.dlg;
      if (!d) return;
      if (d.typing) { clearInterval(d.typing); d.typing = null; $('dlgText').textContent = d.full; return; }
      d.i++;
      if (d.i >= d.lines.length) { this.dlgFinish(); return; }
      const [who, text] = d.lines[d.i];
      this.storyLine();
      const box = $('dlgBox');
      const nar = who === 'nar';
      box.classList.toggle('nar', nar);
      box.classList.toggle('right', !nar && who !== 'mm' && who !== 'me');
      let name = '', col = '#fff';
      if (who === 'mm') { name = '毛毛'; col = '#ffd23f'; }
      else if (who === 'me') { name = '凌风（你）'; col = YY.LOOKS[0].shirt; }
      else if (!nar) { const lk = YY.lookOf(who); name = lk.name; col = lk.shirt; }
      box.classList.toggle('staged', !!(d.step && d.step.scene));
      $('dlgName').textContent = name;
      $('dlgName').style.color = col;
      box.style.setProperty('--dc', col);
      if (!nar) $('dlgAv').src = this.charURL(who);
      d.full = text;
      const el = $('dlgText');
      el.textContent = '';
      let n = 0;
      d.typing = setInterval(() => {
        n += 1;
        el.textContent = text.slice(0, n);
        if (n % 3 === 0 && this.settings.voice===false) A.blip();
        if (n >= text.length) { clearInterval(d.typing); d.typing = null; }
      }, 26);
    },
    dlgFinish() {
      const d = this.dlg;
      if (!d) return;
      if (d.typing) clearInterval(d.typing);
      A.stopVoice?.();
      this.dlg = null;
      d.done();
    },

    // 问答
    playQuiz(step) {
      this.quiz = { step, i: 0, right: 0, answered: false };
      $('quizAv').src = this.maomaoURL();
      $('quizTitle').textContent = this.story ? this.story.st.title : '小测验';
      this.show('quiz');
      this.quizShow();
    },
    quizShow() {
      const Q = this.quiz, q = Q.step.qs[Q.i];
      Q.answered = false;
      $('quizProg').textContent = `第 ${Q.i + 1} / ${Q.step.qs.length} 题 · 答对 ${Q.step.need} 题过关`;
      $('quizQ').textContent = q.q;
      $('quizExp').classList.add('hidden');
      $('btnQuizNext').classList.add('hidden');
      const box = $('quizOpts');
      box.innerHTML = '';
      q.o.forEach((txt, k) => {
        const b = document.createElement('button');
        b.className = 'quiz-opt';
        b.innerHTML = `<i>${'ABCD'[k]}</i><span>${txt}</span>`;
        b.addEventListener('click', () => this.quizAnswer(k));
        box.appendChild(b);
      });
    },
    quizAnswer(k) {
      const Q = this.quiz, q = Q.step.qs[Q.i];
      if (Q.answered) return;
      Q.answered = true;
      const ok = k === q.a;
      if (ok) { Q.right++; A.ready(); } else A.lose();
      [...$('quizOpts').children].forEach((b, j) => { b.classList.toggle('right', j === q.a); b.classList.toggle('wrong', j === k && !ok); b.disabled = true; });
      const exp = $('quizExp');
      exp.innerHTML = `<b>${ok ? '答对了！' : '再想想～'}</b>${q.exp}`;
      exp.classList.toggle('bad', !ok);
      exp.classList.remove('hidden');
      $('btnQuizNext').textContent = Q.i + 1 < Q.step.qs.length ? '下一题' : '查看结果';
      $('btnQuizNext').classList.remove('hidden');
    },
    quizNext() {
      const Q = this.quiz;
      if (!Q) return;
      if (Q.pick) { this.quiz = null; this.nextStep(); return; }
      if (Q.i + 1 < Q.step.qs.length) { Q.i++; this.quizShow(); return; }
      const n = Q.step.qs.length, win = Q.right >= Q.step.need;
      const stars = !win ? 0 : Q.right === n ? 3 : Q.right === n - 1 ? 2 : 1;
      this.quiz = null;
      this.showStepResult({ win, stars, main: `答对 ${Q.right} / ${n} 题`, goals: [{ text: `答对 ${Q.step.need} 题过关`, ok: win }, { text: '全部答对', ok: Q.right === n }] });
    },
    /** 选择题：选项改变下一场比赛的环境（不会失败） */
    playPick(step) {
      this.quiz = { step: { qs: [{ q: step.q, o: step.o.map((x) => x.label), a: step.o.findIndex((x) => x.ok), exp: step.exp }], need: 0 }, i: 0, right: 0, pick: step };
      $('quizAv').src = this.maomaoURL();
      $('quizTitle').textContent = this.story.st.title;
      this.show('quiz');
      this.quizShow();
      $('quizProg').textContent = '队友会记住你的回应';
      [...$('quizOpts').children].forEach((b, k) => b.addEventListener('click', () => {
        const o = step.o[k];
        this.story.ctx.pickOk = !!o.ok;
        this.story.ctx.env = o.env ? Object.assign({}, o.env) : null;
        this.rememberChoice(step,k);
        $('quizExp').innerHTML = `<b>${o.ok ? '选对了！' : o.note}</b>${o.ok ? o.note + ' ' : ''}${step.exp}${o.ok ? '' : '<br>（比赛中球会比平时飞得更远，小心出界！）'}`;
        $('btnQuizNext').textContent = '开始比赛';
      }));
    },

    // 挑战


    /** 挑战结束：res = { win, ok, att } */

    showStepResult(o) {
      this.stepRes = o;
      this.paused = true;
      $('stepTitle').textContent = o.win ? '挑战成功！' : '挑战失败';
      $('stepTitle').parentElement.parentElement.classList.toggle('lose', !o.win);
      $('stepStars').innerHTML = [0, 1, 2].map((k) => `<svg class="${k < o.stars ? 'on' : ''}" style="animation-delay:${0.15 + k * 0.18}s"><use href="#i-star"/></svg>`).join('');
      $('stepMain').textContent = o.main;
      $('stepGoals').innerHTML = o.goals.map((g) => `<li class="${g.ok ? 'ok' : ''}"><i>${g.ok ? '✓' : '·'}</i>${g.text}</li>`).join('');
      $('btnStepNext').classList.toggle('hidden', !o.win);
      $('btnStepRetry').textContent = o.win ? '再来一次（刷新星级）' : '再来一次';
      $('btnStepRetry').classList.toggle('primary', !o.win);
      $('btnStepRetry').classList.toggle('big', !o.win);
      this.show('step');
    },


    finishStage() {
      const S = this.story, P = YY.Profile;
      const stars = this.storyStageStars(); this.completeStorySave();
      const first = !P.stars(S.st.id);
      P.setStars(S.st.id, Math.max(1, stars));
      const rw = S.st.rewards || {};
      const items = [];
      for (const id of rw.chars || []) items.push({ kind: 'char', id, isNew: P.unlock('char', id) });
      for (const id of rw.gear || []) items.push({ kind: 'gear', id, isNew: P.unlock('gear', id) });
      for (const id of rw.feats || []) items.push({ kind: 'feat', id, isNew: P.unlock('feat', id) });
      for (const id of rw.cards || []) items.push({ kind: 'card', id, isNew: P.unlock('card', id) });
      this.story = null;
      if (this.mode !== 'attract') this.startAttract(S.st.chapter.venue);
      A.win();
      $('clearTitle').textContent = first ? S.st.title + ' · 通关' : S.st.title;
      $('clearStars').innerHTML = [0, 1, 2].map((k) => `<svg class="${k < Math.max(1, stars) ? 'on' : ''}" style="animation-delay:${0.2 + k * 0.2}s"><use href="#i-star"/></svg>`).join('');
      const html = items.map((it) => {
        let img = '', name = '', sub = '';
        if (it.kind === 'char') { img = `<img src="${this.charURL(it.id)}" alt="">`; name = YY.charName(it.id); sub = '新角色 · ' + YY.SKILLS[YY.char(it.id).skill].name; }
        else if (it.kind === 'gear') { const g = YY.gear(it.id); img = `<span class="rw-ic g-${g.cat}"><svg><use href="#${g.cat === 'shoe' ? 'i-bolt' : g.cat === 'string' ? 'i-target' : 'i-racket'}"/></svg></span>`; name = g.name; sub = YY.GEAR_CATS[g.cat] + ' · ' + g.spec; }
        else if (it.kind === 'feat') { img = '<span class="rw-ic"><svg><use href="#i-target"/></svg></span>'; name = '自定义磅数'; sub = '可在装备里调整 20–30 磅'; }
        else { const c = YY.card(it.id); img = `<span class="rw-ic card" style="--cc:${YY.CARD_CATS[c.cat][1]}"><svg><use href="#i-cards"/></svg></span>`; name = '图鉴 · ' + c.title; sub = YY.CARD_CATS[c.cat][0] + '知识'; }
        return `<div class="reward ${it.isNew ? 'new' : ''}">${img}<span><b>${name}</b><small>${sub}</small></span>${it.isNew ? '<em>NEW</em>' : ''}</div>`;
      }).join('') || '<p class="note">已领取过本关奖励</p>';
      $('clearRewards').innerHTML = html;
      const idx = YY.STAGES.indexOf(S.st);
      this.clearNextId = YY.STAGES[idx + 1] ? YY.STAGES[idx + 1].id : null;
      $('btnClearNext').classList.toggle('hidden', !this.clearNextId);
      if (this.clearNextId) this.storyChap = YY.STAGES[idx + 1].chapter.id;
      this.show('clear');
    },


    // ---------- 角色与装备 ----------
    renderLoadout() {
      const sel = YY.Profile.sel, id = YY.Profile.has('char', sel.char) ? sel.char : 'lingfeng';
      const c = YY.char(id), sk = YY.SKILLS[c.skill];
      const gear = [sel.racket, sel.string, sel.shoe].map((g) => YY.gear(g) ? YY.gear(g).name : '').join(' · ');
      $('loMe').innerHTML = `<img src="${this.charURL(id)}" alt=""><span><b>${YY.charName(id)} <em style="color:${sk.color}">${sk.name}</em></b><small>${gear} · ${YY.Profile.canTune() ? sel.tension : 24} 磅</small></span>`;
    },
    renderTeam() {
      const P = YY.Profile, sel = P.sel;
      if (!P.has('char', sel.char)) P.choose('char', 'lingfeng');
      this.gearTab = this.gearTab || 'racket';
      const cl = $('charList');
      cl.innerHTML = '';
      for (const c of YY.CHARS) {
        const own = P.has('char', c.id);
        const b = document.createElement('button');
        b.className = 'char-btn' + (c.id === sel.char ? ' on' : '') + (own ? '' : ' locked');
        b.innerHTML = `<img src="${this.charURL(c.id)}" alt=""><span>${own ? YY.charName(c.id) : '？？？'}</span>` + (own ? '' : '<svg class="lk"><use href="#i-lock"/></svg>');
        b.title = own ? YY.charName(c.id) : YY.lockText(c.lock);
        b.addEventListener('click', () => { A.click(); this.teamPeek = c.id; if (own) P.choose('char', c.id); this.renderTeam(); });
        cl.appendChild(b);
      }
      const peek = this.teamPeek && !P.has('char', this.teamPeek) ? this.teamPeek : sel.char;
      const c = YY.char(peek), own = P.has('char', peek), sk = YY.SKILLS[c.skill], lk = YY.lookOf(peek);
      $('charDetail').innerHTML = own
        ? `<div class="cd-head" style="--cc:${lk.shirt}"><b>${lk.name}</b><span>${c.title}</span></div><p>${c.bio}</p>` +
          `<div class="skill-box" style="--sk:${sk.color}"><b><svg><use href="#i-star"/></svg>${sk.name}</b><span>${sk.desc}</span></div>` +
          `<div class="cd-tags">${YY.fxTags(c.fx).map((t) => `<i class="${t.good ? 'g' : 'b'}">${t.text}</i>`).join('') || '<i>各项均衡</i>'}</div>`
        : `<div class="cd-head locked"><b>未解锁角色</b><span>${YY.lockText(c.lock)}</span></div><p>继续推进故事，认识更多伙伴。</p>`;
      // 装备
      const tabs = $('gearTabs');
      tabs.innerHTML = '';
      for (const k of ['racket', 'string', 'tension', 'shoe']) {
        const b = document.createElement('button');
        b.className = 'gtab' + (k === this.gearTab ? ' on' : '');
        b.textContent = YY.GEAR_CATS[k];
        b.addEventListener('click', () => { A.click(); this.gearTab = k; this.renderTeam(); });
        tabs.appendChild(b);
      }
      const list = $('gearList');
      list.innerHTML = '';
      if (this.gearTab === 'tension') {
        const can = P.canTune(), v = can ? sel.tension : 24;
        list.innerHTML = `<div class="tension ${can ? '' : 'locked'}">
          <div class="tn-top"><b id="tnVal">${v}</b><small>磅（lbs）</small></div>
          <input type="range" id="tnRange" min="${YY.TENSION.min}" max="${YY.TENSION.max}" step="1" value="${v}" ${can ? '' : 'disabled'}>
          <div class="tn-scale"><span>20 弹性 · 甜区大</span><span>30 控制 · 吃力量</span></div>
          <p id="tnNote">${can ? YY.tensionNote(v) : '🔒 ' + YY.lockText('2-2') + '：在丁丁的穿线铺学会磅数知识后，就能自己调整磅数。'}</p>
          <div class="cd-tags" id="tnTags"></div></div>`;
        const tags = () => { $('tnTags').innerHTML = YY.fxTags(YY.tensionFx(+$('tnRange').value)).map((t) => `<i class="${t.good ? 'g' : 'b'}">${t.text}</i>`).join(''); };
        tags();
        if (can) $('tnRange').addEventListener('input', (e) => {
          const lbs = +e.target.value;
          $('tnVal').textContent = lbs; $('tnNote').textContent = YY.tensionNote(lbs);
          P.choose('tension', lbs); tags(); this.renderStats();
        });
      } else {
        for (const g of YY.GEAR[this.gearTab]) {
          const own = P.has('gear', g.id), on = sel[this.gearTab] === g.id;
          const b = document.createElement('button');
          b.className = 'gear-item' + (on ? ' on' : '') + (own ? '' : ' locked');
          b.innerHTML = `<span class="gi-top"><b>${own ? g.name : '？？？'}</b><small>${own ? g.spec : YY.lockText(g.lock)}</small></span>` +
            (own ? `<span class="gi-desc">${g.desc}</span><span class="cd-tags">${YY.fxTags(g.fx).map((t) => `<i class="${t.good ? 'g' : 'b'}">${t.text}</i>`).join('') || '<i>标准</i>'}</span>` : '<svg class="lk"><use href="#i-lock"/></svg>');
          b.addEventListener('click', () => { if (!own) return; A.click(); P.choose(this.gearTab, g.id); this.renderTeam(); });
          list.appendChild(b);
        }
      }
      this.renderStats();
    },
    renderStats() {
      const P = YY.Profile, st = P.stats();
      const base = YY.buildStats({ char: P.sel.char, tension: 24 });
      $('statBox').innerHTML = YY.STAT_VIEW.map(([name, f]) => {
        const v = f(st), b = f(base);
        const pct = (x) => clamp((x - 0.75) / 0.5, 0, 1) * 100;
        const diff = Math.round(v * 100) - Math.round(b * 100);
        return `<div class="stat"><label>${name}</label><div class="sbar"><i class="base" style="width:${pct(Math.min(v, b))}%"></i><i class="${diff >= 0 ? 'up' : 'down'}" style="left:${pct(Math.min(v, b))}%;width:${Math.abs(pct(v) - pct(b))}%"></i></div><b>${Math.round(v * 100)}${diff ? `<small class="${diff > 0 ? 'g' : 'b'}">${diff > 0 ? '+' : ''}${diff}</small>` : ''}</b></div>`;
      }).join('');
    },

    // ---------- 图鉴 ----------
    renderCodex() {
      const P = YY.Profile;
      const got = YY.CARDS.filter((c) => P.has('card', c.id)).length;
      $('codexProg').textContent = `已收集 ${got} / ${YY.CARDS.length} 张知识卡 · 在故事中收集更多`;
      const grid = $('codexGrid');
      grid.innerHTML = '';
      const firstNew = YY.CARDS.find((c) => P.has('card', c.id) && !P.d.seen['card:' + c.id]);
      if (!this.codexSel || !P.has('card', this.codexSel)) this.codexSel = (firstNew || YY.CARDS.find((c) => P.has('card', c.id)) || {}).id;
      for (const c of YY.CARDS) {
        const own = P.has('card', c.id), cat = YY.CARD_CATS[c.cat];
        const b = document.createElement('button');
        b.className = 'codex-card' + (own ? '' : ' locked') + (c.id === this.codexSel ? ' on' : '') + (own && !P.d.seen['card:' + c.id] ? ' new' : '');
        b.style.setProperty('--cc', cat[1]);
        b.innerHTML = `<i>${cat[0]}</i><b>${own ? c.title : '？？？'}</b>`;
        b.addEventListener('click', () => { if (!own) return; A.click(); this.codexSel = c.id; this.renderCodex(); });
        grid.appendChild(b);
      }
      const c = this.codexSel && YY.card(this.codexSel);
      if (c) {
        P.d.seen['card:' + c.id] = 1; P.save();
        const cat = YY.CARD_CATS[c.cat];
        $('codexDetail').innerHTML = `<div class="cx-cat" style="--cc:${cat[1]}">${cat[0]}</div><h3>${c.title}</h3><p>${c.text}</p><div class="cx-mm"><img src="${this.maomaoURL()}" alt=""><span>毛毛说：知道得越多，打得越聪明！</span></div>`;
        const source=YY.KNOWLEDGE_SOURCES[c.source];
        if(source){const ref=document.createElement(source.url?'a':'p');ref.className='note';ref.textContent='知识来源：'+source.name;if(source.url){ref.href=source.url;ref.target='_blank';ref.rel='noopener noreferrer';}$('codexDetail').appendChild(ref);}
      } else $('codexDetail').innerHTML = '<p class="note">还没有知识卡。去故事模式里，和毛毛一起冒险吧！</p>';
    },
    updateSkillBtn(m) {
      const b = this._skBtn && this._skBtn.isConnected ? this._skBtn : (this._skBtn = document.querySelector('#touch .t-skill'));
      if (!b || !m || !m.players) return;
      const e = Math.round(m.players[0].energy || 0);
      if (e === this._skE) return;
      this._skE = e;
      const kit = this._kit || [];
      document.querySelectorAll('#touch .t-skill, #touch .t-skill2').forEach((el, i) => {
        const cost = (YY.SKILLS[kit[i]] || {}).cost || 100;
        el.style.setProperty('--e', Math.min(100, e / cost * 100) + '%');
        el.classList.toggle('ready', e >= cost);
      });
    },

    render(dt) {
      const R = this.R;
      if (this.screen === 'dialog' && this.dlg && this.dlg.i >= 0) {
        const view = this.storyView(this.dlg, !!this.dlg.typing);
        if (view) { R.drawStory(view, dt); return; }
      }
      if (this.mode === 'guest') {
        const v = this.view;
        v.update();
        for (const e of v.events.splice(0)) this.handleEvent(e, v);
        R.draw(v, {
          rawDt: this.rawDt,
          padLeft: 46,
          labels: [null, '你'],
          meterFor: [1],
          serveLabel: YY.isTouch() ? '点「高远」或「吊球」发球' : 'J 发高远球 · K 发网前球',
          landHint: this.settings.hint ? [1] : null,
          waitText: this.netWait,
        }, dt);
        if (v.phase === 'over' && !this.resultShown && v.stats) { this.resultShown = true; setTimeout(() => { this.resultShown = false; this.showResult(v); }, 900); }
        $('netInfo').textContent = YY.Net.statusText(this.guestRtt, this.view.delay);
        $('netInfo').title = YY.Net.diagnostics();
        return;
      }
      const m = this.match;
      const o = { padLeft: 46 };
      const touch = YY.isTouch();
      if (this.mode === 'attract') o.noHud = true;
      else if (this.mode === 'story') {
        const k = this.storyKind;
        o.labels = ['你', null];
        if (k === 'match') {
          o.meterFor = [0];
          o.serveLabel = touch ? '点「高远」或「吊球」发球' : 'J 发高远球 · K 发网前球';
          o.landHint = this.settings.hint ? [0] : null;
          const d = this.storyDark;
          if (d) {
            if (!this.paused) { d.t -= dt; if (d.t <= 0) { d.flash = 1; d.t = 4 + Math.random() * 5; } d.flash = Math.max(0, d.flash - dt * 3.2); }
            o.dark = d;
          }
        } else {
          o.practice = this.practice;
          if (k === 'drill') { o.hintIdx = 0; o.zone = this.practice.def.zone; }
          else if (k === 'footwork') o.marks = this.practice.marks;
          else if (k === 'serve') { o.zone = this.practice.def.zone; o.meterFor = [0]; o.serveLabel = touch ? '点「吊球」发网前球' : 'K 发网前球（J 为高远）'; }
        }
        this.updateSkillBtn(m);
      } else if (this.mode === 'practice') {
        o.practice = this.practice;
        o.hintIdx = 0;
        o.zone = this.practice.def.zone;
        o.labels = ['你', this.practice.tutorial ? '战术陪练' : null];
        o.overlayText = touch ? '' : 'A/D 移动 · W 跳 · J 高远 · K 吊球 · L 扣杀 · Esc 暂停';
      } else {
        const solo = touch ? '点「高远」或「吊球」发球' : 'J 发高远球 · K 发网前球';
        if (this.mode === 'local') {
          o.labels = ['P1', 'P2'];
          o.meterFor = [0, 1];
          o.serveLabel = touch ? '点「高远」或「吊球」发球' : (m.server === 0 ? 'F 高远发球 · G 网前发球' : ', 高远发球 · . 网前发球');
          o.landHint = this.settings.hint ? [0, 1] : null;
        } else {
          o.labels = ['你', null];
          o.meterFor = [0];
          o.serveLabel = solo;
          o.landHint = this.settings.hint ? [0] : null;
        }
        if (this.mode === 'host') { $('netInfo').textContent = YY.Net.statusText(); $('netInfo').title = YY.Net.diagnostics(); }
        if (this.mode === 'ai') this.updateSkillBtn(m);
        if (!touch && m.score[0] + m.score[1] === 0 && m.phase !== 'over' && this.mode !== 'local') o.overlayText = 'A/D 移动 · W 跳 · J 高远 · K 吊球 · L 扣杀 · Esc 暂停';
      }
      if (this.mode === 'host') o.waitText = this.netWait;
      o.rawDt = this.rawDt;
      // 暂停时画面不变：只重绘一次，省电也避免后台持续占用显卡
      if (this.paused) { if (this.pausedDrawn) return; this.pausedDrawn = true; }
      else this.pausedDrawn = false;
      R.draw(m, o, this.paused ? 0 : dt);
    },
  };

  G.App = App;
  G.addEventListener('DOMContentLoaded', () => App.init());
})(window);
