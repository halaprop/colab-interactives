import ForceGraph3D from 'https://cdn.jsdelivr.net/npm/3d-force-graph/+esm';
import SpriteText from 'https://cdn.jsdelivr.net/npm/three-spritetext/+esm';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three/+esm';
import { forceX, forceY, forceZ, forceManyBody, forceCollide } from 'https://cdn.jsdelivr.net/npm/d3-force-3d/+esm';
import { loadFixture } from '../shared.js';

// ---- tunables ----
const VOCAB_POOL_SIZE = 3000;      // candidate words considered for clustering
const NUM_CLUSTERS = 18;
const POINTS_PER_CLUSTER = 12;     // -> up to 216 visualized dots total
const LABEL_EVERY_N = 6;           // extra labels per cluster beyond the guaranteed rank-0 word

const SCATTER_RADIUS = 500;        // scatter explosion sphere
const SCATTER_ANIM_MS = 700;       // duration of the explosion tween
const LOCUS_RADIUS = 200;          // PCA-projected cluster centroid spread

const CHARGE_STRENGTH = -14;       // forceManyBody, general repulsion
const COLLIDE_RADIUS = 7;

const ATTRACTION_STRENGTH = 0.08;  // constant forceX/Y/Z strength - NOT ramped, see below
const TARGET_ALPHA_DECAY = 0.003;  // alpha stays meaningfully non-zero through the whole reveal
const TARGET_VELOCITY_DECAY = 0.8; // heavy friction is what actually paces convergence to ~15-20s -
                                    // it slows the approach to equilibrium without changing the equilibrium
                                    // itself (unlike strength, which is coupled to charge and would distort
                                    // the cluster shape if tuned down instead)

const LOCUS_LIVE_BLEND = 0.35;     // how much of a cluster's target is its members' live centroid vs. its fixed anchor

// tuned to frame the CONVERGED clusters (~LOCUS_RADIUS plus per-cluster
// cloud spread) nicely with a little margin - this means the wider Scatter
// spread (SCATTER_RADIUS) will overflow the frame at rest, which is fine:
// the payoff view (post-Train) matters more than the pre-Train one, and
// scroll-to-zoom is available to pull back and see the full scatter
const ORBIT_RADIUS = 550;
const ORBIT_Y = 72;
const ORBIT_PERIOD_MS = 100000;

const FOCUS_DISTANCE = 220;   // camera distance when focusing on a clicked cluster
const FOCUS_TRANSITION_MS = 1000;

const KMEANS_MAX_ITERS = 50;

const LABEL_SECONDARY_TEXT_HEIGHT = 5;
const LABEL_PROTOTYPE_TEXT_HEIGHT = 8;
const LABEL_PROTOTYPE_FONT_WEIGHT = 'bold';

// closed-class function words - excluded so clustering runs over meaningful
// content words instead of grammatical glue
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'by', 'from', 'as', 'into', 'onto', 'over', 'under', 'up', 'down', 'out', 'off', 'about',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers',
  'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs',
  'not', 'no', 'so', 'if', 'than', 'then', 'there', 'here', 'when', 'where', 'while', 'which',
  'who', 'whom', 'whose', 'what', 'why', 'how',
  'all', 'any', 'some', 'few', 'more', 'most', 'other', 'others', 'such', 'own', 'same',
  'each', 'every', 'both', 'either', 'neither',
  'very', 'too', 'just', 'only', 'also', 'again', 'once', 'ever', 'never', 'still', 'yet',
  'because', 'although', 'though', 'since', 'until', 'unless', 'whether',
  'between', 'through', 'during', 'before', 'after', 'above', 'below', 'against',
  'one', 'two', 'first', 'last', 'new', 'old',
]);

// ---- DOM scaffold ----
const root = document.querySelector('#app');
root.classList.add('word-math');
root.innerHTML = `
  <style>
    .word-math {
      color-scheme: light;
      --surface: #fcfcfb;
      --ink-primary: #0b0b0b;
      --ink-secondary: #52514e;
      --ink-muted: #898781;
      --border: rgba(11, 11, 11, 0.10);
      --accent: #2a78d6;
      display: flex;
      flex-direction: row;
      width: 100%;
      box-sizing: border-box;
      background: var(--surface);
      color: var(--ink-primary);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .word-math {
        color-scheme: dark;
        --surface: #1a1a19;
        --ink-primary: #ffffff;
        --ink-secondary: #c3c2b7;
        --ink-muted: #898781;
        --border: rgba(255, 255, 255, 0.10);
        --accent: #3987e5;
      }
    }
    .word-math .sidebar {
      /* fixed dark panel, independent of light/dark theme, to match the
         canvas's own fixed-dark background instead of popping against it */
      color-scheme: dark;
      --surface: #1a1a19;
      --ink-primary: #ffffff;
      --ink-secondary: #c3c2b7;
      --border: rgba(255, 255, 255, 0.10);
      --accent: #3987e5;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: 12px;
      width: 160px;
      box-sizing: border-box;
      padding: 14px 8px;
      background: var(--surface);
      color: var(--ink-primary);
      border-right: 1px solid var(--border);
    }
    .word-math .action-btn {
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--accent);
    }
    .word-math .action-btn.btn-primary {
      background: var(--accent);
      color: #fff;
    }
    .word-math .action-btn.btn-outline {
      background: transparent;
      color: var(--accent);
    }
    .word-math .action-btn:active {
      opacity: 0.8;
    }
    .word-math .orbit-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ink-secondary);
      cursor: pointer;
    }
    .word-math .canvas-wrap {
      flex: 1;
      min-height: 0;
      position: relative;
    }
  </style>
  <div class="sidebar">
    <label class="orbit-toggle">
      <input type="checkbox" class="orbit-checkbox">
      Orbit
    </label>
    <button class="scatter-btn action-btn btn-primary" type="button">Scatter</button>
    <button class="train-btn action-btn btn-outline" type="button">Train</button>
  </div>
  <div class="canvas-wrap"></div>
`;

const canvasWrap = root.querySelector('.canvas-wrap');
const scatterButton = root.querySelector('.scatter-btn');
const trainButton = root.querySelector('.train-btn');
const orbitCheckbox = root.querySelector('.orbit-checkbox');

main();

async function main() {
  const { words, dims, table } = await loadFixture(import.meta.url);
  const pool = buildVocabPool(words, table, dims);
  const clusters = kMeans(pool, NUM_CLUSTERS);
  pcaLoci(clusters);
  const nodes = buildNodes(clusters);

  const originGeometry = new THREE.BufferGeometry();
  const originPositions = new Float32Array(nodes.length * 2 * 3);
  originGeometry.setAttribute('position', new THREE.BufferAttribute(originPositions, 3));
  const originMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
  const originLines = new THREE.LineSegments(originGeometry, originMaterial);

  function updateOriginLines() {
    nodes.forEach((n, i) => {
      const base = i * 6;
      originPositions[base] = 0;
      originPositions[base + 1] = 0;
      originPositions[base + 2] = 0;
      originPositions[base + 3] = n.x;
      originPositions[base + 4] = n.y;
      originPositions[base + 5] = n.z;
    });
    originGeometry.attributes.position.needsUpdate = true;
  }

  function updateClusterTargets() {
    for (const cluster of clusters) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      // sum over non-prototype members only, for memberCentroid below - the
      // prototype excludes itself so it chases its cluster-mates, not itself
      let osx = 0;
      let osy = 0;
      let osz = 0;
      for (const node of cluster.nodes) {
        sx += node.x;
        sy += node.y;
        sz += node.z;
        if (!node.isPrototype) {
          osx += node.x;
          osy += node.y;
          osz += node.z;
        }
      }
      const n = cluster.nodes.length;
      cluster.target.x = lerp(cluster.anchor.x, sx / n, LOCUS_LIVE_BLEND);
      cluster.target.y = lerp(cluster.anchor.y, sy / n, LOCUS_LIVE_BLEND);
      cluster.target.z = lerp(cluster.anchor.z, sz / n, LOCUS_LIVE_BLEND);

      const on = n - 1;
      cluster.memberCentroid.x = osx / on;
      cluster.memberCentroid.y = osy / on;
      cluster.memberCentroid.z = osz / on;

      // place the prototype directly at its cluster-mates' live center each
      // tick, rather than relying on a stronger attraction force to converge
      // there - a boosted force still has to fight the same repulsion as
      // everyone else, and against a target that itself keeps shifting (the
      // live centroid), that never actually closes the gap in practice
      // (measured ~35-46 units of tracking error even at 1.8x strength).
      // A direct override is exact and has no tuning to get wrong. Skipped
      // while the prototype is pinned (frozen pre-Train, or mid-drag) so it
      // doesn't fight the freeze or a user's drag.
      const proto = cluster.nodes[0]; // prototype is always index 0 - see buildNodes()
      if (proto.fx === undefined) {
        proto.x = cluster.memberCentroid.x;
        proto.y = cluster.memberCentroid.y;
        proto.z = cluster.memberCentroid.z;
        proto.vx = 0;
        proto.vy = 0;
        proto.vz = 0;
      }
    }
  }

  const graph = new ForceGraph3D(canvasWrap)
    .width(canvasWrap.clientWidth)
    .height(canvasWrap.clientHeight)
    .backgroundColor('#05050a')
    .enableNodeDrag(false) // only turned on once Train has run - see train()/scatter(); dragging is the
                            // "nudge its cluster" interaction and only makes sense once a cluster exists.
                            // Disabling it while frozen also means a click's inevitable tiny mouse jitter
                            // can never get misread as a drag, which was releasing individual pinned nodes
                            // early and sending them flying off alone toward their cluster target.
    .enableNavigationControls(!orbitCheckbox.checked) // mouse drag-to-orbit + scroll-to-zoom, off while auto-orbit drives the camera
    .showNavInfo(false)
    .nodeColor((d) => d.color)
    .nodeVal(1)
    .nodeThreeObjectExtend(true)
    .nodeThreeObject((d) => (d.hasLabel ? makeLabelSprite(d) : undefined))
    .cooldownTime(Infinity)
    .onEngineTick(() => {
      updateClusterTargets();
      updateOriginLines();
    })
    .onNodeDragEnd((node) => {
      node.fx = undefined;
      node.fy = undefined;
      node.fz = undefined;
      graph.d3ReheatSimulation();
    })
    .onNodeClick((node) => {
      // before Train is clicked, nodes are pinned (fx/fy/fz set) and the
      // cluster hasn't formed yet - focus on the node's own current spot,
      // not its eventual (still-anchor-only) cluster target
      const isPinned = node.fx !== undefined;
      if (isPinned) {
        node.hasLabel = true;
      } else {
        // trained: reveal the whole cluster the clicked word belongs to
        for (const n of clusters[node.clusterIndex].nodes) n.hasLabel = true;
      }
      graph.refresh();
      focusOnPoint(graph, isPinned ? node : clusters[node.clusterIndex].target);
    })
    .cameraPosition({ x: 0, y: ORBIT_Y, z: ORBIT_RADIUS });

  graph.d3Force('center', null);
  graph.d3Force('link', null);
  graph.d3Force('charge', forceManyBody().strength(CHARGE_STRENGTH));
  graph.d3Force('collide', forceCollide(COLLIDE_RADIUS));
  graph.d3Force('x', forceX((d) => d.target.x).strength(ATTRACTION_STRENGTH));
  graph.d3Force('y', forceY((d) => d.target.y).strength(ATTRACTION_STRENGTH));
  graph.d3Force('z', forceZ((d) => d.target.z).strength(ATTRACTION_STRENGTH));
  graph.d3AlphaDecay(TARGET_ALPHA_DECAY);
  graph.d3VelocityDecay(TARGET_VELOCITY_DECAY);

  graph.scene().add(originLines);
  graph.graphData({ nodes, links: [] });
  updateOriginLines();

  new ResizeObserver(() => {
    graph.width(canvasWrap.clientWidth).height(canvasWrap.clientHeight);
  }).observe(canvasWrap);

  scatterButton.addEventListener('click', () => {
    scatter(nodes, graph);
    setPrimaryButton(trainButton, scatterButton);
  });
  trainButton.addEventListener('click', () => {
    train(nodes, graph);
    setPrimaryButton(scatterButton, trainButton);
  });
  orbitCheckbox.addEventListener('change', () => {
    graph.enableNavigationControls(!orbitCheckbox.checked);
  });

  startCameraOrbit(graph, orbitCheckbox);
}

// ---- vocabulary / clustering / layout ----

function buildVocabPool(words, table, dims) {
  const pool = [];
  for (let i = 0; i < words.length && pool.length < VOCAB_POOL_SIZE; i++) {
    const word = words[i];
    if (!/^[a-z]{2,}$/i.test(word) || STOPWORDS.has(word.toLowerCase())) continue;
    pool.push({ word, vec: table.subarray(i * dims, (i + 1) * dims) });
  }
  return pool;
}

function kMeans(pool, k) {
  const dims = pool[0].vec.length;
  const centroids = kMeansPlusPlusInit(pool, k);
  let assignments = new Array(pool.length).fill(-1);

  for (let iter = 0; iter < KMEANS_MAX_ITERS; iter++) {
    const newAssignments = pool.map((p) => {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = sqDist(p.vec, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best;
    });

    let changed = false;
    for (let i = 0; i < pool.length; i++) {
      if (newAssignments[i] !== assignments[i]) changed = true;
    }
    assignments = newAssignments;

    const sums = Array.from({ length: k }, () => new Float64Array(dims));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < pool.length; i++) {
      const c = assignments[i];
      counts[c]++;
      const v = pool[i].vec;
      for (let d = 0; d < dims; d++) sums[c][d] += v[d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        let farthestIdx = 0;
        let farthestDist = -1;
        for (let i = 0; i < pool.length; i++) {
          const d = sqDist(pool[i].vec, centroids[assignments[i]]);
          if (d > farthestDist) {
            farthestDist = d;
            farthestIdx = i;
          }
        }
        centroids[c] = Float64Array.from(pool[farthestIdx].vec);
        console.warn(`word-math-4: cluster ${c} was empty, reseeded from "${pool[farthestIdx].word}"`);
        changed = true;
        continue;
      }
      for (let d = 0; d < dims; d++) centroids[c][d] = sums[c][d] / counts[c];
    }

    if (!changed) break;
  }

  const clusters = Array.from({ length: k }, () => ({ centroid: null, members: [] }));
  clusters.forEach((cluster, c) => {
    cluster.centroid = centroids[c];
  });
  for (let i = 0; i < pool.length; i++) clusters[assignments[i]].members.push(pool[i]);

  for (const cluster of clusters) {
    cluster.members.sort((a, b) => sqDist(a.vec, cluster.centroid) - sqDist(b.vec, cluster.centroid));
    cluster.members = cluster.members.slice(0, POINTS_PER_CLUSTER);
  }
  return clusters;
}

function kMeansPlusPlusInit(pool, k) {
  const centroids = [];
  const first = pool[Math.floor(Math.random() * pool.length)];
  centroids.push(Float64Array.from(first.vec));
  const distSq = pool.map((p) => sqDist(p.vec, centroids[0]));

  while (centroids.length < k) {
    const total = distSq.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= distSq[idx];
      if (r <= 0) break;
    }
    const next = Float64Array.from(pool[idx].vec);
    centroids.push(next);
    for (let i = 0; i < pool.length; i++) {
      const d = sqDist(pool[i].vec, next);
      if (d < distSq[i]) distSq[i] = d;
    }
  }
  return centroids;
}

function sqDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

// hand-rolled PCA (power iteration + deflation) - the cluster set is tiny
// (k centroids x 50 dims), so a full library is unwarranted
function pcaLoci(clusters) {
  const dims = clusters[0].centroid.length;
  const k = clusters.length;

  const mean = new Float64Array(dims);
  for (const c of clusters) for (let d = 0; d < dims; d++) mean[d] += c.centroid[d] / k;

  const centered = clusters.map((c) => {
    const v = new Float64Array(dims);
    for (let d = 0; d < dims; d++) v[d] = c.centroid[d] - mean[d];
    return v;
  });

  const cov = Array.from({ length: dims }, () => new Float64Array(dims));
  for (const v of centered) {
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        cov[i][j] += (v[i] * v[j]) / k;
      }
    }
  }

  const components = [];
  for (let comp = 0; comp < 3; comp++) {
    let vec = normalize(Float64Array.from({ length: dims }, () => Math.random() * 2 - 1));
    for (let iter = 0; iter < 100; iter++) {
      vec = normalize(matVec(cov, vec));
    }
    const eigenvalue = dot(vec, matVec(cov, vec));
    components.push(vec);
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        cov[i][j] -= eigenvalue * vec[i] * vec[j];
      }
    }
  }

  const projected = centered.map((v) => components.map((c) => dot(v, c)));
  let maxMag = 0;
  for (const p of projected) {
    const mag = Math.hypot(p[0], p[1], p[2]);
    if (mag > maxMag) maxMag = mag;
  }
  const scale = maxMag > 0 ? LOCUS_RADIUS / maxMag : 1;

  clusters.forEach((cluster, i) => {
    cluster.anchor = {
      x: projected[i][0] * scale,
      y: projected[i][1] * scale,
      z: projected[i][2] * scale,
    };
  });
}

function matVec(mat, vec) {
  const out = new Float64Array(vec.length);
  for (let i = 0; i < mat.length; i++) {
    let sum = 0;
    for (let j = 0; j < vec.length; j++) sum += mat[i][j] * vec[j];
    out[i] = sum;
  }
  return out;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v) {
  const n = Math.hypot(...v) || 1;
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

function buildNodes(clusters) {
  const nodes = [];
  clusters.forEach((cluster, ci) => {
    const hue = (360 * ci) / NUM_CLUSTERS;
    cluster.baseColor = `hsl(${hue}, 65%, 55%)`;
    cluster.prototypeColor = `hsl(${hue}, 70%, 85%)`;
    cluster.target = { ...cluster.anchor };
    cluster.memberCentroid = { ...cluster.anchor }; // live position the prototype gets pinned to - see updateClusterTargets()
    cluster.nodes = [];

    cluster.members.forEach((member, mi) => {
      const isPrototype = mi === 0;
      const satJ = clamp(65 + rand(-10, 10), 40, 85);
      const lightJ = clamp(55 + rand(-8, 8), 35, 70);
      const hueJ = hue + rand(-6, 6);

      const node = {
        id: `${ci}-${mi}`,
        word: member.word,
        clusterIndex: ci,
        target: cluster.target,
        color: `hsl(${hueJ}, ${satJ}%, ${lightJ}%)`,
        baseColor: cluster.baseColor,
        prototypeColor: cluster.prototypeColor,
        isPrototype,
        hasLabel: isPrototype || (mi > 0 && mi % LABEL_EVERY_N === 0),
        x: 0,
        y: 0,
        z: 0,
        fx: 0,
        fy: 0,
        fz: 0,
      };
      nodes.push(node);
      cluster.nodes.push(node);
    });
  });
  return nodes;
}

// ---- rendering helpers ----

function makeLabelSprite(node) {
  const sprite = new SpriteText(node.word);
  if (node.isPrototype) {
    sprite.color = node.prototypeColor;
    sprite.textHeight = LABEL_PROTOTYPE_TEXT_HEIGHT;
    sprite.fontWeight = LABEL_PROTOTYPE_FONT_WEIGHT;
  } else {
    sprite.color = node.baseColor;
    sprite.textHeight = LABEL_SECONDARY_TEXT_HEIGHT;
  }
  sprite.material.depthWrite = false;
  sprite.position.set(0, 4, 0);
  return sprite;
}

let scatterToken = 0; // invalidates an in-flight tween if Scatter is clicked again before it finishes

// tweens words out to random positions and freezes them there (pinned via
// fx/fy/fz) so the random distribution is visible and stays put until Train
// is clicked - lets a class look at "before" before committing to "after".
// Pins every node at its CURRENT spot first (halting any in-progress
// training instantly, even mid-convergence) and keeps re-pinning it at each
// interpolated point for the whole tween, so the live force simulation can
// never fight the animation or perturb the frozen result.
function scatter(nodes, graph) {
  const myToken = ++scatterToken;
  graph.enableNodeDrag(false); // dragging only makes sense once Train has formed a cluster to nudge

  const starts = nodes.map((n) => ({ x: n.x, y: n.y, z: n.z }));
  const ends = nodes.map(() => randomPointInSphere(SCATTER_RADIUS));
  for (const n of nodes) {
    n.fx = n.x;
    n.fy = n.y;
    n.fz = n.z;
    n.vx = 0;
    n.vy = 0;
    n.vz = 0;
  }

  const startTime = performance.now();
  function frame(now) {
    if (myToken !== scatterToken) return; // superseded by a newer Scatter click
    const t = Math.min(1, (now - startTime) / SCATTER_ANIM_MS);
    const eased = 1 - (1 - t) ** 3; // ease-out cubic - fast burst, gentle settle
    nodes.forEach((n, i) => {
      const x = lerp(starts[i].x, ends[i].x, eased);
      const y = lerp(starts[i].y, ends[i].y, eased);
      const z = lerp(starts[i].z, ends[i].z, eased);
      n.x = n.fx = x;
      n.y = n.fy = y;
      n.z = n.fz = z;
    });
    graph.refresh();
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// releases whatever positions the words are currently frozen/settled at
// (scattered, mid-convergence, or already-converged) back into the simulation
function train(nodes, graph) {
  scatterToken++; // cancel any in-flight scatter tween
  graph.enableNodeDrag(true); // now dragging nudges a node's (forming) cluster
  for (const node of nodes) {
    node.fx = undefined;
    node.fy = undefined;
    node.fz = undefined;
  }
  graph.d3ReheatSimulation();
}

// styles `primary` as the suggested next action (filled) and `secondary` as
// already-done (outline) - swapped on every Scatter/Train click so the
// filled button always points at what makes sense to do next
function setPrimaryButton(primary, secondary) {
  primary.classList.add('btn-primary');
  primary.classList.remove('btn-outline');
  secondary.classList.add('btn-outline');
  secondary.classList.remove('btn-primary');
}

// pans the camera to look at a point, positioned outward along the same ray
// from the origin (same technique as the library's click-to-focus example)
// so scroll-zoom and drag-orbit now pivot around it
function focusOnPoint(graph, t) {
  const distRatio = 1 + FOCUS_DISTANCE / (Math.hypot(t.x, t.y, t.z) || 1);
  const newPos = { x: t.x * distRatio, y: t.y * distRatio, z: t.z * distRatio };
  graph.cameraPosition(newPos, t, FOCUS_TRANSITION_MS);
}

function startCameraOrbit(graph, orbitCheckbox) {
  let angle = 0;
  let lastTime = null;
  let wasOn = false;
  // the orbit's center/radius/height are captured from wherever the camera
  // ACTUALLY is at the moment orbiting starts, not the fixed ORBIT_RADIUS/
  // ORBIT_Y defaults - this is what makes toggling never change the center
  // or zoom the user was already looking at
  let center = { x: 0, y: 0, z: 0 };
  let radius = ORBIT_RADIUS;
  let height = ORBIT_Y;

  function frame(now) {
    const on = orbitCheckbox.checked;
    if (on && !wasOn) {
      // controls().target is the real, authoritative orbit center (unlike
      // cameraPosition()'s own lookAt getter, which is a derived view-
      // direction point, not the actual pivot OrbitControls itself uses)
      const target = graph.controls().target;
      const pos = graph.cameraPosition();
      center = { x: target.x, y: target.y, z: target.z };
      const dx = pos.x - center.x;
      const dz = pos.z - center.z;
      radius = Math.hypot(dx, dz);
      height = pos.y - center.y;
      angle = Math.atan2(dx, dz);
      lastTime = now;
    }
    if (on) {
      const dt = lastTime === null ? 0 : now - lastTime;
      angle += (dt / ORBIT_PERIOD_MS) * Math.PI * 2;
      lastTime = now;
      // pass `center` as lookAt every frame (not just on the first) so
      // OrbitControls' own target stays continuously in sync - that's what
      // lets it resume cleanly, with no jump, once auto-orbit is toggled off
      graph.cameraPosition(
        {
          x: center.x + radius * Math.sin(angle),
          y: center.y + height,
          z: center.z + radius * Math.cos(angle),
        },
        center
      );
    } else {
      lastTime = null;
    }
    wasOn = on;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---- small math utils ----

function randomPointInSphere(radius) {
  const r = radius * Math.cbrt(Math.random());
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
