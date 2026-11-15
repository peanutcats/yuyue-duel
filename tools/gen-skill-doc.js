'use strict';
// 由 js/roster.js 的技能数据重新生成 SKILL_DESIGN.md 的角色技能表：node tools/gen-skill-doc.js
const fs = require('node:fs'), path = require('node:path');
globalThis.window = globalThis;
for (const f of ['core', 'char', 'roster', 'court3d-skill-info', 'skill-guide']) require(path.join(__dirname, '../js', f + '.js'));
const YY = globalThis.YY;
const clientVersion = '1.32';

const THEME = { pupil:'课间规则发明家', zhuzhu:'书法控球',sun:'篮球步法与流程连携',dong:'安全防御与资源调度', bobo:'骨翼腾空',miaomiao:'空地滑步与精准流转',mage:'折纸反击',nan:'回羽剪辑',
  lingfeng: '空中机动', canglan: '潮水', xiaohong: '几何', ranran: '蝶结穿花与控网', ruibao: '锅台火候与连携', xingxing: '星空与重力',
  dingding: '机械球拍与棘轮飞轮', houzi: '驾云、荡藤与小猴', lu: '程序指令', laochen: '数据推演', guoge: '投机与力量', tianchu: '心理欺骗', zhu: '长短布局与虚实调动',
};
const md = (s) => s.replace(/\{([^}]*)\}/g, '**$1**').replace(/<([^>]*)>/g, '*$1*').replace(/\|/g, '\\|');
const title = (s) => s.name + (s.pre ? '（发球前）' : '') + (s.recast ? '（可再按）' : '');

const header = `# 角色技能说明（Web ${clientVersion} / 物理规则 ${YY.PHYSICS_VERSION}）

> 由 \`node tools/gen-skill-doc.js\` 生成。简短摘要、完整效果和分模式操作共用 \`js/roster.js\` 的玩家文案，研习页读取同一数据。每名角色1个被动、3个主动，赛前选2个主动携带。

## 先读这些操作规则

- **手动回球**：自己按高远、吊球或扣杀键并实际击中球。装置自动代接、发球、自垫是否触发奖励，按各技能说明执行。
- **准备下一拍**：先按技能键开启效果，再用普通击球键接球；技能不会替你挥拍。**收拍**是击球后恢复到可以再次挥拍的过程。完美回球通常指击球质量至少85%。
- **2D方向**：说明写“拖动技能键”时，按住该键拖到方向再松手；向前指朝球网，向后指远离球网。写“按住移动方向”时，用移动键选方向并点技能，不拖技能键。点按的默认行为按各技能说明执行。
- **3D方向**：推住摇杆选方向，再点技能键；不拖动技能键。向网推为前，远离网为后，左右为横向球道。部分技能的近深选择不同，逐项看3D操作，不能套用2D拖动方向。
- **深浅选择**：选择出球落点或对方目标区时，统一前推/前拖为深，后推/后拖为浅；左右选球道。移动、伸拍、投掷与己方装置位置仍按实际方向操作。
- **再按**：再次按同一个技能键，可能是切换、第二段、回收或提前结束；并非所有技能都能再按。第二段需满足各自条件，缺少条件时可能失败，或按新一次施放扣能量。
- **时间和次数**：已准备的持续效果及场上装置通常保留未用完的时间和次数，分间和发球准备暂停；已开始的移动、持球和本球飞行随当前分结束。每项详情的“分间保留”按其实现标示。押注在本分结算。
- **能量与费用**：两个主动技能共用0至100能量；金币、额外体力和持续耗能单独说明。额外体力基准值可能受角色、装备及疲劳倍率影响。技能关闭的比赛不触发技能效果。
- **真球与假球**：只有真球计分。镜像、回眸和脏数据是不同的假球机制，脏数据可骗掉一次挥拍。星门传送和网底滚动等有明确规则例外；普通球路仍按球网、边线和实际触球判定。
- **演示**：三阶段图用于解释机制，不按真实距离、速度与范围绘制；具体操作与数值以下方完整说明为准。

`;

const footer = `## 实现位置

| 部分 | 文件 |
|---|---|
| 技能数据（名称、消耗、描述、应对提示、音效） | \`js/roster.js\` |
| 2D/3D 研习脚本（操作、条件、代价、实战与演示） | \`js/skill-guide.js\`、\`js/ui-web.js\` |
| 技能引擎（施放条件、装置、受控球、规则改动、被动、跨回合保留） | \`js/match.js\`（\`Object.assign(Match.prototype, …)\` 一段，\`PERSIST\` / \`PERSIST_BUFF\`） |
| 物理环境（球网高度、局部重力、场上的风） | \`js/core.js\` \`stepShuttle\` / \`netContact\` 与 \`Match.physEnv()\` |
| 装置与特效绘制 | \`js/skillfx.js\`（地面 / 球网 / 空中 / 最上层 / 屏幕 / 特殊姿态） |
| AI 施放与应对 | \`js/ai.js\` \`thinkSkill\` / \`thinkPre\` / \`decideShot\` |
| 联机同步 | \`YY.skPack\` / \`YY.skUnpack\`（\`js/match.js\`），快照字段 \`k\` |
| 回归测试 | \`tools/skill-kit.test.js\`、\`tools/skill-rework.test.js\`、\`tools/story-skills.test.js\` |
`;

let body = '';
for (const c of YY.CHARS) {
  const pas = YY.SKILLS[c.passive];
  body += `\n## ${YY.charName(c.id)} · ${THEME[c.id] || c.title}\n\n`;
  if (pas) body += `![${pas.name}](assets/skills/${c.passive}.svg) **被动「${pas.name}」**：${md(pas.desc)}\n\n`;
  body += '| 主动技能 | 能量 | 效果 |\n|---|---|---|\n';
  for (const k of c.acts) { const s = YY.SKILLS[k]; body += `| ![${s.name}](assets/skills/${k}.svg) ${title(s)} | ${s.cost} | ${md(s.desc)} |\n`; }
  body += `\n默认携带：${YY.skillSet(c.id).act.map((k) => YY.SKILLS[k].name).join('、')}\n`;
  for(const id of [c.passive,...c.acts]){
    const s=YY.SKILLS[id],guide=YY.skillGuide(id,'2d'),spatial=YY.skillGuide(id,'3d');
    body+=`\n### ${s.name} · ${guide.category}\n\n${guide.summary}\n\n`;
    if(spatial.summary!==guide.summary)body+=`3D效果差异：${spatial.summary}\n\n`;
    body+=`- 2D 操作：${guide.operation}\n- 3D 操作：${spatial.operation}\n- 释放条件：${guide.condition}\n- 性能与代价：${guide.limits}\n- 演示分解：${guide.steps.join(' → ')}\n- 实战思路：${guide.tactic}\n`;
  }
}

const out = path.join(__dirname, '../SKILL_DESIGN.md');
fs.writeFileSync(out, header + body + '\n' + footer);
console.log('wrote', path.relative(process.cwd(), out));
