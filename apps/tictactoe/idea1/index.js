/*
 * apps/tictactoe/idea1/index.js
 *
 * A little less dumb: take an immediate win if one exists, otherwise any
 * legal move at random. No lookahead on X's reply -- it'll still walk
 * straight into a forced loss if one is set up.
 *
 * "Thinking" shows the actual check: each open square in top-left ->
 * bottom-right order gets "win?" for a beat while it's evaluated; if it's
 * a winning move, "win?" becomes "O" and that's the move. If the scan
 * comes up empty, falls back to shuffleFlash before picking at random --
 * same as idea0, since there's nothing more specific left to show.
 */
import { run, checkWinner, sleep, shuffleFlash } from '../../../lib/tictactoe.js';

const CHECK_MS = 400;

run(document.querySelector('#app'), async (board, empties, cellEls) => {
  for (const i of empties) {
    cellEls[i].style.fontSize = '20px';
    cellEls[i].textContent = 'win?';
    await sleep(CHECK_MS);

    const trial = board.slice();
    trial[i] = 'O';
    const isWin = checkWinner(trial) === 'O';

    cellEls[i].style.fontSize = '48px';
    cellEls[i].textContent = isWin ? 'O' : '';
    if (isWin) return i;
  }

  await shuffleFlash(empties, cellEls);
  return empties[Math.floor(Math.random() * empties.length)];
});
