/**
 * color-picker.js — Color Picker tool
 *
 * Uses the native EyeDropper API (Chrome 95+) to sample any pixel on screen.
 * On pick: auto-copies hex to clipboard, shows color swatch + hex + rgba values,
 * renders an SL-plane chart, and saves to history (last 5 colors).
 */

import { hexToRgba, rgbToHsl, formatRgba } from '../../shared/color-utils.js';
import { writeToClipboard } from '../../shared/clipboard.js';
import { saveToStorage, loadFromStorage } from '../../shared/storage.js';
import { drawColorChart, drawPlaceholderChart } from '../../shared/canvas-chart.js';

const PANEL_ID = 'panel-color-picker';
const HISTORY_KEY = 'colorPickerHistory';
const HISTORY_MAX = 5;

// ---- Init ----------------------------------------------------------------

export async function initColorPicker() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();

  // Draw placeholder chart
  const canvas = panel.querySelector('.cp-chart');
  drawPlaceholderChart(canvas);

  // Wire up the pick button
  panel.querySelector('.cp-btn-pick').addEventListener('click', handlePickClick);

  // Wire up the reset button
  panel.querySelector('.cp-btn-reset').addEventListener('click', () => resetColorPicker(panel));

  // Wire up per-value copy buttons
  panel.querySelectorAll('.cp-value-row').forEach((row) => {
    row.querySelector('.cp-copy-btn').addEventListener('click', () => copyValueRow(row));
    // Also make the value text itself click-to-copy
    row.querySelector('[class^="cp-"][class*="-value"]:not(.cp-values)').addEventListener('click', () => copyValueRow(row));
  });

  // Load and render saved history
  const history = await loadFromStorage(HISTORY_KEY, []);
  renderHistory(panel, history);

  // Show the last picked color if history exists
  if (history.length > 0) {
    displayColor(panel, history[0]);
  }
}

// ---- EyeDropper flow -----------------------------------------------------

async function handlePickClick() {
  if (!window.EyeDropper) {
    showError('EyeDropper API is not supported in this browser.');
    return;
  }

  const panel = document.getElementById(PANEL_ID);
  const btn = panel.querySelector('.cp-btn-pick');
  btn.textContent = 'Picking…';
  btn.disabled = true;

  try {
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open(); // resolves with { sRGBHex: "#rrggbb" }
    await handlePickResult(result.sRGBHex);
  } catch (err) {
    // User pressed Escape — not an error worth surfacing
    if (err.name !== 'AbortError') {
      console.error('EyeDropper error:', err);
    }
  } finally {
    btn.textContent = 'Pick Color';
    btn.disabled = false;
  }
}

async function handlePickResult(hex) {
  const panel = document.getElementById(PANEL_ID);

  // Update displays
  displayColor(panel, hex);

  // Copy hex to clipboard immediately (popup must be focused — it is at this point)
  const copied = await writeToClipboard(hex.toUpperCase());

  if (copied) {
    const badge = panel.querySelector('.cp-copied-badge');
    badge.classList.add('cp-copied-badge--visible');
    setTimeout(() => badge.classList.remove('cp-copied-badge--visible'), 1800);
  }

  // Save to history
  const history = await loadFromStorage(HISTORY_KEY, []);
  const updated = [hex, ...history.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, HISTORY_MAX);
  await saveToStorage(HISTORY_KEY, updated);
  renderHistory(panel, updated);
}

// ---- Display -------------------------------------------------------------

function displayColor(panel, hex) {
  const rgba = hexToRgba(hex);
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);

  const swatch = panel.querySelector('.cp-swatch');
  swatch.style.backgroundColor = hex;
  swatch.classList.remove('cp-swatch--empty');

  panel.querySelector('.cp-hex-value').textContent = hex.toUpperCase();
  panel.querySelector('.cp-rgba-value').textContent = formatRgba(rgba);
  panel.querySelector('.cp-hsl-value').textContent =
    `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  panel.querySelector('.cp-btn-reset').hidden = false;

  const canvas = panel.querySelector('.cp-chart');
  drawColorChart(canvas, hsl.h, hsl.s, hsl.l);
}

function resetColorPicker(panel) {
  const swatch = panel.querySelector('.cp-swatch');
  swatch.style.backgroundColor = '';
  swatch.classList.add('cp-swatch--empty');

  panel.querySelector('.cp-hex-value').textContent = '#------';
  panel.querySelector('.cp-rgba-value').textContent = 'rgba(—, —, —, —)';
  panel.querySelector('.cp-hsl-value').textContent = 'hsl(—, —%, —%)';

  panel.querySelector('.cp-btn-reset').hidden = true;

  drawPlaceholderChart(panel.querySelector('.cp-chart'));
}

// ---- Per-value copy ------------------------------------------------------

async function copyValueRow(row) {
  const valueEl = row.querySelector('[class^="cp-"][class*="-value"]:not(.cp-values)');
  if (!valueEl) return;

  const text = valueEl.textContent.trim();
  // Don't copy placeholder dashes
  if (text.includes('—') || text === '#------') return;

  const copied = await writeToClipboard(text);
  if (!copied) return;

  const badge = row.querySelector('.cp-row-copied');
  badge.classList.add('cp-row-copied--visible');
  setTimeout(() => badge.classList.remove('cp-row-copied--visible'), 1400);
}

// ---- History -------------------------------------------------------------

function renderHistory(panel, history) {
  const container = panel.querySelector('.cp-history');
  container.innerHTML = '';

  if (history.length === 0) {
    container.innerHTML = '<span class="cp-history-empty">No colors picked yet</span>';
    return;
  }

  history.forEach((hex) => {
    const item = document.createElement('div');
    item.className = 'cp-history-item';

    const swatch = document.createElement('button');
    swatch.className = 'cp-history-swatch';
    swatch.style.backgroundColor = hex;
    swatch.setAttribute('title', hex.toUpperCase());
    swatch.setAttribute('aria-label', `Reuse color ${hex.toUpperCase()}`);
    swatch.addEventListener('click', () => handlePickResult(hex));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'cp-history-remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${hex.toUpperCase()} from history`);
    removeBtn.setAttribute('title', 'Remove');
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromHistory(panel, hex);
    });

    item.appendChild(swatch);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

async function removeFromHistory(panel, hex) {
  const history = await loadFromStorage(HISTORY_KEY, []);
  const updated = history.filter((c) => c.toLowerCase() !== hex.toLowerCase());
  await saveToStorage(HISTORY_KEY, updated);
  renderHistory(panel, updated);
}

// ---- Error ---------------------------------------------------------------

function showError(msg) {
  const panel = document.getElementById(PANEL_ID);
  const existing = panel.querySelector('.cp-error');
  if (existing) existing.remove();

  const el = document.createElement('p');
  el.className = 'cp-error';
  el.textContent = msg;
  panel.querySelector('.cp-container').prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ---- Template ------------------------------------------------------------

function getTemplate() {
  return `
    <div class="cp-container">

      <div class="cp-preview-row">
        <div class="cp-swatch cp-swatch--empty" aria-hidden="true"></div>
        <div class="cp-values">

          <div class="cp-value-row" data-copy-target="hex">
            <span class="cp-value-label">HEX</span>
            <span class="cp-hex-value">#------</span>
            <button class="cp-copy-btn" type="button" aria-label="Copy hex value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-value-row" data-copy-target="rgba">
            <span class="cp-value-label">RGB</span>
            <span class="cp-rgba-value">rgba(—, —, —, —)</span>
            <button class="cp-copy-btn" type="button" aria-label="Copy RGB value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-value-row" data-copy-target="hsl">
            <span class="cp-value-label">HSL</span>
            <span class="cp-hsl-value">hsl(—, —%, —%)</span>
            <button class="cp-copy-btn" type="button" aria-label="Copy HSL value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-actions">
            <button class="cp-btn-pick" type="button">Pick Color</button>
            <button class="cp-btn-reset" type="button" hidden aria-label="Reset selection">Reset</button>
            <span class="cp-copied-badge" aria-live="polite">Copied!</span>
          </div>

        </div>
      </div>

      <div class="cp-divider"></div>

      <canvas class="cp-chart" width="288" height="200" aria-label="Color saturation/lightness chart"></canvas>

      <div class="cp-history-section">
        <span class="cp-history-label">Recent</span>
        <div class="cp-history" role="list" aria-label="Recent colors"></div>
      </div>

    </div>
  `;
}

function copyIcon() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
  </svg>`;
}
