/*
 * lib/diagram.js
 *
 * Hand-authored, no-build-step D3 helper for interactive network/plot
 * diagrams. Loaded via a plain <script> tag after D3, in both the Vite
 * harness and the Colab shim, so this file is byte-for-byte what runs
 * in both places. D3 (global `d3`) is the only runtime dependency.
 *
 * Public surface is factory-style: Diagram('#app') returns `g`, and
 * `g.plane(...)`, `g.node(...)`, `g.edge(...)`, `g.line(...)` build real
 * class instances under the hood without callers ever writing `new`.
 */
(function (global) {
  'use strict';

  const STYLE_ID = 'diagram-lib-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .diagram-root {
        width: 100%;
        height: 100%;
        position: relative;
      }
      .diagram-root svg.diagram-svg {
        display: block;
        width: 100%;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      .plane-axis path,
      .plane-axis line {
        stroke: #b0b6bd;
        stroke-width: 1.5px;
        shape-rendering: crispEdges;
      }
      .plane-axis text {
        fill: #4a4f57;
        font-size: 16px;
      }
      .axis-label {
        fill: #2b2f36;
        font-size: 22px;
        font-weight: 600;
      }
      .plane-grid line {
        stroke: #e3e6ea;
        stroke-width: 1px;
        shape-rendering: crispEdges;
      }
      .plane-grid path {
        stroke: none;
      }
      .band,
      .side-fill {
        pointer-events: none;
      }
      .node-label {
        font-weight: 600;
      }
      .node-select-ring {
        fill: none;
        stroke: none;
      }
      .node.is-selected .node-select-ring {
        stroke: #2f6fd1;
        stroke-width: 2.5px;
        stroke-dasharray: 5 3;
      }
      .connector-path {
        pointer-events: none;
      }
      .connector-hit {
        stroke: transparent;
        stroke-width: 16px;
      }
      .connector.is-selected .connector-hit {
        stroke: rgba(47, 111, 209, 0.35);
      }
      .endpoint-handle {
        fill: #ffffff;
        stroke: #2f6fd1;
        stroke-width: 2.5px;
        cursor: grab;
      }
      .endpoint-handle:hover {
        fill: #eaf1fc;
      }
      .bend-handle {
        stroke: #8b5fbf;
      }
      .bend-handle:hover {
        fill: #f1eaf9;
      }
      .origin-handle {
        stroke: #0e9488;
      }
      .origin-handle:hover {
        fill: #e3f6f4;
      }
      .connector-label {
        font-size: 16px;
        font-weight: 600;
        fill: #2b2f36;
        paint-order: stroke;
        stroke: #ffffff;
        stroke-width: 4px;
        stroke-linejoin: round;
      }
      .edit-pending-marker {
        fill: #2f6fd1;
        stroke: #ffffff;
        stroke-width: 2px;
      }
      .edit-preview-line {
        stroke: #2f6fd1;
        stroke-width: 2px;
        stroke-dasharray: 6 4;
        pointer-events: none;
      }
      .diagram-panel {
        position: absolute;
        top: 20px;
        left: 20px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
        max-width: calc(100% - 40px);
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #d8dbdf;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      .diagram-panel-btn {
        font-size: 15px;
        font-weight: 600;
        padding: 8px 14px;
        border-radius: 7px;
        border: 1px solid #c7cbd1;
        background: #f5f6f8;
        color: #2b2f36;
        cursor: pointer;
      }
      .diagram-panel-btn:hover {
        background: #eceef1;
      }
      .diagram-panel-btn.active {
        background: #2f6fd1;
        border-color: #2f6fd1;
        color: #ffffff;
      }
      .panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-right: 14px;
        border-right: 1px solid #e0e2e6;
      }
      .panel-title {
        font-size: 15px;
        font-weight: 700;
        color: #2b2f36;
      }
      .panel-close-btn {
        border: none;
        background: transparent;
        font-size: 14px;
        line-height: 1;
        color: #6b7178;
        cursor: pointer;
        padding: 4px 7px;
        border-radius: 5px;
      }
      .panel-close-btn:hover {
        background: #eceef1;
      }
      .panel-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .panel-group-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #8a8f97;
      }
      .panel-swatch-row,
      .panel-segment-row {
        display: flex;
        gap: 6px;
      }
      .panel-swatch {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 2px solid #c7cbd1;
        cursor: pointer;
        padding: 0;
        background-color: #ffffff;
      }
      .panel-swatch.active {
        border-color: #2b2f36;
        box-shadow: 0 0 0 2px rgba(43, 47, 54, 0.15);
      }
      .panel-swatch-none {
        background-image: repeating-linear-gradient(45deg, #fff, #fff 4px, #e3e6ea 4px, #e3e6ea 8px);
      }
      .panel-segment-btn {
        font-size: 13px;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #c7cbd1;
        background: #f5f6f8;
        color: #2b2f36;
        cursor: pointer;
      }
      .panel-segment-btn:hover {
        background: #eceef1;
      }
      .panel-segment-btn.active {
        background: #2f6fd1;
        border-color: #2f6fd1;
        color: #ffffff;
      }
      .panel-text-input {
        font-size: 14px;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid #c7cbd1;
        background: #ffffff;
        color: #2b2f36;
        width: 150px;
      }
      .panel-text-input:focus {
        outline: 2px solid #2f6fd1;
        outline-offset: 1px;
      }
      .panel-delete-btn {
        font-size: 14px;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 7px;
        border: 1px solid #d1473f;
        background: #fdecea;
        color: #a8342c;
        cursor: pointer;
      }
      .panel-delete-btn:hover {
        background: #f7cfcb;
      }
      .panel-domain-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .panel-domain-sep {
        font-size: 12px;
        color: #8a8f97;
      }
      .panel-number-input {
        font-size: 14px;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid #c7cbd1;
        background: #ffffff;
        color: #2b2f36;
        width: 64px;
      }
      .panel-number-input:focus {
        outline: 2px solid #2f6fd1;
        outline-offset: 1px;
      }
      .controls-root {
        width: 100%;
        height: 100%;
      }
      .controls-panel {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        background: #fafbfc;
      }
      .controls-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .controls-row-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .controls-label {
        font-size: 18px;
        font-weight: 600;
        color: #2b2f36;
      }
      .controls-value {
        font-size: 17px;
        font-weight: 600;
        color: #2f6fd1;
        font-variant-numeric: tabular-nums;
      }
      .controls-slider {
        width: 100%;
        accent-color: #2f6fd1;
        height: 24px;
      }
      .controls-btn {
        font-size: 16px;
        font-weight: 600;
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid #c7cbd1;
        background: #f5f6f8;
        color: #2b2f36;
        cursor: pointer;
      }
      .controls-btn:hover {
        background: #eceef1;
      }
    `;
    document.head.appendChild(style);
  }

  // cls convenience -> fill color. Hand-authored only: the library never
  // assigns cls itself.
  const NODE_PALETTE = {
    neutral: '#9aa1ab',
    go: '#2f9e5b',
    nogo: '#d1473f',
  };

  const NODE_SIZE_PRESETS = {
    s: { r: 18, size: 36 },
    m: { r: 28, size: 56 },
    l: { r: 40, size: 80 },
  };
  const NODE_FONT_PRESETS = { s: 14, m: 18, l: 24 };
  const LABEL_GAP = 16;

  const EDIT_MODES = [
    { id: 'select', label: 'Select / Move' },
    { id: 'add-node', label: '+ Node' },
    { id: 'add-line', label: '+ Line' },
    { id: 'add-edge', label: '+ Edge' },
  ];
  const CLS_SWATCHES = [
    { value: 'neutral', color: NODE_PALETTE.neutral, label: 'Neutral' },
    { value: 'go', color: NODE_PALETTE.go, label: 'Go' },
    { value: 'nogo', color: NODE_PALETTE.nogo, label: 'No-go' },
  ];
  const FILL_SWATCHES = [
    { value: null, none: true, label: 'None' },
    { value: NODE_PALETTE.neutral, color: NODE_PALETTE.neutral, label: 'Neutral' },
    { value: NODE_PALETTE.go, color: NODE_PALETTE.go, label: 'Go' },
    { value: NODE_PALETTE.nogo, color: NODE_PALETTE.nogo, label: 'No-go' },
  ];
  const PLACEMENT_OPTIONS = [
    { value: 'above', label: 'Above' },
    { value: 'middle', label: 'Middle' },
    { value: 'below', label: 'Below' },
  ];
  const SIZE_OPTIONS = [
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
  ];
  const EXTENT_OPTIONS = [
    { value: 'segment', label: 'Segment' },
    { value: 'infinite', label: 'Infinite' },
  ];
  const GRID_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ];

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // ---- code export: serialize the live model back to g.plane/node/edge/line calls ----

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // a, b, c, ... z, aa, bb, cc, ... zz, aaa, ... -- short, stable per-node
  // tokens for building readable ids/names in exported code.
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
  function letterCode(index) {
    const repeat = Math.floor(index / 26) + 1;
    return ALPHABET[index % 26].repeat(repeat);
  }

  function formatCodeValue(v) {
    if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    if (typeof v === 'number') return String(round2(v));
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return `[${v.map(formatCodeValue).join(', ')}]`;
    if (v && typeof v === 'object') return formatObjectLiteral(v);
    return String(v);
  }

  // Short objects print on one line; longer ones (like a plane() call with
  // several options set) print one key per line, matching how these calls
  // read in hand-authored apps/*.js.
  function formatObjectLiteral(obj, indent) {
    indent = indent || 0;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) {
      return `{ ${keys.map((k) => `${k}: ${formatCodeValue(obj[k])}`).join(', ')} }`;
    }
    const pad = ' '.repeat(indent + 2);
    const closePad = ' '.repeat(indent);
    const lines = keys.map((k) => `${pad}${k}: ${formatCodeValue(obj[k])},`);
    return `{\n${lines.join('\n')}\n${closePad}}`;
  }

  // ---- endpoint overload + geometry helpers, shared by Edge and Line ----

  // from/to accept a node id (string, resolved to the node's live position)
  // or a literal {x,y} point, in data units.
  function resolveEndpoint(diagram, ref) {
    if (ref && typeof ref === 'object') {
      return { point: { x: ref.x, y: ref.y }, node: null };
    }
    if (typeof ref === 'string') {
      const node = diagram._nodes.get(ref);
      if (node) return { point: { x: node.x, y: node.y }, node };
    }
    return { point: { x: 0, y: 0 }, node: null };
  }

  function isPointRef(ref) {
    return ref != null && typeof ref === 'object';
  }

  // Trim a pixel-space segment endpoint back to the edge of its node's
  // shape (a circle's radius, a rect's half-size), so arcs terminate at
  // the boundary rather than the center. Points (node === null) aren't
  // trimmed.
  function trimToNodeBoundary(px, py, towardX, towardY, node) {
    if (!node || node.shape === 'none') return { x: px, y: py };
    let dx = towardX - px;
    let dy = towardY - py;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return { x: px, y: py };
    dx /= dist;
    dy /= dist;

    let t;
    if (node.shape === 'rect') {
      const half = node.resolvedSize / 2;
      const tx = dx !== 0 ? half / Math.abs(dx) : Infinity;
      const ty = dy !== 0 ? half / Math.abs(dy) : Infinity;
      t = Math.min(tx, ty);
    } else {
      t = node.resolvedR;
    }
    t = Math.min(t, dist);
    return { x: px + dx * t, y: py + dy * t };
  }

  // Where an Edge's bend handle sits: the point actually ON the curve at
  // t=0.5 (not the further-out quadratic control point), so dragging the
  // handle is "grab the curve and pull" rather than manipulating a control
  // point you can't see the effect of directly. Uses the same trimmed
  // endpoints + control point the curve itself is drawn with.
  function bendHandlePosition(a, b, control) {
    if (!control) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return {
      x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x,
      y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y,
    };
  }

  // Sutherland-Hodgman: clip a convex polygon to one side of the infinite
  // line through point p with direction dir. keepPositive picks which
  // side survives (cross(dir, pt - p) >= 0, or <= 0).
  function clipToHalfPlane(polygon, p, dir, keepPositive) {
    const cross = (pt) => dir.x * (pt.y - p.y) - dir.y * (pt.x - p.x);
    const inside = (pt) => (keepPositive ? cross(pt) >= 0 : cross(pt) <= 0);
    const intersect = (a, b) => {
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const denom = dir.x * ey - dir.y * ex;
      const s = denom !== 0 ? -(dir.x * (a.y - p.y) - dir.y * (a.x - p.x)) / denom : 0;
      return { x: a.x + s * ex, y: a.y + s * ey };
    };

    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const curr = polygon[i];
      const prev = polygon[(i - 1 + polygon.length) % polygon.length];
      const currIn = inside(curr);
      const prevIn = inside(prev);
      if (currIn) {
        if (!prevIn) out.push(intersect(prev, curr));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersect(prev, curr));
      }
    }
    return out;
  }

  // Liang-Barsky: clip the infinite line through point p with direction
  // dir to the axis-aligned box [0,W]x[0,H]. Returns the two boundary
  // points, or null if the line misses the box (degenerate/parallel).
  function clipLineToBox(p, dir, W, H) {
    let tMin = -Infinity;
    let tMax = Infinity;

    const clipAxis = (p0, d, lo, hi) => {
      if (Math.abs(d) < 1e-9) return p0 >= lo && p0 <= hi;
      let t0 = (lo - p0) / d;
      let t1 = (hi - p0) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      return tMin <= tMax;
    };

    if (!clipAxis(p.x, dir.x, 0, W)) return null;
    if (!clipAxis(p.y, dir.y, 0, H)) return null;
    if (tMin > tMax) return null;

    return {
      a: { x: p.x + tMin * dir.x, y: p.y + tMin * dir.y },
      b: { x: p.x + tMax * dir.x, y: p.y + tMax * dir.y },
    };
  }

  /**
   * The coordinate space. Anchored at pixel (0,0) inside the diagram's
   * SVG and fills it. Domains are optional data units (y grows UP);
   * with no domains, the plane is 1:1 pixels, still y-up. Singleton
   * per Diagram.
   */
  class Plane {
    constructor(diagram, opts) {
      this.diagram = diagram;
      this.opts = opts || {};
      this.group = diagram.svg.append('g').attr('class', 'plane');
      // Paint order: an invisible hit-rect for edit-mode pointer events,
      // then bands, grid, axes, side-fills, connectors, data marks, axis
      // labels, and finally the transient edit-mode overlay on top.
      this.hitRect = this.group.append('rect').attr('class', 'plane-hit').attr('fill', 'transparent');
      this.bandsGroup = this.group.append('g').attr('class', 'plane-bands');
      this.gridGroup = this.group.append('g').attr('class', 'plane-grid');
      this.axisGroup = this.group.append('g').attr('class', 'plane-axes');
      this.fillsGroup = this.group.append('g').attr('class', 'plane-fills');
      this.connectorsGroup = this.group.append('g').attr('class', 'plane-connectors');
      this.marksGroup = this.group.append('g').attr('class', 'plane-marks');
      this.labelGroup = this.group.append('g').attr('class', 'plane-axis-labels');
      this.editGroup = this.group.append('g').attr('class', 'plane-edit');
      this.handleGroup = this.group.append('g').attr('class', 'plane-handles');
    }

    set(opts) {
      Object.assign(this.opts, opts);
      return this;
    }

    // Fixed margins sized for presentation-scale axis labels/ticks.
    get margin() {
      return { top: 40, right: 40, bottom: 84, left: 96 };
    }

    layout() {
      const { width, height } = this.diagram;
      const m = this.margin;
      this.innerWidth = Math.max(width - m.left - m.right, 0);
      this.innerHeight = Math.max(height - m.top - m.bottom, 0);

      const xDomain = this.opts.xDomain || [0, this.innerWidth];
      const yDomain = this.opts.yDomain || [0, this.innerHeight];

      this.xScale = d3.scaleLinear().domain(xDomain).range([0, this.innerWidth]);
      // y grows up: data-max maps to pixel 0, data-min maps to innerHeight.
      this.yScale = d3.scaleLinear().domain(yDomain).range([this.innerHeight, 0]);

      this.group.attr('transform', `translate(${m.left},${m.top})`);
      this.hitRect.attr('x', 0).attr('y', 0).attr('width', this.innerWidth).attr('height', this.innerHeight);
    }

    renderBands() {
      const bands = this.opts.bands || [];
      const sel = this.bandsGroup.selectAll('.band').data(bands, (d, i) => (d && d.id) || i);
      sel.exit().remove();
      const merged = sel.enter().append('rect').attr('class', 'band').merge(sel);

      merged
        .attr('fill', (d) => d.fill || NODE_PALETTE.neutral)
        .attr('fill-opacity', (d) => (d.opacity != null ? d.opacity : 0.15))
        .attr('x', (d) => (d.x0 != null ? this.xScale(Math.min(d.x0, d.x1)) : 0))
        .attr('width', (d) =>
          d.x0 != null ? Math.abs(this.xScale(d.x1) - this.xScale(d.x0)) : this.innerWidth
        )
        .attr('y', (d) => (d.y0 != null ? this.yScale(Math.max(d.y0, d.y1)) : 0))
        .attr('height', (d) =>
          d.y0 != null ? Math.abs(this.yScale(d.y1) - this.yScale(d.y0)) : this.innerHeight
        );
    }

    renderGrid() {
      if (!this.opts.grid) {
        this.gridGroup.selectAll('*').remove();
        return;
      }

      let xGridSel = this.gridGroup.selectAll('.x-grid').data([null]);
      xGridSel = xGridSel.enter().append('g').attr('class', 'x-grid').merge(xGridSel);
      xGridSel
        .attr('transform', `translate(0,${this.innerHeight})`)
        .call(d3.axisBottom(this.xScale).tickSize(-this.innerHeight).tickFormat(''));

      let yGridSel = this.gridGroup.selectAll('.y-grid').data([null]);
      yGridSel = yGridSel.enter().append('g').attr('class', 'y-grid').merge(yGridSel);
      yGridSel.call(d3.axisLeft(this.yScale).tickSize(-this.innerWidth).tickFormat(''));
    }

    render() {
      this.layout();
      this.renderBands();
      this.renderGrid();

      // Axes always cross at data (0,0). Where that lands on screen is a
      // property of the domain (xDomain/yDomain), which the origin drag
      // handle pans -- see DiagramCore._panOriginTo. axes:false hides the
      // lines/ticks entirely, for network-style diagrams where the nodes
      // themselves are the whole picture.
      const showAxes = this.opts.axes !== false;
      this.axisGroup.style('display', showAxes ? null : 'none');

      if (showAxes) {
        const xAxisY = this.yScale(0);
        const yAxisX = this.xScale(0);

        const xAxis = d3.axisBottom(this.xScale);
        const yAxis = d3.axisLeft(this.yScale);

        let xAxisSel = this.axisGroup.selectAll('.x-axis').data([null]);
        xAxisSel = xAxisSel.enter().append('g').attr('class', 'plane-axis x-axis').merge(xAxisSel);
        xAxisSel.attr('transform', `translate(0,${xAxisY})`).call(xAxis);

        let yAxisSel = this.axisGroup.selectAll('.y-axis').data([null]);
        yAxisSel = yAxisSel.enter().append('g').attr('class', 'plane-axis y-axis').merge(yAxisSel);
        yAxisSel.attr('transform', `translate(${yAxisX},0)`).call(yAxis);
      }

      this.labelGroup.selectAll('*').remove();
      if (this.opts.xLabel) {
        this.labelGroup
          .append('text')
          .attr('class', 'axis-label x-axis-label')
          .attr('x', this.innerWidth / 2)
          .attr('y', this.innerHeight + this.margin.bottom - 20)
          .attr('text-anchor', 'middle')
          .text(this.opts.xLabel);
      }
      if (this.opts.yLabel) {
        this.labelGroup
          .append('text')
          .attr('class', 'axis-label y-axis-label')
          .attr(
            'transform',
            `translate(${-this.margin.left + 28}, ${this.innerHeight / 2}) rotate(-90)`
          )
          .attr('text-anchor', 'middle')
          .text(this.opts.yLabel);
      }
    }
  }

  /**
   * A thing at an (x,y) in plane coords. `cls` (neutral/go/nogo) is a
   * hand-authored color convenience, never computed by the library.
   */
  class Node {
    constructor(id, opts) {
      this.id = id;
      this.set(opts);
    }

    set(opts) {
      Object.assign(this, opts);
      return this;
    }

    get fillColor() {
      return this.fill || NODE_PALETTE[this.cls] || NODE_PALETTE.neutral;
    }

    get strokeColor() {
      return this.stroke || '#2b2f36';
    }

    get strokeWidthPx() {
      return this.strokeWidth != null ? this.strokeWidth : 2;
    }

    get textColor() {
      return this.textFill || '#2b2f36';
    }

    // r/size accept an explicit pixel override; otherwise resolved from
    // the sizeKey (s/m/l) preset so the inspector's Size control works.
    get resolvedR() {
      return this.r != null ? this.r : NODE_SIZE_PRESETS[this.sizeKey || 'm'].r;
    }

    get resolvedSize() {
      return this.size != null ? this.size : NODE_SIZE_PRESETS[this.sizeKey || 'm'].size;
    }

    get resolvedFontSize() {
      return NODE_FONT_PRESETS[this.fontKey || 'm'];
    }
  }

  const NODE_DEFAULTS = {
    x: 0,
    y: 0,
    text: '',
    shape: 'circle',
    sizeKey: 'm',
    fontKey: 'm',
    textPlacement: 'below',
    visible: true,
  };

  /**
   * Connector base: shared from/to endpoint overload and stroke/label
   * bookkeeping for Edge and Line.
   */
  class Connector {
    constructor(id, opts) {
      this.id = id;
      this.set(opts);
    }

    set(opts) {
      Object.assign(this, opts);
      return this;
    }
  }

  // Edge: connector between two endpoints, optional label/arrow/curvature.
  class Edge extends Connector {}
  const EDGE_DEFAULTS = {
    visible: true,
    stroke: '#2b2f36',
    strokeWidth: 3,
    arrow: false,
    curvature: 0,
  };

  // Line: an edge with no arrow, always straight, and optional side-fills.
  // extent:'segment' (default) draws only between the two endpoints;
  // 'infinite' draws past them to the plane's edges, like the side-fills
  // already do -- the endpoints (and their drag handles) don't move.
  class Line extends Connector {}
  const LINE_DEFAULTS = {
    visible: true,
    stroke: '#2b2f36',
    strokeWidth: 3,
    extent: 'segment',
  };

  /**
   * Top-level diagram: owns the SVG, the singleton Plane, the node/edge/
   * line registries, the render/update cycle, and (in editable mode) the
   * live-authoring toolbar. Fills its container and stays sized to it via
   * ResizeObserver so it reads well at presentation scale.
   */
  class DiagramCore {
    constructor(container, opts) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error(`Diagram: container not found: ${container}`);
      }
      this.opts = opts || {};
      // Own state by default; pass {state: sharedObject} to have this
      // diagram react to (and be driven alongside) another one's state,
      // e.g. a network view and an activation-function view sharing one
      // bag so a single slider can drive both via each one's .render().
      this.state = this.opts.state || {};
      this._graphOnChange = null;
      this._plane = null;
      this._nodes = new Map();
      this._connectors = new Map();
      this._nodeAutoId = 0;
      this._connectorAutoId = 0;

      this._editMode = 'select';
      this._selected = null;
      this._pendingRef = null;
      this._pendingPixel = null;
      this._panel = null;
      this._describe = null;
      this._dragBehavior = null;
      this._endpointDrag = null;
      this._bendDrag = null;
      this._originDrag = null;
      this._arrowMarkers = new Map();

      injectStyles();

      this.container.classList.add('diagram-root');
      this.svg = d3.select(this.container).append('svg').attr('class', 'diagram-svg');

      this._resizeObserver = new ResizeObserver(() => this._handleResize());
      this._resizeObserver.observe(this.container);

      this._handleResize();
    }

    _handleResize() {
      const rect = this.container.getBoundingClientRect();
      this.width = Math.max(rect.width, 0);
      this.height = Math.max(rect.height, 0);
      this.svg.attr('width', this.width).attr('height', this.height);
      this.render();
    }

    plane(opts) {
      if (!this._plane) {
        this._plane = new Plane(this, opts);
        this._wireCanvasInteractions();
      } else {
        this._plane.set(opts);
      }
      this._plane.render();
      return this._plane;
    }

    node(opts) {
      opts = opts || {};
      const id = opts.id || `n${++this._nodeAutoId}`;
      let n = this._nodes.get(id);
      if (!n) {
        n = new Node(id, Object.assign({}, NODE_DEFAULTS));
        this._nodes.set(id, n);
      }
      n.set(opts);
      this.render();
      return n;
    }

    edge(opts) {
      return this._connector(Edge, EDGE_DEFAULTS, 'e', opts);
    }

    line(opts) {
      return this._connector(Line, LINE_DEFAULTS, 'l', opts);
    }

    _connector(Ctor, defaults, prefix, opts) {
      opts = opts || {};
      const id = opts.id || `${prefix}${++this._connectorAutoId}`;
      let c = this._connectors.get(id);
      if (!c) {
        c = new Ctor(id, Object.assign({}, defaults));
        this._connectors.set(id, c);
      }
      c.set(opts);
      this.render();
      return c;
    }

    // Graph-level reactive computation, for shared/derived values (stash
    // them back into s for elements to read). Runs first on every render,
    // including the initial one -- there's no separate setup path, so a
    // reactive value is never written twice.
    onChange(fn) {
      this._graphOnChange = fn;
      this.render();
      return this;
    }

    render() {
      this._runOnChange();
      if (this._plane) this._plane.render();
      this._renderConnectors();
      this._renderNodes();
      this._renderPlaneHandles();
    }

    // Element-level onChange(s, self) opts, called .call(self, state, self)
    // per spec so both `this` and the 2nd arg are the element's mutable
    // model object -- (s, self) => {} is the canonical arrow-safe form.
    _runOnChange() {
      if (this._graphOnChange) this._graphOnChange(this.state);
      for (const node of this._nodes.values()) {
        if (typeof node.onChange === 'function') node.onChange.call(node, this.state, node);
      }
      for (const c of this._connectors.values()) {
        if (typeof c.onChange === 'function') c.onChange.call(c, this.state, c);
      }
    }

    // ---- nodes ----

    _renderNodes() {
      if (!this._plane) return;
      const xScale = this._plane.xScale;
      const yScale = this._plane.yScale;
      const data = Array.from(this._nodes.values()).filter((n) => n.visible);

      const sel = this._plane.marksGroup.selectAll('.node').data(data, (d) => d.id);
      sel.exit().remove();
      const merged = sel.enter().append('g').attr('class', 'node').merge(sel);

      merged.attr('transform', (d) => `translate(${xScale(d.x)},${yScale(d.y)})`);

      merged.each(function (d) {
        const g = d3.select(this);
        const wantTag = d.shape === 'rect' ? 'rect' : d.shape === 'circle' ? 'circle' : null;
        let shapeSel = g.select('.node-shape');
        const haveTag = shapeSel.empty() ? null : shapeSel.node().tagName.toLowerCase();

        if (wantTag !== haveTag) {
          shapeSel.remove();
          shapeSel = wantTag ? g.insert(wantTag, 'text').attr('class', 'node-shape') : null;
        }

        const baseOffset = wantTag === 'circle' ? d.resolvedR : wantTag === 'rect' ? d.resolvedSize / 2 : 0;

        if (shapeSel) {
          shapeSel
            .attr('fill', d.fillColor)
            .attr('stroke', d.strokeColor)
            .attr('stroke-width', d.strokeWidthPx);
          if (wantTag === 'circle') {
            shapeSel.attr('cx', 0).attr('cy', 0).attr('r', d.resolvedR);
          } else {
            shapeSel
              .attr('x', -d.resolvedSize / 2)
              .attr('y', -d.resolvedSize / 2)
              .attr('width', d.resolvedSize)
              .attr('height', d.resolvedSize)
              .attr('rx', 6);
          }
        }

        // Selection ring: a dashed halo just outside the shape, shown via
        // CSS when the parent <g class="node"> carries .is-selected.
        let ringSel = g.select('.node-select-ring');
        if (wantTag) {
          if (ringSel.empty()) ringSel = g.insert('circle', ':first-child').attr('class', 'node-select-ring');
          ringSel.attr('cx', 0).attr('cy', 0).attr('r', baseOffset + 8);
        } else if (!ringSel.empty()) {
          ringSel.remove();
        }

        // Label placement: above/below sit outside the shape so text of
        // any length reads cleanly; middle (or shape:'none') centers on
        // the point.
        let labelSel = g.select('.node-label');
        if (labelSel.empty()) {
          labelSel = g.append('text').attr('class', 'node-label').attr('text-anchor', 'middle');
        }
        const placement = wantTag ? d.textPlacement || 'below' : 'middle';
        let yOff = 0;
        let baseline = 'central';
        if (placement === 'below') {
          yOff = baseOffset + LABEL_GAP;
          baseline = 'hanging';
        } else if (placement === 'above') {
          yOff = -(baseOffset + LABEL_GAP);
          baseline = 'alphabetic';
        }
        labelSel
          .attr('dominant-baseline', baseline)
          .attr('y', yOff)
          .attr('font-size', d.resolvedFontSize)
          .attr('fill', d.textColor)
          .text(d.text || '');
      });

      merged
        .classed('is-selected', (d) => this._selected && this._selected.type === 'node' && this._selected.obj.id === d.id)
        .style('cursor', this._editMode === 'select' ? 'grab' : 'pointer');
      if (this._editMode === 'select') {
        merged.call(this._nodeDragBehavior());
      } else {
        merged.on('.drag', null);
      }
      merged.on('click', (event, d) => this._handleNodeClick(event, d));
    }

    _nodeDragBehavior() {
      if (this._dragBehavior) return this._dragBehavior;
      const self = this;
      let grabOffset = { x: 0, y: 0 };

      this._dragBehavior = d3
        .drag()
        .on('start', (event, d) => {
          self._selectNode(d);
          // Preserve wherever on the node you grabbed it, instead of
          // snapping the node's center to the pointer.
          const [px, py] = d3.pointer(event, self._plane.group.node());
          grabOffset = {
            x: px - self._plane.xScale(d.x),
            y: py - self._plane.yScale(d.y),
          };
        })
        .on('drag', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          d.x = self._plane.xScale.invert(px - grabOffset.x);
          d.y = self._plane.yScale.invert(py - grabOffset.y);
          self.render();
        });
      return this._dragBehavior;
    }

    _handleNodeClick(event, node) {
      if (this._editMode === 'add-line' || this._editMode === 'add-edge') {
        event.stopPropagation();
        const px = this._plane.xScale(node.x);
        const py = this._plane.yScale(node.y);
        this._beginOrCompleteConnector(node.id, px, py);
      }
    }

    // ---- edges / lines ----

    _renderConnectors() {
      if (!this._plane) return;
      const xScale = this._plane.xScale;
      const yScale = this._plane.yScale;
      const data = Array.from(this._connectors.values()).filter((c) => c.visible !== false);

      data.forEach((c) => {
        const fromR = resolveEndpoint(this, c.from);
        const toR = resolveEndpoint(this, c.to);
        const p1 = { x: xScale(fromR.point.x), y: yScale(fromR.point.y) };
        const p2 = { x: xScale(toR.point.x), y: yScale(toR.point.y) };
        c._p1 = p1;
        c._p2 = p2;

        // For a curved edge, trim toward the curve's actual tangent at
        // each end (the quadratic control point), not the straight
        // center-to-center direction -- otherwise the visible curve
        // meets the node boundary at a slight angle instead of exiting
        // along the same radial line its tangent follows.
        const curvature = c instanceof Edge ? c.curvature || 0 : 0;
        let control = null;
        if (curvature) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const offset = curvature * len;
          control = { x: midX + nx * offset, y: midY + ny * offset };
        }
        c._control = control;

        const fromTangentTarget = control || p2;
        const toTangentSource = control || p1;
        c._a = trimToNodeBoundary(p1.x, p1.y, fromTangentTarget.x, fromTangentTarget.y, fromR.node);
        c._b = trimToNodeBoundary(p2.x, p2.y, toTangentSource.x, toTangentSource.y, toR.node);
      });

      this._renderSideFills(data);
      this._renderConnectorPaths(data);
      this._renderConnectorHandles();
    }

    _renderSideFills(data) {
      const plane = this._plane;
      const W = plane.innerWidth;
      const H = plane.innerHeight;
      const box = [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: H },
        { x: 0, y: H },
      ];

      const fillData = [];
      data.forEach((c) => {
        if (!(c instanceof Line)) return;
        if (!c.leftFill && !c.rightFill) return;
        const dir = { x: c._p2.x - c._p1.x, y: c._p2.y - c._p1.y };
        if (Math.hypot(dir.x, dir.y) < 1e-6) return;
        // "left"/"right" relative to from->to, screen coords (y down):
        // left = cross(dir, pt-p) <= 0, right = cross(dir, pt-p) >= 0.
        if (c.leftFill) {
          fillData.push({
            id: `${c.id}-left`,
            points: clipToHalfPlane(box, c._p1, dir, false),
            fill: c.leftFill,
          });
        }
        if (c.rightFill) {
          fillData.push({
            id: `${c.id}-right`,
            points: clipToHalfPlane(box, c._p1, dir, true),
            fill: c.rightFill,
          });
        }
      });

      const sel = plane.fillsGroup.selectAll('.side-fill').data(fillData, (d) => d.id);
      sel.exit().remove();
      const merged = sel.enter().append('polygon').attr('class', 'side-fill').merge(sel);
      merged
        .attr('points', (d) => d.points.map((p) => `${p.x},${p.y}`).join(' '))
        .attr('fill', (d) => d.fill)
        .attr('fill-opacity', 0.18)
        .attr('stroke', 'none');
    }

    _renderConnectorPaths(data) {
      const self = this;
      const group = this._plane.connectorsGroup;
      const sel = group.selectAll('.connector').data(data, (d) => d.id);
      sel.exit().remove();
      const merged = sel
        .enter()
        .append('g')
        .attr('class', (d) => `connector ${d instanceof Line ? 'connector-line' : 'connector-edge'}`)
        .merge(sel);

      merged.each(function (d) {
        const g = d3.select(this);
        let hitSel = g.select('.connector-hit');
        if (hitSel.empty()) {
          hitSel = g.insert('path', ':first-child').attr('class', 'connector-hit').attr('fill', 'none');
        }
        let pathSel = g.select('.connector-path');
        if (pathSel.empty()) {
          pathSel = g.append('path').attr('class', 'connector-path').attr('fill', 'none');
        }

        const isEdge = d instanceof Edge;
        const curvature = isEdge ? d.curvature || 0 : 0;
        const a = d._a;
        const b = d._b;
        let midX = (a.x + b.x) / 2;
        let midY = (a.y + b.y) / 2;
        let pathD;

        if (curvature && d._control) {
          // Same control point _renderConnectors used to pick the trim
          // direction, so the curve actually meets the boundary along
          // that tangent instead of the two no longer matching.
          const cx = d._control.x;
          const cy = d._control.y;
          pathD = `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
          midX = 0.25 * a.x + 0.5 * cx + 0.25 * b.x;
          midY = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
        } else {
          // A line's endpoints (and drag handles) stay put; 'infinite'
          // only changes how far the visible stroke draws past them.
          let drawA = a;
          let drawB = b;
          if (d instanceof Line && d.extent === 'infinite') {
            const dir = { x: b.x - a.x, y: b.y - a.y };
            if (Math.hypot(dir.x, dir.y) > 1e-6) {
              const clipped = clipLineToBox(a, dir, self._plane.innerWidth, self._plane.innerHeight);
              if (clipped) {
                drawA = clipped.a;
                drawB = clipped.b;
              }
            }
          }
          pathD = `M${drawA.x},${drawA.y} L${drawB.x},${drawB.y}`;
        }

        hitSel.attr('d', pathD);

        const stroke = d.stroke || '#2b2f36';
        pathSel.attr('d', pathD).attr('stroke', stroke).attr('stroke-width', d.strokeWidth != null ? d.strokeWidth : 3);

        if (isEdge && d.arrow) {
          pathSel.attr('marker-end', `url(#${self._ensureArrowMarker(stroke)})`);
        } else {
          pathSel.attr('marker-end', null);
        }

        let labelSel = g.select('.connector-label');
        if (d.label) {
          if (labelSel.empty()) {
            labelSel = g.append('text').attr('class', 'connector-label').attr('text-anchor', 'middle');
          }
          labelSel.attr('x', midX).attr('y', midY).text(d.label);
        } else if (!labelSel.empty()) {
          labelSel.remove();
        }
      });

      merged.classed(
        'is-selected',
        (d) => self._selected && self._selected.type === 'connector' && self._selected.obj.id === d.id
      );
      merged
        .select('.connector-hit')
        .style('cursor', self._editMode === 'select' ? 'pointer' : 'default')
        .on('click', (event, d) => {
          if (self._editMode === 'select') {
            event.stopPropagation();
            self._selectConnector(d);
          }
        });
    }

    // A dangling (point, not node-id) endpoint on the selected connector
    // gets a drag handle. Dragging it onto a node snaps from/to that
    // node's id, permanently attaching it; otherwise it stays a free point.
    // A selected Edge also gets a bend handle at the curve's midpoint,
    // for dragging curvature directly instead of setting it by hand.
    _renderConnectorHandles() {
      const group = this._plane.handleGroup;
      const selected =
        this._editMode === 'select' && this._selected && this._selected.type === 'connector'
          ? this._selected.obj
          : null;

      const handles = [];
      if (selected) {
        if (isPointRef(selected.from)) {
          handles.push({ id: `${selected.id}-from`, kind: 'endpoint', connector: selected, key: 'from', pos: selected._a });
        }
        if (isPointRef(selected.to)) {
          handles.push({ id: `${selected.id}-to`, kind: 'endpoint', connector: selected, key: 'to', pos: selected._b });
        }
        if (selected instanceof Edge) {
          handles.push({
            id: `${selected.id}-bend`,
            kind: 'bend',
            connector: selected,
            pos: bendHandlePosition(selected._a, selected._b, selected._control),
          });
        }
      }

      const sel = group.selectAll('.endpoint-handle').data(handles, (d) => d.id);
      sel.exit().remove();
      const merged = sel
        .enter()
        .append('circle')
        .attr('class', (d) => (d.kind === 'bend' ? 'endpoint-handle bend-handle' : 'endpoint-handle'))
        .merge(sel);
      merged.attr('cx', (d) => d.pos.x).attr('cy', (d) => d.pos.y).attr('r', 8);
      merged.filter((d) => d.kind === 'endpoint').call(this._endpointDragBehavior());
      merged.filter((d) => d.kind === 'bend').call(this._bendDragBehavior());
    }

    _endpointDragBehavior() {
      if (this._endpointDrag) return this._endpointDrag;
      const self = this;
      let grabOffset = { x: 0, y: 0 };

      this._endpointDrag = d3
        .drag()
        .on('start', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          grabOffset = { x: px - d.pos.x, y: py - d.pos.y };
        })
        .on('drag', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          const nx = px - grabOffset.x;
          const ny = py - grabOffset.y;
          d.connector[d.key] = {
            x: self._plane.xScale.invert(nx),
            y: self._plane.yScale.invert(ny),
          };
          self.render();
        })
        .on('end', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          const nx = px - grabOffset.x;
          const ny = py - grabOffset.y;
          const snapNode = self._findSnapNode(nx, ny);
          if (snapNode) {
            d.connector[d.key] = snapNode.id;
            self.render();
          }
        });
      return this._endpointDrag;
    }

    // Dragging the bend handle solves for the curvature that puts the
    // on-curve midpoint under the cursor, so it reads as "pull the curve"
    // rather than manipulating an offset number.
    _bendDragBehavior() {
      if (this._bendDrag) return this._bendDrag;
      const self = this;
      let grabOffset = { x: 0, y: 0 };

      this._bendDrag = d3
        .drag()
        .on('start', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          grabOffset = { x: px - d.pos.x, y: py - d.pos.y };
        })
        .on('drag', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          const targetX = px - grabOffset.x;
          const targetY = py - grabOffset.y;
          // Same p1/p2 (untrimmed center) frame _renderConnectors uses to
          // compute the control point, so the curvature this sets is
          // exactly what gets rendered next frame -- not an approximation
          // based on the trimmed a/b, which shift as curvature changes.
          const p1 = d.connector._p1;
          const p2 = d.connector._p2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) return;
          const nx = -dy / len;
          const ny = dx / len;
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const proj = (targetX - midX) * nx + (targetY - midY) * ny;
          d.connector.curvature = proj / len;
          self.render();
        });
      return this._bendDrag;
    }

    // The origin (0,0) always stays the origin -- the drag handle pans
    // the domain (xDomain/yDomain), preserving each axis's span, so that
    // (0,0) ends up wherever you drop it. Nodes/connectors keep their
    // data coordinates; only the mapping to pixels shifts, so everything
    // pans together like the handle is dragging the whole grid.
    _renderPlaneHandles() {
      if (!this._plane) return;
      const group = this._plane.handleGroup;
      const showHandle = this._editMode === 'select' && this._selected && this._selected.type === 'plane';

      const handles = [];
      if (showHandle) {
        handles.push({
          id: 'plane-origin',
          pos: { x: this._plane.xScale(0), y: this._plane.yScale(0) },
        });
      }

      const sel = group.selectAll('.origin-handle').data(handles, (d) => d.id);
      sel.exit().remove();
      const merged = sel.enter().append('circle').attr('class', 'endpoint-handle origin-handle').merge(sel);
      merged.attr('cx', (d) => d.pos.x).attr('cy', (d) => d.pos.y).attr('r', 9).call(this._originDragBehavior());
    }

    _originDragBehavior() {
      if (this._originDrag) return this._originDrag;
      const self = this;
      let grabOffset = { x: 0, y: 0 };

      this._originDrag = d3
        .drag()
        .on('start', (event, d) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          grabOffset = { x: px - d.pos.x, y: py - d.pos.y };
        })
        .on('drag', (event) => {
          const [px, py] = d3.pointer(event, self._plane.group.node());
          self._panOriginTo(px - grabOffset.x, py - grabOffset.y);
          self.render();
          // Keep the X/Y domain number inputs live too, not just the plot.
          self._renderPanel();
        });
      return this._originDrag;
    }

    // Re-derive xDomain/yDomain so data (0,0) maps to pixel (px,py),
    // keeping each axis's span (zoom level) unchanged -- a pure pan.
    _panOriginTo(px, py) {
      const plane = this._plane;
      const [x0, x1] = plane.xScale.domain();
      const [y0, y1] = plane.yScale.domain();
      const spanX = x1 - x0;
      const spanY = y1 - y0;
      const fracX = plane.innerWidth > 0 ? px / plane.innerWidth : 0.5;
      const fracY = plane.innerHeight > 0 ? py / plane.innerHeight : 0.5;

      const newX0 = -spanX * fracX;
      const newY0 = spanY * fracY - spanY;
      plane.opts.xDomain = [newX0, newX0 + spanX];
      plane.opts.yDomain = [newY0, newY0 + spanY];
    }

    // Nearest node whose shape covers (px,py) in pixel space, with a
    // little slack so snapping doesn't require pixel-perfect aim.
    _findSnapNode(px, py) {
      const xScale = this._plane.xScale;
      const yScale = this._plane.yScale;
      let best = null;
      let bestDist = Infinity;
      for (const node of this._nodes.values()) {
        const dist = Math.hypot(px - xScale(node.x), py - yScale(node.y));
        const snapRadius = node.resolvedR + 12;
        if (dist <= snapRadius && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      return best;
    }

    _ensureArrowMarker(color) {
      if (this._arrowMarkers.has(color)) return this._arrowMarkers.get(color);
      const id = `arrow-${this._arrowMarkers.size}`;
      let defs = this.svg.select('defs');
      if (defs.empty()) defs = this.svg.append('defs');
      defs
        .append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M0,0 L10,5 L0,10 z')
        .attr('fill', color);
      this._arrowMarkers.set(color, id);
      return id;
    }

    // ---- edit mode ----

    editable(opts) {
      opts = opts || {};
      this._describe = opts.describe || null;
      this._buildEditPanel();
      if (this._plane) this._wireCanvasInteractions();
      this._setEditMode('select');
      return this;
    }

    _buildEditPanel() {
      if (this._panel) return;
      this._panel = d3.select(this.container).append('div').attr('class', 'diagram-panel');
      this._renderPanel();
    }

    _setEditMode(mode) {
      this._editMode = mode;
      this._clearPending();
      this._selected = null;
      if (this._plane) {
        this._plane.hitRect.style('cursor', mode === 'select' ? 'default' : 'crosshair');
      }
      this._renderPanel();
      this.render();
    }

    // ---- selection + the panel that morphs to match it ----

    _selectNode(node) {
      this._selected = { type: 'node', obj: node };
      this._renderPanel();
      this.render();
    }

    _selectConnector(connector) {
      this._selected = { type: 'connector', obj: connector };
      this._renderPanel();
      this.render();
    }

    // The plane itself is selectable too: click empty canvas with nothing
    // else selected (a click that would otherwise be a no-op).
    _selectPlane() {
      if (!this._plane) return;
      this._selected = { type: 'plane', obj: this._plane };
      this._renderPanel();
      this.render();
    }

    _deselect() {
      if (!this._selected) return;
      this._selected = null;
      this._renderPanel();
      this.render();
    }

    _deleteSelected() {
      if (!this._selected) return;
      if (this._selected.type === 'node') {
        const id = this._selected.obj.id;
        this._nodes.delete(id);
        // Cascade: a connector left pointing at a deleted node id would
        // otherwise resolve to a confusing dangling point at (0,0).
        for (const [cid, c] of this._connectors) {
          if (c.from === id || c.to === id) this._connectors.delete(cid);
        }
      } else if (this._selected.type === 'connector') {
        this._connectors.delete(this._selected.obj.id);
      }
      this._selected = null;
      this._renderPanel();
      this.render();
    }

    _renderPanel() {
      if (!this._panel) return;
      this._panel.selectAll('*').remove();
      if (this._editMode === 'select' && this._selected) {
        if (this._selected.type === 'node') this._renderNodeInspector();
        else if (this._selected.type === 'connector') this._renderConnectorInspector();
        else this._renderPlaneInspector();
      } else {
        this._renderModeToolbar();
      }
    }

    _renderModeToolbar() {
      const self = this;
      this._panel
        .selectAll('button')
        .data(EDIT_MODES)
        .enter()
        .append('button')
        .attr('class', 'diagram-panel-btn')
        .classed('active', (d) => d.id === self._editMode)
        .text((d) => d.label)
        .on('click', (event, d) => self._setEditMode(d.id));
    }

    _renderPanelHeader(title) {
      const row = this._panel.append('div').attr('class', 'panel-header');
      row.append('span').attr('class', 'panel-title').text(title);
      row
        .append('button')
        .attr('class', 'panel-close-btn')
        .text('✕')
        .on('click', () => this._deselect());
    }

    _renderTextInput(label, value, onInput) {
      const group = this._panel.append('div').attr('class', 'panel-group');
      group.append('div').attr('class', 'panel-group-label').text(label);
      group
        .append('input')
        .attr('type', 'text')
        .attr('class', 'panel-text-input')
        .property('value', value || '')
        .on('input', function () {
          onInput(this.value);
        });
    }

    _renderSwatchGroup(label, options, current, onPick) {
      const group = this._panel.append('div').attr('class', 'panel-group');
      group.append('div').attr('class', 'panel-group-label').text(label);
      const row = group.append('div').attr('class', 'panel-swatch-row');
      row
        .selectAll('button')
        .data(options)
        .enter()
        .append('button')
        .attr('class', (o) => `panel-swatch${o.none ? ' panel-swatch-none' : ''}`)
        .classed('active', (o) => o.value === current)
        .style('background-color', (o) => (o.none ? null : o.color))
        .attr('title', (o) => o.label)
        .on('click', (event, o) => onPick(o.value));
    }

    _renderSegmentGroup(label, options, current, onPick) {
      const group = this._panel.append('div').attr('class', 'panel-group');
      group.append('div').attr('class', 'panel-group-label').text(label);
      const row = group.append('div').attr('class', 'panel-segment-row');
      row
        .selectAll('button')
        .data(options)
        .enter()
        .append('button')
        .attr('class', 'panel-segment-btn')
        .classed('active', (o) => o.value === current)
        .text((o) => o.label)
        .on('click', (event, o) => onPick(o.value));
    }

    _renderDeleteButton() {
      this._panel
        .append('button')
        .attr('class', 'panel-delete-btn')
        .text('Delete')
        .on('click', () => this._deleteSelected());
    }

    _renderNodeInspector() {
      const node = this._selected.obj;
      const self = this;
      this._renderPanelHeader('Node');
      this._renderTextInput('Label', node.text, (v) => {
        node.text = v;
        self.render();
      });
      this._renderSwatchGroup('Color', CLS_SWATCHES, node.cls || 'neutral', (v) => {
        node.cls = v;
        self.render();
        self._renderPanel();
      });
      this._renderSegmentGroup('Label pos', PLACEMENT_OPTIONS, node.textPlacement || 'below', (v) => {
        node.textPlacement = v;
        self.render();
        self._renderPanel();
      });
      this._renderSegmentGroup('Font', SIZE_OPTIONS, node.fontKey || 'm', (v) => {
        node.fontKey = v;
        self.render();
        self._renderPanel();
      });
      this._renderSegmentGroup('Size', SIZE_OPTIONS, node.sizeKey || 'm', (v) => {
        node.sizeKey = v;
        self.render();
        self._renderPanel();
      });
      this._renderDeleteButton();
    }

    _renderConnectorInspector() {
      const c = this._selected.obj;
      const self = this;
      const isLine = c instanceof Line;
      this._renderPanelHeader(isLine ? 'Line' : 'Edge');
      this._renderTextInput('Label', c.label, (v) => {
        c.label = v;
        self.render();
      });
      if (isLine) {
        this._renderSegmentGroup('Extent', EXTENT_OPTIONS, c.extent || 'segment', (v) => {
          c.extent = v;
          self.render();
          self._renderPanel();
        });
        this._renderSwatchGroup('Fill left', FILL_SWATCHES, c.leftFill || null, (v) => {
          c.leftFill = v || undefined;
          self.render();
          self._renderPanel();
        });
        this._renderSwatchGroup('Fill right', FILL_SWATCHES, c.rightFill || null, (v) => {
          c.rightFill = v || undefined;
          self.render();
          self._renderPanel();
        });
      }
      this._renderDeleteButton();
    }

    _renderPlaneInspector() {
      const plane = this._selected.obj;
      const self = this;
      this._renderPanelHeader('Plane');

      this._renderTextInput('X label', plane.opts.xLabel, (v) => {
        plane.opts.xLabel = v;
        self.render();
      });
      this._renderTextInput('Y label', plane.opts.yLabel, (v) => {
        plane.opts.yLabel = v;
        self.render();
      });
      this._renderSegmentGroup('Grid', GRID_OPTIONS, plane.opts.grid ? 'on' : 'off', (v) => {
        plane.opts.grid = v === 'on';
        self.render();
        self._renderPanel();
      });
      this._renderDomainGroup('X domain', plane.xScale, (domain) => {
        plane.opts.xDomain = domain;
        self.render();
        self._renderPanel();
      });
      this._renderDomainGroup('Y domain', plane.yScale, (domain) => {
        plane.opts.yDomain = domain;
        self.render();
        self._renderPanel();
      });
      // Origin has no corner/center toggle -- drag the teal handle where
      // the axes cross instead.
      this._renderExportButton();
    }

    _renderDomainGroup(label, scale, onCommit) {
      const [lo, hi] = scale.domain();
      const group = this._panel.append('div').attr('class', 'panel-group');
      group.append('div').attr('class', 'panel-group-label').text(label);
      const row = group.append('div').attr('class', 'panel-domain-row');
      const minInput = row
        .append('input')
        .attr('type', 'number')
        .attr('class', 'panel-number-input')
        .property('value', round2(lo));
      row.append('span').attr('class', 'panel-domain-sep').text('to');
      const maxInput = row
        .append('input')
        .attr('type', 'number')
        .attr('class', 'panel-number-input')
        .property('value', round2(hi));

      const commit = () => {
        const newLo = parseFloat(minInput.property('value'));
        const newHi = parseFloat(maxInput.property('value'));
        if (Number.isFinite(newLo) && Number.isFinite(newHi) && newLo < newHi) {
          onCommit([newLo, newHi]);
        }
      };
      minInput.on('change', commit);
      maxInput.on('change', commit);
    }

    // ---- code export: turn the live model into a paste-able app script ----

    _renderExportButton() {
      const self = this;
      const btn = this._panel.append('button').attr('class', 'diagram-panel-btn').text('Copy code');
      btn.on('click', () => self._copyToClipboard(self._exportCode(), btn));
    }

    _copyToClipboard(text, btn) {
      const original = btn.text();
      const showCopied = () => {
        btn.text('Copied!');
        setTimeout(() => btn.text(original), 1400);
      };
      const clipboard = global.navigator && global.navigator.clipboard;
      if (clipboard && clipboard.writeText) {
        clipboard.writeText(text).then(showCopied, () => this._legacyCopy(text, showCopied));
      } else {
        this._legacyCopy(text, showCopied);
      }
    }

    // execCommand fallback for contexts where the async Clipboard API is
    // unavailable or denied (some sandboxed iframes).
    _legacyCopy(text, onDone) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        // Best effort -- nothing more to do without clipboard permission.
      }
      document.body.removeChild(textarea);
      onDone();
    }

    // node.id values are auto-generated ('n1', 'n2', ...) and meaningless
    // to read; export instead uses a short per-node letter (a, b, ... z,
    // aa, bb, ...) plus the node's own snake_case label, e.g. 'a_gloomy_free'.
    // The letter alone (unique by construction) also names connectors,
    // e.g. 'a_b_edge', keeping those short even though node ids are long.
    _buildNodeIdMap() {
      const idMap = new Map();
      const letterMap = new Map();
      let i = 0;
      for (const node of this._nodes.values()) {
        const letter = letterCode(i++);
        letterMap.set(node.id, letter);
        const slug = slugify(node.text);
        idMap.set(node.id, slug ? `${letter}_${slug}` : letter);
      }
      return { idMap, letterMap };
    }

    _connectorEndpointLetter(ref, letterMap) {
      return typeof ref === 'string' ? letterMap.get(ref) || 'pt' : 'pt';
    }

    _uniqueId(base, used) {
      let candidate = base;
      let n = 2;
      while (used.has(candidate)) {
        candidate = `${base}_${n}`;
        n += 1;
      }
      used.add(candidate);
      return candidate;
    }

    _formatRef(ref, idMap) {
      if (ref && typeof ref === 'object') {
        return { x: round2(ref.x), y: round2(ref.y) };
      }
      if (typeof ref === 'string') {
        return idMap.get(ref) || ref;
      }
      return ref;
    }

    _buildPlaneExportOpts() {
      const opts = this._plane.opts;
      const out = {};
      const [x0, x1] = this._plane.xScale.domain();
      const [y0, y1] = this._plane.yScale.domain();
      // No origin field: axes always cross at (0,0) now, and the domain
      // alone captures wherever panning left it.
      out.xDomain = [round2(x0), round2(x1)];
      out.yDomain = [round2(y0), round2(y1)];
      if (opts.xLabel) out.xLabel = opts.xLabel;
      if (opts.yLabel) out.yLabel = opts.yLabel;
      if (opts.grid) out.grid = true;
      return out;
    }

    _buildNodeExportOpts(node, id) {
      const out = { id, x: round2(node.x), y: round2(node.y) };
      if (node.text) out.text = node.text;
      if (node.cls) out.cls = node.cls;
      if (node.shape && node.shape !== 'circle') out.shape = node.shape;
      if (node.sizeKey && node.sizeKey !== 'm') out.sizeKey = node.sizeKey;
      if (node.fontKey && node.fontKey !== 'm') out.fontKey = node.fontKey;
      if (node.textPlacement && node.textPlacement !== 'below') out.textPlacement = node.textPlacement;
      if (node.fill) out.fill = node.fill;
      if (node.stroke) out.stroke = node.stroke;
      if (node.strokeWidth != null) out.strokeWidth = node.strokeWidth;
      if (node.textFill) out.textFill = node.textFill;
      if (node.r != null) out.r = node.r;
      if (node.size != null) out.size = node.size;
      if (node.visible === false) out.visible = false;
      return out;
    }

    _buildConnectorExportOpts(c, idMap, id) {
      const out = { id, from: this._formatRef(c.from, idMap), to: this._formatRef(c.to, idMap) };
      if (c.label) out.label = c.label;
      if (c instanceof Edge) {
        if (c.arrow) out.arrow = true;
        if (c.curvature) out.curvature = round2(c.curvature);
      }
      if (c instanceof Line) {
        if (c.extent && c.extent !== 'segment') out.extent = c.extent;
        if (c.leftFill) out.leftFill = c.leftFill;
        if (c.rightFill) out.rightFill = c.rightFill;
      }
      if (c.stroke && c.stroke !== '#2b2f36') out.stroke = c.stroke;
      if (c.strokeWidth != null && c.strokeWidth !== 3) out.strokeWidth = c.strokeWidth;
      return out;
    }

    _exportCode() {
      const { idMap, letterMap } = this._buildNodeIdMap();
      const usedConnectorIds = new Set();
      const lines = ["const g = Diagram('#app');", ''];

      lines.push(`g.plane(${formatObjectLiteral(this._buildPlaneExportOpts())});`, '');

      const nodeLines = [];
      for (const node of this._nodes.values()) {
        const opts = this._buildNodeExportOpts(node, idMap.get(node.id));
        nodeLines.push(`g.node(${formatObjectLiteral(opts)});`);
      }
      if (nodeLines.length) lines.push(...nodeLines, '');

      const connectorLines = [];
      for (const c of this._connectors.values()) {
        const call = c instanceof Line ? 'line' : 'edge';
        const fromLetter = this._connectorEndpointLetter(c.from, letterMap);
        const toLetter = this._connectorEndpointLetter(c.to, letterMap);
        const id = this._uniqueId(`${fromLetter}_${toLetter}_${call}`, usedConnectorIds);
        const opts = this._buildConnectorExportOpts(c, idMap, id);
        connectorLines.push(`g.${call}(${formatObjectLiteral(opts)});`);
      }
      if (connectorLines.length) lines.push(...connectorLines);

      return lines.join('\n').trim() + '\n';
    }

    _wireCanvasInteractions() {
      if (!this._plane || this._canvasWired) return;
      this._canvasWired = true;
      this._plane.hitRect
        .on('click', (event) => this._handleCanvasClick(event))
        .on('mousemove', (event) => this._handleCanvasMouseMove(event));
      d3.select(global).on('keydown.diagram-edit', (event) => {
        if (event.key === 'Escape') this._setEditMode(this._editMode);
      });
    }

    _handleCanvasClick(event) {
      if (this._editMode === 'select') {
        if (this._selected) {
          this._deselect();
        } else {
          this._selectPlane();
        }
        return;
      }
      const [px, py] = d3.pointer(event, this._plane.group.node());
      const dataX = this._plane.xScale.invert(px);
      const dataY = this._plane.yScale.invert(py);

      if (this._editMode === 'add-node') {
        const text = this._describe ? this._describe(dataX, dataY) : '';
        const n = this.node({ x: dataX, y: dataY, cls: 'neutral', text });
        this._finishDrawAndSelect({ type: 'node', obj: n });
        return;
      }

      if (this._editMode === 'add-line' || this._editMode === 'add-edge') {
        this._beginOrCompleteConnector({ x: dataX, y: dataY }, px, py);
      }
    }

    _handleCanvasMouseMove(event) {
      if (!this._pendingPixel) return;
      const [px, py] = d3.pointer(event, this._plane.group.node());
      this._updatePendingPreview(px, py);
    }

    _beginOrCompleteConnector(ref, px, py) {
      const kind = this._editMode;
      if (!this._pendingRef) {
        this._pendingRef = ref;
        this._showPendingMarker(px, py);
        return;
      }
      const from = this._pendingRef;
      this._clearPending();
      const connector = kind === 'add-line' ? this.line({ from, to: ref }) : this.edge({ from, to: ref, arrow: true });
      this._finishDrawAndSelect({ type: 'connector', obj: connector });
    }

    // One-shot draw tools: place/complete a single node or connector, then
    // drop back into Select/Move with the new thing selected, ready to
    // tweak -- instead of staying "stuck" in add mode for repeated draws.
    _finishDrawAndSelect(selection) {
      this._editMode = 'select';
      this._pendingRef = null;
      this._pendingPixel = null;
      if (this._plane) {
        this._plane.editGroup.selectAll('*').remove();
        this._plane.hitRect.style('cursor', 'default');
      }
      this._selected = selection;
      this._renderPanel();
      this.render();
    }

    _showPendingMarker(px, py) {
      const g = this._plane.editGroup;
      g.selectAll('*').remove();
      g.append('circle').attr('class', 'edit-pending-marker').attr('cx', px).attr('cy', py).attr('r', 6);
      this._pendingPixel = { x: px, y: py };
    }

    _updatePendingPreview(px, py) {
      const g = this._plane.editGroup;
      let line = g.select('.edit-preview-line');
      if (line.empty()) line = g.insert('line', ':first-child').attr('class', 'edit-preview-line');
      line.attr('x1', this._pendingPixel.x).attr('y1', this._pendingPixel.y).attr('x2', px).attr('y2', py);
    }

    _clearPending() {
      this._pendingRef = null;
      this._pendingPixel = null;
      if (this._plane) this._plane.editGroup.selectAll('*').remove();
    }
  }

  global.Diagram = function (container, opts) {
    return new DiagramCore(container, opts);
  };

  function formatControlValue(n) {
    return String(round2(n));
  }

  /**
   * A plain-HTML control panel (sliders, buttons) that writes into a
   * `state` object -- usually the same one one or more Diagrams were
   * constructed with (`Diagram(container, {state})`), so a single slider
   * can drive several diagrams at once. Not tied to a Plane/SVG: sliders
   * are DOM, not marks on a coordinate space. Diagrams don't auto-react
   * to state changes; controls call whatever .render()s they need to
   * after writing into state, same as any other model mutation.
   */
  class ControlsPanel {
    constructor(container, state) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error(`Controls: container not found: ${container}`);
      }
      this.state = state || {};

      injectStyles();

      this.container.classList.add('controls-root');
      this.panel = d3.select(this.container).append('div').attr('class', 'controls-panel');
    }

    slider(opts) {
      opts = opts || {};
      const bind = opts.bind;
      const min = opts.min != null ? opts.min : 0;
      const max = opts.max != null ? opts.max : 1;
      const step = opts.step != null ? opts.step : (max - min) / 100;
      const initial = opts.value != null ? opts.value : bind && this.state[bind] != null ? this.state[bind] : min;
      if (bind) this.state[bind] = initial;

      const row = this.panel.append('div').attr('class', 'controls-row');
      const header = row.append('div').attr('class', 'controls-row-header');
      header.append('span').attr('class', 'controls-label').text(opts.label || bind || '');
      const valueLabel = header.append('span').attr('class', 'controls-value').text(formatControlValue(initial));

      const input = row
        .append('input')
        .attr('type', 'range')
        .attr('class', 'controls-slider')
        .attr('min', min)
        .attr('max', max)
        .attr('step', step)
        .property('value', initial);

      const self = this;
      input.on('input', function () {
        const v = parseFloat(this.value);
        if (bind) self.state[bind] = v;
        valueLabel.text(formatControlValue(v));
        if (opts.onInput) opts.onInput(v, self.state);
      });

      return this;
    }

    button(opts) {
      opts = opts || {};
      const row = this.panel.append('div').attr('class', 'controls-row');
      row
        .append('button')
        .attr('class', 'controls-btn')
        .text(opts.label || 'Button')
        .on('click', () => {
          if (opts.onClick) opts.onClick(this.state);
        });
      return this;
    }
  }

  global.Controls = function (container, state) {
    return new ControlsPanel(container, state);
  };
})(window);
