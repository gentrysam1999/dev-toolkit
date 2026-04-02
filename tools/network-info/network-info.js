/**
 * network-info.js — Network Info tool
 *
 * Shows:
 *  - Public IPv4 and IPv6 (via api.ipify.org / api6.ipify.org)
 *  - Local IP addresses (via WebRTC ICE candidate enumeration — no special permissions needed)
 *  - Connection quality metadata (via navigator.connection)
 *  - System info: CPU cores, device memory, display resolution
 *
 * Auto-refreshes local IPs, connection, and system info every 5 s while the panel
 * is active. Public IPs only re-fetch on manual Refresh (they rarely change and
 * hitting an external API every 5 s is unnecessary).
 *
 * Note: chrome.system.network is ChromeOS-only and is not used here.
 */

import { writeToClipboard } from '../../shared/js/clipboard.js';

const PANEL_ID    = 'panel-network-info';
const AUTO_INTERVAL_MS = 5000;

export function initNetworkInfo() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();

  // Event-delegated copy handler for all .ni-copy-btn elements
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.ni-copy-btn');
    if (!btn) return;
    const value = btn.dataset.value;
    if (value) handleCopy(btn, value);
  });

  panel.querySelector('.ni-btn-refresh').addEventListener('click', () => fullRefresh(panel));

  // Start/stop auto-refresh based on whether this panel is the active tab.
  let autoTimer = null;

  const startAuto = () => {
    if (autoTimer) return;
    autoTimer = setInterval(() => autoRefresh(panel), AUTO_INTERVAL_MS);
    panel.querySelector('.ni-live').hidden = false;
  };

  const stopAuto = () => {
    clearInterval(autoTimer);
    autoTimer = null;
    panel.querySelector('.ni-live').hidden = true;
  };

  new MutationObserver(() => {
    if (panel.classList.contains('tool-panel--active')) {
      startAuto();
    } else {
      stopAuto();
    }
  }).observe(panel, { attributeFilter: ['class'] });

  // Initial full load (includes public IPs).
  fullRefresh(panel);
  startAuto();
}

// ---- Full refresh (manual button + initial load) ----
// Fetches everything including public IPs from external API.

async function fullRefresh(panel) {
  const refreshBtn = panel.querySelector('.ni-btn-refresh');
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';

  const [publicIPs] = await Promise.all([
    loadPublicIPs(panel),
    loadLocalInterfaces(panel),
  ]);
  deduplicateLocalIPs(panel, publicIPs);
  await refreshLive(panel);

  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Refresh';
}

// ---- Auto-refresh (no external API calls) ----
// Re-reads local IPs, connection, and display. Deduplicates against the
// public IPs already shown (read from existing data-value attributes).

async function autoRefresh(panel) {
  await loadLocalInterfaces(panel);
  deduplicateLocalIPs(panel, getDisplayedPublicIPs(panel));
  await refreshLive(panel);
}

// ---- Shared live data (called by both full and auto refresh) ----
// Add anything here that should always be kept up to date.

async function refreshLive(panel) {
  loadConnectionInfo(panel);
  await loadSystemInfo(panel);
}

// ---- Helpers ----

// Read the public IPs already displayed (avoids re-fetching).
function getDisplayedPublicIPs(panel) {
  const ips = new Set();
  const v4 = panel.querySelector('.ni-copy-v4')?.dataset.value;
  const v6 = panel.querySelector('.ni-copy-v6')?.dataset.value;
  if (v4) ips.add(v4);
  if (v6) ips.add(v6);
  return ips;
}

// Remove local interface entries whose IP is already shown as a public IP.
function deduplicateLocalIPs(panel, publicIPs) {
  panel.querySelectorAll('.ni-interfaces .ni-copy-btn').forEach((btn) => {
    if (publicIPs.has(btn.dataset.value)) btn.closest('.ni-iface').remove();
  });

  const container = panel.querySelector('.ni-interfaces');
  if (!container.querySelector('.ni-iface')) {
    container.innerHTML = '<span class="ni-placeholder">No private addresses found</span>';
  }
}

// ---- Public IPs ----
// Returns a Set of successfully resolved public IP strings.

async function loadPublicIPs(panel) {
  const v4El  = panel.querySelector('.ni-public-v4');
  const v6El  = panel.querySelector('.ni-public-v6');
  const v4Btn = panel.querySelector('.ni-copy-v4');
  const v6Btn = panel.querySelector('.ni-copy-v6');
  const publicIPs = new Set();

  v4El.textContent = '…';
  v6El.textContent = '…';
  v4Btn.dataset.value = '';
  v6Btn.dataset.value = '';

  const [v4Result, v6Result] = await Promise.allSettled([
    fetch('https://api.ipify.org?format=json').then((r) => r.json()),
    fetch('https://api6.ipify.org?format=json').then((r) => r.json()),
  ]);

  if (v4Result.status === 'fulfilled') {
    const ip = v4Result.value.ip;
    v4El.textContent = ip;
    v4Btn.dataset.value = ip;
    publicIPs.add(ip);
  } else {
    v4El.textContent = 'Unavailable';
  }

  if (v6Result.status === 'fulfilled') {
    const ip = v6Result.value.ip;
    // api6.ipify may return IPv4 if host has no IPv6 — skip if so
    const isV6 = ip.includes(':');
    v6El.textContent = isV6 ? ip : 'Not available';
    if (isV6) {
      v6Btn.dataset.value = ip;
      publicIPs.add(ip);
    }
  } else {
    v6El.textContent = 'Not available';
  }

  return publicIPs;
}

// ---- Local interfaces (WebRTC) ----

async function loadLocalInterfaces(panel) {
  const container = panel.querySelector('.ni-interfaces');

  try {
    const ips = await getLocalIPsViaWebRTC();

    if (ips.length === 0) {
      container.innerHTML = '<span class="ni-placeholder">No local addresses found</span>';
      return;
    }

    container.innerHTML = '';
    for (const ip of ips) {
      const isV6    = ip.includes(':');
      const ifaceEl = document.createElement('div');
      ifaceEl.className = 'ni-iface';
      ifaceEl.innerHTML = `
        <div class="ni-iface__addr">
          <span class="ni-badge ${isV6 ? 'ni-badge--v6' : 'ni-badge--v4'}">${isV6 ? 'v6' : 'v4'}</span>
          <span class="ni-iface__addr-text">${ip}</span>
          <button class="ni-copy-btn" data-value="${ip}" title="Copy address">⎘</button>
        </div>
      `;
      container.appendChild(ifaceEl);
    }
  } catch (e) {
    container.innerHTML = `<span class="ni-error">Error: ${e.message}</span>`;
  }
}

// Enumerate local host-type ICE candidates via WebRTC.
// Requires no special permissions; works on all platforms.
function getLocalIPsViaWebRTC() {
  return new Promise((resolve, reject) => {
    const ips = new Set();
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch (e) {
      reject(e);
      return;
    }

    pc.createDataChannel('');
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(reject);

    const finish = () => { pc.close(); resolve([...ips]); };
    const timeout = setTimeout(finish, 2000);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        clearTimeout(timeout);
        finish();
        return;
      }
      // Candidate SDP: "candidate:<f> <c> <proto> <pri> <address> <port> typ <type> ..."
      const parts = e.candidate.candidate.split(' ');
      const address = parts[4];
      const type    = parts[7];
      if (type === 'host' && address) ips.add(address);
    };
  });
}

// ---- Connection info ----

function loadConnectionInfo(panel) {
  const container = panel.querySelector('.ni-connection');
  const conn = navigator.connection;

  const rows = [
    ['Online',    navigator.onLine ? 'Yes' : 'No'],
    ['Type',      conn?.effectiveType?.toUpperCase() ?? '—'],
    ['Downlink',  conn?.downlink != null ? `${conn.downlink} Mbps` : '—'],
    ['RTT',       conn?.rtt     != null ? `${conn.rtt} ms`     : '—'],
    ['Save Data', conn?.saveData ? 'On' : 'Off'],
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="ni-row">
      <span class="ni-row__label">${label}</span>
      <span class="ni-row__value">${value}</span>
    </div>
  `).join('');
}

// ---- Display info ----

async function loadSystemInfo(panel) {
  const container = panel.querySelector('.ni-system');

  const dpr    = window.devicePixelRatio;
  const res    = `${screen.width} × ${screen.height}`;
  const phyRes = dpr !== 1
    ? `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`
    : null;

  let winDims = '—';
  try {
    const win = await chrome.windows.getCurrent();
    winDims = `${win.width} × ${win.height}`;
  } catch (_) { /* non-fatal */ }

  const rows = [
    ['Screen',   res],
    ...(phyRes ? [['Physical', phyRes]] : []),
    ['DPI Scale', `${dpr}×`],
    ['Window',   winDims],
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="ni-row">
      <span class="ni-row__label">${label}</span>
      <span class="ni-row__value">${value}</span>
    </div>
  `).join('');
}

// ---- Copy helper ----

async function handleCopy(btn, value) {
  const ok = await writeToClipboard(value);
  if (ok) {
    const orig = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = orig; }, 1200);
  }
}

// ---- Template ----

function getTemplate() {
  return `
    <div class="ni-container">

      <div class="ni-header">
        <span class="ni-title">System & Network</span>
        <span class="ni-live" hidden title="Auto-refreshing every 5 s">
          <span class="ni-live__dot"></span>Live
        </span>
        <button class="ni-btn-refresh">Refresh</button>
      </div>

      <!-- Public IPs -->
      <div class="ni-section">
        <div class="ni-section__label">Public IP</div>
        <div class="ni-row">
          <span class="ni-row__label">
            <span class="ni-badge ni-badge--v4">v4</span> IPv4
          </span>
          <span class="ni-row__value ni-public-v4">…</span>
          <button class="ni-copy-btn ni-copy-v4" data-value="" title="Copy">⎘</button>
        </div>
        <div class="ni-row">
          <span class="ni-row__label">
            <span class="ni-badge ni-badge--v6">v6</span> IPv6
          </span>
          <span class="ni-row__value ni-public-v6">…</span>
          <button class="ni-copy-btn ni-copy-v6" data-value="" title="Copy">⎘</button>
        </div>
      </div>

      <!-- Local interfaces -->
      <div class="ni-section">
        <div class="ni-section__label">Local Interfaces</div>
        <div class="ni-interfaces">
          <span class="ni-placeholder">Loading…</span>
        </div>
      </div>

      <!-- Connection quality -->
      <div class="ni-section">
        <div class="ni-section__label">Connection</div>
        <div class="ni-connection"></div>
      </div>

      <!-- Display -->
      <div class="ni-section">
        <div class="ni-section__label">Display</div>
        <div class="ni-system"></div>
      </div>

    </div>
  `;
}
