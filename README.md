# colab-interactives

Run JS apps in a Google Colab cell with almost no code in the notebook.

Cell 1 of the notebook fetches and runs `bootstrap.py`, which pulls
`shim.py` down and imports it as `shim`:

```python
import urllib.request
exec(urllib.request.urlopen('https://raw.githubusercontent.com/halaprop/colab-interactives/main/bootstrap.py').read())
```

Every other cell is one line:

```python
shim.show(app='perceptron/single')
```

- `app` is a subpath under `apps/` in this repo, and needs an `index.js`
  as its entry point, loaded as an ES module.
- The shim assembles an HTML doc with one `<script type="module">`
  importing the app's entry point, and an `#app` div, upon which the DOM
  can be built.
- App files are fetched from the repo via jsDelivr; `bootstrap.py` and
  `shim.py` themselves come from `raw.githubusercontent.com`.

`show()` takes two more optional params: `ref=` (a branch, tag, or commit
sha, overriding the `REF` the bootstrap cell set) and `height=` (pixel
height of the `#app` div, default 650).

## Using a different fork

`bootstrap.py` is the single place to point everything at a different
repo. Two edits, both in that file:

- the `raw.githubusercontent.com` URL it fetches `shim.py` from, and
- the `shim.GITHUB_USER, shim.GITHUB_REPO, shim.REF = ...` line, which
  overwrites `shim.py`'s own copies of those constants right after import.

Then use the other fork's `bootstrap.py` URL in cell 1. The matching
constants at the top of `shim.py` apply when it's imported directly,
without the bootstrap cell.

## Hello World

`apps/hello/index.js`:

```js
import { sayHello } from '../../lib/hello.js';

const root = document.querySelector('#app');
sayHello(root, 'World');
```

`lib/hello.js` -- a made-up dependency, just to show the mechanism (it
could be a CDN URL instead; here it's a file in this repo):

```js
export function sayHello(container, name) {
  const h1 = document.createElement('h1');
  h1.textContent = `Hello, ${name}!`;
  container.appendChild(h1);
}
```

Push those two files to GitHub. Then, in a Colab notebook: the bootstrap
cell above, and in cell 2:

```python
shim.show(app='hello')
```

The cell renders "Hello, World!".

## Running an app locally

`harness/index.html` builds the same page `shim.py` does -- an `#app`
div and one `<script type="module">` -- so apps run locally:

```bash
npm install
npm run dev
```

Vite prints a local URL. Name the app with `?app=<name>`, the same name
`shim.show()` takes, for example:

```
http://localhost:5173/harness/index.html?app=tictactoe/idea0
```

Editing `apps/<name>/index.js` or anything under `lib/` reloads the page.

Gotcha: the harness sizes `#app` with `height: 100vh`, the shim with a
pixel height. Leave that height alone in app code -- a percentage height
on `#app` renders fine here and collapses to ~150px in Colab.

## Repo layout

- `apps/<name>/index.js` -- one app per folder; nested paths (e.g.
  `apps/tictactoe/idea0/`) are fine.
- `lib/` -- shared code imported by more than one app: `diagram.js` (the
  D3 diagram library, documented in `lib/Diagram-API.md`), `tictactoe.js`
  (board and rules for the `tictactoe/idea*` series), `hello.js`.
- `harness/index.html`, `vite.config.js` -- the local dev harness above.
- `shim.py`, `bootstrap.py` -- the Colab side.
- `exhibits/` -- screenshots, see below.

## Exhibits

Screenshots of apps live in `exhibits/`, committed as plain PNGs. Once
pushed, embed one in Markdown (this README, a PR description, etc.) as a
hosted image via its `raw.githubusercontent.com` URL:

```html
<img src="https://raw.githubusercontent.com/halaprop/colab-interactives/main/exhibits/<name>.png" width="500">
```

A few other `<img>` attributes worth knowing about:

- `alt="..."` -- fallback/accessibility text, shown if the image fails to load.
- `height="..."` -- set instead of (not in addition to) `width` to avoid
  distorting the aspect ratio, unless the two values are already proportional.
- `title="..."` -- tooltip text on hover.
- `align="right"` (or `left`) -- floats the image beside adjacent text;
  still respected in GitHub-flavored Markdown despite being deprecated
  HTML, since GFM doesn't reliably render flexbox/grid layouts.
