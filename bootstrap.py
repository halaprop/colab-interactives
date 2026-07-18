# Paste into your notebook's first cell, filling in your own repo below.
# Fetches shim.py fresh and imports it as `shim` -- re-run this cell (not
# just the show() cells) whenever shim.py itself changes.
GITHUB_USER = 'halaprop'
GITHUB_REPO = 'colab-interactives'
REF = 'main'  # or a pinned tag

import urllib.request, sys
url = f'https://raw.githubusercontent.com/{GITHUB_USER}/{GITHUB_REPO}/{REF}/shim.py'
urllib.request.urlretrieve(url, 'shim.py')
sys.modules.pop('shim', None)
import shim
shim.GITHUB_USER, shim.GITHUB_REPO, shim.REF = GITHUB_USER, GITHUB_REPO, REF
