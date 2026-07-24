/*
 * apps/tictactoe/idea0/index.js
 *
 * Dumbest possible O: any legal move, chosen at random. "Thinking" is
 * shuffleFlash -- pure theater, unrelated to the (nonexistent) decision
 * process.
 */
import { run, shuffleFlash } from '../../../lib/tictactoe.js';

run(document.querySelector('#app'), async (board, empties, cellEls) => {
  await shuffleFlash(empties, cellEls);
  return empties[Math.floor(Math.random() * empties.length)];
});
