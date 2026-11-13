# 微信账号与云存档

玩家的故事进度、星级、角色与装备解锁、图鉴、剧情选择和断点、AI 挑战战绩及称号、个人历史战绩与角色胜率、每个角色的配装与技能、设置和自定义键位统一保存到服务器。服务器以微信校验后的 OpenID 关联账号，对外分配 `YY…` 玩家 ID。

## 玩家操作

- 首次点击主页或设置中的「个人资料与战绩」进入资料页，再点击「微信登录」建立账号；已登录玩家下次启动自动恢复。通过云托管 `callContainer` 加载同一微信账号的进度。登录后入口显示头像与昵称，资料页保留「修改昵称」和「使用微信资料」。
- 首次升级会将设备上的旧存档迁移到当前微信账号。若云端已经有另一份存档，展示两份的通关和星级，明确选择保留本机或云端。不会用默认空档覆盖已有云档。
- 本地数据继续作为离线缓存。修改后等待 800 毫秒合并上传；服务器确认后清除待上传状态，界面不额外展示同步说明。后台切换会尝试同步，恢复前台会重新校验微信登录态并同步。暂时断网可继续单机，缓存未确认的数据会在下次联网时上传。
- 多设备用版本号检测冲突，停止自动覆盖；恢复或覆盖前保存旧版本。服务端保留最近 8 份云端旧档，客户端另保留最近一次冲突选择前的本地分支。
- 微信换账号时，分别保留各自的缓存，上一账号的离线进度不会自动上传给新账号。正在进行的故事或对战不会被后台加载的云档打断，回到主页后再载入；期间产生的不同进度会进入冲突选择。
- 「使用微信资料」使用小游戏原生授权按钮。未授权仍可使用默认昵称和玩家 ID；「修改昵称」通过原生输入弹窗填写 1–24 个字符并保存到当前账号。玩家自定义昵称后，微信资料刷新仅更新头像，不覆盖自定义昵称。
- 服务端保留浏览器关联与历史版本接口；小游戏的简洁资料页不展示浏览器关联、手动同步和历史版本入口。
- 好友房间、匹配确认和 2D / 3D 比分牌展示公开昵称、头像和玩家 ID。头像加载失败时显示角色头像；微信 OpenID、session_key、业务 token 和房间重连凭证不会出现在对手资料中。

## 正式环境配置

代码、微信工程和上传 ZIP 已包含账号模块。真正启用前，云托管服务需要配置以下**服务端**环境变量：

| 变量 | 内容 |
|---|---|
| `WX_APP_ID` | `wx4c24e883bac82367` |
| `WX_APP_SECRET` | 微信小游戏后台获取的 AppSecret，仅在云托管私密环境变量中配置 |
| `DB_HOST` | 持久 MySQL 的内网地址 |
| `DB_PORT` | 通常 `3306` |
| `DB_USER` | 业务数据库账号 |
| `DB_PASSWORD` | 数据库密码 |
| `DB_NAME` | 已创建的业务数据库名 |
| `DB_SSL` | 连接要求 TLS 时设为 `1`，使用可信 CA 校验 |

数据库账号需要初次建表以及业务表的读写权限；服务首次访问自动创建 `yy_accounts`、`yy_sessions` 和索引。云托管与数据库配置同一私有网络。正式云托管使用 MySQL，不使用容器临时文件系统保存档案。云托管仍保持 1 个比赛实例；比赛房间、队列和短期浏览器关联码由该进程维护。

没有数据库配置时，账号接口明确返回 `503 NOT_CONFIGURED`，客户端保留进度并显示离线状态，不伪装成同步成功。设置数据库后联机服务器要求有效微信业务会话，旧客户端需要同步更新。`/healthz` 的 `accounts.enabled / required` 和 `account-v1`、`cloud-save-v1` 能力标识用于确认服务版本。

本机或自建服务器可设置 `ACCOUNT_DB_FILE=/持久卷/yuyue/accounts.sqlite` 使用 SQLite WAL；生产环境必须挂载持久卷并另行备份。SQLite 内存模式仅用于测试。不要把私密数据库文件、密码或 AppSecret 放入客户端、仓库或上传 ZIP。

微信后台需声明微信登录标识、昵称、头像及游戏进度的使用目的并配置隐私保护指引；真机验收首次点击登录、后续自动登录、昵称修改、授权同意/拒绝、头像加载、换设备与断网同步。昵称头像依照小游戏 API 授权获取，`wx.login` 本身只提供临时登录凭证。实现使用腾讯维护的[小游戏 API 定义与授权示例](https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts)及[签名校验规则](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/signature.html)。

如果网页与云托管不同域，在 `js/online-config.js` 设置 `accountApiUrl` 为账号服务的 HTTPS 根地址，并将网页的精确 Origin 添加到服务端 `ALLOWED_ORIGINS`。同域反向代理时把 `/api/account/*` 与 `/ws` 一起代理给比赛服务器。头像来自微信 `qlogo.cn / qpic.cn` HTTPS 域名，发布前检查目标平台允许加载头像资源。

云托管接入与持久数据库配置参考腾讯的[callContainer 文档](https://docs.cloudbase.net/run/develop/access/mini)和[MySQL 集成说明](https://docs.cloudbase.net/run/develop/resource-integration/mysql)。

## 接口与数据保护

| 接口 | 用途 |
|---|---|
| `POST /api/account/login` | `code` 由服务端向微信 `code2Session` 换取身份，返回随机业务 token、公开资料和云档 |
| `GET /api/account/save` | 读取自己的当前版本 |
| `PUT /api/account/save` | `baseRevision + save` 乐观锁提交；过期版本返回 `409 SAVE_CONFLICT` 和自己的最新档 |
| `POST /api/account/userinfo` | 校验 `SHA1(rawData + session_key)` 后保存头像及未自定义的昵称 |
| `POST /api/account/profile` | 当前登录账号修改昵称；清除控制字符并限制为 1–24 个 Unicode 字符 |
| `GET /api/account/history` | 读取自己的最近 8 个历史版本 |
| `POST /api/account/logout` | 撤销当前业务会话 |
| `POST /api/account/link` | 创建短期浏览器关联码与轮询私密凭证 |
| `POST /api/account/link/confirm` | 微信已登录账号确认关联码 |
| `POST /api/account/link/poll` | 必须同时提供码和私密轮询凭证，取得确认后的独立会话 |

除登录与关联码创建/轮询外，接口均需 `Authorization: Bearer …`。数据库只保存业务 token 的 SHA256 摘要，7 天过期。微信 session_key 仅留服务端会话用于资料签名校验。所有存档按登录身份查询，不接受客户端 OpenID 或玩家 ID 指定写入对象。请求限频、128 KiB 请求上限、96 KiB 规范存档上限及字段清洗限制异常输入。数据库事务同时更新存档、版本和历史，重试相同内容不会重复生成版本。

WebSocket 通过首帧携带业务 token 校验身份；公开资料从数据库取，不信任客户端自报头像或 ID。重连还需原账号与原房间凭证。相同账号无法在同一房间充当双方，也不会互相匹配。游戏进度仍允许客户端提交，以支持离线故事；这不是对离线成绩的防作弊系统。

## 微信登录连接诊断

初版提示「微信登录暂不可用，请稍后重试」出现在服务器调用 `https://api.weixin.qq.com/sns/jscode2session` 时，包括连接失败、非成功 HTTP 响应或非 JSON 响应；此步骤在读取玩家 MySQL 存档之前。它不能说明 MySQL 已连接成功，也不能据此判断 AppSecret 正确或错误。

诊断版仅需更新云托管服务；现有客户端可以直接显示返回消息中的诊断码。失败时，运行日志会输出 `[wechat-login]`，包含关联请求 ID、失败阶段、耗时、Node 版本和已筛选的错误码，不输出密钥、登录 code、OpenID、完整请求 URL、原始异常堆栈或微信原始响应。

| 诊断码 | 含义与排查方向 |
|---|---|
| `WX_DNS` | 域名解析失败：查看日志中的 `ENOTFOUND / EAI_AGAIN`，检查服务器 DNS 与出站网络 |
| `WX_TLS` | HTTPS 握手/证书失败：根据证书错误码检查容器时间、可信 CA 和网络链路；保留证书校验 |
| `WX_NETWORK` | 连接被拒绝、重置或网络不可达：检查服务的公网出口、网络策略、路由及代理 |
| `WX_TIMEOUT` | 连接或响应超时：检查出站连接与微信服务可达性 |
| `WX_RUNTIME` | 运行环境缺少 fetch/AbortSignal 等能力：使用上传包 Dockerfile 中的 Node 24 |
| `WX_HTTP_数字` | 微信接口或中间网络设备返回非成功 HTTP 状态：按日志的 HTTP 状态排查 |
| `WX_RESPONSE` | 微信接口返回非 JSON 或缺少必要身份字段 |
| `WX_CONFIG` | 微信明确拒绝 AppID/AppSecret：日志含微信数字错误码，核对当前线上版本变量 |
| `WX_CODE` | 微信拒绝登录凭证：日志含数字错误码，重新调用 wx.login，不复用 code |
| `WX_BUSY / WX_RATE_LIMIT` | 微信服务繁忙或调用限频，稍后重试 |

控制台的「公网访问」（从外部访问服务）和「公网出口」（服务向微信 API 发起 HTTPS 请求）含义不同。诊断时应核对后者；公网出口已启用时，继续看具体 DNS/TLS/HTTP 错误，不反复切换网络配置。

### 已确认的 WX_TLS：开放接口服务证书

2026-11-11 线上日志在 Node v24.22.2 中报 `DEPTH_ZERO_SELF_SIGNED_CERT`，耗时 6–43 毫秒。控制台已开启「开放接口服务」。该通道会在每个容器内注入 `api.weixin.qq.com` 的自签名证书，Node 需要额外信任平台证书。

按[微信官方开放接口服务文档「证书与 HTTPS」](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/weixin/open.html#1-证书与-https)，Alpine 镜像应安装 `ca-certificates`，Node 配置：

```text
NODE_EXTRA_CA_CERTS=/app/cert/certificate.crt
```

Dockerfile 已固化这两项。使用更新包重新构建并发布后生效，无需修改 MySQL 变量或重新上传小游戏客户端。如果仅先在控制台添加上述环境变量，需要发布/重启实例才会生效；已有运行中的 Node 不会动态重读证书变量。平台证书由云托管在运行时注入，不应将本机证书复制进上传包。

保留 HTTPS、证书有效性与主机名校验。此修复仅追加信任平台指定证书，不设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`，也不把登录接口降级为 HTTP。

本次本机真实 TLS 验证通过：未信任的自签名证书被拒绝；以 `NODE_EXTRA_CA_CERTS` 追加指定测试证书后 HTTPS 成功；主机名不匹配仍被拒绝。登录诊断、账号 HTTP / WebSocket 和云托管打包专项通过。实际微信云托管需发布更新后确认登录结果。

## 验证

执行 `npm test`，账号专项为 `tools/cloud-account.test.js`、`tools/cloud-account-network.test.js`、`tools/cloud-account-native.test.js` 和 `tools/player-upgrade.test.js`。覆盖身份隔离、资料签名、重复提交、并发冲突、历史版本、离线续传、换账号、延期载入、战绩保存及浏览器关联。

本机浏览器的虚构微信身份只用于接口和页面验收。正式微信登录、真实 MySQL、云环境及手机操作需要实际配置后分别验证；包体以当前构建结果为准。
