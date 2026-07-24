/*
 * apps/tictactoe/idea0/index.js
 *
 * Dumbest possible O: any legal move, chosen at random.
 */
import { run } from '../../../lib/tictactoe.js';

run(document.querySelector('#app'), (board, empties) => {
  return empties[Math.floor(Math.random() * empties.length)];
});
