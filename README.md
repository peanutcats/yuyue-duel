# 羽跃对决

侧视 1v1 网页羽毛球游戏，使用 HTML5 Canvas 与原生 JavaScript，适配电脑键盘与手机触屏，无需打包构建。

`main` 保存网页发布版本。在线对战使用 PeerJS / WebRTC 与 Cloudflare TURN；微信小游戏工程在 `wechat-minigame` 分支，服务器权威版本在 `codex/server-authority` 分支。

## 2026-11-08 网页更新

- 同步当前角色、技能、器材属性和造型，以及动作、特效、物理和 AI 更新。
- 剧情《星光回响》扩展至 12 章、60 关，包含调查、战术板、飞行实验、专项训练和 603 条配音；提供故事 / 挑战难度、断点续玩和球馆手记。
- 路先森使用复制体、接力协议、脏数据；旧技能组合会回落到当前默认组合。
- 第一关只从发球机口发出中场缓球，留出移动和挥拍时间。练习发球在出球前检查真实过网碰撞和落点，必要时调整弧线；无有效轨迹时重试，不计尝试次数。
- 统一 JS / CSS 缓存版本为 `v24`，避免浏览器混用旧资源。

## 运行与验证

```sh
python3 tools/serve.py
```

访问 http://localhost:8765。该开发服务器禁用缓存，并提供本地 `/api/turn` 接口。部署时可使用 Vercel 或其他静态托管服务；好友在线对战的邀请链接需要 HTTP(S) 地址。

使用 Node.js 22 或更新版本运行网页回归测试，无需安装 npm 依赖：

```sh
node --test tools/*.test.js
STORY_SIM_ONLY=0-1 node tools/story_sim.js
```

测试覆盖物理碰撞、发球、练习发球机、装备特性、技能、联机快照和 TURN 接口。`tools/story_sim.js`、`tools/practice_sim.js` 可模拟训练与剧情流程。

修改脚本或样式后，请同时递增 `index.html` 中的资源版本号。

## 玩法

- 故事模式：完成剧情、训练与比赛，解锁角色、装备和知识卡；进度保存在浏览器本地。
- 快速对战：使用所选角色和器材挑战 AI。
- 好友对战：在线房间或同屏双人。
- 自由练习：练习接球、高远、吊球、网前、跳杀及三拍战术，参考落点、站位与时机提示。

键盘移动使用 A / D 或左右方向键，W / 上方向键 / 空格起跳；J / Z 高远、K / X 吊球、L / C 扣杀。具体技能键位、同屏双人键位与触屏操作见游戏内“操作”。

## 在线对战配置

Vercel 部署使用 `api/turn.js` 申请临时 TURN 凭证。将以下环境变量配置在服务器端：

- `CF_TURN_KEY_ID`
- `CF_TURN_API_TOKEN`

浏览器只接收临时凭证。未配置时 `/api/turn` 返回 503，游戏回退到直接连接。环境变量不应写入前端源码或提交到仓库。

本地开发可给 `python3 tools/serve.py` 设置同名环境变量。联机组件按需从 CDN 加载；调试时两个标签页都加 `?loopback=1`，可通过 BroadcastChannel 检查联机流程。

## 主要文件

| 路径 | 用途 |
| --- | --- |
| `index.html`、`css/` | 菜单、帮助、触屏布局与页面样式 |
| `js/core.js`、`js/match.js` | 羽毛球物理、比赛、技能与计分 |
| `js/roster.js`、`js/ai.js` | 角色、器材、技能配置与 AI |
| `js/practice.js` | 发球机、专项练习和教学提示 |
| `js/campaign.js`、`js/story*.js`、`js/knowledge.js` | 剧情、教学活动、配音与图鉴 |
| `js/char.js`、`js/render.js`、`js/skillfx.js` | 角色动作、球场与技能特效 |
| `js/gear-looks.js`、`js/market-art.js`、`js/emote.js` | 器材造型、果哥装备与表情 |
| `js/gameplay.js`、`js/main.js`、`js/input.js` | 模式流程、主循环和输入 |
| `js/net.js`、`api/turn.js` | WebRTC 联机、快照和 TURN 接口 |
| `assets/skills/`、`assets/story/` | 技能图标、剧情素材、配音与来源记录 |

物理按 120Hz 固定步长运行。配音以本地 MP3 播放，可在对白页面关闭或重听；素材来源见 `assets/story/README.md`。
