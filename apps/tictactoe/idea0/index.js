/*
 * apps/tictactoe/idea0/index.js
 *
 * Dumbest possible O: any legal move, chosen at random.
 */
(function () {
  TicTacToe.run(document.querySelector('#app'), (board, empties) => {
    return empties[Math.floor(Math.random() * empties.length)];
  });
})();
