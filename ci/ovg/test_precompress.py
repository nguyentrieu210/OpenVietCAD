import gzip
import hashlib
from pathlib import Path
import tempfile
import unittest
from precompress import build

class CompressionTests(unittest.TestCase):
    def test_roundtrip_and_determinism(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            p = root / "engine.wasm"
            payload = b"\x00asm\x01\x00\x00\x00" + b"test" * 4000
            p.write_bytes(payload)
            a = build(root)
            first = (root / "engine.wasm.gz").read_bytes()
            b = build(root)
            self.assertEqual(a, b)
            self.assertEqual(first, (root / "engine.wasm.gz").read_bytes())
            self.assertEqual((root / "engine.wasm.gz").stat().st_mode & 0o777, 0o644)
            self.assertEqual(gzip.decompress(first), payload)
            self.assertEqual(p.read_bytes(), payload)
            self.assertEqual(a["assets"][0]["sha256"], hashlib.sha256(payload).hexdigest())
    def test_invalid_and_missing_wasm(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            with self.assertRaises(ValueError):
                build(root)
            (root / "bad.wasm").write_bytes(b"invalid")
            with self.assertRaises(ValueError):
                build(root)
            self.assertFalse((root / "bad.wasm.gz").exists())

if __name__ == "__main__":
    unittest.main()
