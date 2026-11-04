/* Shared match and story orchestration. Both browser and WeChat use these methods. */
(function (G) {
  'use strict';
  G.YY.createGameplay = function (schedule) {
    const YY = G.YY, C = YY.C, A = YY.Audio;
    const setTimeout = schedule || ((fn, ms) => G.setTimeout(fn, ms));
    return {
      myLoadout(avoid) {
      let id = YY.Profile.sel.char;
      if (!YY.Profile.has('char', id)) id = 'lingfeng';
      const st = YY.Profile.stats();
      if (id === avoid) { // 与对手同一角色时换成主角凌风（保留装备）
        const sel = Object.assign({}, YY.Profile.sel, { char: id === 'lingfeng' ? 'canglan' : 'lingfeng' });
        if (!YY.Profile.canTune()) sel.tension = YY.TENSION.def;
        return { id: sel.char, stats: YY.buildStats(sel), skill: YY.char(sel.char).skill, look: YY.lookOf(sel.char) };
      }
      return { id, stats: st, skill: YY.char(id).skill, look: YY.lookOf(id) };
    },
      oppLoadout(id) {
      return { id, stats: YY.buildStats({ char: id, racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 }), skill: YY.char(id).skill, look: YY.lookOf(id) };
    },
      startAI(level) {
      this.reset();
      this.mode = 'ai';
      this.level = level;
      const lv = YY.AI_LEVELS[level];
      const mine = this.myLoadout();
      const pool = YY.CHARS.filter((c) => c.id !== mine.id);
      const opp = this.oppLoadout(pool[Math.floor(Math.random() * pool.length)].id);
      const skills = this.settings.skills;
      this.match = new YY.Match({
        names: ['你', opp.look.name + ' · ' + lv.name], firstServer: 0,
        looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], skills: skills ? [mine.skill, opp.skill] : null,
      });
      this.ais = [new YY.AI(this.match, 1, level)];
      this.ctrlFor[0] = this.soloCtrl(true, skills ? mine.skill : null);
      this.enterGame();
      this.R.showBanner('对手：' + opp.look.name + ' · ' + lv.name, skills ? '技能：' + YY.SKILLS[opp.skill].name + ' · 7 分制' : '7 分制 · 需领先 2 分 · 10:10 后先得 11 分获胜', '#ffd23f', 2.4);
    },
      startPractice(drill) {
      this.reset();
      this.mode = 'practice';
      this.drill = drill;
      const mine = this.myLoadout();
      this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null] });
      this.practice = new YY.Practice(this.match, drill);
      this.ctrlFor[0] = this.soloCtrl(true);
      this.enterGame();
    },
      attractEvent(e, m) {
      // 背景演示：只保留视觉效果
      const R = this.R;
      if (e.type === 'hit') { R.hitFx(e); if (e.shot === 'smash') { R.shake = 0.4; R.flash = 0.08; } }
      if (e.type === 'net') R.netFx(e);
      if (e.type === 'point') { R.landFx(e.x, e.inB); R.pointFx(e.winner, m, '得分！'); }
      if (e.type === 'jump') R.dust(m.players[e.p].x, 4);
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
          if (e.burned) R.popText('被烈焰压制！', p.x, p.y + 3.2, '#ff8a2a', 0.9, 1.2);
          if (e.skill === 'pokong') { R.popText('破空！', e.x, e.y + 0.5, '#ff6a52', 1.3, 1.0); R.burst(e.x, e.y, 24, '255,120,90', 8, 0.05); }
          else if (e.skill === 'lieyan') { R.burst(e.x, e.y, 36, '255,140,40', 10, 0.06); R.shake = 1.2; }
          else if (e.skill === 'jinghua') R.popText('幻影！', e.x, e.y + 0.5, '#9ff0ff', 1.2, 1.0);
          break;
        }
        case 'skill': {
          const p = P[e.p], sk = YY.SKILLS[e.id], look = R.lookOf(m, e.p);
          A.skill();
          R.skillCutIn(look, sk, (e.p === 0) !== R.mirror);
          R.burst(p.x, p.y + 1, 30, [1, 3, 5].map((i) => parseInt(sk.color.slice(i, i + 2), 16)).join(','), 6, 0.05);
          R.ring(p.x, 0, '255,255,255', 0.5, 0.6, true);
          break;
        }
        case 'skillReady': if (this.isMe(e.p)) { A.ready(); R.popText('技能就绪！按 ' + (YY.isTouch() ? '「技能」' : 'I'), P[e.p].x, P[e.p].y + 2.6, '#ffd23f', 0.8, 1.4); } break;
        case 'pdone': if (this.mode === 'story') setTimeout(() => this.stepDone(e), 900); break;
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
          R.showBanner(title, sub, R.lookOf(m, e.winner).shirt, 1.7);
          if (this.mode === 'story') this.storyPoint(e, m);
          R.pointFx(e.winner, m, this.mode === 'local' ? name + ' 得分' : meWon ? '漂亮！' : name + ' 得分');
          break;
        }
        case 'pland': A.floor(); R.landFx(e.x, e.inB); break;
        case 'pres': if (e.ok) A.cheer(false); break;
        case 'over': {
          const meWin = this.mode === 'local' || this.isMe(e.winner);
          R.victoryFx(e.winner, m, this.mode === 'local' ? this.playerName(e.winner, m) + ' 获胜' : meWin ? '胜利！' : this.playerName(e.winner, m) + ' 获胜');
          if (this.mode === 'story') { setTimeout(() => this.stepDone({ win: e.winner === 0 }), 1500); break; }
          setTimeout(() => this.showResult(m), 1200);
          break;
        }
      }
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
      startStage(id) {
      const st = YY.stage(id);
      this.story = { st, i: 0, ctx: { pickOk: true, env: null }, stars: [] };
      this.runStep();
    },
      runStep() {
      const S = this.story;
      if (!S) return;
      const step = S.st.steps[S.i];
      if (!step) { this.finishStage(); return; }
      if (step.t === 'dialog' || step.t === 'quiz' || step.t === 'pick') {
        if (this.mode !== 'attract') this.startAttract(S.st.chapter.venue);
        else if (this.R.venueId !== S.st.chapter.venue) this.R.setVenue(S.st.chapter.venue);
      }
      if (step.t === 'dialog') this.playDialog(step.lines, () => this.nextStep());
      else if (step.t === 'quiz') this.playQuiz(step);
      else if (step.t === 'pick') this.playPick(step);
      else this.startChallenge(step);
    },
      nextStep() { if (!this.story) return; this.story.i++; this.runStep(); },
      startChallenge(step) {
      const S = this.story;
      this.reset();
      this.mode = 'story';
      this.storyKind = step.t;
      this.storyX = { dropWin: 0, smashWin: 0, clearWin: 0, outs: 0 };
      this.storyDark = null;
      this.storyStep = step;
      const venue = step.venue || S.st.chapter.venue;
      if (step.t === 'match') {
        const opp = this.oppLoadout(step.opp);
        const mine = this.myLoadout(step.opp);
        const env = step.env ? Object.assign({}, step.env) : S.ctx.env ? Object.assign({}, S.ctx.env) : null;
        this.match = new YY.Match({
          names: ['你', opp.look.name], firstServer: 0, target: step.target || 7, cap: step.cap || 11,
          looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], skills: [mine.skill, opp.skill], env,
        });
        this.ais = [new YY.AI(this.match, 1, step.level || 'normal')];
        this.ctrlFor[0] = this.soloCtrl(true, mine.skill);
        if (step.dark) this.storyDark = { flash: 0, t: 3 };
        this.enterGame(venue);
        const lv = YY.AI_LEVELS[step.level || 'normal'].name;
        this.R.showBanner(S.st.title, `对手：${opp.look.name}（${lv}）· ${step.target || 7} 分制`, '#ffd23f', 2.4);
      } else {
        const mine = this.myLoadout();
        this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null] });
        if (step.t === 'drill') this.practice = new YY.Practice(this.match, step.def);
        else if (step.t === 'footwork') { this.practice = new YY.Footwork(this.match, step.def); this.match.hideOpp = true; }
        else if (step.t === 'serve') { this.practice = new YY.ServeDrill(this.match, step.def); this.match.hideOpp = true; }
        this.ctrlFor[0] = this.soloCtrl(true);
        this.enterGame(venue);
        const g = this.practice.goal;
        this.R.showBanner(step.def.name, `目标：${g.total} ${g.unit || '球'}内成功 ${g.need} ${g.unit || '球'}`, '#ffd23f', 2.2);
      }
    },
      storyPoint(e, m) {
      const X = this.storyX, step = this.storyStep;
      if (e.winner === 0 && e.kind === 'winner') {
        const cat = YY.SHOT_CAT[e.shot];
        if (cat === 'drop') X.dropWin++;
        else if (cat === 'smash') X.smashWin++;
        else if (cat === 'clear') X.clearWin++;
      }
      if (e.loser === 0 && e.kind === 'error' && !e.inB) X.outs++;
      if (step && step.windFlip && m.env && m.winner < 0 && (m.score[0] + m.score[1]) % step.windFlip === 0) {
        m.env.wind = -m.env.wind;
        setTimeout(() => this.R.showBanner('风向改变！', (m.env.wind > 0) !== this.R.mirror ? '现在你是顺风：高远球收着打' : '现在你是顶风：放心发力', '#9fdcff', 1.8), 1800);
      }
    },
      stepDone(res) {
      if (this.mode !== 'story' || !this.story || this.screen === 'step') return;
      const step = this.storyStep, m = this.match;
      const r = {
        win: !!res.win, ok: res.ok, att: res.att, st: m.stats[0], score: m.score, longest: m.longest,
        x: this.storyX, pickOk: this.story.ctx.pickOk,
      };
      const goals = (step.stars || []).map((g) => ({ text: g.text, ok: r.win && !!g.test(r) }));
      const stars = r.win ? (goals.length ? 1 + goals.filter((g) => g.ok).length : 3) : 0;
      let main;
      if (step.t === 'match') main = `比分 ${m.score[0]} : ${m.score[1]} · 对手 ${m.names[1]}`;
      else main = `成功 ${res.ok} / ${res.att} ${this.practice.goal.unit || '球'} · 目标 ${this.practice.goal.need}`;
      if (r.win) A.win(); else A.lose();
      this.showStepResult({ win: r.win, stars, main, goals: [{ text: step.t === 'match' ? '赢下比赛' : `完成目标（${this.practice.goal.need} 次成功）`, ok: r.win }].concat(goals) });
    },
      stepContinue() {
      const S = this.story;
      if (!S || !this.stepRes) return;
      S.stars.push(this.stepRes.stars);
      this.stepRes = null;
      this.paused = false;
      this.nextStep();
    },
      stepRetry() {
      const S = this.story;
      if (!S) return;
      this.stepRes = null;
      this.paused = false;
      const step = S.st.steps[S.i];
      if (step.t === 'quiz') this.playQuiz(step);
      else this.startChallenge(step);
    },
      clearNext() { if (this.clearNextId) this.startStage(this.clearNextId); else this.show('story'); },
    };
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
