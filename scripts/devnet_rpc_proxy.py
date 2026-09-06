#!/usr/bin/env python3
"""RPC compatibility proxy for starknet-devnet 0.9+.

- Rewrites block tag "pending" → "pre_confirmed" (Devnet 0.9 RPC)
- Adds CORS headers so the Vite app (localhost:5173) can call this origin

Usage:
  starknet-devnet --seed=0 --port=5050
  python3 scripts/devnet_rpc_proxy.py
  # App / sncast → http://127.0.0.1:5051  (or Vite /rpc proxy)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = os.environ.get("DEVNET_URL", "http://127.0.0.1:5050").rstrip("/")
HOST = os.environ.get("PROXY_HOST", "127.0.0.1")
PORT = int(os.environ.get("PROXY_PORT", "5051"))


def rewrite_pending(raw: bytes) -> bytes:
    text = raw.decode("utf-8")
    if '"pending"' not in text:
        return raw
    return text.replace('"pending"', '"pre_confirmed"').encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        origin = self.headers.get("Origin", "*")
        # Reflect localhost Vite origins; otherwise *
        if origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            self.headers.get("Access-Control-Request-Headers", "Content-Type"),
        )
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b""
        if body:
            body = rewrite_pending(body)

        url = f"{UPSTREAM}{self.path}"
        req = urllib.request.Request(
            url,
            data=body if self.command == "POST" else None,
            method=self.command,
            headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
        )
        try:
            with urllib.request.urlopen(req) as resp:
                out = resp.read()
                code = resp.status
                content_type = resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            out = e.read()
            code = e.code
            content_type = e.headers.get("Content-Type", "application/json")
        except Exception as e:
            out = json.dumps(
                {"jsonrpc": "2.0", "id": None, "error": {"code": -32000, "message": str(e)}}
            ).encode()
            code = 502
            content_type = "application/json"

        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    try:
        urllib.request.urlopen(f"{UPSTREAM}/is_alive", timeout=2)
    except Exception as e:
        print(f"WARNING: cannot reach Devnet at {UPSTREAM}: {e}", file=sys.stderr)
        print("Start: starknet-devnet --seed=0 --port=5050", file=sys.stderr)

    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"devnet RPC proxy  http://{HOST}:{PORT}  →  {UPSTREAM}", flush=True)
    print('rewrites "pending" → "pre_confirmed"; CORS enabled for localhost', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
