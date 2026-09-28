"""Exact recovery and fail-closed checks using the actual downloaded release."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile

spec = importlib.util.spec_from_file_location('entry', Path(__file__).with_name('migrate-production-entry.py'))
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
baseline = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    site, landing, backup = root / 'site', root / 'landing', root / 'backup'
    shutil.copytree(baseline / 'baseline', site)
    shutil.copytree(baseline / 'landing', landing)
    record = entry.prepare(site, landing, baseline / 'source', root / 'release')
    backup.mkdir()
    shutil.copy2(site / 'index.html', backup / 'main-index.html')
    shutil.copy2(landing / 'index.html', backup / 'landing-index.html')
    (backup / 'release.json').write_text(json.dumps(record), encoding='utf-8')
    shutil.copy2(root / 'release/main/index.html', site / 'index.html')
    shutil.copy2(root / 'release/landing/index.html', landing / 'index.html')
    entry.rollback(site, landing, backup)
    assert (site / 'index.html').read_bytes() == (baseline / 'baseline/index.html').read_bytes()
    assert (landing / 'index.html').read_bytes() == (baseline / 'landing/index.html').read_bytes()
    print('PASS: both entries recover to their exact original bytes')
    (landing / 'index.html').write_text('new independent release')
    for action in [lambda: entry.prepare(site, landing, baseline / 'source', root / 'rejected'), lambda: entry.rollback(site, landing, backup)]:
        try:
            action()
        except RuntimeError:
            pass
        else:
            raise AssertionError('A different release was overwritten')
    assert (landing / 'index.html').read_text() == 'new independent release'
    assert not (root / 'rejected').exists()
    print('PASS: mismatched versions stop before entry changes')
