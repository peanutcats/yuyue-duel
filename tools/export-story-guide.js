'use strict';
// Export the actual playable script for editing, recording and curriculum review.
const fs=require('node:fs'),path=require('node:path');global.window=globalThis;
require('../js/core');require('../js/char');require('../js/roster');require('../js/campaign');require('../js/knowledge');require('../js/story');
const Y=global.YY;
const names={dialog:'剧情演出',inspect:'场景调查',board:'战术与规则图示',lab:'对照实验',combo:'三拍战术练习',pick:'人物选择',drill:'专项训练',footwork:'步法训练',serve:'发球训练',match:'实战'};
const speaker=id=>id==='nar'?'旁白':id==='mm'?'毛毛':Y.charName(id==='me'?'lingfeng':id);
const out=['# 星光回响：完整可玩剧本','', '本文件由 `node tools/export-story-guide.js` 从实际关卡导出。包含剧情后续与结局。修改剧情请编辑 `js/campaign.js` 后重新导出。','', '花括号为玩家此前选择留下的回应；对白按当前选择替换。每段对话可跳过或重听，动作与表情由演出系统解释。',''];
for(const ch of Y.STORY){
 out.push('## '+ch.title,'',ch.blurb,'');
 for(const st of ch.stages){
  out.push('### '+st.id+' '+st.title,'',st.desc,'','学习目标：'+st.knowledge.map(id=>Y.card(id).title).join('、')+'。','');
  for(const step of st.steps){
   out.push('**'+names[step.t]+(step.scene?' · '+step.scene:'')+'**','');
   if(step.t==='dialog')for(const [who,text,mood,action]of step.lines)out.push('- '+speaker(who)+'：'+text+(action?'（动作：'+action+'）':''));
   else if(step.t==='inspect')for(const item of step.items)out.push('- '+item.label+'：'+item.text);
   else if(step.t==='board')for(const c of step.cases)out.push('- '+c.q,'  - 选项：'+c.options.join(' / '),'  - 正确选择：'+c.options[c.answer]+'。'+c.explanation);
   else if(step.t==='pick'){out.push(step.q,'');for(const o of step.o)out.push('- '+o.label+'：'+o.note+' 后续回应：“'+(o.reply||o.label)+'”');}
   else if(step.t==='match')out.push('对手：'+speaker(step.opp)+'；难度：'+step.level+'；目标 '+step.target+' 分，'+step.cap+' 分封顶。'+(step.skills===false?'本场关闭角色技能。':'')+(step.startScore?'开局比分 '+step.startScore.join('∶')+'。':''));
   else if(step.t==='lab')out.push('实验项目：'+step.experiment+'。试完三种设定后，按题目选择；可反复比较。');
   else if(step.t==='combo')out.push('高远压后场 → 吊球调网前 → 抓半场高球进攻。失误只重练当前一步。');
   else out.push(step.def.name+'。目标：'+(step.def.goal?step.def.goal.need+'/'+step.def.goal.total:step.def.need+'/'+step.def.total)+'。');
   out.push('');
  }
  out.push('**知识回收**','');for(const id of st.knowledge){const c=Y.card(id);out.push('- '+c.title+'：'+c.text);}
  out.push('');
 }
}
fs.writeFileSync(path.resolve(__dirname,'../STORY_SCRIPT.md'),out.join('\n')+'\n');
console.log('Exported '+Y.STAGES.length+' playable stages to STORY_SCRIPT.md');
