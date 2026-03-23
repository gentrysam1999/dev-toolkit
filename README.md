# Dev Toolkit — Chrome Extension

A personal Chrome extension for web developers. Built to be expanded — new tools can be added without touching the existing ones.

**Current tools:**
- Color Picker

---

## Installation

No build step required.

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the root folder of this repo

The extension icon will appear in your toolbar. Pin it for easy access.

> Requires Chrome 95+ (for the EyeDropper API).

---

## Tools

### Color Picker

Pick the exact color of any pixel on any webpage.

1. Click the extension icon to open the popup
2. Click **Pick Color** — your cursor becomes a crosshair eyedropper
3. Click any pixel on the page
4. The hex value is automatically copied to your clipboard

The popup also shows:
- A large color swatch preview
- Hex value (e.g. `#FF5733`)
- RGBA value (e.g. `rgba(255, 87, 51, 1)`)
- HSL value (e.g. `hsl(14, 100%, 60%)`)
- A Saturation/Lightness chart with a marker showing where the color sits
- Your last 5 picked colors as clickable swatches — click any to re-copy it

---

## Updating after code changes

After editing any file, go to `chrome://extensions` and click the **↺** (refresh) button on the Dev Toolkit card.

---

## Project structure

```
manifest.json              Chrome extension config (MV3)
popup/                     Popup shell: sidebar nav + panel layout
tools/color-picker/        Color picker tool (self-contained JS + CSS)
shared/                    Shared utilities (color math, clipboard, storage, chart)
icons/                     Extension icons
```

Adding a new tool only requires creating a folder under `tools/`, adding a sidebar tab and panel slot in `popup.html`, and registering an init function in `popup.js`. See `CLAUDE.md` for details.
