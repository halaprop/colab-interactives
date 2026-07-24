/*
 * lib/hello.js -- a made-up dependency, just to demonstrate that an
 * app can import any file in this repo, not only lib/diagram.js.
 */
export function sayHello(container, name) {
  const h1 = document.createElement('h1');
  h1.textContent = `Hello, ${name}!`;
  container.appendChild(h1);
}
