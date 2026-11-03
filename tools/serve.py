"""开发用静态服务器（禁用缓存）。用法：python3 tools/serve.py [端口]，默认 8765。

同时提供与 Vercel 相同的 /api/turn：设置环境变量 CF_TURN_KEY_ID 与 CF_TURN_API_TOKEN 后，
本地也能拿到 Cloudflare TURN 临时凭证；未设置时返回 503，游戏会自动退回仅直连。
"""
import http.server, json, os, re, sys, urllib.error, urllib.request

TTL = 4 * 3600


def turn_servers():
    key, token = os.environ.get('CF_TURN_KEY_ID'), os.environ.get('CF_TURN_API_TOKEN')
    if not key or not token:
        return 503, {'error': 'TURN 未配置：请设置 CF_TURN_KEY_ID 与 CF_TURN_API_TOKEN'}
    base = f'https://rtc.live.cloudflare.com/v1/turn/keys/{key}/credentials'
    body = json.dumps({'ttl': TTL}).encode()
    for path in ('generate-ice-servers', 'generate'):
        req = urllib.request.Request(f'{base}/{path}', data=body, method='POST', headers={
            'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=8) as r:
                ice = json.load(r).get('iceServers')
        except urllib.error.HTTPError as e:
            if e.code == 404 and path == 'generate-ice-servers':
                continue
            return 502, {'error': f'Cloudflare 返回 {e.code}'}
        except Exception as e:  # 网络错误
            return 502, {'error': str(e)}
        items = ice if isinstance(ice, list) else [ice] if ice else []
        out = []
        for s in items:
            urls = s.get('urls') if isinstance(s.get('urls'), list) else [s.get('urls')]
            urls = [u for u in urls if isinstance(u, str) and not re.search(r':53(\?|$)', u)]
            if urls:
                out.append({**s, 'urls': urls})
        return (200, {'iceServers': out, 'ttl': TTL}) if out else (502, {'error': 'Cloudflare 未返回可用的 TURN 地址'})
    return 502, {'error': 'Cloudflare 接口不可用'}


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/api/turn':
            code, obj = turn_servers()
            data = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f'羽跃对决: http://localhost:{port}', flush=True)
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
