/**
 * settings.js — Settings panel
 *
 * Renders:
 *  - Tools section: one toggle row per registered tool (read dynamically from DOM)
 *  - Developer section: Reload Extension button
 *
 * Tool enabled state is stored under 'devToolkitEnabledTools' in chrome.storage.local.
 * Shape: { 'color-picker': true, 'some-tool': false }
 * Absent key = enabled (default on).
 */

import { saveToStorage, loadFromStorage } from '../shared/js/storage.js';

const PANEL_ID = 'panel-settings';
export const ENABLED_TOOLS_KEY = 'devToolkitEnabledTools';

// ---- Init ----------------------------------------------------------------

export async function initSettings() {
  const panel = document.getElementById(PANEL_ID);
  const enabledTools = await loadFromStorage(ENABLED_TOOLS_KEY, {});

  panel.innerHTML = getTemplate();

  renderToolToggles(panel, enabledTools);

  panel.querySelector('.st-btn-reload').addEventListener('click', () => {
    chrome.runtime.reload();
  });
}

// ---- Tool toggles --------------------------------------------------------

function renderToolToggles(panel, enabledTools) {
  const list = panel.querySelector('.st-tool-list');

  // Read tool tabs from the DOM — title attribute is the display name
  const toolTabs = Array.from(
    document.querySelectorAll('[data-tool]:not([data-tool="settings"])')
  );

  if (toolTabs.length === 0) {
    list.innerHTML = '<p class="st-empty">No tools registered.</p>';
    return;
  }

  toolTabs.forEach((tab) => {
    const toolId = tab.dataset.tool;
    const label = tab.getAttribute('title') || toolId;
    const isEnabled = enabledTools[toolId] !== false; // default on

    const row = document.createElement('div');
    row.className = 'st-tool-row';
    row.innerHTML = `
      <span class="st-tool-name">${label}</span>
      <label class="st-toggle" title="${isEnabled ? 'Disable' : 'Enable'} ${label}">
        <input type="checkbox" class="st-toggle-input" data-tool-id="${toolId}" ${isEnabled ? 'checked' : ''} />
        <span class="st-toggle-track">
          <span class="st-toggle-thumb"></span>
        </span>
      </label>
    `;

    row.querySelector('.st-toggle-input').addEventListener('change', (e) => {
      handleToggle(toolId, e.target.checked);
    });

    list.appendChild(row);
  });
}

async function handleToggle(toolId, enabled) {
  const enabledTools = await loadFromStorage(ENABLED_TOOLS_KEY, {});
  enabledTools[toolId] = enabled;
  await saveToStorage(ENABLED_TOOLS_KEY, enabledTools);

  const tab = document.querySelector(`[data-tool="${toolId}"]`);
  const panelId = tab?.getAttribute('aria-controls');
  const toolPanel = panelId ? document.getElementById(panelId) : null;

  if (tab) tab.hidden = !enabled;
  if (toolPanel) toolPanel.hidden = !enabled;

  // If we just disabled the active tool, switch to settings
  if (!enabled && tab?.classList.contains('sidebar__tab--active')) {
    document.querySelector('[data-tool="settings"]')?.click();
  }
}

// ---- Template ------------------------------------------------------------

function getTemplate() {
  return `
    <div class="st-container">

      <div class="st-section">
        <h2 class="st-section-title">Tools</h2>
        <div class="st-tool-list"></div>
      </div>

      <div class="st-section">
        <h2 class="st-section-title">Developer</h2>
        <div class="st-dev-row">
          <div class="st-dev-info">
            <span class="st-dev-label">Reload Extension</span>
            <span class="st-dev-desc">Applies updates without opening chrome://extensions</span>
          </div>
          <button class="st-btn-reload" type="button">Reload</button>
        </div>
      </div>

    </div>
  `;
}
