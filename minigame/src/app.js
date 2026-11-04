'use strict';
const { Input, HumanCtrl } = require('./input');
const UI = require('./ui');
const Network = require('./network');
const createPrediction = require('./prediction');

module.exports = function createApp(YY, platform, canvas, config) {
  const P = platform, A = YY.Audio;
  const app = {
    mode: 'attract', screen: 'menu', match: null, practice: null, story: null,
    ais: [], ctrlFor: [null, null], paused: false, epoch: 0, elapsed: 0,
    deferred: [], acc: 0, tickN: 0, resultShown: false, level: 'normal', drill: 'receive',
    settings: Object.assign({ sound: true, hint: true, skills: true, haptics: true, venue: 'random' }, P.read('yuyue.settings', {})),
    init() {
      this.R = new YY.Renderer(canvas); this.R.touch = true; this.R.hudK = 1.3; this.R.resize();
      this.ui = new UI(YY, this, P);
      this.input = new Input(P.wx, {
        point: (x, y) => this.ui.point(x, y), playing: () => this.inGame() && !this.screen && !this.paused && !P.hidden() && !this.ui.isPortrait,
        changed: () => { if (this.isOnline() && !this.screen && !P.hidden()) this.sendInput(); },
        unlock: () => A.init(), feedback: () => { if (this.settings.haptics) P.vibrate(); },
        pause: () => this.togglePause(),
        start: (id, p) => this.ui.touchStart(id, p), move: (id, p) => this.ui.touchMove(id, p), end: (id, p, cancelled) => this.ui.touchEnd(id, p, cancelled), cancel: () => this.ui.cancel(),
      });
      YY.Input = this.input;
      this.net = new Network(P, config);
      this.Prediction = createPrediction(YY, this.net);
      this.net.onStart = d => this.startOnline(d);
      this.net.onMessage = d => this.serverMessage(d);
      this.net.onStatus = message => { this.lobbyStatus = message; };
      this.net.onEnd = message => { this.startAttract(); this.message('连接已结束', message, 'friend'); };
      A.enabled = this.settings.sound !== false;
      this.startAttract(); this.show('menu');
      P.wx.onHide(() => this.hide());
      P.wx.onShow(options => this.wake(options));
      P.wx.onWindowResize?.(() => this.resize());
      P.wx.onMemoryWarning?.(() => { this.R.quality = 0; this.R.portraitCache.clear(); this.ui.portraits.clear(); this.R.resize(); });
      P.wx.onNetworkStatusChange?.(event => { if (!event.isConnected && this.isOnline()) this.lobbyStatus = '网络已断开，正在等待恢复'; });
      P.wx.showShareMenu?.({ menus: ['shareAppMessage'] });
      P.wx.onShareAppMessage?.(() => ({ title: this.net.code ? `羽跃对决｜房间 ${this.net.code}，等你来挑战` : config.shareTitle, query: this.net.code ? `room=${this.net.code}` : '', imageUrl: 'assets/images/icon.png' }));
      this.last = P.now();
      const launch = P.wx.getLaunchOptionsSync?.();
      this.invite(launch?.query?.room);
      this.running = true;
      this.frame();
      return this;
    },
    defer(fn, ms) { this.deferred.push({ fn, at: this.elapsed + ms / 1000, epoch: this.epoch }); },
    show(screen) {
      this.input?.releaseAll(); this.screen = screen; this.ui?.reset();
      if (screen === 'story' && !this.storyChap) this.storyChap = (YY.STAGES.find(s => !YY.Profile.stars(s.id)) || YY.STAGES[0]).chapter.id;
      if (screen === 'team') this.teamPeek = this.teamPeek || YY.Profile.sel.char;
      if (screen === 'codex') this.codexSel = this.codexSel || YY.Profile.d.cards[0];
    },
    message(title, text, back = 'menu') { this.messageData = { title, text, back }; this.show('message'); },
    saveSettings() { P.write('yuyue.settings', this.settings); A.enabled = this.settings.sound; },
    setVenueSetting(id) { this.settings.venue = id; this.saveSettings(); if (YY.VENUES[id]) this.R.setVenue(id); },
    pickVenue() { const ids = YY.VENUE_IDS; return YY.VENUES[this.settings.venue] ? this.settings.venue : ids[Math.floor(Math.random() * ids.length)]; },
    inGame() { return this.mode !== 'attract'; },
    isOnline() { return this.mode === 'online'; },
    isMe(i) { return this.mode === 'local' || i === (this.isOnline() ? this.playerIndex : 0); },
    playerName(i, m) { return this.isOnline() ? (i === this.playerIndex ? '你' : '好友') : m.names[i]; },
    reset() {
      this.epoch++; this.deferred = []; this.acc = 0; this.elapsed = 0;
      this.ais = []; this.ctrlFor = [null, null]; this.practice = null; this.view = null;
      this.paused = false; this.resultShown = false; this.result = null; this.storyDark = null;
      this.R.mirror = false; this.R.clearFx(); this.input.setCtrls([]);
      this.last = P.now();
    },
    enterGame(venue) {
      this.show(null); this.R.setVenue(venue || this.pickVenue());
      this.started = P.now(); this.ui.layoutControls();
    },
    startAttract(venue) {
      this.reset(); this.mode = 'attract';
      this.match = new YY.Match({ names: YY.LOOKS.map(l => l.name), firstServer: 0 });
      this.ais = [new YY.AI(this.match, 0, 'hard'), new YY.AI(this.match, 1, 'normal')];
      this.R.setVenue(venue || this.pickVenue());
    },
    soloCtrl(netRight, skill) {
      const c = new HumanCtrl(netRight); this.input.setCtrls([c], 'solo', skill); return c;
    },
    startLocal() {
      this.reset(); this.mode = 'local';
      this.match = new YY.Match({ names: ['P1 红方', 'P2 蓝方'], firstServer: 0 });
      this.ctrlFor = [new HumanCtrl(true), new HumanCtrl(false)];
      this.input.setCtrls(this.ctrlFor, 'duo'); this.enterGame();
      this.R.showBanner('同屏对战', '左右两侧各一套按键 · 双方能力相同', '#ffd23f', 2.5);
    },
    quit() {
      this.net.close(); const story = !!this.story || this.mode === 'story';
      this.story = null; this.dlg = null; this.quiz = null;
      this.startAttract(); this.show(story ? 'story' : 'menu');
    },
    restart() {
      if (this.isOnline()) { this.net.send({ t: 'rematch' }); this.result.note = '已请求再来一局，等待好友确认'; return; }
      if (this.mode === 'story') return this.stepRetry();
      if (this.mode === 'local') return this.startLocal();
      if (this.mode === 'practice') return this.startPractice(this.drill);
      return this.startAI(this.level);
    },
    togglePause() {
      if (!this.inGame() || (this.screen && this.screen !== 'pause' && this.screen !== 'help')) return;
      this.paused = !this.paused;
      this.show(this.paused ? 'pause' : null);
      if (this.isOnline()) { this.net.active = !this.paused; if (this.paused) this.net.send({ t: 'away' }); else this.sendInput(); }
      this.last = P.now(); this.acc = 0;
    },
    hide() {
      P.setHidden(true); this.input.releaseAll(); A.stop(); this.acc = 0;
      this.net.active = false; if (this.net.code) this.net.send({ t: 'away' });
      if (this.inGame() && !this.screen) { this.paused = true; this.show('pause'); }
    },
    wake(options) {
      P.setHidden(false); this.last = P.now(); this.acc = 0;
      this.resize(); this.net.active = !this.paused; this.net.wake();
      this.invite(options?.query?.room);
      if (this.running && this.raf == null) this.frame();
    },
    resize() {
      this.input.releaseAll(); this.R.resize(); this.ui.resize(); this.ui.layoutControls(); this.last = P.now(); this.acc = 0;
      if (this.ui.isPortrait && this.inGame() && !this.screen && !this.paused) this.togglePause();
    },
    invite(room) {
      if (!room || room === this.net.code) return;
      room = String(room).toUpperCase(); if (!/^[A-Z2-9]{4}$/.test(room)) return;
      const enter = () => { this.story = null; this.joinOnline(room); };
      if (this.inGame()) P.confirm('加入好友房间', '将离开当前对局，加入好友邀请。', enter); else enter();
    },
    playDialog(lines, done) { this.dlg = { lines, i: 0, done, progress: 0 }; this.show('dialog'); },
    dlgAdvance() {
      const d = this.dlg; if (!d) return;
      const text = d.lines[d.i][1];
      if (d.progress < text.length) { d.progress = text.length; return; }
      if (++d.i >= d.lines.length) return this.dlgFinish();
      d.progress = 0;
    },
    dlgFinish() { const d = this.dlg; if (d) { this.dlg = null; d.done(); } },
    playQuiz(step) { this.quiz = { step, i: 0, right: 0, answered: false }; this.show('quiz'); },
    playPick(step) {
      this.quiz = { step: { qs: [{ q: step.q, o: step.o.map(o => o.label), a: step.o.findIndex(o => o.ok), exp: step.exp }], need: 0 }, i: 0, right: 0, answered: false, pick: step };
      this.show('quiz');
    },
    quizAnswer(index) {
      const q = this.quiz; if (!q || q.answered) return;
      const question = q.step.qs[q.i]; if (!question.o[index]) return;
      q.selected = index; q.answered = true; q.correct = index === question.a;
      if (q.correct) { q.right++; A.ready(); } else A.lose();
      if (q.pick) { const choice = q.pick.o[index]; this.story.ctx.pickOk = !!choice.ok; this.story.ctx.env = choice.env ? { ...choice.env } : null; }
      this.ui.reset();
    },
    quizNext() {
      const q = this.quiz; if (!q?.answered) return;
      if (q.pick) { this.quiz = null; return this.nextStep(); }
      if (q.i + 1 < q.step.qs.length) { q.i++; q.answered = false; this.ui.reset(); return; }
      const total = q.step.qs.length, win = q.right >= q.step.need;
      this.quiz = null;
      this.showStepResult({ win, stars: !win ? 0 : q.right === total ? 3 : q.right === total - 1 ? 2 : 1, main: `答对 ${q.right} / ${total} 题`, goals: [{ text: `答对 ${q.step.need} 题过关`, ok: win }, { text: '全部答对', ok: q.right === total }] });
    },
    showStepResult(result) { this.stepRes = result; this.paused = true; this.show('step'); },
    finishStage() {
      const s = this.story, p = YY.Profile;
      const stars = Math.max(1, s.stars.length ? Math.min(...s.stars) : 3);
      p.setStars(s.st.id, stars);
      const rewards = [];
      for (const [plural, kind] of [['chars', 'char'], ['gear', 'gear'], ['cards', 'card'], ['feats', 'feat']]) for (const id of s.st.rewards?.[plural] || []) {
        rewards.push({ kind, id, isNew: p.unlock(kind, id), name: kind === 'char' ? YY.charName(id) : kind === 'gear' ? YY.gear(id).name : kind === 'card' ? '图鉴 · ' + YY.card(id).title : '自定义磅数' });
      }
      const next = YY.STAGES[YY.STAGES.indexOf(s.st) + 1];
      this.clearNextId = next?.id; this.storyChap = next?.chapter.id || s.st.chapter.id;
      this.clearResult = { title: s.st.title, stars, rewards };
      this.story = null; this.startAttract(s.st.chapter.venue); A.win(); this.show('clear');
    },
    showResult(m) {
      if (this.resultShown || !this.inGame()) return;
      this.resultShown = true; const me = this.isOnline() ? this.playerIndex : 0;
      const order = this.isOnline() && me === 1 ? [1, 0] : [0, 1];
      const won = this.mode === 'local' || m.winner === me;
      this.result = { title: this.mode === 'local' ? m.names[m.winner] + ' 获胜' : won ? '胜利！' : '惜败', won, score: order.map(i => m.score[i]), names: order.map(i => this.playerName(i, m)), stats: order.map(i => m.stats?.[i] || {}), longest: m.longest, seconds: Math.round((P.now() - this.started) / 1000), note: this.tip(m.stats?.[me], m.stats?.[1 - me] || {}) };
      if (won) A.win(); else A.lose(); this.paused = !this.isOnline(); this.show('result');
    },
    async hostOnline() { return this.connectOnline({ t: 'create', venue: this.pickVenue() }); },
    async joinOnline(room) { if (!/^[A-Z2-9]{4}$/.test(room)) return P.toast('请输入 4 位房间码'); return this.connectOnline({ t: 'join', room }); },
    async connectOnline(request) {
      if (!this.net.configured()) return this.message('好友对战即将开放', '现在可以体验快速对战、故事模式，或和身边的好友同屏切磋。', 'friend');
      this.net.close(); this.story = null; this.startAttract(); this.show('lobby');
      this.lobbyStatus = '正在连接比赛服务器…'; const epoch = this.epoch;
      try { await this.net.connect(request); if (this.screen === 'lobby') this.lobbyStatus = '房间已就绪，邀请好友加入即可开始'; }
      catch (e) { if (this.epoch === epoch && this.screen === 'lobby') this.message('连接失败', e.message, 'friend'); }
    },
    startOnline(d) {
      const resume = this.isOnline() && this.matchId === d.matchId;
      if (!resume) {
        this.reset(); this.mode = 'online'; this.match = null;
        this.playerIndex = this.net.player; this.matchId = d.matchId;
        this.ctrlFor[this.playerIndex] = this.soloCtrl(true); this.enterGame(d.venue);
        this.R.mirror = this.playerIndex === 1;
      }
      this.view = new YY.GuestView(); this.view.names = ['红方', '蓝方'];
      this.predictor = new this.Prediction(this.playerIndex);
      this.lastEventId = resume ? this.lastEventId : 0; this.serverWait = null;
      this.sendT = 0; this.lastMove = null; this.net.active = !this.paused; this.sendInput();
      if (this.paused) this.net.send({ t: 'away' });
    },
    serverMessage(d) {
      if (d.t === 'notice') { if (this.result) this.result.note = d.message; else P.toast(d.message); return; }
      if (!this.isOnline() || d.t !== 'st' || d.matchId !== this.matchId) return;
      this.serverWait = d.wait;
      d.ev = (d.ev || []).filter(e => e.id > this.lastEventId);
      for (const e of d.ev) this.lastEventId = Math.max(this.lastEventId, e.id);
      this.view.push(d, P.now() / 1000); this.view.stats = d.stats; this.view.longest = d.longest;
      this.predictor.snapshot(d);
    },
    sendInput() {
      if (!this.isOnline() || !this.net.active || P.hidden() || this.paused) return;
      const c = this.ctrlFor[this.playerIndex]; if (!c) return;
      const presses = c.drain().filter(btn => btn !== 'skill').map(btn => ({ id: ++this.net.action, btn }));
      const move = this.screen ? 0 : c.move();
      if (presses.length || move !== this.lastMove || this.sendT <= 0) {
        const packet = { t: 'in', matchId: this.matchId, seq: ++this.net.seq, move, presses };
        if (this.net.send(packet)) this.predictor?.input(packet);
        this.lastMove = move; this.sendT = .05;
      }
    },
    tick(dt) {
      this.tickN++;
      if (this.isOnline()) { this.sendT -= dt; if (this.sendT <= 0) this.sendInput(); return; }
      const m = this.match; if (!m) return;
      for (let i = 0; i < 2; i++) if (this.ctrlFor[i]) { m.inputs[i].move = this.ctrlFor[i].move(); for (const btn of this.ctrlFor[i].drain()) m.inputs[i].presses.push({ btn }); }
      this.ais.forEach(ai => ai.update(dt)); this.practice?.update(dt); m.step(dt);
      for (const e of m.events.splice(0)) { this.practice?.onEvent(e); if (this.mode === 'attract') this.attractEvent(e, m); else this.handleEvent(e, m); }
      if (this.mode === 'attract' && m.phase === 'over') this.startAttract();
    },
    render(dt) {
      const m = this.isOnline() ? this.view : this.match; if (!m) return;
      if (this.isOnline()) {
        m.update(P.now() / 1000); m.names = ['红方', '蓝方'];
        this.predictor?.apply(m, dt);
        for (const e of m.events.splice(0)) this.handleEvent(e, m);
        if (m.phase === 'over' && m.stats && !this.resultShown && !this.deferred.some(t => t.result)) { this.defer(() => this.showResult(m), 1000); this.deferred[this.deferred.length - 1].result = true; }
      }
      const me = this.isOnline() ? this.playerIndex : 0;
      const o = { rawDt: this.rawDt, padLeft: 56, labels: me === 1 ? [null, '你'] : ['你', null], meterFor: [me], serveLabel: '点「高远」或「吊球」发球', landHint: this.settings.hint ? [me] : null };
      if (this.mode === 'attract') { o.noHud = true; o.meterFor = []; o.labels = null; o.landHint = null; }
      if (this.mode === 'local') { o.labels = ['P1', 'P2']; o.meterFor = [0, 1]; o.landHint = this.settings.hint ? [0, 1] : null; }
      if (this.practice) {
        o.practice = this.practice; o.zone = this.practice.def.zone; o.landHint = null;
        if (this.practice instanceof YY.Footwork) { o.marks = this.practice.marks; o.meterFor = []; }
        else if (this.practice instanceof YY.ServeDrill) o.serveLabel = '点「吊球」发网前球';
        else { o.hintIdx = 0; o.meterFor = []; }
      }
      if (this.storyDark) { const d = this.storyDark; if (!this.paused) { d.t -= dt; if (d.t <= 0) { d.flash = 1; d.t = 4 + Math.random() * 5; } d.flash = Math.max(0, d.flash - dt * 3.2); } o.dark = d; }
      if (this.isOnline()) o.waitText = this.net.status === 'reconnecting' ? '网络中断，正在重新连接…' : this.serverWait;
      this.R.draw(m, o, this.paused ? 0 : dt);
    },
    frame() {
      this.raf = null;
      if (!this.running || P.hidden()) return;
      const now = P.now(); this.rawDt = Math.max(0, (now - this.last) / 1000); this.last = now;
      const dt = Math.min(.05, this.rawDt);
      if (!this.paused) {
        this.elapsed += dt; this.acc += dt;
        let n = 0; while (this.acc >= YY.C.DT && n++ < 12) { this.tick(YY.C.DT); this.acc -= YY.C.DT; }
        if (n >= 12) this.acc = 0;
        const due = this.deferred.filter(t => t.at <= this.elapsed); this.deferred = this.deferred.filter(t => t.at > this.elapsed);
        for (const timer of due) if (timer.epoch === this.epoch) timer.fn();
      }
      if (this.dlg && this.screen === 'dialog') this.dlg.progress += dt * 38;
      this.net.update(); this.render(dt); this.ui.draw();
      if (P.takeStorageError()) P.toast('进度保存失败，请检查设备存储空间');
      this.raf = requestAnimationFrame(() => this.frame());
    },
    destroy() { this.running = false; if (this.raf != null) cancelAnimationFrame(this.raf); this.net.close(); this.input.releaseAll(); A.stop(); },
  };
  Object.assign(app, YY.createGameplay((fn, ms) => app.defer(fn, ms)));
  const startStage = app.startStage;
  app.startStage = function (id) { if (YY.stage(id) && YY.stageOpen(id)) { this.net.close(); startStage.call(this, id); } };
  const stepContinue = app.stepContinue;
  app.stepContinue = function () { if (this.stepRes?.win) stepContinue.call(this); };
  YY.isTouch = () => true;
  return app;
};
