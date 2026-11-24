import tempfile
from pathlib import Path
import unittest
from brand_stage import apply

class BrandStageTest(unittest.TestCase):
    def test_patch_and_repeat(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            original='<head><script type="module">const engine = 1;</script></head><body><script>(() => {const splash = document.getElementById("loading");fetch("locale-labels.json").then(()=>{});})();</script></body>'
            (p/"index.html").write_text(original)
            apply(p)
            output=(p/"index.html").read_text()
            self.assertIn('<script src="ovg-brand.js" defer></script>', output)
            self.assertIn('const engine = 1;', output)
            apply(p)
            self.assertEqual(output,(p/"index.html").read_text())
            self.assertTrue((p/"ovg-brand.json").is_file())
    def test_upstream_drift_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);(p/"index.html").write_text("<html>different</html>")
            with self.assertRaises(ValueError):apply(p)
if __name__=="__main__":unittest.main()
