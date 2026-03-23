# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Extension (Manifest V3) developer toolkit. The first tool is a color picker using the native EyeDropper API. The project is intentionally dependency-free — no npm, no bundler, no framework. ES modules are loaded natively by Chrome.

## Loading / testing the extension

There is no build step. Load the unpacked extension directly:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder
4. After any code change, click the **↺ refresh** button on the extension card

## Architecture

The popup is a shell with a left sidebar for navigation. Each tool lives in its own folder under `tools/` and is self-contained.

```
popup/popup.js       ← tab switching + tool registry (ES module entry point)
popup/popup.html     ← sidebar <li> tabs + <section> panel slots
tools/<name>/        ← each tool has its own .js and .css
shared/              ← pure utilities with no DOM or tool-specific knowledge
```

**Adding a new tool requires exactly 4 changes:**
1. Create `tools/<name>/<name>.js` exporting `init<Name>()` and `tools/<name>/<name>.css`
2. Add a `<li data-tool="<name>" aria-controls="panel-<name>">` to the sidebar in `popup.html`
3. Add a `<section id="panel-<name>" class="tool-panel">` in the content area of `popup.html`
4. Add `'<name>': init<Name>` to the `TOOLS` map in `popup.js` and import the function

## Key conventions

- **All ES module imports must use relative paths** (`./`, `../`) — bare specifiers don't resolve in `chrome-extension://` URLs.
- **Tool CSS selectors must be prefixed** with a short tool-specific namespace (e.g. `.cp-` for color picker) to avoid collisions.
- **Canvas elements** need `width`/`height` set as HTML attributes (the backing buffer), not just CSS — CSS sizing is independent and using only CSS causes blurry rendering.
- **Clipboard writes** must happen synchronously after a user gesture or EyeDropper resolve — do not defer with `setTimeout`.
- Use `chrome.storage.local` (via `shared/storage.js`) instead of `localStorage` so data is accessible from any future extension context (service worker, content scripts).

## Shared utilities

| File | Exports |
|------|---------|
| `shared/color-utils.js` | `hexToRgba(hex)`, `rgbToHsl(r,g,b)`, `formatRgba({r,g,b,a})` |
| `shared/clipboard.js` | `writeToClipboard(text)` — async, returns bool |
| `shared/storage.js` | `saveToStorage(key, value)`, `loadFromStorage(key, default)` |
| `shared/canvas-chart.js` | `drawColorChart(canvas, h, s, l)`, `drawPlaceholderChart(canvas)` |

## Permissions

Current: `clipboardWrite`, `storage`. No host permissions, no content scripts, no background service worker. Keep permissions minimal — the EyeDropper API runs in the popup context without needing `activeTab` or `scripting`.
