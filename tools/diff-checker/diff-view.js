/**
 * diff-view.js — Full-tab diff view
 *
 * Reads saved text pair from chrome.storage.local, pre-populates editable
 * textareas, and renders a live-updating diff. Copy buttons copy each side's
 * raw text to clipboard.
 */

import { buildDiffHtml, DIFF_STORAGE_KEY } from './diff-checker.js';
import { loadFromStorage } from '../../shared/storage.js';
import { writeToClipboard } from '../../shared/clipboard.js';

let debounceTimer = null;

async function init() {
  const data = await loadFromStorage(DIFF_STORAGE_KEY, null);

  const inputA = document.getElementById('dv-input-a');
  const inputB = document.getElementById('dv-input-b');

  if (data) {
    inputA.value = data.a ?? '';
    inputB.value = data.b ?? '';
  }

  // Wire live diff
  [inputA, inputB].forEach((el) => {
    el.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => renderDiff(), 200);
    });
  });

  // Wire copy buttons
  document.getElementById('dv-copy-a').addEventListener('click', () =>
    copyText(inputA.value, 'dv-copied-a')
  );
  document.getElementById('dv-copy-b').addEventListener('click', () =>
    copyText(inputB.value, 'dv-copied-b')
  );

  renderDiff();
}

function renderDiff() {
  const a = document.getElementById('dv-input-a').value;
  const b = document.getElementById('dv-input-b').value;
  const columns = document.getElementById('dv-columns');
  const empty = document.getElementById('dv-empty');

  if (a === '' && b === '') {
    columns.hidden = true;
    empty.hidden = false;
    return;
  }

  columns.hidden = false;
  empty.hidden = true;

  const { leftHtml, rightHtml } = buildDiffHtml(a, b);
  document.getElementById('dv-left').innerHTML = leftHtml;
  document.getElementById('dv-right').innerHTML = rightHtml;
}

async function copyText(text, badgeId) {
  if (!text) return;
  const copied = await writeToClipboard(text);
  if (!copied) return;
  const badge = document.getElementById(badgeId);
  badge.classList.add('dv-copied--visible');
  setTimeout(() => badge.classList.remove('dv-copied--visible'), 1600);
}

init();
