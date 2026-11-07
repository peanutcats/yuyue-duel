/* Shared match and story orchestration. Both browser and WeChat use these methods. */
(function (G) {
  'use strict';
  G.YY.createGameplay = function (schedule) {
    const YY = G.YY, C = YY.C, A = YY.Audio;
    const setTimeout = schedule || ((fn, ms) => G.setTimeout(fn, ms));
    const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt((hex + '000000').slice(i, i + 2), 16) || 255).join(',');
    // 装置完成回球时的弹字
    /** 器械特性触发时给自己的小字提示（移动类特性只有地板特效，不打字，避免刷屏） */
const GEAR_POP = { pressReady: '压后再杀 · 下一拍跳杀更快', press: '压后再杀！', tide: (e) => '长回合呼吸 +' + e.n + ' 体力', third: '第三种答案', counter: '借势反抽', calm: '稳住呼吸' };
const GEAR_POP_COL = { pressReady: '#ff9a72', press: '#ff7a52', tide: '#8ff0ff', third: '#ffe08a', counter: '#a9ffd4', calm: '#a6d4ec' };
const SKILL_POP = {
      yuyue: '鱼跃救球！', fanshe: '反射！', diban: '地板开球！', huiguo: '回锅再炒！', yueliang: '月下回旋！',
      xingmen: '星门穿越！', shensuo: '长拍暴击！', xuanpai: '旋风斩！', youyou: '悠悠回击！', yueqiu: '预约兑现！', shuangji: '冻住了！', jiewang: '借网弹射！', haomao: '小猴出手！',
      fuzhi: 'Ctrl+V！', jiezou: '一、二、一！', tingyixia: '看准了，走！',
    };
    // 释放台词（不配音，只飘字）
    const SKILL_QUOTES = {
      yuyue: ['扑过去！'], tafeng: ['再踩一脚'], fengkou: ['起风了'], chaolai: ['潮来了，地上有水'], tongyin: ['同饮一潮'], huichao: ['潮水退回去'],
      fanshe: ['入射角等于反射角'], zipao: ['自己喂自己'], pingyi: ['两点确定一条直线'], tangqiu: ['糖网挂好了'], hongxian: ['红丝带，去！'], jiewang: ['借你的网一用'],
      diban: ['地板开球！', '墙都给你立好了'], huiguo: ['回锅！'], baozi: ['尝尝我的大肉包', '先存着，待会儿还你'], yueliang: ['月亮借你看看'], xingmen: ['星星连成门'], zhongli: ['重力换班', '星星会往下掉'],
      shensuo: ['长！'], xuanpai: ['转起来'], youyou: ['悠——回来'], jindou: ['筋斗云——起！', '俺老猴来也'], dangteng: ['喔——！'], haomao: ['去吧，小的们'],
      fuzhi: ['Ctrl+C'], fanghuo: ['防火墙已开启'], bug: ['这不是 Bug，是特性'], yati: ['Ctrl+H，全部替换'], yueqiu: ['老位置，约好了'], shuangji: ['冻结窗格'],
      ganggan: ['这一分我押了！'], jiepan: ['红包雨！'], qiquan: ['一掷千金！'], jingxiang: ['看清楚了吗？'], meida: ['美的你'], shuizhong: ['水中捞月'],
      jiezou: ['一、二、一！跟着我'], biaozhi: ['绕过去'], tingyixia: ['停一下，看站位'],
    };
    return {
      ...YY.storyActions,
      /** 我方出战配置：故事模式只能用已解锁的器械；其他模式器械自由搭配 */
      myLoadout(avoid, as) {
      const free = this.mode !== 'story';
      const pack = (id, forced, gear = free ? YY.Profile.gear(id) : YY.Profile.storyGear(id)) => ({ id, gear, stats: YY.buildStats(Object.assign({ char: id }, gear)), skill: YY.skillSet(id, YY.Profile.kit(id)), look: YY.lookOf(id), forced });
      if (as && YY.CHARS.some(c => c.id === as)) return pack(as, true); // 剧情指定上场的队友：保留自己的装备
      let id = YY.Profile.sel.char;
      if (!YY.Profile.has('char', id)) id = 'lingfeng';
      if (id === avoid) return pack(id === 'lingfeng' ? 'canglan' : 'lingfeng'); // 与对手同一角色时换人（带上替补自己的器械搭配）
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
      const oppId = fixed && fixed !== mine.id ? fixed : pool[Math.floor(Math.random() * pool.length)].id;
      const opp = this.oppLoadout(oppId, true, fixed === oppId ? setup.kit : null);
      const skills = this.settings.skills;
      this.match = new YY.Match({
        names: ['你', opp.look.name + ' · ' + lv.name], firstServer: 0,
        looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], gear: [mine.gear, opp.gear], skills: skills ? [mine.skill, opp.skill] : null,
      });
      this.ais = [new YY.AI(this.match, 1, this.level, opp.id)];
      this.ctrlFor[0] = this.soloCtrl(true, skills ? mine.skill.act : null);
      this.enterGame();
      const style = YY.AI_STYLES[opp.id];
      const oppKit = skills ? ' · 携带 ' + opp.skill.act.map(k => YY.SKILLS[k].name).join('、') : '';
      this.R.showBanner(opp.look.name + ' · ' + style.name, style.weakness + oppKit, '#ffd23f', 3.3);
    },
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
      startTraining(cfg) {
      cfg = this.trainCfg = YY.cleanTrain(cfg || this.trainCfg);
      this.reset();
      this.mode = 'practice';
      this.drill = 'train';
      const me = this.trainLoadout(cfg.char), kit = cfg.skills ? me.skill : null;
      this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [me.look, null], stats: [me.stats, null], gear: [me.gear, null], skills: kit ? [kit, null] : null });
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
      const P = m.players;
      switch (e.type) {
        case 'hit': {
          if (e.feed) { A.hit(0.5, false, e); break; }
          const smash = e.shot === 'smash' || e.shot === 'halfsmash';
          A.hit(e.q, smash || e.shot === 'kill', e);
          R.hitFx(e); R.gearHit?.(e, m);
          const p = P[e.p];
          if (smash) {
            R.popText((e.shot === 'halfsmash' ? '点杀 ' : '扣杀 ') + Math.round(e.speed * 3.6 * C.SPEED_DISPLAY) + ' km/h', e.x, e.y + 0.3, '#ffb347', e.shot === 'halfsmash' ? 1.05 : 1.35, 1.2);
          } else if (!e.serve || this.isMe(e.p)) {
            const col = e.q >= 0.85 ? '#7dffb0' : e.q >= 0.6 ? '#ffffff' : e.q >= 0.35 ? '#ffd23f' : '#ff9b7b';
            const show = this.isMe(e.p) || e.q >= 0.85 || e.weak;
            if (show) R.popText(e.name + (e.label ? ' · ' + e.label : ''), p.x, p.y + 2.25, col, 0.75, 1.0);
          }
          if (e.reason && this.isMe(e.p)) R.popText(e.reason + ' → ' + e.name, p.x, p.y + 2.75, '#ff9b7b', 0.7, 1.4);
          if (e.save) { R.popText('漂亮接杀！', p.x, p.y + 2.8, '#5cf2ff', 1.1, 1.3); }
          else if (e.lowSave) R.popText('极限救球！', p.x, p.y + 2.8, '#5cf2ff', 1.0, 1.2);
          if (e.skill && YY.SKILLS[e.skill]) { // 装置 / 技能完成的回球
            const sk = YY.SKILLS[e.skill], pop = SKILL_POP[e.skill] || sk.name;
            R.popText(pop, e.x, e.y + 0.5, sk.color, e.device ? 1.1 : 0.95, 1.0);
            R.burst(e.x, e.y, e.device ? 14 : 9, rgbOf(sk.color), 4.5, 0.04);
            if (e.big || e.skill === 'haomao' || e.skill === 'diban' || e.skill === 'xuanpai') R.shake = Math.max(R.shake || 0, e.big ? 1 : 0.8);
            if (e.big) R.ring?.(e.x, e.y, rgbOf(sk.color), 0.4, 0.7, false);
          }
          if (e.shot === 'kill') { R.popText('扑球！', e.x, e.y + 0.6, '#ff6b6b', 1.25, 1.0); }
          else if (e.shot === 'tumble' && (this.isMe(e.p) || e.q >= 0.85)) R.popText('搓球', e.x, e.y + 0.5, '#d2b4ff', 0.9, 0.9);
          if (e.tumbled && this.isMe(e.p)) R.popText('球在翻滚，难处理！', p.x, p.y + 3.2, '#d2b4ff', 0.75, 1.1);
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
          A.skill(e.id);
          R.skillCutIn(look, sk, (e.p === 0) !== R.mirror);
          // 发动反馈收在选手脚下：少量贴地火花 + 地面光环，不在半空炸开挡住来球
          R.burst(p.x, p.y + 0.5, 12, rgbOf(sk.color), 3.2, 0.04);
          R.ring(p.x, 0, rgbOf(sk.color), 0.5, 0.5, true);
          const line = SKILL_QUOTES[e.id];
          if (line) R.popText(line[Math.floor(m.time) % line.length], p.x, p.y + 2.9, '#ffffff', 0.55, 1.2);
          break;
        }
        case 'skillFail': if (this.isMe(e.p)) { const p = P[e.p]; R.popText(e.label, p.x, p.y + 2.6, '#ff9b7b', 0.75, 1.1); } break;
        case 'beat': A.blip?.(); break;
        case 'quake': R.shake = Math.max(R.shake || 0, 1.1); R.dust?.(e.x, 8); A.floor?.(); break;
        case 'slip': R.dust?.(P[e.p].x, 6); break;
        case 'fakeHit': A.hit?.(0.6, 0.5); R.burst(e.x, e.y, 10, '159,240,255', 5, 0.03); break;
        case 'skillProc': {
          const p = P[e.p], sk = YY.SKILLS[e.id]; if (!p) break;
          // tip：看懂了 / 运行日志 —— 只给本人看，字小但停留更久
          if (e.tip) { if (this.isMe(e.p) || this.mode === 'local') R.popText(e.label, p.x, p.y + 3.2, sk ? sk.color : '#ffd23f', 0.7, 2.6); break; }
          R.popText(e.label, p.x, p.y + 2.9, sk ? sk.color : '#ffd23f', 0.95, 1.2); A.ready?.(); break;
        }
        case 'blink': {
          const p = P[e.p];
          R.burst(e.from, 1, 18, '255,179,71', 5, 0.04); R.burst(e.to, 1, 22, '255,179,71', 6, 0.05);
          R.popText(e.swap ? '换位！' : e.undo ? 'Ctrl+Z' : '闪现！', e.to, p.y + 2.5, '#ffb347', 1.0, 0.9);
          break;
        }
        case 'skillReady': if (this.isMe(e.p)) { A.ready(); R.popText('技能就绪！按 ' + (YY.isTouch() ? '技能键' : 'I / O'), P[e.p].x, P[e.p].y + 2.6, '#ffd23f', 0.8, 1.4); } break;
        case 'pdone': if (this.mode === 'story') setTimeout(() => this.stepDone(e), 900); break;
        case 'tacticsDone': if (this.mode === 'story') setTimeout(() => this.stepDone({win:true,ok:3,att:e.attempts}),900); else setTimeout(() => this.finishTactics(), 1500); break;
        case 'swing': A.swing(e.btn); break;
        case 'whiff': { const p = P[e.p]; if (this.isMe(e.p) || this.mode === 'practice') R.popText(e.label, p.x, p.y + 2.3, '#ff7b7b', 0.8, 1.1); break; }
        case 'net': A.net(); R.netFx(e); break;
        case 'gear': { // 器械特性：特效人人可见，文字只提示自己（关键时刻）
          R.gearFx?.(e, m);
          const p = P[e.p], lbl = GEAR_POP[e.k];
          if (p && lbl && (this.isMe(e.p) || this.mode === 'local')) R.popText(typeof lbl === 'function' ? lbl(e) : lbl, p.x, p.y + 2.55, GEAR_POP_COL[e.k] || '#bfefff', 0.62, 1.0);
          break;
        }
        case 'jump': A.jump(); R.dust(P[e.p].x, 5); break;
        case 'land': A.land?.(); R.dust(P[e.p].x, 3); break;
        case 'tired': if (this.isMe(e.p)) R.popText(e.low ? '体力告急 · 步伐与挥拍变慢' : '体力不足 · 跳不高', P[e.p].x, P[e.p].y + 2.3, '#ff9b7b', 0.75, 1.3); break;
        case 'turn': R.skid?.(P[e.p], e.v); break;
        case 'read': R.popText('预判！', P[e.p].x, P[e.p].y + 2.3, '#ffd23f', 0.8, 1.0); break;
        case 'serveReady': R.trail = []; R.lastWinner = -1; break;
        case 'point': {
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
          A.whistle();
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
      this.saveStoryCheckpoint(S.resume && S.resume.index===S.i ? {line:S.resume.line,activity:S.resume.activity}:{});
      if (['dialog','quiz','pick','inspect','board','lab'].includes(step.t)) {
        if (this.mode !== 'attract') this.startAttract(S.st.chapter.venue);
        else if (this.R.venueId !== S.st.chapter.venue) this.R.setVenue(S.st.chapter.venue);
      }
      if (step.t === 'dialog') this.playDialog(step.lines.map(l=>[l[0],YY.storyText(l[1],S.ctx),l[2],l[3]]), () => this.nextStep(), step);
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
        return { scene: step.scene, cast: YY.storyCast(step, i), who: line[0], mood: line[2] || null, action:line[3], lineKey:step.uid+':'+i, talking, mm: step.lines.some((l) => l[0] === 'mm') };
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
      const venue = step.venue || S.st.chapter.venue;
      if (step.t === 'match') {
        const opp = this.oppLoadout(step.opp);
        const mine = this.myLoadout(step.opp, this.storyAs(step));
        const env = step.env ? Object.assign({}, step.env) : S.ctx.env ? Object.assign({}, S.ctx.env) : null;
        this.match = new YY.Match({
          names: ['你', opp.look.name], firstServer: 0, target: step.target || 7, cap: step.cap || 11,
          looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], gear: [mine.gear, null], skills: step.skills===false?null:[mine.skill, opp.skill], env,
        });
        if(step.startScore) this.match.score=[...step.startScore];
        if (step.oppEnergy && this.match.skillsOn) this.match.players[1].energy = step.oppEnergy;
        const difficulty = S.difficulty || 'story', plan = YY.storyAI(step,difficulty);
        const ai = new YY.AI(this.match, 1, plan.level, opp.id);
        if (plan.tuning) ai.L = { ...ai.L, ...plan.tuning };
        ai.storySkillInterval = plan.skillInterval;
        this.ais = [ai];
        this.ctrlFor[0] = this.soloCtrl(true, step.skills===false?null:mine.skill.act);
        if (step.dark) this.storyDark = { flash: 0, t: 3 };
        this.enterGame(venue);
        this.R.showBanner(`${opp.look.name} · ${YY.STORY_DIFFICULTIES[difficulty].name}`, (mine.forced ? `本场由你操控${mine.look.name} · ` : '') + (step.rule || YY.AI_STYLES[opp.id].weakness), '#ffd23f', 3.6);
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
      if (!step.as) return null;
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
      if (!S || !this.stepRes?.win) return;
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
      const step = S.st.steps[S.i];
      if (step.t === 'quiz') this.playQuiz(step);
      else if(['inspect','board','lab'].includes(step.t)) this.runStep();
      else this.startChallenge(step);
    },
      clearNext() { if (this.clearNextId) this.startStage(this.clearNextId); else this.show('story'); },
    };
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
