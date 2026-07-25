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
 */
import { run, checkWinner, emptyCells, sleep, markPV, renderTree, animateCounter } from '../../../lib/tictactoe.js';

const GROW_MS = 2200;

// The real alpha-beta search: computes the exact minimax value and builds
// the real tree at the same time -- unlike idea5, there's no separate
// illustrative pass, because the tree this actually walks IS what gets
// drawn. alpha/beta are the bounds inherited from ancestors; the moment
// they cross (alpha >= beta), every remaining sibling is already proven
// unable to change the outcome, and the loop stops before even looking at
// them -- they're never built, never visited, never counted.
function search(board, justMoved, move, alpha, beta, depth, orderRef) {
  const winner = checkWinner(board);
  const node = { board, justMoved, move, order: orderRef.next++, depth, winner, children: [] };
  node.terminal = Boolean(winner) || board.every(Boolean);

  if (node.terminal) {
    node.value = winner === 'O' ? 1 : winner === 'X' ? -1 : 0;
    return node;
  }

  const mover = justMoved === 'O' ? 'X' : 'O';
  let best = mover === 'O' ? -Infinity : Infinity;
  for (const i of emptyCells(board)) {
    const trial = board.slice();
    trial[i] = mover;
    const child = search(trial, mover, i, alpha, beta, depth + 1, orderRef);
    node.children.push(child);
    if (mover === 'O') {
      best = Math.max(best, child.value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, child.value);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break; // remaining siblings can't matter -- skip them
  }
  node.value = best;
  return node;
}

// The real root decision: O's actual candidate moves, each scored via the
// pruned search above, sharing one running alpha across candidates (same
// as idea5's fullSearch) and assembling everything into one tree rooted
// at the real current board. nodeCount is every node actually built --
// the honest cost of this exact decision, pruning included.
function rootSearch(board, empties) {
  const orderRef = { next: 0 };
  const tree = { board, justMoved: 'X', move: null, order: orderRef.next++, depth: 0, winner: null, terminal: false, children: [] };

  let bestScore = -Infinity;
  let bestMove = empties[0];
  let alpha = -Infinity;
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = 'O';
    const child = search(trial, 'O', i, alpha, Infinity, 1, orderRef);
    tree.children.push(child);
    if (child.value > bestScore) {
      bestScore = child.value;
      bestMove = i;
    }
    alpha = Math.max(alpha, bestScore);
  }
  tree.value = bestScore;
  return { move: bestMove, nodeCount: orderRef.next, tree };
}

// The single best next move from `board` for `player`, via the same pruned
// search -- uncounted and separate from rootSearch's real tree, so tracing
// the rest of the best-play line never touches the honest node count or
// the drawn tree.
function bestMove(board, player) {
  const empties = emptyCells(board);
  let bestValue = player === 'O' ? -Infinity : Infinity;
  let bestIndex = empties[0];
  let alpha = -Infinity;
  let beta = Infinity;
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = player;
    const child = search(trial, player, i, alpha, beta, 0, { next: 0 });
    const better = player === 'O' ? child.value > bestValue : child.value < bestValue;
    if (better) {
      bestValue = child.value;
      bestIndex = i;
    }
    if (player === 'O') alpha = Math.max(alpha, bestValue);
    else beta = Math.min(beta, bestValue);
  }
  return bestIndex;
}

// The moves of genuinely best play from `board` (O to move), all the way
// to a real ending -- no ply limit needed this time, since the drawn tree
// already goes to true terminal states, not a fixed depth cutoff.
function principalVariation(board) {
  const moves = [];
  let current = board;
  let mover = 'O';
  while (!checkWinner(current) && !current.every(Boolean)) {
    const idx = bestMove(current, mover);
    moves.push(idx);
    current = current.slice();
    current[idx] = mover;
    mover = mover === 'O' ? 'X' : 'O';
  }
  return moves;
}

run(document.querySelector('#app'), async (board, empties, cellEls, vizEl) => {
  const { move, nodeCount, tree } = rootSearch(board, empties);

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
