#!/usr/bin/env python3
import json
import mimetypes
import socketserver
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from graph_loader import load_graph_data


class VisualizerHandler(SimpleHTTPRequestHandler):
    knowledge_dir = "."
    docs_dir = None
    root_paths = None
    source_dir = PROJECT_ROOT / "client"

    def end_headers(self):
        # Explicit CORS headers for local inspection and cross-origin fetching
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight requests gracefully
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()

            html_file = self.source_dir / "index.html"
            if html_file.exists():
                self.wfile.write(html_file.read_bytes())
            else:
                # FIXED: Encode the string to bytes to prevent TypeError
                self.wfile.write("<h1>index.html not found!</h1>".encode("utf-8"))
            return

        if self.path in ("/api/data", "/data.json"):
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            graph_data = load_graph_data(self.knowledge_dir, self.docs_dir, self.root_paths)
            self.wfile.write(json.dumps(graph_data).encode("utf-8"))
            return

        rel_path = self.path.lstrip("/")
        asset_path = self.source_dir / rel_path
        if rel_path and asset_path.exists() and asset_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(asset_path))
            self.send_response(200)
            self.send_header("Content-type", mime_type or "application/octet-stream")
            self.end_headers()
            self.wfile.write(asset_path.read_bytes())
            return

        super().do_GET()


def run_server(knowledge_dir: str, docs_dir: str = None, port: int = 8080, root_paths: list[str] = None):
    VisualizerHandler.knowledge_dir = knowledge_dir
    VisualizerHandler.docs_dir = docs_dir
    VisualizerHandler.root_paths = root_paths or []

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), VisualizerHandler) as httpd:
        url = f"http://localhost:{port}"
        print(f"[*] Visualizador 3D ativo em: {url}")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[*] Servidor encerrado.")
