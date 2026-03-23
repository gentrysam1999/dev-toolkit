# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Extension (Manifest V3) developer toolkit. Intentionally dependency-free — no npm, no bundler, no framework. ES modules are loaded natively by Chrome.

## Loading / testing the extension

No build step. Load the unpacked extension directly:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder
4. After any code change, click the **↺ refresh** button on the extension card

The Settings panel inside the extension has a **Reload Extension** button (`chrome.runtime.reload()`) for convenience after pulling updates.

## Architecture

The popup is a shell with a left sidebar for navigation. Tools are self-contained modules; settings is a special built-in panel.

```
popup/popup.js        ← ES module entry point: tab switching + tool registry
popup/popup.html      ← sidebar <li> tabs + <section> panel slots
tools/<name>/         ← each tool: <name>.js + <name>.css
settings/             ← settings panel: settings.js + settings.css
shared/               ← pure utilities, no DOM or tool-specific knowledge
```

**Adding a new tool requires exactly 4 changes:**
1. Create `tools/<name>/<name>.js` (export `init<Name>()`) and `tools/<name>/<name>.css`
2. Add a `<li data-tool="<name>" aria-controls="panel-<name>" title="Display Name">` to the sidebar in `popup.html`
3. Add a `<section id="panel-<name>" class="tool-panel">` in the content area of `popup.html`
4. Add one entry to the `TOOLS` map in `popup.js` and import the init function

The settings panel reads registered tools **dynamically from the DOM** (via `[data-tool]` attributes + `title`), so no changes to `settings.js` are needed when adding tools.

## Key conventions

- **All ES module imports must use relative paths** (`./`, `../`) — bare specifiers don't resolve in `chrome-extension://` URLs.
- **Tool CSS selectors must be namespaced** with a short prefix (e.g. `.cp-` for color picker, `.st-` for settings) to avoid collisions.
- **Canvas elements** need `width`/`height` set as HTML attributes (backing buffer). CSS sizing is independent — setting only CSS width causes blurry rendering.
- **Clipboard writes** must happen synchronously after a user gesture — do not defer with `setTimeout`.
- **`[hidden]` attribute** is explicitly enforced with `[hidden] { display: none !important }` in `popup.css` — this is intentional as the CSS reset would otherwise break it.
- Use `chrome.storage.local` (via `shared/storage.js`) not `localStorage` — portable to future service workers/content scripts.

## Shared utilities

| File | Exports |
|------|---------|
| `shared/color-utils.js` | `hexToRgba`, `rgbToHsl`, `hslToRgb`, `rgbToHex`, `formatRgba` |
| `shared/clipboard.js` | `writeToClipboard(text)` — async, returns bool, has execCommand fallback |
| `shared/storage.js` | `saveToStorage(key, value)`, `loadFromStorage(key, default)` |
| `shared/canvas-chart.js` | `drawColorChart(canvas, h, s, l)`, `drawPlaceholderChart(canvas)` |

## Color picker internals

The color picker (`tools/color-picker/`) maintains HSL as its source of truth in module-level state (`state`, `hasColor`, `currentDisplayHex`). Key points:

- `currentDisplayHex` is set in `applyStateToDisplay()` and used by both auto-save and the manual Save button to ensure consistent hex values (avoids roundtrip rounding divergence between HSL↔RGB conversions).
- History deduplication: `addToHistory()` moves an existing entry to front rather than creating a duplicate.
- The SL chart is interactive — pointer events update `state.s` / `state.l`; the hue slider updates `state.h`. Both call `applyStateToDisplay()`.
- Clipboard is written on `pointerup` / slider `change` (not on every `input` event during drag).

## Settings panel

- Tool enabled/disabled state stored under key `devToolkitEnabledTools` in `chrome.storage.local` as `{ 'tool-id': boolean }`. Absent key = enabled.
- `popup.js` reads this on load and sets `tab.hidden` / `panel.hidden` accordingly.
- `settings.js` imports `ENABLED_TOOLS_KEY` from itself and is also imported by `popup.js`.

## Permissions

Current: `clipboardWrite`, `storage`. No host permissions, no content scripts, no background service worker.
