import { loadFixture, formatVector, cosineSim, buildStrip } from '../shared.js';

const NUM_NEIGHBORS = 3;

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

    /* nearest-neighbor list: word | vector, both columns centered so
       every row's word and vector text line up above one another */
    .word-math .neighbors-grid {
      display: grid;
      grid-template-columns: max-content max-content;
      column-gap: 24px;
      row-gap: 4px;
      justify-content: center;
      min-height: 3.6em;
    }
    .word-math .neighbor-word,
    .word-math .neighbor-vector {
      text-align: center;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .word-math .neighbor-word {
      font-weight: 600;
    }
    .word-math .neighbor-vector {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--ink-secondary);
    }
    .word-math .neighbor-row.selected .neighbor-word,
    .word-math .neighbor-row.selected .neighbor-vector {
      background: var(--diverging-neutral);
    }

    /* equation: fixed label column so every strip starts at the same x,
       regardless of word length -- this is what keeps the bands aligned */
    .word-math .equation {
      display: grid;
      grid-template-columns: 132px auto;
      align-items: center;
      row-gap: 8px;
      min-height: 140px;
    }
    .word-math .equation-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      text-align: right;
      padding-right: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .word-math .equation-rule {
      grid-column: 1 / -1;
      border: none;
      border-top: 2px solid var(--ink-primary);
      width: 100%;
      margin: 0;
    }
    .word-math .strip {
      display: flex;
    }
    .word-math .strip-cell {
      width: 8px;
      height: 36px;
    }
    .word-math .strip.result .strip-cell:first-child {
      border-left: 1px solid var(--ink-primary);
    }
    .word-math .strip.result .strip-cell:last-child {
      border-right: 1px solid var(--ink-primary);
    }
    .word-math .strip.result .strip-cell {
      border-top: 1px solid var(--ink-primary);
      border-bottom: 1px solid var(--ink-primary);
    }
  </style>
  <input class="word-input" type="text" placeholder="type a word…" autocomplete="off" spellcheck="false" />
  <div class="vector-line"></div>
  <div class="dims-line"></div>
  <div class="neighbors-grid"></div>
  <div class="equation"></div>
`;

const wordInput = root.querySelector('.word-input');
const vectorLine = root.querySelector('.vector-line');
const dimsLine = root.querySelector('.dims-line');
const neighborsGrid = root.querySelector('.neighbors-grid');
const equation = root.querySelector('.equation');

function currentColors() {
  const style = getComputedStyle(root);
  return {
    neutral: style.getPropertyValue('--diverging-neutral').trim(),
    neg: style.getPropertyValue('--diverging-neg').trim(),
    pos: style.getPropertyValue('--diverging-pos').trim(),
  };
}

function labelCell(text) {
  const el = document.createElement('div');
  el.className = 'equation-label';
  el.textContent = text;
  return el;
}

let query = null; // { word, vec }
let neighbors = []; // [{ word, vec, sim }]
let selectedIdx = null; // no equation shown until a neighbor is clicked

function renderNeighbors() {
  neighborsGrid.innerHTML = '';
  neighbors.forEach((n, i) => {
    const row = document.createElement('div');
    row.style.display = 'contents';
    row.className = 'neighbor-row' + (i === selectedIdx ? ' selected' : '');
    row.dataset.index = i;

    const wordEl = document.createElement('div');
    wordEl.className = 'neighbor-word';
    wordEl.textContent = n.word;

    const vecEl = document.createElement('div');
    vecEl.className = 'neighbor-vector';
    vecEl.textContent = formatVector(n.vec);

    row.appendChild(wordEl);
    row.appendChild(vecEl);
    row.addEventListener('click', () => {
      selectedIdx = i;
      renderNeighbors();
      renderEquation();
    });
    neighborsGrid.appendChild(row);
  });
}

function renderEquation() {
  equation.innerHTML = '';
  if (!query || neighbors.length === 0 || selectedIdx === null) return;

  const neighbor = neighbors[selectedIdx];
  const dims = query.vec.length;
  const diff = new Float32Array(dims);
  let sharedMax = 0;
  for (let i = 0; i < dims; i++) {
    diff[i] = query.vec[i] - neighbor.vec[i];
    sharedMax = Math.max(sharedMax, Math.abs(query.vec[i]), Math.abs(neighbor.vec[i]));
  }
  sharedMax = sharedMax || 1;
  const colors = currentColors();

  equation.appendChild(labelCell(query.word));
  equation.appendChild(buildStrip(query.vec, colors, sharedMax));

  equation.appendChild(labelCell(`− ${neighbor.word}`));
  equation.appendChild(buildStrip(neighbor.vec, colors, sharedMax));

  const rule = document.createElement('hr');
  rule.className = 'equation-rule';
  equation.appendChild(rule);

  equation.appendChild(labelCell(''));
  equation.appendChild(buildStrip(diff, colors, sharedMax, 'result'));
}

async function main() {
  const { words, dims, table, index } = await loadFixture(import.meta.url);

  let debounceTimer = null;

  function lookup(raw) {
    const word = raw.trim().toLowerCase();
    query = null;
    neighbors = [];
    selectedIdx = null;

    if (!word) {
      vectorLine.textContent = '';
      vectorLine.classList.remove('oov');
      dimsLine.textContent = '';
      renderNeighbors();
      renderEquation();
      return;
    }

    if (index.has(word)) {
      const i = index.get(word);
      const vec = table.subarray(i * dims, (i + 1) * dims);
      query = { word, vec };
      vectorLine.classList.remove('oov');
      vectorLine.textContent = formatVector(vec);
      dimsLine.textContent = 'select a nearby word to see the difference';

      neighbors = words
        .map((w, j) => ({ word: w, vec: table.subarray(j * dims, (j + 1) * dims) }))
        .filter((entry) => entry.word !== word)
        .map((entry) => ({ ...entry, sim: cosineSim(vec, entry.vec) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, NUM_NEIGHBORS);
    } else {
      vectorLine.classList.add('oov');
      vectorLine.textContent = 'Sorry, that word is outside this small demo vocabulary.';
      dimsLine.textContent = '';
    }

    renderNeighbors();
    renderEquation();
  }

  wordInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => lookup(wordInput.value), 150);
  });
}

main();
