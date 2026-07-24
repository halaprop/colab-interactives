import json
import time
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

# GitHub's API 403s Python's default User-Agent -- a browser never hits
# this, only our own resolve_ref() fetch does, so it needs a browser-like UA.
_HEADERS = {'User-Agent': 'Mozilla/5.0'}


def _fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=_HEADERS), timeout=5)


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
        sha = json.loads(_fetch(url).read())['sha']
    except Exception:
        return ref  # jsDelivr's own @main cache is a few days stale at worst
    _resolved[ref] = (sha, time.time())
    return sha


def show(app, ref=None, height=650):
    base = f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{resolve_ref(ref or REF)}'
    entry = f'apps/{app}/index.js'
    src = f'{base}/{entry}'

    # No preflight check on src -- entry's own import statements pull in
    # everything else (lib files, D3 from an ESM CDN URL), so there's
    # nothing to enumerate up front. A missing entry or dependency fails
    # as a module load error: onerror below catches a missing entry;
    # a missing dependency shows in the browser console instead, naming
    # the exact URL that failed.
    tags = (
        f'<script type="module" src="{src}" onerror="'
        f"document.getElementById('app').textContent='error: {entry} not found'"
        f'"></script>'
    )

    display(HTML(f'<style>body{{margin:0}}</style>'
                  f'<div id="app" style="width:100%;height:{height}px;"></div>{tags}'))
