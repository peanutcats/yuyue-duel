#!/usr/bin/env bash
# Run as root from an extracted release on a systemd Linux server with Node >=22.
set -euo pipefail
umask 022
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
command -v systemctl >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)'
task_source=$(cd "$(dirname "$0")/.." && pwd)
task_release="/opt/yuyue/releases/$(date -u +%Y%m%dT%H%M%SZ)"
if ! id yuyue >/dev/null 2>&1; then useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin yuyue; fi
mkdir -p "$task_release"
cp -R "$task_source/index.html" "$task_source/js" "$task_source/css" "$task_source/server" "$task_source/package.json" "$task_source/package-lock.json" "$task_release/"
cd "$task_release"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
chmod -R a+rX "$task_release"
if [[ ! -f /etc/yuyue.env ]]; then install -m 640 "$task_source/deploy/yuyue.env.example" /etc/yuyue.env; fi
task_previous=$(readlink /opt/yuyue/current || true)
ln -s "$task_release" /opt/yuyue/current.next
mv -Tf /opt/yuyue/current.next /opt/yuyue/current
task_node=$(command -v node)
sed "s|/usr/bin/node|$task_node|" "$task_source/deploy/yuyue.service" >/etc/systemd/system/yuyue.service
systemctl daemon-reload
systemctl enable yuyue
systemctl restart yuyue || true
task_port=$(sed -n 's/^PORT=//p' /etc/yuyue.env)
task_ok=0
for task_try in 1 2 3 4 5; do
    if curl -fsS "http://127.0.0.1:${task_port:-8080}/healthz"; then task_ok=1; break; fi
    sleep 1
done
if [[ "$task_ok" != 1 ]]; then
    journalctl -u yuyue -n 25 --no-pager
    if [[ -n "$task_previous" ]]; then
        ln -s "$task_previous" /opt/yuyue/rollback.next
        mv -Tf /opt/yuyue/rollback.next /opt/yuyue/current
        systemctl restart yuyue
    else systemctl stop yuyue; fi
    exit 1
fi
echo
echo "Release: $task_release"
echo "Previous: $task_previous"
systemctl --no-pager --full status yuyue
