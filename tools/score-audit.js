'use strict';
// Decode the shipped MP3s, audit the actual delivery format, make a listening reel.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {TRACKS,RATE}=require('../js/soundtrack'),{arrangement,wav}=require('./compose-score');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/music-upgrade');fs.mkdirSync(output,{recursive:true});
function run(command,args){const r=spawnSync(command,args,{maxBuffer:80*1024*1024});if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr.toString());return r.stdout;}
const report={},reel=[];
for(const [id,tr]of Object.entries(TRACKS)){
 const file=path.join(root,tr.src);
 const info=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]));
 assert.equal(info.streams[0].codec_name,'mp3');assert.equal(info.streams[0].channels,2);assert.equal(+info.streams[0].sample_rate,RATE);
 const bytes=run('ffmpeg',['-v','error','-i',file,'-f','f32le','-acodec','pcm_f32le','pipe:1']);
 const pcm=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),n=pcm.length/2;
 let peak=0,energy=0,dc=0,side=0;for(let i=0;i<pcm.length;i++){assert.ok(Number.isFinite(pcm[i]));peak=Math.max(peak,Math.abs(pcm[i]));energy+=pcm[i]**2;dc+=pcm[i];if(i%2===0)side+=(pcm[i]-pcm[i+1])**2;}
 const rms=Math.sqrt(energy/pcm.length);assert.ok(peak<.72&&peak>.2,id+' decoded peak');assert.ok(rms>.055&&rms<.14,id+' level');assert.ok(Math.abs(dc/pcm.length)<.003,id+' DC');assert.ok(side/n>.00001,id+' stereo image');assert.ok(Math.abs(n/RATE-tr.duration)<.03,id+' gapless duration');
 const sections=arrangement(id).sections.map((s,i,all)=>{const start=Math.round(s.bar*240/tr.bpm*RATE)*2,end=Math.min(pcm.length,Math.round((all[i+1]?.bar||tr.bars)*240/tr.bpm*RATE)*2);let e=0;for(let j=start;j<end;j++)e+=pcm[j]**2;return {...s,rms:Math.sqrt(e/(end-start))};});
 report[id]={title:tr.title,seconds:n/RATE,peak,rms,dc:dc/pcm.length,stereoRMS:Math.sqrt(side/n),sections,bytes:fs.statSync(file).size};
 // 9 seconds from the developed theme; a short fade separates the tracks.
 const start=Math.round((tr.bars>16?5:1)*240/tr.bpm*RATE),len=9*RATE,clip=[new Float32Array(len),new Float32Array(len)];
 for(let i=0;i<len;i++){const g=Math.min(1,i/(RATE*.3),(len-1-i)/(RATE*.5));clip[0][i]=pcm[(start+i)*2]*g;clip[1][i]=pcm[(start+i)*2+1]*g;}reel.push(clip);
}
const size=reel.reduce((n,c)=>n+c[0].length,0),channels=[new Float32Array(size),new Float32Array(size)];let offset=0;for(const clip of reel){channels[0].set(clip[0],offset);channels[1].set(clip[1],offset);offset+=clip[0].length;}
const temp=path.join(output,'suite-preview.wav');fs.writeFileSync(temp,wav(channels));
run('ffmpeg',['-v','error','-y','-i',temp,'-codec:a','libmp3lame','-b:a','160k',path.join(output,'羽跃配乐升级试听.mp3')]);fs.unlinkSync(temp);
fs.writeFileSync(path.join(output,'decoded-audit.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'试听曲目.md'),'# 羽跃配乐升级试听\n\n每首 9 秒，按下表顺序衔接；游戏中为完整曲目。\n\n'+Object.entries(TRACKS).map(([id,tr],i)=>`- ${Math.floor(i*9/60)}:${String(i*9%60).padStart(2,'0')} ${tr.title} · ${tr.bpm} BPM · 完整 ${tr.duration.toFixed(1)} 秒`).join('\n')+'\n');
console.log(JSON.stringify({tracks:Object.keys(report).length,totalSeconds:Object.values(report).reduce((n,r)=>n+r.seconds,0),peak:Math.max(...Object.values(report).map(r=>r.peak)),bytes:Object.values(report).reduce((n,r)=>n+r.bytes,0),preview:path.join(output,'羽跃配乐升级试听.mp3')},null,2));
