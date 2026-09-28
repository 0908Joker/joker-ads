"""Recovery and wrong-version checks against the downloaded production baseline."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile

spec = importlib.util.spec_from_file_location("patch", Path(__file__).with_name("patch-production-nav.py"))
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)
baseline = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    site, backup = root / "site", root / "backup"
    shutil.copytree(baseline, site)
    record = patch.prepare(site, root / "release")
    backup.mkdir()
    shutil.copy2(site / "index.html", backup / "index.html")
    (backup / "release.json").write_text(json.dumps(record), encoding="utf-8")
    shutil.copy2(root / "release" / "index.html", site / "index.html")
    patch.rollback(site, backup)
    assert (site / "index.html").read_bytes() == (baseline / "index.html").read_bytes()
    print("PASS: generated entry rolls back to the exact original bytes")
    (site / "index.html").write_text("a newer independent deployment", encoding="utf-8")
    for operation in [lambda: patch.prepare(site, root / "must-not-exist"), lambda: patch.rollback(site, backup)]:
        try:
            operation()
        except RuntimeError:
            pass
        else:
            raise AssertionError("Wrong-version operation was not rejected")
    assert not (root / "must-not-exist").exists()
    assert (site / "index.html").read_text() == "a newer independent deployment"
    print("PASS: patch and rollback both refuse a different live version without overwriting it")
