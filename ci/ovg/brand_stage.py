"""Apply downstream runtime splash branding to an already-built HTML shell."""
from pathlib import Path
import re
import shutil

def apply(app: Path, source: Path = Path(__file__).resolve().parent):
    p = app / "index.html"
    s = p.read_text()
    tag = '<script src="ovg-brand.js" defer></script>'
    if tag not in s:
        pattern = r'<script>\s*\(\(\) => \{\s*const splash = document\.getElementById\("loading"\);\s*fetch\("locale-labels\.json"\).*?</script>'
        s, count = re.subn(pattern, tag, s, flags=re.S)
        if count != 1:
            raise ValueError("expected exactly one upstream localized splash script")
        p.write_text(s)
    for name in ("ovg-brand.js", "ovg-brand.json"):
        shutil.copyfile(source / name, app / name)
        (app / name).chmod(0o644)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("app", type=Path)
    apply(parser.parse_args().app)
