/*
 * lib/tictactoe.js
 *
 * Shared board/UI/rules for the tictactoe idea series (apps/tictactoe/idea*).
 * Each idea supplies only a chooseMove(board) strategy for O; this owns the
 * grid, click handling, the "thinking" delay, and win/draw detection.
 */
(function (global) {
  'use strict';

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6], // diagonals
  ];

  function checkWinner(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  function emptyCells(board) {
    return board.reduce((acc, v, i) => (v ? acc : (acc.push(i), acc)), []);
  }

  // chooseMove(board, emptyCells) -> index; called after X's move, with O to play.
  function run(root, chooseMove) {
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

    function handleCellClick(i) {
      if (state.over || state.locked || state.board[i]) return;

      state.board[i] = 'X';
      if (checkWinner(state.board)) return finish('X');
      if (state.board.every(Boolean)) return finish(null);

      state.locked = true;
      state.status = 'Thinking…';
      render();

      setTimeout(() => {
        state.board[chooseMove(state.board, emptyCells(state.board))] = 'O';

        if (checkWinner(state.board)) return finish('O');
        if (state.board.every(Boolean)) return finish(null);

        state.locked = false;
        state.status = 'Your move';
        render();
      }, 1000);
    }

    newGameButton.addEventListener('click', () => {
      state.board = Array(9).fill(null);
      state.status = 'Your move';
      state.locked = false;
      state.over = false;
      render();
    });

    render();
  }

  global.TicTacToe = { run, checkWinner, emptyCells };
})(window);
