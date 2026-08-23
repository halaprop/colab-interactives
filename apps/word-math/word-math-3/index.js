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

    .word-math .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      width: 100%;
      max-width: 900px;
      align-items: start;
    }
    @media (max-width: 700px) {
      .word-math .main-grid {
        grid-template-columns: 1fr;
      }
    }

    .word-math .analogy-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .word-math .analogy-square {
      display: grid;
      grid-template-columns: 96px max-content 96px;
      grid-template-rows: auto auto auto;
      align-items: center;
      justify-items: center;
      gap: 12px 16px;
    }
    .word-math .analogy-cell {
      width: 96px;
      font-size: 18px;
      text-align: center;
      padding: 8px 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink-primary);
      box-sizing: border-box;
    }
    .word-math .analogy-cell:focus {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    .word-math .analogy-result {
      cursor: default;
      color: var(--ink-muted);
    }
    .word-math .analogy-result.solved {
      color: var(--diverging-pos);
      font-weight: 600;
    }
    .word-math .analogy-connector {
      font-size: 20px;
      font-weight: 700;
      color: var(--ink-secondary);
      white-space: nowrap;
    }
    .word-math .analogy-as {
      grid-column: 1 / -1;
      font-size: 20px;
      font-weight: 700;
      color: var(--ink-secondary);
    }
    .word-math .status-line {
      font-size: 14px;
      color: var(--ink-secondary);
      font-style: italic;
      min-height: 1.2em;
      text-align: center;
    }

    .word-math .equation-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .word-math .reveal-line {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      color: var(--ink-muted);
      min-height: 1.2em;
      text-align: center;
    }
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
  <div class="main-grid">
    <div class="analogy-col">
      <div class="analogy-square">
        <input class="analogy-cell" data-role="x" type="text" placeholder="man" autocomplete="off" spellcheck="false" />
        <span class="analogy-connector">is to</span>
        <input class="analogy-cell" data-role="y" type="text" placeholder="king" autocomplete="off" spellcheck="false" />
        <span class="analogy-as">as</span>
        <input class="analogy-cell" data-role="w" type="text" placeholder="woman" autocomplete="off" spellcheck="false" />
        <span class="analogy-connector">is to</span>
        <div class="analogy-cell analogy-result">?</div>
      </div>
      <div class="status-line"></div>
    </div>
    <div class="equation-col">
      <div class="reveal-line"></div>
      <div class="equation"></div>
    </div>
  </div>
`;

const xInput = root.querySelector('[data-role="x"]');
const yInput = root.querySelector('[data-role="y"]');
const wInput = root.querySelector('[data-role="w"]');
const resultCell = root.querySelector('.analogy-result');
const statusLine = root.querySelector('.status-line');
const revealLine = root.querySelector('.reveal-line');
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

function clearOutput() {
  resultCell.textContent = '?';
  resultCell.classList.remove('solved');
  statusLine.textContent = '';
  revealLine.textContent = '';
  equation.innerHTML = '';
}

async function main() {
  const { words, dims, table, index } = await loadFixture(import.meta.url);

  function vecOf(word) {
    const i = index.get(word);
    return table.subarray(i * dims, (i + 1) * dims);
  }

  let debounceTimer = null;

  function evaluate() {
    const x = xInput.value.trim().toLowerCase();
    const y = yInput.value.trim().toLowerCase();
    const w = wInput.value.trim().toLowerCase();

    clearOutput();
    if (!x || !y || !w) return;

    const missing = [x, y, w].filter((word) => !index.has(word));
    if (missing.length) {
      statusLine.textContent = `Sorry, "${missing.join('", "')}" is outside this small demo vocabulary.`;
      return;
    }

    const xVec = vecOf(x);
    const yVec = vecOf(y);
    const wVec = vecOf(w);
    const result = new Float32Array(dims);
    for (let i = 0; i < dims; i++) result[i] = yVec[i] - xVec[i] + wVec[i];

    const used = new Set([x, y, w]);
    const scored = [];
    for (const word of words) {
      if (used.has(word)) continue;
      scored.push({ word, sim: cosineSim(result, vecOf(word)) });
    }
    scored.sort((a, b) => b.sim - a.sim);
    const best = scored[0];
    const runnersUp = scored.slice(1, 3);

    resultCell.textContent = best.word;
    resultCell.classList.add('solved');
    revealLine.textContent = `→ ${y} − ${x} + ${w}`;

    const colors = currentColors();
    equation.appendChild(labelCell(y));
    equation.appendChild(buildStrip(yVec, colors));
    equation.appendChild(labelCell(`− ${x}`));
    equation.appendChild(buildStrip(xVec, colors));
    equation.appendChild(labelCell(`+ ${w}`));
    equation.appendChild(buildStrip(wVec, colors));

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

  for (const input of [xInput, yInput, wInput]) {
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(evaluate, 150);
    });
  }
}

main();
