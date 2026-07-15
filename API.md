# Diagram API

Reference for `lib/diagram.js`. For complete working examples, see
`apps/beach.js` (live construction, `editable()`) and `apps/perceptron.js`
(reactive, `state`/`onChange`, multiple Diagrams sharing state).

Every writable prop below can be changed after creation too, two ways:
re-call the factory with the same `id` (`g.node({id:'a', x:5})` again —
upserts), or mutate the returned object directly and call `g.render()`
(the pattern every `onChange` handler and drag interaction actually uses
internally). Props listed as **Read-only** under a class are the
exception — don't pass them as opts or assign them directly.

Concrete classes (the ones you actually create) come first: Diagram,
Plane, Node, Edge, Line. Connector, the abstract base Edge and Line
share, comes after them, since you never create one directly.

## Contents

- [Diagram](#diagram)
- [Plane](#plane)
- [Node](#node)
- [Edge](#edge)
- [Line](#line)
- [Connector](#connector-base-for-edge-line) (base for Edge, Line)
- [Controls](#controls)
- [Reactivity](#reactivity)

---

### Diagram
Inherits from: —
Owns the SVG, the singleton Plane, and the node/edge/line registries for
one coordinate space.

Example:

    const g = Diagram('#canvas');
    g.plane({ xDomain: [-10, 10], yDomain: [-10, 10] });

Example: two Diagrams sharing one state object (see Reactivity)

    const state = {};
    const network = Diagram('#network', { state });
    const activation = Diagram('#activation', { state });

- `Diagram(container, opts)` — `container`: selector string or element.
  `opts.state`: shared state object, default `{}`.
- `.plane(opts)` → Plane. Singleton; a second call updates the existing one.
- `.node(opts)` → Node.
- `.edge(opts)` → Edge.
- `.line(opts)` → Line.
- `.onChange(fn)` — graph-level reactive hook; see **Reactivity**.
- `.render()` — re-render everything from the current state/model.
  Called automatically by every method above; call it yourself after
  mutating a returned object directly, or after writing into `state`.
- `.editable(opts)` — turns on the live-authoring toolbar (Select/Move,
  +Node, +Line, +Edge). `opts.describe(x, y)`: optional hook that
  auto-labels a node dropped via +Node.

---

### Plane
Inherits from: —
The coordinate space. Anchored at pixel (0,0), fills the diagram.
Singleton per Diagram.

Example:

    g.plane({
      xDomain: [-10, 10],
      yDomain: [-10, 10],
      xLabel: 'how nice is the weather',
      yLabel: 'how busy I am',
      grid: true,
    });

Example: axis-less, for a pure node/edge network

    g.plane({ xDomain: [-8, 8], yDomain: [-8, 8], axes: false });

- `xDomain`, `yDomain` — `[min, max]`. Optional; without one, that axis
  is 1:1 pixels. y always grows up regardless.
- `xLabel`, `yLabel` — string, optional.
- `grid` — boolean, default `false`.
- `axes` — boolean, default `true`. `false` hides the axis lines/ticks
  entirely (labels still render if set).
- `bands` — array of tinted rectangles: `{x0, x1, fill, opacity}`
  (vertical, full height) or `{y0, y1, fill, opacity}` (horizontal, full
  width). `opacity` default `0.15`.

Note: axes always cross at data (0,0). To reposition where that lands,
select the Plane in `editable()` mode and drag the origin handle (it
pans the domain) rather than setting a prop.

---

### Node
Inherits from: —
A thing at an (x,y) in plane coords.

Example:

    g.node({ x: -5, y: 3, text: 'sunny', cls: 'go', sizeKey: 'l' })

Example: two nodes and the edge between them

    g.node({ id: 'a', x: -5, y: 0 });
    g.node({ id: 'b', x: 5, y: 0 });
    g.edge({ from: 'a', to: 'b', arrow: true });

- `x`, `y` — number, default `0`.
- `text` — string, default `''`.
- `shape` — `'circle' | 'rect' | 'none'`, default `'circle'`.
- `cls` — `'neutral' | 'go' | 'nogo'`, optional. Hand-authored color
  convenience; the library never assigns it (see spec.md's "Restraint").
- `sizeKey`, `fontKey` — `'s' | 'm' | 'l'`, default `'m'`.
- `textPlacement` — `'above' | 'middle' | 'below'`, default `'below'`.
- `fill`, `stroke`, `strokeWidth`, `textFill` — explicit color/width
  overrides. Optional; fall back to `cls`/defaults when unset.
- `r`, `size` — explicit pixel overrides for circle radius / rect edge.
  Optional; fall back to the `sizeKey` preset when unset.
- `visible` — boolean, default `true`. `false` renders nothing.
- `onChange(s, self)` — called every render; see **Reactivity**.

Read-only:
- `id` — not enforced by the object itself, but changing it desyncs the
  node from the map key it's stored under.
- `fillColor`, `strokeColor`, `strokeWidthPx`, `textColor`, `resolvedR`,
  `resolvedSize`, `resolvedFontSize` — computed getters (derived from
  the props above), no setter. Assigning throws.

---

### Edge
Inherits from: [Connector](#connector-base-for-edge-line)
Connector between two endpoints with an optional arrowhead and curvature.

Example:

    g.edge({ from: 'a', to: 'b', arrow: true, curvature: 0.3, label: 'w=1.2' })

Example: a dangling endpoint (no source node), like a bias term

    g.edge({ from: { x: 5, y: 7 }, to: 'output', arrow: true, label: 'bias' })

- `arrow` — boolean, default `false`. Arrowhead at `to`, oriented along
  the curve's tangent.
- `curvature` — number, default `0`. `0` = straight; sign controls which
  way it bends. Draggable live via the bend handle in `editable()`.

Read-only:
- `id` — same caveat as Node.

---

### Line
Inherits from: [Connector](#connector-base-for-edge-line)
A straight connector with no arrow, optionally tinting the plane on
each side.

Example:

    g.line({ from: 'a', to: 'b', leftFill: '#2f9e5b', rightFill: '#d1473f' })

Example: a free-floating separating line (both endpoints are points, not nodes)

    g.line({ from: { x: -10, y: -6 }, to: { x: 10, y: 4 }, leftFill: '#2f9e5b' })

- `extent` — `'segment' | 'infinite'`, default `'segment'`. `'infinite'`
  draws past the endpoints to the plane's edges (clipped to its bounding
  box); the endpoints themselves (and their drag handles) don't move.
- `leftFill`, `rightFill` — color string, optional. Translucent tint of
  the plane on each side of the line's infinite extension (not just the
  visible segment), relative to the from->to direction. Swapping
  `from`/`to` swaps the sides.

Read-only:
- `id` — same caveat as Node.

---

### Connector (base for Edge, Line)
Inherits from: —
Abstract base for Edge and Line; not created directly (there's no
`g.connector(...)`).

- `id` — string. Auto-generated if omitted (e.g. `e1`, `l2` — edges and
  lines share one counter, so numbers can skip between the two).
- `from`, `to` — node id (string) or `{x,y}` point. Required. A node id
  resolves to that node's live position and trims to its shape boundary;
  a point is literal and untrimmed.
- `label` — string, optional. Renders at the midpoint with a white halo
  for legibility over crossing lines.
- `stroke` — string, default `'#2b2f36'`.
- `strokeWidth` — number, default `3`.
- `visible` — boolean, default `true`. `false` renders nothing.
- `onChange(s, self)` — called every render; see **Reactivity**.

---

### Controls
Inherits from: —
A plain-HTML control panel (sliders, buttons) that writes into a shared
`state` object. Not tied to a Plane/SVG — sliders are DOM, not marks on
a coordinate space — so it can drive several Diagrams at once.

Example:

    const state = {};
    const g = Diagram('#canvas', { state });
    const controls = Controls('#controls', state);
    controls.slider({ label: 'x1', min: -2, max: 2, step: 0.1, bind: 'x1', onInput: () => g.render() });

- `Controls(container, state)` — `state` is typically the same object
  one or more Diagrams were constructed with.
- `.slider(opts)`:
  - `label` — string.
  - `min`, `max` — number, default `0`/`1`.
  - `step` — number, default `(max - min) / 100`.
  - `value` — initial value; falls back to `state[bind]` if already set,
    else `min`.
  - `bind` — state key to write into on input.
  - `onInput(value, state)` — optional, called after `state[bind]` updates.
- `.button(opts)`:
  - `label` — string, default `'Button'`.
  - `onClick(state)` — called on click.

Note: Controls never calls `.render()` on anything itself — call
whichever Diagrams need to react from `onInput`/`onClick`.

---

### Reactivity

- `state` — a plain object, owned by whichever Diagram created it (or
  shared, if passed via `{state}` at construction — see **Diagram**).
- `g.onChange(fn)` — graph-level. `fn(s)` runs first, before any
  element's own `onChange`, on every render including the first. Use it
  for shared/derived computation; stash results back onto `s` for
  elements to read.
- Element-level `onChange` (on any Node/Edge/Line) — `(s, self) => {}`,
  called as `.call(self, s, self)` so both `this` and the second
  argument are the element's own mutable model object. The
  `(s, self) =>` form is canonical since it's arrow-safe: `this` only
  works in a non-arrow `function`, since arrow functions can't be
  rebound. `function (s, self) { this.x = ... }` and
  `(s, self) => { self.x = ... }` both work; `(s) => { this.x = ... }`
  silently uses the wrong `this`.
- Nothing re-renders automatically when `state` changes. After mutating
  `state` (typically from a Controls slider/button), call `.render()`
  on every Diagram that should react.

Example: a derived value computed once, read by two elements

    network.onChange((s) => {
      s.sum = s.x1 * s.w1 + s.x2 * s.w2 + s.bias;
    });
    network.node({
      id: 'out',
      onChange: (s, self) => { self.cls = s.sum > 0 ? 'go' : 'nogo'; },
    });
