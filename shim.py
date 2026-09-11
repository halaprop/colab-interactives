import json
import sys
import time
import types
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


def _exists(url):
    try:
        _fetch(url, method='HEAD')
        return True
    except urllib.error.HTTPError:
        return False


def show(app, ref=None, height=650, **kw):
    # an app is either pyapps/<app>/main.py (Python, run in the kernel;
    # kw go to its main()) or apps/<app>/index.js (JS, shown in an iframe
    # of the given height). Python is looked for first. Both HEAD-checked
    # so a typo'd name is a loud Python exception naming the exact paths.
    base = f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{resolve_ref(ref or REF)}'
    py_entry, js_entry = f'pyapps/{app}/main.py', f'apps/{app}/index.js'
    if _exists(f'{base}/{py_entry}'):
        return _run_py(f'{base}/{py_entry}', app, kw)
    if _exists(f'{base}/{js_entry}'):
        return _show_js(f'{base}/{js_entry}', js_entry, height)
    raise FileNotFoundError(f'no {py_entry} or {js_entry} under {base}')


def _run_py(src, app, kw):
    # executes the file as a module, calls its main(**kw) if it defines
    # one, returns the module. Print and display output land in the cell
    # like ordinary Python.
    code = _fetch(src).read().decode('utf-8')
    name = 'pyapps.' + app.replace('/', '.')
    mod = types.ModuleType(name)
    mod.__file__ = src
    sys.modules[name] = mod
    exec(compile(code, src, 'exec'), mod.__dict__)
    if callable(getattr(mod, 'main', None)):
        mod.main(**kw)
    return mod


def _show_js(src, entry, height):
    # a bare number is shorthand for pixels (unchanged default behavior);
    # a string is passed straight through as a CSS height, e.g. '50vh' or
    # 'auto' -- confirmed against real Colab output that content sizing
    # itself via plain CSS (no fixed height on #app) reflows the output
    # area correctly, no special API needed.
    height_css = f'{height}px' if isinstance(height, (int, float)) else str(height)

    # entry itself is checked by show(). A missing dependency pulled in by
    # entry's own imports can't be preflighted the same way -- would mean
    # reimplementing module resolution in Python -- so that case is left
    # to the browser: .onerror and console.error
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
                  f'<div id="app" style="width:100%;height:{height_css};"></div>{script}'))
