# colab-interactives

D3-based library for interactive network/plot diagrams, delivered into
Google Colab cells.

`lib/diagram.js` is a single hand-authored file with no build step — D3 is
its only runtime dependency, loaded via a script tag. What's in this repo
is byte-for-byte what runs in Colab.

## Dev harness

```
npm install
npm run dev
```

Opens `harness/index.html`, which loads D3 -> `lib/diagram.js` -> an
`apps/*.js` fixture, in that order — the same order and files the Colab
shim assembles. Switch fixtures with `?app=<name>` (default: `beach`).

## Colab delivery

Each Colab cell is a call to `shim.show(...)`, which assembles one HTML
doc — a `#canvas` div, then three script tags in order: D3 (CDN) ->
`lib/diagram.js` -> the app — and displays it. Both files are served via
jsDelivr, **not** `raw.githubusercontent.com` (wrong MIME type, won't
execute):

```
https://cdn.jsdelivr.net/gh/<user>/<repo>@<ref>/lib/diagram.js
https://cdn.jsdelivr.net/gh/<user>/<repo>@<ref>/apps/<name>.js
```

Before using this, fill in `GITHUB_USER`/`GITHUB_REPO` at the top of
`shim.py` once the repo is pushed to GitHub.

**In a Colab cell:**

```python
import shim
shim.show(lib='v1', app='apps/beach.js')
```

**Pin vs. float.** `lib` and `app` take *separate* git refs on purpose.
During a lecture, pin `lib` to a tag (`v1`) so the library can't shift
under you mid-class, while `app` floats on `main` (the default) so you
can keep pushing fixes to the app file between cells and just re-run the
cell to pick them up — `show()` cache-busts the app URL by default so you
never get a stale jsDelivr-cached copy while iterating. Re-run with a new
`lib=` tag once you cut the next version.

**Skip GitHub entirely** for quick local iteration by passing `code=`
instead of `app=` — the JS string gets embedded inline rather than
fetched:

```python
shim.show(lib='v1', code=open('apps/beach.js').read())
```
