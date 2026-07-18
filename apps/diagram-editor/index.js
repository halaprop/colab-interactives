/*
 * apps/diagram-editor/index.js
 *
 * Generic live diagram-construction demo: starts as an empty labeled
 * plane, then g.editable(...) is the whole authoring toolbar (+Node,
 * +Line, +Edge, drag to move/relabel, "Copy code" to export the model).
 *
 * No pre-authored nodes/line here on purpose -- g.editable(...) is the
 * whole construction demo.
 */
(function () {
  const g = Diagram('#app');

  g.plane({
    xDomain: [-10, 10],
    yDomain: [-10, 10],
    xLabel: 'x',
    yLabel: 'y',
    grid: true,
  });

  g.editable();
})();
