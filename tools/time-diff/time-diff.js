/**
 * time-diff.js — Time Difference Checker tool
 *
 * Takes two datetime inputs and shows the difference broken down into
 * seconds, minutes, hours, days, and years.
 */

const PANEL_ID = 'panel-time-diff';

export function initTimeDiff() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();

  const startInput = panel.querySelector('.td-start');
  const endInput = panel.querySelector('.td-end');
  const swapBtn = panel.querySelector('.td-btn-swap');
  const nowStartBtn = panel.querySelector('.td-btn-now-start');
  const nowEndBtn = panel.querySelector('.td-btn-now-end');
  const clearBtn = panel.querySelector('.td-btn-clear');

  function update() {
    const startVal = startInput.value;
    const endVal = endInput.value;
    renderResults(panel, startVal, endVal);
  }

  startInput.addEventListener('input', update);
  endInput.addEventListener('input', update);

  swapBtn.addEventListener('click', () => {
    const tmp = startInput.value;
    startInput.value = endInput.value;
    endInput.value = tmp;
    update();
  });

  nowStartBtn.addEventListener('click', () => {
    startInput.value = toLocalDatetimeValue(new Date());
    update();
  });

  nowEndBtn.addEventListener('click', () => {
    endInput.value = toLocalDatetimeValue(new Date());
    update();
  });

  clearBtn.addEventListener('click', () => {
    startInput.value = '';
    endInput.value = '';
    renderResults(panel, '', '');
  });
}

function toLocalDatetimeValue(date) {
  // Returns "YYYY-MM-DDTHH:MM" in local time for datetime-local input
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes())
  );
}

function renderResults(panel, startVal, endVal) {
  const resultsEl = panel.querySelector('.td-results');
  const placeholderEl = panel.querySelector('.td-placeholder');
  const errorEl = panel.querySelector('.td-error');

  if (!startVal || !endVal) {
    resultsEl.hidden = true;
    errorEl.hidden = true;
    placeholderEl.hidden = false;
    return;
  }

  const startMs = Date.parse(startVal);
  const endMs = Date.parse(endVal);

  if (isNaN(startMs) || isNaN(endMs)) {
    resultsEl.hidden = true;
    placeholderEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = 'Invalid date(s).';
    return;
  }

  const diffMs = endMs - startMs;
  const absDiffMs = Math.abs(diffMs);
  const sign = diffMs < 0 ? '-' : '';

  const totalSeconds = Math.floor(absDiffMs / 1000);
  const totalMinutes = Math.floor(absDiffMs / (1000 * 60));
  const totalHours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const totalDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const totalYears = (absDiffMs / (1000 * 60 * 60 * 24 * 365.25));

  const rows = [
    { label: 'Seconds', value: sign + fmt(totalSeconds), unit: 's' },
    { label: 'Minutes', value: sign + fmt(totalMinutes), unit: 'min' },
    { label: 'Hours',   value: sign + fmt(totalHours),   unit: 'hr' },
    { label: 'Days',    value: sign + fmt(totalDays),    unit: 'd' },
    { label: 'Years',   value: sign + fmtDecimal(totalYears), unit: 'yr' },
  ];

  const direction = diffMs === 0
    ? 'Same moment'
    : diffMs > 0
      ? 'End is after start'
      : 'End is before start';

  resultsEl.innerHTML = `
    <div class="td-direction">${direction}</div>
    <div class="td-rows">
      ${rows.map(r => `
        <div class="td-row">
          <span class="td-row__label">${r.label}</span>
          <span class="td-row__value">${r.value}<span class="td-row__unit"> ${r.unit}</span></span>
        </div>
      `).join('')}
    </div>
  `;

  resultsEl.hidden = false;
  placeholderEl.hidden = true;
  errorEl.hidden = true;
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

function fmtDecimal(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function getTemplate() {
  return `
    <div class="td-container">
      <div class="td-inputs">
        <div class="td-field">
          <label class="td-label" for="td-start">Start</label>
          <div class="td-input-row">
            <input class="td-input td-start" id="td-start" type="datetime-local" />
            <button class="td-btn-now td-btn-now-start" title="Set to now">Now</button>
          </div>
        </div>
        <div class="td-field">
          <label class="td-label" for="td-end">End</label>
          <div class="td-input-row">
            <input class="td-input td-end" id="td-end" type="datetime-local" />
            <button class="td-btn-now td-btn-now-end" title="Set to now">Now</button>
          </div>
        </div>
      </div>

      <div class="td-actions">
        <button class="td-btn-swap" title="Swap start and end">⇅ Swap</button>
        <button class="td-btn-clear" title="Clear both fields">Clear</button>
      </div>

      <div class="td-placeholder">Enter start and end datetimes above.</div>
      <div class="td-error" hidden></div>
      <div class="td-results" hidden></div>
    </div>
  `;
}
