"""
shim.py -- Colab delivery.

Assembles ONE HTML doc for a Colab cell: a #canvas div, then three
script tags in order -- D3 (CDN) -> lib/diagram.js -> the app -- and
displays it.

    show()

Pass app= to show a different app than APP for one cell, or code=
instead to skip GitHub and iterate inline:

    show(app='apps/perceptron.js')
    show(code=open('apps/beach.js').read())
"""

import json
import time
import urllib.request
from IPython.display import HTML, display

GITHUB_USER = 'halaprop'
GITHUB_REPO = 'colab-interactives'

# set to 'main' during dev.
# set to a tag once stable: git tag vN && git push origin vN, then set
# LIB_VERSION to that tag name.
LIB_VERSION = 'main'

# repo path to the app show() displays by default. override per call
# with app= for a notebook that shows more than one.
APP = 'apps/beach.js'

D3_SRC = 'https://d3js.org/d3.v7.min.js'

# jsDelivr caches a branch ref (e.g. @main) for up to 7 days and ignores
# query-string cache-busting for it. A commit sha is immutable, so
# jsDelivr always treats it as fresh content instead -- resolving 'main'
# to its current sha here sidesteps the branch cache entirely. Pinned
# tags need no resolving, they're already immutable. Resolved shas are
# cached for RESOLVE_TTL seconds so a burst of re-run cells doesn't
# re-hit the GitHub API each time.
RESOLVE_TTL = 30
_resolved = {}


def resolve_ref(ref):
    if ref != 'main':
        return ref
    cached = _resolved.get(ref)
    now = time.time()
    if cached and now - cached[1] < RESOLVE_TTL:
        return cached[0]
    try:
        url = f'https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/commits/main'
        with urllib.request.urlopen(url, timeout=5) as resp:
            sha = json.loads(resp.read())['sha']
        _resolved[ref] = (sha, now)
        return sha
    except Exception:
        return ref


def jsdelivr(path, ref):
    return f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{resolve_ref(ref)}/{path}'


def show(app=None, code=None, app_ref=None, height=650):
    if code is None and app is None:
        app = APP

    if app_ref is None:
        app_ref = LIB_VERSION

    lib_src = jsdelivr('lib/diagram.js', LIB_VERSION)
    if code is not None:
        app_tag = f'<script>{code}</script>'
    else:
        app_src = jsdelivr(app, app_ref)
        app_tag = f'<script src="{app_src}"></script>'

    html = f'''
<style>body{{margin:0}}</style>
<div id="canvas" style="width:100%;height:{height}px;"></div>
<script src="{D3_SRC}"></script>
<script src="{lib_src}"></script>
{app_tag}
'''
    display(HTML(html))
