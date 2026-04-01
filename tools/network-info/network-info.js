/**
 * network-info.js — Network Info tool
 *
 * Shows:
 *  - Public IPv4 and IPv6 (via api.ipify.org / api6.ipify.org)
 *  - Local IP addresses (via WebRTC ICE candidate enumeration — no special permissions needed)
 *  - Connection quality metadata (via navigator.connection)
 *
 * All IP values are copy-to-clipboard on click. Refresh re-fetches everything.
 *
 * Note: chrome.system.network is ChromeOS-only and is not used here.
 */

import { writeToClipboard } from '../../shared/js/clipboard.js';

const PANEL_ID = 'panel-network-info';

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

  panel.querySelector('.ni-btn-refresh').addEventListener('click', () => loadAll(panel));
  loadAll(panel);
}

// ---- Orchestration ----

async function loadAll(panel) {
  const refreshBtn = panel.querySelector('.ni-btn-refresh');
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';

  await Promise.all([
    loadPublicIPs(panel),
    loadLocalInterfaces(panel),
  ]);
  loadConnectionInfo(panel);

  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Refresh';
}

// ---- Public IPs ----

async function loadPublicIPs(panel) {
  const v4El  = panel.querySelector('.ni-public-v4');
  const v6El  = panel.querySelector('.ni-public-v6');
  const v4Btn = panel.querySelector('.ni-copy-v4');
  const v6Btn = panel.querySelector('.ni-copy-v6');

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
  } else {
    v4El.textContent = 'Unavailable';
  }

  if (v6Result.status === 'fulfilled') {
    const ip = v6Result.value.ip;
    // api6.ipify may return IPv4 if host has no IPv6 — skip if so
    const isV6 = ip.includes(':');
    v6El.textContent = isV6 ? ip : 'Not available';
    if (isV6) v6Btn.dataset.value = ip;
  } else {
    v6El.textContent = 'Not available';
  }
}

// ---- Local interfaces (WebRTC) ----

async function loadLocalInterfaces(panel) {
  const container = panel.querySelector('.ni-interfaces');
  container.innerHTML = '<span class="ni-placeholder">Loading…</span>';

  try {
    const ips = await getLocalIPsViaWebRTC();

    if (ips.length === 0) {
      container.innerHTML = '<span class="ni-placeholder">No local addresses found</span>';
      return;
    }

    container.innerHTML = '';
    for (const ip of ips) {
      const isV6   = ip.includes(':');
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
        <span class="ni-title">Network Info</span>
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

    </div>
  `;
}
