/*
 * apps/text2json-activity/runner.js
 *
 * Shared student UI for the text2json-activity family (assumes the caller
 * lives one level below this file, e.g. apps/text2json-activity/hello-world/
 * index.js, matching the apps/word-math/shared.js convention). A challenge
 * is a plain data object: mount({ title, subtitle, messages, dataBlocks }).
 *
 * The student reads the chat transcript and any data blocks, composes a
 * prompt referencing them by inserting ${name} placeholders (kept small on
 * purpose -- expanded to real content only on Copy), takes that prompt to
 * their own LLM, pastes the result back, and downloads it to submit.
 */

const PALETTE = ['#a5462f', '#2f6da5', '#3f8f4f', '#8a5fb3', '#b3843f', '#3fa3a3'];

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'challenge';
}

// ---------- result file: session log, canonical form, checksum ----------
// The downloaded file carries the whole session (every prompt copied,
// every response pasted) plus a checksum over its canonical form. The
// session persists in localStorage where available so a re-run of the
// Colab cell continues the same log; otherwise it lives for one render.
const REV = 'r7c2e4a1';

function randomId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function loadSession(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key));
    if (s && typeof s.sid === 'string' && typeof s.t0 === 'number' && Array.isArray(s.log)) return s;
  } catch { /* no storage, or nothing usable in it */ }
  return null;
}

function saveSession(key, s) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* best effort */ }
}

// JSON with object keys sorted at every level; arrays keep their order.
// verify.py in the internal repo mirrors this exactly.
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

export async function checksum(payload) {
  const bytes = new TextEncoder().encode(stableStringify(payload) + REV);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// The response as JSON if it parses, with a surrounding ``` fence
// tolerated; null otherwise.
function parseJsonLoose(text) {
  let s = (text || '').trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch { return null; }
}

// Puts a parsed answer into a form where cosmetic differences vanish:
// keys lowercased and stripped to alphanumerics, strings trimmed and
// lowercased, numeric strings (with an optional $) read as numbers,
// arrays sorted. Two answers match when their normal forms are equal.
function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize).sort((a, b) => (stableStringify(a) < stableStringify(b) ? -1 : 1));
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = normalize(v[k]);
    return out;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const num = s.match(/^\$?\s*(-?\d+(?:\.\d+)?)$/);
    return num ? Number(num[1]) : s.toLowerCase();
  }
  return v;
}

export function matches(answer, expected) {
  if (answer == null || expected == null) return false;
  return stableStringify(normalize(answer)) === stableStringify(normalize(expected));
}

function insertAtCursor(el, text) {
  el.focus();
  const ok = document.execCommand && document.execCommand('insertText', false, text);
  if (!ok) {
    const start = el.selectionStart, end = el.selectionEnd;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const pos = start + text.length;
    el.selectionStart = el.selectionEnd = pos;
  }
}

// A data block's raw content may itself be JSON. A single key/value pair
// collapses to one line so it reads inline in a prompt; anything richer
// (more keys, arrays, nesting) is pretty-printed instead. Non-JSON text
// is left untouched.
function formatContent(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;
  const keys = Object.keys(parsed);
  if (keys.length === 1) return `{ ${keys[0]}: ${JSON.stringify(parsed[keys[0]])} }`;
  return JSON.stringify(parsed, null, 2);
}

// Separates the inserted ${name} from whatever's already at the cursor:
// a newline if the content is multiline, a single space otherwise, and
// only on whichever side actually has adjacent non-whitespace text.
function insertPlaceholder(el, name, content) {
  const sep = content.includes('\n') ? '\n' : ' ';
  const before = el.value.slice(0, el.selectionStart);
  const after = el.value.slice(el.selectionEnd);
  const prefix = before && !/\s$/.test(before) ? sep : '';
  const suffix = after && !/^\s/.test(after) ? sep : '';
  insertAtCursor(el, `${prefix}\${${name}}${suffix}`);
}

const STYLE = `
<style>
  .text2json {
    color-scheme: light;
    --surface: #fcfcfb;
    --panel: #ffffff;
    --border: rgba(11, 11, 11, 0.10);
    --ink-primary: #0b0b0b;
    --ink-secondary: #52514e;
    --ink-muted: #898781;
    --accent: #a5462f;
    --accent-ink: #ffffff;
    --bubble: #eef5ff;
    --bubble-ink: #0b0b0b;
    --bubble-line: #0b0b0b;
    --go: #2fa84f;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    padding: 24px;
    background: var(--surface);
    color: var(--ink-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
  }
  @media (prefers-color-scheme: dark) {
    .text2json {
      color-scheme: dark;
      --surface: #1a1a19;
      --panel: #222221;
      --border: rgba(255, 255, 255, 0.10);
      --ink-primary: #ffffff;
      --ink-secondary: #c3c2b7;
      --ink-muted: #898781;
      --accent: #d97a5e;
      --accent-ink: #1a1a19;
      --bubble: #1f2a3a;
      --bubble-ink: #ffffff;
      --bubble-line: #c3c2b7;
    }
  }
  .text2json .header h1 { margin: 0 0 4px; font-size: 20px; }
  .text2json .header p { margin: 0; color: var(--ink-secondary); font-size: 13px; }
  .text2json .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }
  .text2json .panel h2 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    margin: 0 0 10px;
  }
  .text2json .chat-mockup { display: flex; flex-direction: column; gap: 10px; }
  .text2json .chat-msg { display: flex; flex-direction: column; gap: 2px; }
  .text2json .chat-name { font-size: 11px; font-weight: 700; }
  .text2json .chat-bubble {
    position: relative;
    background: var(--bubble);
    color: var(--bubble-ink);
    border: 1px solid var(--bubble-line);
    border-radius: 16px 16px 16px 4px;
    padding: 7px 12px;
    margin-left: 8px;
    max-width: 85%;
    align-self: flex-start;
    font-size: 13px;
    white-space: pre-wrap;
  }
  /* Tail: two border-drawn triangles pointing left. ::before is the
     outline; ::after is the fill, 1px smaller and shifted a pixel into
     the bubble so its base covers the bubble's own left border. */
  .text2json .chat-bubble::before,
  .text2json .chat-bubble::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  }
  .text2json .chat-bubble::before {
    bottom: 2px;
    left: -8px;
    border-width: 7px 8px 7px 0;
    border-color: transparent var(--bubble-line) transparent transparent;
  }
  .text2json .chat-bubble::after {
    bottom: 3px;
    left: -6px;
    border-width: 6px 8px 6px 0;
    border-color: transparent var(--bubble) transparent transparent;
  }
  .text2json .data-preview-item { margin-bottom: 10px; }
  .text2json .data-preview-item:last-child { margin-bottom: 0; }
  .text2json .data-preview-item .label { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
  .text2json .data-preview-item .content {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
  }
  .text2json .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .text2json .chip {
    font-family: inherit;
    font-size: 12px;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    cursor: pointer;
    color: var(--ink-primary);
  }
  .text2json .chip:hover { opacity: 0.85; }
  .text2json .caption { color: var(--ink-muted); font-size: 11px; margin: 6px 0 0; }
  .text2json code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--surface);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .text2json textarea.composer {
    width: 100%;
    min-height: 160px;
    margin-top: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink-primary);
    resize: vertical;
    box-sizing: border-box;
  }
  .text2json .response-pane {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
    min-height: 100px;
  }
  .text2json .row { display: flex; gap: 8px; margin-top: 8px; }
  .text2json button.btn {
    font-family: inherit;
    font-size: 12px;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    cursor: pointer;
    color: var(--ink-primary);
  }
  .text2json button.btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .text2json button.btn.download { background: var(--go); color: #ffffff; border-color: var(--go); }
  .text2json button.btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
`;

const TEMPLATE = `
<div class="header">
  <h1 class="title"></h1>
  <p class="subtitle"></p>
</div>
<div class="panel chat-panel">
  <h2>Chat transcript</h2>
  <div class="chat-mockup"></div>
</div>
<div class="panel data-panel" hidden>
  <h2>Data</h2>
  <div class="data-preview"></div>
</div>
<div class="panel">
  <h2>Compose your prompt</h2>
  <div class="chip-row insert-toolbar"></div>
  <p class="caption">Inserts a small <code>\${name}</code> reference, not the full content — expanded and checked when you copy.</p>
  <textarea class="composer" placeholder="Write your prompt here..."></textarea>
  <div class="row">
    <button class="btn ghost copy-prompt">Copy prompt, so you can paste and submit to your LLM</button>
  </div>
</div>
<div class="panel">
  <h2>Response</h2>
  <div class="response-pane">—</div>
  <div class="row">
    <button class="btn ghost paste-response">After you get an LLM result, paste it here</button>
  </div>
  <p class="caption">Adds the result to the transcript of this activity.</p>
  <div class="row">
    <button class="btn primary download" disabled>If the result looks correct, download a copy for mailing</button>
  </div>
</div>
`;

export function mount(data) {
  const { title = '', subtitle = '', messages = [], dataBlocks = [], expected = null } = data;

  const root = document.querySelector('#app');
  root.classList.add('text2json');
  root.innerHTML = STYLE + TEMPLATE;

  root.querySelector('.title').textContent = title || '(untitled challenge)';
  root.querySelector('.subtitle').textContent = subtitle;

  // ---------- chat transcript ----------
  const chatMockup = root.querySelector('.chat-mockup');
  chatMockup.innerHTML = messages.map((m) => `
    <div class="chat-msg">
      <span class="chat-name" style="color:${colorFor(m.name || '?')}">${escapeHtml(m.name || '(unnamed)')}</span>
      <div class="chat-bubble">${escapeHtml(m.message)}</div>
    </div>
  `).join('');

  function transcriptText() {
    return messages.map((m) => `${m.name} (${m.id}): ${m.message}`).join('\n');
  }

  // ---------- data blocks ----------
  const dataPanel = root.querySelector('.data-panel');
  const dataPreview = root.querySelector('.data-preview');
  dataPanel.hidden = !dataBlocks.length;
  dataPreview.innerHTML = dataBlocks.map((b) => `
    <div class="data-preview-item">
      <div class="label">${escapeHtml(b.label || '(untitled)')}</div>
      <div class="content">${escapeHtml(formatContent(b.content))}</div>
    </div>
  `).join('');

  // ---------- insert toolbar + ${name} placeholder expansion ----------
  function getInsertables() {
    const map = { chat: transcriptText() };
    dataBlocks.forEach((b) => { if (b.label && b.label.trim()) map[b.label.trim()] = formatContent(b.content); });
    return map;
  }

  const toolbar = root.querySelector('.insert-toolbar');
  const composer = root.querySelector('.composer');
  const addBtn = (label, name) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = label;
    btn.onclick = () => insertPlaceholder(composer, name, getInsertables()[name] || '');
    toolbar.appendChild(btn);
  };
  addBtn('Insert chat', 'chat');
  dataBlocks.forEach((b) => { const l = (b.label || '').trim(); if (l) addBtn('Insert ' + l, l); });

  // Scans left-to-right for ${...} references, expanding known ones and
  // collecting a specific, human-readable error for each problem found
  // (an unterminated ${ with no closing brace, or a name with no match).
  function parseAndExpand(text) {
    const insertables = getInsertables();
    const errors = [];
    let result = '';
    let i = 0;
    while (true) {
      const start = text.indexOf('${', i);
      if (start === -1) { result += text.slice(i); break; }
      result += text.slice(i, start);
      const end = text.indexOf('}', start + 2);
      if (end === -1) {
        const snippet = text.slice(start, start + 24) + (text.length > start + 24 ? '…' : '');
        errors.push(`Missing } brace on input starting at "${snippet}"`);
        result += text.slice(start);
        break;
      }
      const name = text.slice(start + 2, end).trim();
      if (Object.prototype.hasOwnProperty.call(insertables, name)) {
        result += insertables[name];
      } else {
        errors.push(`No such input "${name}"`);
        result += text.slice(start, end + 1);
      }
      i = end + 1;
    }
    return { expanded: result, errors };
  }

  // ---------- session log ----------
  const act = slugify(title || 'challenge');
  const storeKey = `t2j:${act}`;
  const session = loadSession(storeKey) || { sid: randomId(), t0: Date.now(), log: [] };

  function logEvent(e) {
    session.log.push({ t: Date.now(), ...e });
    saveSession(storeKey, session);
  }

  // ---------- response + download ----------
  const responsePane = root.querySelector('.response-pane');
  const downloadBtn = root.querySelector('.download');

  function setResponse(text, downloadable) {
    responsePane.textContent = text;
    downloadBtn.disabled = !downloadable;
  }

  root.querySelector('.copy-prompt').onclick = async () => {
    const { expanded, errors } = parseAndExpand(composer.value);
    if (errors.length) {
      alert('Cannot copy — fix these first:\n\n' + errors.map((e) => '• ' + e).join('\n'));
      return;
    }
    await navigator.clipboard.writeText(expanded);
    logEvent({ k: '2llm', p: expanded });
  };

  root.querySelector('.paste-response').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setResponse(text || '(clipboard was empty)', !!text);
      if (text) logEvent({ k: 'llm2', r: text });
    } catch (e) {
      alert('Could not read the clipboard: ' + e.message);
    }
  };

  downloadBtn.onclick = async () => {
    const { expanded, errors } = parseAndExpand(composer.value);
    if (errors.length) {
      alert('Cannot download — fix these first:\n\n' + errors.map((e) => '• ' + e).join('\n'));
      return;
    }
    const response = responsePane.textContent;
    const j = parseJsonLoose(response);
    const payload = {
      v: 1,
      act,
      out: { match: matches(j, expected), j, r: response, p: expanded },
      log: session.log,
      hdr: { t: title, s: subtitle },
      sid: session.sid,
      t0: session.t0,
      tN: Date.now(),
    };
    payload.chk = await checksum(payload);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${act}-result.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
