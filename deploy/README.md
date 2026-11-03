# 服务器权威模式部署

已部署地址：`10.0.17.220`。通过 `http://10.0.17.220:8080` 提供内网网页与同源 WebSocket。地址属于私有网段，只能由可路由到该地址的设备访问。公网 HTTPS 前端不能直接连接内网明文 WebSocket；公网使用需要可达域名、HTTPS/WSS 和匹配的 Origin 配置。

## 前置条件

- 受支持的 Linux 系统、systemd、Node.js 22 或更新的 LTS、npm、curl。
- SSH 管理入口可用。安装过程不改变 SSH、不关闭现有服务、不重装系统。
- 选定业务端口（默认 TCP 8080）空闲，且允许目标用户网络访问。

2026-11-03 已完成部署并通过内网访问和双浏览器联机验收：创建 / 加入房间、操作上传、双方比分一致、手机布局和断线重连均正常。运行环境为 openEuler 24.03 LTS-SP3、Node.js 24.22.2，服务以专用 `yuyue` 账号运行，已启用开机自启；firewalld 的 TCP 8080 规则已持久化，SELinux 保持 Enforcing。

当前代码版本目录：`/opt/yuyue/releases/20261103T101432Z`；入口软链接：`/opt/yuyue/current`；配置：`/etc/yuyue.env`；systemd 服务：`yuyue.service`。账号密码不保存在项目中。

`bootstrap-node.sh` 是为该 x86_64 目标准备的首次安装脚本：从 Node.js 官方源下载 Node 24.22.2 LTS，按固定 SHA-256 校验，安装游戏服务并放行 TCP 8080。可在网络恢复后从解压目录后台运行，日志为 `/var/log/yuyue-install.log`，退出码记录为 `/var/log/yuyue-install.exit`。已有 Node 运行时不会被覆盖。

## 安装

从项目根目录打包（不包含凭证、git、node_modules）：

```bash
tar --no-xattrs -czf /tmp/yuyue-release.tar.gz index.html js css server deploy package.json package-lock.json
scp /tmp/yuyue-release.tar.gz root@10.0.17.220:/tmp/
```

服务器上解压到临时目录，执行安装脚本：

```bash
mkdir -p /tmp/yuyue-install
tar -xzf /tmp/yuyue-release.tar.gz -C /tmp/yuyue-install
bash /tmp/yuyue-install/deploy/install.sh
```

脚本建立专用 `yuyue` 系统账号、按时间戳保存版本到 `/opt/yuyue/releases/`，将 `/opt/yuyue/current` 指向当前版本，注册并启用 `yuyue.service`。进程以普通账号运行。健康检查失败会恢复上一个版本链接；首次安装失败会停止服务。软件环境与防火墙应在检查目标系统后配置，脚本不会自行开放端口。

配置文件 `/etc/yuyue.env`：

```ini
HOST=0.0.0.0
PORT=8080
MAX_ROOMS=20
```

若 Node 安装在 root 私有目录（例如 `/root/.nvm`），需先将受支持的运行时安装到系统公共路径。systemd 的 `ProtectHome=true` 会阻止应用读取 root 目录。

## 验收和维护

```bash
systemctl status yuyue --no-pager
curl -f http://127.0.0.1:8080/healthz
journalctl -u yuyue -n 100 --no-pager
```

在两台可访问服务器的设备打开网页，用同一个房间码加入。验证发球、移动、得分、离开 / 返回画面和临时掉线重连。监控 CPU、内存、发送积压与 `simulation scheduler delayed` 日志，再确定房间上限。重启服务会结束内存中的所有比赛。

回滚：将 `/opt/yuyue/current` 指向安装脚本输出的 `Previous` 版本，再执行 `systemctl restart yuyue`。配置或运行时版本的变化需单独回退。

可选 HTTPS 配置见 `nginx.conf.example`；需要先替换域名、证书路径，再通过 `nginx -t` 验证后启用，不能覆盖已有站点配置。若使用反向代理，应把服务监听地址改成 `127.0.0.1`。

## 客户端独立托管

在 `js/server-net.js` 加载前设置 `window.YUYUE_SERVER_URL = 'wss://你的比赛域名/ws'`，服务端 `ALLOWED_ORIGINS` 设置为网页的准确 origin（例如 `https://game.example.com`，多个用英文逗号分隔）。默认未配置时只接受同源浏览器连接。

重连凭证只保存在当前页面内存；当前支持网络闪断重连，不支持刷新页面后的席位恢复。服务器没有账号和持久战绩数据库。

## 网页能打开，但 Safari 创建房间失败

2026-11-03 排查确认：本机系统 HTTP 代理 `127.0.0.1:10808` 会移除 WebSocket 的 `Upgrade` 请求头，并把 `Connection` 改为 `close`。服务器因此将 `/ws` 当作普通网页请求，返回 404；页面文件仍可正常加载。Safari 和 WebKit 遵循系统代理，所以仅用 Chromium 验收未发现这一问题。

本机已在当前 Ethernet 服务的代理例外列表中加入 **仅 `10.0.17.220`**，保留原有 `localhost`、`127.0.0.0/8`、`::1` 以及其他代理配置。刷新 Safari 后创建房间成功。若更换网络服务或代理应用重写了例外列表，需在该网络服务的“代理 → 忽略这些主机与域的代理设置”中保留游戏服务器地址。

其他电脑遇到相同症状时，先核对 `/healthz` 与浏览器网络面板中的 `/ws`：正常握手应为 101。不要通过关闭服务器防火墙、SELinux 或放宽 Origin 校验处理这个问题。
