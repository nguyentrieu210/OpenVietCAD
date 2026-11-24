"""Loopback-only static smoke-test server with restrictive CAD-origin headers."""

import argparse
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("root", type=Path)
parser.add_argument("port", type=int)
parser.add_argument("parent_origin")
parser.add_argument("--gzip-cache", action="store_true")
args = parser.parse_args()
if not re.fullmatch(r"http://127\.0\.0\.1:[1-9][0-9]{0,4}", args.parent_origin):
    raise SystemExit("Only a loopback fixture parent is allowed")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(args.root), **kw)

    def send_head(self):
        self.compressed_wasm = False
        self.cache_wasm = False
        path = Path(self.translate_path(self.path))
        if args.gzip_cache and path.suffix == ".wasm" and path.is_file():
            self.cache_wasm = True
            sidecar = path.with_suffix(".wasm.gz")
            accepts = {part.split(";")[0].strip().lower(): part.split(";", 1)[1].strip() if ";" in part else "q=1" for part in self.headers.get("Accept-Encoding", "").split(",")}
            try:
                quality = float(accepts.get("gzip", "q=0").split("=", 1)[1])
            except (ValueError, IndexError):
                quality = 0
            if quality > 0 and sidecar.is_file():
                f = sidecar.open("rb")
                self.compressed_wasm = True
                self.send_response(200)
                self.send_header("Content-Type", "application/wasm")
                self.send_header("Content-Length", str(sidecar.stat().st_size))
                self.send_header("Content-Encoding", "gzip")
                self.end_headers()
                return f
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)

    def end_headers(self):
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; "
            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; "
            "frame-src 'self'; frame-ancestors 'self' " + args.parent_origin + "; "
            "form-action 'none'; object-src 'none'; base-uri 'none'",
        )
        self.send_header("Cache-Control", "public, max-age=3600, immutable" if getattr(self, "cache_wasm", False) else "no-store")
        if getattr(self, "cache_wasm", False):
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
