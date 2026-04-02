/**
 * speedtest.js — Speed Test tool
 *
 * Measures real download throughput by fetching a known-size payload from
 * Cloudflare's speed-test endpoint and timing the stream. This gives a
 * per-session measurement rather than relying on navigator.connection.downlink,
 * which is a rounded passive estimate.
 *
 * Phases:
 *  1. Warm-up  — 500 KB fetch to establish the TCP connection (result discarded).
 *  2. Measure  — 10 MB streamed fetch; bytes are counted as chunks arrive.
 *  3. Result   — Mbps = (bytes × 8) / elapsed_seconds / 1 000 000
 */

const PANEL_ID     = 'panel-speedtest';
const DOWN_URL     = 'https://speed.cloudflare.com/__down';
const WARMUP_BYTES = 500_000;    // 500 KB — connection warm-up (discarded)
const TEST_BYTES   = 10_000_000; // 10 MB  — timed measurement

export function initSpeedtest() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();
  panel.querySelector('.sp-btn-run').addEventListener('click', () => runTest(panel));
}

// ---- Test orchestration ----

async function runTest(panel) {
  const btn       = panel.querySelector('.sp-btn-run');
  const statusEl  = panel.querySelector('.sp-status');
  const fillEl    = panel.querySelector('.sp-progress-fill');
  const valueEl   = panel.querySelector('.sp-result-value');
  const detailsEl = panel.querySelector('.sp-details');

  btn.disabled = true;
  btn.textContent = 'Running…';
  detailsEl.hidden = true;
  valueEl.textContent = '—';
  fillEl.style.width = '0%';
  fillEl.classList.remove('sp-progress-fill--done');

  try {
    // Phase 1: warm-up (establish TCP connection, prime routing)
    setPhase(statusEl, fillEl, 'Connecting…', 5);
    await streamBytes(WARMUP_BYTES);

    // Phase 2: timed download
    setPhase(statusEl, fillEl, 'Measuring…', 10);
    let received = 0;
    const t0 = performance.now();

    await streamBytes(TEST_BYTES, (chunk) => {
      received += chunk;
      const pct = 10 + (received / TEST_BYTES) * 85;
      fillEl.style.width = `${pct.toFixed(1)}%`;
    });

    const elapsed = (performance.now() - t0) / 1000; // seconds
    const mbps    = (TEST_BYTES * 8) / elapsed / 1_000_000;

    // Show result
    fillEl.style.width = '100%';
    fillEl.classList.add('sp-progress-fill--done');
    statusEl.textContent = 'Complete';
    valueEl.textContent  = mbps.toFixed(1);

    // Populate details
    panel.querySelector('.sp-detail-duration').textContent = `${elapsed.toFixed(2)} s`;
    panel.querySelector('.sp-detail-bytes').textContent    = formatBytes(TEST_BYTES);
    const { label, cls } = getRating(mbps);
    const ratingEl = panel.querySelector('.sp-detail-rating');
    ratingEl.textContent = label;
    ratingEl.className   = `sp-detail-rating ${cls}`;
    detailsEl.hidden = false;

  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    fillEl.style.width = '0%';
    valueEl.textContent = '—';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Again';
  }
}

function setPhase(statusEl, fillEl, text, pct) {
  statusEl.textContent = text;
  fillEl.style.width   = `${pct}%`;
}

// ---- Streaming fetch ----
// Reads the response body chunk by chunk; calls onChunk(byteLength) for each.

async function streamBytes(bytes, onChunk) {
  const url      = `${DOWN_URL}?bytes=${bytes}&r=${Math.random()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (onChunk && value) onChunk(value.length);
  }
}

// ---- Helpers ----

function formatBytes(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} MB`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function getRating(mbps) {
  if (mbps >= 100) return { label: 'Excellent', cls: 'sp-rating--excellent' };
  if (mbps >= 25)  return { label: 'Good',      cls: 'sp-rating--good' };
  if (mbps >= 5)   return { label: 'Moderate',  cls: 'sp-rating--moderate' };
  return             { label: 'Slow',       cls: 'sp-rating--slow' };
}

// ---- Template ----

function getTemplate() {
  return `
    <div class="sp-container">

      <div class="sp-header">
        <span class="sp-title">Speed Test</span>
        <button class="sp-btn-run">Run Test</button>
      </div>

      <div class="sp-status-row">
        <span class="sp-status">Ready — press Run Test to start</span>
      </div>

      <div class="sp-progress-track">
        <div class="sp-progress-fill"></div>
      </div>

      <div class="sp-result">
        <span class="sp-result-value">—</span>
        <span class="sp-result-unit">Mbps</span>
      </div>
      <div class="sp-result-label">Download speed</div>

      <div class="sp-details" hidden>
        <div class="sp-section__label">Details</div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Duration</span>
          <span class="sp-detail-duration">—</span>
        </div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Data</span>
          <span class="sp-detail-bytes">—</span>
        </div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Rating</span>
          <span class="sp-detail-rating">—</span>
        </div>
      </div>

      <div class="sp-note">
        Downloads ~10 MB from Cloudflare CDN for an active throughput measurement.
      </div>

    </div>
  `;
}
