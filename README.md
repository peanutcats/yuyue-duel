# 羽跃对决 · 网页版

支持 2D 横版与 3D 纵深的 1v1 羽毛球游戏。使用 HTML5 Canvas 与原生 JavaScript，适配电脑键盘、手机竖屏浏览与横屏对战，无需构建即可运行。当前网页资源版本为 `web-1331-20261116`，联机物理规则 `36`。

## 2026-11-16 网页 1.33.1 平衡更新

田楚的折影需要实际跑位，触发频率、加速和回复适度降低；虚拍藏真缩小接引范围、增加准备时间，保留收拍，并移除补拍额外加速、回体和叠加被动收益。详见 [田楚平衡调整](TIANCHU_BALANCE.md)。

## 2026-11-16 网页 1.33 更新

小红围绕校准与几何连携加强：稳定回球积校准、三个主动均可强化，自抛可提前准备，反射板与辅助线提升容错和回合收益。2D / 3D 共享机制、技能演示与说明同步更新，详见 [小红技能优化](XIAOHONG_UPGRADE.md)。

## 2026-11-15 网页 1.32 更新

- 参照微信小游戏重做球馆主页：深蓝与暖金、角色立绘、故事主入口、四个玩法入口及本机存档入口。
- 自由对战大厅分为快速对战、训练场、专项课程；快速对战先选角色、对手、技能、规则、场馆和难度，再确认开赛。
- 角色页支持定位筛选、立绘预览和明确出战确认。器械库独立展示球拍、球线、球鞋与磅数，提供属性比较，按角色保存搭配。
- 新增技能研习页：2D / 3D 独立说明、三阶段演示、暂停、重播、慢放及临时技能试用。试用退出回到研习页，不覆盖已保存搭配。
- 训练场可选择角色、空间模式、来球类型、落点、弧线、球速和喂球间隔，并切换无限能量、无限体力等辅助。
- 统一设置、故事、联机、图鉴和比赛浮层的页面样式；支持手机竖屏浏览、紧凑横屏、键盘焦点与减少动态效果。
- 同步最新 21 位角色、84 项技能和透明绘制立绘，包括逐晨、磐岩、静川、腾岳、云衡的新名称，腾岳 / 田楚 / 冉冉的机制升级及前深后浅操作规则。
- 保留 59 关故事、24 张知识卡和 15 首完整配乐；Web 资源使用独立静态路径和统一缓存版本。
- 公开匹配与云存档沿用可选服务配置。未配置时保持关闭，主页显示本机存档；好友邀请码与同屏对战继续可用。

详细页面行为与验收记录见 [Web 1.32 升级说明](WEB_UI_UPGRADE.md)。

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
- 训练场：全角色试用、2D / 3D、自选发球机参数及技能练习；专项课程提供接球、高远、吊球、跳杀及战术训练。
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

配置兼容物理规则 `36`、房间协议 `2` 的公开 `wss://` 比赛服务并允许本站 Origin 后，可启用 `enabled` 并填写 `serverUrl`。同源反向代理 `/ws` 时可留空地址。

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
- `tools/web-ui-upgrade.browser.js`：角色与器械确认、选择取消、搭配持久化、技能试用、训练配置和四种视口验收。
- `tools/web-release.browser.js`：在本机静态预览上验证音乐、2D / 3D 对战、训练、技能说明与手机布局，供 Playwright CLI `run-code --filename` 使用。
- `assets/characters/index.html`、`assets/skills/index.html`：角色立绘册和技能图鉴。
- [技能设计](SKILL_DESIGN.md)、[第三版剧本](STORY_SCRIPT_V3.md)：当前技能和故事内容。

`main` 保持独立网页版结构。微信小游戏工程与权威比赛服务分别维护和部署。
