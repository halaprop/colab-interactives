/*
 * lib/tictactoe.js
 *
 * Shared board/UI/rules for the tictactoe idea series (apps/tictactoe/idea*).
 * Each idea supplies a chooseMove(board, empties, cellEls, vizEl) strategy
 * for O -- this owns the grid, click handling, and win/draw detection, but
 * not how "thinking" looks, since that's tied to each idea's own decision
 * process (idea0 shuffles and flashes candidates, idea1 sequentially checks
 * each for a win). chooseMove gets the real cellEls to animate directly,
 * vizEl as an empty container for anything bigger than a cell (a search
 * tree, a counter -- ideas that don't need it just ignore it), and sleep()
 * below for timing. May be async; whatever it leaves on the cells is
 * overwritten by the next render() once it resolves, but vizEl's content
 * persists until the next move (cleared right before the next chooseMove
 * call, and on New Game).
 *
 * renderTree/markPV/terminalRingColor/animateCounter (below) are the shared
 * half of the search-tree ideas (idea5, idea6, ...): drawing a tree, tagging
 * its real best-play path, and animating an honest node counter. What
 * actually builds each idea's tree -- and how much of it there is to build
 * -- is idea-specific (idea5 draws a depth-capped illustrative slice since
 * its real search is too big; idea6's pruned search is small enough to draw
 * in full), so that part stays in each idea's own file.
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

export function emptyCells(board) {
  return board.reduce((acc, v, i) => (v ? acc : (acc.push(i), acc)), []);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Flashes cells in shuffled order, twice around -- pure "no real signal"
// filler for whenever an idea has nothing more specific to show. Used as
// idea0's whole strategy, and as idea1's fallback once its win-check scan
// comes up empty.
export async function shuffleFlash(empties, cellEls) {
  const order = shuffled(empties);
  for (let loop = 0; loop < 2; loop++) {
    for (const i of order) {
      cellEls[i].style.background = '#ffe08a';
      await sleep(200);
      cellEls[i].style.background = '#fff';
    }
  }
}

// Ring color for a real terminal tree node -- an actual win/draw, distinct
// from the fill color (which says who moved).
export function terminalRingColor(node) {
  if (node.winner === 'O') return '#2f9e5b'; // O wins here -- good for O
  if (node.winner === 'X') return '#e0a72f'; // X wins here -- bad for O
  return '#8a8f98'; // drawn out
}

// Depth-limited alpha-beta search, building the real tree as it goes (same
// as idea6, generalized): stops at a real terminal state as always, or --
// new here -- at `maxDepth`, where `evaluate(board)` supplies a guessed
// value instead of a computed one. maxDepth=Infinity (evaluate never gets
// called, since depth can never reach it) is exactly idea6's full search;
// a finite maxDepth plus a real evaluate() is idea7 and beyond. alpha/beta
// are the bounds inherited from ancestors, same pruning rule as idea6: the
// moment they cross, remaining siblings are already proven irrelevant and
// never get built or visited.
//
// IMPORTANT for any evaluate(): it must return a value strictly between
// -1 and 1 (e.g. Math.tanh(rawScore / someScale)), never reaching or
// crossing those bounds. Real terminals are exactly -1/0/1, and this
// function compares guessed values against real ones in the same
// min/max logic -- an unbounded evaluate() can return something more
// extreme than a real loss/win, which then wrongly outranks/underranks
// an actual certain outcome (found exactly this bug once: an unblocked
// two-in-a-row is a real, exact loss at -1, but a raw, unsquashed
// evaluate() scored the correct blocking move's own guessed continuation
// even lower, so the search preferred walking into the real loss).
export function alphaBetaSearch(board, justMoved, move, alpha, beta, depth, maxDepth, orderRef, evaluate) {
  const winner = checkWinner(board);
  const node = { board, justMoved, move, order: orderRef.next++, depth, winner, children: [] };
  node.terminal = Boolean(winner) || board.every(Boolean);

  if (node.terminal) {
    node.value = winner === 'O' ? 1 : winner === 'X' ? -1 : 0;
    return node;
  }

  if (depth >= maxDepth) {
    node.cutoff = true; // reached the depth limit without a real ending -- guessed, not known
    node.value = evaluate(board);
    return node;
  }

  const mover = justMoved === 'O' ? 'X' : 'O';
  let best = mover === 'O' ? -Infinity : Infinity;
  for (const i of emptyCells(board)) {
    const trial = board.slice();
    trial[i] = mover;
    const child = alphaBetaSearch(trial, mover, i, alpha, beta, depth + 1, maxDepth, orderRef, evaluate);
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

// The real root decision: O's actual candidate moves, each scored via
// alphaBetaSearch above, sharing one running alpha across candidates, all
// assembled into one tree rooted at the real current board. nodeCount is
// every node actually built -- the honest cost of this exact decision.
export function alphaBetaRootSearch(board, empties, maxDepth, evaluate) {
  const orderRef = { next: 0 };
  const tree = { board, justMoved: 'X', move: null, order: orderRef.next++, depth: 0, winner: null, terminal: false, children: [] };

  let bestScore = -Infinity;
  let bestMove = empties[0];
  let alpha = -Infinity;
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = 'O';
    const child = alphaBetaSearch(trial, 'O', i, alpha, Infinity, 1, maxDepth, orderRef, evaluate);
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

// Plain depth-limited minimax -- no alpha/beta, no pruning. Every node
// down to maxDepth actually gets built and visited; whatever reduction in
// search shows up here comes entirely from the depth cap itself, not from
// skipping anything early (that's alphaBetaSearch's trick, kept separate
// so the two techniques -- cap the depth vs. prove a branch irrelevant --
// each show up in isolation rather than stacked). Same evaluate()
// contract as alphaBetaSearch above: must return strictly within (-1, 1).
export function boundedSearch(board, justMoved, move, depth, maxDepth, orderRef, evaluate) {
  const winner = checkWinner(board);
  const node = { board, justMoved, move, order: orderRef.next++, depth, winner, children: [] };
  node.terminal = Boolean(winner) || board.every(Boolean);

  if (node.terminal) {
    node.value = winner === 'O' ? 1 : winner === 'X' ? -1 : 0;
    return node;
  }

  if (depth >= maxDepth) {
    node.cutoff = true; // reached the depth limit without a real ending -- guessed, not known
    node.value = evaluate(board);
    return node;
  }

  const mover = justMoved === 'O' ? 'X' : 'O';
  let best = mover === 'O' ? -Infinity : Infinity;
  for (const i of emptyCells(board)) {
    const trial = board.slice();
    trial[i] = mover;
    const child = boundedSearch(trial, mover, i, depth + 1, maxDepth, orderRef, evaluate);
    node.children.push(child);
    best = mover === 'O' ? Math.max(best, child.value) : Math.min(best, child.value);
  }
  node.value = best;
  return node;
}

// The real root decision for boundedSearch: every candidate move, scored
// with no pruning, assembled into one tree. nodeCount is every node
// actually built -- with nothing skipped, that's every node the depth cap
// allows, the honest cost of shrinking the search this way instead of
// alpha-beta's way.
export function boundedRootSearch(board, empties, maxDepth, evaluate) {
  const orderRef = { next: 0 };
  const tree = { board, justMoved: 'X', move: null, order: orderRef.next++, depth: 0, winner: null, terminal: false, children: [] };

  let bestScore = -Infinity;
  let bestMove = empties[0];
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = 'O';
    const child = boundedSearch(trial, 'O', i, 1, maxDepth, orderRef, evaluate);
    tree.children.push(child);
    if (child.value > bestScore) {
      bestScore = child.value;
      bestMove = i;
    }
  }
  tree.value = bestScore;
  return { move: bestMove, nodeCount: orderRef.next, tree };
}

// The single best next move from `board` for `player`, via the same
// depth-limited search -- uncounted and tree-free, for tracing a best-play
// line without touching the honest node count or the drawn tree.
export function alphaBetaBestMove(board, player, maxDepth, evaluate) {
  const empties = emptyCells(board);
  let bestValue = player === 'O' ? -Infinity : Infinity;
  let bestIndex = empties[0];
  let alpha = -Infinity;
  let beta = Infinity;
  for (const i of empties) {
    const trial = board.slice();
    trial[i] = player;
    const child = alphaBetaSearch(trial, player, i, alpha, beta, 0, maxDepth, { next: 0 }, evaluate);
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
// to a real ending -- always full-depth/true-best (not whatever depth
// limit an idea's own search uses), since this is specifically for
// showing the objectively correct line, e.g. as a comparison against a
// shallower idea's own (possibly different) choice.
export function principalVariation(board) {
  const moves = [];
  let current = board;
  let mover = 'O';
  while (!checkWinner(current) && !current.every(Boolean)) {
    const idx = alphaBetaBestMove(current, mover, Infinity, null);
    moves.push(idx);
    current = current.slice();
    current[idx] = mover;
    mover = mover === 'O' ? 'X' : 'O';
  }
  return moves;
}

// Tags the one true principal-variation node at each depth with onPV =
// true, by walking the tree's actual parent/child links following `moves`
// (a sequence of cell indices) -- not by matching board content, since two
// different move orders can transpose to the same board, and a content
// match would wrongly tag unrelated nodes that just happen to land on an
// identical-looking board elsewhere in the tree. Requires every tree node
// to carry a `move` field: which cell index produced it.
export function markPV(tree, moves) {
  let node = tree;
  for (const move of moves) {
    node = node.children.find((child) => child.move === move);
    if (!node) return;
    node.onPV = true;
  }
}

const PV_COLOR = '#2f9e5b';
const CHOSEN_COLOR = '#7c5cbf';
const GREY_FILL = '#dde1e6';
const GREY_EDGE = '#e4e7eb';
const EDGE_COLOR = '#8b93a1'; // darker + (see below) thicker than GREY_EDGE, so the
// searched part of a tree (idea7+'s grey/real split) reads as clearly distinct from
// the muted, un-searched backdrop rather than two shades of the same light grey
const HEURISTIC_CLAMP = 1; // evaluate() must stay strictly within (-1, 1) -- see alphaBetaSearch

// Maps a heuristic score to the same red(bad for O)/yellow(neutral)/
// green(good for O) scale used nowhere else in this file, so a guessed
// value is visually never confused with the mover-color fill real
// (non-cutoff) nodes get.
function heuristicColor(value) {
  const t = Math.max(0, Math.min(1, (value + HEURISTIC_CLAMP) / (2 * HEURISTIC_CLAMP)));
  return d3.interpolateRdYlGn(t);
}

// Draws `treeData` (a {board, justMoved, move, order, depth, winner,
// terminal, onPV, onChosen, cutoff, value, children} tree -- see idea5/
// idea6/idea7 for how each builds one) via d3.hierarchy()/d3.tree(),
// revealed over `ms` in each node's own `order` (its real search-visit
// index, not draw order) so the animation plays back the actual
// traversal, one full path before its next sibling.
//
// evalDepth (default Infinity, i.e. no effect) is for the search-limited
// ideas (idea7+): nodes/edges deeper than it render muted grey -- real
// nodes from a real search, just beyond what that idea's own shallow
// search actually looks at -- and a non-terminal node exactly at that
// depth (marked `cutoff` by alphaBetaSearch) is filled by its guessed
// `value` via heuristicColor instead of the usual mover color, so a guess
// is never visually mistaken for a certainty.
export function renderTree(vizEl, treeData, ms, { width = 860, height = 380, evalDepth = Infinity } = {}) {
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

  const total = root.descendants().length;
  const perNode = ms / total;
  const revealDuration = Math.min(80, Math.max(20, perNode * 3));
  const beyond = (d) => d.depth > evalDepth;
  const finalOpacity = (d) => (beyond(d) && !d.data.onPV ? 0.35 : 1);

  g.selectAll('path')
    .data(root.links())
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', (d) => (d.target.data.onPV ? PV_COLOR : beyond(d.target) ? GREY_EDGE : EDGE_COLOR))
    .attr('stroke-width', (d) => (d.target.data.onPV ? 2.5 : beyond(d.target) ? 1 : 2))
    .attr('d', d3.linkVertical().x((d) => d.x).y((d) => d.y))
    .attr('opacity', 0)
    .transition()
    .delay((d) => d.target.data.order * perNode)
    .duration(revealDuration)
    .attr('opacity', (d) => finalOpacity(d.target));

  g.selectAll('circle')
    .data(root.descendants())
    .enter()
    .append('circle')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', (d) => (d.data.onPV || d.data.onChosen ? Math.max(4, 6 - d.data.depth * 1.3) : Math.max(1, 6 - d.data.depth * 1.3)))
    .attr('fill', (d) => {
      if (beyond(d)) return GREY_FILL;
      if (d.data.cutoff) return heuristicColor(d.data.value);
      return d.data.justMoved === 'X' ? '#2f6fd1' : '#d1473f';
    })
    .attr('stroke', (d) => {
      if (d.data.onPV) return PV_COLOR;
      if (d.data.onChosen) return CHOSEN_COLOR;
      if (d.data.terminal) return terminalRingColor(d.data);
      return 'none';
    })
    .attr('stroke-width', (d) => (d.data.onPV || d.data.onChosen ? 2.5 : d.data.terminal ? 1.5 : 0))
    .attr('opacity', 0)
    .transition()
    .delay((d) => d.data.order * perNode)
    .duration(revealDuration)
    .attr('opacity', (d) => finalOpacity(d));
}

// Animates text in `el` from 0 up to `target` over `ms`, landing exactly on
// the real number -- used for the "N positions searched" honest counter.
// `suffix` replaces "positions searched" for ideas that want to append a
// comparison (e.g. "...\n(no pruning needs 549,946)"). A literal \n puts
// the comparison figure on its own line -- requires the caller's `el` to
// have white-space: pre-line set, since a bare newline in textContent is
// otherwise collapsed.
export function animateCounter(el, target, ms, suffix = 'positions searched') {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = `${Math.round(t * target).toLocaleString()} ${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

// chooseMove(board, empties, cellEls, vizEl) -> index | Promise<index>;
// called after X's move, with O to play. opts.vizMinHeight reserves vizEl's
// space up front (in px) for ideas that draw something sizeable into it, so
// the board doesn't jump when that content first appears -- ideas that
// don't pass it get vizEl's old zero-height behavior, unchanged. opts.cellSize
// (default 100, in px) scales the board and its mark size together, for
// ideas that need the board smaller to leave more room for what's below it.
// opts.description adds center-aligned text to the left of the status/board
// block ('\n' forces a line break) -- a fixed-width spacer mirrors it on the
// right, so that block stays centered on the page rather than shifting
// right. Sits beside just status+board, not vizEl/the button below, so a
// big opts.vizMinHeight doesn't drag the text's vertical center down into
// empty reserved space.
export function run(root, chooseMove, opts = {}) {
  const cellSize = opts.cellSize || 100;
  const descriptionWidth = 220;
  // Leave root's own height alone -- the shim/harness already gives #app
  // a definite height; overwriting it here would depend on an ancestor
  // (Colab's iframe body) with no guaranteed definite height, collapsing
  // the whole chain (see apps/perceptron/index.js for the full story).
  Object.assign(root.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    gap: '20px',
  });

  const topRow = document.createElement('div');
  Object.assign(topRow.style, {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px',
  });
  root.appendChild(topRow);

  if (opts.description) {
    const descriptionEl = document.createElement('div');
    descriptionEl.textContent = opts.description;
    Object.assign(descriptionEl.style, {
      width: `${descriptionWidth}px`,
      fontSize: '20px',
      fontWeight: '600',
      lineHeight: '1.4',
      color: '#2b2f36',
      textAlign: 'center',
      whiteSpace: 'pre-line',
    });
    topRow.appendChild(descriptionEl);
  }

  const boardBlock = document.createElement('div');
  Object.assign(boardBlock.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  });
  topRow.appendChild(boardBlock);

  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2b2f36',
  });
  boardBlock.appendChild(statusEl);

  const boardEl = document.createElement('div');
  Object.assign(boardEl.style, {
    display: 'grid',
    gridTemplateColumns: `repeat(3, ${cellSize}px)`,
    gridTemplateRows: `repeat(3, ${cellSize}px)`,
    gap: '6px',
    background: '#2b2f36',
    padding: '6px',
    borderRadius: '8px',
  });
  boardBlock.appendChild(boardEl);

  if (opts.description) {
    const spacerEl = document.createElement('div');
    spacerEl.style.width = `${descriptionWidth}px`;
    topRow.appendChild(spacerEl);
  }

  const vizEl = document.createElement('div');
  Object.assign(vizEl.style, { width: '100%', maxWidth: '900px' });
  if (opts.vizMinHeight) vizEl.style.minHeight = `${opts.vizMinHeight}px`;
  root.appendChild(vizEl);

  const newGameButton = document.createElement('button');
  newGameButton.textContent = 'New Game';
  Object.assign(newGameButton.style, {
    fontSize: '16px',
    padding: '8px 20px',
    borderRadius: '6px',
    border: '1px solid #2b2f36',
    background: '#fff',
    cursor: 'pointer',
  });
  root.appendChild(newGameButton);

  const state = { board: Array(9).fill(null), status: 'Your move', locked: false, over: false };

  const cellEls = Array.from({ length: 9 }, (_, i) => {
    const cell = document.createElement('div');
    Object.assign(cell.style, {
      width: `${cellSize}px`,
      height: `${cellSize}px`,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${Math.round(cellSize * 0.48)}px`,
      fontWeight: '700',
      userSelect: 'none',
    });
    cell.addEventListener('click', () => handleCellClick(i));
    boardEl.appendChild(cell);
    return cell;
  });

  function render() {
    statusEl.textContent = state.status;
    state.board.forEach((mark, i) => {
      const cell = cellEls[i];
      cell.textContent = mark || '';
      cell.style.color = mark === 'X' ? '#2f6fd1' : '#d1473f';
      cell.style.cursor = !state.over && !state.locked && !mark ? 'pointer' : 'default';
    });
  }

  function finish(winner) {
    state.over = true;
    state.locked = true;
    state.status = winner ? `${winner} wins!` : "It's a draw!";
    render();
  }

  async function handleCellClick(i) {
    if (state.over || state.locked || state.board[i]) return;

    state.board[i] = 'X';
    if (checkWinner(state.board)) return finish('X');
    if (state.board.every(Boolean)) return finish(null);

    state.locked = true;
    state.status = 'Thinking…';
    render();

    vizEl.innerHTML = '';
    const empties = emptyCells(state.board);
    const choice = await chooseMove(state.board, empties, cellEls, vizEl);
    state.board[choice] = 'O';

    if (checkWinner(state.board)) return finish('O');
    if (state.board.every(Boolean)) return finish(null);

    state.locked = false;
    state.status = 'Your move';
    render();
  }

  newGameButton.addEventListener('click', () => {
    state.board = Array(9).fill(null);
    state.status = 'Your move';
    state.locked = false;
    state.over = false;
    vizEl.innerHTML = '';
    render();
  });

  render();
}
