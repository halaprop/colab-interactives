import { loadFixture, formatVector, divergingColor } from '../shared.js';

const root = document.querySelector('#app');
root.classList.add('word-math');
root.innerHTML = `
  <style>
    .word-math {
      color-scheme: light;
      --surface: #fcfcfb;
      --ink-primary: #0b0b0b;
      --ink-secondary: #52514e;
      --ink-muted: #898781;
      --border: rgba(11, 11, 11, 0.10);
      --accent: #2a78d6;
      --diverging-neutral: #f0efec;
      --diverging-neg: #2a78d6;
      --diverging-pos: #e34948;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 48px 24px;
      background: var(--surface);
      color: var(--ink-primary);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .word-math {
        color-scheme: dark;
        --surface: #1a1a19;
        --ink-primary: #ffffff;
        --ink-secondary: #c3c2b7;
        --ink-muted: #898781;
        --border: rgba(255, 255, 255, 0.10);
        --accent: #3987e5;
        --diverging-neutral: #383835;
        --diverging-neg: #3987e5;
        --diverging-pos: #e66767;
      }
    }
    .word-math .word-input {
      width: 280px;
      font-size: 20px;
      text-align: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink-primary);
    }
    .word-math .word-input:focus {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    .word-math .vector-line {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--ink-primary);
      min-height: 1.2em;
      text-align: center;
    }
    .word-math .vector-line.oov {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: var(--ink-secondary);
      font-style: italic;
    }
    .word-math .dims-line {
      font-size: 13px;
      color: var(--ink-muted);
      min-height: 1.2em;
    }
    .word-math .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--ink-secondary);
      user-select: none;
      cursor: pointer;
    }
    .word-math .toggle-switch {
      position: relative;
      width: 36px;
      height: 20px;
      appearance: none;
      background: var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .word-math .toggle-switch:checked {
      background: var(--accent);
    }
    .word-math .toggle-switch::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--surface);
      transition: transform 0.15s;
    }
    .word-math .toggle-switch:checked::before {
      transform: translateX(16px);
    }
    .word-math .viz-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-height: 60px;
    }
    .word-math .strip-label {
      font-size: 18px;
      color: var(--diverging-pos);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .word-math .strip {
      display: flex;
    }
    .word-math .strip-cell {
      width: 5px;
      height: 40px;
    }
  </style>
  <input class="word-input" type="text" placeholder="type a word…" autocomplete="off" spellcheck="false" />
  <div class="vector-line"></div>
  <div class="dims-line"></div>
  <label class="toggle-row">
    <input type="checkbox" class="toggle-switch" />
    show as color bands
  </label>
  <div class="viz-area"></div>
`;

const wordInput = root.querySelector('.word-input');
const vectorLine = root.querySelector('.vector-line');
const dimsLine = root.querySelector('.dims-line');
const vizToggle = root.querySelector('.toggle-switch');
const vizArea = root.querySelector('.viz-area');

let currentWord = null;
let currentVec = null;

function render() {
  vizArea.innerHTML = '';
  if (!vizToggle.checked || !currentVec) return;

  const style = getComputedStyle(root);
  const neutral = style.getPropertyValue('--diverging-neutral').trim();
  const neg = style.getPropertyValue('--diverging-neg').trim();
  const pos = style.getPropertyValue('--diverging-pos').trim();

  const label = document.createElement('div');
  label.className = 'strip-label';
  label.textContent = currentWord;
  vizArea.appendChild(label);

  const strip = document.createElement('div');
  strip.className = 'strip';
  const maxAbs = Math.max(...Array.from(currentVec, Math.abs)) || 1;
  for (const v of currentVec) {
    const cell = document.createElement('div');
    cell.className = 'strip-cell';
    cell.style.background = divergingColor(v / maxAbs, neutral, neg, pos);
    cell.title = v.toFixed(4);
    strip.appendChild(cell);
  }
  vizArea.appendChild(strip);
}

async function main() {
  const { dims, table, index } = await loadFixture(import.meta.url);

  let debounceTimer = null;

  function lookup(raw) {
    const word = raw.trim().toLowerCase();
    if (!word) {
      currentWord = null;
      currentVec = null;
      vectorLine.textContent = '';
      vectorLine.classList.remove('oov');
      dimsLine.textContent = '';
      render();
      return;
    }
    if (index.has(word)) {
      const i = index.get(word);
      currentWord = word;
      currentVec = table.subarray(i * dims, (i + 1) * dims);
      vectorLine.classList.remove('oov');
      vectorLine.textContent = formatVector(currentVec);
      dimsLine.textContent = `${dims} dimensions`;
    } else {
      currentWord = null;
      currentVec = null;
      vectorLine.classList.add('oov');
      vectorLine.textContent = 'Sorry, that word is outside this small demo vocabulary.';
      dimsLine.textContent = '';
    }
    render();
  }

  wordInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => lookup(wordInput.value), 150);
  });
  vizToggle.addEventListener('change', render);
}

main();
