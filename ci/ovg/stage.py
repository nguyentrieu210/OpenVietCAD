from pathlib import Path
import shutil,re
root=Path('dist/verified')
assert not root.exists()
shutil.copytree('dist/app',root/'app')
p=root/'app/index.html'; s=p.read_text()
s=re.sub(r'<script id="openaec-analytics-loader"[^>]*></script>','',s)
s=re.sub(r'<script src="ocs-control.js"[^>]*></script>','',s)
s=re.sub(r'<script>\s*// Offline support: register the service worker\..*?</script>','',s,flags=re.S)
assert 'analytics.js' not in s and 'ocs-control.js' not in s and 'serviceWorker.register' not in s
p.write_text(s)
assert list((root/'app').glob('*.wasm'))
assert list((root/'app/worker_pkg').glob('*.wasm'))
for name in ['relay.js','relay.html','relay.css']:
    shutil.copyfile(Path('ci/ovg')/name,root/name)
(root/'relay-config.js').write_text('window.OVG_CAD_PARENT_ORIGIN="http://127.0.0.1:4280";\n')
print('Candidate staged; isolated loopback relay only.')
