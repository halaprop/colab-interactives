/*
 * apps/perceptron/index.js
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
import { Diagram, Controls } from '../../lib/diagram.js';
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

const state = { x1: 1, x2: 0.3, w1: 1, w2: -1, bias: 0 };

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
  onChange: (s, self) => {
    self.text = `sunny: ${s.x1.toFixed(2)}`;
  },
});

network.node({
  id: 'work',
  x: -5,
  y: -2,
  sizeKey: 'l',
  onChange: (s, self) => {
    self.text = `work: ${s.x2.toFixed(2)}`;
  },
});

network.node({
  id: 'output',
  x: 5,
  y: 0,
  sizeKey: 'l',
  onChange: (s, self) => {
    self.cls = s.activation > 0 ? 'go' : 'nogo';
    self.text = `beach? ${s.activation > 0 ? 'YES' : 'no'} (${s.sum.toFixed(2)})`;
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
    self.label = `w1 = ${s.w1.toFixed(2)}`;
    weightStyle(self, s.w1);
  },
});

network.edge({
  from: 'work',
  to: 'output',
  arrow: true,
  onChange: (s, self) => {
    self.label = `w2 = ${s.w2.toFixed(2)}`;
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

// ---- activation: static ReLU curve + a dot that rides it ----

const activation = Diagram(activationEl, { state });

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
// container is a freshly-created flex column, and DiagramCore measures
// it synchronously at construction, before the browser necessarily
// finishes that layout pass. The async ResizeObserver settling fires a
// real render that fixes the axes/nodes but would leave a one-time
// curve behind.
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
};

const controls = Controls(controlsBody, state);
controls.slider({ label: 'Sunny (x1)', min: -2, max: 2, step: 0.1, bind: 'x1', onInput: rerenderBoth });
controls.slider({ label: 'Work (x2)', min: -2, max: 2, step: 0.1, bind: 'x2', onInput: rerenderBoth });
controls.slider({ label: 'Weight: sunny -> output (w1)', min: -2, max: 2, step: 0.1, bind: 'w1', onInput: rerenderBoth });
controls.slider({ label: 'Weight: work -> output (w2)', min: -2, max: 2, step: 0.1, bind: 'w2', onInput: rerenderBoth });
controls.slider({ label: 'Bias', min: -2, max: 2, step: 0.1, bind: 'bias', onInput: rerenderBoth });
