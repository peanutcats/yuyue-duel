/* 3D：固定摇杆 + 点按击球。出球方向由比赛核心在触球时采样。 */
(function (G) {
  'use strict';
  const Y=G.YY, I=Y.Input;
  const MAPS={
    solo:{left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],forward:['KeyW','ArrowUp'],back:['KeyS','ArrowDown'],jump:['Space'],clear:['KeyJ','KeyZ'],drop:['KeyK','KeyX'],smash:['KeyL','KeyC'],skill:['KeyI','KeyV'],skill2:['KeyO','KeyB']},
    p1:{left:['KeyA'],right:['KeyD'],forward:['KeyW'],back:['KeyS'],jump:['KeyR'],clear:['KeyF'],drop:['KeyG'],smash:['KeyH'],skill:['KeyT'],skill2:['KeyY']},
    p2:{left:['ArrowLeft'],right:['ArrowRight'],forward:['ArrowUp'],back:['ArrowDown'],jump:['Enter','Numpad0'],clear:['Comma','Numpad1'],drop:['Period','Numpad2'],smash:['Slash','Numpad3'],skill:['Semicolon'],skill2:['Quote']}
  };
  const P=Y.HumanCtrl.prototype, old={move:P.move,push:P.push,onKey:P.onKey};
  Y.configureCourtCtrl=function(c,idx,duo,mirror){
    c.court3D=true;c.playerIndex=idx;c.map=MAPS[duo?(idx?'p2':'p1'):'solo'];
    c.screenSign=mirror?-1:1;c.depthSign=(idx?-1:1)*c.screenSign;c.touchX=c.touchY=0;
  };
  P.move=function(){return this.court3D?Y.clamp((this.held(this.map.forward)?1:0)-(this.held(this.map.back)?1:0)+(this.touchY||0),-1,1)*this.depthSign:old.move.call(this);};
  P.strafe=function(){return this.court3D?Y.clamp((this.held(this.map.right)?1:0)-(this.held(this.map.left)?1:0)+(this.touchX||0),-1,1)*this.screenSign:0;};
  P.push=function(act,aim){
    if(!this.court3D)return old.push.call(this,act,aim);
    this.queue.push({btn:act});if(act in this.counts)this.counts[act]++;I.changed();
  };
  P.onKey=function(code){return old.onKey.call(this,code)||(this.court3D&&(this.map.forward.includes(code)||this.map.back.includes(code)));};
  const release=I.releaseAll.bind(I);
  I.releaseAll=function(){for(const c of this.ctrls)c.touchX=c.touchY=0;release();};
  Y.buildTouch3D=function(root,ctrls,duo,kits){
    root.innerHTML='';root.className='court3d-touch'+(duo?' duo':'');
    ctrls.forEach((c,i)=>{
      const group=document.createElement('div');group.className='court3d-control seat-'+i;root.appendChild(group);
      const pad=document.createElement('div');pad.className='court3d-stick';
      pad.setAttribute('aria-label',(duo?`P${i+1} `:'')+'固定移动摇杆');
      pad.innerHTML='<i></i><span>固定摇杆 · 走位 / 定向</span>';group.appendChild(pad);
      let pointer=null;
      const update=e=>{
        const pos=Y.toApp(e.clientX,e.clientY),r=Y.appRect(pad);
        const v=Y.courtStick((pos.x-r.left-r.width/2)/(r.width*.42),(r.top+r.height/2-pos.y)/(r.height*.42));
        c.touchX=v.x;c.touchY=v.y;
        pad.firstChild.style.transform=`translate(${v.x*r.width*.28}px,${-v.y*r.height*.28}px)`;
        pad.classList.toggle('steering',Math.hypot(v.x,v.y)>.08);I.changed();
      };
      pad.addEventListener('pointerdown',e=>{if(pointer!==null||e.button!==0)return;e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);update(e);});
      pad.addEventListener('pointermove',e=>{if(pointer===e.pointerId)update(e);});
      const stop=e=>{if(e&&pointer!==e.pointerId)return;pointer=null;c.touchX=c.touchY=0;pad.firstChild.style.transform='';pad.classList.remove('steering');I.changed();};
      for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,stop);
      I.touchResets.push(()=>stop());
      const actions=document.createElement('div');actions.className='court3d-actions';group.appendChild(actions);
      const kit=duo?kits?.[i]:kits;
      for(const [act,label] of [['clear','高远'],['drop','吊球'],['smash','扣杀'],['jump','起跳'],['skill',Y.SKILLS[kit?.[0]]?.short],['skill2',Y.SKILLS[kit?.[1]]?.short]]){
        if(!label)continue;
        const b=document.createElement('button');b.type='button';b.className='court3d-action t-'+act;b.dataset.action=act;
        b.setAttribute('aria-label',(duo?`P${i+1} `:'')+label);
        b.innerHTML=`<b>${label}</b><small>${act==='jump'?'JUMP':act.startsWith('skill')?'点按释放':'点按击球'}</small>`;
        actions.appendChild(b);let active=null;
        b.addEventListener('pointerdown',e=>{
          if(active!==null||e.button!==0)return;e.preventDefault();active=e.pointerId;
          b.setPointerCapture(active);b.classList.add('down');c.push(act);
        });
        const end=e=>{if(e.pointerId!==active)return;active=null;b.classList.remove('down');};
        for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,end);
        b.addEventListener('keydown',e=>{if(['Enter','Space'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)c.push(act);}});
        I.touchResets.push(()=>{active=null;b.classList.remove('down');});
      }
    });
  };
})(window);
