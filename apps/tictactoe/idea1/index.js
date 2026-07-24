/*
 * apps/tictactoe/idea1/index.js
 *
 * A little less dumb: take an immediate win if one exists, otherwise any
 * legal move at random. No lookahead on X's reply -- it'll still walk
 * straight into a forced loss if one is set up.
 */
(function () {
  TicTacToe.run(document.querySelector('#app'), (board, empties) => {
    for (const i of empties) {
      const trial = board.slice();
      trial[i] = 'O';
      if (TicTacToe.checkWinner(trial) === 'O') return i;
    }
    return empties[Math.floor(Math.random() * empties.length)];
  });
})();
