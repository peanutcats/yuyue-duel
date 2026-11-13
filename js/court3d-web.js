/* Web 入口：赛前模式选择、教学、房主模式同步。 */
(function(G){
  'use strict';const Y=G.YY,A=G.App;if(!A)return;
  A.setCourtMode=function(mode){this.settings.courtMode=Y.cleanCourtMode(mode);try{Y.platform.setStorage('yuyue.courtMode',JSON.stringify(this.settings.courtMode));}catch(_){}document.querySelectorAll('[data-court-mode]').forEach(b=>{const on=b.dataset.courtMode===this.settings.courtMode;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});document.querySelectorAll('.court3d-note').forEach(p=>p.hidden=this.settings.courtMode!=='3d');};
  for(const id of['ai','friend']){
    const panel=document.querySelector('#scr-'+id+' .panel');if(!panel)continue;
    const choice=document.createElement('div');choice.className='court-mode-picker';choice.setAttribute('role','group');choice.setAttribute('aria-label','对战模式');
    choice.innerHTML='<button type="button" data-court-mode="2d"><svg viewBox="0 0 80 46" aria-hidden="true"><path d="M4 35h72M40 35V12M38 12h4M18 35V23m-5 2 5-2 7 3M62 35V23m-7 3 7-3 5 2"/></svg><span><b>2D 横版</b><small>经典节奏 · 侧视对决</small></span></button><button type="button" data-court-mode="3d"><svg viewBox="0 0 80 46" aria-hidden="true"><path d="m21 6-15 34h68L59 6ZM13 24h54M16 17h48M16 17v9m48-9v9M40 6v11m0 7v16M11 34h58"/></svg><span><b>3D 纵深</b><small>固定摇杆 · 触球定向</small></span><em>NEW</em></button>';
    const head=panel.querySelector('.ph');if(head)head.after(choice);else panel.prepend(choice);
    const note=document.createElement('p');note.className='court3d-note';note.textContent=id==='friend'?'房主选择模式，好友自动同步。同屏共用纵深视角；双方各自控制移动与落点。':'固定摇杆走位兼定向，点按出拍；触球时向两侧推杆打斜线，松杆打直线。';choice.after(note);
    choice.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>A.setCourtMode(b.dataset.courtMode)));
  }
  A.setCourtMode(A.settings.courtMode);
  const reset=A.reset.bind(A);A.reset=function(){reset();document.getElementById('touch').className='';this._courtSetup=null;};
  A.setupCourtControls=function(mode){
    const is3D=mode==='3d',duo=this.mode==='local',mirror=this.mode==='guest'||(this.mode==='online'&&this.playerIndex===1);
    if(!is3D)return;
    this.ctrlFor.forEach((c,i)=>{if(c)Y.configureCourtCtrl(c,i,duo,mirror);});
    if(Y.isTouch())Y.buildTouch3D(document.getElementById('touch'),this.ctrlFor.filter(Boolean),duo,this._kit);
    this._courtSetup='3d';
  };
  const enter=A.enterGame.bind(A);A.enterGame=function(...args){enter(...args);this.setupCourtControls(this.match?.courtMode);};
  const local=A.startLocal.bind(A);A.startLocal=function(){local();if(this.match?.courtMode==='3d')this.R.showBanner('3D 同屏对决','P1 WASD · F/G/H　P2 方向键 · , . /　固定摇杆，点按出拍','#ffd23f',2.5);};
  const guest=A.guestMsg.bind(A);A.guestMsg=function(d){
    if(d?.t==='st'&&this.mode==='guest'){
      const mode=d.d3?'3d':'2d';
      if(this._courtSetup!==mode){
        this._courtSetup=mode;
        if(mode==='3d')this.setupCourtControls(mode);
        else{this.ctrlFor[1]=this.soloCtrl(true);this.R.showBanner('2D 横版对决','房主已选择经典横版模式','#7dfcff',2);}
      }
    }guest(d);
  };
  const send=A.sendGuestInput.bind(A);A.sendGuestInput=function(){
    const c=this.ctrlFor[1];if(!c?.court3D)return send();
    for(const a of c.drain()){const i=['jump','clear','drop','smash'].indexOf(typeof a==='string'?a:a.btn);if(i>=0)this.guestCounts[i]++;}
    const move=c.move(),z=c.strafe(),key=JSON.stringify([move,z,this.guestCounts]);
    if(this.sendT<=0||key!==this.last3DInput){Y.Net.send({t:'in',m:move,z,c:this.guestCounts.slice()});this.last3DInput=key;this.sendT=.025;}
  };
  const render=A.render.bind(A);A.render=function(dt){render(dt);if(this.screen==='team'&&Y.drawSkillModePreview){document.querySelectorAll('details[open] canvas[data-skill-preview]').forEach(cv=>{const g=cv.getContext('2d');Y.drawSkillModePreview(g,cv.dataset.skillPreview,this.skillInfoMode||this.settings.courtMode,0,0,cv.width,cv.height,performance.now()/1000);});}};
})(window);
