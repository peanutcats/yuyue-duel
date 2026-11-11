/* Original four-bar instrumental loops. Build-time PCM and browser share notes.
 * No simulation RNG, remote media, timers or audio contexts in this module. */
(function(G){
  'use strict';
  const RATE=44100,TAU=Math.PI*2;
  const rows=[
    ['menu',102,60,'warm',[0,7,4,9,7,4,2,4]],
    ['practice',92,62,'soft',[0,4,7,4,2,7,4,2]],
    ['arena',120,60,'sport',[0,7,12,9,7,4,7,2]],
    ['sunset',96,57,'warm',[0,4,7,11,9,7,4,2]],
    ['neon',128,57,'pulse',[0,7,10,12,7,3,5,10]],
    ['bamboo',100,62,'wood',[0,2,7,9,12,9,7,2]],
    ['harbor',108,65,'island',[0,4,7,9,7,2,4,7]],
    ['aurora',88,59,'glass',[0,7,11,14,12,7,4,2]],
    ['clutch',132,62,'pulse',[0,3,7,10,12,10,7,5]],
    ['victory',116,60,'sport',[0,4,7,12,16,14,12,7]],
    ['defeat',90,57,'soft',[7,5,4,2,0,4,2,0]],
    ['pause',80,60,'glass',[0,7,4,2,0,4,7,4]],
  ];
  const TRACKS=Object.fromEntries(rows.map(([id,bpm,key,voice,notes],i)=>[id,{id,bpm,key,voice,notes,root:'court-score-'+Math.floor(i/3),duration:16*60/bpm}]));
  function render(id){
    const tr=TRACKS[id]||TRACKS.menu,beat=60/tr.bpm,n=Math.round(tr.duration*RATE),out=new Float32Array(n);
    const freq=m=>440*2**((m-69)/12);
    function note(at,m,amp,duration,kind){
      const start=Math.round(at*RATE),end=Math.min(n,start+Math.round(duration*RATE)),f=freq(m);
      for(let i=start;i<end;i++){
        const t=(i-start)/RATE,u=t/duration,attack=Math.min(1,t/(kind==='pad'?.06:.006));
        const env=attack*Math.exp(-t/(kind==='pad'?duration*.65:duration*.3))*Math.min(1,(1-u)*18);
        const phase=TAU*f*t;
        let tone=Math.sin(phase);
        if(kind==='glass')tone+=.34*Math.sin(phase*2.003)*Math.exp(-t*9)+.18*Math.sin(phase*3.99)*Math.exp(-t*16);
        else if(kind==='wood')tone+=.42*Math.sin(phase*3.01)*Math.exp(-t*24);
        else if(kind==='pulse')tone+=.3*Math.sin(phase*2)+.15*Math.sin(phase*3)+.07*Math.sin(phase*5);
        else if(kind==='island')tone+=.24*Math.sin(phase*2.004)+.17*Math.sin(phase*4.01)*Math.exp(-t*12);
        else tone+=.18*Math.sin(phase*2.001)*Math.exp(-t*6);
        out[i]+=tone*env*amp;
      }
    }
    let seed=8171+tr.key;
    function drum(at,kind,amp){
      const start=Math.round(at*RATE),length=Math.round((kind==='kick'?.15:.07)*RATE);
      for(let j=0;j<length&&start+j<n;j++){
        const t=j/RATE;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=seed/2147483648-1;
        const v=kind==='kick'?Math.sin(TAU*(54*t+.95*(1-Math.exp(-t*40))))*Math.exp(-t*32):noise*Math.exp(-t*(kind==='hat'?100:65));
        out[start+j]+=v*amp*Math.min(1,j/16);
      }
    }
    const soft=['soft','glass'].includes(tr.voice),roots=[0,-5,-3,-7];
    for(let bar=0;bar<4;bar++){
      const root=tr.key+roots[bar];
      [0,4,7].forEach((d,i)=>note(bar*4*beat,root+d,.018,beat*3.8,'pad'));
      for(let step=0;step<8;step++){
        const at=(bar*4+step*.5)*beat;
        if(step%2===0||!soft)note(at,tr.key+tr.notes[(step+bar*2)%8]+(bar===3&&step>3?-12:0),soft?.075:.064,beat*(soft?1.4:.8),tr.voice);
        if(step===0||step===4||(!soft&&step===6))note(at,root-24,soft?.045:.085,beat*.85,'warm');
        if(!soft){drum(at,'hat',tr.voice==='pulse'?.022:.013);if(step===0||step===4)drum(at,'kick',.105);if(step===2||step===6)drum(at,'snare',.035);}
        if(tr.voice==='island'&&step%2)note(at,root+12,.03,beat*.4,'wood');
      }
    }
    let peak=0;for(let i=0;i<n;i++){out[i]*=Math.min(1,i/240,(n-1-i)/400);peak=Math.max(peak,Math.abs(out[i]));}
    const gain=.34/(peak||1);for(let i=0;i<n;i++)out[i]*=gain;
    return out;
  }
  function scene(app){
    if(app.mode==='story')return null;
    if(app.screen==='result'){const m=app.isOnline?.()?app.view:app.match;const won=typeof app.result?.won==='boolean'?app.result.won:app.mode==='local'||m?.winner===(app.mode==='guest'?1:app.playerIndex||0);return won?'victory':'defeat';}
    if(app.paused&&app.mode!=='attract')return 'pause';
    if(app.mode==='practice'&&!app.screen)return 'practice';
    if(app.screen||app.mode==='attract')return 'menu';
    const m=app.view&&app.isOnline?.()?app.view:app.match;
    if(m&&m.phase!=='over'&&Math.max(...m.score)>=(m.opt?.target||7)-1)return 'clutch';
    return TRACKS[app.R?.venueId]?app.R.venueId:'arena';
  }
  const api={RATE,TRACKS,render,scene};
  if(G.YY)G.YY.Soundtrack=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
