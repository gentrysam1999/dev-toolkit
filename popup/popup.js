/**
 * popup.js — Shell: tab navigation + tool registry.
 *
 * To register a new tool:
 *   1. Add its init function to the TOOLS map (key = data-tool value)
 *   2. Add the sidebar <li> and content <section> in popup.html
 *   3. Link the tool's CSS in popup.html
 */

import { initColorPicker } from '../tools/color-picker/color-picker.js';
import { initSettings, ENABLED_TOOLS_KEY } from '../settings/settings.js';
import { loadFromStorage } from '../shared/storage.js';

// ---- Tool registry ----
const TOOLS = {
  'color-picker': initColorPicker,
  // 'contrast':     initContrastChecker,   // future example
};

// ---- Tab switching ----
document.getElementById('sidebar').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tool]');
  if (!tab || tab.hidden) return;

  const panelId = tab.getAttribute('aria-controls');

  // Deactivate all tabs and panels
  document.querySelectorAll('.sidebar__tab').forEach((t) => {
    t.classList.remove('sidebar__tab--active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('.tool-panel').forEach((p) => {
    p.classList.remove('tool-panel--active');
  });

  // Activate selected
  tab.classList.add('sidebar__tab--active');
  tab.setAttribute('aria-selected', 'true');
  tab.setAttribute('tabindex', '0');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('tool-panel--active');
});

// Keyboard navigation on sidebar tabs
document.getElementById('sidebar').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.target.closest('[data-tool]')?.click();
  }
});

// ---- Apply enabled/disabled state on load ----
async function applyEnabledTools() {
  const enabledTools = await loadFromStorage(ENABLED_TOOLS_KEY, {});

  document.querySelectorAll('[data-tool]:not([data-tool="settings"])').forEach((tab) => {
    const toolId = tab.dataset.tool;
    const panelId = tab.getAttribute('aria-controls');
    const toolPanel = panelId ? document.getElementById(panelId) : null;
    const disabled = enabledTools[toolId] === false;

    tab.hidden = disabled;
    if (toolPanel) toolPanel.hidden = disabled;

    // If the active tab is disabled, fall through to the first visible tool or settings
    if (disabled && tab.classList.contains('sidebar__tab--active')) {
      tab.classList.remove('sidebar__tab--active');
      tab.setAttribute('aria-selected', 'false');
      if (toolPanel) toolPanel.classList.remove('tool-panel--active');

      const firstVisible = document.querySelector('[data-tool]:not([hidden])');
      firstVisible?.click();
    }
  });
}

// ---- Init ----
await applyEnabledTools();
Object.entries(TOOLS).forEach(([, initFn]) => initFn());
initSettings();
