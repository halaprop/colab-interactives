# colab-interactives

Run JS apps in a Google Colab cell with almost no code in the notebook.

 - Paste `bootstrap.py` into your notebook's first cell, filling in `GITHUB_USER`/`GITHUB_REPO`/`REF` for this repo (or your fork).
 - Every other cell can call `shim.show(app=...)`.
 - The `app` param refers to a subpath in the apps folder of this repo. It requires an `index.js` file as the entry point, plus an optional `manifest.json` specifying the app's dependencies (and overriding the entry point's filename, if you don't want `index.js`).
 - App dependencies may be either CDN-hosted libs, or a path within this repo, e.g. `lib/diagram.js`.
 - The shim will assemble an HTML doc with script tags importing the app's dependencies, and an `#app` div, upon which the DOM can be built.
 - Everything is fetched from your repo via jsDelivr.

## Hello World

`apps/hello/index.js`:

```js
(function () {
  const root = document.querySelector('#app');
  sayHello(root, 'World');
})();
```

`apps/hello/manifest.json` -- a made-up dependency, just to show the
mechanism (it could be a CDN URL instead; here it's a file in this repo):

```json
{ "deps": ["lib/hello.js"] }
```

`lib/hello.js`:

```js
function sayHello(container, name) {
  const h1 = document.createElement('h1');
  h1.textContent = `Hello, ${name}!`;
  container.appendChild(h1);
}
```

Push those three files to GitHub. Then, in a Colab notebook: paste
`bootstrap.py` into cell 1 (with your `GITHUB_USER`/`GITHUB_REPO`/`REF`
filled in), and in cell 2:

```python
shim.show(app='hello')
```

The cell renders "Hello, World!".

