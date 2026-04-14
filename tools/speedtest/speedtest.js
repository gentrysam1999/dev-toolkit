/**
 * speedtest.js — Speed Test tool
 *
 * Automatically selects the best speed-test server for the user's location:
 *  1. Geolocate public IP via ipapi.co → get country name
 *  2. Fetch server list CSV (cached 1 week in chrome.storage.local)
 *  3. Ping up to PING_COUNT servers in that country, pick lowest RTT
 *  4. Run parallel download streams + upload loops against the winner
 *
 * Server list source: https://gist.github.com/ofou/654efe67e173a6bff5c64ba26c09d058
 * Servers follow the Ookla speedtest protocol: GET /download?size=N, POST /upload
 */

const PANEL_ID    = 'panel-speedtest';
const GEO_URL     = 'https://cloudflare.com/cdn-cgi/trace';
const SERVERS_CSV = 'https://gist.githubusercontent.com/ofou/654efe67e173a6bff5c64ba26c09d058/raw/servers.csv';
const CACHE_KEY   = 'speedtest_servers_v1';
const CACHE_TTL   = 7 * 24 * 60 * 60 * 1000; // 1 week

const DOWN_STREAMS  = 4;
const UP_STREAMS    = 2;
const DOWN_DURATION = 15_000; // ms
const UP_DURATION   = 12_000; // ms
const TICK_MS       =    400;
const DOWN_CHUNK    = 25_000_000; // 25 MB per download fetch
const UPLOAD_CHUNK  =  1_000_000; //  1 MB per upload POST
const PING_COUNT    = 5;          // candidates to ping
const PING_TIMEOUT  = 3_000;      // ms per ping

export function initSpeedtest() {
  const panel = document.getElementById(PANEL_ID);
  panel.innerHTML = getTemplate();
  panel.querySelector('.sp-btn-run').addEventListener('click', () => runTest(panel));
}

// ---- Test orchestration ----

async function runTest(panel) {
  const btn        = panel.querySelector('.sp-btn-run');
  const statusEl   = panel.querySelector('.sp-status');
  const serverEl   = panel.querySelector('.sp-server');
  const fillEl     = panel.querySelector('.sp-progress-fill');
  const downValEl  = panel.querySelector('.sp-result-value--down');
  const upValEl    = panel.querySelector('.sp-result-value--up');
  const detailsEl  = panel.querySelector('.sp-details');

  btn.disabled = true;
  btn.textContent = 'Running…';
  detailsEl.hidden = true;
  serverEl.textContent = '';
  downValEl.textContent = '—';
  upValEl.textContent   = '—';
  fillEl.style.width = '0%';
  fillEl.classList.remove('sp-progress-fill--done');

  const totalMs = DOWN_DURATION + UP_DURATION;

  try {
    // ---- Server selection ----
    setStatus(statusEl, 'Locating…');
    const server = await selectServer(statusEl);
    serverEl.textContent = `${server.city}, ${server.country} · ${server.provider} · ${server.rtt} ms`;

    // ---- Download ----
    setStatus(statusEl, 'Download — measuring…');
    const downBase = `http://${server.host}`;
    const downMbps = await measureDownload(downBase, (mbps, elapsed) => {
      downValEl.textContent = mbps.toFixed(1);
      fillEl.style.width = `${Math.min((elapsed / totalMs) * 100, 65).toFixed(1)}%`;
    });
    downValEl.textContent = downMbps.toFixed(1);

    // ---- Upload ----
    setStatus(statusEl, 'Upload — measuring…');
    const uploadPayload = buildUploadPayload(UPLOAD_CHUNK);
    const upMbps = await measureUpload(downBase, uploadPayload, (mbps, elapsed) => {
      upValEl.textContent = mbps.toFixed(1);
      const pct = Math.min(((DOWN_DURATION + elapsed) / totalMs) * 100, 99);
      fillEl.style.width = `${pct.toFixed(1)}%`;
    });
    upValEl.textContent = upMbps.toFixed(1);

    // ---- Done ----
    fillEl.style.width = '100%';
    fillEl.classList.add('sp-progress-fill--done');
    setStatus(statusEl, 'Complete');

    const { label, cls } = getRating(downMbps);
    const ratingEl = panel.querySelector('.sp-detail-rating');
    ratingEl.textContent = label;
    ratingEl.className   = `sp-detail-rating ${cls}`;
    panel.querySelector('.sp-detail-down').textContent = `${downMbps.toFixed(1)} Mbps`;
    panel.querySelector('.sp-detail-up').textContent   = `${upMbps.toFixed(1)} Mbps`;
    panel.querySelector('.sp-detail-server').textContent = `${server.city}, ${server.country}`;
    detailsEl.hidden = false;

  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`);
    fillEl.style.width = '0%';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Again';
  }
}

function setStatus(el, text) { el.textContent = text; }

// ---- Country code → name (matches CSV country column) ----
const COUNTRY_NAMES = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AR:'Argentina',AM:'Armenia',
  AU:'Australia',AT:'Austria',AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',
  BY:'Belarus',BE:'Belgium',BO:'Bolivia',BA:'Bosnia and Herzegovina',BR:'Brazil',
  BG:'Bulgaria',KH:'Cambodia',CM:'Cameroon',CA:'Canada',CL:'Chile',CN:'China',
  CO:'Colombia',HR:'Croatia',CY:'Cyprus',CZ:'Czech Republic',DK:'Denmark',
  DO:'Dominican Republic',EC:'Ecuador',EG:'Egypt',SV:'El Salvador',EE:'Estonia',
  ET:'Ethiopia',FI:'Finland',FR:'France',GE:'Georgia',DE:'Germany',GH:'Ghana',
  GR:'Greece',GT:'Guatemala',HN:'Honduras',HK:'Hong Kong',HU:'Hungary',
  IN:'India',ID:'Indonesia',IQ:'Iraq',IE:'Ireland',IL:'Israel',IT:'Italy',
  JM:'Jamaica',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KW:'Kuwait',
  LV:'Latvia',LB:'Lebanon',LT:'Lithuania',LU:'Luxembourg',MO:'Macao',MY:'Malaysia',
  MX:'Mexico',MD:'Moldova',MA:'Morocco',MZ:'Mozambique',MM:'Myanmar',NP:'Nepal',
  NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',MK:'North Macedonia',NO:'Norway',
  OM:'Oman',PK:'Pakistan',PA:'Panama',PY:'Paraguay',PE:'Peru',PH:'Philippines',
  PL:'Poland',PT:'Portugal',PR:'Puerto Rico',QA:'Qatar',RO:'Romania',RU:'Russia',
  SA:'Saudi Arabia',SN:'Senegal',RS:'Serbia',SG:'Singapore',SK:'Slovakia',
  SI:'Slovenia',ZA:'South Africa',KR:'South Korea',ES:'Spain',LK:'Sri Lanka',
  SE:'Sweden',CH:'Switzerland',TW:'Taiwan',TZ:'Tanzania',TH:'Thailand',
  TN:'Tunisia',TR:'Turkey',UA:'Ukraine',AE:'United Arab Emirates',
  GB:'United Kingdom',US:'United States',UY:'Uruguay',UZ:'Uzbekistan',
  VE:'Venezuela',VN:'Vietnam',ZW:'Zimbabwe',
};

// ---- Server selection ----

async function selectServer(statusEl) {
  // 1. Geolocate
  const trace = await fetch(GEO_URL).then(r => {
    if (!r.ok) throw new Error(`Geolocation failed (${r.status})`);
    return r.text();
  });
  const locMatch = trace.match(/^loc=(.+)$/m);
  if (!locMatch) throw new Error('Could not determine country');
  const country = COUNTRY_NAMES[locMatch[1].trim()];
  if (!country) throw new Error(`Unknown country code: ${locMatch[1].trim()}`);

  // 2. Load server list (cached)
  setStatus(statusEl, `Finding servers in ${country}…`);
  const servers = await loadServers(country);
  if (servers.length === 0) throw new Error(`No servers found for ${country}`);

  // 3. Ping candidates
  setStatus(statusEl, `Selecting fastest server…`);
  const candidates = shuffle(servers).slice(0, PING_COUNT);
  const results = await Promise.all(candidates.map(pingServer));
  const ranked  = results.filter(s => s.rtt !== null).sort((a, b) => a.rtt - b.rtt);
  if (ranked.length === 0) throw new Error('No servers responded to ping');

  return ranked[0];
}

async function loadServers(country) {
  // Check cache
  const cached = await chromeGet(CACHE_KEY);
  if (cached && cached.country === country && Date.now() - cached.ts < CACHE_TTL) {
    return cached.servers;
  }

  // Fetch & parse CSV
  const text = await fetch(SERVERS_CSV).then(r => {
    if (!r.ok) throw new Error(`Server list fetch failed (${r.status})`);
    return r.text();
  });

  const servers = parseCSV(text).filter(s =>
    s.country.toLowerCase() === country.toLowerCase()
  );

  await chromeSet(CACHE_KEY, { country, ts: Date.now(), servers });
  return servers;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  // Skip header row
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const cols = splitCSVLine(line);
    return {
      country:  (cols[0] || '').trim(),
      city:     (cols[1] || '').trim(),
      provider: (cols[2] || '').trim(),
      host:     (cols[3] || '').trim(),
      id:       (cols[4] || '').trim(),
    };
  }).filter(s => s.host);
}

function splitCSVLine(line) {
  const cols = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur);
  return cols;
}

async function pingServer(server) {
  const url = `http://${server.host}/latency.txt?r=${Math.random()}`;
  const t0  = performance.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(PING_TIMEOUT) });
    await r.text();
    return { ...server, rtt: Math.round(performance.now() - t0) };
  } catch {
    return { ...server, rtt: null };
  }
}

// ---- Download measurement ----

async function measureDownload(base, onTick) {
  const controller = new AbortController();
  const { signal } = controller;
  let totalBytes = 0;
  const t0 = performance.now();

  const streams = Array.from({ length: DOWN_STREAMS }, () =>
    downloadLoop(base, signal, (n) => { totalBytes += n; })
  );

  const tickId = setInterval(() => {
    const elapsed = performance.now() - t0;
    const mbps = totalBytes > 0 ? (totalBytes * 8) / (elapsed / 1000) / 1_000_000 : 0;
    onTick(mbps, elapsed);
  }, TICK_MS);

  await sleep(DOWN_DURATION);
  controller.abort();
  clearInterval(tickId);
  await Promise.allSettled(streams);

  return (totalBytes * 8) / (DOWN_DURATION / 1000) / 1_000_000;
}

async function downloadLoop(base, signal, onChunk) {
  while (!signal.aborted) {
    const url = `${base}/download?size=${DOWN_CHUNK}&r=${Math.random()}`;
    let response;
    try {
      response = await fetch(url, { signal });
    } catch (err) {
      if (err.name === 'AbortError') return;
      throw err;
    }
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);

    const reader = response.body.getReader();
    try {
      while (true) {
        let result;
        try { result = await reader.read(); }
        catch (err) { if (err.name === 'AbortError') return; throw err; }
        if (result.done) break;
        if (result.value) onChunk(result.value.length);
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// ---- Upload measurement ----

async function measureUpload(base, payload, onTick) {
  let totalBytes = 0;
  let done = false;
  const t0 = performance.now();

  const streams = Array.from({ length: UP_STREAMS }, () =>
    uploadLoop(base, payload, () => done, (n) => { totalBytes += n; })
  );

  const tickId = setInterval(() => {
    const elapsed = performance.now() - t0;
    const mbps = totalBytes > 0 ? (totalBytes * 8) / (elapsed / 1000) / 1_000_000 : 0;
    onTick(mbps, elapsed);
  }, TICK_MS);

  await sleep(UP_DURATION);
  done = true;
  clearInterval(tickId);
  await Promise.allSettled(streams);

  return (totalBytes * 8) / (UP_DURATION / 1000) / 1_000_000;
}

function uploadLoop(base, payload, isDone, onBytes) {
  return new Promise((resolve, reject) => {
    function next() {
      if (isDone()) { resolve(); return; }
      const xhr = new XMLHttpRequest();
      xhr.onload  = () => { onBytes(payload.byteLength); next(); };
      xhr.onerror = () => reject(new Error('Upload request failed'));
      xhr.open('POST', `${base}/upload?r=${Math.random()}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(payload);
    }
    next();
  });
}

// ---- Helpers ----

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildUploadPayload(bytes) {
  const buf = new Uint8Array(bytes);
  for (let off = 0; off < bytes; off += 65536) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, bytes)));
  }
  return buf;
}

function chromeGet(key) {
  return new Promise(resolve =>
    chrome.storage.local.get(key, r => resolve(r[key] ?? null))
  );
}

function chromeSet(key, value) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
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

      <div class="sp-server"></div>

      <div class="sp-progress-track">
        <div class="sp-progress-fill"></div>
      </div>

      <div class="sp-results-grid">
        <div class="sp-result-col">
          <div class="sp-result">
            <span class="sp-result-value sp-result-value--down">—</span>
            <span class="sp-result-unit">Mbps</span>
          </div>
          <div class="sp-result-label">Download</div>
        </div>
        <div class="sp-result-divider"></div>
        <div class="sp-result-col">
          <div class="sp-result">
            <span class="sp-result-value sp-result-value--up">—</span>
            <span class="sp-result-unit">Mbps</span>
          </div>
          <div class="sp-result-label">Upload</div>
        </div>
      </div>

      <div class="sp-details" hidden>
        <div class="sp-section__label">Details</div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Server</span>
          <span class="sp-detail-server">—</span>
        </div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Download</span>
          <span class="sp-detail-down">—</span>
        </div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Upload</span>
          <span class="sp-detail-up">—</span>
        </div>
        <div class="sp-detail-row">
          <span class="sp-detail-key">Rating</span>
          <span class="sp-detail-rating">—</span>
        </div>
      </div>

    </div>
  `;
}
