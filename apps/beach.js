/*
 * apps/beach.js
 *
 * "Should I go to the beach" perceptron-construction fixture, run live:
 * starts as an empty labeled plane, then the class adds nodes with the
 * "+ Node" tool, cycles each one neutral -> go -> nogo by clicking it,
 * and draws the separating line with "+ Line" once there's a consensus.
 *
 * No pre-authored nodes/line here on purpose -- g.editable(...) is the
 * whole construction demo. (Deferred in spec.md's "edit mode" section;
 * pulled forward ahead of the state/step-control work in step 4.)
 */
(function () {
  const g = Diagram('#canvas');

  g.plane({
    xDomain: [-10, 10],
    yDomain: [-10, 10],
    xLabel: 'how nice is the weather',
    yLabel: 'how busy I am',
    grid: true,
  });

  // Per-app describe(x,y) hook (spec.md: "supplies quadrant->text labels
  // for self-labeling dropped nodes"). Lives here, not apps/shared/, until
  // a second app needs to share it.
  function describeQuadrant(x, y) {
    const weather = x >= 0 ? 'sunny' : 'gloomy';
    const busy = y >= 0 ? 'free' : 'busy';
    return `${weather}, ${busy}`;
  }

  g.editable({ describe: describeQuadrant });
})();
