/* Original racket/court Foley. Shared by WebAudio and the WeChat WAV builder. */
(function(G){
  'use strict';
  const RATE=44100, TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const profiles={
    touch:[.12,.42,2100,.014,.42,.18], hit:[.19,.72,1750,.024,1.15,.38],
    perfect:[.21,.81,2050,.029,1.55,.5], power:[.27,.89,1670,.028,2.3,.56],
    kill:[.16,.8,2260,.019,1.8,.36], mishit:[.17,.52,820,.011,.4,.13]
  };
  function render(kind,variation=0){
    const p=profiles[kind],motion=kind.startsWith('swing'),heavy=kind==='swing-power',step=kind.startsWith('step');
    const paper=['office-return','paper-fold','paper-glide'].includes(kind);
    const duration=paper?(kind==='paper-glide'?.31:.24):p?.[0]||(motion?(heavy?.17:.13):kind==='net'?.2:step?.14:.17);
    const x=new Float64Array(Math.ceil(RATE*duration));let seed=2166136261;
    for(const c of kind+variation)seed=Math.imul(seed^c.charCodeAt(0),16777619);
    const noise=Float64Array.from(x,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;});
    function burst(at,amp,decay,low,high,attack=.00035){
      let a=0,b=0;const l=1-Math.exp(-TAU*low/RATE),h=1-Math.exp(-TAU*high/RATE);
      for(let i=0;i<x.length;i++){a+=h*(noise[i]-a);b+=l*(a-b);const t=i/RATE-at;if(t>=0)x[i]+=(a-b)*amp*(1-Math.exp(-t/attack))*Math.exp(-t/decay);}
    }
    function mode(freq,amp,decay,at=0){
      const k=1+(variation-1)*.022;
      for(let i=Math.ceil(at*RATE);i<x.length;i++){const t=i/RATE-at;x[i]+=Math.sin(TAU*freq*k*t)*amp*(1-Math.exp(-t/.00035))*Math.exp(-t/decay);}
    }
    if(p){
      // Cork compression, string-bed snap and irregular frame resonances.
      burst(0,p[4],.0026,1850,11500);burst(.0008,.55,.008,280,2100);
      for(const [ratio,gain] of [[1,1],[1.47,.38],[2.19,.18],[3.04,.07]])mode(p[2]*ratio,p[5]*gain,p[3]/Math.sqrt(ratio));
      mode(kind==='mishit'?420:610,kind==='power'?.28:.12,.012);
      burst(.004,kind==='power'?.46:.15,.023,1100,6400);
      if(kind==='mishit'){mode(730,.22,.009,.004);burst(.012,.22,.004,250,1250);}
    }else if(paper){
      if(kind==='office-return'){
        burst(0,.8,.007,330,2800);mode(410,.18,.016);burst(.026,.22,.013,1400,5400);
      }else{
        burst(0,.6,.025,1900,10500,.005);burst(.06,.35,.032,1100,7200,.004);
        if(kind==='paper-glide'){burst(.13,.38,.047,1700,6800,.008);mode(1450,.035,.05,.1);}
        else{burst(.12,.3,.016,2400,9500,.002);mode(2100,.04,.02,.09);}
      }
    }else if(motion){
      let lo=0,hi=0;for(let i=0;i<x.length;i++){lo+=.08*(noise[i]-lo);hi+=.65*(noise[i]-hi);const u=i/(x.length-1);x[i]=(hi-lo)*Math.sin(Math.PI*u)**(heavy?3.8:2.6);}
    }else if(kind==='net'){
      burst(0,.8,.01,300,3800);burst(.029,.32,.017,450,2800);mode(345,.1,.026);
    }else if(kind==='floor'){
      burst(0,.8,.005,680,6000);mode(720,.16,.012);burst(.051,.12,.004,850,3900);
    }else if(step&&kind!=='step'){
      if(kind==='step-snow'){burst(0,.7,.025,1400,6000,.003);burst(.035,.3,.016,700,3500,.002);}
      else{burst(0,.6,.009,180,2400);mode(kind==='step-deck'?175:320,.25,.025);mode(kind==='step-deck'?420:850,.09,.012,.006);burst(.016,.13,.015,1900,4900);}
    }else{
      burst(0,.75,kind==='land'?.019:.008,130,1900);mode(235,.17,.015);
      if(kind==='step'){mode(1680,.04,.012,.018);mode(2130,.02,.013,.018);}
      burst(.014,.12,.017,2100,5900);
    }
    // Very short court reflections; no booming bass or long synthetic tail.
    const dry=x.slice();for(const [delay,gain] of [[.014,.07],[.031,-.035],[.058,.018]]){const n=Math.round(delay*RATE);for(let i=n;i<x.length;i++)x[i]+=dry[i-n]*gain;}
    let dc=0,prev=0,peak=0;for(let i=0;i<x.length;i++){const v=x[i];dc=v-prev+.996*dc;prev=v;x[i]=Math.tanh(dc*.85)*Math.min(1,i/8,(x.length-i-1)/440);peak=Math.max(peak,Math.abs(x[i]));}
    const level=paper?.32:p?.[1]||(motion?(heavy?.42:.28):step?.24:kind==='net'?.34:.38);
    return Float32Array.from(x,v=>peak?v/peak*level:0);
  }
  const api={RATE,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else (G.YY=G.YY||{}).Foley=api;
})(typeof window!=='undefined'?window:globalThis);
