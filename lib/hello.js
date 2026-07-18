/*
 * lib/hello.js -- a made-up dependency, just to demonstrate that an
 * app's manifest.json can point at any file in this repo, not only
 * lib/diagram.js. Exposes one global function.
 */
function sayHello(container, name) {
  const h1 = document.createElement('h1');
  h1.textContent = `Hello, ${name}!`;
  container.appendChild(h1);
}
