'use strict';
// Original compositions and instrument models. Offline only; no game RNG/assets.
const { TRACKS, RATE } = require('../js/soundtrack');
const TAU = Math.PI * 2;
const scales = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], pentatonic:[0,2,4,7,9] };
const themes = {
  menu:[[0,2,4,6,4,2,1,2],[5,4,2,1,0,2,4,1]],
  practice:[[0,2,4,2,1,4,2,1],[3,5,4,2,1,2,0,1]],
  arena:[[0,4,7,5,4,2,4,1],[5,7,6,4,2,3,1,0]],
  sunset:[[0,2,4,6,5,4,2,1],[3,4,5,7,6,4,1,2]],
  neon:[[0,4,6,7,4,2,3,6],[5,7,9,7,6,4,3,1]],
  bamboo:[[0,1,3,4,5,4,3,1],[2,4,6,5,4,2,1,0]],
  harbor:[[0,2,4,5,4,1,2,4],[5,4,2,7,6,4,3,1]],
  aurora:[[0,4,6,8,7,4,2,1],[5,7,9,8,6,4,3,2]],
  clutch:[[0,2,4,6,7,6,4,3],[5,6,8,7,6,4,3,1]],
  victory:[[0,2,4,7,9,8,7,4],[5,7,6,4,2,4,1,0]],
  defeat:[[4,3,2,1,0,2,1,0],[5,4,2,3,1,2,4,0]],
  pause:[[0,4,2,1,0,2,4,2],[5,4,2,1,3,2,1,0]],
  rally:[[0,4,5,7,4,2,4,6],[7,6,4,5,2,4,1,0]],
  // Related colour, but never disclose the sixteen-note finale early.
  'story-day':[[0,2,4,1,5,4,3,2],[5,7,4,3,2,1,3,0]],
  'story-night':[[4,2,1,3,2,0,1,2],[5,4,3,1,2,3,1,0]],
};
const ensembles = {
  city:{lead:'rhodes',counter:'guitar',arp:'bell',drums:'pop',swing:.04},
  lofi:{lead:'rhodes',counter:'flute',arp:'guitar',drums:'brush',swing:.10},
  breaks:{lead:'pluck',counter:'brass',arp:'rhodes',drums:'breaks',swing:.025},
  guitar:{lead:'guitar',counter:'flute',arp:'rhodes',drums:'brush',swing:.055},
  electro:{lead:'pluck',counter:'bell',arp:'synth',drums:'four',swing:0},
  bamboo:{lead:'flute',counter:'wood',arp:'wood',drums:'wood',swing:.02},
  island:{lead:'steel',counter:'guitar',arp:'wood',drums:'latin',swing:.035},
  ambient:{lead:'bell',counter:'piano',arp:'glass',drums:'air',swing:0},
  drive:{lead:'synth',counter:'brass',arp:'pluck',drums:'drive',swing:0},
  celebrate:{lead:'brass',counter:'piano',arp:'bell',drums:'pop',swing:0},
  piano:{lead:'piano',counter:'glass',arp:'piano',drums:'air',swing:.02},
};
function arrangement(id) {
  const tr = TRACKS[id]; if (!tr) throw Error('Unknown score: '+id);
  const band = ensembles[tr.ensemble], scale = scales[tr.mode], events = [], sections = [];
  const degree = d => tr.key + scale[((d%scale.length)+scale.length)%scale.length] + 12*Math.floor(d/scale.length);
  const chordScale = tr.mode === 'minor' ? scales.minor : scales.major;
  const chordNote = d => tr.key + chordScale[((d%7)+7)%7] + 12*Math.floor(d/7);
  const progress = tr.mode === 'minor' ? [0,5,2,6,3,0,5,4] : [0,5,3,4,2,5,3,4];
  const gentle = ['piano','ambient','lofi'].includes(tr.ensemble) || id.startsWith('story');
  const note = (at,midi,length,gain,instrument,pan=0) => events.push({at,midi,length,gain,instrument,pan});
  const drum = (at,instrument,gain,pan=0) => note(at,0,.5,gain,instrument,pan);
  for (let bar = 0; bar < tr.bars; bar++) {
    const section = ['rally','clutch'].includes(id) ? (bar<8?'theme':bar<16?'answer':bar<20?'bridge':'return')
      : tr.bars===32 ? (bar<4?'intro':bar<12?'theme':bar<20?'answer':bar<24?'bridge':'return')
      : tr.bars===24 ? (bar<4?'intro':bar<12?'theme':bar<16?'bridge':'return')
      : (bar<4?'theme':bar<8?'answer':bar<12?'bridge':'return');
    if (!sections.length || sections.at(-1).name!==section) sections.push({name:section,bar});
    const intro=section==='intro', bridge=section==='bridge', answer=section==='answer', reprise=section==='return';
    const density = intro?.56:bridge?.36:reprise?1:.82;
    const chord = progress[(bar + (answer?2:bridge?4:0))%8], at=bar*4;
    // Close seventh voicings instead of parallel root-position triads.
    const harmony = [0,2,4,6].map(d=>{let n=chordNote(chord+d);while(n>tr.key+14)n-=12;return n;}).sort((a,b)=>a-b);
    harmony.forEach((n,i)=>note(at,n,4.5,.024*(bridge?1.3:1),'pad',(i-1.5)*.30));
    const rhythm = bridge?[0,2.5]:band.drums==='latin'?[0,1.5,2.75]:band.drums==='four'?[0,1,2,3]:[0,1.5,2,3.5];
    rhythm.forEach((b,i)=>note(at+b,chordNote(chord)-24+(i===2?7:0),bridge?1.6:.72,.15*(intro?.75:1),'bass',0));
    // Offbeat chord comping and changing arpeggios answer the melody.
    if (!intro || bar>1) for (const b of (bridge?[1.5]:[.5,2.5])) {
      harmony.slice(0,3).forEach((n,i)=>note(at+b+i*.023,n,.65,.034*density,band.arp,-.35));
    }
    if ((answer||reprise) && bar%4!==3) for(let s=0;s<8;s++) {
      if (s===2 || s===6) continue;
      note(at+s*.5,harmony[(s+bar)%4]+12,.38,.025,band.arp,.42);
    }
    // Four-bar call/response, rests, held notes and an alternative B melody.
    const phrase = bar%4, motif = themes[id][answer||bridge?1:0];
    const slots = gentle ? [[0,1.25,2.5],[.5,2],[0,1.5,2.5],[.5,2.5]][phrase]
      : [[0,.75,1.5,2.5,3.25],[.5,1.5,2.75],[0,1,1.75,2.5,3.5],[0,1.5,3]][phrase];
    if (!intro || bar%2===0) slots.forEach((b,i)=>{
      if (bridge && i%2) return;
      let d=motif[(phrase*2+i)%8];
      if(reprise && phrase===2)d+=scale.length;
      let pitch=i===0&&phrase%2===1?harmony[2]:degree(d);
      if(id==='bamboo'&&pitch<tr.key+4)pitch+=12;
      const next=slots[i+1]??4, length=Math.max(.3,(next-b)*(gentle?1.1:.85));
      note(at+b+(i%2?band.swing:0),pitch,length,.12*(intro?.75:bridge?.72:1)*(i%3===1?.82:1),band.lead,-.10);
    });
    if ((answer||reprise) && phrase%2===1) {
      [1,2.25,3.25].forEach((b,i)=>note(at+b,harmony[(i+1)%4]+(gentle?12:0),.68,.054,band.counter,.34));
    }
    // Separate grooves, with four/eight-bar fills and breakdowns.
    if (band.drums==='air') {
      if(bar%4===0)drum(at,'shaker',.022,-.25);
    } else if (!bridge && (!intro || bar>=2)) {
      const kick = band.drums==='four'?[0,1,2,3]:band.drums==='drive'?[0,1.5,2,2.75,3.5]:band.drums==='latin'?[0,2.5]:band.drums==='breaks'?[0,1.5,2.75]:[0,2];
      kick.forEach(b=>drum(at+b,'kick',(gentle?.12:.20)*density));
      [1,3].forEach(b=>drum(at+b,band.drums==='wood'?'rim':band.drums==='brush'||band.drums==='latin'?'brush':'snare',.09*density,.09));
      for(let s=0;s<8;s++)drum(at+s*.5+(s%2?band.swing:0),band.drums==='wood'||band.drums==='latin'?'shaker':'hat',(.022+(s%2)*.011)*density,s%2?.35:-.3);
      if(band.drums==='latin')for(const b of [.75,1.75,3.25])drum(at+b,'conga',.065,-.4);
      if(phrase===3 && bar!==tr.bars-1)for(const [i,b]of [2.75,3.25,3.5,3.75].entries())drum(at+b,i<2?'tom':'rim',.055+i*.008,i%2?.25:-.25);
      if(bar%8===0)drum(at,'cymbal',.028,.3);
    }
    if (bar === tr.bars-1) note(at+3.5,degree(4)-12,.55,.045,band.counter,.25);
  }
  return {track:tr,events,sections};
}
function render(id, rate=RATE) {
  const score=arrangement(id), tr=score.track, beat=60/tr.bpm, n=Math.round(tr.duration*rate);
  const left=new Float32Array(n),right=new Float32Array(n), cache=new Map();
  function voice(kind,midi,seconds) {
    const key=kind+':'+midi+':'+seconds.toFixed(3);if(cache.has(key))return cache.get(key);
    const percussion=['kick','snare','hat','shaker','brush','rim','conga','tom','cymbal'].includes(kind);
    const dur=percussion?({kick:.30,snare:.22,hat:.08,shaker:.13,brush:.19,rim:.08,conga:.23,tom:.28,cymbal:1.2}[kind]):seconds+(kind==='pad'?.4:.23);
    const data=new Float32Array(Math.ceil(dur*rate)), f=440*2**((midi-69)/12);
    let seed=971+Math.round(f*17)+kind.length, low=0, previous=0;
    for(let i=0;i<data.length;i++) {
      const t=i/rate,p=TAU*f*t;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
      let v=0, env=1;
      if(percussion) {
        low+=.22*(noise-low);const high=noise-low;
        if(kind==='kick')v=(Math.sin(TAU*(48*t+1.5*(1-Math.exp(-t*32))))*Math.exp(-t*18)+high*.08*Math.exp(-t*160));
        if(kind==='snare')v=(high*.65*Math.exp(-t*27)+Math.sin(TAU*185*t)*.4*Math.exp(-t*35));
        if(kind==='brush')v=high*.6*Math.exp(-t*24)*(1-Math.exp(-t*90));
        if(kind==='hat'||kind==='shaker')v=high*Math.exp(-t*(kind==='hat'?65:38));
        if(kind==='rim')v=(Math.sin(TAU*820*t)+.45*Math.sin(TAU*1320*t))*Math.exp(-t*90);
        if(kind==='conga'||kind==='tom')v=(Math.sin(TAU*((kind==='tom'?120:220)*t+.45*(1-Math.exp(-t*25))))+.25*Math.sin(TAU*360*t))*Math.exp(-t*21);
        if(kind==='cymbal')v=high*Math.exp(-t*5)*(1+.3*Math.sin(TAU*43*t));
        env=Math.min(1,t/.0015);
      } else {
        const attack=kind==='pad'?.16:kind==='flute'?.038:kind==='brass'?.027:.005;
        const release=Math.min(1,(dur-t)/(kind==='pad'?.4:.16));
        env=Math.min(1,t/attack)*release;
        if(kind==='pad')v=(Math.sin(p)+.22*Math.sin(p*1.002)+.17*Math.sin(p*2))*.55*(.82+.18*Math.sin(TAU*.6*t));
        else if(kind==='bass'){v=Math.sin(p)+.3*Math.sin(p*2)+.08*Math.sin(p*3);env*=Math.exp(-t/(seconds*.85));}
        else if(kind==='flute'){v=Math.sin(p+.009*Math.sin(TAU*5.1*t))+.18*Math.sin(2*p)+.035*low;env*=Math.exp(-t/(seconds*2));}
        else if(kind==='brass'){v=Math.sin(p)+.38*Math.sin(p*2)+.17*Math.sin(p*3)+.07*Math.sin(p*4);env*=Math.exp(-t/(seconds*.9));}
        else if(kind==='piano'||kind==='rhodes'){
          v=Math.sin(p)+.32*Math.sin(p*2.002)*Math.exp(-t*4)+.13*Math.sin(p*3.003)*Math.exp(-t*7)+.06*Math.sin(p*5.008)*Math.exp(-t*12);
          if(kind==='rhodes')v=Math.sin(p+1.1*Math.sin(p*2)*Math.exp(-t*6))+.15*Math.sin(p*.999);
          env*=Math.exp(-t/(seconds*.55+.12));
        } else if(kind==='guitar'||kind==='wood'){
          v=Math.sin(p)+.45*Math.sin(p*2)*Math.exp(-t*8)+.24*Math.sin(p*3)*Math.exp(-t*12)+.14*Math.sin(p*4)*Math.exp(-t*16);
          if(kind==='wood')v=Math.sin(p)+.45*Math.sin(p*3.01)*Math.exp(-t*25);
          env*=Math.exp(-t/(kind==='wood'?.16:seconds*.42+.07));
        } else if(kind==='bell'||kind==='glass'||kind==='steel'){
          v=Math.sin(p)+.40*Math.sin(p*(kind==='steel'?2.01:2.003))*Math.exp(-t*5)+.18*Math.sin(p*4.01)*Math.exp(-t*10);
          env*=Math.exp(-t/(seconds*.55+.14));
        } else {
          const brightness=Math.exp(-t*5);
          v=Math.sin(p)+.38*Math.sin(p*2)*brightness+.21*Math.sin(p*3)*brightness+.08*Math.sin(p*5)*brightness;
          env*=Math.exp(-t/(seconds*(kind==='synth'?.65:.4)+.06));
        }
      }
      previous+=.72*(v*env-previous);data[i]=previous;
    }
    cache.set(key,data);return data;
  }
  for(const e of score.events) {
    const data=voice(e.instrument,e.midi,e.length*beat),start=Math.round(e.at*beat*rate);
    const l=Math.sqrt((1-e.pan)*.5)*e.gain,r=Math.sqrt((1+e.pan)*.5)*e.gain;
    for(let i=0;i<data.length;i++){const j=(start+i)%n;left[j]+=data[i]*l;right[j]+=data[i]*r;}
  }
  // Circular, crossed early reflections carry note tails across the loop seam.
  const taps=[[.071,.12],[.113,.095],[.193,.07],[beat*.75,.105],[beat*1.5,.045]];
  const dryL=left.slice(),dryR=right.slice();
  for(const [delay,gain]of taps){const d=Math.round(delay*rate);for(let i=0;i<n;i++){const j=(i-d+n)%n;left[i]+=dryR[j]*gain;right[i]+=dryL[j]*gain;}}
  let peak=0,energy=0,sumL=0,sumR=0;
  for(let i=0;i<n;i++){sumL+=left[i];sumR+=right[i];}
  const dcL=sumL/n,dcR=sumR/n;
  for(let i=0;i<n;i++){left[i]=Math.tanh((left[i]-dcL)*1.25);right[i]=Math.tanh((right[i]-dcR)*1.25);peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2+right[i]**2;}
  const gain=Math.min(.62/peak,.115/Math.sqrt(energy/(n*2)));
  for(let i=0;i<n;i++){left[i]*=gain;right[i]*=gain;}
  // A 2 ms taper also protects decoders without gapless support.
  const edge=Math.round(rate*.002);
  for(let i=0;i<edge;i++){const g=i/edge;left[i]*=g;right[i]*=g;left[n-1-i]*=g;right[n-1-i]*=g;}
  return {...score,rate,channels:[left,right],peak:peak*gain};
}
function wav(channels,rate=RATE) {
  const n=channels[0].length,count=channels.length,data=Buffer.alloc(44+n*count*2);
  data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
  data.writeUInt16LE(1,20);data.writeUInt16LE(count,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*count*2,28);
  data.writeUInt16LE(count*2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(n*count*2,40);
  for(let i=0;i<n;i++)for(let c=0;c<count;c++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*count+c)*2);
  return data;
}
module.exports={arrangement,render,wav};
