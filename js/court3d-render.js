/* 纵深球馆：软件透视三维几何，复用角色骨骼/配色与转播 HUD。无外部运行依赖。 */
(function(G){
  'use strict';const Y=G.YY,{clamp,lerp}=Y,TAU=Math.PI*2;
  const schemes={arena:{sky:'#080f26',top:'#153957',floor:'#183d42',court:'#287d91',near:'#20677c',rim:'#74ddd9',light:'#97e5ff'},sunset:{sky:'#3a203f',top:'#c17165',floor:'#5d484a',court:'#3c8b87',near:'#2e666b',rim:'#ffce88',light:'#ffd6a3'},neon:{sky:'#090d29',top:'#242555',floor:'#101e3c',court:'#254977',near:'#1b365c',rim:'#59e9ef',light:'#a1a4ff'}};
  for(const id of ['bamboo','harbor','aurora'])schemes[id]=Y.VENUES[id];
  class CourtView {
    constructor(r){this.r=r;this.trail=[];this.fx=[];this.lastHit=-1;this.lastPhase='';this.time=0;this.notices=[];this.racketTrails=[[],[]];this.skillBursts=[];this.netPulse=0;this.lastTrailAt=-1;}
    event(e,m){
      if(e.type==='hit'){const power=['smash','halfsmash','kill'].includes(e.shot),soft=['drop','net','tumble','block'].includes(e.shot);this.fx.push({x:e.x,y:e.y,z:e.z||0,t:.32,life:.32,power,soft,perfect:e.q>=.85,strained:e.q<.4&&!e.serve,seed:m.hitCount,high:e.highSmash,vx:e.vx,vy:e.vy,vz:e.vz||0});this.lastShot=e.name;this.lastSpeed=e.displaySpeed||e.speed*.78;this.kick=power?.012:.003;this.trail=[];}
      if(['step','land','turn'].includes(e.type)){const p=m.players[e.p];this.footprints=this.footprints||[];this.footprints.push({x:p.x,z:p.z,t:.28,turn:e.type==='turn'});if(this.footprints.length>12)this.footprints.shift();}
      if(e.type==='net')this.netPulse=.45;
      if(e.type==='skill'&&!Y.SKILLS[e.id]?.stealth){this.skillBursts.push({p:e.p,id:e.id,t:.7,life:.7});if(this.skillBursts.length>6)this.skillBursts.shift();}
      if(e.type==='serveReady'){this.trail=[];this.fx=[];this.racketTrails=[[],[]];}
      const n=Y.matchNotice(e,{mine:e.p===(this.r.mirror?1:0),practice:!!m.practice});
      if(n){this.noticeAt=this.noticeAt||{};const key=e.p+':'+n.key;if(m.time-(this.noticeAt[key]??-99)<.85)return;this.noticeAt[key]=m.time;this.notices=this.notices.filter(q=>q.p!==e.p);this.notices.push({p:e.p,text:n.text,color:n.color,t:n.life});}
    }
    project(x,y=0,z=0){
      const r=this.r,mirror=r.mirror?-1:1,X=x*mirror,Z=z*mirror;
      const depth=21.63+X*.83205-y*.5547, f=r.H*1.65;
      return {x:r.W*.5+Z*f*1.62/depth,y:r.H*.48-(X*.5547+y*.83205)*f/depth,k:f/depth,d:depth};
    }
    groundAt(sx,sy){
      const r=this.r,q=(r.H*.48-sy)/(r.H*1.65),x=21.63*q/(.5547-.83205*q),depth=21.63+x*.83205;
      const z=(sx-r.W*.5)*depth/(r.H*1.65*1.62),mirror=r.mirror?-1:1;
      return {x:x*mirror,z:z*mirror};
    }
    polygon(ctx,pts,fill,stroke,width=1){ctx.beginPath();pts.forEach((p,i)=>{const q=this.project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
    line(ctx,a,b,color,width=1){const p=this.project(...a),q=this.project(...b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
    ring(ctx,x,z,r,color,alpha=1,y=.015){ctx.save();ctx.globalAlpha=alpha;const pts=Array.from({length:48},(_,i)=>[x+Math.cos(i/48*TAU)*r,y,z+Math.sin(i/48*TAU)*r]);this.polygon(ctx,pts,null,color,2);ctx.restore();}
    label(ctx,text,x,y,size,color='#fff',align='center'){ctx.fillStyle=color;ctx.font=`700 ${size}px ${Y.FONT}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);}
    scene(ctx){
      const r=this.r,{W,H}=r,c=schemes[r.venueId]||schemes.arena;
      const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,c.sky);sky.addColorStop(.6,c.top);sky.addColorStop(1,c.floor);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      // A layered grandstand, roof trusses and sparse audience retain the original night-sport art direction.
      if(['bamboo','harbor','aurora'].includes(r.venueId)){Y.paintLandscape(ctx,r.venueId,W,H*.26);}else if(r.venueId==='sunset'){
        const sun=ctx.createRadialGradient(W*.76,H*.15,2,W*.76,H*.15,H*.24);sun.addColorStop(0,'#ffe3ae');sun.addColorStop(.25,'#ffb98580');sun.addColorStop(1,'#ffac7b00');ctx.fillStyle=sun;ctx.fillRect(W*.5,0,W*.5,H*.5);
        for(let j=0;j<34;j++){const x=j*W/33,h=H*(.06+((j*17)%11)*.008);ctx.fillStyle=j%2?'#302d4f':'#473653';ctx.fillRect(x,H*.25-h,W/30,h);for(let k=0;k<4;k++){ctx.fillStyle='#ffd08c55';ctx.fillRect(x+5,H*.25-h+8+k*12,3,3);}}
      }else{
        for(let j=0;j<9;j++){const x=j*W/8;ctx.beginPath();ctx.moveTo(x,-10);ctx.lineTo(W*.5+(x-W*.5)*.62,H*.2);ctx.strokeStyle='#5b6a9440';ctx.lineWidth=5;ctx.stroke();}
        for(let row=0;row<4;row++){const yy=H*(.115+row*.023);ctx.fillStyle=row%2?'#111b35':'#17263d';ctx.fillRect(0,yy,W,H*.028);for(let j=0;j<70;j++){const x=(j+.5+(row%2)*.5)*W/70;const h=H*.008,shirt=['#7794ad','#927b90','#718595','#627da4'][(j*7+row)%4];ctx.fillStyle='#253756';Y.rr(ctx,x-h,yy+h*.8,h*2,h*1.9,1.5);ctx.fill();ctx.fillStyle=shirt;ctx.beginPath();ctx.ellipse(x,yy+h*1.5,h*.65,h*.8,0,0,TAU);ctx.fill();ctx.fillStyle=j%3?'#c4ac9b':'#8c7e7b';ctx.beginPath();ctx.arc(x,yy+h*.5,h*.4,0,TAU);ctx.fill();}}
      }
      // Balcony LED board.
      ctx.fillStyle='#071329';ctx.fillRect(0,H*.205,W,H*.035);ctx.fillStyle=c.rim;ctx.fillRect(0,H*.238,W,1.5);
      for(let j=0;j<5;j++)this.label(ctx,j%2?'PLAY THE SPACE':Y.VENUES[r.venueId].name,W*(j+.5)/5,H*.222,Math.max(9,H*.012),j%2?'#bdcdd9':c.rim);
      const horizon=ctx.createLinearGradient(0,H*.18,0,H*.5);horizon.addColorStop(0,'#0d142766');horizon.addColorStop(1,'#0a1b3000');ctx.fillStyle=horizon;ctx.fillRect(0,H*.18,W,H*.32);
      const ground=[[7.4,0,-12],[7.4,0,12],[-12,0,12],[-12,0,-12]];this.polygon(ctx,ground,c.floor);
      for(let lane=-8;lane<8;lane+=.32)this.line(ctx,[-9,0,lane],[7.4,0,lane],r.venueId==='sunset'?'#dcbd8d17':'#5c94951a',1);
      this.polygon(ctx,[[7.7,.001,-3.8],[7.7,.001,3.8],[-7.7,.001,3.8],[-7.7,.001,-3.8]],'#0a1d30',c.rim,2);
      this.polygon(ctx,[[6.7,.005,-3.05],[6.7,.005,3.05],[0,.005,3.05],[0,.005,-3.05]],c.court);
      this.polygon(ctx,[[0,.006,-3.05],[0,.006,3.05],[-6.7,.006,3.05],[-6.7,.006,-3.05]],c.near);
      for(let x=-6.7;x<6.7;x+=.45)this.line(ctx,[x,.008,-3.05],[x,.008,3.05],'#ffffff05',1);
      const sheen=ctx.createLinearGradient(0,H*.24,W,H*.9);sheen.addColorStop(0,'#d3ffff1c');sheen.addColorStop(.45,'#b4f4ff03');sheen.addColorStop(1,'#020b2429');this.polygon(ctx,[[6.7,.009,-3.05],[6.7,.009,3.05],[-6.7,.009,3.05],[-6.7,.009,-3.05]],sheen);
      for(let i=0;i<(r.quality?1400:350);i++){const x=((i*73)%1399)/1399*13.4-6.7,z=((i*277)%1409)/1409*6.1-3.05,q=this.project(x,.01,z);ctx.fillStyle=i%2?'#c0ffff0d':'#020b2010';ctx.fillRect(q.x,q.y,.8,.6);}
      const line='#d9f6ec';
      for(const z of[-3.05,-2.59,2.59,3.05])this.line(ctx,[-6.7,.012,z],[6.7,.012,z],line,1.6);
      for(const x of[-6.7,-5.94,-1.98,1.98,5.94,6.7])this.line(ctx,[x,.012,-3.05],[x,.012,3.05],line,1.5);
      this.line(ctx,[-6.7,.012,0],[-1.98,.012,0],line,1.4);this.line(ctx,[1.98,.012,0],[6.7,.012,0],line,1.4);
      // Camera-facing floor wordmark and near baseline runway.
      const logo=this.project(-5.2,0,0);ctx.save();ctx.translate(logo.x,logo.y);ctx.scale(1,.55);this.label(ctx,'Y U Y U E   D U E L',0,0,clamp(H*.024,11,21),'#daffff1c');ctx.restore();
      for(const side of[-1,1]){
        this.polygon(ctx,[[8,0,side*4.0],[8,0,side*4.65],[-8,0,side*4.65],[-8,0,side*4.0]],'#122941');
        for(let x=-7;x<8;x+=2.5){this.polygon(ctx,[[x,0,side*4.2],[x,1,side*4.2],[x+1.8,1,side*4.2],[x+1.8,0,side*4.2]],'#142b48','#52799466');}
      }
      this.furniture(ctx);
      // Stadium spotlights are cached with the backdrop.
      for(const side of[-1,1]){ctx.save();const light=ctx.createLinearGradient(W/2+side*W*.35,0,W/2+side*W*.15,H*.8);light.addColorStop(0,c.light+'28');light.addColorStop(1,c.light+'00');ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(W/2+side*W*.35,0);ctx.lineTo(W/2+side*W*.10,H*.85);ctx.lineTo(W/2+side*W*.43,H*.85);ctx.closePath();ctx.fill();ctx.restore();}
    }
    furniture(ctx){
      const c=schemes[this.r.venueId]||schemes.arena;
      // Umpire podium, bench, equipment and venue-specific light rails.
      for(const side of[-1,1]){
        const z=side*3.75;
        this.polygon(ctx,[[-.6,0,z-.22],[-.6,0,z+.22],[.6,0,z+.22],[.6,0,z-.22]],'#071527');
        this.polygon(ctx,[[-.3,.75,z-.23],[-.3,.75,z+.23],[.3,.75,z+.23],[.3,.75,z-.23]],'#668394','#d4e5df',1);
        for(const x of[-.27,.27])this.line(ctx,[x,0,z],[x,1.35,z],'#7e96a5',3);
        this.line(ctx,[-.3,1.3,z],[.3,1.3,z],c.rim,3);
        const person=this.project(0,1.25,z);ctx.fillStyle='#d8b99b';ctx.beginPath();ctx.arc(person.x,person.y-7,5,0,TAU);ctx.fill();ctx.fillStyle='#426576';ctx.fillRect(person.x-6,person.y-2,12,13);
        this.polygon(ctx,[[4,.35,z-.2],[4,.35,z+.2],[6,.35,z+.2],[6,.35,z-.2]],'#718a92','#b3caca');
        this.line(ctx,[4.2,0,z],[4.2,.35,z],'#a0b6bc',3);this.line(ctx,[5.8,0,z],[5.8,.35,z],'#a0b6bc',3);
        if(this.r.venueId==='neon'){for(let x=-6;x<7;x+=1)this.line(ctx,[x,.2,side*4.15],[x+.5,.2,side*4.15],x%2?'#e49dff':'#63e9ff',3);}
        if(this.r.venueId==='sunset'){for(let x=-5;x<7;x+=2){this.line(ctx,[x,0,side*4.25],[x,2,side*4.25],'#755557',2);this.line(ctx,[x,2,side*4.25],[x+2,2,side*4.25],'#d4a394',1);const l=this.project(x+1,1.94,side*4.25);ctx.fillStyle='#ffdfa4';ctx.beginPath();ctx.arc(l.x,l.y,2.5,0,TAU);ctx.fill();}}
      }
    }
    net(ctx,m){
      const h=Y.C.NET_H+(m.sk?.netUp>0?.9:0),light=schemes[this.r.venueId]?.rim||'#b4f9e7';
      this.polygon(ctx,[[0,.08,-3.05],[0,h,-3.05],[0,h,3.05],[0,.08,3.05]],'#0b203842');
      for(let z=-3.05;z<=3.05;z+=(this.r.quality?.16:.28))this.line(ctx,[0,.08,z],[0,h,z],'#d2ede343',.7);
      for(let y=.15;y<h;y+=(this.r.quality?.12:.22))this.line(ctx,[0,y,-3.05],[0,y,3.05],'#d2ede343',.7);
      const wob=Math.sin((.45-this.netPulse)*48)*this.netPulse*.1;for(let z=-3.1;z<3.1;z+=.25){const f=v=>wob*Math.cos(v/3.1*Math.PI/2);this.line(ctx,[f(z),h,z],[f(z+.25),h,z+.25],m.sk?.netUp>0?'#ff9061':'#fff5cf',3.4);}
      for(const z of[-3.12,3.12]){this.line(ctx,[0,0,z],[0,h+.12,z],'#092032',8);this.line(ctx,[0,0,z],[0,h+.12,z],light,4);this.ring(ctx,0,z,.2,light,.75);}
    }
    mesh(ctx,vertices,faces){
      faces.map(f=>({f,d:f[0].reduce((a,i)=>a+this.project(...vertices[i]).d,0)/f[0].length})).sort((a,b)=>b.d-a.d).forEach(({f})=>this.polygon(ctx,f[0].map(i=>vertices[i]),f[1],f[2]||'#071222aa',.85));
    }
    limb(ctx,a,b,r,color){
      const p=this.project(...a),q=this.project(...b),width=Math.max(1,r*(p.k+q.k));
      ctx.lineCap='round';ctx.strokeStyle='#111728';ctx.lineWidth=width+2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.strokeStyle='#ffffff25';ctx.lineWidth=Math.max(1,width*.24);ctx.stroke();
    }
    resources(ctx,p,m){
        const st=p.cnt?.nv||{},q=this.project(p.x,p.y+.6,p.z+.32);
        ctx.save();ctx.lineWidth=2;
        if(st.spin){ctx.strokeStyle='#a7f4df';for(let i=0;i<st.spin;i++){ctx.beginPath();ctx.arc(q.x,q.y,7+i*4,-.8,2.7);ctx.stroke();}}
        if(p.kit?.passive==='gongxiu'&&m.skillsOn)Y.SkillFX?.officePulse?.(ctx,p,q.x,q.y-12,clamp(q.k/38,.72,1.2),m.time);
        if(p.kit?.passive==='lvyue'&&m.skillsOn)Y.SkillFX?.filmMeter?.(ctx,p,q.x,q.y+8,clamp(q.k/38,.72,1.2),m.time);
        ctx.restore();
    }
    player(ctx,p,m,ghost=false){
      const r=this.r,lk=r.lookOf(m,p.idx),near=(p.x*(r.mirror?-1:1))<0;
      const F=Y.courtPose3D(p,m,this.time);
      const {H1,H2,S1,S2,K1,K2,F1,F2,W,E,W2,E2,pose}=F,dir=p.dir;
      const base=this.project(p.x,0,p.z),shade=ctx.createRadialGradient(base.x,base.y,0,base.x,base.y,base.k*.7);
      shade.addColorStop(0,'#030b20a0');shade.addColorStop(1,'#030b2000');ctx.save();ctx.translate(base.x,base.y);ctx.scale(1,.3);ctx.fillStyle=shade;ctx.translate(-base.x,-base.y);ctx.beginPath();ctx.arc(base.x,base.y,base.k*.7,0,TAU);ctx.fill();ctx.restore();
      if(ghost)ctx.globalAlpha*=.4;
      const band=p.idx?'#74cfff':'#ffcb5c';this.ring(ctx,p.x,p.z,.48,band,.75);
      for(const [h,k,f] of[[H2,K2,F2],[H1,K1,F1]]){this.limb(ctx,h,k,.115,lk.shorts);this.limb(ctx,k,f,.068,lk.skin);const sock=[f[0],f[1]+.15,f[2]];this.limb(ctx,sock,f,.073,lk.sock);this.limb(ctx,f,[f[0]+dir*.19,f[1]+.025,f[2]],.085,lk.shoe);}
      this.limb(ctx,S2,E2,.068,lk.skin2);this.limb(ctx,S2,[lerp(S2[0],E2[0],.42),lerp(S2[1],E2[1],.42),lerp(S2[2],E2[2],.42)],.088,lk.shirt2);this.limb(ctx,E2,W2,.058,lk.skin);
      // Four-sided torso, independently shaded front/back, waist and shoulders.
      const off=.115,vertices=[];
      for(const v of[H2,H1,S1,S2])vertices.push([v[0]-off,v[1],v[2]]);
      for(const v of[H2,H1,S1,S2])vertices.push([v[0]+off,v[1],v[2]]);
      this.mesh(ctx,vertices,[[[0,1,2,3],near?lk.shirt:lk.shirt2],[[4,7,6,5],near?lk.shirt2:lk.shirt],[[1,5,6,2],lk.shirt2],[[0,3,7,4],lk.shirt2],[[3,2,6,7],lk.shirt]]);
      this.line(ctx,[H1[0]-dir*.13,H1[1]+.05,H1[2]],[H2[0]-dir*.13,H2[1]+.05,H2[2]],lk.trim,1.8);
      const chest=this.project((S1[0]+S2[0]+H1[0]+H2[0])/4-dir*.12,(S1[1]+H1[1])/2,(S1[2]+S2[2])/2);this.label(ctx,lk.num||String(p.idx+1),chest.x,chest.y,base.k*.19,lk.panel);
      const head=F.hd,hp=this.project(...head),hr=hp.k*.18*(lk.headScale||1);
      this.limb(ctx,F.N,head,.065,lk.skin2);
      const skin=ctx.createRadialGradient(hp.x-hr*.3,hp.y-hr*.4,0,hp.x,hp.y,hr);skin.addColorStop(0,lk.skin);skin.addColorStop(1,lk.skin2);
      ctx.fillStyle=skin;ctx.strokeStyle=lk.outline;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(hp.x,hp.y,hr,hr*1.12,0,0,TAU);ctx.fill();ctx.stroke();
      // Back of head for the near player, expressive face for the far player.
      ctx.fillStyle=lk.hairC;ctx.beginPath();ctx.ellipse(hp.x,hp.y-hr*.28,hr*1.06,hr*(near?.99:.65),0,0,TAU);ctx.fill();
      if(['spiky','mess','quiff','crew'].includes(lk.hair))for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(hp.x-hr+i*hr*.4,hp.y-hr*.6);ctx.lineTo(hp.x-hr*.85+i*hr*.4,hp.y-hr*(1.2+(i%2)*.2));ctx.lineTo(hp.x-hr*.55+i*hr*.4,hp.y-hr*.55);ctx.fill();}
      if(['ponytail','long','braid','bun'].includes(lk.hair)){this.limb(ctx,[head[0]-dir*.1,head[1]+.06,head[2]],[head[0]-dir*.24,head[1]-.32,head[2]+Math.sin(this.time*8)*.08],.07,lk.hairC);}
      ctx.strokeStyle=lk.band;ctx.lineWidth=Math.max(1.2,hp.k*.035);ctx.beginPath();ctx.moveTo(hp.x-hr*.94,hp.y-hr*.25);ctx.lineTo(hp.x+hr*.94,hp.y-hr*.25);ctx.stroke();
      if(!near){ctx.fillStyle=lk.eye;for(const z of[-1,1]){ctx.beginPath();ctx.ellipse(hp.x+z*hr*.4,hp.y+hr*.1,hr*.10,hr*.15,0,0,TAU);ctx.fill();}ctx.strokeStyle=lk.eye;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(hp.x-hr*.18,hp.y+hr*.58);ctx.lineTo(hp.x+hr*.18,hp.y+hr*.58);ctx.stroke();if(lk.glasses){ctx.strokeStyle=lk.trim;for(const z of[-1,1]){ctx.beginPath();ctx.ellipse(hp.x+z*hr*.4,hp.y+hr*.1,hr*.34,hr*.27,0,0,TAU);ctx.stroke();}}}
      this.limb(ctx,S1,[lerp(S1[0],E[0],.5),lerp(S1[1],E[1],.5),lerp(S1[2],E[2],.5)],.1,lk.shirt);this.limb(ctx,S1,E,.072,lk.skin);this.limb(ctx,E,W,.058,lk.skin);
      const headR=F.headR;
      this.limb(ctx,W,headR,.017,lk.racket2);const rp=this.project(...headR);
      ctx.save();ctx.translate(rp.x,rp.y);ctx.rotate(Math.atan2(this.project(...W).y-rp.y,this.project(...W).x-rp.x)+Math.PI/2);ctx.scale(F.face||1,1);ctx.fillStyle='#dcfaff1c';ctx.strokeStyle=lk.racket;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,rp.k*.17,rp.k*.23,0,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='#edffff77';ctx.lineWidth=.6;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*rp.k*.05,-rp.k*.18);ctx.lineTo(i*rp.k*.05,rp.k*.18);ctx.moveTo(-rp.k*.14,i*rp.k*.065);ctx.lineTo(rp.k*.14,i*rp.k*.065);ctx.stroke();}ctx.restore();
      if(!ghost){const list=this.racketTrails[p.idx];if(p.swing&&!p.swing.serve&&p.swing.t<.26){if(!list.length||this.time-list[list.length-1].t>=1/120)list.push({v:headR.slice(),t:this.time});}while(list.length&&this.time-list[0].t>.105)list.shift();if(list.length>14)list.shift();for(let i=1;i<list.length;i++){ctx.save();ctx.globalAlpha=clamp(1-(this.time-list[i].t)/.105,0,1)*.65;this.line(ctx,list[i-1].v,list[i].v,band,1.5+i/list.length*2);ctx.restore();}}
      const active=Object.keys(p.buff||{}).find(k=>p.buff[k]>0&&Y.SKILLS[k]);if(active)this.ring(ctx,p.x,p.z,.6+Math.sin(this.time*5)*.08,Y.SKILLS[active].color,.8);
      ctx.globalAlpha=1;
    }
    shuttle(ctx,s,alpha=1){
      if(s.hide||s.veil>0)return;const p=this.project(s.x,s.y,s.z||0),g=this.project(s.x,.015,s.z||0),k=clamp(p.k*.10,4,10);
      const high=p.y<this.r.H*.145;if(high){p.y=this.r.H*.145;this.label(ctx,'↑ '+s.y.toFixed(1)+'m',p.x,p.y-15,11,'#ffe5a6');}
      if(s.nf?.dive){for(let i=1;i<4;i++){const q=this.project(s.x-s.vx*.012*i,s.y-s.vy*.012*i,(s.z||0)-(s.vz||0)*.012*i);ctx.strokeStyle=s.nf.dive===2?'#ffb24c':'#ffe3a7';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}
      if(s.nf?.curve){ctx.save();ctx.strokeStyle='#85efdc';ctx.lineWidth=1.7;for(let i=0;i<3;i++){const q=this.project(s.x-(s.vx||0)*.015*i,s.y-(s.vy||0)*.015*i,(s.z||0)-(s.vz||0)*.015*i);ctx.globalAlpha=.75-i*.18;ctx.beginPath();ctx.ellipse(q.x,q.y,k*(1.1+i*.2),k*.6,this.time*12-i*.8,.2,TAU*.85);ctx.stroke();}ctx.restore();}
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#080f2599';ctx.beginPath();ctx.ellipse(g.x,g.y,k*1.1,k*.4,0,0,TAU);ctx.fill();
      if(s.live&&s.nf?.paper&&Y.SkillFX?.paperBody){
        const next=this.project(s.x+s.vx*.03,s.y+s.vy*.03,(s.z||0)+(s.vz||0)*.03);
        Y.SkillFX.paperBody(ctx,p.x,p.y,Math.atan2(next.y-p.y,next.x-p.x),k*1.2,Y.paperAero(s.x,s.nf.paper),s.nf);
        ctx.restore();return;
      }
      ctx.translate(p.x,p.y);const next=this.project(s.x+(s.vx||0)*.02,s.y+(s.vy||0)*.02,(s.z||0)+(s.vz||0)*.02);ctx.rotate(Math.atan2(next.y-p.y,next.x-p.x));
      ctx.shadowColor=s.fire?'#ffad63':'#ffe9ad';ctx.shadowBlur=10;ctx.fillStyle='#faffff';ctx.beginPath();ctx.moveTo(k*.15,0);ctx.lineTo(-k*1.9,-k*.8);ctx.quadraticCurveTo(-k*2.5,0,-k*1.9,k*.8);ctx.closePath();ctx.fill();ctx.strokeStyle='#acd8df';ctx.lineWidth=.7;for(const v of[-.55,0,.55]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-k*2,v*k);ctx.stroke();}ctx.fillStyle='#ffdc77';ctx.beginPath();ctx.arc(0,0,k*.46,0,TAU);ctx.fill();ctx.restore();
    }
    device(ctx,e,m){
      const p=this.project(e.x,e.y||0,e.z||0),color=Y.SKILLS[e.sid]?.color||(['pane','pool'].includes(e.k)?'#83ddff':e.k==='moon'?'#d0bcff':'#ffda83');
      if(e.k==='newskill'&&Y.SkillFX?.officeSkill?.(e.sid)){
        const owner=m.players[e.o],q=this.project(owner.x,owner.y+2.05,owner.z);
        Y.SkillFX.officeReady(ctx,e,q.x,q.y,clamp(q.k/38,.72,1.15));
        const hand=this.project(owner.x+owner.dir*.35,owner.y+1.35,owner.z);
        Y.SkillFX.officeCast(ctx,e,hand.x,hand.y,clamp(q.k/38,.72,1.15),1);return;
      }
      if(e.k==='newskill'&&e.sid==='returnSeal'){
        const owner=m.players[e.o],q=this.project(owner.x+owner.dir*.5,owner.y+1.45,owner.z);
        Y.SkillFX?.officeSeal?.(ctx,q.x,q.y,clamp(q.k/38,.75,1.15),e.age,e.combo);return;
      }
      if(e.k==='clone'){this.player(ctx,{...m.players[e.o],x:e.x,y:e.y,z:e.z,vx:0,vz:0,swing:e.sw},m,true);return;}
      if(['fake','dirty'].includes(e.k)){this.shuttle(ctx,{...e,live:true});return;}
      if(e.k==='pool'){const owner=m.players[e.o],a=owner.side*.1,b=owner.side*m.halfOf(e.o);this.polygon(ctx,[[a,.025,-2.59],[a,.025,2.59],[b,.025,2.59],[b,.025,-2.59]],'#65cfff22','#7fddff55');for(let i=0;i<4;i++)this.ring(ctx,owner.side*(1+i*1.4),Math.sin(i*7)*1.6,.3+(this.time*.3+i*.2)%1,'#9eeaff',.28);return;}
      if(['cone','packet','peel','quake','newskill'].includes(e.k)){
        this.ring(ctx,e.x,e.z||0,e.k==='pool'?1.25:.65,color,.55);
        if(e.k==='packet'){this.polygon(ctx,[[e.x-.2,.04,e.z-.16],[e.x-.2,.04,e.z+.16],[e.x+.2,.04,e.z+.16],[e.x+.2,.04,e.z-.16]],'#e64452','#ffd46a');this.label(ctx,'¥',p.x,p.y-4,12,'#ffe39c');return;}
        if(e.k==='peel'){ctx.strokeStyle='#ffdb56';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y-4,p.k*.13,0,Math.PI);ctx.stroke();return;}
        if(e.k==='newskill'&&e.sid==='jibei'){
          const h=e.height||0,z=e.z||0;
          for(let i=-3;i<=3;i++){const x=e.x+i*.31;this.line(ctx,[x,0,z-.7],[x,h,z-.7],'#d9b77a',5);this.line(ctx,[x,0,z+.7],[x,h,z+.7],'#e9ca90',4);}
          this.polygon(ctx,[[e.x-1.15,h,z-.9],[e.x-1.15,h,z+.9],[e.x+1.15,h,z+.9],[e.x+1.15,h,z-.9]],'#c5a269dd','#fff0c3',2);
          const top=this.project(e.x,h+.3,z);this.label(ctx,(e.raised?'高台':'降台')+' '+e.t.toFixed(1)+'s',top.x,top.y-10,12,color);return;
        }
        if(e.k==='newskill'&&e.sid==='yimo'){
          const q=m.players[e.o],h=q.y+1.3,beat=Math.sin(this.time*9),span=e.boost?1.7:1.4;
          for(const side of[-1,1]){
            this.polygon(ctx,[[q.x,h,q.z],[q.x-.3*q.dir,h+.45,q.z+side*.55],[q.x-.15*q.dir,h+beat*.2,q.z+side*span],[q.x-.55*q.dir,h-.15,q.z+side*.6]],'#d59c47bb','#ffe3a7',2);
            for(let i=0;i<8;i++){const z=q.z+side*(.45+i*.13);this.polygon(ctx,[[q.x-.15*q.dir,h+.2,z],[q.x-.8*q.dir,h-.22,z+side*.12],[q.x-.35*q.dir,h+.2,z+side*.1]],i%2?'#f6d491':'#c98b3c','#f8dd9e',1);}
          }
          const top=this.project(q.x,q.y+2.6,q.z);this.label(ctx,(e.boost?'化石猎航':'猎航')+' ◆×'+e.n+' '+e.t.toFixed(1)+'s',top.x,top.y,12,'#ffe3a7');return;
        }
        if(e.k==='newskill'&&e.sid==='splitBurst'){ctx.save();ctx.globalAlpha=.32;this.line(ctx,[e.from,.035,e.fromZ||0],[e.to,.035,e.toZ||0],'#8ce7d0',3);ctx.restore();return;}
        if(e.k==='newskill'&&e.sid==='bianpai'){
          const q=m.players[e.o],a=this.project(q.x+q.dir*.3,q.y+1.3,q.z+.2),b=this.project(q.x+q.dir*1.1,q.y+(e.mode>0?1.9:.9),q.z+.2);
          ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(a.x+(b.x-a.x)*1.2,a.y-12,b.x,b.y);ctx.stroke();for(let i=0;i<e.n;i++){ctx.fillStyle=color;ctx.beginPath();ctx.arc(a.x+i*6,a.y+10,2,0,TAU);ctx.fill();}ctx.restore();return;
        }
        if(e.k==='newskill'&&['dianbu','curveFx','jieli_jump'].includes(e.sid))return;
        if(e.k==='cone'){this.polygon(ctx,[[e.x-.16,0,(e.z||0)-.15],[e.x,.6,e.z||0],[e.x+.16,0,(e.z||0)+.15]],'#ffac62','#fff1c0');return;}
      }
      if(['ribbon','pole','yoyo','vine'].includes(e.k)){const owner=m.players[e.o],start=e.k==='vine'?[e.x,e.y,e.z]:[owner.x,owner.y+1.45,owner.z],end=e.k==='vine'?[owner.x,owner.y+1.8,owner.z]:[e.x,e.y,e.z];this.line(ctx,start,end,e.k==='ribbon'?'#ff98bf':'#a9ddce',e.k==='ribbon'?3:2);}
      if(e.k==='wind'){for(let i=0;i<3;i++){this.line(ctx,[e.x-.4,e.y-.3+i*.25,e.z-.3],[e.x+.4,e.y-.15+i*.25,e.z+.3],'#a5fff2aa',2);}}
      if(e.k==='spin'){
        const owner=m.players[e.o];for(let i=0;i<2;i++){const a=(e.ph0||0)+(e.w||8)*e.age+i*Math.PI,rad=e.r||1.35,h=[owner.x+Math.cos(a)*rad,owner.y+1.3,owner.z+Math.sin(a)*rad];this.line(ctx,[owner.x,owner.y+1.3,owner.z],h,'#b2f9d2',2);const q=this.project(...h);ctx.strokeStyle='#9fffd0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,q.k*.16,q.k*.23,a,0,TAU);ctx.stroke();}this.ring(ctx,owner.x,owner.z,e.r||1.35,'#91ffd0',.3,owner.y+1.3);return;
      }
      if(['pole','yoyo'].includes(e.k)){ctx.strokeStyle=e.k==='pole'?'#a6ffde':'#b5e6ff';ctx.fillStyle='#b5ffe318';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,p.k*.19,p.k*.26,Math.sin(this.time*8)*.3,0,TAU);ctx.fill();ctx.stroke();for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(p.x+i*p.k*.08,p.y-p.k*.21);ctx.lineTo(p.x+i*p.k*.08,p.y+p.k*.21);ctx.stroke();}}
      if(e.k==='newskill'&&Y.SkillFX?.filmSkill?.(e.sid)){
        const owner=m.players[e.o],q=this.project(owner.x,owner.y+2.18,owner.z);
        Y.SkillFX.filmReady(ctx,e,q.x,q.y,clamp(q.k/38,.72,1.16));return;
      }
      if(e.k==='newskill'&&['dianbu','jieli_jump','splitBurst','curveFx','bianpai'].includes(e.sid)){const owner=m.players[e.o];for(let i=0;i<3;i++)this.ring(ctx,owner.x-i*(owner.vx||0)*.025,owner.z-i*(owner.vz||0)*.025,.55+i*.12,color,.35-i*.08,.05);}
      ctx.save();ctx.globalAlpha=clamp(e.t*2,0,.85);
      if(['board','pane','gate'].includes(e.k)){
        const size=e.k==='gate'?.65:.45;
        this.polygon(ctx,[[e.x,(e.y||1)-size,(e.z||0)-size],[e.x,(e.y||1)+size,(e.z||0)-size],[e.x,(e.y||1)+size,(e.z||0)+size],[e.x,(e.y||1)-size,(e.z||0)+size]],color+'33',color,2);
      }else if(e.k==='moon'){ctx.fillStyle='#e6d5ff';ctx.shadowColor=color;ctx.shadowBlur=16;ctx.beginPath();ctx.arc(p.x,p.y,p.k*.42,0,TAU);ctx.fill();}
      else{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,clamp(p.k*.24,5,18),this.time,TAU+this.time);ctx.stroke();}
      const names={board:'反射板',pane:'冻结窗格',moon:'月亮',gate:'星门',pool:'潮水',appoint:'预约',mini:'小猴',cone:'标志桶',pole:'长拍',yoyo:'悠悠',ribbon:'红丝带',bunFly:'包子'};
      const name=Y.SKILLS[e.sid]?.short||names[e.k];if(name)this.label(ctx,name,p.x,p.y-p.k*.48,clamp(this.r.H*.017,10,14),color);
      ctx.restore();
    }
    draw(ctx,m,o,dt){
      const r=this.r,{W,H}=r;this.time+=dt;r.time+=dt;
      const key=[W,H,r.dpr,r.venueId,r.mirror,r.quality].join(':');
      if(key!==this.key){this.key=key;this.background=r.layer(c=>this.scene(c));}
      ctx.setTransform(r.dpr,0,0,r.dpr,0,0);ctx.save();this.kick=Math.max(0,(this.kick||0)-dt*.045);const impulse=Math.sin(this.time*73)*this.kick*H*.12;ctx.translate(impulse,impulse*.35);ctx.drawImage(this.background,0,0,W,H);
      const s=m.shuttle,vision=Y.clubVisibility?.(m,o.labels?.[0]&&o.labels?.[1]?null:r.mirror?1:0)||{};
      const source=Object.prototype.hasOwnProperty.call(m,'players')&&Object.getPrototypeOf(m)?.courtMode==='3d'?Object.getPrototypeOf(m):m;
      if(this.source!==source){this.trail=[];this.source=source;}
      if(vision.hidden||s.hide||s.veil>0)this.trail=[];
      if(!vision.hidden&&!s.hide&&!(s.veil>0)&&dt>0&&s.live&&this.time-this.lastTrailAt>=1/120){this.trail.push({x:s.x,y:s.y,z:s.z||0,t:this.time});this.lastTrailAt=this.time;}while(this.trail.length&&(this.time-this.trail[0].t>.2||this.trail.length>25))this.trail.shift();
      const me=r.mirror?1:0;
      for(const preview of o.skillAims||[]){const p=m.players[preview.player];if(!p||!preview.id)continue;const a=preview.aim&&typeof preview.aim==='object'?preview.aim:{x:0,y:0};const z=clamp(p.z+(a.x||0)*3,-2.59,2.59),x=p.side*clamp(Math.abs(p.x)-(a.y||0)*3.5,.65,m.halfOf(p.idx)-.35),col=preview.cancelled?'#ff8b8b':Y.SKILLS[preview.id]?.color||'#caffff';this.ring(ctx,x,z,.7,col,.85);this.line(ctx,[p.x,.05,p.z],[x,.05,z],col+'88',1.5);const q=this.project(x,1.6,z);this.line(ctx,[x,0,z],[x,1.6,z],col+'88',1);this.label(ctx,preview.cancelled?'取消':Y.SKILLS[preview.id]?.short||'技能',q.x,q.y,12,col);}
      for(const p of m.players){
        if(!o.labels?.[p.idx])continue;const d=p.input3D||{},x=p.x+p.dir*.7,z=p.z;
        const end=[x+p.dir*.8,.02,z+(d.strafe||0)*.8];
        this.line(ctx,[x,.02,z],end,'#ffe19a88',2);
        const tip=this.project(...end);ctx.fillStyle='#ffe19aaa';ctx.beginPath();ctx.arc(tip.x,tip.y,2.5,0,TAU);ctx.fill();
      }
      if(!vision.hidden&&!s.hide&&!(s.veil>0)&&o.landHint&&m.pred&&!m.pred.hidden&&s.live&&!s.ctl){const q=m.pred;if(o.landHint.some(i=>s.lastHitter!==i)){this.ring(ctx,q.landX,q.landZ||0,.34,'#6cf1ef',.95);this.ring(ctx,q.landX,q.landZ||0,.5+Math.sin(this.time*6)*.05,'#6cf1ef',.4);this.line(ctx,[q.landX,0,q.landZ||0],[q.landX,.35,q.landZ||0],'#b6ffff88',2);}}
      if(m.landMark&&['point','over'].includes(m.phase))this.ring(ctx,m.landMark.x,m.landMark.z||0,.3+(m.time-m.landMark.t)*.12,m.landMark.inB?'#9effcd':'#ff7d7d',.8);
      this.footprints=(this.footprints||[]).filter(f=>(f.t-=dt)>0);
      for(const f of this.footprints)this.ring(ctx,f.x,f.z,.13+(1-f.t/.28)*.16,f.turn?'#ffdb9b':'#c6eadc',f.t/.28*.28);
      for(const p of m.players){
        const state=Y.staminaState(p),q=this.project(p.x,0,p.z);
        if(state.low||state.recovering){ctx.save();ctx.strokeStyle=state.color;ctx.globalAlpha=state.recovering?.55:.28;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,q.k*.46,q.k*.15,0,0,TAU*state.value/100);ctx.stroke();ctx.restore();}
      }
      Y.SkillFX?.clubCourt?.(ctx,m,(x,y,z)=>this.project(x,y,z||0),true);
      const objects=m.players.map(p=>({d:this.project(p.x,p.y,p.z).d,draw:()=>this.player(ctx,p,m)}));
      for(const p of m.players){const a=p.cnt?.club?.silhouette;if(a)objects.push({d:this.project(a.x,a.y,a.z).d,draw:()=>{ctx.save();ctx.globalAlpha=.4*clamp(a.t/.6,0,1);this.player(ctx,{...p,...a,swing:null,vx:0,vz:0},m,true);ctx.restore();}});}
      objects.push({d:this.project(0,0,0).d,draw:()=>this.net(ctx,m)});
      for(const e of m.ents||[])objects.push({d:this.project(e.x,e.y||0,e.z||0).d,draw:()=>this.device(ctx,e,m)});
      objects.sort((a,b)=>b.d-a.d).forEach(x=>x.draw());
      for(const p of m.players)this.resources(ctx,p,m);
      if(m.skillsOn)for(const p of m.players){const q=this.project(p.x,p.y+2.35,p.z);Y.SkillFX?.clubPlayer?.(ctx,p,q.x,Math.max(r.H*.15,q.y),clamp(q.k/42,.7,1.05),m.time);}
      for(let i=1;!vision.hidden&&i<this.trail.length;i++){const a=this.trail[i-1],b=this.trail[i];ctx.save();ctx.globalAlpha=i/this.trail.length*.6;this.line(ctx,[a.x,a.y,a.z],[b.x,b.y,b.z],s.fire?'#ff9d5b':['smash','halfsmash','kill'].includes(s.shot)?'#ffc578':'#e6fffb',1+i/this.trail.length*3);ctx.restore();}
      if(!vision.hidden&&(s.live||s.held)){ctx.save();if(vision.ghost)ctx.globalAlpha*=.24;this.shuttle(ctx,s);ctx.restore();}
      Y.SkillFX?.clubBall?.(ctx,m,(x,y,z)=>this.project(x,y,z||0),vision);
      Y.SkillFX?.clubInkSplash?.(ctx,m,(x,y,z)=>this.project(x,y,z||0));
      Y.SkillFX?.clubTiming?.(ctx,m,(x,y,z)=>this.project(x,y,z||0),o.labels?.[0]&&o.labels?.[1]?null:me);
      for(const p of m.players){const d=p.cnt?.club?.decoy;if(d){ctx.save();ctx.globalAlpha*=clamp(d.t/.13,0,1);this.shuttle(ctx,d);ctx.restore();}}
      if(!vision.hidden)Y.SkillFX?.filmBall?.(ctx,m,(x,y,z)=>{const q=this.project(x,y,z);return{...q,y:Math.max(q.y,H*.145)};},clamp(H/480,.8,1.2));
      this.lastHit=m.hitCount;
      for(const f of this.fx){
        f.t-=dt;const u=clamp(1-f.t/f.life,0,1),p=this.project(f.x,f.y,f.z),color=f.strained?'#ffb794':f.perfect?'#caffee':f.power?'#ffd087':'#e8ffff';
        ctx.save();ctx.globalAlpha=(1-u)**1.5;ctx.strokeStyle=color;ctx.lineWidth=f.power?3:1.5;
        ctx.beginPath();ctx.arc(p.x,p.y,3+u*(f.power?34:19),0,TAU);ctx.stroke();
        ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0,7*(1-u)),0,TAU);ctx.fill();
        if(f.high){const speed=Math.hypot(f.vx,f.vy,f.vz)||1,tip=this.project(f.x+f.vx/speed*(.45+u*.9),f.y+f.vy/speed*(.45+u*.9),f.z+f.vz/speed*(.45+u*.9));ctx.strokeStyle='#fff4ce';ctx.lineWidth=5*(1-u)+1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.strokeStyle='#ffac53';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(p.x,p.y,10+u*48,5+u*19,Math.atan2(tip.y-p.y,tip.x-p.x),0,TAU);ctx.stroke();}

        if(!f.soft&&!f.strained)for(let i=0;i<(r.quality?8:4);i++){const a=i/8*TAU+(f.seed||0),rad=u*(f.power?55:28);ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*rad*.55,p.y+Math.sin(a)*rad*.55);ctx.lineTo(p.x+Math.cos(a)*rad,p.y+Math.sin(a)*rad);ctx.stroke();}ctx.restore();
      }this.fx=this.fx.filter(f=>f.t>0);
      if(this.drawCastEffects)this.drawCastEffects(ctx,m,dt);
      else this.skillBursts=this.skillBursts.filter(f=>(f.t-=dt)>0);
      this.netPulse=Math.max(0,this.netPulse-dt);
      for(const n of this.notices){n.t-=dt;const p=m.players[n.p],q=this.project(p.x,p.y+2.35,p.z);ctx.save();ctx.globalAlpha=clamp(n.t*3,0,1);this.label(ctx,n.text,q.x,Math.max(H*.17,q.y)-(1.25-n.t)*12,clamp(H*.022,11,17),n.color);ctx.restore();}this.notices=this.notices.filter(n=>n.t>0);
      ctx.restore();
      // Compact status rail, deliberately outside the flight corridor.
      Y.SkillFX?.clubScreen?.(ctx,m,o.labels?.[0]&&o.labels?.[1]?null:r.mirror?1:0,W,H);
      const fs=clamp(H*.022,11,17),left=clamp(W*.025,16,42),top=H*.35;
      ctx.fillStyle='#071326bb';Y.rr(ctx,left,top,Math.max(98,W*.12),fs*4.2,10);ctx.fill();
      this.label(ctx,'3D · 纵深对战',left+12,top+fs*1.1,fs,'#ffd46a','left');this.label(ctx,`${m.rally||0} 拍回合`,left+12,top+fs*2.4,fs*.85,'#c9e2ed','left');if(this.lastSpeed)this.label(ctx,Math.round(this.lastSpeed*3.6*Y.C.SPEED_DISPLAY)+' km/h · '+(this.lastShot||''),left+12,top+fs*3.5,fs*.62,'#89b3c6','left');
      if(!o.noHud){r.drawScoreboard(ctx,m);if(!r.touch&&m.players[me]?.kit){const p=m.players[me],y=top+fs*5.5;this.label(ctx,'能量 '+Math.round(p.energy||0),left+12,y,fs*.8,'#ffe19a','left');p.kit.act.forEach((id,i)=>{const sk=Y.SKILLS[id];if(!sk)return;const yy=y+fs*(1.6+i*1.9),again=Y.skillRecastReady?.(m,p,id),prepared=Y.skillPrepared?.(m,p,id),low=!again&&!prepared&&(p.energy||0)<(sk.cost||100);ctx.save();if(low)ctx.globalAlpha=.4;Y.SkillIcons?.draw(ctx,id,left+18,yy,fs*.9,sk.color);this.label(ctx,(i?'O':'I')+'  '+sk.short,left+32,yy,fs*.85,sk.color,'left');ctx.restore();this.label(ctx,again||prepared?(Y.skillRecastText?.(m,p,id)||'再按'):Math.round(p.energy||0)>=(sk.cost||100)?'就绪':(sk.cost||100)+' 能量',left+12,yy+fs*.85,fs*.62,'#9bbccc','left');});}}
      if(m.phase==='serve'&&!o.noHud){const p=m.players[m.server],q=this.project(p.x,p.y+2.2,p.z),bw=70,bh=5;ctx.fillStyle='#06172e';ctx.fillRect(q.x-bw/2,q.y,bw,bh);ctx.fillStyle='#a6f4ce';ctx.fillRect(q.x-bw*.12,q.y,bw*.24,bh);ctx.fillStyle='#ffcf65';ctx.fillRect(q.x-bw/2+m.serveMeter()*bw-2,q.y-3,4,bh+6);}
      // Reuse the established banners, fonts, colors and audiovisual event hooks.
      if(r.titleIntro)r.drawTitleIntro(ctx,dt);else r.drawBanner(ctx,dt);
      if(!vision.hidden&&s.live&&(this.project(s.x,s.y,s.z).y<H*.17)){ctx.save();if(vision.ghost)ctx.globalAlpha*=.24;this.shuttle(ctx,s);ctx.restore();}
      for(const e of m.ents||[])if(['fake','dirty'].includes(e.k)&&this.project(e.x,e.y,e.z||0).y<H*.17)this.shuttle(ctx,e);
      if(o.waitText){ctx.fillStyle='#071026d9';ctx.fillRect(0,H*.43,W,H*.13);this.label(ctx,o.waitText,W/2,H*.495,fs,'#ffda7d');}
      if(!r.touch&&!o.noHud){ctx.fillStyle='#081525dc';Y.rr(ctx,W*.14,H-65,W*.72,58,10);ctx.fill();this.label(ctx,o.labels?.[1]&&o.labels?.[0]?'P1  WASD · F/G/H · R跳 · T/Y技能　|　P2  方向键 · , . / · Enter跳 · ; \'技能':'WASD / 方向键 移动　·　J 高远　K 吊球　L 跳杀　Space 起跳　I / O 技能',W/2,H-20,clamp(W*.011,10,14),'#c9dde3');this.label(ctx,'移动方向决定出球 · 触球时推杆打斜线 · 松杆打直线',W/2,H-47,clamp(W*.010,10,13),'#8eb7c8');}
      // Existing effects are fed by common event handlers; keep their queues bounded.
      for(const key of['parts','texts','lines'])if(r[key].length>80)r[key].splice(0,r[key].length-80);
    }
  }
  Y.CourtView3D=CourtView;
  Y.Renderer.prototype.spatialEvent=function(e,m){if(!this.court3D)this.court3D=new CourtView(this);this.court3D.event(e,m);};
  const old=Y.Renderer.prototype.draw;
  Y.Renderer.prototype.draw=function(m,o,dt){
    if(m?.courtMode!=='3d'){this.court3D=null;return old.call(this,m,o,dt);}
    const raw=o?.rawDt??dt;
    if(dt>0&&raw<.12&&!Y.platform.hidden()){this.frameAvg=this.frameAvg*.98+raw*.02;this.slowT=this.frameAvg>.028?(this.slowT||0)+raw:0;if(this.quality&&this.slowT>4){this.quality=0;this.slowT=0;this.resize();}}
    const view=this.court3D||(this.court3D=new CourtView(this));
    view.draw(this.ctx,this.interpolate(m,o?.alpha),o||{},dt);
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
