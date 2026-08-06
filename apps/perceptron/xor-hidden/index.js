/*
 * apps/perceptron/xor-hidden/index.js
 *
 * apps/perceptron/xor-single showed one perceptron can't do Rocky/Mr. T's XOR: the
 * two "good day" corners of the input square are diagonal from each
 * other, and so are the two "bad day" corners, so no single straight
 * line separates them. This app adds a hidden layer -- two ReLU units
 * instead of one -- and shows that two lines, combined, can.
 *
 * Architecture: 2 inputs -> 2 hidden ReLU units -> 1 output ReLU unit,
 * three perceptrons total. The classic solved form:
 *   hiddenA = ReLU(x1 + x2)
 *   hiddenB = ReLU(x1 + x2 - 1)
 *   output  = ReLU(hiddenA - 2*hiddenB - 0.5)
 * gets all four corners right (neither invited -> ReLU(-0.5) -> 0,
 * exactly one -> ReLU(0.5) -> 0.5, both -> ReLU(2-2-0.5) -> 0). The
 * -0.5 output bias isn't load-bearing for correctness -- bO=0 also
 * solves all four corners -- but it centers the decision band exactly
 * between each pair of adjacent corners instead of running the
 * boundary straight through them, so every corner sits with margin
 * instead of balanced right on an edge. Sliders start at exactly these
 * values -- so it opens already solved -- but all 9 weights/biases stay
 * live, so dragging any one of them and watching it break (or re-solve)
 * is the point.
 *
 * The input plane's shaded region is no longer a half-plane, so it
 * can't reuse xor-single's Line leftFill/rightFill trick (that's
 * genuinely only correct for a single straight boundary). Instead it
 * samples the network's actual combined output over a grid and shades
 * each cell -- using Plane's existing (and previously unused by any
 * app) `bands` option, so no library changes were needed for that part.
 * Each hidden unit's own boundary line is still drawn, unfilled, so the
 * two individual cuts that combine into the final shape stay visible.
 */
import { Diagram, Controls } from '../../../lib/diagram.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const root = document.querySelector('#app');

const controlsEl = document.createElement('div');
const networkEl = document.createElement('div');
const activationEl = document.createElement('div');

Object.assign(root.style, { display: 'flex', width: '100%' });
Object.assign(controlsEl.style, { width: '220px', height: '100%', flex: '0 0 220px' });
Object.assign(networkEl.style, { height: '100%', flex: '1 1 0%' });
Object.assign(activationEl.style, { height: '100%', flex: '1 1 0%' });
root.appendChild(controlsEl);
root.appendChild(networkEl);
root.appendChild(activationEl);

const state = {
  x1: 1,
  x2: 0,
  wA1: 1,
  wA2: 1,
  bA: 0,
  wB1: 1,
  wB2: 1,
  bB: -1,
  vA: 1,
  vB: -2,
  bO: -0.5,
};

// The four truth-table corners with XOR's actual answer baked in --
// fixed ground truth, independent of whatever x1/x2 the sliders are
// currently probing in the network diagram.
const TRUTH_TABLE = [
  { x1: 0, x2: 0, good: false },
  { x1: 1, x2: 0, good: true },
  { x1: 0, x2: 1, good: true },
  { x1: 1, x2: 1, good: false },
];

// The whole network, as one pure function of (params, x1, x2) -- the
// single source of truth reused by the network diagram, the correct-
// count, the per-corner marks, and the input-plane heatmap, so all four
// can never drift out of sync with each other.
function forward(s, x1, x2) {
  const hA = Math.max(0, x1 * s.wA1 + x2 * s.wA2 + s.bA);
  const hB = Math.max(0, x1 * s.wB1 + x2 * s.wB2 + s.bB);
  const out = Math.max(0, hA * s.vA + hB * s.vB + s.bO);
  return { hA, hB, out };
}

function countCorrect(s) {
  return TRUTH_TABLE.filter(({ x1, x2, good }) => (forward(s, x1, x2).out > 0) === good).length;
}

// ---- network: 2 inputs -> 2 hidden ReLU units -> 1 output, through ReLU ----

const network = Diagram(networkEl, { state });

network.plane({
  xDomain: [-8, 8],
  yDomain: [-8, 8],
  axes: false,
});

network.onChange((s) => {
  const { hA, hB, out } = forward(s, s.x1, s.x2);
  s.hA = hA;
  s.hB = hB;
  s.activation = out;
});

network.node({
  id: 'rocky',
  x: -6,
  y: 5,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Rocky\n${s.x1.toFixed(0)}`;
  },
});

network.node({
  id: 'mrt',
  x: -6,
  y: -5,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Mr. T\n${s.x2.toFixed(0)}`;
  },
});

network.node({
  id: 'hiddenA',
  x: 0,
  y: 2.5, // on the straight line from rocky(-6,5) to output(6,0), so that leg of the path reads as one line, not a bend
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.cls = s.hA > 0 ? 'go' : 'nogo';
    self.text = `A\n${s.hA.toFixed(2)}`;
  },
});

network.node({
  id: 'hiddenB',
  x: 0,
  y: -2.5, // on the straight line from mrt(-6,-5) to output(6,0), same reasoning as hiddenA
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.cls = s.hB > 0 ? 'go' : 'nogo';
    self.text = `B\n${s.hB.toFixed(2)}`;
  },
});

network.node({
  id: 'output',
  x: 6,
  y: 0,
  sizeKey: 'l',
  r: 62, // bigger than the other nodes -- it carries its name plus the live verdict, not just one value
  textPlacement: 'middle',
  fontKey: 'l',
  onChange: (s, self) => {
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.textFill = '#fff';
    // The pre-ReLU sum, not the clamped s.activation -- its sign alone
    // already tells yes/no (matching perceptron/single and xor-single),
    // whereas activation is clamped to exactly 0 for every "no" case
    // and so can't distinguish "barely no" from "no by a mile".
    const rawSum = s.hA * s.vA + s.hB * s.vB + s.bO;
    self.text = `Good\nDay\n${rawSum.toFixed(2)}`;
  },
});

// "correct outputs: N/4" is a summary over all 4 truth-table corners,
// not a per-instance reading, so it stays a separate caption below the
// circle -- see xor-single's 'output-stats' for why (same trick, same
// reasoning, kept separate per this file's own copy-not-share convention).
network.node({
  id: 'output-stats',
  x: 6,
  y: 0,
  r: 100, // bigger than output's own r:62 on purpose -- pushes this caption further down so it clears the vB edge label, which lands close to the real circle's edge
  fill: 'transparent',
  stroke: 'none',
  textPlacement: 'below',
  onChange: (s, self) => {
    self.text = `correct\noutputs: ${countCorrect(s)}/4`;
  },
});

// Weight -> edge styling: green/red for sign, thicker for magnitude.
function weightStyle(self, w) {
  self.stroke = w >= 0 ? '#2f9e5b' : '#d1473f';
  self.strokeWidth = 2 + Math.abs(w) * 3;
}

network.edge({
  from: 'rocky',
  to: 'hiddenA',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.wA1.toFixed(2);
    weightStyle(self, s.wA1);
  },
});

network.edge({
  from: 'mrt',
  to: 'hiddenA',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.wA2.toFixed(2);
    weightStyle(self, s.wA2);
  },
});

network.edge({
  from: 'rocky',
  to: 'hiddenB',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.wB1.toFixed(2);
    weightStyle(self, s.wB1);
  },
});

network.edge({
  from: 'mrt',
  to: 'hiddenB',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.wB2.toFixed(2);
    weightStyle(self, s.wB2);
  },
});

// Bias edges: from is a literal point, not a node id -- the endpoint
// overload's point->node case, so each has no source node of its own.
network.edge({
  from: { x: 0, y: 5.5 }, // same 3-unit drop to hiddenA as before, just following its new y:2.5
  to: 'hiddenA',
  arrow: true,
  onChange: (s, self) => {
    self.label = `bA = ${s.bA.toFixed(2)}`;
    weightStyle(self, s.bA);
  },
});

network.edge({
  from: { x: 0, y: -5.5 }, // same 3-unit drop to hiddenB as before, just following its new y:-2.5
  to: 'hiddenB',
  arrow: true,
  onChange: (s, self) => {
    self.label = `bB = ${s.bB.toFixed(2)}`;
    weightStyle(self, s.bB);
  },
});

network.edge({
  from: 'hiddenA',
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.vA.toFixed(2);
    weightStyle(self, s.vA);
  },
});

network.edge({
  from: 'hiddenB',
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.vB.toFixed(2);
    weightStyle(self, s.vB);
  },
});

network.edge({
  from: { x: 6, y: 7 },
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = `bO = ${s.bO.toFixed(2)}`;
    weightStyle(self, s.bO);
  },
});

// ---- activation column: ReLU curve (3 dots -- A, B, output), with a
// toggle to an input-plane view ----
//
// activationEl hosts two full-size diagrams stacked via position:absolute
// (never display:none) so both keep real, stable dimensions the whole
// time -- toggling which one is on top is a visibility flip, not a
// layout change, so neither Diagram's ResizeObserver ever has to
// recover from a 0x0 measurement.
const activationStack = document.createElement('div');
const activationCurveEl = document.createElement('div');
const inputSpaceEl = document.createElement('div');
Object.assign(activationStack.style, { position: 'relative', width: '100%', height: '100%' });
Object.assign(activationCurveEl.style, { position: 'absolute', inset: '0' });
Object.assign(inputSpaceEl.style, { position: 'absolute', inset: '0', visibility: 'hidden' });
activationStack.appendChild(activationCurveEl);
activationStack.appendChild(inputSpaceEl);
activationEl.appendChild(activationStack);

// Small switch, top-right corner of the column: flips it between the
// ReLU curve and the Rocky/Mr. T input plane. Labeled on both sides so
// it reads on its own; defaults to the input plane, since that's where
// this app's actual point lives.
const viewToggle = document.createElement('label');
Object.assign(viewToggle.style, {
  position: 'absolute',
  top: '10px',
  right: '14px',
  zIndex: '2',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '13px',
  color: '#2b2f36',
  cursor: 'pointer',
  userSelect: 'none',
});
viewToggle.title = 'Switch between the activation curve and the Rocky/Mr. T input plane';
const viewToggleLeftLabel = document.createElement('span');
viewToggleLeftLabel.textContent = 'activation';
const viewToggleTrack = document.createElement('span');
Object.assign(viewToggleTrack.style, {
  position: 'relative',
  width: '26px',
  height: '14px',
  borderRadius: '7px',
  background: '#d5d8dd',
  transition: 'background 0.15s',
  flex: '0 0 auto',
});
const viewToggleThumb = document.createElement('span');
Object.assign(viewToggleThumb.style, {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  background: '#fff',
  transition: 'left 0.15s',
});
viewToggleTrack.appendChild(viewToggleThumb);
const viewToggleInput = document.createElement('input');
viewToggleInput.type = 'checkbox';
Object.assign(viewToggleInput.style, { position: 'absolute', opacity: '0', width: '0', height: '0' });
const viewToggleRightLabel = document.createElement('span');
viewToggleRightLabel.textContent = 'input plane';
const setView = (showInputSpace) => {
  activationCurveEl.style.visibility = showInputSpace ? 'hidden' : 'visible';
  inputSpaceEl.style.visibility = showInputSpace ? 'visible' : 'hidden';
  viewToggleTrack.style.background = showInputSpace ? '#2f6fd1' : '#d5d8dd';
  viewToggleThumb.style.left = showInputSpace ? '14px' : '2px';
};
viewToggleInput.addEventListener('change', () => setView(viewToggleInput.checked));
viewToggle.appendChild(viewToggleLeftLabel);
viewToggle.appendChild(viewToggleInput);
viewToggle.appendChild(viewToggleTrack);
viewToggle.appendChild(viewToggleRightLabel);
activationStack.appendChild(viewToggle);
viewToggleInput.checked = true;
setView(true);

// ---- activation: static ReLU curve + a dot per unit (A, B, output) ----

const activation = Diagram(activationCurveEl, { state });

const activationPlane = activation.plane({
  xDomain: [-4, 4],
  yDomain: [-1, 4],
  xLabel: 'sum of weighted inputs',
  yLabel: 'activation',
  grid: true,
});

const relu = (x) => Math.max(0, x);
const curvePoints = d3.range(-4, 4.001, 0.1).map((x) => [x, relu(x)]);
const curveLine = d3
  .line()
  .x((p) => activationPlane.xScale(p[0]))
  .y((p) => activationPlane.yScale(p[1]));
const curvePath = activationPlane.marksGroup
  .append('path')
  .attr('fill', 'none')
  .attr('stroke', '#2f6fd1')
  .attr('stroke-width', 3);

// The curve isn't part of the library's render cycle (it's plain D3,
// not a Node/Edge), so redraw it on every render the same way axes and
// nodes already do -- otherwise it's stuck with whatever scale existed
// the moment it was first drawn, which can be stale: this diagram's
// container is a freshly-created, absolutely-positioned div, and
// DiagramCore measures it synchronously at construction, before the
// browser necessarily finishes that layout pass. The async
// ResizeObserver settling fires a real render that fixes the
// axes/nodes but would leave a one-time curve behind.
const baseActivationRender = activation.render.bind(activation);
activation.render = () => {
  baseActivationRender();
  curvePath.attr('d', curveLine(curvePoints));
};
activation.render();

activation.node({
  id: 'dotA',
  r: 10,
  shape: 'circle',
  textPlacement: 'above',
  onChange: (s, self) => {
    self.x = s.x1 * s.wA1 + s.x2 * s.wA2 + s.bA;
    self.y = s.hA;
    self.cls = s.hA > 0 ? 'go' : 'nogo';
    self.text = `A ${s.hA.toFixed(2)}`;
  },
});

activation.node({
  id: 'dotB',
  r: 10,
  shape: 'circle',
  textPlacement: 'above',
  onChange: (s, self) => {
    self.x = s.x1 * s.wB1 + s.x2 * s.wB2 + s.bB;
    self.y = s.hB;
    self.cls = s.hB > 0 ? 'go' : 'nogo';
    self.text = `B ${s.hB.toFixed(2)}`;
  },
});

activation.node({
  id: 'dotOut',
  r: 10,
  shape: 'circle',
  textPlacement: 'below',
  onChange: (s, self) => {
    self.x = s.hA * s.vA + s.hB * s.vB + s.bO;
    self.y = s.activation;
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.text = `out ${s.activation.toFixed(2)}`;
  },
});

// ---- input plane: shade the network's actual combined region ----
//
// Unlike xor-single, this boundary isn't one line, so it can't be shown
// as a filled half-plane. Instead: a grid of cells across the plane,
// each shaded by the network's real output at that point (Plane's
// `bands` option -- generic colored rects, not tied to a single line).
// Each hidden unit's own line is drawn too, unfilled, so the two
// individual cuts that combine into the final region stay visible.

const inputSpace = Diagram(inputSpaceEl, { state });

const PLANE_MIN = -0.6;
const PLANE_MAX = 1.6;

const inputSpacePlane = inputSpace.plane({
  xDomain: [PLANE_MIN, PLANE_MAX],
  yDomain: [PLANE_MIN, PLANE_MAX],
  xLabel: 'invite Rocky (x1)',
  yLabel: 'invite Mr. T (x2)',
  grid: true,
});

const HEATMAP_RES = 30;

function computeHeatmapBands(s) {
  const cell = (PLANE_MAX - PLANE_MIN) / HEATMAP_RES;
  const bands = [];
  for (let i = 0; i < HEATMAP_RES; i++) {
    for (let j = 0; j < HEATMAP_RES; j++) {
      const x0 = PLANE_MIN + i * cell;
      const y0 = PLANE_MIN + j * cell;
      const cx = x0 + cell / 2;
      const cy = y0 + cell / 2;
      const good = forward(s, cx, cy).out > 0;
      bands.push({
        id: `c${i}_${j}`,
        x0,
        x1: x0 + cell,
        y0,
        y1: y0 + cell,
        fill: good ? '#2f9e5b' : '#d1473f',
        opacity: 0.18,
      });
    }
  }
  return bands;
}

// Bands aren't recomputed by the library's own render cycle (they're a
// static opts value, same as xDomain/yLabel), so they're refreshed here
// the same way the ReLU curve refreshes above -- recompute, then let
// the base render draw them.
const baseInputSpaceRender = inputSpace.render.bind(inputSpace);
inputSpace.render = () => {
  inputSpacePlane.set({ bands: computeHeatmapBands(state) });
  baseInputSpaceRender();
};
inputSpace.render();

// A hidden unit's own boundary line: w1*x1 + w2*x2 + bias = 0, same
// point-and-rotated-direction construction as xor-single's single line,
// just run twice and left unfilled -- the heatmap above is what actually
// shows the combined region now.
function wireHiddenBoundary(id, label, w1Key, w2Key, biasKey) {
  inputSpace.line({
    id,
    extent: 'infinite',
    stroke: '#2b2f36',
    strokeWidth: 1.5,
    label,
    onChange: (s, self) => {
      const w1 = s[w1Key];
      const w2 = s[w2Key];
      const bias = s[biasKey];
      const magSq = w1 * w1 + w2 * w2;
      if (magSq < 1e-6) {
        self.visible = false;
        return;
      }
      self.visible = true;
      const p0 = Math.abs(w1) >= Math.abs(w2) ? { x: -bias / w1, y: 0 } : { x: 0, y: -bias / w2 };
      self.from = p0;
      self.to = { x: p0.x - w2, y: p0.y + w1 };
    },
  });
}

wireHiddenBoundary('boundaryA', 'A', 'wA1', 'wA2', 'bA');
wireHiddenBoundary('boundaryB', 'B', 'wB1', 'wB2', 'bB');

// The four ground-truth corners. Fill color is fixed (the actual XOR
// answer); the current corner the sliders are probing gets a dark ring;
// a corner the network currently gets wrong gets a white X on top.
TRUTH_TABLE.forEach(({ x1, x2, good }) => {
  inputSpace.node({
    id: `truth-${x1}${x2}`,
    x: x1,
    y: x2,
    r: 9,
    shape: 'circle',
    textPlacement: 'middle',
    fontKey: 's',
    textFill: '#ffffff',
    onChange: (s, self) => {
      self.cls = good ? 'go' : 'nogo';
      const isCurrent = s.x1 === x1 && s.x2 === x2;
      self.stroke = isCurrent ? '#2b2f36' : '#ffffff';
      self.strokeWidth = isCurrent ? 3 : 1.5;
      self.text = (forward(s, x1, x2).out > 0) === good ? '' : '✕';
    },
  });
});

// ---- controls: sliders write into the shared state, then re-render both ----

const heading = document.createElement('div');
heading.textContent = 'Beach Day';
Object.assign(heading.style, {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '22px',
  fontWeight: '700',
  color: '#2b2f36',
  padding: '24px 24px 0',
});
controlsEl.appendChild(heading);

const controlsBody = document.createElement('div');
Object.assign(controlsBody.style, { width: '100%', height: 'calc(100% - 60px)' });
controlsEl.appendChild(controlsBody);

const rerenderBoth = () => {
  network.render();
  activation.render();
  inputSpace.render();
};

// A small on/off pill switch -- same visual language as the activation/
// input-plane view toggle below, just sized for use as a primary control
// rather than a corner icon. Built as plain DOM (not a Controls method)
// since it's a one-off compound row (two switches sharing one "Invite"
// label), not a general slider replacement.
function switchInput(label, checked, onChange) {
  const wrap = document.createElement('label');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: '16px',
    color: '#2b2f36',
  });
  const text = document.createElement('span');
  text.textContent = label;
  text.style.whiteSpace = 'nowrap';
  const track = document.createElement('span');
  Object.assign(track.style, {
    position: 'relative',
    width: '32px',
    height: '18px',
    borderRadius: '9px',
    background: checked ? '#2f6fd1' : '#d5d8dd',
    transition: 'background 0.15s',
    flex: '0 0 auto',
  });
  const thumb = document.createElement('span');
  Object.assign(thumb.style, {
    position: 'absolute',
    top: '2px',
    left: checked ? '16px' : '2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.15s',
  });
  track.appendChild(thumb);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  Object.assign(checkbox.style, { position: 'absolute', opacity: '0', width: '0', height: '0' });
  checkbox.addEventListener('change', () => {
    track.style.background = checkbox.checked ? '#2f6fd1' : '#d5d8dd';
    thumb.style.left = checkbox.checked ? '16px' : '2px';
    onChange(checkbox.checked);
  });
  wrap.appendChild(text);
  wrap.appendChild(checkbox);
  wrap.appendChild(track);
  return wrap;
}

const controls = Controls(controlsBody, state);

const inviteRow = controls.panel.append('div').attr('class', 'controls-row');
inviteRow.append('div').attr('class', 'controls-row-header').append('span').attr('class', 'controls-label').text('Invite');
const inviteSwitches = inviteRow.append('div').style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
inviteSwitches.node().appendChild(switchInput('Rocky', state.x1 === 1, (checked) => { state.x1 = checked ? 1 : 0; rerenderBoth(); }));
inviteSwitches.node().appendChild(switchInput('Mr. T', state.x2 === 1, (checked) => { state.x2 = checked ? 1 : 0; rerenderBoth(); }));

function sectionHeading(text) {
  controls.panel.append('div').attr('class', 'controls-section').text(text);
}

const NARROW = 80;

sectionHeading('Hidden A');
controls.sliderPair(
  { label: 'Rocky', min: -2, max: 2, step: 0.1, bind: 'wA1', onInput: rerenderBoth, width: NARROW },
  { label: 'Mr. T', min: -2, max: 2, step: 0.1, bind: 'wA2', onInput: rerenderBoth, width: NARROW });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bA', onInput: rerenderBoth, showBounds: false, width: NARROW });

sectionHeading('Hidden B');
controls.sliderPair(
  { label: 'Rocky', min: -2, max: 2, step: 0.1, bind: 'wB1', onInput: rerenderBoth, width: NARROW },
  { label: 'Mr. T', min: -2, max: 2, step: 0.1, bind: 'wB2', onInput: rerenderBoth, width: NARROW });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bB', onInput: rerenderBoth, showBounds: false, width: NARROW });

sectionHeading('Output');
controls.sliderPair(
  { label: 'A', min: -2, max: 2, step: 0.1, bind: 'vA', onInput: rerenderBoth, width: NARROW },
  { label: 'B', min: -2, max: 2, step: 0.1, bind: 'vB', onInput: rerenderBoth, width: NARROW });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bO', onInput: rerenderBoth, showBounds: false, width: NARROW });

rerenderBoth();
