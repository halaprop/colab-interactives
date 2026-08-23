import { loadFixture, cosineSim, buildStrip } from '../shared.js';

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
    .word-math .hint-line {
      font-size: 14px;
      color: var(--ink-muted);
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
    .word-math .status-line {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 14px;
      color: var(--ink-secondary);
      font-style: italic;
      min-height: 1.2em;
      text-align: center;
    }

    /* fixed label column so every strip starts at the same x, regardless
       of word length -- this is what keeps the bands aligned */
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
    .word-math .equation-label.result {
      color: var(--diverging-pos);
      font-weight: 600;
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
      width: 5px;
      height: 36px;
    }
    .word-math .also-close {
      grid-column: 1 / -1;
      font-size: 13px;
      color: var(--ink-muted);
      text-align: center;
      margin-top: 2px;
    }
  </style>
  <div class="hint-line">type an expression like: daughter - girl + boy</div>
  <input class="word-input" type="text" placeholder="word + word" autocomplete="off" spellcheck="false" />
  <div class="status-line"></div>
  <div class="equation"></div>
`;

const wordInput = root.querySelector('.word-input');
const statusLine = root.querySelector('.status-line');
const equation = root.querySelector('.equation');

function currentColors() {
  const style = getComputedStyle(root);
  return {
    neutral: style.getPropertyValue('--diverging-neutral').trim(),
    neg: style.getPropertyValue('--diverging-neg').trim(),
    pos: style.getPropertyValue('--diverging-pos').trim(),
  };
}

function labelCell(text, extraClass) {
  const el = document.createElement('div');
  el.className = extraClass ? `equation-label ${extraClass}` : 'equation-label';
  el.textContent = text;
  return el;
}

// parses "car + pull", "car+pull-truck", "king - man + woman", etc. into
// [{ sign, word }, ...] -- the first term is always +, then any number of
// (+|-) word pairs
function parseExpression(raw) {
  const tokens = raw.trim().replace(/([+-])/g, ' $1 ').split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length % 2 === 0) return null;

  const terms = [{ sign: 1, word: tokens[0].toLowerCase() }];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    if (op !== '+' && op !== '-') return null;
    terms.push({ sign: op === '+' ? 1 : -1, word: tokens[i + 1].toLowerCase() });
  }
  return terms;
}

async function main() {
  const { words, dims, table, index } = await loadFixture(import.meta.url);

  function vecOf(word) {
    const i = index.get(word);
    return table.subarray(i * dims, (i + 1) * dims);
  }

  let debounceTimer = null;

  function evaluate(raw) {
    equation.innerHTML = '';

    if (!raw.trim()) {
      statusLine.textContent = '';
      return;
    }

    const parsed = parseExpression(raw);
    if (!parsed) {
      statusLine.textContent = 'type an expression like: car + pull';
      return;
    }

    const terms = parsed;
    const missing = terms.map((t) => t.word).filter((w) => !index.has(w));
    if (missing.length) {
      statusLine.textContent = `Sorry, "${missing.join('", "')}" is outside this small demo vocabulary.`;
      return;
    }

    const result = new Float32Array(dims);
    for (const { sign, word } of terms) {
      const v = vecOf(word);
      for (let i = 0; i < dims; i++) result[i] += sign * v[i];
    }

    const used = new Set(terms.map((t) => t.word));
    const scored = [];
    for (const w of words) {
      if (used.has(w)) continue;
      scored.push({ word: w, sim: cosineSim(result, vecOf(w)) });
    }
    scored.sort((a, b) => b.sim - a.sim);
    const best = scored[0];
    const runnersUp = scored.slice(1, 3);

    statusLine.textContent = '';
    const colors = currentColors();

    terms.forEach(({ sign, word }, i) => {
      const label = i === 0 ? word : `${sign > 0 ? '+' : '−'} ${word}`;
      equation.appendChild(labelCell(label));
      equation.appendChild(buildStrip(vecOf(word), colors));
    });

    const rule = document.createElement('hr');
    rule.className = 'equation-rule';
    equation.appendChild(rule);

    equation.appendChild(labelCell(`= ${best.word}`, 'result'));
    equation.appendChild(buildStrip(vecOf(best.word), colors));

    if (runnersUp.length) {
      const also = document.createElement('div');
      also.className = 'also-close';
      also.textContent = `also close: ${runnersUp.map((r) => r.word).join(', ')}`;
      equation.appendChild(also);
    }
  }

  wordInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => evaluate(wordInput.value), 150);
  });
}

main();
