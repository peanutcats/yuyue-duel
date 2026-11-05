'use strict';
const fs=require('node:fs'),path=require('node:path');
global.window=globalThis;
require('../js/core');require('../js/roster');require('../js/campaign');require('../js/story-play');
const alternatives={...Object.fromEntries(Object.entries(YY.STORY_DEFAULTS).map(([k,v])=>[k,[v]]))};
for(const chapter of YY.CAMPAIGN)for(const st of chapter.stages)for(const step of st.steps)if(step.t==='pick'&&step.key)alternatives[step.key]=[...new Set([...(alternatives[step.key]||[]),...step.o.map(o=>o.reply||o.label)])];
const rows=new Map();
for(const chapter of YY.CAMPAIGN)for(const stage of chapter.stages)for(const step of stage.steps)if(step.t==='dialog')for(const [who,original,mood] of step.lines){
 let texts=[original];for(const [key,values]of Object.entries(alternatives))if(original.includes('{'+key+'}'))texts=texts.flatMap(text=>values.map(v=>text.replaceAll('{'+key+'}',v)));
 for(const text of texts){const id=YY.voiceKey(who,text);if(rows.has(id)&&(rows.get(id).who!==who||rows.get(id).text!==text))throw Error('Dialogue hash collision: '+id);if(!rows.has(id))rows.set(id,{id,who,text,mood,chapter:chapter.id,stage:stage.id,root:'voice-'+Math.floor(Number(chapter.id.slice(2))/2)});}
}
const out=path.resolve(__dirname,'../assets/story/voice-script.json');fs.writeFileSync(out,JSON.stringify([...rows.values()],null,2)+'\n');console.log(rows.size+' voiced lines -> '+out);
