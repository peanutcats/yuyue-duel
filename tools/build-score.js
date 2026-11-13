'use strict';
// Offline music build for the standalone website; requires FFmpeg/libmp3lame.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {TRACKS,RATE,REVISION}=require('../js/soundtrack'),composer=require('./compose-score');
const root=path.resolve(__dirname,'..'),hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function buildScore(){
 const sourceHash=hash(Buffer.concat([fs.readFileSync(__filename),fs.readFileSync(path.join(__dirname,'compose-score.js')),fs.readFileSync(path.join(root,'js/soundtrack.js'))]));
 const cacheFile=path.join(root,'output/music-upgrade/build-cache.json');let previous={};try{previous=JSON.parse(fs.readFileSync(cacheFile,'utf8'));}catch(_){}
 const files={},report={};
 for(const [id,tr]of Object.entries(TRACKS)){
  const dest=path.join(root,tr.src),cached=previous.sourceHash===sourceHash&&fs.existsSync(dest)&&hash(fs.readFileSync(dest))===previous.files?.[id];
  if(!cached){
   const score=composer.render(id),input=composer.wav(score.channels),temp=dest+'.tmp.mp3';fs.mkdirSync(path.dirname(dest),{recursive:true});
   const r=spawnSync(process.env.FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','wav','-i','pipe:0','-map_metadata','-1','-codec:a','libmp3lame','-b:a','96k','-ar',String(RATE),'-ac','2','-write_xing','1',temp],{input,maxBuffer:2*1024*1024});
   if(r.error||r.status!==0){fs.rmSync(temp,{force:true});throw Error('Music encoding requires FFmpeg/libmp3lame: '+(r.error?.message||r.stderr.toString()));}
   fs.renameSync(temp,dest);console.log(`${id}: ${tr.duration.toFixed(1)} seconds / ${tr.bars} bars`);
  }
  files[id]=hash(fs.readFileSync(dest));report[id]={title:tr.title,seconds:tr.duration,bars:tr.bars,bpm:tr.bpm,bytes:fs.statSync(dest).size,sections:composer.arrangement(id).sections};
 }
 fs.mkdirSync(path.dirname(cacheFile),{recursive:true});fs.writeFileSync(cacheFile,JSON.stringify({revision:REVISION,sourceHash,files,report},null,2)+'\n');
 return {revision:REVISION,files,report};
}
module.exports={buildScore};if(require.main===module)buildScore();
