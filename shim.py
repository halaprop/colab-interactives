"""
shim.py -- Colab delivery.

Assembles ONE HTML doc for a Colab cell: a #canvas div, then three
script tags in order -- D3 (CDN) -> lib/diagram.js -> the app -- and
displays it. LIB and APP take separate refs so LIB can stay pinned to a
tag for a lecture while APP floats on main and gets pushed between cells:

    show(lib='v1', app='apps/beach.js')

Pass `code=` instead of `app=` to skip GitHub and iterate inline:

    show(lib='v1', code=open('apps/beach.js').read())
"""

import time
from IPython.display import HTML, display

# Fill these in once the repo is on GitHub -- see README.md.
GITHUB_USER = 'YOUR_GITHUB_USER'
GITHUB_REPO = 'YOUR_GITHUB_REPO'

D3_SRC = 'https://d3js.org/d3.v7.min.js'


def jsdelivr(path, ref, cache_bust=False):
    url = f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{ref}/{path}'
    if cache_bust:
        url += f'?t={int(time.time())}'
    return url


def show(lib='main', app=None, app_ref='main', code=None, height=650, cache_bust=True):
    """
    lib:        git ref for lib/diagram.js (pin to a tag for a lecture).
    app:        repo path to an apps/*.js file, e.g. 'apps/beach.js'.
    app_ref:    git ref for `app` (defaults to 'main' -- typically floats
                while `lib` stays pinned).
    code:       inline JS string; if given, `app`/`app_ref` are ignored
                and nothing is fetched from GitHub for the app script.
    height:     canvas height in px. Width always fills the cell.
    cache_bust: append ?t=<timestamp> to the app URL (irrelevant when
                using `code`) so a floating ref doesn't serve a stale
                jsDelivr-cached copy while you're actively editing it.
    """
    if code is None and app is None:
        raise ValueError('show() needs either app= or code=')

    lib_src = jsdelivr('lib/diagram.js', lib)
    if code is not None:
        app_tag = f'<script>{code}</script>'
    else:
        app_src = jsdelivr(app, app_ref, cache_bust=cache_bust)
        app_tag = f'<script src="{app_src}"></script>'

    html = f'''
<style>body{{margin:0}}</style>
<div id="canvas" style="width:100%;height:{height}px;"></div>
<script src="{D3_SRC}"></script>
<script src="{lib_src}"></script>
{app_tag}
'''
    display(HTML(html))
