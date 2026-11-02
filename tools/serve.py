"""开发用静态服务器（禁用缓存）。用法：python3 tools/serve.py [端口]，默认 8765。"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f'羽跃对决: http://localhost:{port}', flush=True)
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
