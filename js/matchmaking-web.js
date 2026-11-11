/* Public matchmaking UI and authoritative gameplay for the browser client. */
(function (G) {
  'use strict';
  const Y = G.YY, A = G.App, $ = id => document.getElementById(id);
  const rulesText = r => `${r.courtMode === '3d' ? '3D 纵深' : '2D 横版'} · ${r.target} 分 · ${r.skills ? '角色技能' : '基础对战'}`;
  function socketTask({ url }) {
    const ws = new WebSocket(url);
    return {
      onOpen: fn => ws.addEventListener('open', fn), onClose: fn => ws.addEventListener('close', fn), onError: fn => ws.addEventListener('error', fn),
      onMessage: fn => ws.addEventListener('message', fn),
      send({ data, success, fail }) {
        try { if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 262144) throw Error('连接拥堵'); ws.send(data); success?.(); }
        catch (e) { fail?.(e); }
      },
      close({ code = 1000 } = {}) { ws.close(code); },
    };
  }
  A.initMatchmaking = function () {
    const cfg = Y.MATCH_CONFIG || {}, local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const serverUrl = cfg.serverUrl || (/^https?:$/.test(location.protocol) ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws` : '');
    this.matchNet = new Y.SocketNetwork({ now: () => performance.now(), hidden: () => document.hidden, wx: { connectSocket: socketTask } }, { serverUrl, allowLocalhost: local, networkTransport: cfg.enabled === false ? 'off' : 'socket' });
    const n = this.matchNet;
    this.MatchPrediction = Y.createPrediction(Y, n);
    n.onStart = d => this.startMatchedGame(d);
    n.onMessage = d => this.matchedMessage(d);
    n.onEnd = message => { this.matchRoom = null; this.startAttract(); this.message('匹配已结束', message, 'matchmaking'); };
    $('btnMatchStart').onclick = () => this.startMatchmaking();
    $('btnMatchCancel').onclick = () => this.cancelMatchmaking();
    $('btnMatchAccept').onclick = () => { if (this.matchRoom) n.send({ t: 'ready', matchId: n.matchId, revision: this.matchRoom.revision, ready: true }); };
    $('btnMatchLoadout').onclick = () => { this.teamBack = 'matchmaking'; this.show('team'); };
    $('matchTarget').onchange = e => { this.settings.target = Number(e.target.value); this.saveMatchSettings(); };
    $('matchSkills').onchange = e => { this.settings.skills = e.target.checked; $('optSkill').checked = e.target.checked; this.saveMatchSettings(); };
    document.querySelectorAll('[data-match-court]').forEach(b => { b.onclick = () => { this.setCourtMode(b.dataset.matchCourt); this.renderMatchSetup(); }; });
    const changed = Y.Input.onChange;
    Y.Input.onChange = () => { changed?.(); if (this.mode === 'online') this.sendMatchedInput(); };
    document.addEventListener('visibilitychange', () => {
      if (n.status === 'closed') return;
      Y.Input.releaseAll(); n.active = !document.hidden && !this.paused;
      if (document.hidden) n.send({ t: 'away' });
      else { n.wake(); n.ping(); if (this.mode === 'online') this.sendMatchedInput(); }
    });
    G.addEventListener('pagehide', () => n.close());
  };
  A.saveMatchSettings = function () {
    for (const k of ['target', 'skills']) { try { localStorage.setItem('yuyue.' + k, JSON.stringify(this.settings[k])); } catch (_) {} }
    this.renderMatchSetup();
  };
  A.renderMatchSetup = function () {
    const id = Y.Profile.sel.char, kit = Y.Profile.kit(id), gear = Y.Profile.gear(id);
    $('matchPortrait').src = this.charURL(id); $('matchCharacter').textContent = Y.charName(id);
    $('matchKit').textContent = kit.map(k => Y.SKILLS[k].name).join(' / ');
    $('matchGear').textContent = [gear.racket, gear.string, gear.shoe].map(g => Y.gear(g).name).join(' · ') + ` · ${gear.tension} 磅`;
    $('matchTarget').value = Y.matchFormat(this.settings.target).target; $('matchSkills').checked = this.settings.skills !== false;
    document.querySelectorAll('[data-match-court]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.matchCourt === this.settings.courtMode)));
    $('btnMatchStart').disabled = !this.matchNet?.configured();
    $('matchSetupNote').textContent = this.matchNet?.configured() ? '真人 1v1 · 同规则配对 · 场馆随机' : '在线匹配暂不可用，请从已配置比赛服务的网站进入';
  };
  A.startMatchmaking = async function () {
    const n = this.matchNet; if (!n?.configured()) return this.message('在线匹配暂不可用', '请从已配置比赛服务的网站进入游戏。', 'matchmaking');
    const attempt = this.matchAttempt = (this.matchAttempt || 0) + 1;
    Y.Net.close(); n.close(); this.matchRoom = null; this.story = null; this.startAttract(); this.show('matching');
    const request = { t: 'queue_join', physicsVersion: Y.PHYSICS_VERSION, courtVersion: 2, courtMode: this.settings.courtMode,
      target: Y.matchFormat(this.settings.target).target, skills: this.settings.skills !== false, char: Y.Profile.sel.char,
      kit: Y.Profile.kit(Y.Profile.sel.char), gear: Y.Profile.gear(Y.Profile.sel.char), title: Y.AIChallenge?.equipped()?.id || null };
    const pending = n.connect(request);
    this.renderMatching();
    try { await pending; }
    catch (e) { if (this.matchAttempt === attempt && this.screen === 'matching') this.message('匹配连接失败', e.message + '。请稍后重试。', 'matchmaking'); }
  };
  A.cancelMatchmaking = function () {
    this.matchAttempt = (this.matchAttempt || 0) + 1; this.matchNet.close(); this.matchRoom = null; this.startAttract(); this.show('matchmaking');
  };
  A.renderMatching = function () {
    const n = this.matchNet, r = this.matchRoom, q = n.queueState, found = r?.kind === 'matchmaking';
    $('matchStatusTitle').textContent = found ? '找到对手，准备上场' : '正在寻找球友';
    $('matchStatusRules').textContent = r ? rulesText(r.rules) : q ? rulesText(q.rules) : '正在连接比赛服务…';
    $('matchSearch').hidden = found; $('matchPair').hidden = !found;
    $('btnMatchAccept').hidden = !found;
    $('btnMatchCancel').textContent = found ? '离开匹配' : '取消匹配';
    if (found) {
      const me = n.player;
      [me, 1 - me].forEach((i, col) => {
        const p = r.players[i], tag = col ? 'Opponent' : 'Self';
        const image = $('match' + tag + 'Portrait'); if (image.dataset.char !== p.char) { image.src = this.charURL(p.char); image.dataset.char = p.char; }
        $('match' + tag + 'Name').textContent = (col ? '对手 · ' : '你 · ') + Y.charName(p.char);
        $('match' + tag + 'Ready').textContent = !p.connected ? '正在重连' : p.away ? '暂时离开' : p.ready ? '已确认' : '等待确认';
        $('match' + tag + 'Ready').classList.toggle('confirmed', p.ready);
      });
      $('matchVersus').textContent = r.phase === 'countdown' ? r.countdown : 'VS';
      $('matchStatusNote').textContent = n.reconnectRemaining() != null ? n.connectionText() : r.phase === 'countdown' ? '双方已确认，即将开赛' : `${r.confirmRemaining} 秒内确认 · 未确认将结束本轮匹配`;
      $('btnMatchAccept').disabled = r.players[me]?.ready || r.players[me]?.away || n.reconnectRemaining() != null || n.awaitingWelcome;
      $('btnMatchAccept').textContent = r.players[me]?.ready ? '已确认 · 等待开赛' : '确认比赛';
    } else {
      const elapsed = q ? q.elapsed + Math.max(0, Math.floor((performance.now() - n.queueReceivedAt) / 1000)) : 0;
      $('matchElapsed').textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
      $('matchWaiting').textContent = q ? `同规则等待 ${q.waiting} 人 · 本轮最多 3 分钟` : n.connectionText();
      $('matchStatusNote').textContent = n.reconnectRemaining() != null ? n.connectionText() : q?.reason || (q?.capacity ? '球场使用中，空出后按排队顺序配对' : '等待真实玩家加入，匹配成功后将请你确认');
    }
  };
  A.matchedMessage = function (d) {
    const n = this.matchNet;
    if (d.t === 'queue') { this.matchRoom = null; if (this.mode === 'online') this.startAttract(); if (this.screen !== 'matching') this.show('matching'); this.renderMatching(); return; }
    if (d.t === 'room' && d.room === n.code) {
      this.matchRoom = d;
      if (['lobby', 'countdown'].includes(d.phase)) { if (this.screen !== 'matching') this.show('matching'); this.renderMatching(); }
      return;
    }
    if (d.t === 'notice') { $('matchStatusNote').textContent = d.message; return; }
    if (d.t === 'emote' && this.mode === 'online') { this.R.emote?.({ p: d.p, id: d.e }); return; }
    if (this.mode !== 'online' || d.t !== 'st' || d.matchId !== this.matchId) return;
    this.serverWait = d.wait; this.matchEndReason = d.endReason;
    const events = [];
    for (const e of d.ev || []) {
      if (!Number.isSafeInteger(e.id) || e.id <= this.lastMatchEvent) continue;
      this.lastMatchEvent = e.id; events.push(e.skillId ? { ...e, id: e.skillId } : e);
    }
    this.view.push({ ...d, ev: events }); this.view.stats = d.stats; this.view.longest = d.longest; this.matchPredictor.snapshot(d);
  };
  A.startMatchedGame = function (d) {
    const n = this.matchNet, resume = this.mode === 'online' && this.matchId === d.matchId;
    if (!resume) {
      this.reset(); this.mode = 'online'; this.match = null; this.playerIndex = n.player; this.matchId = d.matchId;
      this.ctrlFor[this.playerIndex] = this.soloCtrl(true, d.rules.skills ? d.kits[this.playerIndex] : null);
      this.enterGame(d.venue); this.R.mirror = this.playerIndex === 1;
      this.setupCourtControls(d.rules.courtMode); this.lastMatchEvent = 0;
      this.R.showBanner('在线匹配 · 开始', rulesText(d.rules), '#ffd23f', 1.6);
    }
    this.view = new Y.GuestView(); this.view.names = ['红方', '蓝方']; this.view.titles = Y.titleIds(d.titles);
    this.matchPredictor = new this.MatchPrediction(this.playerIndex);
    this.matchRules = d.rules; this.serverWait = null; this.sendT = 0; this.lastMatchMove = this.lastMatchStrafe = null;
    n.active = !this.paused && !document.hidden; $('netInfo').classList.remove('hidden'); this.sendMatchedInput();
  };
  A.sendMatchedInput = function () {
    const n = this.matchNet, c = this.ctrlFor[this.playerIndex];
    if (this.mode !== 'online' || !c || !n.active || n.awaitingWelcome || document.hidden || this.paused) return;
    const actions = c.drain(), presses = this.screen ? [] : actions.map(a => typeof a === 'string' ? { btn: a } : a).filter(a => this.matchRules?.skills || !a.btn.startsWith('skill')).map(a => ({ ...a, id: ++n.action }));
    const move = this.screen ? 0 : c.move(), strafe = this.screen ? 0 : c.strafe();
    if (presses.length || move !== this.lastMatchMove || strafe !== this.lastMatchStrafe || this.sendT <= 0) {
      const packet = { t: 'in', matchId: this.matchId, seq: ++n.seq, move, presses, ...(c.court3D ? { strafe } : {}) };
      if (n.send(packet)) this.matchPredictor?.input(packet);
      this.lastMatchMove = move; this.lastMatchStrafe = strafe; this.sendT = .05;
    }
  };
  const init = A.init; A.init = function () { init.call(this); this.initMatchmaking(); };
  const show = A.show; A.show = function (name) { show.call(this, name); if (name === 'matchmaking' && this.matchNet) this.renderMatchSetup(); };
  const reset = A.reset; A.reset = function () { reset.call(this); this.matchResultAt = null; this.matchEndReason = null; };
  const restart = A.restart; A.restart = function () { if (this.mode === 'online') return this.startMatchmaking(); return restart.call(this); };
  const quit = A.quit; A.quit = function () { this.matchNet?.close(); this.matchRoom = null; return quit.call(this); };
  const watch = A.netWatch; A.netWatch = function () { if (this.mode === 'online') return this.matchNet.reconnectRemaining() != null ? this.matchNet.connectionText() : this.serverWait; return watch.call(this); };
  const tick = A.tick; A.tick = function (dt) { if (this.mode === 'online') { this.sendT -= dt; if (this.sendT <= 0) this.sendMatchedInput(); return; } tick.call(this, dt); };
  const frame = A.frame; A.frame = function (now) { this.matchNet?.update(); if (this.screen === 'matching' && now - (this.matchUIAt || 0) > 200) { this.matchUIAt = now; this.renderMatching(); } frame.call(this, now); };
  const pause = A.togglePause; A.togglePause = function () {
    if (this.mode !== 'online') return pause.call(this);
    if (this.screen && this.screen !== 'pause') return;
    this.paused = !this.paused; Y.Input.releaseAll(); this.matchNet.active = !this.paused; this.show(this.paused ? 'pause' : null);
    $('btnRestart').classList.add('hidden');
    if (this.paused) this.matchNet.send({ t: 'away' }); else this.sendMatchedInput();
  };
  const render = A.render; A.render = function (dt) {
    if (this.mode !== 'online') return render.call(this, dt);
    const v = this.view, me = this.playerIndex; if (!v) return;
    v.update(); v.names = v.looks?.map(l => l.name) || ['红方', '蓝方']; this.matchPredictor?.apply(v, dt); this.updateSkillBtn(v);
    for (const e of v.events.splice(0)) this.handleEvent(e, v);
    this.R.draw(v, { rawDt: this.rawDt, padLeft: 46, labels: me ? [null, '你'] : ['你', null], meterFor: [me], landHint: this.settings.hint ? [me] : null,
      serveLabel: Y.isTouch() ? '点「高远」或「吊球」发球' : 'J 发高远球 · K 发网前球', waitText: this.netWait,
      skillAims: !this.paused ? [...Y.Input.skillAims.values()].map(a => ({ ...a, player: me })) : [] }, dt);
    if (v.phase === 'over' && v.stats && !this.resultShown) {
      this.matchResultAt ??= performance.now();
      if (performance.now() - this.matchResultAt >= 900) this.showResult(v);
    }
    $('netInfo').textContent = this.matchNet.connectionText();
  };
  const result = A.showResult; A.showResult = function (m) {
    result.call(this, m);
    if (this.mode === 'online' && this.resultShown) { $('btnAgain').textContent = '继续匹配'; if (this.matchEndReason) $('resTip').textContent = this.matchEndReason + ' · ' + (m.winner === this.playerIndex ? '本场获胜' : '本场失利'); }
  };
})(window);
