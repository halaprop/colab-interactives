/*
 * apps/perceptron/single/index.js
 *
 * "Should I go to the beach" as an actual single-neuron perceptron:
 * two input nodes (sunny, work) feed a weighted sum into an output node
 * through a ReLU, plus a bias edge with no source node (a free point
 * endpoint terminating on the output -- the endpoint overload's
 * point->node case). Sliders control activations, weights, and bias;
 * everything else is driven by state + onChange.
 *
 * Three-column layout (controls | network | activation curve) is this
 * app's own DOM/CSS -- the library has no opinion on page layout. The
 * two Diagrams share one state object so a slider drives both at once.
 * The ReLU curve is plain D3 using the activation Plane's own xScale/
 * yScale, not a library primitive -- point-vs-line math and new
 * primitives are deliberately deferred until a second use case asks for
 * one.
 */
import { Diagram, Controls } from '../../../lib/diagram.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const root = document.querySelector('#app');

const controlsEl = document.createElement('div');
const networkEl = document.createElement('div');
const activationEl = document.createElement('div');

// Leave root's own height alone -- the shim (or the harness) already
// gave #app a definite height, and overwriting it with height:100%
// here would make it depend on an ancestor (Colab's iframe body) that
// has no guaranteed definite height of its own, collapsing the whole
// chain: the network/activation <svg>s would fall back to the
// browser's default replaced-element size (~150px) instead of filling
// the column.
Object.assign(root.style, { display: 'flex', width: '100%' });
Object.assign(controlsEl.style, { width: '26%', height: '100%', flex: '0 0 auto' });
Object.assign(networkEl.style, { width: '38%', height: '100%', flex: '0 0 auto' });
Object.assign(activationEl.style, { width: '36%', height: '100%', flex: '0 0 auto' });
root.appendChild(controlsEl);
root.appendChild(networkEl);
root.appendChild(activationEl);

const state = { x1: 0.8, x2: 0.4, w1: 1, w2: -1.2, bias: 0.5 };

// ---- network: two inputs + a bias edge -> one output, through ReLU ----

const network = Diagram(networkEl, { state });

network.plane({
  xDomain: [-8, 8],
  yDomain: [-8, 8],
  axes: false,
});

// Graph-level onChange runs first every render: compute the shared,
// derived values once here so every element's own onChange (and the
// activation diagram's dot, via the same shared state) can just read them.
network.onChange((s) => {
  s.sum = s.x1 * s.w1 + s.x2 * s.w2 + s.bias;
  s.activation = Math.max(0, s.sum);
});

network.node({
  id: 'sunny',
  x: -5,
  y: 4,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Sunny\n${s.x1.toFixed(2)}`;
  },
});

network.node({
  id: 'work',
  x: -5,
  y: -2,
  sizeKey: 'l',
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.text = `Work\n${s.x2.toFixed(2)}`;
  },
});

network.node({
  id: 'output',
  x: 5,
  y: 0,
  sizeKey: 'l',
  r: 50, // a bit bigger than sunny/work -- it carries two lines (verdict + sum), not one
  textPlacement: 'middle',
  onChange: (s, self) => {
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.textFill = '#fff';
    self.text = `Beach?\n${s.sum.toFixed(2)}`;
  },
});

// Weight -> edge styling: green/red for sign, thicker for magnitude.
function weightStyle(self, w) {
  self.stroke = w >= 0 ? '#2f9e5b' : '#d1473f';
  self.strokeWidth = 2 + Math.abs(w) * 3;
}

network.edge({
  from: 'sunny',
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = s.w1.toFixed(2);
    weightStyle(self, s.w1);
  },
});

network.edge({
  from: 'work',
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
// ReLU curve and the sunny/work input plane. Labeled on both sides so
// it reads on its own; defaults to the activation curve.
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
viewToggle.title = 'Switch between the activation curve and the sunny/work input plane';
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
viewToggleRightLabel.textContent = 'input';
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
setView(false);

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

// ---- input plane: the same decision, seen as a line through (sunny, work) ----
//
// Behind the toggle: the perceptron's decision boundary is just
// w1*x1 + w2*x2 + bias = 0, a line in the two-input plane. Everything
// on the positive side of it is where the ReLU fires (activation > 0,
// go to the beach); everything on the other side is where it doesn't.

const inputSpace = Diagram(inputSpaceEl, { state });

inputSpace.plane({
  xDomain: [-2, 2],
  yDomain: [-2, 2],
  xLabel: 'sunny',
  yLabel: 'work',
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
    self.rightFill = '#2f9e5b'; // sum > 0 -- go to the beach (matches the go/nogo dot)
    self.leftFill = '#d1473f'; // sum <= 0 -- stay home
  },
});

// The current (sunny, work) input, so moving x1/x2 has something to
// move too -- the line above only reacts to w1/w2/bias, since those
// are the only terms in the boundary equation.
inputSpace.node({
  id: 'input-point',
  r: 7,
  shape: 'circle',
  onChange: (s, self) => {
    self.x = s.x1;
    self.y = s.x2;
    self.cls = s.activation > 0 ? 'go' : 'nogo';
  },
});

// ---- controls: sliders write into the shared state, then re-render both ----

const heading = document.createElement('div');
heading.textContent = 'Should I go to the beach?';
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

const controls = Controls(controlsBody, state);
controls.slider({ label: 'Sunny', min: -2, max: 2, step: 0.1, bind: 'x1', onInput: rerenderBoth });
controls.slider({ label: 'Work', min: -2, max: 2, step: 0.1, bind: 'x2', onInput: rerenderBoth });
controls.slider({ label: 'Weight: Sunny', min: -2, max: 2, step: 0.1, bind: 'w1', onInput: rerenderBoth });
controls.slider({ label: 'Weight: Work', min: -2, max: 2, step: 0.1, bind: 'w2', onInput: rerenderBoth });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bias', onInput: rerenderBoth });
