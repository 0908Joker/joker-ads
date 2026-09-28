#!/usr/bin/env python3
"""Patch the verified VPS build without rebuilding the older repository source.

prepare writes a separate release; deploy backs up the server then switches its
HTML entry atomically. The exact baseline hashes deliberately fail closed.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

BASE_JS = "index-BJq_-mQY.js"
BASE_JS_SHA = "6641b7b64eab3b0a262554ef1c427170f09d316cc8615b564ec29cc4a4be9f40"
BASE_HTML_SHA = "8c63997a93e532dbd1f81cb678701f9c99ceebc42321969d36ab0cc91faa2e3a"
PATCHES = [
    ('PC=[{id:"invite",label:"得污",icon:"home"},', 'PC=['),
    (',f4={id:"invite",label:"得污",icon:"home"};function Po()', ';function Po()'),
    ('const n=e.config.tabbar||[];return n.some(i=>i.id==="invite"||i.id==="home")?n:[f4,...n]',
     'const n=(Array.isArray(e.config.tabbar)?e.config.tabbar:PC).filter(i=>i&&i.id!=="invite"&&i.id!=="home");return n.length?n:PC'),
    ('_u=[{path:"/",redirect:"/invite"}', '_u=[{path:"/",redirect:"/appcenter"}'),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def check(value, message):
    if not value:
        raise RuntimeError(message)


def prepare(site, output):
    html = (site / "index.html").read_bytes()
    original = (site / "assets" / BASE_JS).read_bytes()
    check(sha(html) == BASE_HTML_SHA, "HTML baseline differs; refusing to overwrite another release")
    check(sha(original) == BASE_JS_SHA, "JavaScript baseline differs; refusing to patch another release")
    text = original.decode("utf-8")
    for before, after in PATCHES:
        check(text.count(before) == 1, "Patch anchor is not unique: " + before[:65])
        text = text.replace(before, after, 1)
    # Reverse the entire change to prove no identity, invitation, or API code was
    # accidentally rewritten by a broad replacement.
    reverse = text
    for before, after in reversed(PATCHES):
        check(reverse.count(after) == 1, "Reverse anchor is not unique")
        reverse = reverse.replace(after, before, 1)
    check(reverse.encode("utf-8") == original, "Changes extend beyond the approved patch")
    changed = text.encode("utf-8")
    filename = "index-nav4-" + sha(changed)[:12] + ".js"
    reference = ("/assets/" + BASE_JS).encode()
    check(html.count(reference) == 1, "Unexpected script references in HTML")
    new_html = html.replace(reference, ("/assets/" + filename).encode(), 1)
    check(not output.exists(), "Release directory already exists")
    (output / "assets").mkdir(parents=True)
    (output / "assets" / filename).write_bytes(changed)
    (output / "index.html").write_bytes(new_html)
    subprocess.run(["node", "--check", str(output / "assets" / filename)], check=True)
    record = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "baselineHtmlSha256": BASE_HTML_SHA,
        "baselineJavascript": BASE_JS,
        "baselineJavascriptSha256": BASE_JS_SHA,
        "javascript": filename,
        "javascriptSha256": sha(changed),
        "htmlSha256": sha(new_html),
        "patches": ["four-item fallback", "remove forced invite tab", "filter legacy invite/home tabs", "default appcenter route"],
        "identityAndInvitationCode": "byte-for-byte unchanged outside the four asserted replacements",
    }
    (output / "release.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return record


def atomic_copy(source, destination, metadata_from=None):
    fd, name = tempfile.mkstemp(prefix=".nav4-", dir=destination.parent)
    os.close(fd)
    temporary = Path(name)
    try:
        shutil.copy2(source, temporary)
        if metadata_from:
            metadata = metadata_from.stat()
            os.chmod(temporary, metadata.st_mode)
            if hasattr(os, "chown"):
                os.chown(temporary, metadata.st_uid, metadata.st_gid)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def deploy(site, backup_root):
    check(site == Path("/www/wwwroot/b12sl5x.cn"), "Deploy target must be the sole production site")
    check(backup_root.is_absolute() and site not in backup_root.parents and backup_root != site,
          "Backups must be outside the web root")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = backup_root / ("nav4-" + stamp)
    with tempfile.TemporaryDirectory(prefix="joker-nav4-") as temporary:
        release = Path(temporary) / "release"
        record = prepare(site, release)
        backup.mkdir(parents=True, exist_ok=False)
        shutil.copy2(site / "index.html", backup / "index.html")
        with tarfile.open(backup / "frontend.tar.gz", "w:gz") as archive:
            archive.add(site / "index.html", arcname="index.html")
            archive.add(site / "assets", arcname="assets")
        shutil.copy2(release / "release.json", backup / "release.json")
        # Check again immediately before activation in case another deployment ran.
        check(sha((site / "index.html").read_bytes()) == BASE_HTML_SHA, "Entry changed during backup")
        check(sha((site / "assets" / BASE_JS).read_bytes()) == BASE_JS_SHA, "Baseline changed during backup")
        filename = record["javascript"]
        atomic_copy(release / "assets" / filename, site / "assets" / filename, site / "assets" / BASE_JS)
        check(sha((site / "assets" / filename).read_bytes()) == record["javascriptSha256"], "Resource verification failed")
        atomic_copy(release / "index.html", site / "index.html", site / "index.html")
        check(sha((site / "index.html").read_bytes()) == record["htmlSha256"], "Entry verification failed")
        record["backup"] = str(backup)
        print(json.dumps(record, ensure_ascii=False, indent=2))


def rollback(site, backup):
    record = json.loads((backup / "release.json").read_text(encoding="utf-8"))
    check(sha((site / "index.html").read_bytes()) == record["htmlSha256"], "A different release is active; rollback stopped")
    check(sha((backup / "index.html").read_bytes()) == BASE_HTML_SHA, "Backup entry failed verification")
    check(sha((site / "assets" / BASE_JS).read_bytes()) == BASE_JS_SHA, "Original asset missing or changed")
    atomic_copy(backup / "index.html", site / "index.html", site / "index.html")
    print("Restored original HTML entry; original assets and data were retained")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "deploy", "rollback"])
    parser.add_argument("--site-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--backup-root", type=Path)
    args = parser.parse_args()
    site = args.site_root.resolve()
    if args.action == "prepare":
        check(args.output_root is not None, "--output-root required")
        print(json.dumps(prepare(site, args.output_root.resolve()), ensure_ascii=False, indent=2))
    elif args.action == "deploy":
        check(args.backup_root is not None, "--backup-root required")
        deploy(site, args.backup_root.resolve())
    else:
        check(args.backup_root is not None, "--backup-root must point at a specific backup")
        rollback(site, args.backup_root.resolve())
