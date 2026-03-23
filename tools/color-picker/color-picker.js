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

  panel.querySelector('.cp-swatch').style.backgroundColor = hex;
  panel.querySelector('.cp-hex-value').textContent = hex.toUpperCase();
  panel.querySelector('.cp-rgba-value').textContent = formatRgba(rgba);
  panel.querySelector('.cp-hsl-value').textContent =
    `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  const canvas = panel.querySelector('.cp-chart');
  drawColorChart(canvas, hsl.h, hsl.s, hsl.l);
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
    const btn = document.createElement('button');
    btn.className = 'cp-history-swatch';
    btn.style.backgroundColor = hex;
    btn.setAttribute('title', hex.toUpperCase());
    btn.setAttribute('aria-label', `Reuse color ${hex.toUpperCase()}`);
    btn.addEventListener('click', () => handlePickResult(hex));
    container.appendChild(btn);
  });
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
        <div class="cp-swatch" style="background:#2a2a45;" aria-hidden="true"></div>
        <div class="cp-values">
          <span class="cp-hex-value" title="Hex value">#------</span>
          <span class="cp-rgba-value" title="RGBA value">rgba(—, —, —, —)</span>
          <span class="cp-hsl-value" title="HSL value">hsl(—, —%, —%)</span>
          <div class="cp-actions">
            <button class="cp-btn-pick" type="button">Pick Color</button>
            <span class="cp-copied-badge" aria-live="polite">Copied!</span>
          </div>
        </div>
      </div>

      <canvas class="cp-chart" width="288" height="200" aria-label="Color saturation/lightness chart"></canvas>

      <div class="cp-history-section">
        <span class="cp-history-label">Recent</span>
        <div class="cp-history" role="list" aria-label="Recent colors"></div>
      </div>

    </div>
  `;
}
