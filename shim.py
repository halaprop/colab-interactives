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

import time
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


def jsdelivr(path, ref, cache_bust=False):
    url = f'https://cdn.jsdelivr.net/gh/{GITHUB_USER}/{GITHUB_REPO}@{ref}/{path}'
    if cache_bust:
        url += f'?t={int(time.time())}'
    return url


def show(app=None, code=None, app_ref=None, height=650):
    if code is None and app is None:
        app = APP

    if app_ref is None:
        app_ref = LIB_VERSION

    lib_src = jsdelivr('lib/diagram.js', LIB_VERSION, cache_bust=(LIB_VERSION == 'main'))
    if code is not None:
        app_tag = f'<script>{code}</script>'
    else:
        app_src = jsdelivr(app, app_ref, cache_bust=(app_ref == 'main'))
        app_tag = f'<script src="{app_src}"></script>'

    html = f'''
<style>body{{margin:0}}</style>
<div id="canvas" style="width:100%;height:{height}px;"></div>
<script src="{D3_SRC}"></script>
<script src="{lib_src}"></script>
{app_tag}
'''
    display(HTML(html))
