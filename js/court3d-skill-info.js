/* 玩家可独立浏览两套规则；切换说明不改变出战模式或技能搭配。 */
(function(G){
  'use strict';const Y=G.YY,TAU=Math.PI*2;
  Y.skillDescription=function(id,mode){
    const base=Y.SKILLS[id];if(!base)return null;if(mode!=='3d')return base;
    const overrides={
      bianpai:'准备{8秒}内的2次旋转回球。向网推杆漂长、后推急坠，横推选侧旋；再按切换。过网后弧线更弯，旋力越高越明显。',
      fuzhi:'在身侧球道放一个{8秒}复制体，推杆选展开方向。它同步跳、挥拍和放技能，可接力；不会自己追球。',
      jingxiang:'把球分成{1真2假}，假球飞向两侧球道；真球保持原线路，只有它计分。',
      shuizhong:'回球过网后留水纹；再按按摇杆方向改真球球道，原落点留虚影；进入对手接球范围后不能再改。',
      yueqiu:'部署{8秒}球道投影，拦住进入预约区的来球。',
      xuanpai:'双头拍绕身水平环扫，拦住{1次}范围内的来球；出球方向由摇杆选择，过载时范围更大。',
      shuangji:'冻结对方约{2.8米×2.1米}地面，0.35秒后生效，持续10秒；区内急停、转向会{打滑}，跳起可躲，习惯区会加宽。'
    };
    const desc=overrides[id]||base.desc
      .replaceAll('向前拖','向网推杆').replaceAll('向后拖','向后推杆')
      .replaceAll('向上拖','向网推杆').replaceAll('向下拖','向后推杆')
      .replaceAll('前拖','向网推杆').replaceAll('后拖','向后推杆')
      .replaceAll('上拖','向网推杆').replaceAll('下拖','向后推杆')
      .replaceAll('拖动','推杆').replaceAll('松手','确认');
    return {...base,desc,detail:'',aim:null,moveAim:!base.passive,mode:'3d'};
  };
  Y.drawSkillModePreview=function(ctx,id,mode,x,y,w,h,time){
    if(['kandong','jiezou','tingyixia','diban','huiguo','baozi'].includes(id)&&Y.drawSkillGuidePreview)return Y.drawSkillGuidePreview(ctx,id,mode,x,y,w,h,time);
    const sk=Y.SKILLS[id],c=sk?.color||'#7dfcff',spatial=mode==='3d',u=(time*.45)%1;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.fillStyle='#0c1c30';ctx.fillRect(x,y,w,h);
    const cx=x+w*.5,cy=y+h*.56,sc=Math.min(w/14,h/3.7);
    const pt=(a,b,z=0)=>spatial?[cx+z*sc*1.8/(1+a*.045),cy-a*sc*.17-b*sc*.7]:[cx+a*sc*.72,cy-b*sc*.7];
    const line=(a,b,col)=>{const p=pt(...a),q=pt(...b);ctx.strokeStyle=col;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();};
    if(spatial){for(const z of[-2.6,2.6])line([-6,0,z],[6,0,z],'#87b6b8');for(const a of[-6,0,6])line([a,0,-2.6],[a,0,2.6],'#87b6b8');line([0,0,-2.6],[0,1.55,-2.6],'#edecce');line([0,1.55,-2.6],[0,1.55,2.6],'#edecce');line([0,0,2.6],[0,1.55,2.6],'#edecce');}
    else{line([-6,0],[6,0],'#87b6b8');line([0,0],[0,1.55],'#edecce');}
    const movement=['jieli_jump','dianbu','tafeng','ouzhou','liubai'].includes(id);
    for(const side of[-1,1]){if(movement&&side<0)continue;const p=pt(side*3,0,side*.8);ctx.fillStyle=side<0?'#ffc965':'#72c7ff';ctx.beginPath();ctx.ellipse(p[0],p[1],8,3,0,0,Math.PI*2);ctx.fill();line([side*3,.15,side*.8],[side*3,1.35,side*.8],side<0?'#ffc965':'#72c7ff');const head=pt(side*3,1.6,side*.8);ctx.beginPath();ctx.arc(...head,3,0,Math.PI*2);ctx.fill();}
    if(movement){
      const owner=Y.CHARS.find(c=>c.acts.includes(id)),jump=['jieli_jump','tafeng'].includes(id),height=jump?Math.sin(Math.PI*u)*1.15:0;
      const step=id==='ouzhou'?Math.sin(TAU*u)*.85:id==='liubai'?-Math.sin(Math.PI*u)*.9:id==='dianbu'?Math.sin(TAU*u)*1.1:0;
      const actor={idx:0,x:-3+step,y:height,z:0,dir:1,vx:step*3,vy:jump?Math.cos(Math.PI*u)*3:0,onGround:!jump,runPhase:time*5,stamina:100,cnt:{nv:id==='jieli_jump'?{turnAngle:TAU*u,turnPose:Math.sin(Math.PI*u)}:{}},motion:{air:u,speed:step*2,land:0,split:0}};
      const q=pt(actor.x,height,spatial?step*.4:0);ctx.save();ctx.translate(...q);ctx.scale(sc*.64,-sc*.64);
      Y.drawCharacter(ctx,actor,Y.lookOf(owner.id),{time,mood:'play',action:Y.CharacterArt?.action(id,u*.62)});ctx.restore();
      ctx.font='600 11px '+(Y.FONT||'sans-serif');ctx.fillStyle=c;ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText(({jieli_jump:'旋身起跳 → 空中调整 → 落地',dianbu:'滑步积旋 → 二段折返',tafeng:'空中踏步 → 疾风强化',ouzhou:'切入 → 换手变向',liubai:'侧身回眸 → 滑步留影'})[id],x+10,y+8);ctx.restore();return;
    }
    if(['tangqiu','hongxian','jiewang','youyou'].includes(id)){
      const p=pt(-3,1.4,-.8),q=pt(-1.5,1.8,.7),phase=u*3;
      if(id==='tangqiu'){const d=u<.5?u*2:(1-u)*2,from=pt(-3,.12,-.8),to=pt(-3+d*1.55,.12,spatial?-.8+d:.0);Y.CharacterArt?.ribbon(ctx,from,to,time,2);Y.CharacterArt?.butterfly(ctx,...to,7,time);}
      if(id==='hongxian'){const d=u<.5?u*2:2-u*2,to=[p[0]+(q[0]-p[0])*d,p[1]+(q[1]-p[1])*d];Y.CharacterArt?.ribbon(ctx,p,to,time,2.4);Y.CharacterArt?.butterfly(ctx,...to,5,time);}
      if(id==='jiewang'){const bow=pt(0,1.6,0),end=pt(1.1,.1,1);Y.CharacterArt?.butterfly(ctx,...bow,8,time);line([-3,1.8,-.8],[0,1.6,0],c);line([0,1.6,0],[1.1,.1,1],c);const v=u<.5?[p[0]+(bow[0]-p[0])*u*2,p[1]+(bow[1]-p[1])*u*2]:[bow[0]+(end[0]-bow[0])*(u-.5)*2,bow[1]+(end[1]-bow[1])*(u-.5)*2];ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(...v,3,0,Math.PI*2);ctx.fill();}
      if(id==='youyou'){const d=phase<1?phase:phase<2?1:3-phase,to=[p[0]+(q[0]-p[0])*d,p[1]+(q[1]-p[1])*d];ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...to);ctx.stroke();Y.CharacterArt?.flywheel(ctx,...to,9,time*6,phase>=1&&phase<2?3:0,phase%1);}
      ctx.font='600 11px '+(Y.FONT||'sans-serif');ctx.fillStyle=c;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(({tangqiu:'穿花抢位 → 解结折返',hongxian:'牵球回旋 → 自选长短',jiewang:'蝶结上弦 → 过网变线',youyou:'飞轮截球 → 合齿弹射 / 带回'})[id],x+10,y+8);ctx.restore();return;
    }
    const device=['fanshe','shuangji','yueliang','fuzhi','jibei','biaozhi','yueqiu','haomao','fengkou'].includes(id);
    if(device){const p=pt(-1.7,.4,-1.4);ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p[0],p[1],16,spatial?6:14,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.18;ctx.fillStyle=c;ctx.fill();ctx.globalAlpha=1;}
    const prev=[];for(let i=0;i<24;i++){const v=i/23,px=-3+6*v,py=1+Math.sin(v*Math.PI)*1.65,pz=spatial?-.8+2*v:0;prev.push([px,py,pz]);if(i)line(prev[i-1],prev[i],c+'66');}
    const ball=pt(-3+6*u,1+Math.sin(u*Math.PI)*1.65,spatial?-.8+2*u:0);ctx.fillStyle='#fff6cc';ctx.beginPath();ctx.arc(...ball,3.2,0,Math.PI*2);ctx.fill();
    ctx.font='600 11px '+(Y.FONT||'sans-serif');ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#b9cbdc';ctx.fillText(spatial?'3D · 球道 / 范围示意':'2D · 横版作用示意',x+10,y+8);
    ctx.textAlign='right';ctx.fillStyle=c;ctx.fillText(device?'局部区域':'球路与方向',x+w-10,y+8);ctx.restore();
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
