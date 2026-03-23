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

  const startDate = panel.querySelector('.td-start-date');
  const startTime = panel.querySelector('.td-start-time');
  const endDate   = panel.querySelector('.td-end-date');
  const endTime   = panel.querySelector('.td-end-time');

  function getDatetimeValue(dateInput, timeInput) {
    if (!dateInput.value) return '';
    const time = timeInput.value || '00:00';
    return `${dateInput.value}T${time}`;
  }

  function update() {
    const startVal = getDatetimeValue(startDate, startTime);
    const endVal   = getDatetimeValue(endDate, endTime);
    renderResults(panel, startVal, endVal);
  }

  [startDate, startTime, endDate, endTime].forEach(el => el.addEventListener('input', update));

  panel.querySelector('.td-btn-swap').addEventListener('click', () => {
    const tmpDate = startDate.value;
    const tmpTime = startTime.value;
    startDate.value = endDate.value;
    startTime.value = endTime.value;
    endDate.value = tmpDate;
    endTime.value = tmpTime;
    update();
  });

  panel.querySelector('.td-btn-now-start').addEventListener('click', () => {
    const { date, time } = toLocalParts(new Date());
    startDate.value = date;
    startTime.value = time;
    update();
  });

  panel.querySelector('.td-btn-now-end').addEventListener('click', () => {
    const { date, time } = toLocalParts(new Date());
    endDate.value = date;
    endTime.value = time;
    update();
  });

  panel.querySelector('.td-btn-clear').addEventListener('click', () => {
    [startDate, startTime, endDate, endTime].forEach(el => { el.value = ''; });
    renderResults(panel, '', '');
  });
}

function toLocalParts(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
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
  const totalHours   = Math.floor(absDiffMs / (1000 * 60 * 60));
  const totalDays    = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const totalYears   = (absDiffMs / (1000 * 60 * 60 * 24 * 365.25));

  const remSeconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);
  const remMinutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
  const remHours   = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const rows = [
    { label: 'Seconds', parts: [{ num: fmt(totalSeconds),       unit: 's'   }] },
    { label: 'Minutes', parts: [{ num: fmt(totalMinutes),       unit: 'min' }, { num: fmt(remSeconds),  unit: 's'   }] },
    { label: 'Hours',   parts: [{ num: fmt(totalHours),         unit: 'hr'  }, { num: fmt(remMinutes),  unit: 'min' }] },
    { label: 'Days',    parts: [{ num: fmt(totalDays),          unit: 'd'   }, { num: fmt(remHours),    unit: 'hr'  }] },
    { label: 'Years',   parts: [{ num: fmtDecimal(totalYears),  unit: 'yr'  }] },
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
          <span class="td-row__value">${sign}${r.parts.map(p => `${p.num}<span class="td-row__unit"> ${p.unit}</span>`).join(' ')}</span>
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
          <div class="td-field-header">
            <span class="td-label">Start</span>
            <button class="td-btn-now td-btn-now-start" title="Set to now">Now</button>
          </div>
          <div class="td-input-row">
            <input class="td-input td-start-date" id="td-start-date" type="date" />
            <input class="td-input td-start-time" id="td-start-time" type="time" />
          </div>
        </div>
        <div class="td-field">
          <div class="td-field-header">
            <span class="td-label">End</span>
            <button class="td-btn-now td-btn-now-end" title="Set to now">Now</button>
          </div>
          <div class="td-input-row">
            <input class="td-input td-end-date" id="td-end-date" type="date" />
            <input class="td-input td-end-time" id="td-end-time" type="time" />
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
