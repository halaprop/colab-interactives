/*
 * apps/perceptron/xor-single/index.js
 *
 * The same single-neuron perceptron as apps/perceptron/single, pointed at a
 * problem it can't solve. Two friends, Rocky and Mr. T: you like them
 * both, but they don't get along. "Good beach day" is XOR(invite Rocky,
 * invite Mr. T) -- true iff you invite exactly one (invite neither and
 * you're alone; invite both and they fight).
 *
 * The two "good day" corners of the input square are diagonal from each
 * other, and so are the two "bad day" corners -- and no straight line
 * separates one diagonal of a square from the other. So no setting of
 * w1/w2/bias gets all four corners right at once -- made countable, not
 * just visual, by a "correct outputs: N/4" line under the output node,
 * computed fresh from the current weights against all four truth-table
 * corners, that never reaches 4 no matter how the sliders are dragged.
 *
 * Structurally this is apps/perceptron/single with the labels/story swapped and
 * the input-plane panel's single draggable point replaced by four fixed,
 * ground-truth-colored corners -- copied and adapted rather than
 * parameterized into the same file, since the two apps are demonstrating
 * opposite points (a working linear boundary vs. a provably impossible
 * one) and forcing them through one file would mean branching logic
 * inside what's meant to read as a single, linear story.
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

const state = { x1: 1, x2: 0, w1: 1, w2: -1.2, bias: 0.5 };

// The four truth-table corners with XOR's actual answer baked in --
// fixed ground truth, independent of whatever x1/x2 the sliders are
// currently probing in the network diagram.
const TRUTH_TABLE = [
  { x1: 0, x2: 0, good: false },
  { x1: 1, x2: 0, good: true },
  { x1: 0, x2: 1, good: true },
  { x1: 1, x2: 1, good: false },
];

function countCorrect(s) {
  return TRUTH_TABLE.filter(({ x1, x2, good }) => {
    const activation = Math.max(0, x1 * s.w1 + x2 * s.w2 + s.bias);
    return (activation > 0) === good;
  }).length;
}

// ---- network: two inputs + a bias edge -> one output, through ReLU ----

const network = Diagram(networkEl, { state });

network.plane({
  xDomain: [-8, 8],
  yDomain: [-8, 8],
  axes: false,
});

network.onChange((s) => {
  s.sum = s.x1 * s.w1 + s.x2 * s.w2 + s.bias;
  s.activation = Math.max(0, s.sum);
});

network.node({
  id: 'rocky',
  x: -5,
  y: 4,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Rocky\n${s.x1.toFixed(0)}`;
  },
});

network.node({
  id: 'mrt',
  x: -5,
  y: -2,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Mr. T\n${s.x2.toFixed(0)}`;
  },
});

network.node({
  id: 'output',
  x: 5,
  y: 0,
  sizeKey: 'l',
  r: 62, // bigger than rocky/mrt -- it carries its name plus the live verdict, not just one value
  textPlacement: 'middle',
  fontKey: 'l',
  onChange: (s, self) => {
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.textFill = '#fff';
    self.text = `Good\nDay\n${s.sum.toFixed(2)}`;
  },
});

// "correct outputs: N/4" is a different kind of fact than the node's
// own activation -- a summary over all 4 truth-table corners, not a
// per-instance reading -- so it stays a separate caption below the
// circle rather than folding into the node's own (already full) inside
// text. An invisible node co-located with 'output' (shape:'circle' so
// 'below' placement is available at all -- shape:'none' always forces
// 'middle', per lib/diagram.js) is the same trick 'output-name' used
// to use, just for the opposite placement.
network.node({
  id: 'output-stats',
  x: 5,
  y: 0,
  r: 62,
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
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.w1.toFixed(2);
    weightStyle(self, s.w1);
  },
});

network.edge({
  from: 'mrt',
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.w2.toFixed(2);
    weightStyle(self, s.w2);
  },
});

// Bias edge: from is a literal point, not a node id -- the endpoint
// overload's point->node case, so it has no source node of its own.
network.edge({
  from: { x: 5, y: 7 },
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = `bias = ${s.bias.toFixed(2)}`;
    weightStyle(self, s.bias);
  },
});

// ---- activation column: ReLU curve, with a toggle to an input-plane view ----
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

// ---- activation: static ReLU curve + a dot that rides it ----

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
  id: 'dot',
  x: 0,
  y: 0,
  r: 12,
  shape: 'circle',
  textPlacement: 'above',
  onChange: (s, self) => {
    self.x = s.sum;
    self.y = s.activation;
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.text = s.activation.toFixed(2);
  },
});

// ---- input plane: all four truth-table corners at once ----
//
// Behind the toggle: the perceptron's decision boundary is just
// w1*x1 + w2*x2 + bias = 0, a line through the input plane. Everything
// on the positive side is where the ReLU fires (activation > 0, a
// "good day"); everything on the other side is where it doesn't. The
// four corners are fixed and colored by the actual XOR answer, not by
// the perceptron -- so any mismatch between a corner's own color and
// the shading it sits in is the perceptron getting that corner wrong.

const inputSpace = Diagram(inputSpaceEl, { state });

inputSpace.plane({
  xDomain: [-0.6, 1.6],
  yDomain: [-0.6, 1.6],
  xLabel: 'invite Rocky (x1)',
  yLabel: 'invite Mr. T (x2)',
  grid: true,
});

inputSpace.line({
  id: 'boundary',
  extent: 'infinite',
  stroke: '#2b2f36',
  strokeWidth: 2,
  onChange: (s, self) => {
    const { w1, w2, bias } = s;
    const magSq = w1 * w1 + w2 * w2;
    if (magSq < 1e-6) {
      // w1 == w2 == 0: no boundary, the whole plane is one verdict.
      self.visible = false;
      return;
    }
    self.visible = true;
    // A point on the line, picked off whichever axis has the larger
    // weight so the divide stays away from zero.
    const p0 =
      Math.abs(w1) >= Math.abs(w2) ? { x: -bias / w1, y: 0 } : { x: 0, y: -bias / w2 };
    // (-w2, w1) is the weight vector (w1, w2) rotated 90deg CCW -- a
    // fixed rotation, not one that depends on the weights' actual
    // values. That fixes which screen side is "uphill" (sum > 0) once
    // and for all, so rightFill/leftFill below can stay hardcoded
    // instead of swapping every time a weight changes sign.
    self.from = p0;
    self.to = { x: p0.x - w2, y: p0.y + w1 };
    self.rightFill = '#2f9e5b'; // sum > 0 -- good day (matches the go/nogo dots)
    self.leftFill = '#d1473f'; // sum <= 0 -- bad day
  },
});

// The four ground-truth corners. Fill color is fixed (the actual XOR
// answer); the current corner the sliders are probing gets a dark ring
// so it's easy to tie back to what the network diagram is showing. A
// dot the perceptron currently gets wrong (its own color disagrees with
// what the boundary line says about that point) gets a white X on top --
// unmissable, and unlike a pure color cue it still reads for colorblind
// viewers.
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
      const activation = Math.max(0, x1 * s.w1 + x2 * s.w2 + s.bias);
      self.text = (activation > 0) === good ? '' : '✕';
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

controls.panel.append('div').attr('class', 'controls-section').text('Weights');
controls.slider({ label: 'Rocky', min: -2, max: 2, step: 0.1, bind: 'w1', onInput: rerenderBoth, showBounds: false });
controls.slider({ label: 'Mr. T', min: -2, max: 2, step: 0.1, bind: 'w2', onInput: rerenderBoth, showBounds: false });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bias', onInput: rerenderBoth, showBounds: false });

rerenderBoth();
