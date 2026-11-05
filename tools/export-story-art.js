'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({YY:{SCENES:{}}});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/story-art.js'),'utf8'),ctx);
const out=path.resolve(__dirname,'../assets/story');fs.mkdirSync(out,{recursive:true});
const esc=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const [id,a] of Object.entries(ctx.YY.STORY_ART)){
 const body=a.shapes.map(s=>{
  if(s.type==='rect')return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="${s.fill}"/>`;
  if(s.type==='ellipse')return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill}"/>`;
  if(s.type==='text')return `<text x="${s.x}" y="${s.y}" font-family="sans-serif" font-size="${s.size}" font-weight="600" fill="${s.fill}">${esc(s.text)}</text>`;
  return `<${s.fill==='none'?'polyline':'polygon'} points="${s.points.map(p=>p.join(',')).join(' ')}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.width}"/>`;
 }).join('\n');
 fs.writeFileSync(path.join(out,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720"><title>${a.name}</title>${body}</svg>\n`);
}
console.log('Exported '+Object.keys(ctx.YY.STORY_ART).length+' production scene SVGs to assets/story');
