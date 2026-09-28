"""Reproduce and verify the deployed frontend without contacting customer APIs."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile

directory = Path(__file__).resolve().parent
repo = directory.parent


def module(name):
    spec = importlib.util.spec_from_file_location(name, directory / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


nav = module('patch-production-nav')
entry = module('migrate-production-entry')
with tempfile.TemporaryDirectory(prefix='joker-reproduce-') as temp:
    root = Path(temp)
    baseline = root / 'nav/baseline'
    landing = root / 'entry/landing'
    with zipfile.ZipFile(directory / 'entry-source.zip') as archive:
        for member, target in {
            'baseline/index.html': baseline / 'index.html',
            'baseline/index-BJq_-mQY.js': baseline / 'assets/index-BJq_-mQY.js',
            'baseline/index-QxEjFC9K.css': baseline / 'assets/index-QxEjFC9K.css',
            'baseline/landing.html': landing / 'index.html',
        }.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(member))
    subprocess.run([sys.executable, str(directory / 'test-production-nav.py'), str(baseline)], check=True)
    nav.prepare(baseline, root / 'entry/baseline')
    shutil.copy2(baseline / 'assets/index-QxEjFC9K.css', root / 'entry/baseline/assets/index-QxEjFC9K.css')
    entry.download_source(root / 'entry/source')
    record = entry.prepare(root / 'entry/baseline', landing, root / 'entry/source', root / 'entry/release')
    subprocess.run([sys.executable, str(directory / 'test-production-entry.py'), str(root / 'entry')], check=True)
    subprocess.run(['node', str(repo / 'scripts/verify-production-entry.mjs'), str(root / 'entry/release')], check=True)
    assert record['files']['main/assets/' + record['javascript']] == '46d1d07f01e5f8f1589a9deec4460e43f458f28f9f24b00f79bf5d892b831d08'
    print('PASS: archived baseline reproduces the exact published server bundle')
