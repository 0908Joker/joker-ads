#!/usr/bin/env python3
"""Move the verified entry chain onto the existing VPS without rebuilding main."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

spec = importlib.util.spec_from_file_location("nav", Path(__file__).with_name("patch-production-nav.py"))
nav = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nav)
sha, check, atomic_copy = nav.sha, nav.check, nav.atomic_copy

BASE_JS = "index-nav4-630157cd2de0.js"
BASE_JS_SHA = "630157cd2de02c297976ec12606a635a41959246e00479c9005752a7da784c9e"
BASE_HTML_SHA = "2d85ec016e89326fc3e18ad1ceaed6e363b87a725f57688224ada6db819e250a"
BASE_CSS = "index-QxEjFC9K.css"
BASE_CSS_SHA = "6a8ef10c12dae509fb71d1e058453ffe997752c2b00ed0a6e39c93ec2a95d62f"
LANDING_SHA = "9553114ced0c14611dbe767d0da9edbc0420c7481a3134c2a553f81c4ea6df49"
H5_SHA = "73b217f2d42c7d3e7278826ad6021b0937236cd3dd5bf76b333759d0b55cabf4"
DOWNLOADS = {
    "app.apk": "56dc416de014fdb2f06bdbe7db6a56f1444603343e8edcb24ff1e0c1d317589b",
    "app.mobileconfig": "802af6b2d1db4210f72cb01ea493aa15473c6516ead8cae2a80ecf8f7991fe24",
    "qd.jpg": "f7f7b70bb444107c46218e4d16deb58b8861c9facb4844f1a0a79c3c4845c33c",
}
OLD_SHARE = 'function ya(e){const t=typeof location<"u"?location.origin:"https://b12sl5x.cn",a=e||He.inviteCode,n=`${t}/#/invite`;return a?`${n}?inviteCode=${encodeURIComponent(a)}`:n}'
NEW_SHARE = 'function ya(e){return serverInviteTarget(e||He.inviteCode)}'
REDIRECT_HELPERS = '''function serverInviteTarget(e){const t=new URL("http://okqpkdj.cn/");if(e)t.searchParams.set("inviteCode",e);return t.href}function serverInviteRedirect(e){location.replace(serverInviteTarget(e))}function serverLegacyInvite(){if(!/^#\\/invite\\/?$/.test((location.hash||"").split("?")[0])&&!/^\\/invite\\/?$/.test(location.pathname))return false;serverInviteRedirect(Uf());return true}'''
H5_SCRIPT = '''setTimeout(function(){const code=new URLSearchParams(location.search).get("inviteCode");const target=new URL("https://b12sl5x.cn/");target.hash="/appcenter"+(code?"?"+new URLSearchParams({inviteCode:code}).toString():"");location.replace(target.href)},2000);'''
LANDING_SCRIPT = '''(()=>{const code=new URLSearchParams(location.search).get("inviteCode")||"1110333149523";const link=new URL("https://b12sl5x.cn/h5/");link.searchParams.set("inviteCode",code);document.querySelector('a[aria-label="官方入口"]').href=link.href;})();'''
DOWN_HTML = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>得污 App 下载</title><style>body{margin:0;background:#080d12;color:#fff;font:18px system-ui;text-align:center;padding:12vh 24px}a{display:block;margin:20px auto;padding:18px;max-width:300px;background:#00bfd9;color:#061016;border-radius:12px;text-decoration:none}p{color:#aab3ba;font-size:14px}</style><h1>得污 App</h1><p>根据设备选择版本</p><a href="../app.mobileconfig">苹果手机下载</a><a href="../app.apk">安卓手机下载</a><a id="web" href="../">打开网页版</a><script>const code=new URLSearchParams(location.search).get("inviteCode");if(code)document.getElementById("web").href="../?"+new URLSearchParams({inviteCode:code});</script></html>'''


def replace_one(text, before, after):
    check(text.count(before) == 1, "Patch anchor missing or ambiguous: " + before[:80])
    return text.replace(before, after, 1)


def verified(path, expected):
    data = path.read_bytes()
    check(sha(data) == expected, "Baseline mismatch: " + str(path))
    return data


def download_source(source):
    source.mkdir(parents=True, exist_ok=True)
    for name, expected in {**DOWNLOADS, "h5-entry.html": H5_SHA}.items():
        target = source / name
        if target.exists():
            verified(target, expected)
            continue
        url = "https://app.b12sl5x.cn/" + ("" if name == "h5-entry.html" else name)
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        check(sha(data) == expected, "Upstream changed: " + name)
        target.write_bytes(data)


def prepare(site, landing, source, output):
    html = verified(site / "index.html", BASE_HTML_SHA).decode()
    original = verified(site / "assets" / BASE_JS, BASE_JS_SHA).decode()
    css = verified(site / "assets" / BASE_CSS, BASE_CSS_SHA).decode()
    landing_html = verified(landing / "index.html", LANDING_SHA).decode()
    old_h5 = verified(source / "h5-entry.html", H5_SHA).decode()
    for name, expected in DOWNLOADS.items():
        verified(source / name, expected)
    check(not output.exists(), "Output already exists")

    # Every change can be reversed exactly; shared identity and claim code stays intact.
    start = original.index(',lu={class:"stage"}')
    end = original.index(',_u=[', start)
    removed = original[start:end]
    check('__name:"InvitePage"' in removed and 'IdentityCard' not in removed, "Unexpected page boundaries")
    patches = [
        (OLD_SHARE, NEW_SHARE),
        ('{path:"/invite",name:"invite",component:Du}', '{path:"/invite",name:"invite",beforeEnter:e=>{serverInviteRedirect(e.query.inviteCode);return false}}'),
        (removed, ''),
        ('}Uu();', '}' + REDIRECT_HELPERS + 'serverLegacyInvite()||Uu();'),
    ]
    js = original
    for before, after in patches:
        js = replace_one(js, before, after)
    restored = js
    for before, after in reversed(patches):
        if after:
            restored = replace_one(restored, after, before)
        else:
            restored = replace_one(restored, ',_u=[', before + ',_u=[')
    check(restored == original, "Changes extend beyond expected entry patches")
    check('InvitePage' not in js and 'dewu-hero-v11.mp4' not in js, "Old showcase remains")

    # Remove only leaf rules belonging to the old scoped component; keep global styles.
    css = re.sub(r'[^{}]+(?:\[data-v-f4d5d0ee\]|\[data-landing=invite\])[^{}]*\{[^{}]*\}', '', css)
    check('data-v-f4d5d0ee' not in css and 'data-landing=invite' not in css, "Old styles remain")
    js_name = "index-server-" + sha(js.encode())[:12] + ".js"
    css_name = "index-server-" + sha(css.encode())[:12] + ".css"
    html = replace_one(html, "/assets/" + BASE_JS, "/assets/" + js_name)
    html = replace_one(html, "/assets/" + BASE_CSS, "/assets/" + css_name)

    h5 = replace_one(old_h5, '<link rel="stylesheet" href="weui.css"/><link rel="stylesheet" href="weuix.css"/>', '')
    h5 = replace_one(h5, '<script src="zepto.min.js"></script><script src="zepto.weui.min.js"></script>', '')
    h5 = replace_one(h5, '$(function(){setTimeout(function(){location.href="https://b12sl5x.cn/#/appcenter";},2000)})', H5_SCRIPT)
    landing_html = replace_one(landing_html, 'https://b12sl5x.cn/#/invite?inviteCode=1110333149523', 'https://b12sl5x.cn/h5/?inviteCode=1110333149523')
    landing_html = landing_html.replace('https://app.b12sl5x.cn/app.', 'https://b12sl5x.cn/h5/app.')
    landing_html = replace_one(landing_html, 'app.b12sl5x.cn/down', 'b12sl5x.cn/h5/down/')
    landing_html = replace_one(landing_html, 'assets/reference-selected/download-qr.png', 'assets/download-server.svg')
    landing_html = replace_one(landing_html, '</body>', '<script>' + LANDING_SCRIPT + '</script></body>')
    check('app.b12sl5x.cn' not in landing_html, "Old Pages link remains on landing")

    files = {
        "main/index.html": html.encode(), "main/assets/" + js_name: js.encode(),
        "main/assets/" + css_name: css.encode(), "main/h5/index.html": h5.encode(),
        "main/h5/down/index.html": DOWN_HTML.encode(), "landing/index.html": landing_html.encode(),
        "landing/assets/download-server.svg": Path(__file__).with_name("download-server.svg").read_bytes(),
    }
    for name in DOWNLOADS:
        files["main/h5/" + name] = (source / name).read_bytes()
    for name, data in files.items():
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    subprocess.run(["node", "--check", str(output / "main/assets" / js_name)], check=True)
    record = {"createdAt": datetime.now(timezone.utc).isoformat(), "files": {name: sha(data) for name, data in files.items()},
              "javascript": js_name, "css": css_name, "identity": "Existing claim/storage/card implementation retained; shared URL generator now targets landing",
              "baseline": {"mainHtml": BASE_HTML_SHA, "mainJs": BASE_JS_SHA, "mainCss": BASE_CSS_SHA, "landingHtml": LANDING_SHA}}
    (output / "release.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return record


def deploy(site, landing, source, backup_root):
    check(site == Path('/www/wwwroot/b12sl5x.cn') and landing == Path('/www/wwwroot/okqpkdj.cn'), "Unexpected production targets")
    check(not (site / 'h5').exists(), "Existing server H5 needs explicit comparison before replacement")
    check(backup_root.is_absolute() and not any(root == backup_root or root in backup_root.parents for root in [site, landing]), "Backup must be outside both web roots")
    with tempfile.TemporaryDirectory(prefix='joker-entry-') as temp:
        release = Path(temp) / 'release'
        record = prepare(site, landing, source, release)
        backup = backup_root / ('entry-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(parents=True, exist_ok=False)
        shutil.copy2(site / 'index.html', backup / 'main-index.html')
        shutil.copy2(landing / 'index.html', backup / 'landing-index.html')
        with tarfile.open(backup / 'frontend.tar.gz', 'w:gz') as archive:
            archive.add(site / 'index.html', arcname='main/index.html')
            archive.add(site / 'assets', arcname='main/assets')
            archive.add(landing / 'index.html', arcname='landing/index.html')
        shutil.copy2(release / 'release.json', backup / 'release.json')
        verified(site / 'index.html', BASE_HTML_SHA)
        verified(landing / 'index.html', LANDING_SHA)
        # Put all resources in place first; switch landing, then main.
        for name, expected in record['files'].items():
            area, relative = name.split('/', 1)
            root = site if area == 'main' else landing
            if relative == 'index.html':
                continue
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            check(not target.exists(), "New resource name unexpectedly exists: " + str(target))
            atomic_copy(release / name, target, root / 'index.html')
            verified(target, expected)
        try:
            atomic_copy(release / 'landing/index.html', landing / 'index.html', landing / 'index.html')
            atomic_copy(release / 'main/index.html', site / 'index.html', site / 'index.html')
            verified(site / 'index.html', record['files']['main/index.html'])
            verified(landing / 'index.html', record['files']['landing/index.html'])
        except Exception:
            # Restore only entries belonging to this transaction; never overwrite
            # an unrelated deployment that appeared while the operation ran.
            for root, area, filename, baseline_sha in [
                (site, 'main', 'main-index.html', BASE_HTML_SHA),
                (landing, 'landing', 'landing-index.html', LANDING_SHA),
            ]:
                current = sha((root / 'index.html').read_bytes())
                if current == record['files'][area + '/index.html']:
                    atomic_copy(backup / filename, root / 'index.html', root / 'index.html')
                else:
                    check(current == baseline_sha, 'Unrelated deployment detected; inspect backup ' + str(backup))
            raise
        record['backup'] = str(backup)
        print(json.dumps(record, ensure_ascii=False, indent=2))


def rollback(site, landing, backup):
    record = json.loads((backup / 'release.json').read_text(encoding='utf-8'))
    verified(site / 'index.html', record['files']['main/index.html'])
    verified(landing / 'index.html', record['files']['landing/index.html'])
    verified(backup / 'main-index.html', BASE_HTML_SHA)
    verified(backup / 'landing-index.html', LANDING_SHA)
    verified(site / 'assets' / BASE_JS, BASE_JS_SHA)
    verified(site / 'assets' / BASE_CSS, BASE_CSS_SHA)
    atomic_copy(backup / 'main-index.html', site / 'index.html', site / 'index.html')
    atomic_copy(backup / 'landing-index.html', landing / 'index.html', landing / 'index.html')
    print('Both entries restored; new server H5 remains usable for existing bookmarks')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['download-source', 'prepare', 'deploy', 'rollback'])
    p.add_argument('--site-root', type=Path)
    p.add_argument('--landing-root', type=Path)
    p.add_argument('--source-root', type=Path)
    p.add_argument('--output-root', type=Path)
    p.add_argument('--backup-root', type=Path)
    args = p.parse_args()
    if args.action == 'download-source':
        check(args.source_root is not None, '--source-root required')
        download_source(args.source_root.resolve())
    else:
        check(args.site_root is not None and args.landing_root is not None, 'Both site roots required')
        site, landing = args.site_root.resolve(), args.landing_root.resolve()
        if args.action == 'rollback':
            check(args.backup_root is not None, '--backup-root required')
            rollback(site, landing, args.backup_root.resolve())
        else:
            check(args.source_root is not None, '--source-root required')
            if args.action == 'prepare':
                check(args.output_root is not None, '--output-root required')
                print(json.dumps(prepare(site, landing, args.source_root.resolve(), args.output_root.resolve()), ensure_ascii=False, indent=2))
            else:
                check(args.backup_root is not None, '--backup-root required')
                deploy(site, landing, args.source_root.resolve(), args.backup_root.resolve())
