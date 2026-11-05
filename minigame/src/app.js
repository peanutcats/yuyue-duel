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
    settings: Object.assign({ sound: true, voice: true, hint: true, skills: true, haptics: true, venue: 'random' }, P.read('yuyue.settings', {})),
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
      this.net.onEnd = message => { this.roomState = null; this.startAttract(); this.message('连接已结束', message, 'friend'); };
      A.enabled = this.settings.sound !== false;
      A.init(); // Prime short local clips before entering the first rally; no sound is played.
      this.startAttract(); this.show('menu');
      P.wx.onHide(() => this.hide());
      P.wx.onShow(options => this.wake(options));
      P.wx.onWindowResize?.(() => this.resize());
      P.wx.onMemoryWarning?.(() => { this.R.quality = 0; this.R.portraitCache.clear(); this.ui.portraits.clear(); this.R.resize(); A.releaseCache(); });
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
      if(screen!=='dialog') A.stopVoice?.();
      this.input?.releaseAll(); this.screen = screen; this.ui?.reset();
      if (screen !== 'controlEditor' && this.ui) this.ui.editor = null;
      if (screen === 'story' && !this.storyChap) this.storyChap = (YY.STAGES.find(s => !YY.Profile.stars(s.id)) || YY.STAGES[0]).chapter.id;
      if (screen === 'team') this.teamPeek = this.teamPeek || YY.Profile.sel.char;
      if (screen === 'codex') this.codexSel = this.codexSel || YY.Profile.d.cards[0];
    },
    hitHaptic(type) { if (type && this.settings.haptics) P.vibrate(type); },
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
    /** 同屏对战的两名角色：默认 P1 用当前出战角色，P2 用另一名已解锁角色 */
    duoChars() {
      const owned = YY.CHARS.filter(c => YY.Profile.has('char', c.id)).map(c => c.id);
      let [a, b] = this.duoPick || [];
      if (!owned.includes(a)) a = owned.includes(YY.Profile.sel.char) ? YY.Profile.sel.char : owned[0];
      if (!owned.includes(b) || b === a) b = owned.find(id => id !== a) || a;
      this.duoPick = [a, b]; return { owned, pick: this.duoPick };
    },
    duoCycle(i, d) {
      const { owned, pick } = this.duoChars();
      let k = owned.indexOf(pick[i]);
      do { k = (k + d + owned.length) % owned.length; } while (owned.length > 2 && owned[k] === pick[1 - i]);
      pick[i] = owned[k];
    },
    startLocal() {
      const { pick } = this.duoChars(), skills = this.settings.skills;
      this.reset(); this.mode = 'local';
      const looks = pick.map(id => YY.lookOf(id));
      const kits = pick.map(id => YY.skillSet(id, YY.Profile.kit(id)));
      this.match = new YY.Match({ names: ['P1 ' + looks[0].name, 'P2 ' + looks[1].name], firstServer: 0, looks, skills: skills ? kits : null });
      this.ctrlFor = [new HumanCtrl(true), new HumanCtrl(false)];
      this.input.setCtrls(this.ctrlFor, 'duo', skills ? kits.map(k => k.act) : null); this.enterGame();
      this.R.showBanner(looks[0].name + '  VS  ' + looks[1].name, skills ? kits.map(k => k.act.map(id => YY.SKILLS[id].short).join('+')).join('  /  ') + ' · 双方能力相同' : '左右两侧各一套按键 · 双方能力相同', '#ffd23f', 2.5);
    },
    quit() {
      this.net.close(); this.roomState = null; const story = !!this.story || this.mode === 'story';
      this.story = null; this.dlg = null; this.quiz = null;
      this.startAttract(); this.show(story ? 'story' : 'menu');
    },
    restart() {
      if (this.isOnline()) { this.net.send({ t: 'rematch' }); if (this.result) this.result.note = '正在返回房间，换好角色后双方重新准备'; return; }
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
      P.setHidden(true); this.input.releaseAll(); A.suspend(); this.acc = 0;
      this.net.active = false; if (this.net.code) this.net.send({ t: 'away' });
      if (this.inGame() && !this.screen) { this.paused = true; this.show('pause'); }
    },
    wake(options) {
      P.setHidden(false); A.resume(); this.last = P.now(); this.acc = 0;
      this.resize(); this.net.active = !this.paused; this.net.wake();
      if (this.net.code && !this.isOnline()) { this.net.active = true; this.net.ping(); }
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
    playDialog(lines, done, step) { const resume=this.story?.resume;this.dlg = { lines, i: Math.min(lines.length-1,resume?.line||0), done, progress: 0, step }; this.show('dialog'); this.storyLine(); },
    dlgAdvance() {
      const d = this.dlg; if (!d) return;
      const text = d.lines[d.i][1];
      if (d.progress < text.length) { d.progress = text.length; return; }
      if (++d.i >= d.lines.length) return this.dlgFinish();
      d.progress = 0; this.storyLine();
    },
    dlgFinish() { const d = this.dlg; if (d) { A.stopVoice?.();this.dlg = null; d.done(); } },
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
      if (q.pick) { const choice = q.pick.o[index]; this.story.ctx.pickOk = !!choice.ok; this.story.ctx.env = choice.env ? { ...choice.env } : null; this.rememberChoice(q.pick,index); }
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
      const stars = this.storyStageStars(); this.completeStorySave();
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
    myChar() { const id = YY.Profile.sel.char; return YY.Profile.has('char', id) ? id : 'lingfeng'; },
    async hostOnline() { return this.connectOnline({ t: 'create', venue: this.pickVenue(), char: this.myChar(), kit: YY.Profile.kit(this.myChar()), skills: this.settings.skills }); },
    async joinOnline(room) { if (!/^[A-Z2-9]{4}$/.test(room)) return P.toast('请输入 4 位房间码'); return this.connectOnline({ t: 'join', room, char: this.myChar(), kit: YY.Profile.kit(this.myChar()) }); },
    /** 房间里自己携带的技能：服务器确认的优先，否则用本机为该角色保存的组合 */
    roomKit(i) { const p = this.roomState?.players[i]; return p ? YY.skillSet(p.char, p.kit || (i === this.net.player ? YY.Profile.kit(p.char) : null)).act : []; },
    roomSetKit(kit) {
      const room = this.roomState, me = room?.players[this.net.player]; if (!me) return;
      this.roomConfigure({ char: me.char, kit: YY.Profile.setKit(me.char, kit) });
    },
    onlineSkills() { return !!this.onlineRules?.skills; },
    roomConfigure(change) { if (this.roomState) this.net.send({ t: 'configure', revision: this.roomState.revision, ...change }); },
    roomCycle(direction) {
      const room = this.roomState, me = room?.players[this.net.player]; if (!me) return;
      // Friendly rooms lend everyone the same roster; story unlocks remain local.
      const ids = YY.CHARS.map(c => c.id), at = ids.indexOf(me.char), next = ids[(at + direction + ids.length) % ids.length];
      this.roomConfigure({ char: next, kit: YY.Profile.kit(next) });
    },
    roomReady() {
      const room = this.roomState, me = room?.players[this.net.player]; if (!me) return;
      this.net.send({ t: 'ready', revision: room.revision, ready: !me.ready });
    },
    roomScore() {
      const wins = this.roomState?.wins || [0, 0], me = this.net.player || 0;
      return `本房间胜场 · 你 ${wins[me]} : ${wins[1 - me]} 好友`;
    },
    async connectOnline(request) {
      if (!this.net.configured()) return this.message('好友对战即将开放', '现在可以体验快速对战、故事模式，或和身边的好友同屏切磋。', 'friend');
      this.net.close(); this.roomState = null; this.onlineRules = null; this.story = null; this.startAttract(); this.show('lobby');
      this.lobbyStatus = '正在连接比赛服务器…'; const epoch = this.epoch;
      try { await this.net.connect(request); if (!this.net.features.includes('ready-room-v1')) return this.net.fail('比赛服务需要更新，请部署 1.0.7 或更新版本后重试'); if (this.screen === 'lobby') this.lobbyStatus = '确认角色和规则，双方准备后开始'; }
      catch (e) { if (this.epoch === epoch && this.screen === 'lobby') this.message('连接失败', e.message, 'friend'); }
    },
    startOnline(d) {
      if (!this.net.features.includes('ready-room-v1')) return this.net.fail('比赛服务需要更新，请部署 1.0.7 或更新版本后重试');
      const resume = this.isOnline() && this.matchId === d.matchId;
      this.onlineRules = d.rules || { skills: false };
      this.onlineChars = d.chars || this.roomState?.players.map(p => p.char) || ['lingfeng', 'canglan'];
      if (!resume) {
        this.reset(); this.mode = 'online'; this.match = null;
        this.playerIndex = this.net.player; this.matchId = d.matchId;
        const kit = d.kits?.[this.playerIndex] || YY.skillSet(this.onlineChars[this.playerIndex], YY.Profile.kit(this.onlineChars[this.playerIndex])).act;
        this.onlineKit = kit.slice(0, this.net.features.includes('skill-kit-v2') ? 2 : 1);
        this.ctrlFor[this.playerIndex] = this.soloCtrl(true, this.onlineSkills() ? this.onlineKit : null); this.enterGame(d.venue);
        this.R.mirror = this.playerIndex === 1;
      }
      this.view = new YY.GuestView(); this.view.names = ['红方', '蓝方'];
      if (!resume) this.R.showBanner('第 ' + (d.round || 1) + ' 局 · 开始', this.onlineSkills() ? '角色技能开启 · 基础能力相同' : '标准对战 · 技能关闭 · 基础能力相同', '#ffd23f', 1.2);
      this.predictor = new this.Prediction(this.playerIndex);
      this.lastEventId = resume ? this.lastEventId : 0; this.serverWait = null;
      this.sendT = 0; this.lastMove = null; this.net.active = !this.paused; this.sendInput();
      if (this.paused) this.net.send({ t: 'away' });
    },
    serverMessage(d) {
      if (d.t === 'room' && d.room === this.net.code) {
        this.roomState = d;
        if (['lobby', 'countdown'].includes(d.phase)) {
          if (this.isOnline()) { this.startAttract(); this.net.active = true; this.net.ping(); }
          if (this.screen !== 'lobby') this.show('lobby');
        }
        return;
      }
      if (d.t === 'notice') { if (this.result) this.result.note = d.message; else P.toast(d.message); return; }
      if (!this.isOnline() || d.t !== 'st' || d.matchId !== this.matchId) return;
      this.serverWait = d.wait;
      if (this.roomState && d.wins) this.roomState.wins = d.wins;
      const events = [];
      for (const e of d.ev || []) {
        if (!Number.isSafeInteger(e.id) || e.id <= this.lastEventId) continue;
        this.lastEventId = e.id;
        if (e.type === 'skill' || e.type === 'skillProc') {
          // Restore the gameplay identifier only after deduplicating the wire ID.
          // Older servers lost it; each confirmed character has one fixed skill.
          const skillId = e.skillId ?? YY.CHARS.find(c => c.id === this.onlineChars[e.p])?.skill;
          events.push({ ...e, id: skillId });
        } else events.push(e);
      }
      d.ev = events;
      this.view.push(d, P.now() / 1000); this.view.stats = d.stats; this.view.longest = d.longest;
      this.predictor.snapshot(d);
    },
    sendInput() {
      if (!this.isOnline() || !this.net.active || P.hidden() || this.paused) return;
      const c = this.ctrlFor[this.playerIndex]; if (!c) return;
      const kit2 = this.net.features.includes('skill-kit-v2');
      const presses = c.drain().filter(btn => (btn !== 'skill' && btn !== 'skill2') || (this.onlineSkills() && (btn === 'skill' || kit2))).map(btn => ({ id: ++this.net.action, btn }));
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
      if(this.screen==='inspect'&&this.activity){this.R.drawStory({scene:this.activity.step.scene,cast:[],talking:false,mm:false},dt);return;}
      if (this.screen === 'dialog' && this.dlg) {
        const d = this.dlg, view = this.storyView(d, d.progress < d.lines[d.i][1].length);
        if (view) { this.R.drawStory(view, dt); return; }
      }
      const m = this.isOnline() ? this.view : this.match; if (!m) return;
      if (this.isOnline()) {
        m.update(P.now() / 1000); m.names = m.looks ? m.looks.map(l => l.name) : ['红方', '蓝方'];
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
        if (this.practice.tutorial) o.labels = ['你', '战术陪练'];
        if (this.practice instanceof YY.Footwork) { o.marks = this.practice.marks; o.meterFor = []; }
        else if (this.practice instanceof YY.ServeDrill) o.serveLabel = '点「吊球」发网前球';
        else { o.hintIdx = 0; o.meterFor = []; }
      }
      if (this.storyDark) { const d = this.storyDark; if (!this.paused) { d.t -= dt; if (d.t <= 0) { d.flash = 1; d.t = 4 + Math.random() * 5; } d.flash = Math.max(0, d.flash - dt * 3.2); } o.dark = d; }
      if (this.isOnline()) o.waitText = this.net.reconnectRemaining() != null ? this.net.connectionText() : this.serverWait;
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
      if(this.screen==='lab'&&this.activity)this.activity.age+=dt;
      this.net.update(); this.render(dt); this.ui.draw(); A.update();
      if (P.takeStorageError()) P.toast('进度保存失败，请检查设备存储空间');
      this.raf = requestAnimationFrame(() => this.frame());
    },
    destroy() { this.running = false; if (this.raf != null) cancelAnimationFrame(this.raf); this.net.close(); this.input.releaseAll(); A.destroy(); },
  };
  Object.assign(app, YY.createGameplay((fn, ms) => app.defer(fn, ms)));
  const startStage = app.startStage;
  app.startStage = function (id) { if (YY.stage(id) && YY.stageOpen(id)) { this.net.close(); startStage.call(this, id); } };
  const stepContinue = app.stepContinue;
  app.stepContinue = function () { if (this.stepRes?.win) stepContinue.call(this); };
  YY.isTouch = () => true;
  return app;
};
