/* Web clubhouse: the mini-game's navigation, loadouts and skill study in accessible DOM. */
(function (G) {
  'use strict';
  const Y = G.YY, A = G.App, P = Y.Profile;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rich = text => (Y.richText(text || '')).map(x => x.k ? `<em class="rt-${x.k}">${esc(x.t)}</em>` : esc(x.t)).join('');
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem('yuyue.web.' + key)) ?? fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem('yuyue.web.' + key, JSON.stringify(value)); } catch (_) {} };
  const portrait = id => Y.CharacterSprites.url(id, 'portrait');
  const avatar = id => Y.CharacterSprites.url(id, 'avatar');
  const icon = id => Y.SkillIcons.svg(id);
  const roles = ['全部', '强攻', '控场', '灵动', '技巧'];
  const levels = {easy:'简单',normal:'普通',hard:'困难',nightmare:'噩梦'};
  const validChar = id => Y.CHARS.some(c => c.id === id);
  const quick = read('quick', {});
  const state = A.webUI = {
    role:'全部', peek:P.sel.char, level:levels[quick.level] ? quick.level : 'normal',
    opponent:validChar(quick.opponent) ? quick.opponent : 'random', opponentKit:validChar(quick.opponent)&&Array.isArray(quick.kit)&&quick.kit.length===2&&new Set(quick.kit).size===2&&quick.kit.every(k=>Y.char(quick.opponent).acts.includes(k)) ? quick.kit : null,
    gearOwner:P.sel.char, gearTab:'racket', gearPeek:null, armoryBack:'menu',
    training:Y.cleanTrain(read('training', {...Y.TRAIN_DEFAULT,char:P.sel.char})),
    trainMode:Y.cleanCourtMode(read('trainMode', A.settings.courtMode)),
    skill:null, skillMode:A.settings.courtMode, skillTab:'effect', skillBack:'team', skillTime:0, playing:true, speed:1,
    reduced:read('reducedMotion', G.matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
  const gearArt = Y.createGearArt(Y);
  const skillNames = id => P.kit(id).map(k => Y.SKILLS[k].short).join(' / ');
  const gearNames = id => { const g = P.gear(id); return [g.racket,g.string,g.shoe].map(k => Y.gear(k).name).join(' · ') + ` · ${g.tension} 磅`; };
  const tags = fx => Y.fxTags(fx).map(t => `<i class="${t.good?'g':'b'}">${esc(t.text)}</i>`).join('') || '<i>均衡手感</i>';
  const face = id => `<img src="${avatar(id)}" alt=""><span><b>${esc(Y.charName(id))}</b><small>${esc(Y.char(id).title)}</small><em>${esc(skillNames(id))}</em></span>`;
  const choices = (items, selected, attr) => items.map(([id,name]) => `<button ${attr}="${id}" aria-pressed="${selected===id}">${esc(name)}</button>`).join('');
  const charButtons = (selected, attr, filter = '全部', random = false) => (random ? `<button class="char-btn random-char ${selected==='random'?'on':''}" ${attr}="random" aria-pressed="${selected==='random'}"><strong>?</strong><span>随机球友</span></button>` : '') + Y.CHARS.filter(c => filter==='全部' || Y.characterRole(c.id)===filter).map(c => `<button class="char-btn ${selected===c.id?'on':''}" ${attr}="${c.id}" aria-pressed="${selected===c.id}" title="${esc(c.title)}"><img src="${avatar(c.id)}" alt="" loading="lazy"><span>${esc(Y.charName(c.id))}</span><small>${Y.characterRole(c.id)}</small></button>`).join('');
  const stamp = text => { $('webStatus').textContent = text; clearTimeout(state.statusTimer); state.statusTimer = setTimeout(() => { $('webStatus').textContent=''; }, 2600); };

  $('ui').insertAdjacentHTML('beforeend', `<section id="scr-kit" class="screen panel-screen hidden"><div class="panel wide"><header class="ph"><button class="icon-btn" id="kitCancel" aria-label="返回"><svg><use href="#i-back"/></svg></button><div><small>LOADOUT / SKILLS</small><h2 id="kitTitle">携带技能</h2></div></header><p class="note">被动始终生效；从三个主动技能中选择两个，依次对应 I / O。</p><div id="kitSlots" class="kit-slots"></div><div id="kitChoices" class="kit-choices"></div><footer class="page-action"><p id="kitNote" class="note"></p><button id="kitConfirm" class="btn primary big">保存搭配</button></footer></div></section><div id="webStatus" role="status" aria-live="polite"></div>`);

  function renderHome() {
    const id=P.sel.char,c=Y.char(id),done=Y.STAGES.filter(s=>P.storyStars(s.id)>0).length;
    $('homeCharacter').src=portrait(id); $('homeCharacter').alt=Y.charName(id)+'角色立绘';
    $('homeName').textContent=Y.charName(id); $('homeRole').textContent=Y.characterRole(id)+' / 当前出战'; $('homeTitle').textContent=c.title;
    const next=Y.STAGES.find(s=>!P.storyStars(s.id)) || Y.STAGES[Y.STAGES.length-1];
    $('homeChapter').textContent=next.chapter.title;
    $('homeProgress').textContent=done ? `${done} / ${Y.STAGES.length} 节 · 继续故事 →` : '从一间穿线铺开始 →';
    $('menuVenue').textContent='羽跃对决 · WEB / 1.32';
  }
  function renderBattle() {
    $('battleLoadout').innerHTML=`<span class="eyebrow">当前出战</span><b>${esc(Y.charName(P.sel.char))} <small>${skillNames(P.sel.char)}</small></b><p>${A.settings.courtMode.toUpperCase()} · ${A.settings.target} 分制 · ${levels[state.level]}难度</p>`;
  }
  A.renderLoadout = function () {
    $('loMe').innerHTML=face(P.sel.char);
    $('aiOpponent').innerHTML='<option value="random">随机对手</option>'+Y.CHARS.map(c=>`<option value="${c.id}">${esc(Y.charName(c.id))}</option>`).join('');
    $('aiOpponent').value=state.opponent;
    $('quickOpponent').innerHTML=state.opponent==='random'?'<span class="random-avatar">?</span><span><b>随机球友</b><small>从其余角色中随机挑选</small><em>点击选择对手 ↗</em></span>':face(state.opponent);
    $('quickOpponentKit').disabled=state.opponent==='random';
    $('quickOpponentKit').textContent=state.opponent==='random'?'随机角色 · 随机技能':state.opponentKit?'对手技能：'+state.opponentKit.map(k=>Y.SKILLS[k]?.short||'').join(' / '):'对手技能：随机搭配 ↗';
    updateQuick();
  };
  function updateQuick() {
    document.querySelectorAll('[data-quick-level]').forEach(b=>{b.classList.toggle('on',b.dataset.quickLevel===state.level);b.setAttribute('aria-pressed',b.dataset.quickLevel===state.level);});
    $('quickSummary').textContent=`${A.settings.courtMode.toUpperCase()} · ${A.settings.target} 分制 · ${levels[state.level]} · ${A.settings.skills?'技能开启':'纯技术对决'}`;
    save('quick',{level:state.level,opponent:state.opponent,kit:state.opponentKit});
  }
  function startQuick() { state.trial=null; A.startAI(state.level,{opp:state.opponent,kit:state.opponentKit}); }

  A.renderTeam = function () {
    const id=validChar(state.peek)?state.peek:P.sel.char,c=Y.char(id),selected=id===P.sel.char;
    $('rosterFilters').innerHTML=choices(roles.map(r=>[r,r]),state.role,'data-web-role');
    $('charList').innerHTML=charButtons(id,'data-web-char',state.role);
    $('rosterCount').textContent=`${$('charList').children.length} 位球友 · 自由对战全角色开放`;
    $('charDetail').innerHTML=`<div class="character-stage"><span class="eyebrow">${Y.characterRole(id)} / ${selected?'当前出战':'角色预览'}</span><span class="character-number">${String(Y.CHARS.indexOf(c)+1).padStart(2,'0')}</span><img src="${portrait(id)}" alt="${esc(Y.charName(id))}立绘"><div class="character-heading"><small>${esc(c.title)}</small><h3>${esc(Y.charName(id))}</h3></div></div><div class="character-copy"><p class="character-bio">${esc(c.bio)}</p><div class="character-actions"><button class="btn primary" data-web-equip-char="${id}" ${selected?'disabled':''}>${selected?'正在出战':'设为出战'}</button><button class="btn" data-web-owner-gear="${id}">器械搭配 ↗</button></div><div class="section-label"><b>技能</b><button class="text-btn" data-web-kit="${id}">携带 ${skillNames(id)} · 调整 ↗</button></div><div class="character-skills">${[c.passive,...c.acts].map(k=>{const sk=Y.SKILLS[k];return `<button class="skill-row" data-web-skill="${k}">${icon(k)}<span><b>${esc(sk.name)}</b><small>${sk.passive?'被动 · 始终生效':P.kit(id).includes(k)?'已携带 · '+sk.cost+' 能量':'主动 · '+sk.cost+' 能量'}</small></span><i>↗</i></button>`;}).join('')}</div><div class="cd-tags">${tags(c.fx)}</div></div>`;
  };
  function openPicker(title, value, back, commit, random=false) {
    state.picker={title,value,back,commit,random};A.show('roster');
  }
  function renderPicker() {
    const p=state.picker;
    $('rosterTitle').textContent=p.title;
    $('pickerGrid').innerHTML=charButtons(p.value,'data-web-pick','全部',p.random);
    $('pickerPreview').innerHTML=p.value==='random'?'<div class="random-stand">?</div><h3>随机球友</h3><p>开赛时随机选择角色与技能组合，每场都有新鲜感。</p>':`<img src="${portrait(p.value)}" alt="${esc(Y.charName(p.value))}立绘"><small>${Y.characterRole(p.value)}</small><h3>${esc(Y.charName(p.value))}</h3><p>${esc(Y.char(p.value).title)}</p><p>${esc(skillNames(p.value))}</p>`;
    $('rosterConfirm').textContent='确认选择 · '+(p.value==='random'?'随机球友':Y.charName(p.value));
  }
  function openKit(id, value, back, commit) { state.kit={id,value:[...value],back,commit}; A.show('kit'); }
  function renderKit() {
    const k=state.kit,c=Y.char(k.id);
    $('kitTitle').textContent=Y.charName(k.id)+' · 携带技能';
    $('kitSlots').innerHTML=[0,1].map(i=>`<div><kbd>${i?'O':'I'}</kbd>${k.value[i]?icon(k.value[i]):'<span>＋</span>'}<b>${k.value[i]?esc(Y.SKILLS[k.value[i]].name):'选择一个技能'}</b></div>`).join('');
    $('kitChoices').innerHTML=c.acts.map(id=>`<button class="kit-choice" data-web-kit-toggle="${id}" aria-pressed="${k.value.includes(id)}">${icon(id)}<b>${esc(Y.SKILLS[id].name)}</b><small>${Y.SKILLS[id].cost} 能量</small><p>${rich(Y.skillGuide(id,A.settings.courtMode).summary)}</p><strong>${k.value.includes(id)?'已选择 · 点击移除':'选择此技能'}</strong></button>`).join('');
    $('kitNote').textContent=k.value.length===2?'已选好两个技能，可以保存。':'再选 '+(2-k.value.length)+' 个技能。';
    $('kitConfirm').disabled=k.value.length!==2;
  }
  function openArmory(id,back) { state.gearOwner=id;state.armoryBack=back;state.gearPeek=null;A.show('armory'); }
  function gearImage(item,w,h,variant='thumb') { return gearArt.art(item,w,h,Math.min(G.devicePixelRatio||1,2),variant).toDataURL(); }
  function renderArmory() {
    const id=state.gearOwner,g=P.gear(id),cat=state.gearTab;
    $('armoryOwner').textContent=Y.charName(id)+' · 每个角色独立保存器械搭配';
    $('gearTabs').innerHTML=choices(Object.entries(Y.GEAR_CATS).map(([k,v])=>[k,v]),cat,'data-web-gear-tab');
    if(cat==='tension') {
      state.gearPeek=typeof state.gearPeek==='number'?state.gearPeek:g.tension;
      $('gearList').innerHTML=`<div class="tension-control"><span class="eyebrow">STRING TENSION</span><h3>把磅数调到顺手</h3><label for="webTension">拉线磅数 <b id="tensionValue">${state.gearPeek}</b> lbs</label><input id="webTension" type="range" min="${Y.TENSION.min}" max="${Y.TENSION.max}" step="1" value="${state.gearPeek}"><div class="range-label"><span>20 · 更弹、更宽容</span><span>30 · 更硬、更精准</span></div><p>磅数会同时影响甜区、力量需求和控球。适合自己的手感，比更高的数字重要。</p></div>`;
    } else {
      if(!Y.GEAR[cat].some(x=>x.id===state.gearPeek))state.gearPeek=g[cat];
      $('gearList').innerHTML=Y.GEAR[cat].map(item=>`<button class="gear-item ${state.gearPeek===item.id?'on':''}" data-web-gear="${item.id}" aria-pressed="${state.gearPeek===item.id}"><img src="${gearImage(item,90,90)}" alt=""><span><b>${esc(item.name)}</b><small>${esc(item.spec)}</small><em>${g[cat]===item.id?'已装备':esc(gearArt.tier(item).name)}</em></span></button>`).join('');
    }
    renderGearDetail();
  }
  function renderGearDetail() {
    const id=state.gearOwner,cat=state.gearTab,g=P.gear(id),value=state.gearPeek,tension=cat==='tension',item=tension?null:Y.gear(value),equipped=g[cat]===value;
    const current=Y.buildStats({char:id,...g}),preview=Y.buildStats({char:id,...g,[cat]:value});
    $('gearDetail').innerHTML=`<div class="gear-display">${tension?'<canvas id="tensionDial" width="280" height="240"></canvas>':`<img src="${gearImage(item,300,250,'stage')}" alt="${esc(item.name)}">`}<span class="eyebrow">${tension?'TENSION / 磅数':esc(gearArt.tier(item).name)+' / '+Y.GEAR_CATS[cat]}</span></div><h3>${tension?value+' 磅':esc(item.name)}</h3><p>${esc(tension?Y.tensionNote(value):item.desc)}</p><div class="cd-tags">${tags(tension?Y.tensionFx(value):item.fx)}</div><div class="gear-stats">${Y.STAT_VIEW.map(([name,f])=>{const v=Math.round(f(preview)*100),before=Math.round(f(current)*100),d=v-before;return `<div><span>${name}</span><meter min="65" max="140" value="${v}">${v}</meter><b>${v}<small class="${d>=0?'g':'b'}">${d?(d>0?'+':'')+d:'—'}</small></b></div>`;}).join('')}</div><p class="note">100 为标准属性；右侧变化与当前装备比较。</p><button id="equipGear" class="btn primary" ${equipped?'disabled':''}>${equipped?'已经装备':'装备给 '+esc(Y.charName(id))}</button>`;
    if(tension)gearArt.dial($('tensionDial').getContext('2d'),140,118,96,value);
    $('equipGear').onclick=()=>{P.setGear(id,cat,value);renderArmory();stamp('已保存 '+Y.charName(id)+' 的器械搭配');};
  }

  function openSkill(id,back='team') { state.skill=id;state.skillBack=back;state.skillTime=0;state.skillTab='effect';state.playing=!state.reduced;A.show('skill'); }
  function renderSkill() {
    const sk=Y.SKILLS[state.skill],info=Y.skillGuide(state.skill,state.skillMode),c=Y.char(info.owner);
    $('skillHeading').textContent=Y.charName(info.owner)+' · '+sk.name;
    $('skillModes').innerHTML=choices([['2d','2D 横版'],['3d','3D 纵深']],state.skillMode,'data-web-skill-mode');
    $('skillTabs').innerHTML=choices([['effect','技能效果'],['operation','操作教学'],['limits','条件与限制']],state.skillTab,'data-web-skill-tab');
    $('skillStages').innerHTML=(info.steps||['准备','发动','回位']).map((s,i)=>`<button data-web-stage="${i}"><small>0${i+1}</small><span>${esc(s)}</span></button>`).join('');
    $('skillSiblings').innerHTML=[c.passive,...c.acts].map(k=>`<button data-web-sibling="${k}" aria-pressed="${k===state.skill}">${icon(k)}<span>${esc(Y.SKILLS[k].short)}</span></button>`).join('');
    const tab=state.skillTab;
    $('skillText').innerHTML=`<span class="eyebrow">${sk.passive?'被动技能 · 始终生效':sk.cost+' 能量 / 主动技能'}</span><h3>${esc(sk.name)}</h3>${(tab==='effect'?[['技能效果',info.summary],['使用思路',info.tactic]]:tab==='operation'?[['如何操作',info.operation],['释放条件',info.condition]]:info.performance).map(([h,p])=>`<section><h4>${esc(h)}</h4><p>${rich(p)}</p></section>`).join('')}`;
    $('skillPlay').textContent=state.playing?'暂停演示':'播放演示'; $('skillSpeed').textContent=state.speed===1?'速度 1×':'慢放 0.5×';
    const preparing=A.teamBack==='matching'&&A.matchRoom?.phase==='lobby';
    $('skillTry').disabled=preparing; $('skillTry').textContent=preparing?'匹配准备中，暂不试招':'进入训练场 · 试一试';
    $('skillDemo').setAttribute('aria-label',`${sk.name} ${state.skillMode} 技能机制示意`);
    drawSkill(0);
  }
  function drawSkill(dt) {
    if(state.playing)state.skillTime+=dt*state.speed;
    const cv=$('skillDemo');
    Y.drawSkillGuidePreview(cv.getContext('2d'),state.skill,state.skillMode,0,0,cv.width,cv.height,state.skillTime);
    const stage=Math.floor(state.skillTime%6/2);
    $('skillStages').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('on',i===stage);b.setAttribute('aria-pressed',i===stage);});
  }
  function renderTraining() {
    const c=state.training,labels={type:'来球类型',depth:'落点区域',height:'飞行弧线',speed:'来球速度',gap:'喂球间隔'};
    $('trainingSetup').innerHTML=`<div class="training-profile"><button class="opponent-card" id="trainingCharacter">${face(c.char)}</button><p>带上该角色已保存的技能和器械，自由练习。</p><div class="segmented">${choices([['2d','2D 横版'],['3d','3D 纵深']],state.trainMode,'data-web-train-mode')}</div><button class="btn" data-web-training-kit>调整携带技能</button></div><div class="training-controls">${Object.entries(Y.TRAIN_OPTIONS).map(([key,opts])=>`<label>${labels[key]}<select data-web-training="${key}">${opts.map(([v,n])=>`<option value="${v}" ${c[key]===v?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}<fieldset><legend>练习辅助</legend>${[['skills','角色技能'],['freeEnergy','无限能量'],['freeStamina','无限体力'],['hint','落点提示']].map(([key,n])=>`<label><span>${n}</span><input type="checkbox" data-web-training="${key}" ${c[key]?'checked':''}></label>`).join('')}</fieldset></div>`;
    $('trainingCharacter').onclick=()=>openPicker('训练角色',c.char,'training',id=>{state.training.char=id;save('training',state.training);});
  }

  const show=A.show;
  A.show=function(name) {
    const from=this.screen;
    if(name==='team'&&from!=='skill'&&from!=='kit'&&from!=='armory')state.peek=P.sel.char;
    if(name==='armory'&&from==='menu'){state.gearOwner=P.sel.char;state.armoryBack='menu';state.gearPeek=null;}
    if(name==='help'&&from==='settings')state.helpBack='settings';
    if(name==='menu'&&from==='help'&&state.helpBack){name=state.helpBack;state.helpBack=null;}
    if(name==='settings'&&from!=='help')state.settingsBack=from==='pause'?'pause':'menu';
    if(name==='menu')renderHome();
    if(name==='battle')renderBattle();
    if(name==='armory')renderArmory();
    if(name==='roster')renderPicker();
    if(name==='kit')renderKit();
    if(name==='skill')renderSkill();
    if(name==='training')renderTraining();
    show.call(this,name);
    if(name&&from!==name){const panel=$('scr-'+name)?.querySelector('.panel');if(panel)panel.scrollTop=0;const heading=$('scr-'+name)?.querySelector('h2,h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
    this.checkRotate();
  };
  // The menu supports portrait browsing; ask for landscape only on the court.
  const rotate=A.checkRotate;
  A.checkRotate=function(){if(this.screen){$('rotate').classList.add('hidden');return;}rotate.call(this);};
  const render=A.render;
  A.render=function(dt){render.call(this,dt);if(this.screen==='skill')drawSkill(Math.min(this.rawDt||dt||0,0.05));};
  const quit=A.quit;
  A.quit=function(){const mode=this.mode,drill=this.drill,trial=state.trial;quit.call(this);if(mode==='practice'||mode==='ai'){if(trial){state.trial=null;this.show('skill');}else this.show(mode==='practice'?(drill==='train'?'training':'practice'):'ai');}else if(mode==='local')this.show('friend');};
  // A training restart retains the chosen court and trial kit.
  const restart=A.restart;
  A.restart=function(){if(this.mode==='practice'&&this.drill==='train'){this.paused=false;this.startTraining(this.trainCfg,state.trainingPreview||{courtMode:state.trainMode});return;}restart.call(this);};

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.webRole){state.role=d.webRole;A.renderTeam();}
    if(d.webChar){state.peek=d.webChar;A.renderTeam();}
    if(d.webEquipChar){P.choose('char',d.webEquipChar);A.renderTeam();stamp('已设为出战：'+Y.charName(d.webEquipChar));}
    if(d.webOwnerGear)openArmory(d.webOwnerGear,'team');
    if(d.webArmory)openArmory(P.sel.char,d.webArmory);
    if(d.webKit)openKit(d.webKit,P.kit(d.webKit),'team',kit=>P.setKit(d.webKit,kit));
    if(d.webSkill)openSkill(d.webSkill);
    if(d.webPick){state.picker.value=d.webPick;renderPicker();}
    if(d.webKitToggle){const k=state.kit;if(k.value.includes(d.webKitToggle))k.value=k.value.filter(id=>id!==d.webKitToggle);else if(k.value.length<2)k.value.push(d.webKitToggle);else{stamp('先移除一个已选技能，再选择新技能');return;}renderKit();}
    if(d.webGearTab){state.gearTab=d.webGearTab;state.gearPeek=null;renderArmory();}
    if(d.webGear){state.gearPeek=d.webGear;renderArmory();}
    if(d.webSkillMode){state.skillMode=d.webSkillMode;state.skillTime=0;renderSkill();}
    if(d.webSkillTab){state.skillTab=d.webSkillTab;renderSkill();}
    if(d.webSibling){state.skill=d.webSibling;state.skillTime=0;renderSkill();}
    if(d.webStage!==undefined){state.skillTime=Number(d.webStage)*2+0.5;state.playing=false;renderSkill();}
    if(d.quickLevel){state.level=d.quickLevel;updateQuick();}
    if(d.webTrainMode){state.trainMode=d.webTrainMode;save('trainMode',state.trainMode);renderTraining();}
    if(d.webTrainingKit!==undefined)openKit(state.training.char,P.kit(state.training.char),'training',kit=>P.setKit(state.training.char,kit));
    if(d.target||d.courtMode)updateQuick();
  });
  document.addEventListener('change',e=>{
    const el=e.target,key=el.dataset.webTraining;
    if(key){state.training[key]=el.type==='checkbox'?el.checked:el.value;save('training',state.training);}
    if(el.id==='aiOpponent'){state.opponent=el.value;state.opponentKit=null;A.renderLoadout();}
    if(el.id==='optSkill')updateQuick();
  });
  document.addEventListener('input',e=>{if(e.target.id==='webTension'){state.gearPeek=Number(e.target.value);$('tensionValue').textContent=state.gearPeek;renderGearDetail();}});
  $('quickStart').onclick=$('battleQuick').onclick=startQuick;
  $('quickOpponent').onclick=()=>openPicker('选择对手',state.opponent,'ai',id=>{state.opponent=id;state.opponentKit=null;},true);
  $('quickOpponentKit').onclick=()=>{if(validChar(state.opponent))openKit(state.opponent,state.opponentKit||Y.char(state.opponent).acts.slice(0,2),'ai',kit=>{state.opponentKit=kit;});};
  $('rosterCancel').onclick=()=>A.show(state.picker.back);
  $('rosterConfirm').onclick=()=>{const p=state.picker;p.commit(p.value);A.show(p.back);};
  $('kitCancel').onclick=()=>A.show(state.kit.back);
  $('kitConfirm').onclick=()=>{if(state.kit.value.length!==2)return;state.kit.commit([...state.kit.value]);A.show(state.kit.back);stamp('技能搭配已保存');};
  $('armoryBack').onclick=()=>A.show(state.armoryBack);
  $('gearRecommended').onclick=()=>{P.resetGear(state.gearOwner);state.gearPeek=null;renderArmory();stamp('已应用角色推荐器械');};
  $('skillBack').onclick=()=>A.show(state.skillBack);
  $('skillPlay').onclick=()=>{state.playing=!state.playing;renderSkill();};
  $('skillReplay').onclick=()=>{state.skillTime=0;state.playing=true;renderSkill();};
  $('skillSpeed').onclick=()=>{state.speed=state.speed===1?.5:1;renderSkill();};
  $('skillTry').onclick=()=>{
    const info=Y.skillGuide(state.skill,state.skillMode),kit=[...P.kit(info.owner)];
    if(!Y.SKILLS[state.skill].passive&&!kit.includes(state.skill))kit[0]=state.skill;
    state.trial={skill:state.skill};state.trainingPreview={courtMode:state.skillMode,kit};
    A.startTraining({...Y.TRAIN_DEFAULT,char:info.owner,freeEnergy:true,freeStamina:true},state.trainingPreview);
  };
  $('trainingStart').onclick=()=>{state.trial=null;state.trainingPreview={courtMode:state.trainMode};A.startTraining(state.training,state.trainingPreview);};
  $('settingsBack').onclick=()=>A.show(state.settingsBack||'menu');
  $('settingsFull').onclick=()=>A.toggleLandscape();
  $('optReducedMotion').checked=state.reduced;
  document.documentElement.classList.toggle('reduce-motion',state.reduced);
  $('optReducedMotion').onchange=e=>{state.reduced=e.target.checked;save('reducedMotion',state.reduced);document.documentElement.classList.toggle('reduce-motion',state.reduced);};

  if(Y.MATCH_CONFIG?.accountEnabled===false){
    const local=document.createElement('button');local.className='cloud-menu-entry';
    local.innerHTML='<span>本机存档</span><small>自动保存 · 羽毛册 ↗</small>';local.onclick=()=>A.show('journal');
    document.querySelector('.club-profile').append(local);
    document.querySelector('#scr-settings .settings-grid .note').textContent='故事进度、角色与器械搭配自动保存在当前浏览器中。';
  }

  // Mount the existing controls in the same order as the mini-game's preparation page.
  const mount=document.querySelector('[data-court-mount="ai"]');
  document.querySelectorAll('#scr-ai .court-mode-picker,#scr-ai .court3d-note').forEach(el=>mount.append(el));
  document.querySelector('#scr-practice .ph [data-go]').dataset.go='battle';
  const pauseActions=$('scr-pause').querySelector('.stack');
  if(pauseActions){const b=document.createElement('button');b.className='btn';b.textContent='设置';b.onclick=()=>A.show('settings');pauseActions.append(b);}
  // Selection pages are keyboard-operable without intercepting game controls.
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!A.screen||A.inGame())return;const backs={roster:'rosterCancel',kit:'kitCancel',skill:'skillBack',armory:'armoryBack',settings:'settingsBack',team:'btnTeamBack'};const id=backs[A.screen];if(id){$(id).click();e.preventDefault();}});
})(window);
