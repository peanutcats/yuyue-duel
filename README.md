# 羽跃对决 · 网页版

支持 2D 横版与 3D 纵深的 1v1 羽毛球游戏。使用 HTML5 Canvas 与原生 JavaScript，适配电脑键盘和手机横屏，无需构建即可运行。当前网页资源版本为 `web-131-20261113`，联机物理规则 `28`。

## 2026-11-13 网页更新

- 同步最新 20 名角色、80 项技能、六座场馆，以及 2D / 3D 对战、空间 AI、动作和特效。
- 瑞宝升级地板出锅、肉包爆馅与回锅连招；朱老师加入长短布局、隐身与独立幻象；同步果哥八档器械、老陈地面冰区和其他角色技能修正。
- 更新角色立绘、站姿和场上动作，细化球拍、服饰、器材与技能反馈；技能说明统一为效果、操作和限制，补充 2D / 3D 研习数据。
- 15 首原创立体声配乐，每首约 33–87 秒，覆盖大厅、训练、六座球场、长回合、关键分、胜负、暂停与剧情日夜。加入主题、回应、间奏和再现段，支持平滑切换、暂停续播及击球时降低音乐音量。音频随网页静态资源交付。
- 更新在线匹配准备页：配对后可在 60 秒内调整角色、技能和器械，支持取消准备；比分与赛后记录补充玩家身份、比赛时间和对手信息。
- 保留《十六根羽毛》59 关、24 张知识卡及对白 / 小游戏续玩，保留入门发球机与真实过网检查修复。
- 同步可选云存档网页客户端。公开匹配与云存档需配置独立服务，静态发布默认关闭这两项服务；好友邀请码与同屏对战可独立使用。

## 运行

```sh
python3 tools/serve.py
```

访问 [http://localhost:8765](http://localhost:8765)。也可直接打开 `index.html` 玩单机；好友邀请链接需要 HTTP(S) 地址。静态文件可部署至 Vercel、GitHub Pages 或 Nginx。

已交付完整 MP3 音乐资源，运行网站不需要 FFmpeg 或 npm 依赖。JS 与 CSS 使用统一缓存标记，避免更新后混用旧代码。

## 模式与操作

- 快速对战：2D / 3D、四档 AI、自选或随机对手、技能开关与自由器械，支持 7 / 15 / 21 分制。
- 好友对战：PeerJS / WebRTC 邀请码房间，或同屏双人；沿用 Cloudflare TURN 中转配置。
- 故事模式：《十六根羽毛》，本机独立存档；角色和装备按剧情规则解锁。
- 自由练习：接球、高远、吊球、跳杀及战术训练，可使用全角色与技能。
- 挑战成就：各难度分别记录角色胜场，解锁并佩戴称号。

2D 单人：A / D 或左右键移动，W / 上键 / 空格起跳，J / K / L 击球，I / O 使用两个技能。

3D 单人：WASD 或方向键双轴移动，空格起跳，J / K / L 击球，I / O 使用技能。手机左侧固定摇杆控制走位与击球方向，右侧按键出手，松杆默认直线。

物理按 120Hz 固定步长计算；球拍、球网、边线与落点使用真实碰撞判定。7 / 15 / 21 分均需领先两分，分别在 11 / 21 / 30 分封顶。

## 在线配置

好友邀请码房间通过 `/api/turn` 申请临时 TURN 凭证。Vercel 环境变量为 `CF_TURN_KEY_ID` 与 `CF_TURN_API_TOKEN`，凭据不写入网页源码。未配置时退回直接连接。

`js/online-config.js` 默认配置：

```js
window.YY.MATCH_CONFIG = {
  serverUrl: '',
  enabled: false,
  accountEnabled: false,
  accountApiUrl: ''
};
```

配置兼容物理规则 `28`、房间协议 `2` 的公开 `wss://` 比赛服务并允许本站 Origin 后，可启用 `enabled` 并填写 `serverUrl`。同源反向代理 `/ws` 时可留空地址。

云存档需要支持 `/api/account/*` 的账号服务。配置其 HTTPS Origin 为 `accountApiUrl`，然后启用 `accountEnabled`；微信小游戏确认关联码后即可关联。纯静态网站默认使用本机存档。原有好友邀请码房间独立运行。

## 维护与验证

使用 Node.js 22 或更新版本：

```sh
node --test --test-concurrency=2 tools/*.test.js
node tools/build-story-v3.js
node tools/export-story-art.js
node tools/export-character-art.js
```

配乐再制作和实际解码检查需要 FFmpeg / ffprobe，详见 [音乐升级说明](MUSIC_UPGRADE.md)：

```sh
node tools/build-score.js
node tools/score-audit.js
```

- `index.html`、`css/`：网页菜单、手机控制与布局。
- `js/`：玩法、物理、角色、AI、声音、故事与网页联机 / 账号客户端。
- `assets/audio/score/`：15 首完整背景配乐；`assets/story/sixteen/` 保存故事场景、CG 和章节主题。
- `tools/web-release.browser.js`：在本机静态预览上验证音乐、2D / 3D 对战、训练、技能说明与手机布局，供 Playwright CLI `run-code --filename` 使用。
- `assets/characters/index.html`、`assets/skills/index.html`：角色立绘册和技能图鉴。
- [技能设计](SKILL_DESIGN.md)、[第三版剧本](STORY_SCRIPT_V3.md)：当前技能和故事内容。

`main` 保持独立网页版结构。微信小游戏工程与权威比赛服务分别维护和部署。
