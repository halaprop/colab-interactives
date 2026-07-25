/*
 * apps/tictactoe/idea6/index.js
 *
 * Alpha-beta pruning: the exact same search as idea5 (full minimax, same
 * guaranteed-optimal move), but skip any branch the instant it's proven it
 * can't change the outcome. Same answer, far fewer positions visited --
 * typically a couple thousand here (measured, not estimated), down from
 * the tens of thousands idea5 needs for the same decision.
 *
 * Because the pruned tree is small enough, this draws the *entire* real
 * tree the search actually walked -- not an illustrative slice like idea5
 * has to. Every leaf here is a genuine ending too (a real win or draw):
 * pruning only ever skips *sibling* candidates already proven irrelevant,
 * it never cuts a branch off partway through computing it, so nothing
 * gets left half-finished. Same visual language as idea5 (colored by
 * mover, terminal rings, green principal-variation path, DFS reveal
 * order, honest node counter, all from lib/tictactoe.js) so the two are
 * directly comparable -- same board, same shapes, dramatically less tree.
 *
 * The search itself (alphaBetaSearch/alphaBetaRootSearch/alphaBetaBestMove/
 * principalVariation) lives in lib/tictactoe.js now, generalized with a
 * depth limit and a pluggable evaluation function -- idea6 just calls it
 * with maxDepth = Infinity, which (since depth can then never reach it) is
 * exactly this unlimited search. idea7 reuses the same functions with a
 * real limit.
 */
import {
  run,
  sleep,
  markPV,
  renderTree,
  animateCounter,
  alphaBetaRootSearch,
  principalVariation,
} from '../../../lib/tictactoe.js';

const GROW_MS = 2200;

run(document.querySelector('#app'), async (board, empties, cellEls, vizEl) => {
  const { move, nodeCount, tree } = alphaBetaRootSearch(board, empties, Infinity, null);

  markPV(tree, principalVariation(board));
  renderTree(vizEl, tree, GROW_MS, { width: 860, height: 364 });

  const counterEl = document.createElement('div');
  Object.assign(counterEl.style, {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#2b2f36',
    marginTop: '8px',
  });
  vizEl.appendChild(counterEl);

  await animateCounter(counterEl, nodeCount, GROW_MS);
  await sleep(200);

  return move;
}, { cellSize: 70, vizMinHeight: 410 }); // 30% smaller board; room for the
// 364px tree (also 30% shorter) + counter
