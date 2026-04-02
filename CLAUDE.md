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
- Use `chrome.storage.local` (via `shared/js/storage.js`) not `localStorage` — portable to future service workers/content scripts.

## Shared utilities

### JS (`shared/js/`)
| File | Exports |
|------|---------|
| `color-utils.js` | `hexToRgba`, `rgbToHsl`, `hslToRgb`, `rgbToHex`, `formatRgba` |
| `clipboard.js` | `writeToClipboard(text)` — async, returns bool, has execCommand fallback |
| `storage.js` | `saveToStorage(key, value)`, `loadFromStorage(key, default)` |
| `canvas-chart.js` | `drawColorChart(canvas, h, s, l)`, `drawPlaceholderChart(canvas)` |

### CSS (`shared/css/`)
| File | Purpose |
|------|---------|
| `tokens.css` | All CSS custom properties (design tokens). Link first, before any component styles. |

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

## System & Network tool

- Local IPs are discovered via `RTCPeerConnection` host ICE candidates (no special permissions needed). `chrome.system.network` is **ChromeOS-only** — do not use it on cross-platform builds.
- Public IPs are fetched from `api.ipify.org` (IPv4) and `api6.ipify.org` (IPv6). These require the `host_permissions` entries in `manifest.json`.
- Auto-refresh runs every 5 s via `setInterval` while the panel is active. A `MutationObserver` on the panel's `class` attribute starts/stops the timer. Manual Refresh additionally re-fetches public IPs.
- Both refresh paths share `refreshLive(panel)` — add anything that should run on every refresh there, not separately in each path.
- Globally-routable IPv6 addresses appear in both WebRTC candidates and the public IP fetch. Post-fetch deduplication removes them from Local Interfaces so they only show once.

## Permissions

Current: `clipboardWrite`, `storage`, `tabs`. Host permissions: `https://api.ipify.org/`, `https://api6.ipify.org/`. No content scripts, no background service worker.

## Documentation maintenance

Keep these two files up to date whenever tools are added, changed, or new feature ideas arise — do not put feature notes or TODOs in source code comments:

- **`README.md`** — update the current tools list and the **Planned features** section at the bottom.
- **`docs/ROADMAP.md`** — mark completed tools in the Existing Tools table and add new feature ideas under the appropriate section. This is the primary place for tracking what's been built and what's planned.

Source code comments are fine for explaining implementation detail. Feature ideas and planned work belong in the docs above, not as TODOs in source files.
