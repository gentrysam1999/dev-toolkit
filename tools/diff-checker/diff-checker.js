/**
 * diff-checker.js — Diff Checker tool
 *
 * Accepts two plain-text inputs and renders a side-by-side character-level diff.
 * Algorithm: two-pass LCS — line-level first, then char-level within replaced pairs.
 * No external dependencies.
 */

import { saveToStorage } from '../../shared/storage.js';

const PANEL_ID = 'panel-diff-checker';
const CHAR_LIMIT = 5000; // beyond this, skip char-level diff for performance
export const DIFF_STORAGE_KEY = 'diffCheckerTexts';
let debounceTimer = null;

// ---- Init ----------------------------------------------------------------

export function initDiffChecker() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();

  const inputA = panel.querySelector('.dc-input-a');
  const inputB = panel.querySelector('.dc-input-b');

  panel.querySelector('.dc-btn-compare').addEventListener('click', () => runDiff(panel));
  panel.querySelector('.dc-btn-clear').addEventListener('click', () => clearDiff(panel));
  panel.querySelector('.dc-btn-tab').addEventListener('click', () => openInTab(panel));

  // Live update with debounce
  [inputA, inputB].forEach((el) => {
    el.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runDiff(panel), 200);
    });
  });
}

// ---- Diff runner ---------------------------------------------------------

function runDiff(panel) {
  const a = panel.querySelector('.dc-input-a').value;
  const b = panel.querySelector('.dc-input-b').value;

  const outputs = panel.querySelector('.dc-outputs');

  if (a === '' && b === '') {
    outputs.classList.add('dc-outputs--hidden');
    return;
  }

  const { leftHtml, rightHtml } = buildDiffHtml(a, b);
  panel.querySelector('.dc-output-left').innerHTML = leftHtml;
  panel.querySelector('.dc-output-right').innerHTML = rightHtml;
  outputs.classList.remove('dc-outputs--hidden');
}

async function openInTab(panel) {
  const a = panel.querySelector('.dc-input-a').value;
  const b = panel.querySelector('.dc-input-b').value;
  await saveToStorage(DIFF_STORAGE_KEY, { a, b });
  chrome.tabs.create({ url: chrome.runtime.getURL('tools/diff-checker/diff-view.html') });
}

function clearDiff(panel) {
  panel.querySelector('.dc-input-a').value = '';
  panel.querySelector('.dc-input-b').value = '';
  panel.querySelector('.dc-outputs').classList.add('dc-outputs--hidden');
  panel.querySelector('.dc-output-left').innerHTML = '';
  panel.querySelector('.dc-output-right').innerHTML = '';
}

// ---- Diff builder --------------------------------------------------------

export function buildDiffHtml(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const ops = lcs(linesA, linesB);

  // Group adjacent delete+insert into replace pairs
  const grouped = groupOps(ops);

  const leftParts = [];
  const rightParts = [];

  const charLevelOk = a.length <= CHAR_LIMIT && b.length <= CHAR_LIMIT;

  grouped.forEach((op) => {
    if (op.type === 'equal') {
      const escaped = escapeHtml(op.val);
      leftParts.push(escaped);
      rightParts.push(escaped);
    } else if (op.type === 'delete') {
      leftParts.push(`<span class="dc-line-del">${escapeHtml(op.val)}</span>`);
      rightParts.push(`<span class="dc-line-empty">\u00a0</span>`);
    } else if (op.type === 'insert') {
      leftParts.push(`<span class="dc-line-empty">\u00a0</span>`);
      rightParts.push(`<span class="dc-line-ins">${escapeHtml(op.val)}</span>`);
    } else if (op.type === 'replace') {
      // Pair up lines 1:1; excess go to pure delete/insert
      const delLines = op.del;
      const insLines = op.ins;
      const pairCount = Math.min(delLines.length, insLines.length);

      for (let i = 0; i < pairCount; i++) {
        if (charLevelOk) {
          const { leftHtml: lh, rightHtml: rh } = charDiff(delLines[i], insLines[i]);
          leftParts.push(`<span class="dc-line-del dc-line-changed">${lh}</span>`);
          rightParts.push(`<span class="dc-line-ins dc-line-changed">${rh}</span>`);
        } else {
          leftParts.push(`<span class="dc-line-del">${escapeHtml(delLines[i])}</span>`);
          rightParts.push(`<span class="dc-line-ins">${escapeHtml(insLines[i])}</span>`);
        }
      }

      // Excess deletes
      for (let i = pairCount; i < delLines.length; i++) {
        leftParts.push(`<span class="dc-line-del">${escapeHtml(delLines[i])}</span>`);
        rightParts.push(`<span class="dc-line-empty">\u00a0</span>`);
      }

      // Excess inserts
      for (let i = pairCount; i < insLines.length; i++) {
        leftParts.push(`<span class="dc-line-empty">\u00a0</span>`);
        rightParts.push(`<span class="dc-line-ins">${escapeHtml(insLines[i])}</span>`);
      }
    }

    // Add newline between lines (except after last)
    leftParts.push('\n');
    rightParts.push('\n');
  });

  return {
    leftHtml: leftParts.join(''),
    rightHtml: rightParts.join(''),
  };
}

// ---- Character-level diff ------------------------------------------------

function charDiff(a, b) {
  const ops = lcs(a.split(''), b.split(''));
  const leftParts = [];
  const rightParts = [];

  ops.forEach((op) => {
    if (op.type === 'equal') {
      const e = escapeHtml(op.val);
      leftParts.push(e);
      rightParts.push(e);
    } else if (op.type === 'delete') {
      leftParts.push(`<mark class="dc-del">${escapeHtml(op.val)}</mark>`);
    } else if (op.type === 'insert') {
      rightParts.push(`<mark class="dc-ins">${escapeHtml(op.val)}</mark>`);
    }
  });

  return { leftHtml: leftParts.join(''), rightHtml: rightParts.join('') };
}

// ---- LCS algorithm -------------------------------------------------------

/**
 * Computes LCS-based diff between two arrays.
 * Returns array of { type: 'equal'|'delete'|'insert', val }.
 * Uses Uint16Array for the DP table to minimise memory.
 */
function lcs(a, b) {
  const m = a.length;
  const n = b.length;

  // Cap to avoid runaway memory on degenerate inputs
  if (m === 0 && n === 0) return [];

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'equal', val: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'insert', val: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', val: a[i - 1] });
      i--;
    }
  }

  return ops;
}

// ---- Group consecutive delete+insert into replace pairs ------------------

function groupOps(ops) {
  const grouped = [];
  let i = 0;

  while (i < ops.length) {
    const op = ops[i];

    if (op.type === 'delete') {
      // Collect consecutive deletes then consecutive inserts
      const delLines = [];
      while (i < ops.length && ops[i].type === 'delete') {
        delLines.push(ops[i].val);
        i++;
      }
      const insLines = [];
      while (i < ops.length && ops[i].type === 'insert') {
        insLines.push(ops[i].val);
        i++;
      }

      if (insLines.length > 0) {
        grouped.push({ type: 'replace', del: delLines, ins: insLines });
      } else {
        delLines.forEach((v) => grouped.push({ type: 'delete', val: v }));
      }
    } else if (op.type === 'insert') {
      grouped.push({ type: 'insert', val: op.val });
      i++;
    } else {
      grouped.push({ type: 'equal', val: op.val });
      i++;
    }
  }

  return grouped;
}

// ---- Helpers -------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- Template ------------------------------------------------------------

function getTemplate() {
  return `
    <div class="dc-container">

      <div class="dc-inputs">
        <div class="dc-input-col">
          <label class="dc-input-label" for="dc-input-a">Original</label>
          <textarea id="dc-input-a" class="dc-textarea dc-input-a" placeholder="Paste original text…" spellcheck="false" autocomplete="off"></textarea>
        </div>
        <div class="dc-input-col">
          <label class="dc-input-label" for="dc-input-b">Modified</label>
          <textarea id="dc-input-b" class="dc-textarea dc-input-b" placeholder="Paste modified text…" spellcheck="false" autocomplete="off"></textarea>
        </div>
      </div>

      <div class="dc-actions">
        <button class="dc-btn-compare" type="button">Compare</button>
        <button class="dc-btn-clear" type="button">Clear</button>
        <button class="dc-btn-tab" type="button" title="Open full-width diff in a new tab">
          Open in Tab
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="margin-left:3px;vertical-align:middle;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="dc-outputs dc-outputs--hidden">
        <div class="dc-output-col">
          <span class="dc-output-label">Original</span>
          <div class="dc-output dc-output-left" aria-label="Original diff output"></div>
        </div>
        <div class="dc-output-col">
          <span class="dc-output-label">Modified</span>
          <div class="dc-output dc-output-right" aria-label="Modified diff output"></div>
        </div>
      </div>

    </div>
  `;
}
