/* Shared match and story orchestration. Both browser and WeChat use these methods. */
(function (G) {
  'use strict';
  G.YY.createGameplay = function (schedule) {
    const YY = G.YY, C = YY.C, A = YY.Audio;
    const setTimeout = schedule || ((fn, ms) => G.setTimeout(fn, ms));
    const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt((hex + '000000').slice(i, i + 2), 16) || 255).join(',');
    return {
      ...YY.storyActions,
      updateSoundscape(dt) {
        if(!YY.Soundtrack)return;
        A.venue=this.R?.venueId;
        A.musicEnabled=this.settings.music!==false;
        this.musicDirector=this.musicDirector||YY.Soundtrack.createDirector();
        A.musicScene?.(this.musicDirector.update(this,dt));
        A.updateMusic?.(dt);
      },
      /** 我方出战配置：故事模式只能用已解锁的器械；其他模式器械自由搭配 */
      myLoadout(avoid, as) {
      const free = this.mode !== 'story';
      const pack = (id, forced, gear = free ? YY.Profile.gear(id) : YY.Profile.storyGear(id)) => ({ id, gear, stats: YY.buildStats(Object.assign({ char: id }, gear)), skill: YY.skillSet(id, YY.Profile.kit(id)), look: YY.lookOf(id), forced });
      if (as && (YY.CHARS.some(c => c.id === as) || YY.STORY_NPCS?.[as])) return pack(as, true);
      let id = YY.Profile.sel.char;
      if (!YY.CHARS.some(c => c.id === id) || (!free && !YY.Profile.has('char', id))) id = YY.CHARS.find(c => free || YY.Profile.has('char', c.id))?.id || 'dingding';
      if (!free && id === avoid) {
        const alternate = YY.CHARS.find(c => c.id !== avoid && (free || YY.Profile.has('char', c.id)));
        if (alternate) id = alternate.id;
      }
      return pack(id);
    },
      oppLoadout(id, mix, kit) {
      // 快速对战的对手随机携带 3 选 2 的技能组合（玩家可指定），并带上该角色的推荐器械；
      // 故事里固定为前两个技能、入门器械（关卡难度按此调校）
      const acts = YY.char(id).acts || [];
      const pick = Array.isArray(kit) && kit.length === 2 ? kit : mix && acts.length > 2 ? acts.filter((_, i) => i !== Math.floor(Math.random() * acts.length)) : null;
      const gear = mix ? YY.recommendedGear(id) : null;
      return { id, gear, stats: YY.buildStats(Object.assign({ char: id }, gear || YY.GEAR_DEFAULT)), skill: YY.skillSet(id, pick), look: YY.lookOf(id) };
    },
      /** setup：{ opp: 角色 id 或 'random', kit: 对手携带的 2 个技能或 null（随机） }，省略时沿用上一局 */
      startAI(level, setup) {
      setup = setup || this.aiSetup || null;
      this.reset();
      this.mode = 'ai';
      this.level = YY.AI_LEVELS[level] ? level : 'normal';
      this.aiSetup = setup;
      const lv = YY.AI_LEVELS[this.level];
      const fixed = setup && YY.CHARS.some((c) => c.id === setup.opp) ? setup.opp : null;
      const mine = this.myLoadout(fixed);
      const pool = YY.CHARS.filter((c) => c.id !== mine.id);
      const oppId = fixed || pool[Math.floor(Math.random() * pool.length)].id;
      const opp = this.oppLoadout(oppId, true, fixed === oppId ? setup.kit : null);
      const skills = this.settings.skills;
      this.match = (YY.createMatch || (o => new YY.Match(o)))({
        ...YY.matchFormat(this.settings.target), courtMode: this.settings.courtMode, names: ['你', opp.look.name + ' · ' + lv.name], firstServer: 0,titles:[YY.AIChallenge?.equipped()?.id,null],
        looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], gear: [mine.gear, opp.gear], skills: skills ? [mine.skill, opp.skill] : null,
      });
      this.match.battleMeta={level:this.level,chars:[mine.id,opp.id]};
      this.ais = [(YY.createAI || ((m,...args) => new YY.AI(m,...args)))(this.match, 1, this.level, opp.id)];
      YY.AIChallenge?.begin(this.match, opp.id, this.level);
      this.ctrlFor[0] = this.soloCtrl(true, skills ? mine.skill.act : null);
      this.enterGame();
      const style = YY.AI_STYLES[opp.id] || {name:'自由切磋',weakness:'回位调整，观察来球，寻找击球时机。'};
      const oppKit = skills ? ' · 携带 ' + opp.skill.act.map(k => YY.SKILLS[k].name).join('、') : '';
      this.R.showBanner(opp.look.name + ' · ' + style.name, style.weakness + oppKit, '#ffd23f', 3.3);
      const title = YY.AIChallenge?.equipped();
      if (title) this.R.showTitleIntro(title, mine.look.name);
    },
      recordAIResult(m) { return YY.AIChallenge?.finish(m, this.mode) || null; },
      openAIChallenges(back = 'ai') { this.challengeBack = back; this.challengeLevel = this.challengeLevel || 'nightmare'; this.show('challenges'); },
      challengeAI(char, level) { this.startAI(level, { opp: char, kit: null }); },
      startPractice(drill) {
      this.reset();
      this.mode = 'practice';
      this.drill = drill;
      const mine = this.myLoadout();
      this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null], gear: [mine.gear, null] });
      this.practice = drill === 'tactics' ? new YY.TacticsPractice(this.match) : new YY.Practice(this.match, drill);
      this.ctrlFor[0] = this.soloCtrl(true);
      this.enterGame();
    },
      /** 训练场角色：任何角色都可试用，统一带上当前搭配的器械 */
      trainLoadout(id) {
      const owned = YY.Profile.has('char', id), gear = YY.Profile.gear(id); // 训练场：任何角色都可试用，带上该角色的器械搭配
      return { id, owned, gear, stats: YY.buildStats(Object.assign({ char: id }, gear)), skill: YY.skillSet(id, YY.Profile.kit(id)), look: YY.lookOf(id) };
    },
      /** 训练场：自选角色与技能，可调发球机；cfg 见 YY.TRAIN_DEFAULT */
      startTraining(cfg, preview) {
      cfg = this.trainCfg = YY.cleanTrain(cfg || this.trainCfg);
      this.reset();
      this.mode = 'practice';
      this.drill = 'train';
      const me = this.trainLoadout(cfg.char), kit = cfg.skills ? preview?.kit ? YY.skillSet(cfg.char,preview.kit) : me.skill : null;
      this.match = (YY.createMatch || (o=>new YY.Match(o)))({ courtMode:preview?.courtMode||'2d', names: ['你', '发球机'], practice: true, looks: [me.look, null], stats: [me.stats, null], gear: [me.gear, null], skills: kit ? [kit, null] : null });
      this.practice = new YY.Training(this.match, cfg);
      this.ctrlFor[0] = this.soloCtrl(true, kit ? kit.act : null);
      this.enterGame();
      const tags = [cfg.freeEnergy && kit ? '无限能量' : '', cfg.freeStamina ? '无限体力' : '', me.owned ? '' : '试用角色'].filter(Boolean).join(' · ');
      this.R.showBanner('训练场 · ' + me.look.name, (kit ? kit.act.map((k) => YY.SKILLS[k].name).join(' + ') : '技能关闭') + (tags ? ' · ' + tags : ''), '#5fd4ff', 2.2);
    },
      finishTactics() { if (this.mode !== 'practice' || !this.practice?.tutorial || !this.practice.done) return; this.paused = true; this.show('tacticsComplete'); },
      attractEvent(e, m) {
      // 背景演示：只保留视觉效果
      const R = this.R;
      if (e.type === 'hit') { R.hitFx(e); R.gearHit?.(e, m); if (e.shot === 'smash') { R.shake = 0.4; R.flash = 0.08; } }
      if (e.type === 'gear') R.gearFx?.(e, m);
      if (e.type === 'net') R.netFx(e);
      if (e.type === 'point') { R.landFx(e.x, e.inB); R.pointFx(e.winner, m, '得分！'); }
      if (e.type === 'jump') R.dust(m.players[e.p].x, 4);
    },
      handleEvent(e, m) {
      const R = this.R;
      R.matchNotice?.(e,m,{mine:this.isMe(e.p)||this.mode==='local',practice:this.mode==='practice'});
      if(m.courtMode==='3d') R.spatialEvent?.(e,m);
      const P = m.players;
      switch (e.type) {
        case 'hit': {
          if (R.titleIntro && !e.feed) { R.titleIntro = null; R.banner = null; }
          if (e.feed) { A.hit(0.5, false, e); break; }
          const smash = e.shot === 'smash' || e.shot === 'halfsmash';
          A.hit(e.q, smash || e.shot === 'kill', e);
          R.hitFx(e); R.gearHit?.(e, m);
          const p = P[e.p];
          if (e.skill && YY.SKILLS[e.skill]) { // 装置 / 技能完成的回球
            const sk = YY.SKILLS[e.skill];
            R.burst(e.x, e.y, e.device ? 14 : 9, rgbOf(sk.color), 4.5, 0.04);
            if (e.big || e.skill === 'haomao' || e.skill === 'diban' || e.skill === 'xuanpai') R.shake = Math.max(R.shake || 0, e.big ? 1 : 0.8);
            if (e.big) R.ring?.(e.x, e.y, rgbOf(sk.color), 0.4, 0.7, false);
          }
          // 震动反馈按球路分级：重杀/扑球最重，发力球与平抽中等，吊、搓、放网只轻点一下
          if (this.isMe(e.p) && this.hitHaptic) this.hitHaptic(YY.hitWeight ? YY.hitWeight(e) : smash || e.shot === 'kill' ? 'heavy' : e.q >= 0.85 ? 'medium' : null);
          break;
        }
        case 'skill': {
          const p = P[e.p], sk = YY.SKILLS[e.id];
          // Unknown effects must not abort the frame and stop online heartbeats.
          if (!p || !sk) break;
          const look = R.lookOf(m, e.p);
          if (this.mode === 'story' && this.storyX && e.p === 0) this.storyX.skill = (this.storyX.skill || 0) + 1;
          if (sk.stealth && !this.isMe(e.p)) break; // 幻术类：对手看不到也听不到释放特写，只能看球
          R.characterSkill?.(e);
          A.skill(e.id);
          R.skillCutIn(look, sk, (e.p === 0) !== R.mirror);
          // 发动反馈收在选手脚下：少量贴地火花 + 地面光环，不在半空炸开挡住来球
          R.burst(p.x, p.y + 0.5, 12, rgbOf(sk.color), 3.2, 0.04);
          R.ring(p.x, 0, rgbOf(sk.color), 0.5, 0.5, true);

          break;
        }
        case 'skillMotion': R.characterSkill?.(e); if(e.id==='shensuo')A.swing?.('smash');else A.skill?.(e.id); break;
        case 'skillFail': break;
        case 'beat': A.blip?.(); break;
        case 'quake': R.shake = Math.max(R.shake || 0, 1.1); R.dust?.(e.x, 8); A.floor?.(); break;
        case 'slip': R.dust?.(P[e.p].x, 6); break;
        case 'fakeHit': A.hit?.(0.6, 0.5); R.burst(e.x, e.y, 10, '159,240,255', 5, 0.03); break;
        case 'dirtyBounce': A.hit?.(0.3, false, { shot: 'block' }); R.dust?.(e.x, 3); break; // 脏数据落地乱弹
        case 'skillProc': if(e.inkBurst)A.skill?.('moyun');else A.ready?.(); break;
        case 'blink': {
          const p = P[e.p];
          R.burst(e.from, 1, 18, '255,179,71', 5, 0.04); R.burst(e.to, 1, 22, '255,179,71', 6, 0.05);

          break;
        }
        case 'skillReady': if(this.isMe(e.p))A.ready(); break;
        case 'pdone': if (this.mode === 'story') setTimeout(() => this.stepDone(e), 900); break;
        case 'tacticsDone': if (this.mode === 'story') setTimeout(() => this.stepDone({win:true,ok:3,att:e.attempts}),900); else setTimeout(() => this.finishTactics(), 1500); break;
        case 'swing': A.swing(e.btn); break;
        case 'step': A.step?.(e); break;
        case 'whiff': break;
        case 'net': A.net(); R.netFx(e); break;
        case 'gear': { // 器械特性：特效人人可见，文字只提示自己（关键时刻）
          R.gearFx?.(e, m);
          break;
        }
        case 'jump': A.jump(); R.dust(P[e.p].x, 5); break;
        case 'land': A.land?.(); R.dust(P[e.p].x, 3); break;
        case 'tired': if(this.isMe(e.p)&&e.low)A.tired?.(); break;
        case 'turn': R.skid?.(P[e.p], e.v); break;
        case 'read': break;
        case 'serveReady': R.trail = []; R.lastWinner = -1; break;
        case 'point': {
          if (m.winner >= 0) this.recordAIResult(m);
          A.floor();
          R.landFx(e.x, e.inB);
          const meWon = this.isMe(e.winner) && this.mode !== 'local';
          A.point?.(meWon || this.mode === 'local');
          const name = this.playerName(e.winner, m);
          let title;
          if (this.mode === 'local') title = name + ' 得分';
          else title = meWon ? '得分！' : '失分';
          if (e.rally >= 6 || m.phase === 'over') A.cheer(e.kind === 'winner' && (meWon || this.mode === 'local'));
          let sub = e.reason;
          if (e.pts > 1) sub += ' · 期权 ×' + e.pts;
          if (e.rally >= 8) sub += ' · ' + e.rally + ' 拍回合';
          if (e.banner) sub += ' · ' + e.banner;
          R.showBanner(title, sub, R.lookOf(m, e.winner).shirt, 1.7);
          if (this.mode === 'story') this.storyPoint(e, m);
          R.pointFx(e.winner, m, this.mode === 'local' ? name + ' 得分' : meWon ? '漂亮！' : name + ' 得分');
          break;
        }
        case 'pland': A.floor(); R.landFx(e.x, e.inB); break;
        case 'pres': if (e.ok) A.success?.(); break;
        case 'over': {
          this.recordAIResult(m);
          A.whistle();
          const meWin = this.mode === 'local' || this.isMe(e.winner);
          R.victoryFx(e.winner, m, this.mode === 'local' ? this.playerName(e.winner, m) + ' 获胜' : meWin ? '胜利！' : this.playerName(e.winner, m) + ' 获胜');
          if (this.mode === 'story') { const story=this.story;setTimeout(() => {if(this.mode==='story'&&this.story===story&&this.match===m)this.stepDone({win:e.winner===0});},1500);break; }
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
      if (!st || !YY.stageOpen(id)) return;
      const difficulty=YY.Profile.d.campaign.difficulty || 'story';
      const cp=YY.Profile.d.campaign.checkpoint, resume=cp?.stage===id && cp.difficulty===difficulty && cp.index<st.steps.length?cp:null;
      this.story = { st, difficulty, i: resume?.index || 0, ctx: resume?.ctx || { pickOk: true, env: null, choices:{...YY.Profile.d.campaign.choices} }, stars: resume?.stars || [], resume };
      this.runStep();
    },
      runStep() {
      const S = this.story;
      if (!S) return;
      const step = S.st.steps[S.i];
      if (!step) { this.finishStage(); return; }
      if (!YY.storyCondition(step.when, S.ctx)) { this.nextStep(); return; }
      this.saveStoryCheckpoint(S.resume && S.resume.index===S.i ? {line:S.resume.line,activity:S.resume.activity}:{});
      if (['dialog','cinema','card','pick','inspect','minigame','loadout','relay'].includes(step.t)) {
        if (this.mode !== 'attract') this.startAttract(S.st.chapter.venue);
        else if (this.R.venueId !== S.st.chapter.venue) this.R.setVenue(S.st.chapter.venue);
      }
      if (step.t === 'dialog') this.playDialog(step.lines.map(l=>[l[0],YY.storyText(l[1],S.ctx),l[2],l[3],l[4]]), () => this.nextStep(), step);
      else if (step.t === 'cinema') this.playCinema(step);
      else if (step.t === 'card') this.playKnowledge(step);
      else if (step.t === 'minigame') this.playMinigame(step);
      else if (step.t === 'loadout' || step.t === 'relay' || step.as === 'choose' || step.gear && !step.setupDone) this.startStorySetup(step);
      else if (step.t === 'quiz') this.playQuiz(step);
      else if (step.t === 'pick') this.playPick(step);
      else if (step.t === 'inspect') this.playInspect(step);
      else if (step.t === 'board') this.playBoard(step);
      else if (step.t === 'lab') this.playLab(step);
      else this.startChallenge(step);
      S.resume=null;
    },
      /** 剧情演出信息：场景、在场人物、说话人与表情 */
      storyView(d, talking) {
        const step = d && d.step;
        if (!step || !step.scene || !YY.SCENES) return null;
        const i = Math.min(d.i < 0 ? 0 : d.i, step.lines.length - 1), line = step.lines[i];
        const meta=line[4]||{};
        return { scene: step.scene, cast: step.intro?[]:YY.storyCast(step, i), who: line[0], mood: line[2] || null, action:line[3], lineKey:step.uid+':'+i, talking, ...meta, intent:line[2]==='intent'?line[1]:null };
      },
      nextStep() { if (!this.story) return; this.story.i++; this.runStep(); },
      startChallenge(step) {
      const S = this.story;
      this.reset();
      this.mode = 'story';
      this.storyKind = step.t;
      this.storyX = { dropWin: 0, smashWin: 0, clearWin: 0, outs: 0, skill: 0, maxDown: 0 };
      this.storyDark = null;
      this.storyStep = step;
      const venue = step.venue || (step.field==='league'?'leaguecourt':step.field==='memory'?'memorycourt':step.field==='reality'?'rivercourt':step.field==='empty'?'emptycourt':S.st.chapter.venue);
      if (step.t === 'match') {
        const opp = this.oppLoadout(step.opp);
        const mine = this.myLoadout(step.opp, this.storyAs(step));
        const env = step.env ? Object.assign({}, step.env) : S.ctx.env ? Object.assign({}, S.ctx.env) : null;
        this.match = new YY.Match({
          names: ['你', opp.look.name], firstServer: 0, target: step.target || 7, cap: step.cap || 11,
          looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], gear: [mine.gear, null], skills: step.skills===false?null:[mine.skill, step.oppSkills===false?{passive:null,act:[]}:opp.skill], env,
        });
        if(step.startScore) this.match.score=[...step.startScore];
        if (step.oppEnergy && this.match.skillsOn) this.match.players[1].energy = step.oppEnergy;
        const difficulty = S.difficulty || 'story', plan = YY.storyAI(step,difficulty);
        const ai = new YY.AI(this.match, 1, plan.level, opp.id);
        if (plan.tuning) ai.L = { ...ai.L, ...plan.tuning };
        ai.storySkillInterval = plan.skillInterval;
        this.ais = [ai];
        this.storyRuntime = new YY.StoryMatch(this, step);
        this.ctrlFor[0] = this.soloCtrl(true, step.skills===false?null:mine.skill.act);
        if (step.dark) this.storyDark = { flash: 0, t: 3 };
        this.enterGame(venue);
          this.R.showBanner(`${opp.look.name} · ${YY.STORY_DIFFICULTIES[difficulty].name}`, `操控${mine.look.name} · ` + (step.rule || YY.AI_STYLES[opp.id]?.weakness || '球落地之前，谁都不知道。'), '#c6d9b4', 3.6);
      } else {
        const mine = this.myLoadout(null, this.storyAs(step));
        this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null], gear: [mine.gear, null] });
        if (step.t === 'drill') this.practice = new YY.Practice(this.match, step.def);
        else if (step.t === 'combo') { this.practice=new YY.TacticsPractice(this.match); this.practice.goal={need:3,total:Infinity}; }
        else if (step.t === 'footwork') { this.practice = new YY.Footwork(this.match, step.def); this.match.hideOpp = true; }
        else if (step.t === 'serve') { this.practice = new YY.ServeDrill(this.match, step.def); this.match.hideOpp = true; }
        this.ctrlFor[0] = this.soloCtrl(true);
        this.enterGame(venue);
        const g = this.practice.goal;
        this.R.showBanner((mine.forced ? mine.look.name + ' · ' : '') + step.def.name, step.t==='combo'?'完成三种球路 · 失误只重练当前一步':`目标：${g.total} ${g.unit || '球'}内成功 ${g.need} ${g.unit || '球'}`, '#ffd23f', 2.2);
      }
    },
      /** 剧情指定的上场角色：固定角色，或来自本关“谁上场”的选择 */
      storyAs(step) {
      if (!step.as) return 'dingding';
      if (step.as !== 'pick') return step.as;
      const key = step.asKey, pick = this.story.st.steps.find(s => s.t === 'pick' && s.key === key);
      const value = this.story.ctx.choices?.[key] || YY.Profile.d.campaign.choices[key];
      const opt = pick && pick.o.find(o => (o.reply || o.label) === value);
      return opt ? opt.as : null;
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
      X.maxDown = Math.max(X.maxDown || 0, m.score[1] - m.score[0]);
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
      const goals = this.storyRuntime && step.t==='match' ? this.storyRuntime.goals(r) : (step.stars || []).map((g) => ({ text: g.text, ok: r.win && !!g.test(r) }));
      const lossAllowed=step.t==='match'&&step.allowLoss!==false;
      let stars = r.win ? (goals.length ? 1 + goals.filter((g) => g.ok).length : 3) : (lossAllowed?1:0);
      const predictionBroken=r.win && step.prediction!=null && step.prediction<50;
      if(predictionBroken)stars=Math.min(3,stars+1);
      const canContinue=r.win || lossAllowed;
      this.story.ctx.lastWin=r.win;
      if(!r.win){const failures=YY.Profile.d.campaign.failures;failures[this.story.st.id]=(failures[this.story.st.id]||0)+1;YY.Profile.save();}
      let main;
      if (step.t === 'match') main = `比分 ${m.score[0]} : ${m.score[1]} · 对手 ${m.names[1]}`;
      else main = `成功 ${res.ok} / ${res.att} ${this.practice.goal.unit || '球'} · 目标 ${this.practice.goal.need}`;
      if(predictionBroken)main+=' · 预测被打破';
      if(!r.win&&canContinue)main+=' · 没接住也没关系，故事继续';
      if (r.win) A.win(); else A.lose();
      this.showStepResult({ win: r.win, canContinue, stars, main, goals: [{ text: step.t === 'match' ? '亲手打完这一段' : `完成目标（${this.practice.goal.need} 次成功）`, ok: canContinue }].concat(goals) });
    },
      stepContinue() {
      const S = this.story;
      if (!S || !(this.stepRes?.win || this.stepRes?.canContinue)) return;
      S.stars.push(this.bestStoryStep(this.stepRes.stars));
      this.stepRes = null;
      this.paused = false;
      this.nextStep();
    },
      stepRetry() {
      const S = this.story;
      if (!S) return;
      this.stepRes = null;
      this.paused = false;
      const step = this.storyStep || S.st.steps[S.i];
      if (step.t === 'quiz') this.playQuiz(step);
      else if(['inspect','minigame','cinema','card','loadout','relay'].includes(step.t)) this.runStep();
      else this.startChallenge(step);
    },
      clearNext() { if (this.clearNextId) this.startStage(this.clearNextId); else this.show('story'); },
    };
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
