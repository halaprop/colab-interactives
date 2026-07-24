/*
 * apps/tictactoe/idea5/index.js
 *
 * Brute-force, unpruned minimax: search the entire remaining game tree to
 * every terminal state, and pick the move that guarantees the best
 * outcome. Exact and exhaustive -- feasible here only because tic-tac-toe's
 * tree is tiny (tens of thousands of positions from a near-empty board,
 * nothing like the trees of a real game).
 *
 * "Thinking" shows the search in two honest pieces. The real search visits
 * far more nodes than could ever be drawn, so what's drawn is a genuine,
 * complete prefix of it instead of a full copy: every branch down to a
 * fixed depth (5 plies, not node-count-limited -- a node budget makes for
 * an uneven cutoff mid-level; a depth budget is symmetric at every level
 * it reaches), revealed in the exact order the real search would visit
 * them (depth-first, one full path before its next sibling -- true to how
 * minimax recursion actually walks a tree, not reordered for looks).
 * Nodes/edges are colored by which player's move produced them (matching
 * the board's own X/O colors), and real terminal nodes reached within
 * that depth (an actual win or draw, not just "we stopped drawing here")
 * get a distinct ring. The path of genuinely best play -- O's real move,
 * then each side's best reply in turn -- is traced separately (continuing
 * the search past what's drawn, since most drawn leaves aren't real
 * endings yet) and highlighted green. Alongside it all, a running counter
 * climbs to the true number of positions the full, untruncated search
 * actually visited.
 */
import { run, checkWinner, emptyCells, sleep } from '../../../lib/tictactoe.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const GROW_MS = 2200;
const TREE_LEVELS = 5; // counting the root
const X_COLOR = '#2f6fd1';
const O_COLOR = '#d1473f';

function minimax(board, player, counter) {
  counter.count++;
  const winner = checkWinner(board);
  if (winner === 'O') return 1;
  if (winner === 'X') return -1;
  if (board.every(Boolean)) return 0;

  const empties = emptyCells(board);
  let best = player === 'O' ? -Infinity : Infinity;
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = player;
    const value = minimax(trial, player === 'O' ? 'X' : 'O', counter);
    best = player === 'O' ? Math.max(best, value) : Math.min(best, value);
  }
  return best;
}

// Every candidate move, scored by minimax over everything that could
// follow it. nodeCount is every position the whole search visited.
function fullSearch(board, empties) {
  const counter = { count: 0 };
  let bestScore = -Infinity;
  let bestMove = empties[0];
  for (const i of empties) {
    counter.count++;
    const trial = board.slice();
    trial[i] = 'O';
    const score = minimax(trial, 'X', counter);
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return { move: bestMove, nodeCount: counter.count };
}

// A genuine, complete prefix of the real search: every branch down to
// `levels` plies (root counts as one), no more, no less -- ordinary
// recursion, so it visits nodes in the same depth-first order minimax
// itself does. `justMoved` is which player's mark produced this node
// (root's is 'X', since X's real move produced the board it starts from);
// `move` is which cell that mark was placed at, used later to walk out
// the principal variation by identity rather than by board content (two
// different move orders can transpose to the same board, so matching on
// content would wrongly tag unrelated nodes elsewhere in the tree). `order`
// is the DFS visit index, used to drive the reveal so the animation plays
// back the actual search order, not a reshuffled one.
function buildTree(board, justMoved, move, depth, levels, orderRef) {
  const winner = checkWinner(board);
  const node = { board, justMoved, move, order: orderRef.next++, depth, winner, children: [] };
  node.terminal = Boolean(winner) || board.every(Boolean);
  if (node.terminal || depth >= levels - 1) return node;

  const nextPlayer = justMoved === 'O' ? 'X' : 'O';
  for (const i of emptyCells(board)) {
    const trial = board.slice();
    trial[i] = nextPlayer;
    node.children.push(buildTree(trial, nextPlayer, i, depth + 1, levels, orderRef));
  }
  return node;
}

// Ring color for a real terminal node -- an actual win/draw reached within
// the drawn depth, distinct from the fill color (which says who moved).
function terminalRingColor(node) {
  if (node.winner === 'O') return '#2f9e5b'; // O wins here -- good for O
  if (node.winner === 'X') return '#e0a72f'; // X wins here -- bad for O
  return '#8a8f98'; // drawn out
}

// The single best next move from `board` for `player`, uncounted --
// separate from fullSearch's counted minimax so tracing the rest of the
// best line for display never inflates the honest node count shown to
// the user, which is specifically the cost of the one real decision.
function bestMove(board, player) {
  const empties = emptyCells(board);
  let bestValue = player === 'O' ? -Infinity : Infinity;
  let bestIndex = empties[0];
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = player;
    const value = minimax(trial, player === 'O' ? 'X' : 'O', { count: 0 });
    const better = player === 'O' ? value > bestValue : value < bestValue;
    if (better) {
      bestValue = value;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// The moves of genuinely best play from `board` (O to move), up to `plies`
// deep: each side's actual best move in turn, continuing past the drawn
// tree's depth if needed to reach a real answer, since a node that's
// merely "where we stopped drawing" doesn't have a true value on its own.
// A sequence of cell indices, not board states -- see markPV for why.
function principalVariation(board, plies) {
  const moves = [];
  let current = board;
  let mover = 'O';
  for (let p = 0; p < plies; p++) {
    if (checkWinner(current) || current.every(Boolean)) break;
    const idx = bestMove(current, mover);
    moves.push(idx);
    current = current.slice();
    current[idx] = mover;
    mover = mover === 'O' ? 'X' : 'O';
  }
  return moves;
}

// Tags the one true PV node at each depth with onPV = true, by walking the
// tree's actual parent/child links following `moves` -- not by matching
// board content, since two different move orders can transpose to the
// same board, and a content match would wrongly tag unrelated nodes that
// just happen to land on an identical-looking board elsewhere in the tree.
function markPV(tree, moves) {
  let node = tree;
  for (const move of moves) {
    node = node.children.find((child) => child.move === move);
    if (!node) return;
    node.onPV = true;
  }
}

const PV_COLOR = '#2f9e5b';

function renderTree(vizEl, treeData, ms) {
  const width = 860;
  const height = 380;
  const svg = d3
    .select(vizEl)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block')
    .style('margin', '0 auto');

  const root = d3.hierarchy(treeData);
  d3.tree().size([width - 30, height - 30])(root);

  const g = svg.append('g').attr('transform', 'translate(15,15)');

  // Delay is driven by each node's own DFS visit order (recorded while
  // building the tree), not by draw-selection index -- the reveal plays
  // back the real search's traversal order, one full path at a time.
  const total = root.descendants().length;
  const perNode = ms / total;
  const revealDuration = Math.min(80, Math.max(20, perNode * 3));

  g.selectAll('path')
    .data(root.links())
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', (d) => (d.target.data.onPV ? PV_COLOR : '#c7ccd2'))
    .attr('stroke-width', (d) => (d.target.data.onPV ? 2.5 : 1))
    .attr('d', d3.linkVertical().x((d) => d.x).y((d) => d.y))
    .attr('opacity', 0)
    .transition()
    .delay((d) => d.target.data.order * perNode)
    .duration(revealDuration)
    .attr('opacity', 1);

  g.selectAll('circle')
    .data(root.descendants())
    .enter()
    .append('circle')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', (d) => (d.data.onPV ? Math.max(4, 6 - d.data.depth * 1.3) : Math.max(1, 6 - d.data.depth * 1.3)))
    .attr('fill', (d) => (d.data.justMoved === 'X' ? '#2f6fd1' : '#d1473f'))
    .attr('stroke', (d) => (d.data.onPV ? PV_COLOR : d.data.terminal ? terminalRingColor(d.data) : 'none'))
    .attr('stroke-width', (d) => (d.data.onPV ? 2.5 : d.data.terminal ? 1.5 : 0))
    .attr('opacity', 0)
    .transition()
    .delay((d) => d.data.order * perNode)
    .duration(revealDuration)
    .attr('opacity', 1);
}

function animateCounter(el, target, ms) {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = `${Math.round(t * target).toLocaleString()} positions searched`;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

run(document.querySelector('#app'), async (board, empties, cellEls, vizEl) => {
  const { move, nodeCount } = fullSearch(board, empties);

  const tree = buildTree(board, 'X', null, 0, TREE_LEVELS, { next: 0 });
  markPV(tree, principalVariation(board, TREE_LEVELS - 1));
  renderTree(vizEl, tree, GROW_MS);

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
}, { vizMinHeight: 420 }); // room for the 380px tree + counter, reserved up
// front so the board doesn't jump down into that space once it first draws
