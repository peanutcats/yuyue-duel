# 羽跃对决：微信云托管部署

客户端 `1.0.3` 默认使用 `wx.cloud.connectContainer` 连接现有云托管服务，无需在微信后台手动添加 socket 合法域名。后端继续使用已部署的比赛服务，无需因为客户端切换而重新上传服务代码。

## 当前环境

| 项目 | 值 |
| --- | --- |
| 小游戏 | 羽跃对决 |
| AppID | `wx4c24e883bac82367` |
| 云环境 | `prod-d9g91zv98490ac83f` |
| 现有服务 | `express-gtlm` |
| HTTPS 地址 | `https://express-gtlm-341234-6-1525027827.sh.run.tcloudbase.com` |
| WebSocket 地址 | `wss://express-gtlm-341234-6-1525027827.sh.run.tcloudbase.com/ws` |

2026-11-04 更新：用户已完成比赛服务部署；健康检查、直接 WSS 建房/加入、双端快照与心跳通过。官方开发者工具小游戏模式（基础库 3.17.6）确认云接口可用；首次云 SDK 握手因服务端允许来源不包含 SDK 的实际来源而失败，需要按下文补齐 `ALLOWED_ORIGINS`。本次未修改云端环境变量，不能视为云 SDK 端到端验收完成。

## 1. 上传比赛服务

在原开发项目 `go_badminton` 根目录执行 `npm run build:cloudrun`，生成 `output/yuyue-cloudrun.zip`。包内根目录直接包含 `Dockerfile`、Node 依赖清单、比赛服务、三份共享物理模块和本文档，不包含小游戏客户端、`.env`、数据库密码、AppSecret 或本机配置。

在微信云托管控制台进入上述环境 → 服务列表 → **express-gtlm** → 新建版本/部署，选择本地代码上传。上传 ZIP；若当前界面只接受目录，先解压 ZIP，选择直接含有 `Dockerfile` 的那一层。不要再新建一个 Express 模板服务。

| 配置项 | 填写内容 |
| --- | --- |
| 构建目录/上下文 | 上传包根目录 `.`（界面以空表示根目录时留空） |
| Dockerfile 路径 | `Dockerfile` |
| 容器端口 | **8080**，不要沿用模板的 80 |
| 启动命令 | 使用 Dockerfile 默认命令；删除自定义的旧模板启动命令 |
| HTTP 健康检查（如界面提供） | `GET /healthz`，端口 8080 |
| 公网访问 | 终端诊断使用；云 SDK 客户端不依赖此公开地址。待云通道真机验收后，可按需要在控制台关闭公网访问 |

环境变量逐项填写（同时核对旧版本是否遗留了不同的 `PORT` / `HOST`）：

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
MAX_ROOMS=10
TRUST_PROXY=0
ALLOWED_ORIGINS=https://servicewechat.com,https://express-gtlm-prod-d9g91zv98490ac83f-1525027827.ap-shanghai.run.wxcloudrun.com
```

`deployment-info.json` 是便于核对的参数清单，**控制台不会自动应用它**。尤其是端口、环境变量、实例数和版本流量，需要在界面核对。不要依赖模板的 `container.config.json` 修改现有服务设置：官方说明该文件仅用于首次模板部署。

本服务不用 MySQL，无需填写任何数据库账号密码，不调用 `/api/count`，无需运行 SQL。模板自动开通的数据库是独立资源，本次没有修改或删除；如保留，查看控制台对应费用。

## 2. 固定单实例、单版本流量

房间和比赛状态暂存在进程内存，**将最小实例数和最大实例数都设为 1**，或者在固定实例模式下设置为 1。CPU/内存先保留当前规格做体验测试，`MAX_ROOMS=10` 只是限制资源消耗，不是经过生产压测的容量承诺。

发布成功后，把 **100% 流量切换到新比赛服务版本**，旧模板版本设为 0%。不要同时把玩家分发给多个实例/版本；HTTP 会话保持也不能保证两位不同玩家进入同一个房间。

常驻 1 个实例会持续占用计算资源，并可能产生费用；查看当前账号的试用额度和用量，不能把“个人免费体验版”理解为后台永久免费。本次脚本不会自动调整实例、购买套餐或开通额外资源。

服务日志正常启动应出现 `Badminton authoritative server listening on 0.0.0.0:8080`。更新容器或切换版本会中断已有对局；后续更新应避开正在比赛的时段，发布后重新建房。

本服务已有应用心跳、WebSocket ping 和断线重连，符合云网关需要定期数据保持连接的使用方式。当前保留不信任转发 IP 的设置；经云代理到达的连接可能共享 IP 限额，适合这一阶段的小范围体验。扩容前需同时实现跨实例房间分配、可信代理 IP 处理与压测。

## 3. 云通道接入：不需要手动配置域名

当前代码使用以下环境与服务参数，通过 SDK 获取连接；不直接拼接或请求 SDK 内部域名：

```js
networkTransport: 'cloud',
cloud: {
  env: 'prod-d9g91zv98490ac83f',
  service: 'express-gtlm',
  path: '/ws',
},
```

首次建房/加入时懒初始化 `wx.cloud.init({env, traceUser:false})`，然后调用 `wx.cloud.connectContainer({config:{env}, service, path})`，使用返回的 `socketTask` 收发比赛消息。若当前微信不支持该接口，提示更新微信，不自动退回需要配置域名的公网连接。单机不初始化云服务。

微信后台提示“使用微信云托管无需配置域名”指的是这种云 SDK 访问方式。此前 `1.0.2` 使用 `wx.connectSocket` 直接请求公网 WSS，所以才需要 socket 合法域名；两种方式的配置要求不同。`callContainer` 是 HTTP 请求，不能直接代替实时比赛的 WebSocket。

### 现有部署需要补齐的一项环境变量

将当前运行版本的 `ALLOWED_ORIGINS` 值完整改为下面这一行（不加引号、空格或末尾斜杠），保存并重新部署使其生效：

```text
https://servicewechat.com,https://express-gtlm-prod-d9g91zv98490ac83f-1525027827.ap-shanghai.run.wxcloudrun.com
```

后一个地址来自官方小游戏运行时实际 `connectContainer` 请求的 Origin。当前服务器是精确来源校验，原先只允许 `https://servicewechat.com`，因此 SDK 的来源被拒绝并返回 403。不要改成允许任意来源；无需修改服务器代码。

这里修改的是**云托管服务的环境变量**，不是微信后台“服务器域名”页面。微信后台可以保持未配置状态。云 SDK 可能向后端附带微信身份信息，本项目不读取或保存这些身份头；平台接入日志与网络处理按实际云服务设置执行。

### 只有主动使用公网直连时，才需要 socket 域名

如另行切换 `networkTransport: 'socket'`，才按微信规则配置 `serverUrl` 对应的 socket 合法域名（后台不带路径，代码带 `/ws`）。公开的 CloudBase 默认域名只用于开发测试，公网生产接入按官方要求绑定自定义域名。这项限制不要套用到当前云 SDK 访问方式。浏览器本机预览的 `?online=1` 会明确切到本地 socket 模式。

## 4. 部署后检查

在原项目根目录运行：

```bash
npm run check:cloudrun -- --cloud-origin
```

该脚本通过公网端点模拟 SDK 的 Origin，排查后端配置，不代替微信身份通道测试。脚本先检查 `/healthz`，确认返回真正的比赛服务，再建立两个 WebSocket 连接，测试建房、加入同一房间、对局开始、双端快照和心跳。它只创建自己的临时房间，结束时退出回收，不会访问模板数据库或加入他人的房间。健康检查应返回：

```json
{"ok":true,"mode":"authoritative","rooms":0,"physicsHz":120,"snapshotHz":30}
```

其中 `rooms` 随当前房间数量变化，不要求等于 0。浏览器打开默认域名可能出现提示页或下载 JSON，应以检查脚本的结果为准。

绑定自定义域名后可指定新的地址（不带 `/ws`）：

```bash
npm run check:cloudrun -- https://你的实际域名
```

检查通过后执行 `npm run build:wechat`，微信开发者工具重新编译并预览。首页版本号应为 `1.0.3`；用两位体验成员的手机分别建房、分享/输入房间码加入，测试完整对局、前后台恢复、断网重连、再来一局和退出。终端检查不能替代微信云 SDK 的实际连接和真机延迟验收。

本地新增回归覆盖云初始化/异步建连、取消、超时、旧回调隔离、重连和双端协议一致性。模拟 SDK 适配器测试不能替代官方运行时验收；当前官方运行时已确认 API 可用，但完整云通道对战仍待环境变量生效后复测。

云端配置未生效时，在线连接仍可能失败，单机不受影响。如暂不展示在线入口，将 `minigame/config.js` 中 `networkTransport` 改为 `off` 并重新编译。

## 常见问题

| 现象 | 排查方向 |
| --- | --- |
| `/healthz` 返回 404 | 上传的仍是模板，或新版本未接收 100% 流量 |
| 502、健康检查失败 | 容器端口与 `PORT` 是否都为 8080，`HOST` 是否为 `0.0.0.0`，构建日志是否成功安装依赖 |
| WSS 返回 404 | URL 是否带 `/ws`，是否误连旧版本或其他服务 |
| 云 SDK 握手失败 / WSS 返回 403 | 核对实际 Origin 是否包含在运行版本的 `ALLOWED_ORIGINS` 中、云环境是否关联此 AppID；同时检查云网关访问权限 |
| 终端检查成功，微信失败 | 核对是否已编译到 1.0.3、云 SDK 是否支持、环境/服务访问权限及真机网络；云模式无需手填 socket 域名 |
| 偶发“房间不存在” | 多实例/多版本分流，或发布/重启清空了内存房间 |
| WSS 返回 503 / 房间已满 | 达到连接/房间保护上限，先检查滞留连接和服务指标 |

## 官方参考

- [云托管 WebSocket 接入与心跳](https://docs.cloudbase.net/run/develop/access/websocket)
- [默认域名的开发测试用途与限制](https://docs.cloudbase.net/service/alias)
- [模板配置仅用于首次部署的说明](https://github.com/WeixinCloud/wxcloudrun-express/blob/main/container.config.json)
- [云托管 HTTP / WebSocket 常见问题](https://docs.cloudbase.net/run/faq/gw)
