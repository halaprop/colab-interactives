/*
 * apps/tictactoe/idea7/index.js
 *
 * Depth-limited search + a hand-crafted evaluation function: the real
 * pivot of the series, and a deliberately different technique from
 * idea6's, not a further refinement of it. idea6 shrinks the search while
 * still guaranteeing the exact same answer as idea5 (prune only what's
 * proven irrelevant). idea7 shrinks it a different way instead: no
 * pruning at all, just a hard cap at 2 plies, and at that cutoff it
 * *guesses* the position's value with a hand-built scoring function
 * (weighted count of still-open lines) instead of computing it for real
 * -- trading the guarantee away for a much smaller search.
 *
 * "Thinking" shows this honestly by drawing the *real* full tree (idea6's
 * own pruned-but-exact search, to true endings) as a muted grey backdrop,
 * with only the shallow slice idea7 actually examines lit up in the
 * normal bright colors -- the grey isn't illustrative filler like idea5's
 * slice; it's the genuine continuation idea7 never looks at. The cutoff
 * nodes (the deepest bright ones, where a real ending wasn't reached) are
 * filled by their guessed value on a red(bad for O)-to-green(good for O)
 * scale, so a guess is never visually confused with a certainty. The true
 * best line (green) is traced independently, all the way into the grey --
 * and idea7's own actual choice is separately marked, so if the two
 * diverge, that divergence is exactly where the shallow guess already
 * goes wrong.
 */
import {
  run,
  sleep,
  markPV,
  renderTree,
  animateCounter,
  alphaBetaRootSearch,
  boundedRootSearch,
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
  // The real, honest decision: a genuinely shallow search, no pruning,
  // guessing at the cutoff. This is what actually picks O's move and
  // drives the counter.
  const real = boundedRootSearch(board, empties, EVAL_DEPTH, evaluate);

  // The backdrop: what a full, uncapped search from this same position
  // looks like -- purely for context and the true best-play line. Never
  // drives the move played or the honest node count. Uses idea6's
  // alpha-beta search (not boundedRootSearch) purely because it's cheaper
  // to compute full-depth -- it plays no part in idea7's own technique.
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
    whiteSpace: 'pre-line',
  });
  vizEl.appendChild(counterEl);

  // "uncapped", not "no pruning" -- backdrop is still idea6's pruned
  // search, just without idea7's own depth cap. Naming it "full search"
  // here would wrongly suggest the same (much bigger) unpruned figure
  // idea6 shows, when it's actually the smaller pruned one.
  await animateCounter(counterEl, real.nodeCount, GROW_MS, `positions searched\nwithout a depth cap, this would search ${backdrop.nodeCount.toLocaleString()} positions`);
  await sleep(200);

  return real.move;
}, {
  cellSize: 70,
  vizMinHeight: 410, // 30% smaller board; room for the 364px tree (also
  // 30% shorter) + counter -- same treatment as idea6
  description: 'Idea 7:\nFor huge search spaces, search less. Look for ways to find the "most promising" next move, rather than the best.\n(here, light grey edges are not searched)',
});
