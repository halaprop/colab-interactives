/*
 * apps/tictactoe/idea2/index.js
 *
 * A bit better still: take an immediate win if one exists; otherwise
 * block X's immediate winning threat if it has one; otherwise any legal
 * move at random. Still no deeper lookahead -- a fork (X threatening two
 * lines at once) only gets one of them blocked, not both.
 *
 * "Thinking" shows both checks as they happen: a first scan for O's own
 * win ("win?" -> "O"), and if that comes up empty, a second scan for
 * X's threat to block ("block?" -> "O"). Falls back to shuffleFlash if
 * neither pass finds anything.
 */
import { run, checkWinner, sleep, shuffleFlash } from '../../../lib/tictactoe.js';

const CHECK_MS = 400;

// Scans empties in order, showing `label` on each while `wouldWin(i)` is
// checked; on a hit, flips that cell to 'O' and returns its index. Clears
// back to '' and moves on otherwise. Returns null if nothing hits.
async function scan(empties, cellEls, label, fontSize, wouldWin) {
  for (const i of empties) {
    cellEls[i].style.fontSize = fontSize;
    cellEls[i].textContent = label;
    await sleep(CHECK_MS);

    const found = wouldWin(i);

    cellEls[i].style.fontSize = '48px';
    cellEls[i].textContent = found ? 'O' : '';
    if (found) return i;
  }
  return null;
}

run(document.querySelector('#app'), async (board, empties, cellEls) => {
  const ownWin = await scan(empties, cellEls, 'win?', '20px', (i) => {
    const trial = board.slice();
    trial[i] = 'O';
    return checkWinner(trial) === 'O';
  });
  if (ownWin !== null) return ownWin;

  const block = await scan(empties, cellEls, 'block?', '16px', (i) => {
    const trial = board.slice();
    trial[i] = 'X';
    return checkWinner(trial) === 'X';
  });
  if (block !== null) return block;

  await shuffleFlash(empties, cellEls);
  return empties[Math.floor(Math.random() * empties.length)];
});
