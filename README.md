# Dev Toolkit — Chrome Extension

A personal Chrome extension for web developers. Built to be expanded — new tools can be added without touching the existing ones.

**Current tools:**
- Color Picker
- Diff Checker
- Time Diff
- System & Network

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
- Hex, RGBA, and HSL values — all editable by clicking and typing
- A Saturation/Lightness chart — drag to adjust the picked color
- A hue slider to shift the hue after picking
- A **Save** button to add the current color to your recents
- Up to 10 recent colors as clickable swatches — click to restore, hover to remove

### Diff Checker

Compare two blocks of plain text side by side with character-level highlighting.

1. Paste the original text into the left input and the modified text into the right
2. The diff updates live as you type
3. Deleted characters are highlighted red on the left; inserted characters green on the right
4. Click **Open in Tab** to open a full-width view in a new browser tab

In the full-tab view you can also edit either text directly and copy either side to clipboard.

### Time Diff

Calculate the difference between two datetimes.

1. Enter a **Start** and **End** date — time is optional and defaults to 00:00
2. Click **Now** next to either field to fill it with the current date and time
3. The difference is shown instantly across five rows:
   - **Seconds** — total seconds
   - **Minutes** — total minutes + remaining seconds (e.g. `90min 30s`)
   - **Hours** — total hours + remaining minutes (e.g. `2hr 45min`)
   - **Days** — total days + remaining hours (e.g. `6d 12hr`)
   - **Years** — decimal years (e.g. `1.5023yr`)
4. A direction label tells you whether end is after, before, or equal to start — negative differences are shown with a `−` prefix
5. Use **Swap** to reverse start and end, or **Clear** to reset both fields

### System & Network

View live network and system information. Data refreshes automatically every 5 seconds while the panel is open. Click **Refresh** to manually re-fetch everything including public IPs.

**Public IP** — your external IPv4 and IPv6 addresses, fetched from [ipify.org](https://www.ipify.org). Click the copy button next to either address to copy it to your clipboard.

**Local Interfaces** — active local IP addresses discovered via WebRTC. Globally-routable IPv6 addresses (which are the same as your public IP) are automatically filtered out so they only appear once.

**Connection** — live connection metadata from the browser:
- Online status
- Effective connection type (4G, 3G, etc.)
- Estimated downlink speed — Chrome's own estimate based on recent traffic, rounded to the nearest 25 kbps
- Round-trip time (RTT)
- Save Data mode on/off

**Display** — screen and window dimensions:
- Screen resolution (logical pixels)
- Physical resolution (shown when DPI scaling is active)
- DPI scale factor
- Browser window dimensions (outer width × height)

---

## Settings

Click the gear icon at the bottom of the sidebar to open Settings.

- **Tools** — toggle any tool on or off. Disabled tools are hidden from the sidebar.
- **Developer → Reload Extension** — reloads the extension without navigating to `chrome://extensions`. Useful after pulling updates.

---

## Updating after code changes

After editing any file, either:
- Go to `chrome://extensions` and click the **↺** (refresh) button on the Dev Toolkit card, or
- Open the extension popup, go to **Settings**, and click **Reload Extension**

---

## Project structure

```
manifest.json              Chrome extension config (MV3)
popup/                     Popup shell: sidebar nav + panel layout
tools/color-picker/        Color picker tool
tools/diff-checker/        Diff checker tool (includes full-tab view)
tools/time-diff/           Time diff tool
tools/network-info/        System & Network tool
settings/                  Settings panel
shared/                    Shared utilities (color math, clipboard, storage, canvas chart)
icons/                     Extension icons
docs/                      Planning and roadmap documents
```

Adding a new tool only requires creating a folder under `tools/`, adding a sidebar tab and panel slot in `popup.html`, and registering an init function in `popup.js`. See `CLAUDE.md` for details.

---

## Planned features

- **Speed test** — measure real download throughput by fetching a known-size payload and timing it, rather than relying on the browser's `navigator.connection.downlink` estimate (which is rounded and can be stale).
