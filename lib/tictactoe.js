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

const WIN_LINES = [
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

// Draws `treeData` (a {board, justMoved, move, order, depth, winner,
// terminal, onPV, children} tree -- see idea5/idea6 for how each builds
// one) via d3.hierarchy()/d3.tree(), revealed over `ms` in each node's own
// `order` (its real search-visit index, not draw order) so the animation
// plays back the actual traversal, one full path before its next sibling.
export function renderTree(vizEl, treeData, ms, { width = 860, height = 380 } = {}) {
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

// Animates text in `el` from 0 up to `target` over `ms`, landing exactly on
// the real number -- used for the "N positions searched" honest counter.
export function animateCounter(el, target, ms) {
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

// chooseMove(board, empties, cellEls, vizEl) -> index | Promise<index>;
// called after X's move, with O to play. opts.vizMinHeight reserves vizEl's
// space up front (in px) for ideas that draw something sizeable into it, so
// the board doesn't jump when that content first appears -- ideas that
// don't pass it get vizEl's old zero-height behavior, unchanged.
export function run(root, chooseMove, opts = {}) {
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

  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2b2f36',
  });
  root.appendChild(statusEl);

  const boardEl = document.createElement('div');
  Object.assign(boardEl.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 100px)',
    gridTemplateRows: 'repeat(3, 100px)',
    gap: '6px',
    background: '#2b2f36',
    padding: '6px',
    borderRadius: '8px',
  });
  root.appendChild(boardEl);

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
      width: '100px',
      height: '100px',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '48px',
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
