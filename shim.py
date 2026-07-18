import json
import time
import urllib.error
import urllib.request
from IPython.display import HTML, display

# defaults, used only if shim is imported without going through
# bootstrap.py (which overwrites these right after import -- see there).
GITHUB_USER = 'halaprop'
GITHUB_REPO = 'colab-interactives'
REF = 'main'  # or a pinned tag

_resolved = {}  # ref -> (sha, resolved_at); avoids re-hitting the GitHub
                # API on every cell re-run within RESOLVE_TTL seconds.
RESOLVE_TTL = 30


def resolve_ref(ref):
    # a commit sha is immutable so jsDelivr treats it as always-fresh,
    # unlike @main, which it caches for up to 7 days regardless of query
    # string -- resolving 'main' to its current sha here sidesteps that.
    if ref != 'main':
        return ref
    sha, t = _resolved.get(ref, (None, 0))
    if sha and time.time() - t < RESOLVE_TTL:
        return sha
    try:
        url = f'https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/commits/main'
        sha = json.loads(urllib.request.urlopen(url, timeout=5).read())['sha']
    except Exception:
        return ref  # jsDelivr's own @main cache is a few days stale at worst
    _resolved[ref] = (sha, time.time())
    return sha


def show(app, ref=None, height=650):
    base = f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{resolve_ref(ref or REF)}'

    try:
        manifest_url = f'{base}/apps/{app}/manifest.json'
        manifest = json.loads(urllib.request.urlopen(manifest_url, timeout=5).read())
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise  # a real fetch failure, not just "no manifest" -- don't hide it
        manifest = {}

    entry = f'apps/{app}/{manifest.get("entry", "index.js")}'
    scripts = [(d, d if d.startswith('http') else f'{base}/{d}') for d in manifest.get('deps', [])]
    scripts.append((entry, f'{base}/{entry}'))

    for label, src in scripts:
        try:
            urllib.request.urlopen(urllib.request.Request(src, method='HEAD'), timeout=5)
        except urllib.error.HTTPError as e:
            raise FileNotFoundError(f'{label} -> HTTP {e.code} ({src})') from None

    tags = ''.join(
        f'<script src="{src}" onerror="'
        f"document.getElementById('app').textContent='error: {label} not found'"
        f'"></script>'
        for label, src in scripts
    )

    display(HTML(f'<style>body{{margin:0}}</style>'
                  f'<div id="app" style="width:100%;height:{height}px;"></div>{tags}'))
