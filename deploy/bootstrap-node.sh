#!/usr/bin/env bash
# Optional first install: official Node.js 24 LTS, verified by a pinned SHA-256.
# Does not replace an existing Node installation.
set -euo pipefail
umask 022
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
task_source=$(cd "$(dirname "$0")/.." && pwd)
task_log=/var/log/yuyue-install.log
exec >>"$task_log" 2>&1
trap 'task_rc=$?; echo "$task_rc" >/var/log/yuyue-install.exit' EXIT
echo running >/var/log/yuyue-install.exit
date -Is
if command -v node >/dev/null; then
    node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)'
else
    [[ $(uname -m) == x86_64 ]] || { echo 'This bootstrap targets x86_64'; exit 1; }
    task_temp=$(mktemp -d /tmp/yuyue-node.XXXXXX)
    cd "$task_temp"
    curl -fSL --retry 2 --connect-timeout 10 --max-time 300 \
      https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz \
      -o node-v24.22.2-linux-x64.tar.xz
    printf '%s\n' '48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75  node-v24.22.2-linux-x64.tar.xz' | sha256sum -c -
    mkdir -p /opt/nodejs /usr/local/bin
    tar -xJf node-v24.22.2-linux-x64.tar.xz -C /opt/nodejs
    for task_bin in node npm npx; do
        [[ ! -e /usr/local/bin/$task_bin && ! -L /usr/local/bin/$task_bin ]]
        ln -s "/opt/nodejs/node-v24.22.2-linux-x64/bin/$task_bin" "/usr/local/bin/$task_bin"
    done
fi
node --version
npm --version
bash "$task_source/deploy/install.sh"
# This deployment is a LAN HTTP/WebSocket service on TCP 8080.
if systemctl is-active --quiet firewalld; then
    firewall-cmd --zone=public --add-port=8080/tcp
    firewall-cmd --zone=public --permanent --add-port=8080/tcp
fi
curl -fsS http://127.0.0.1:8080/healthz
date -Is
