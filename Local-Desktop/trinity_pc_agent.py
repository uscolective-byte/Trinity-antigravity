#!/usr/bin/env python3
"""Trinity local Windows agent: loopback-only, operator-approved tool installation.

No remote shell, arbitrary file operations, or automatic approvals. The HTTP API
only queues an allowlisted install proposal; a human must approve it in a local
terminal. This service is NOT an authenticated Cloudflare Tunnel endpoint.
"""
import argparse
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path.home() / ".trinity-pc-agent"
DB = ROOT / "tasks.sqlite3"
TOKEN_FILE = ROOT / "local-token"
INSTALLER = Path(__file__).resolve().with_name("Trinity-Tool-Installer.ps1")
TOOLS = {"Git", "NodeJS", "Python", "Ollama"}
MAX_BODY = 2048

def setup():
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not TOKEN_FILE.exists():
        fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="ascii") as out:
            out.write(secrets.token_urlsafe(48))
    if os.name == "nt":
        # Windows filesystem permissions are inherited from the user profile.
        # Never place the token under a shared/public directory.
        pass
    else:
        os.chmod(TOKEN_FILE, 0o600)
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, tool TEXT NOT NULL, state TEXT NOT NULL,
            created INTEGER NOT NULL, updated INTEGER NOT NULL,
            return_code INTEGER, detail TEXT NOT NULL DEFAULT ''
        )""")

def connect():
    db = sqlite3.connect(DB, timeout=5)
    db.execute("PRAGMA busy_timeout=5000")
    return db

def get_task(task_id):
    with connect() as db:
        row = db.execute(
            "SELECT id, tool, state, created, updated, return_code, detail "
            "FROM tasks WHERE id=?", (task_id,)
        ).fetchone()
    if not row:
        return None
    return dict(zip(("id", "tool", "state", "created", "updated", "return_code", "detail"), row))

def propose(tool):
    if tool not in TOOLS:
        raise ValueError("Tool not on allowlist")
    task_id = secrets.token_hex(16)
    now = int(time.time())
    with connect() as db:
        db.execute(
            "INSERT INTO tasks(id, tool, state, created, updated) VALUES(?,?,'pending',?,?)",
            (task_id, tool, now, now)
        )
    return get_task(task_id)

def decide(task_id, approve):
    task = get_task(task_id)
    if not task:
        raise ValueError("Unknown task")
    if task["state"] != "pending":
        raise ValueError("Task is not pending")
    if int(time.time()) - task["created"] > 600:
        with connect() as db:
            db.execute("UPDATE tasks SET state='expired', updated=? WHERE id=? AND state='pending'",
                       (int(time.time()), task_id))
        raise ValueError("Task expired (10-minute approval window)")
    if not approve:
        with connect() as db:
            db.execute("UPDATE tasks SET state='denied', updated=? WHERE id=? AND state='pending'",
                       (int(time.time()), task_id))
        return get_task(task_id)
    if not INSTALLER.is_file():
        raise RuntimeError("Approved installer script is missing")
    with connect() as db:
        updated = db.execute(
            "UPDATE tasks SET state='running', updated=? WHERE id=? AND state='pending'",
            (int(time.time()), task_id)
        )
        if updated.rowcount != 1:
            raise RuntimeError("Task state changed concurrently")
    # This runs ONLY in the local CLI process, after explicit operator approval.
    # Arguments are fixed; never use shell=True or accept remote command strings.
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-File",
             str(INSTALLER), "-Action", "Install", "-Tool", task["tool"], "-Approve"],
            capture_output=True, text=True, timeout=600, check=False
        )
        detail = (result.stdout + "\n" + result.stderr)[-1600:]
        state = "installer_returned_zero_unverified" if result.returncode == 0 else "failed"
        rc = result.returncode
    except (OSError, subprocess.TimeoutExpired) as exc:
        state, rc, detail = "failed", -1, str(exc)[:300]
    with connect() as db:
        db.execute(
            "UPDATE tasks SET state=?, updated=?, return_code=?, detail=? WHERE id=? AND state='running'",
            (state, int(time.time()), rc, detail, task_id)
        )
    return get_task(task_id)

class Handler(BaseHTTPRequestHandler):
    server_version = "TrinityLocalAgent/0.1"
    def log_message(self, fmt, *args):
        # Avoid leaking authorization headers or task payloads into logs.
        sys.stderr.write("[trinity-agent] request processed\n")
    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def authorized(self):
        expected = TOKEN_FILE.read_text(encoding="ascii").strip()
        supplied = self.headers.get("Authorization", "")
        return hmac.compare_digest(supplied, "Bearer " + expected)
    def handle_request(self):
        # All endpoints require the local secret, including status.
        if not self.authorized():
            return self.send_json(401, {"ok": False, "error": "UNAUTHORIZED"})
        route = urlsplit(self.path).path
        if self.command == "GET" and route == "/v1/status":
            return self.send_json(200, {
                "ok": True, "agent": "local", "connectedToCloudflare": False,
                "remoteExecutionEnabled": False, "installerExists": INSTALLER.is_file(),
                "availableToolNames": sorted(TOOLS)
            })
        if self.command == "GET" and route.startswith("/v1/tasks/"):
            task_id = route.removeprefix("/v1/tasks/")
            if not (len(task_id) == 32 and all(c in "0123456789abcdef" for c in task_id)):
                return self.send_json(400, {"error": "INVALID_TASK_ID"})
            task = get_task(task_id)
            return self.send_json(200 if task else 404, task or {"error": "NOT_FOUND"})
        if self.command == "POST" and route == "/v1/proposals":
            try:
                size = int(self.headers.get("Content-Length", "-1"))
                if not 0 < size <= MAX_BODY:
                    return self.send_json(413, {"error": "INVALID_BODY_LENGTH"})
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or set(body) != {"tool"}:
                    return self.send_json(400, {"error": "ONLY_TOOL_NAME_ALLOWED"})
                task = propose(body["tool"])
            except (ValueError, TypeError, json.JSONDecodeError):
                return self.send_json(400, {"error": "INVALID_PROPOSAL"})
            return self.send_json(202, {"ok": True, "executed": False,
                                        "approvalRequired": True, "task": task})
        return self.send_json(404, {"ok": False, "error": "NOT_FOUND"})
    def do_GET(self):
        self.handle_request()
    def do_POST(self):
        self.handle_request()
    def do_PUT(self):
        self.send_json(405, {"error": "METHOD_NOT_ALLOWED"})
    def do_DELETE(self):
        self.send_json(405, {"error": "METHOD_NOT_ALLOWED"})

def main():
    parser = argparse.ArgumentParser(description="Trinity local, approval-gated PC agent")
    parser.add_argument("action", choices=("serve", "list", "approve", "deny"))
    parser.add_argument("task_id", nargs="?")
    parser.add_argument("--port", type=int, default=8788)
    args = parser.parse_args()
    setup()
    if args.action == "serve":
        if not 1024 <= args.port <= 65535:
            parser.error("port must be 1024-65535")
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
        print(f"Trinity local agent on 127.0.0.1:{args.port} (no cloud connection)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
        return
    if args.action == "list":
        with connect() as db:
            rows = db.execute(
                "SELECT id,tool,state,created FROM tasks ORDER BY created DESC LIMIT 30"
            ).fetchall()
        print(json.dumps([dict(zip(("id","tool","state","created"), row)) for row in rows], indent=2))
        return
    if not args.task_id:
        parser.error("task_id is required for approve/deny")
    task = get_task(args.task_id)
    if not task:
        parser.error("unknown task")
    if args.action == "approve":
        print(f"Install {task['tool']} on this PC? Task {task['id']}")
        if input("Type APPROVE to continue: ").strip() != "APPROVE":
            print(json.dumps(decide(args.task_id, False)))
            return
    print(json.dumps(decide(args.task_id, args.action == "approve"), indent=2))

if __name__ == "__main__":
    main()
