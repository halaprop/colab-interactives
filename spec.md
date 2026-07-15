# Project: D3 network-diagram library + Colab delivery

Build a small D3-based library for drawing interactive network/plot diagrams,
plus a workflow that delivers them into Google Colab cells. Single public GitHub
repo. No bundler for the shipped library — it's one hand-authored file served
as-is, so what's in the repo is byte-for-byte what runs in Colab.

## Project preferences (apply throughout)

- **ES6 classes.** Prefer classes even when the case is thin — Plane, Node, Edge,
  Line are real classes, and the element passed to `onChange` as `this`/`self` is a
  genuine class instance. BUT keep the caller-facing API terse and factory-style
  (`g.node(...)`, `g.edge(...)`), NOT `new Node(...)` — classes under the hood,
  plain function calls at the authoring surface.
- **Minimal npm tooling.** A build tool for the dev harness (Vite) is fine, but keep
  the dependency footprint small and add nothing beyond what the harness genuinely
  needs. The shipped `lib/diagram.js` stays a single hand-authored file with NO build
  step — D3 is its only runtime dependency, loaded via a script tag.
- **Tasteful CSS.** Aim for a clean, restrained look in the spirit of UIkit.css —
  sensible spacing, subtle borders, good default type. The control panel (sliders,
  step buttons) and axis/labels should look intentional, not browser-default.
- **Presentation-first sizing.** These are shown on a screen to a room. Use every inch
  of the Colab output iframe — the SVG should fill the available width/height, not sit
  in a small fixed box. Default to LARGER fonts throughout (axis labels, node text,
  edge labels, panel controls) so they read from a distance. Make the diagram size
  responsive to the container rather than hard-coded small.

## Repo layout

    lib/diagram.js      # the one hosted library (jsDelivr-served, no build step)
    apps/beach.js       # first real example/fixture (caller code)
    apps/shared/        # app-specific hooks shared across an app family (stub for now)
    harness/index.html  # Vite dev server: loads D3 + lib + a chosen app, hot reload
    shim.py             # Colab shim: takes LIB ref + APP ref, builds one HTML doc
    README.md           # the two URLs + pin-vs-float versioning habit

## The four objects (the whole model)

- **plane** — the coordinate space. Anchored at pixel (0,0), fills the SVG. Optional
  `xDomain`/`yDomain` set data units (y grows UP); absent domains = 1:1 pixels, y-up.
  Never a mixed mode. Supports axis labels, optional grid, and tinted rectangular
  `bands`. Singleton per diagram. `origin:"center"` convenience for symmetric domains.
- **node** — a thing at an (x,y) in plane coords. Has: text, shape ("circle"|"rect"|"none"),
  r/size, fill, stroke, strokeWidth, textFill. `cls` is a convenience that maps to
  a color (neutral/go/nogo) — but see restraint below.
- **edge** — connector between two endpoints. Optional label, arrow (bool), curvature.
- **line** — an edge with point endpoints and no arrow. Carries optional side-fills.

## Endpoints (one overload covers all cases)

`from`/`to` accept EITHER a node id (string) OR a point `{x,y}`.
- string -> resolve to that node's live position, trim the arc to its boundary
- point  -> use the literal coordinate

This gives node->node, point->node, node->point, point->point (= a free line) in one path.

## Side-fills (on line/edge)

`leftFill`/`rightFill` tint the plane on each side of the line's INFINITE extension
clipped to the plane's bounding box (a finite segment doesn't divide the plane).
"left"/"right" are relative to the from->to direction (swapping endpoints swaps fills).
Translucent, painted behind nodes/edges. Overlapping fills just blend; no region math.

## Reactivity (the core interaction model)

- One shared `state` bag. Controls (sliders/buttons) in a side panel write into it.
- Each object may have `onChange(s, self)`. Called with `.call(self, state, self)` so
  BOTH `this` and the 2nd param `self` are the element's mutable model object.
  Canonical form is `(s, self) =>` because it's arrow-safe. `this` works only in
  non-arrow method form (arrow + `this` is impossible in JS — document this).
- A graph-level `g.onChange(s)` runs FIRST on each change, for shared/derived computation
  (stash values back into `s` for elements to read).
- `onChange` runs on the initial render too, so reactive values aren't written twice.
- Inside onChange you may set any renderable property (text, fill, label, from/to,
  `visible`, etc.). `visible:false` renders nothing — used for "object appears at step N".
- Reactive attributes update via D3's enter/update/exit so only changed attrs touch the DOM.
- Dragging a node updates its live position AND re-fires its onChange (so a node can
  self-label from its own x,y).

## Restraint — IMPORTANT, do not "help"

At this stage the library must NOT do point-vs-line classification. A node's yes/no
class is hand-authored (or set by a user action later), and a separating line is
DECORATIVE. Do not auto-color nodes based on which side of a line they're on, and do
not grade separation. That's a deliberate future lesson, not a missing feature.

## First fixture: beach.js

A perceptron-style "should I go to the beach" CONSTRUCTION demo (no linear math yet):
- plane, origin center, xDomain/yDomain symmetric (e.g. [-10,10]).
  xLabel "how nice is the weather", yLabel "how busy I am" (busy = negative/down).
- a few input nodes at various (x,y), initially neutral-colored.
- some nodes hand-set to go/nogo colors.
- one hand-placed separating `line` with go/nogo side-fills.
- Build it so it can render to a `step` (0=empty axes -> 1=neutral nodes -> 2=colored ->
  3=line appears), gated via each object's onChange reading `s.step`, with a step control.
  This exercises `visible`, side-fills, and the reactive model in one fixture.

## Colab delivery

Each Colab cell = a Python call to the shim, which assembles ONE HTML doc:
a `#canvas` div, then three script tags IN ORDER: D3 (CDN) -> lib/diagram.js -> the caller.
The generated HTML doc should size the canvas to fill the Colab output iframe (full
width, generous height) with presentation-scale fonts — not a small fixed box.
The shim must accept the caller EITHER inline (a JS string) OR as a URL (fetched app),
and must take LIB and APP as SEPARATE refs (so LIB can be pinned to a tag for a lecture
while APP floats on main during assembly). jsDelivr serves both from this repo:
`https://cdn.jsdelivr.net/gh/<user>/<repo>@<ref>/<path>`. Note: serve via jsDelivr,
NOT raw.githubusercontent.com (wrong MIME type won't execute). Support a `?t=<ts>`
cache-bust for the floating case. Put both URLs in one place in README.

## Dev harness

Vite dev server loading D3 + lib/diagram.js + a chosen apps/*.js with hot reload, so the
tight build loop (positioning, colors — hundreds of iterations) is LOCAL, never Colab.
Because local and Colab load the identical files, "looks right locally" = "looks right in
Colab" with no transform. Make switching which app loads frictionless (a `?app=beach`
query param or dropdown), so juggling several apps doesn't mean editing the harness.

## Build order

1. Repo skeleton + Vite harness rendering an empty labeled plane.
2. Library core: plane (domains, axes, labels, bands), node, then the render/update cycle.
3. edge + line + endpoint overload + side-fills.
4. State + onChange (element and graph level) + a slider and a step control.
5. beach.js fixture exercising all of the above via the step control.
6. shim.py (inline + URL modes, two refs) + README with URLs and pin-vs-float habit.

Confirm the plan and start with step 1; show me the harness rendering before going on.
At that checkpoint the empty plane should already demonstrate the presentation defaults:
fills the container, large readable axis labels, tasteful (UIkit-spirit) styling.

## Deferred — design for, don't build yet

Edit mode (`g.editable(...)`): click-to-add node, drag to move/relabel, cycle color,
draw the separating line — all as input handlers writing into the SAME model. A per-app
`describe(x,y)` hook (in apps/shared/) supplies quadrant->text labels for self-labeling
dropped nodes. Also deferred: the node-and-arc perceptron diagram (raw-pixel mode, weighted
arcs), and a possible "check my work" that DOES do point-vs-line math. Keep the model open
to these; implement none of them now.