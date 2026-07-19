# This code enables the interactive elements on this page. It can be disregarded.
import urllib.request, sys
urllib.request.urlretrieve('https://raw.githubusercontent.com/halaprop/colab-interactives/main/shim.py', 'shim.py')
sys.modules.pop('shim', None)
import shim
shim.GITHUB_USER, shim.GITHUB_REPO, shim.REF = 'halaprop', 'colab-interactives', 'main'