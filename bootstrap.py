# This code enables the interactive elements on this page. It can be disregarded. 
import urllib.request, sys
url = f'https://raw.githubusercontent.com/{GITHUB_USER}/{GITHUB_REPO}/{REF}/shim.py'
urllib.request.urlretrieve(url, 'shim.py')
sys.modules.pop('shim', None)
import shim
shim.GITHUB_USER, shim.GITHUB_REPO, shim.REF = 'halaprop', 'colab-interactives', 'main'
