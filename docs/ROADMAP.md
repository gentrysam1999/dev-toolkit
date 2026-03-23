# Dev Toolkit — Ideas & Future Scope

A living document for feature ideas and potential new tools. Nothing here is committed to — it exists to capture thinking and spark discussion.

---

## Existing Tools

| Tool | Status |
|------|--------|
| Color Picker | ✅ Done |

---

## Color & Design Tools

### Contrast Checker
Check foreground/background colour pairs against WCAG 2.1 AA and AAA thresholds. Could accept two colour inputs (manual entry or pick-from-screen) and display the contrast ratio with a pass/fail badge. Natural companion to the existing colour picker — could even be a second tab that auto-populates from the last picked colour.

### Gradient Builder
Build CSS `linear-gradient` / `radial-gradient` values visually. Add colour stops, drag to reposition, copy the final CSS. Could share the hue slider + SL chart UI already built in the colour picker.

### Palette Generator
Given a seed colour, generate harmonious palettes (complementary, analogous, triadic, etc.) and display them as copyable swatches. Useful for quickly bootstrapping a colour system.

### Color Blindness Preview
Simulate how a picked colour (or a set of colours) appears under common colour blindness types (protanopia, deuteranopia, tritanopia). Output the simulated hex values.

---

## CSS Utilities

### Box Shadow Builder
Visual sliders for X offset, Y offset, blur, spread, colour, and inset. Live preview swatch. Copy the final `box-shadow` value.

### Border Radius Builder
Visual corner controls (uniform or per-corner). Preview shape. Copy the `border-radius` value. Support both shorthand and longhand.

### CSS Easing Visualiser
Pick or customise a `cubic-bezier()` curve with a drag-point canvas. Preview the animation curve. Copy the value. Include a library of named easings (ease-in-out, bounce approximations, etc.).

---

## Text & Data Utilities

### Base64 Encoder / Decoder
Encode text or data URLs to Base64 and decode back. Useful for embedding small assets or decoding JWT payloads.

### JSON Formatter
Paste raw JSON, get it back indented and syntax-highlighted. Optional minify mode. Error highlighting for malformed input.

### Regex Tester
Pattern input + test string input. Highlight matches in real time. Display match groups. Could include a small reference cheat sheet.

### Hash Generator
Input text, get MD5 / SHA-1 / SHA-256 / SHA-512 output using the native Web Crypto API. No external dependencies needed.

### UUID Generator
One-click UUID v4 generation. Copy to clipboard. Option to generate a batch.

---

## Developer Reference

### HTTP Status Codes
Searchable list of HTTP status codes with short descriptions and categories (1xx–5xx). Quick lookup, no internet required.

### MIME Types
Searchable reference of common MIME types ↔ file extensions. Copy on click.

### Timestamp Converter
Convert between Unix timestamps, ISO 8601 strings, and human-readable dates. Detect input format automatically.

---

## Clipboard & Snippets

### Snippet Manager
Save short reusable text snippets (class names, CSS variables, boilerplate). Name them, tag them, copy with one click. Stored in `chrome.storage.local`. Could support import/export as JSON.

### Clipboard History
Keep a short in-session history of clipboard writes made through the toolkit (not the OS clipboard — just writes made by the extension). Surface recent copies without re-navigating to the source tool.

---

## Layout & Measurement

### Spacing Calculator
Enter a base unit and a scale (8pt grid, Tailwind scale, etc.) and get a reference table of common spacing values. Copy individual values.

### Line Height / Typography Calculator
Given a font size and desired line height ratio, output the pixel value and CSS shorthand. Include a reference scale for common heading/body ratios.

---

## Infrastructure / Architecture Ideas

### Tool Lazy Loading
Currently all tool `init` functions run on popup open. For a larger tool set, tools could be initialised only when their tab is first activated. The registry in `popup.js` already supports this — just wrap `initFn()` in a `once` guard tied to tab activation.

### Import / Export Settings
Allow users to export their saved history, snippets, and settings as a JSON file and re-import on another machine. Would use `chrome.storage.local` serialisation — no new permissions needed.

### Keyboard Shortcuts
Add keyboard shortcuts to switch between tool tabs (e.g. `1`–`9` keys while focus is in the panel area). Could be opt-in and configurable via Settings.

### Per-Tool Settings
Rather than a global on/off toggle, each tool could expose its own settings section (e.g. colour picker history limit, default colour format, etc.). Settings panel already renders dynamically from the DOM — this would extend that to per-tool config slots.

---

## Notes

- All tools should remain dependency-free (no npm, no bundler). Web Crypto, Canvas, and native browser APIs cover most of the above.
- New tools follow the 4-step registration pattern described in `CLAUDE.md`.
- The settings panel discovers tools dynamically from the DOM — no changes to `settings.js` needed when adding tools.
