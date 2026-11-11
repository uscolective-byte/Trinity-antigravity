#!/usr/bin/env python3
import os, sys, json, subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

CONFIG = {
    "version": "3.5.0-omni-extended",
    "production_domain": "auru.space",
    "staging_domain": "auru.dev",
    "user": "Basterix",
    "email": "saboivan2008@gmail.com",
    "workspace_dir": r"C:\Users\saboi\Trinity-antigravity"
}

class TrinityEngine:
    @staticmethod
    def execute_tool(tool_name: str, arguments: dict) -> dict:
        print(f"[TRINITY ENGINE] Executing: {tool_name} with {arguments}")
        try:
            if tool_name == "desktop_open_application":
                app = arguments.get('app_name', 'notepad')
                arg = arguments.get('args', '')
                cmd = f"{app} {arg}".strip()
                subprocess.Popen(cmd, shell=True)
                return {"status": "success", "message": f"Launched {app}"}
            elif tool_name == "read_workspace_file":
                fp = os.path.join(CONFIG["workspace_dir"], arguments.get("filename", ""))
                if os.path.exists(fp):
                    with open(fp, "r", encoding="utf-8") as f: return {"status": "success", "content": f.read()}
                return {"status": "error", "message": "File not found"}
            elif tool_name == "system_status":
                return {"status": "online", "user": CONFIG["user"], "email": CONFIG["email"], "domains": [CONFIG["production_domain"], CONFIG["staging_domain"]]}
            return {"status": "error", "message": f"Unknown tool: {tool_name}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

class TrinityRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
            self.wfile.write(json.dumps({"system": "TRINITY OMNI-CORE", "status": "active"}, indent=2).encode("utf-8"))
        else: self.send_response(404); self.end_headers()
    def do_POST(self):
        if urlparse(self.path).path == "/api/mcp/execute":
            length = int(self.headers.get('Content-Length', 0))
            try:
                data = json.loads(self.rfile.read(length).decode("utf-8"))
                result = TrinityEngine.execute_tool(data.get("tool"), data.get("arguments", {}))
                self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
                self.wfile.write(json.dumps(result, indent=2).encode("utf-8"))
            except Exception as e:
                self.send_response(500); self.send_header("Content-Type", "application/json"); self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else: self.send_response(404); self.end_headers()

if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8787), TrinityRequestHandler)
    print(f"TRINITY OMNI-CORE Bridge active on http://127.0.0.1:8787 for {CONFIG['user']}")
    server.serve_forever()
