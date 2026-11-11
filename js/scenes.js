/* 十六根羽毛 · 分镜、慢推镜头、羽毛转场与人物演出。 */
(function(G){
 'use strict';const Y=G.YY,TAU=Math.PI*2;Y.SCENES={};
 Y.storyCast=function(step,index){const ids=[...(step.cast||[])];for(const line of step.lines.slice(0,index+1)){const id=line[0];if(!['nar','intent'].includes(id)&&!ids.includes(id))ids.push(id);}return ids.slice(-5);};
 const color=(g,w,h)=>{const v=g.createLinearGradient(0,0,0,h);v.addColorStop(0,'#08112a20');v.addColorStop(.5,'#08112a00');v.addColorStop(1,'#08112a88');return v;};
 Y.Renderer.prototype.drawStory=function(info,dt){
  const g=this.ctx,W=this.W,H=this.H,d=this.dpr;this.time+=dt;const t=this.time;
  const scene=Y.SCENES[info.scene],art=info.cg&&Y.STORY_CGS?.[info.cg],key=(art?.id||info.scene)+'@'+W+'x'+H;
  if(this.storyShotKey!==key){this.storyShotKey=key;this.storyShotAge=0;this.storyActors={};this.storyShotCanvas=null;}
  this.storyShotAge+=dt;const age=this.storyShotAge;
  if(!this.storyShotCanvas){const cv=Y.platform.createCanvas();cv.width=Math.round(W*d);cv.height=Math.round(H*d);const bg=cv.getContext('2d');bg.setTransform(d,0,0,d,0,0);if(art||scene){const k=Math.max(W/1280,H/720);bg.save();bg.translate((W-1280*k)/2,(H-720*k)*.12);if(art)Y.paintStoryArt(bg,art,0,0,1280*k,720*k);else scene.bake(bg,1280*k,720*k);bg.restore();}else{bg.fillStyle='#152743';bg.fillRect(0,0,W,H);}this.storyShotCanvas=cv;}
  g.setTransform(d,0,0,d,0,0);g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
  const zoom=1+Math.min(age,15)*.0008;g.translate(W/2,H*.45);g.scale(zoom,zoom);g.translate(-W/2,-H*.45);g.drawImage(this.storyShotCanvas,0,0,W,H);
  const kind=scene?.kind;
  // Analytic atmosphere never consumes the match RNG.
  g.save();g.globalAlpha=.24;
  if(['backroom','bakery','empty','memory'].includes(kind)){
   g.strokeStyle='#c8eaff';g.lineWidth=H*.025;
   for(let i=0;i<7;i++){const x=W*(.18+i*.103)+Math.sin(t*.46+i)*W*.018,y=H*(.6-(t*.035+i*.13)%.48);g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-W*.03,y-H*.08,x+W*.04,y-H*.12,x,y-H*.2);g.stroke();}
  }
  if(info.scene==='rooftop-rain'){
   g.strokeStyle='#c5deff';g.lineWidth=1;for(let i=0;i<55;i++){const x=(i*71+t*92)%W,y=(i*47+t*222)%H;g.beginPath();g.moveTo(x,y);g.lineTo(x-8,y+21);g.stroke();}
  }else for(let i=0;i<17;i++){const x=(i*97.2+Math.sin(t*.16+i)*19)%W,y=(i*51.3+t*7)%H;g.fillStyle='#ffda85';g.beginPath();g.ellipse(x,y,.8+i%2,.8+i%2,0,0,TAU);g.fill();}
  g.restore();
  if(!art&&!info.noCast){
   const cast=info.cast||[],n=cast.length,k=Math.min(H*.36,W/(n+1)*.7),span=Math.min(W*.76,n*k*.96);
   for(let i=0;i<n;i++){
    const id=cast[i],look=Y.lookOf(id);if(!look||id==='goose')continue;const focus=id===info.who;
    const x=W/2+(n===1?-.07*W:(i/(n-1)-.5)*span),entrance=Math.max(0,1-Math.min(1,age*3)),size=k*(focus?1.04:1),f=x<W/2?1:-1;
    g.save();g.globalAlpha=(focus?1:.77)*Math.min(1,age*3.4+.15);g.translate(x+f*entrance*-28,H*.99);g.scale(f*size,-size);
    const p={idx:i,dir:1,vx:0,vy:0,onGround:true,swing:null,runPhase:0,land:0,x:0,y:0};
    Y.drawCharacter(g,p,look,{time:t,mood:focus?info.mood||'talk':'smile',gazeX:1,gazeY:0,spring:[Math.sin(t*1.2+i)*.012,0],f,talk:focus&&info.talking,blink:((t+i*1.3)%3.8)<.1,hideRacket:!['memory','empty','league','gym','winter','historic','young'].includes(kind)});g.restore();
   }
  }
  g.restore();g.fillStyle=color(g,W,H);g.fillRect(0,0,W,H);
  if(age<.5&&!info.reducedMotion){const u=age/.5;g.save();for(let i=0;i<5;i++){const x=W*(1.35-u*2)-i*W*.15;g.fillStyle=i===4?'#ffcf4acc':'#101b38';g.beginPath();g.moveTo(x+H*.28,0);g.lineTo(x+W*.65+H*.28,0);g.lineTo(x+W*.65,H);g.lineTo(x,H);g.closePath();g.fill();}g.restore();}
  if(info.intent){g.save();g.font=`500 ${Math.max(16,H*.047)}px "PingFang SC",sans-serif`;g.textAlign='center';const text=info.intent,tw=g.measureText(text).width;g.fillStyle='#102449ed';Y.rr(g,W/2-tw/2-21,H*.2-26,tw+42,46,3);g.fill();g.fillStyle='#b6edff';g.fillText(text,W/2,H*.2+5);g.restore();}
  if(info.white){g.fillStyle='#faf6e8';g.fillRect(0,0,W,H);}if(info.black){g.fillStyle='#080f24';g.fillRect(0,0,W,H);}
  g.fillStyle='#080f24';g.fillRect(0,0,W,Math.min(16,H*.035));
 };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
