/* 羽跃对决 · 应用入口：模式管理、界面、主循环 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const $ = (id) => document.getElementById(id);
  const A = YY.Audio;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('yuyue.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('yuyue.' + k, JSON.stringify(v)); } catch (_) {} },
  };

  const App = {
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
    settings: { sound: store.get('sound', true), hint: store.get('hint', true), venue: store.get('venue', 'random') },
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
      this.R = new YY.Renderer(this.cv);
      this.R.touch = YY.isTouch();
      this.R.resize();
      YY.Input.init();
      YY.Input.onAny = (e) => {
        if ((e.code === 'Escape' || e.code === 'KeyP') && this.inGame()) { this.togglePause(); return true; }
        return false;
      };
      A.enabled = this.settings.sound;
      this.bindUI();
      this.buildMenuArt();
      G.addEventListener('resize', () => { this.R.resize(); this.checkRotate(); });
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
      $('rotate').classList.toggle('hidden', !(YY.isTouch() && portrait && !this.rotateOk));
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
    enterGame() {
      this.show(null);
      $('btnPause').classList.remove('hidden');
      if (this.R.touch !== YY.isTouch()) { this.R.touch = YY.isTouch(); this.R.resize(); }
      if (this.mode !== 'guest') this.R.setVenue(this.pickVenue());
      this.started = performance.now();
    },
    startAttract() {
      this.reset();
      this.mode = 'attract';
      this.match = new YY.Match({ names: YY.LOOKS.map((l) => l.name), firstServer: Math.random() < 0.5 ? 0 : 1 });
      this.ais = [new YY.AI(this.match, 0, 'hard'), new YY.AI(this.match, 1, 'normal')];
      this.R.setVenue(YY.VENUE_IDS[(YY.VENUE_IDS.indexOf(this.R.venueId) + 1) % YY.VENUE_IDS.length]);
      const mv = document.getElementById('menuVenue');
      if (mv) mv.textContent = YY.VENUES[this.R.venueId].name;
      $('btnPause').classList.add('hidden');
    },
    soloCtrl(netRight) {
      const c = new YY.HumanCtrl(YY.KEYMAPS.solo, netRight);
      YY.Input.setCtrls([c]);
      if (YY.isTouch()) YY.buildTouch($('touch'), [c], 'solo');
      return c;
    },
    startAI(level) {
      this.reset();
      this.mode = 'ai';
      this.level = level;
      const lv = YY.AI_LEVELS[level];
      this.match = new YY.Match({ names: ['你', 'AI · ' + lv.name], firstServer: 0 });
      this.ais = [new YY.AI(this.match, 1, level)];
      this.ctrlFor[0] = this.soloCtrl(true);
      this.enterGame();
      this.R.showBanner('快速对战 · ' + lv.name, '7 分制 · 需领先 2 分 · 10:10 后先得 11 分获胜', '#ffd23f', 2.2);
    },
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
    startPractice(drill) {
      this.reset();
      this.mode = 'practice';
      this.drill = drill;
      this.match = new YY.Match({ names: ['你', '发球机'], practice: true });
      this.practice = new YY.Practice(this.match, drill);
      this.ctrlFor[0] = this.soloCtrl(true);
      this.enterGame();
    },
    restart() {
      if (this.mode === 'ai') this.startAI(this.level);
      else if (this.mode === 'local') this.startLocal();
      else if (this.mode === 'practice') this.startPractice(this.drill);
      else if (this.mode === 'host') this.hostRestart();
      else if (this.mode === 'guest') { YY.Net.send({ t: 'rematch' }); this.show(null); }
    },
    again() { this.restart(); },
    quit() {
      if (this.isOnline()) YY.Net.close();
      this.startAttract();
      this.show('menu');
    },
    togglePause() {
      if (!this.inGame() || this.screen === 'result') return;
      if (this.isOnline()) {
        // 在线模式不暂停模拟，只打开菜单
        if (this.screen === 'pause') this.show(null); else this.show('pause');
        $('btnRestart').classList.add('hidden');
        return;
      }
      $('btnRestart').classList.remove('hidden');
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
        $('lobbyStatus').textContent = '把房间码告诉好友，或复制邀请链接发送。等待好友加入…';
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
      $('lobbyStatus').textContent = '正在连接房主…';
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
      if (!this.paused) {
        this.acc = (this.acc || 0) + dt;
        let n = 0;
        while (this.acc >= C.DT && n < 12) { this.tick(C.DT); this.acc -= C.DT; n++; }
        if (n >= 12) this.acc = 0;
      }
      this.render(dt);
      requestAnimationFrame((t) => this.frame(t));
    },
    tick(dt) {
      this.tickN++;
      if (this.mode === 'guest') {
        const c = this.ctrlFor[1];
        for (const a of c.drain()) this.guestCounts[['jump', 'clear', 'drop', 'smash'].indexOf(a)]++;
        this.sendT -= dt;
        const mv = c.move();
        if (this.sendT <= 0 || mv !== this.lastMv || this.guestCounts.join() !== this.lastCounts) {
          YY.Net.send({ t: 'in', m: mv, c: this.guestCounts.slice() });
          this.lastMv = mv; this.lastCounts = this.guestCounts.join(); this.sendT = 0.05;
        }
        return;
      }
      const m = this.match;
      if (this.mode === 'host' && this.netWait) {
        // 好友无响应：冻结比赛，丢弃期间的按键，仅保持心跳与快照
        if (this.ctrlFor[0]) this.ctrlFor[0].drain();
        if (this.remote) this.remote.queue.length = 0;
        if (this.tickN % 30 === 0) YY.Net.send(YY.snapshot(m, []));
        if (this.tickN % 120 === 0) YY.Net.ping();
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
      if (this.mode === 'host' && this.tickN % 2 === 0) { // 60Hz 快照
        const sn = YY.snapshot(m, this.netEvents);
        sn.vn = this.R.venueId;
        if (m.phase === 'over') { sn.stats = m.stats; sn.longest = m.longest; }
        YY.Net.send(sn);
        this.netEvents = [];
        this.pingTimer -= dt * 2;
        if (this.pingTimer <= 0) { YY.Net.ping(); this.pingTimer = 1; }
      }
    },
    attractEvent(e, m) {
      // 背景演示：只保留视觉效果
      const R = this.R;
      if (e.type === 'hit') { R.hitFx(e); if (e.shot === 'smash') { R.shake = 0.4; R.flash = 0.08; } }
      if (e.type === 'net') R.netFx(e);
      if (e.type === 'point') { R.landFx(e.x, e.inB); R.pointFx(e.winner, m, '得分！'); }
      if (e.type === 'jump') R.dust(m.players[e.p].x, 4);
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

    handleEvent(e, m) {
      const R = this.R;
      const P = m.players;
      switch (e.type) {
        case 'hit': {
          if (e.feed) { A.hit(0.5, false); break; }
          const smash = e.shot === 'smash';
          A.hit(e.q, smash);
          R.hitFx(e);
          const p = P[e.p];
          if (smash) {
            R.popText('扣杀 ' + Math.round(e.speed * 3.6 * C.SPEED_DISPLAY) + ' km/h', e.x, e.y + 0.3, '#ffb347', 1.35, 1.2);
          } else if (!e.serve || this.isMe(e.p)) {
            const col = e.q >= 0.85 ? '#7dffb0' : e.q >= 0.6 ? '#ffffff' : e.q >= 0.35 ? '#ffd23f' : '#ff9b7b';
            const show = this.isMe(e.p) || e.q >= 0.85 || e.weak;
            if (show) R.popText(e.name + (e.label ? ' · ' + e.label : ''), p.x, p.y + 2.25, col, 0.75, 1.0);
          }
          if (e.reason && this.isMe(e.p)) R.popText(e.reason + ' → ' + e.name, p.x, p.y + 2.75, '#ff9b7b', 0.7, 1.4);
          if (e.save) { R.popText('漂亮接杀！', p.x, p.y + 2.8, '#5cf2ff', 1.1, 1.3); A.cheer(false); }
          else if (e.lowSave) R.popText('极限救球！', p.x, p.y + 2.8, '#5cf2ff', 1.0, 1.2);
          break;
        }
        case 'swing': A.swing(); break;
        case 'whiff': { const p = P[e.p]; if (this.isMe(e.p) || this.mode === 'practice') R.popText(e.label, p.x, p.y + 2.3, '#ff7b7b', 0.8, 1.1); break; }
        case 'net': A.net(); R.netFx(e); break;
        case 'jump': A.jump(); R.dust(P[e.p].x, 5); break;
        case 'land': R.dust(P[e.p].x, 3); break;
        case 'tired': if (this.isMe(e.p)) R.popText('体力不足 · 跳不高', P[e.p].x, P[e.p].y + 2.3, '#ff9b7b', 0.75, 1.1); break;
        case 'read': R.popText('预判！', P[e.p].x, P[e.p].y + 2.3, '#ffd23f', 0.8, 1.0); break;
        case 'serveReady': R.trail = []; R.lastWinner = -1; break;
        case 'point': {
          A.floor(); A.whistle();
          R.landFx(e.x, e.inB);
          const meWon = this.isMe(e.winner) && this.mode !== 'local';
          const name = this.playerName(e.winner, m);
          let title;
          if (this.mode === 'local') title = name + ' 得分';
          else title = meWon ? '得分！' : '失分';
          A.cheer(e.kind === 'winner' && (meWon || this.mode === 'local'));
          let sub = e.reason;
          if (e.rally >= 8) sub += ' · ' + e.rally + ' 拍回合';
          if (e.banner) sub += ' · ' + e.banner;
          R.showBanner(title, sub, YY.LOOKS[e.winner].shirt, 1.7);
          R.pointFx(e.winner, m, this.mode === 'local' ? name + ' 得分' : meWon ? '漂亮！' : name + ' 得分');
          break;
        }
        case 'pland': A.floor(); R.landFx(e.x, e.inB); break;
        case 'pres': if (e.ok) A.cheer(false); break;
        case 'over': {
          const meWin = this.mode === 'local' || this.isMe(e.winner);
          R.victoryFx(e.winner, m, this.mode === 'local' ? this.playerName(e.winner, m) + ' 获胜' : meWin ? '胜利！' : this.playerName(e.winner, m) + ' 获胜');
          setTimeout(() => this.showResult(m), 1200);
          break;
        }
      }
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
      $('resAvA').src = this.portraitURL(order[0]); $('resAvB').src = this.portraitURL(order[1]);
      $('resNameA').textContent = this.playerName(order[0], m); $('resNameB').textContent = this.playerName(order[1], m);
      $('resNameA').style.color = YY.LOOKS[order[0]].shirt; $('resNameB').style.color = YY.LOOKS[order[1]].shirt;
      const st = m.stats || [{}, {}];
      const rows = [['击球', 'hits'], ['完美击球', 'perfect'], ['扣杀', 'smash'], ['扣杀得分', 'smashWin'], ['致胜球', 'winners'], ['失误', 'errors'], ['救球', 'saves']];
      const la = YY.LOOKS[order[0]], lb = YY.LOOKS[order[1]];
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
    portraitURL(i) {
      this._pu = this._pu || [];
      if (!this._pu[i]) this._pu[i] = YY.portrait(YY.LOOKS[i], 160).toDataURL();
      return this._pu[i];
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
      document.querySelectorAll('.ai-face').forEach((el) => { el.style.backgroundImage = `url(${this.portraitURL(+el.dataset.look || 1)})`; });
    },
    tip(me, op) {
      if (!me) return '';
      if (me.errors >= 4 && me.errors > me.winners) return '提示：失误偏多。不急着扣杀，先用高远球把对手压到后场，等机会出现。';
      if (me.smash === 0) return '提示：对手挑出高球时，先起跳（W/跳）再按扣杀，能打出最有威胁的进攻。';
      if (me.smash > 0 && me.smashWin / me.smash < 0.3) return '提示：扣杀容易被接回。先吊网前把对手调上来，再扣他身后的空当。';
      if (op.smashWin >= 3) return '提示：被扣杀得分较多。回球后及时回到中场，少打半高不远的球。';
      if (me.perfect < me.hits * 0.25) return '提示：提前移动到落点，挥拍时机再晚一点点，可以打出更多“完美”击球。';
      return '提示：试试“高远 → 吊球 → 扣杀”的组合，主动调动对手制造空当。';
    },

    render(dt) {
      const R = this.R;
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
        $('netInfo').textContent = '延迟 ' + Math.round((this.guestRtt || 0) * 1000) + ' ms';
        return;
      }
      const m = this.match;
      const o = { padLeft: 46 };
      const touch = YY.isTouch();
      if (this.mode === 'attract') o.noHud = true;
      else if (this.mode === 'practice') {
        o.practice = this.practice;
        o.hintIdx = 0;
        o.zone = this.practice.def.zone;
        o.labels = ['你', null];
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
        if (this.mode === 'host') $('netInfo').textContent = '延迟 ' + Math.round(YY.Net.rtt * 1000) + ' ms';
        if (!touch && m.score[0] + m.score[1] === 0 && m.phase !== 'over' && this.mode !== 'local') o.overlayText = 'A/D 移动 · W 跳 · J 高远 · K 吊球 · L 扣杀 · Esc 暂停';
      }
      if (this.mode === 'host') o.waitText = this.netWait;
      o.rawDt = this.rawDt;
      R.draw(m, o, this.paused ? 0 : dt);
    },
  };

  G.App = App;
  G.addEventListener('DOMContentLoaded', () => App.init());
})(window);
