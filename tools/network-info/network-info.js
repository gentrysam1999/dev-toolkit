/**
 * network-info.js — Network Info tool
 *
 * Shows:
 *  - Public IPv4 and IPv6 (via api.ipify.org / api6.ipify.org)
 *  - Local network interfaces with addresses (via chrome.system.network)
 *  - Connection quality metadata (via navigator.connection)
 *
 * All IP values are copy-to-clipboard on click. Refresh re-fetches everything.
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
    // api6.ipify may return IPv4 if host has no IPv6 — skip if same as v4
    const isV6 = ip.includes(':');
    v6El.textContent = isV6 ? ip : 'Not available';
    if (isV6) v6Btn.dataset.value = ip;
  } else {
    v6El.textContent = 'Not available';
  }
}

// ---- Local interfaces ----

async function loadLocalInterfaces(panel) {
  const container = panel.querySelector('.ni-interfaces');
  container.innerHTML = '<span class="ni-placeholder">Loading…</span>';

  let interfaces;
  try {
    interfaces = await new Promise((resolve) => {
      chrome.system.network.getNetworkInterfaces(resolve);
    });
  } catch (e) {
    container.innerHTML = `<span class="ni-error">Error: ${e.message}</span>`;
    return;
  }

  if (!interfaces || interfaces.length === 0) {
    container.innerHTML = '<span class="ni-placeholder">No interfaces found</span>';
    return;
  }

  // Group addresses by interface name
  const grouped = new Map();
  for (const iface of interfaces) {
    if (!grouped.has(iface.name)) grouped.set(iface.name, []);
    grouped.get(iface.name).push(iface);
  }

  container.innerHTML = '';
  for (const [name, addrs] of grouped) {
    const ifaceEl = document.createElement('div');
    ifaceEl.className = 'ni-iface';

    const nameEl = document.createElement('div');
    nameEl.className = 'ni-iface__name';
    nameEl.textContent = name;
    ifaceEl.appendChild(nameEl);

    for (const addr of addrs) {
      const isV6    = addr.address.includes(':');
      const display = `${addr.address}/${addr.prefixLength}`;

      const addrEl = document.createElement('div');
      addrEl.className = 'ni-iface__addr';
      addrEl.innerHTML = `
        <span class="ni-badge ${isV6 ? 'ni-badge--v6' : 'ni-badge--v4'}">${isV6 ? 'v6' : 'v4'}</span>
        <span class="ni-iface__addr-text">${display}</span>
        <button class="ni-copy-btn" data-value="${addr.address}" title="Copy address">⎘</button>
      `;
      ifaceEl.appendChild(addrEl);
    }

    container.appendChild(ifaceEl);
  }
}

// ---- Connection info ----

function loadConnectionInfo(panel) {
  const container = panel.querySelector('.ni-connection');
  const conn = navigator.connection;

  const rows = [
    ['Online',     navigator.onLine ? 'Yes' : 'No'],
    ['Type',       conn?.effectiveType?.toUpperCase() ?? '—'],
    ['Downlink',   conn?.downlink != null ? `${conn.downlink} Mbps` : '—'],
    ['RTT',        conn?.rtt     != null ? `${conn.rtt} ms`     : '—'],
    ['Save Data',  conn?.saveData ? 'On' : 'Off'],
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
