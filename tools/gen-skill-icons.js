'use strict';
const fs=require('node:fs'),path=require('node:path');
for(const name of ['core','char','roster','skill-icons'])require('../js/'+name);
const Y=globalThis.YY,root=path.resolve(__dirname,'..');
function generate(){const ids=Object.keys(Y.SKILLS);if(ids.length!==Object.keys(Y.SkillIcons.paths).length)throw Error('Skill icon catalog mismatch');
 for(const dir of ['assets/skills']){fs.mkdirSync(path.join(root,dir),{recursive:true});for(const id of ids){if(!Y.SkillIcons.paths[id])throw Error('Missing '+id);fs.writeFileSync(path.join(root,dir,id+'.svg'),Y.SkillIcons.svg(id)+'\n');}}
 const cards=Y.CHARS.map(c=>'<section><h2>'+Y.charName(c.id)+'<small>'+c.title+'</small></h2><div class="row">'+[c.passive,...c.acts].map(id=>{const s=Y.SKILLS[id];return '<article><div class="icon" style="color:'+s.color+'">'+Y.SkillIcons.svg(id)+'</div><b>'+s.name+'</b><small>'+(s.passive?'被动 · 常驻':'主动 · '+s.cost+' 能量')+'</small><p>'+Y.plainText(s.desc).replaceAll('<','&lt;')+'</p></article>';}).join('')+'</div></section>').join('');
 fs.writeFileSync(path.join(root,'assets/skills/index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>羽跃对决 · 技能图标图鉴</title><style>body{background:#0a1421;color:#edf6ff;font-family:"PingFang SC",sans-serif;margin:0;padding:38px}main{max-width:1180px;margin:auto}h1{font-size:34px}header{border-bottom:1px solid #314459;padding-bottom:24px}h2{margin:28px 0 14px;font-size:22px}small{color:#9daebe;font-size:12px;display:block;margin-top:8px}.row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#122337;border:1px solid #29435d;border-radius:14px;padding:20px}.icon{background:#0a1829;border-radius:16px;width:70px;height:70px;display:grid;place-items:center;margin-bottom:16px;border:1px solid currentColor}svg{width:42px;height:42px}b{font-size:16px}p{font-size:13px;line-height:1.8;color:#b8c9d8}@media(max-width:760px){body{padding:20px}.row{grid-template-columns:repeat(2,1fr)}}</style><main><header><small>YUYUE / SKILL ATLAS</small><h1>看图识招，见招拆招。</h1><p>'+Y.CHARS.length+' 位角色 · '+Y.CHARS.length+' 个被动 · '+(Y.CHARS.length*3)+' 个主动 · 原创 SVG 图标</p></header>'+cards+'</main></html>');
 return ids.length;
}
module.exports=generate;
if(require.main===module)console.log('Generated '+generate()+' SVG skill icons for web and WeChat.');
