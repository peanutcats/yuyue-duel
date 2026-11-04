# 羽跃对决：微信好友对战服务器

比赛服务已部署至微信云托管 `express-gtlm`。小游戏 `1.0.3` 默认通过 `wx.cloud.connectContainer` 连接，无需手动配置 socket 合法域名；当前还需要补齐服务的 `ALLOWED_ORIGINS`，见 [微信云托管部署说明](WECHAT_CLOUDRUN.md)。单机和同屏不依赖服务器；`networkTransport: 'off'` 可隐藏在线入口。下文的 Docker Compose 与合法域名步骤适用于自行部署并显式使用公网 socket 的方案。

## 服务职责

- 两端上传移动、跳跃和挥拍输入；服务器以 120Hz 固定步长统一计算球路、碰撞和比分，30Hz 推送快照。
- 客户端只预测自己的移动/动作，不预测命中或得分。网络时延仍会影响击球，需选择玩家所在地区低延迟的节点。
- 支持 4 位房间码、分享进房、最多 20 秒的席位重连、后台暂停、双方确认再来一局。
- 在线对战使用统一基础能力，不启用角色技能或装备加成。
- 房间在内存中；服务器重启或替换容器会结束现有比赛。默认 20 个房间是资源保护上限，并非经过生产压测的容量承诺。
- 当前主线网页仍使用 PeerJS，和微信的 WSS 房间不互通。网页单机内容与微信共用源代码。
- 无需 AppSecret、用户手机号、头像昵称，也没有付费与广告接口。匿名房间码和随机重连令牌用于临时席位识别。需要持久账号/排行榜时另行接入微信登录服务。

## 本机验证

在仓库根目录运行：

```bash
npm ci
npm run preview:wechat
```

浏览器打开 `http://127.0.0.1:8766/?online=1`。两个窗口分别创建、加入房间即可测试；这只是浏览器 wx 适配器预览，不替代微信真机验收。

纯比赛服务启动：

```bash
npm start
```

默认监听 `127.0.0.1:8080`。`GET /healthz` 返回服务状态，WebSocket 路径为 `/ws`；服务不提供静态网页或项目源码。

## 公网部署：Docker Compose + Caddy

准备一台已安装 Docker Engine 与 Compose 的 Linux 服务器，以及可用于微信服务器域名配置的域名。域名 DNS 指向该服务器，开放 80/443 入站端口；按实际地区、接入商和微信后台要求完成备案与域名验证。

1. 把仓库放到服务器，例如 `/opt/yuyue`，进入仓库根目录。
2. 复制配置并把 `GAME_DOMAIN` 改成自己的真实域名，值不带协议和路径：

```bash
cp deploy/.env.example deploy/.env
```

3. 校验并启动：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml config
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

4. 查看服务状态和证书签发日志：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 caddy server
```

5. 打开 `https://你的域名/healthz`，应看到 `ok: true`。若证书签发失败，检查域名解析、端口与是否已有其他服务占用 80/443。

Caddy 自动处理 HTTPS/WSS 代理。服务器容器没有映射到公网端口，Caddy 覆盖 `X-Real-IP`，后端才启用 `TRUST_PROXY=1` 获取真实客户端 IP；不要在开放后端公网端口时沿用该信任设置。

后端允许无 Origin 的原生连接及配置的 `https://servicewechat.com`。如真机显示 Origin 校验失败，先核对实际请求来源，再精确加入 `ALLOWED_ORIGINS`（逗号分隔），不要直接开放任意来源。房间身份依靠随机席位令牌，不能把 Origin 当作用户认证。

## 接通微信端

1. 在微信小游戏后台配置 `socket` 合法域名，例如 `wss://badminton.example.com`。按照后台要求完成相关验证。
2. 修改 `minigame/config.js`：

```js
networkTransport: 'socket',
serverUrl: 'wss://badminton.example.com/ws',
```

3. 运行 `npm run build:wechat`，重新编译小游戏。保留开发者工具的合法域名检查，避免出现模拟器能连接而正式版失败的情况。
4. 用两台真机、不同微信体验成员测试：建房/分享/加入、完整对局、切后台/恢复、断网/重连、双方再来一局，以及一方退出后的房间回收。

无需把 `.env`、服务器源码或依赖复制到 `minigame/`。客户端通过 AppID 识别小游戏项目，AppSecret 不应进入代码包。

## 更新与限制

更新后重新执行 Compose 的 `up -d --build`。生产环境先确认没有进行中的比赛；当前实现不是无损滚动更新、多副本共享房间或跨地区匹配系统。

目前仅完成本机真实 WebSocket 和 SocketTask 适配器联调。实际公网服务器、TLS 证书、微信合法域名及手机网络延迟需要部署后再验收。本机没有运行 Docker 引擎时，只能检查 Compose 配置，不能声称镜像已启动验证。

参考：[Caddy WebSocket 反向代理](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[Docker Compose 环境变量](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)。
