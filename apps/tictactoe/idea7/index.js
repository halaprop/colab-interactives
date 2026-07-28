/*
 * apps/tictactoe/idea7/index.js
 *
 * Depth-limited search + a hand-crafted evaluation function: the real
 * pivot of the series. idea5/idea6 both search all the way to a genuine
 * ending -- exact, just at different costs. idea7 instead caps the
 * lookahead at 2 plies and, at that cutoff, *guesses* the position's value
 * with a hand-built scoring function (weighted count of still-open lines)
 * instead of computing it for real. Same alpha-beta pruning as idea6,
 * just with a shallow limit and a guess plugged in at the edge.
 *
 * "Thinking" shows this honestly by drawing the *real* full tree (same
 * search as idea6, to true endings) as a muted grey backdrop, with only
 * the shallow slice idea7 actually examines lit up in the normal bright
 * colors -- the grey isn't illustrative filler like idea5's slice; it's
 * the genuine continuation idea7 never looks at. The cutoff nodes (the
 * deepest bright ones, where a real ending wasn't reached) are filled by
 * their guessed value on a red(bad for O)-to-green(good for O) scale, so
 * a guess is never visually confused with a certainty. The true best line
 * (green) is traced independently, all the way into the grey -- and
 * idea7's own actual choice is separately marked, so if the two diverge,
 * that divergence is exactly where the shallow guess already goes wrong.
 */
import {
  run,
  sleep,
  markPV,
  renderTree,
  animateCounter,
  alphaBetaRootSearch,
  principalVariation,
  WIN_LINES,
} from '../../../lib/tictactoe.js';

const GROW_MS = 2200;
const EVAL_DEPTH = 2;

// Hand-crafted: for each of the 8 lines, count marks only if the line
// isn't already contested by both players (a dead line is worth nothing).
// A line with 2 of a player's marks -- one move from winning -- counts far
// more than a line with just 1. A real, if simple, judgment call, encoded
// by hand rather than learned from anything.
//
// The raw count is squashed through tanh before returning, so the result
// always stays strictly between -1 and 1 -- it can get arbitrarily close
// to a real win/loss but can never reach or cross those exact values. That
// matters: real wins/losses/draws are exactly -1/0/1, and without this, a
// merely bad-looking (but not actually lost) heuristic position could come
// out numerically worse than an *actual* certain loss, making the search
// prefer walking into a real loss over a position that only looks risky.
// (Found exactly this bug by testing an unblocked two-in-a-row: the
// heuristic-guessed value after blocking measured worse than the real,
// exact loss from not blocking, so the search picked not blocking.)
function evaluate(board) {
  let score = 0;
  for (const line of WIN_LINES) {
    const marks = line.map((i) => board[i]);
    const oCount = marks.filter((m) => m === 'O').length;
    const xCount = marks.filter((m) => m === 'X').length;
    if (oCount > 0 && xCount > 0) continue;
    if (oCount === 2) score += 3;
    else if (oCount === 1) score += 1;
    if (xCount === 2) score -= 3;
    else if (xCount === 1) score -= 1;
  }
  return Math.tanh(score / 6);
}

run(document.querySelector('#app'), async (board, empties, cellEls, vizEl) => {
  // The real, honest decision: a genuinely shallow search, guessing at the
  // cutoff. This is what actually picks O's move and drives the counter.
  const real = alphaBetaRootSearch(board, empties, EVAL_DEPTH, evaluate);

  // The backdrop: what a full, uncapped search from this same position
  // looks like -- purely for context and the true best-play line. Never
  // drives the move played or the honest node count.
  const backdrop = alphaBetaRootSearch(board, empties, Infinity, null);
  markPV(backdrop.tree, principalVariation(board));

  const chosen = backdrop.tree.children.find((child) => child.move === real.move);
  if (chosen) chosen.onChosen = true;

  renderTree(vizEl, backdrop.tree, GROW_MS, { width: 860, height: 364, evalDepth: EVAL_DEPTH });

  const counterEl = document.createElement('div');
  Object.assign(counterEl.style, {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#2b2f36',
    marginTop: '8px',
  });
  vizEl.appendChild(counterEl);

  await animateCounter(counterEl, real.nodeCount, GROW_MS, `positions searched (a full search needs ${backdrop.nodeCount.toLocaleString()})`);
  await sleep(200);

  return real.move;
}, {
  cellSize: 70,
  vizMinHeight: 410, // 30% smaller board; room for the 364px tree (also
  // 30% shorter) + counter -- same treatment as idea6
  description: 'Idea 7:\nIf the search space is still huge, stop searching early. Change the search from finding the "best" move to the "most promising" one.',
});
