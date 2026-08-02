import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// assumes the caller lives one level below apps/word-math/ (e.g.
// apps/word-math/word-math-0/index.js), matching every app in this family
export async function loadFixture(callerUrl) {
  const [meta, buf] = await Promise.all([
    fetch(new URL('../data/word2vec-fixture.json', callerUrl)).then((r) => r.json()),
    fetch(new URL('../data/word2vec-fixture.bin', callerUrl)).then((r) => r.arrayBuffer()),
  ]);
  const { words, dims } = meta;
  const table = new Float32Array(buf);
  const index = new Map(words.map((w, i) => [w, i]));
  return { words, dims, table, index };
}

export function formatVector(vec) {
  const fmt = (v) => (v >= 0 ? ' ' : '') + v.toFixed(4);
  if (vec.length <= 6) return `[ ${Array.from(vec, fmt).join(', ')} ]`;
  const head = Array.from(vec.slice(0, 3), fmt);
  const tail = Array.from(vec.slice(vec.length - 2), fmt);
  return `[ ${head.join(', ')}, …, ${tail.join(', ')} ]`;
}

// neutral gray midpoint, blue for negative, red for positive. `t` should
// already be scaled to roughly [-1, 1] by whatever max the caller chose --
// callers comparing multiple strips share one max so intensity stays
// comparable across them (see word-math-1's difference strip).
export function divergingColor(t, neutral, neg, pos) {
  const clamped = Math.max(-1, Math.min(1, t));
  const pole = clamped >= 0 ? pos : neg;
  return d3.interpolateRgb(neutral, pole)(Math.abs(clamped));
}

// fixture vectors are pre-normalized to unit length, so cosine similarity
// is just the dot product
export function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// builds a <div class="strip"> of <div class="strip-cell"> elements colored
// by divergingColor. maxAbs defaults to the vector's own max magnitude
// (full-contrast display of one word); pass a shared maxAbs across calls
// when the point is comparing intensity between strips (e.g. showing a
// difference as visibly faint relative to its two source vectors).
export function buildStrip(vec, colors, maxAbs, className) {
  const scale = maxAbs || Math.max(...Array.from(vec, Math.abs)) || 1;
  const strip = document.createElement('div');
  strip.className = className ? `strip ${className}` : 'strip';
  for (const v of vec) {
    const cell = document.createElement('div');
    cell.className = 'strip-cell';
    cell.style.background = divergingColor(v / scale, colors.neutral, colors.neg, colors.pos);
    cell.title = v.toFixed(4);
    strip.appendChild(cell);
  }
  return strip;
}
