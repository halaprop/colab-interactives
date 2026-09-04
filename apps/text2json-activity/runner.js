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
    --bubble: #eef0f3;
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
      --bubble: #2c2e31;
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
    background: var(--bubble);
    border-radius: 10px;
    padding: 6px 10px;
    max-width: 85%;
    align-self: flex-start;
    font-size: 13px;
    white-space: pre-wrap;
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
  const { title = '', subtitle = '', messages = [], dataBlocks = [] } = data;

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
  };

  root.querySelector('.paste-response').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setResponse(text || '(clipboard was empty)', !!text);
    } catch (e) {
      alert('Could not read the clipboard: ' + e.message);
    }
  };

  downloadBtn.onclick = () => {
    const { expanded, errors } = parseAndExpand(composer.value);
    if (errors.length) {
      alert('Cannot download — fix these first:\n\n' + errors.map((e) => '• ' + e).join('\n'));
      return;
    }
    const payload = {
      title,
      subtitle,
      prompt: expanded,
      response: responsePane.textContent,
      downloadedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(title || 'challenge')}-result.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
