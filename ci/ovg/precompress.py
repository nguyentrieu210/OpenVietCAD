"""Build deterministic gzip sidecars; never modify original WebAssembly."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def build(root):
    rows = []
    for path in sorted(root.rglob("*.wasm")):
        with path.open("rb") as f:
            if f.read(8) != b"\x00asm\x01\x00\x00\x00":
                raise ValueError(f"invalid WASM header: {path}")
        sidecar = path.with_suffix(".wasm.gz")
        tmp = sidecar.with_suffix(".gz.tmp")
        try:
            with path.open("rb") as src, tmp.open("wb") as dst:
                with gzip.GzipFile(filename="", mode="wb", fileobj=dst, compresslevel=6, mtime=0) as enc:
                    shutil.copyfileobj(src, enc, 1024 * 1024)
            original = digest(path)
            h = hashlib.sha256()
            with gzip.open(tmp, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            if h.hexdigest() != original:
                raise ValueError("gzip roundtrip mismatch")
            # Public static assets must be readable by the unprivileged web server.
            tmp.chmod(0o644)
            tmp.replace(sidecar)
            rows.append({"asset": str(path.relative_to(root)), "raw_bytes": path.stat().st_size,
                         "gzip_bytes": sidecar.stat().st_size, "sha256": original,
                         "gzip_sha256": digest(sidecar)})
        finally:
            tmp.unlink(missing_ok=True)
    if not rows:
        raise ValueError("no WASM assets")
    report = {"assets": rows, "raw_bytes": sum(r["raw_bytes"] for r in rows),
              "gzip_bytes": sum(r["gzip_bytes"] for r in rows)}
    (root / "wasm-transfer.json").write_text(json.dumps(report, indent=2) + "\n")
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.root), indent=2))
