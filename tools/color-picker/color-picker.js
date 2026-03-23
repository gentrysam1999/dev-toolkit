/**
 * color-picker.js — Color Picker tool
 *
 * Uses the native EyeDropper API (Chrome 95+) to sample any pixel on screen.
 * On pick: auto-copies hex to clipboard, shows color swatch + hex + rgba + hsl values,
 * renders an interactive SL-plane chart, and saves to history (last 5 colors).
 *
 * After picking, the color is adjustable via:
 *  - Clicking or dragging within the SL chart (changes saturation + lightness)
 *  - Dragging the hue slider (changes hue)
 * Clipboard is updated on drag end (pointerup / slider change).
 */

import { hexToRgba, rgbToHsl, hslToRgb, rgbToHex, formatRgba } from '../../shared/js/color-utils.js';
import { writeToClipboard } from '../../shared/js/clipboard.js';
import { saveToStorage, loadFromStorage } from '../../shared/js/storage.js';
import { drawColorChart, drawPlaceholderChart } from '../../shared/js/canvas-chart.js';

const PANEL_ID = 'panel-color-picker';
const HISTORY_KEY = 'colorPickerHistory';
const HISTORY_MAX = 5;

// Placeholder text shown before any color is picked
const EMPTY = { hex: '#------', rgb: 'rgba(—, —, —, —)', hsl: 'hsl(—, —%, —%)' };

// ---- Module-level HSL state ----------------------------------------------
// Source of truth for the currently displayed/adjusted color.
// HSL is used because the chart and slider are both HSL-based.

let state = { h: 0, s: 0, l: 50 };
let hasColor = false;
let isDragging = false;
let currentDisplayHex = null; // always reflects the hex currently shown in the UI

// ---- Init ----------------------------------------------------------------

export async function initColorPicker() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();

  const canvas = panel.querySelector('.cp-chart');
  drawPlaceholderChart(canvas);

  panel.querySelector('.cp-btn-pick').addEventListener('click', handlePickClick);
  panel.querySelector('.cp-btn-reset').addEventListener('click', () => resetColorPicker(panel));
  panel.querySelector('.cp-btn-save').addEventListener('click', () => saveCurrentToHistory(panel));

  // Per-value copy buttons
  panel.querySelectorAll('.cp-value-row').forEach((row) => {
    row.querySelector('.cp-copy-btn').addEventListener('click', () => copyValueRow(row));
  });

  wireValueInputs(panel);
  wireCanvasInteraction(panel, canvas);

  // Hue slider
  const slider = panel.querySelector('.cp-hue-slider');
  slider.addEventListener('input', () => {
    if (!hasColor) {
      hasColor = true;
      if (state.s === 0) state.s = 100; // default to full saturation so the hue is visible
    }
    state.h = Number(slider.value);
    panel.querySelector('.cp-hue-value').textContent = `${state.h}°`;
    applyStateToDisplay(panel, false);
  });
  slider.addEventListener('change', () => {
    if (!hasColor) return;
    applyStateToDisplay(panel, true);
  });

  // History
  const history = await loadFromStorage(HISTORY_KEY, []);
  renderHistory(panel, history);
  if (history.length > 0) setColorFromHex(panel, history[0]);
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
    const result = await eyeDropper.open();
    await handlePickResult(result.sRGBHex);
  } catch (err) {
    if (err.name !== 'AbortError') console.error('EyeDropper error:', err);
  } finally {
    btn.textContent = 'Pick Color';
    btn.disabled = false;
  }
}

async function handlePickResult(hex) {
  const panel = document.getElementById(PANEL_ID);
  setColorFromHex(panel, hex);

  const copied = await writeToClipboard(hex.toUpperCase());
  if (copied) flash(panel.querySelector('.cp-copied-badge'), 'cp-copied-badge--visible', 1800);

  await mutateHistory(panel, (h) =>
    [hex, ...h.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, HISTORY_MAX)
  );
}

// ---- State → display -----------------------------------------------------

/**
 * Set state from a hex value and update all displays.
 * Passes the original hex through to applyStateToDisplay so displays
 * always show the exact picked value — no HSL round-trip drift.
 */
function setColorFromHex(panel, hex) {
  const { r, g, b } = hexToRgba(hex);
  state = { ...rgbToHsl(r, g, b) };
  hasColor = true;
  applyStateToDisplay(panel, false, hex);
}

/**
 * Convert current HSL state → update all DOM elements.
 * @param {HTMLElement} panel
 * @param {boolean} copyToClipboard
 * @param {string|null} originalHex  When set, swatch/hex/rgba use this exact value
 *                                   instead of the HSL round-trip result.
 */
async function applyStateToDisplay(panel, copyToClipboard, originalHex = null) {
  const { r, g, b } = originalHex ? hexToRgba(originalHex) : hslToRgb(state.h, state.s, state.l);
  const hex = originalHex ?? rgbToHex(r, g, b);
  currentDisplayHex = hex;

  const swatch = panel.querySelector('.cp-swatch');
  swatch.style.backgroundColor = hex;
  swatch.classList.remove('cp-swatch--empty');

  // Don't overwrite an input the user is currently editing
  const active = document.activeElement;
  if (!active?.classList.contains('cp-hex-value'))
    panel.querySelector('.cp-hex-value').value = hex.toUpperCase();
  if (!active?.classList.contains('cp-rgba-value'))
    panel.querySelector('.cp-rgba-value').value = formatRgba({ r, g, b, a: 255 });
  if (!active?.classList.contains('cp-hsl-value'))
    panel.querySelector('.cp-hsl-value').value = `hsl(${state.h}, ${state.s}%, ${state.l}%)`;

  // Sync hue slider position + label
  const slider = panel.querySelector('.cp-hue-slider');
  if (slider && Number(slider.value) !== state.h) slider.value = state.h;
  panel.querySelector('.cp-hue-value').textContent = `${state.h}°`;

  panel.querySelector('.cp-btn-reset').hidden = false;
  panel.querySelector('.cp-btn-save').hidden = false;

  drawColorChart(panel.querySelector('.cp-chart'), state.h, state.s, state.l);

  if (copyToClipboard) {
    const copied = await writeToClipboard(hex.toUpperCase());
    if (copied) flash(panel.querySelector('.cp-copied-badge'), 'cp-copied-badge--visible', 1800);
  }
}

// ---- Canvas drag interaction ---------------------------------------------

function wireCanvasInteraction(panel, canvas) {
  function getSLFromPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const s = Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100);
    const l = Math.round(Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)) * 100);
    return { s, l };
  }

  function updateSL(e, copyClipboard) {
    const { s, l } = getSLFromPointer(e);
    state.s = s;
    state.l = l;
    applyStateToDisplay(panel, copyClipboard);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!hasColor) hasColor = true;
    isDragging = true;
    canvas.setPointerCapture(e.pointerId);
    updateSL(e, false);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (isDragging) updateSL(e, false);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    updateSL(e, true);
  });

  canvas.addEventListener('pointercancel', () => { isDragging = false; });

  canvas.style.cursor = 'crosshair';
}

// ---- Value input editing -------------------------------------------------

function wireValueInputs(panel) {
  const inputs = [
    { el: panel.querySelector('.cp-hex-value'),  type: 'hex' },
    { el: panel.querySelector('.cp-rgba-value'), type: 'rgb' },
    { el: panel.querySelector('.cp-hsl-value'),  type: 'hsl' },
  ];

  inputs.forEach(({ el, type }) => {
    el.addEventListener('focus', () => el.select());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { revertInput(panel, el, type); el.blur(); }
    });
    el.addEventListener('blur', () => commitInput(panel, el, type));
  });
}

function commitInput(panel, el, type) {
  const raw = el.value.trim();
  let newHsl = null;
  let originalHex = null;

  if (type === 'hex') {
    originalHex = parseHexInput(raw);
    if (originalHex) {
      const { r, g, b } = hexToRgba(originalHex);
      newHsl = rgbToHsl(r, g, b);
    }
  } else if (type === 'rgb') {
    const rgb = parseRgbInput(raw);
    if (rgb) newHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  } else if (type === 'hsl') {
    newHsl = parseHslInput(raw);
  }

  if (newHsl) {
    state = newHsl;
    hasColor = true;
    applyStateToDisplay(panel, false, originalHex);
  } else {
    revertInput(panel, el, type);
  }
}

function revertInput(panel, el, type) {
  if (!hasColor) {
    el.value = EMPTY[type === 'rgb' ? 'rgb' : type];
    return;
  }
  if (type === 'hex') {
    el.value = (currentDisplayHex ?? '').toUpperCase();
  } else if (type === 'rgb') {
    const { r, g, b } = hexToRgba(currentDisplayHex);
    el.value = formatRgba({ r, g, b, a: 255 });
  } else {
    el.value = `hsl(${state.h}, ${state.s}%, ${state.l}%)`;
  }
}

// ---- Input parsers -------------------------------------------------------

function parseHexInput(str) {
  const clean = str.replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return '#' + clean.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(clean))
    return '#' + clean.split('').map((c) => c + c).join('').toLowerCase();
  return null;
}

function parseRgbInput(str) {
  // Accepts: "255, 87, 51" | "rgb(255,87,51)" | "rgba(255, 87, 51, 1)"
  const m = str.match(/(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if ([r, g, b].some((v) => v > 255)) return null;
  return { r, g, b };
}

function parseHslInput(str) {
  // Accepts: "14, 100%, 60%" | "hsl(14, 100%, 60%)" | "14 100 60"
  const m = str.match(/(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)%?[,\s]+(\d+(?:\.\d+)?)%?/);
  if (!m) return null;
  const h = Math.round(Number(m[1]));
  const s = Math.round(Number(m[2]));
  const l = Math.round(Number(m[3]));
  if (h > 360 || s > 100 || l > 100) return null;
  return { h, s, l };
}

// ---- Per-value copy ------------------------------------------------------

async function copyValueRow(row) {
  const valueEl = row.querySelector('[class^="cp-"][class*="-value"]:not(.cp-values)');
  if (!valueEl) return;
  const text = (valueEl.value ?? valueEl.textContent).trim();
  if (text.includes('—') || text === '#------') return;

  const copied = await writeToClipboard(text);
  if (copied) flash(row.querySelector('.cp-row-copied'), 'cp-row-copied--visible');
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
      mutateHistory(panel, (h) => h.filter((c) => c.toLowerCase() !== hex.toLowerCase()));
    });

    item.appendChild(swatch);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

async function saveCurrentToHistory(panel) {
  if (!hasColor || !currentDisplayHex) return;
  await mutateHistory(panel, (h) =>
    [currentDisplayHex, ...h.filter((c) => c.toLowerCase() !== currentDisplayHex.toLowerCase())].slice(0, HISTORY_MAX)
  );
  const btn = panel.querySelector('.cp-btn-save');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.textContent = 'Save'; }, 1400);
}

/**
 * Load, transform, save, and re-render history in one step.
 * @param {HTMLElement} panel
 * @param {function(string[]): string[]} transform
 */
async function mutateHistory(panel, transform) {
  const history = await loadFromStorage(HISTORY_KEY, []);
  const updated = transform(history);
  await saveToStorage(HISTORY_KEY, updated);
  renderHistory(panel, updated);
}

// ---- Reset ---------------------------------------------------------------

function resetColorPicker(panel) {
  hasColor = false;
  currentDisplayHex = null;
  state = { h: 0, s: 0, l: 50 };

  const swatch = panel.querySelector('.cp-swatch');
  swatch.style.backgroundColor = '';
  swatch.classList.add('cp-swatch--empty');

  panel.querySelector('.cp-hex-value').value = EMPTY.hex;
  panel.querySelector('.cp-rgba-value').value = EMPTY.rgb;
  panel.querySelector('.cp-hsl-value').value = EMPTY.hsl;
  panel.querySelector('.cp-hue-slider').value = 0;
  panel.querySelector('.cp-btn-reset').hidden = true;
  panel.querySelector('.cp-btn-save').hidden = true;

  drawPlaceholderChart(panel.querySelector('.cp-chart'));
}

// ---- Helpers -------------------------------------------------------------

/**
 * Temporarily adds a CSS class to an element then removes it after a delay.
 */
function flash(el, cls, ms = 1400) {
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

function showError(msg) {
  const panel = document.getElementById(PANEL_ID);
  panel.querySelector('.cp-error')?.remove();

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
            <input class="cp-hex-value" type="text" value="${EMPTY.hex}" aria-label="Hex colour value" spellcheck="false" autocomplete="off" />
            <button class="cp-copy-btn" type="button" aria-label="Copy hex value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-value-row" data-copy-target="rgba">
            <span class="cp-value-label">RGB</span>
            <input class="cp-rgba-value" type="text" value="${EMPTY.rgb}" aria-label="RGB colour value" spellcheck="false" autocomplete="off" />
            <button class="cp-copy-btn" type="button" aria-label="Copy RGB value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-value-row" data-copy-target="hsl">
            <span class="cp-value-label">HSL</span>
            <input class="cp-hsl-value" type="text" value="${EMPTY.hsl}" aria-label="HSL colour value" spellcheck="false" autocomplete="off" />
            <button class="cp-copy-btn" type="button" aria-label="Copy HSL value" title="Copy">
              ${copyIcon()}
            </button>
            <span class="cp-row-copied" aria-live="polite">Copied!</span>
          </div>

          <div class="cp-actions">
            <button class="cp-btn-pick" type="button">Pick Color</button>
            <button class="cp-btn-save" type="button" hidden aria-label="Save current colour to recents">Save</button>
            <button class="cp-btn-reset" type="button" hidden aria-label="Reset selection">Reset</button>
            <span class="cp-copied-badge" aria-live="polite">Copied!</span>
          </div>

        </div>
      </div>

      <div class="cp-divider"></div>

      <canvas class="cp-chart" width="288" height="200" aria-label="Color saturation/lightness chart — click or drag to adjust"></canvas>

      <div class="cp-hue-row">
        <span class="cp-hue-label">Hue</span>
        <input type="range" class="cp-hue-slider" min="0" max="360" value="0" aria-label="Hue" />
        <span class="cp-hue-value">0°</span>
      </div>

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
