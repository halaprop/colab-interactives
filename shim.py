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

# some CDNs (e.g. jsDelivr) 403 Python's default User-Agent regardless of
# HTTP method -- a browser's <script src> never hits this, only our own
# fetch/HEAD checks do, so every request needs a browser-like UA.
_HEADERS = {'User-Agent': 'Mozilla/5.0'}


def _fetch(url, method='GET'):
    return urllib.request.urlopen(urllib.request.Request(url, method=method, headers=_HEADERS), timeout=5)


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

    try:
        _fetch(src, method='HEAD')
    except urllib.error.HTTPError as e:
        raise FileNotFoundError(f'{entry} -> HTTP {e.code} ({src})') from None

    # entry itself is checked above (a typo'd app name is the common
    # mistake, and this makes it a loud Python exception). A missing
    # dependency pulled in by entry's own imports can't be preflighted the
    # same way -- would mean reimplementing module resolution in Python --
    # so that case is left to the browser: .onerror and console.error
    # below both name the exact URL, though Colab's output iframe may
    # restrict enough (inline event-handler attributes, modals) that
    # neither is guaranteed to surface. Built as a real <script> block
    # with .onerror set as a JS property, not an inline onerror="" HTML
    # attribute, since the latter is exactly the kind of thing such a
    # sandbox tends to block.
    script = f'''<script>
      const s = document.createElement('script');
      s.type = 'module';
      s.src = {json.dumps(src)};
      s.onerror = () => {{
        console.error('failed to load', s.src);
        document.getElementById('app').textContent = {json.dumps(f'error: {entry} not found')};
      }};
      document.body.appendChild(s);
    </script>'''

    display(HTML(f'<style>body{{margin:0}}</style>'
                  f'<div id="app" style="width:100%;height:{height}px;"></div>{script}'))
