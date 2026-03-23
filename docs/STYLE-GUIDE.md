# Dev Toolkit — Style Guide

Derived from the existing codebase. All future tools and changes must follow these rules. Where the existing code diverges from this guide, the guide is the target — inconsistencies can be fixed opportunistically.

---

## Colours

### Background layers
| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0f0f1a` | Page / popup body |
| `bg-surface` | `#16162a` | Cards, panels, inputs, textareas |
| `bg-raised` | `#1e1e38` | Inputs that sit on a surface (e.g. inside a card) |
| `bg-active` | `#2a2a45` | Hover state for surfaces, active sidebar tab |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `border` | `#2a2a45` | All borders — inputs, cards, dividers, buttons |

> Always `1px solid #2a2a45`. Never use a different border colour as the default state.

### Text
| Token | Value | Usage |
|-------|-------|-------|
| `text-bright` | `#f1f5f9` | Highest emphasis — headings, active values |
| `text-primary` | `#e2e8f0` | Body text, tool names, input values |
| `text-secondary` | `#94a3b8` | Supporting values (e.g. RGBA/HSL rows) |
| `text-muted` | `#64748b` | Units, placeholder-adjacent text |
| `text-dim` | `#4b5563` | Section labels, micro labels |
| `text-ghost` | `#374151` | Empty states, placeholders |

### Accent (indigo)
| Token | Value | Usage |
|-------|-------|-------|
| `accent-strong` | `#4f46e5` | Primary button bg, toggle active bg |
| `accent-strong-hover` | `#4338ca` | Primary button hover |
| `accent` | `#818cf8` | Secondary button text, focus rings, active icon colour |
| `accent-soft` | `#a5b4fc` | Sidebar tab icon hover |

### Semantic
| Token | Value | Usage |
|-------|-------|-------|
| `green` | `#34d399` | Success, insertions, "Copied!" / "Saved!" feedback |
| `green-bg` | `rgba(52, 211, 153, 0.1–0.3)` | Diff insertion highlight backgrounds |
| `red` | `#f87171` | Errors, deletions |
| `red-bg` | `rgba(248, 113, 113, 0.1–0.3)` | Diff deletion highlight backgrounds, error bg |
| `red-border` | `#7f1d1d` | Error state borders |
| `amber` | `#f59e0b` | Destructive/warning actions (reload button) |
| `amber-border` | `#78350f` | Destructive button border |

---

## Typography

### Font stacks
- **UI / body:** `'Segoe UI', system-ui, -apple-system, sans-serif`
- **Monospace (values, code):** `'Courier New', 'Consolas', monospace`

### Scale
| Role | Size | Weight | Other |
|------|------|--------|-------|
| Micro label | 9px | 700 | uppercase, letter-spacing 0.8px, `text-dim` |
| Section title | 10px | 700 | uppercase, letter-spacing 0.6–0.8px, `text-dim` |
| Small / meta | 11px | 400–600 | |
| Button | 12px | 600 | |
| Body / input | 13px | 400–500 | |
| Value display | 14–16px | 600–700 | monospace for colour values |

> Micro labels and section titles always use `text-transform: uppercase` and `letter-spacing: 0.8px`.

---

## Spacing

Base unit: **4px**. All gaps and padding are multiples.

### Common gap values
`4px · 6px · 8px · 10px · 12px · 14px · 16px · 24px`

### Panel padding
All tool panels: `padding: 16px` (set by `.tool-panel` in `popup.css`).

### Container gaps
- Within a tool container: `gap: 14px`
- Between major sections: `gap: 24px`
- Between rows in a list: `gap: 2–4px`
- Between inline elements: `gap: 5–8px`

---

## Border radius

| Element | Radius |
|---------|--------|
| Inline badges, `<mark>` highlights | 2px |
| Copy buttons, small icon buttons | 4–5px |
| Inputs, textareas, cards, rows | 6–8px |
| Buttons | 7px |
| Sidebar tabs | 10px |
| Color swatch (square) | 10px |
| History swatches, toggle thumb | 50% |

---

## Surfaces / Cards

Standard card / row pattern:
```css
background: #16162a;
border: 1px solid #2a2a45;
border-radius: 6–8px;
padding: 7–10px 10–12px;
```

Inputs that sit *inside* a surface use `bg-raised` (`#1e1e38`) to create a subtle depth layer.

---

## Inputs & Textareas

```css
background: #16162a;   /* or #1e1e38 when inside a card */
border: 1px solid #2a2a45;
border-radius: 6px;
color: #e2e8f0;
font-size: 13px;
padding: 6px 8px;
outline: none;
color-scheme: dark;    /* for native date/time pickers */
transition: border-color 0.15s;
```

**Focus state:** `border-color: #818cf8` — no outline.

**Placeholder:** `color: #374151`

**Inline value inputs** (e.g. colour value fields): transparent background, no border, `border-bottom` focus indicator using `#818cf8`.

---

## Buttons

### Primary (CTA)
```css
background: #4f46e5;
color: #fff;
border: none;
border-radius: 7px;
padding: 7px 16px;
font-size: 12px;
font-weight: 600;
transition: background 0.15s, transform 0.1s;
```
Hover: `background: #4338ca`
Active: `transform: scale(0.97)`
Disabled: `opacity: 0.6; cursor: default; transform: none`

### Secondary (outlined accent)
```css
background: transparent;
border: 1px solid #2a2a45;
color: #818cf8;
border-radius: 7px;
padding: 7px 12px;
font-size: 12px;
font-weight: 600;
transition: border-color 0.15s, color 0.15s, background 0.15s;
```
Hover: `border-color: #818cf8; background: #2a2a45`

### Tertiary (neutral / cancel)
```css
background: transparent;
border: 1px solid #2a2a45;
color: #6b7280;
border-radius: 7px;
padding: 7px 12px;
font-size: 12px;
font-weight: 600;
transition: border-color 0.15s, color 0.15s;
```
Hover: `border-color: #ef4444; color: #ef4444`

### Destructive / warning
```css
background: transparent;
border: 1px solid #78350f;
color: #f59e0b;
border-radius: 7px;
padding: 6px 14px;
font-size: 12px;
font-weight: 600;
transition: background 0.15s, color 0.15s;
```
Hover: `background: #78350f; color: #fde68a`

### Ghost / icon
```css
background: transparent;
border: none;
color: #374151;
border-radius: 4px;
padding: 0;
transition: color 0.12s, background 0.12s;
```
Hover: `color: #818cf8; background: #2a2a45`

---

## Transitions

| Property | Duration |
|----------|----------|
| `color`, `background`, `border-color` | `0.15s` |
| `transform` (button press) | `0.1s` |
| `opacity` (badges, tooltips) | `0.2–0.25s ease` |
| Toggle track/thumb | `0.2s` |

Always use simple linear timing unless animating opacity (use `ease`).

---

## Feedback / Status Patterns

### "Copied!" / "Saved!" inline badge
```css
font-size: 9–11px;
font-weight: 600;
color: #34d399;
opacity: 0;
transition: opacity 0.2s ease;
white-space: nowrap;
```
Add modifier class (e.g. `--visible`) to set `opacity: 1`. Remove after 1400–1800ms.

### Error message
```css
font-size: 11px;
color: #f87171;
background: #1f1f35;
border: 1px solid #7f1d1d;
border-radius: 6px;
padding: 6px 10px;
```

### Empty / placeholder text
```css
font-size: 11px;
color: #374151;
font-style: italic;
```

---

## Focus & Accessibility

- **Interactive elements** must have `:focus-visible` styles using `outline: 2px solid #818cf8; outline-offset: 2px`
- **Sidebar tabs** use `outline-offset: -2px` (inset, because the tab has its own background)
- Never suppress focus outlines without providing an alternative
- All icon-only buttons must have an `aria-label` or `title`
- Status regions (copy confirmations, live results) use `aria-live="polite"`

---

## CSS Conventions

- **Namespace all selectors** with a two-letter tool prefix followed by `-` (e.g. `.cp-` for color picker, `.td-` for time diff, `.dc-` for diff checker, `.st-` for settings). New tools must pick a unique prefix.
- **File header comment** on every CSS file:
  ```css
  /* ==========================================================================
     <filename>.css — All selectors prefixed .<prefix>- to avoid collisions
     ========================================================================== */
  ```
- **Section comments** using `/* ---- Section name ---- */`
- No ID selectors in tool CSS — IDs are used in JS only
- No `!important` except for the `[hidden]` override in `popup.css`

---

## Dividers

```css
height: 1px;
background: #2a2a45;
margin: 0 -2px;   /* bleeds slightly beyond container padding */
```

---

## Scrollbars (content area)

```css
scrollbar-width: thin;
scrollbar-color: #2a2a45 transparent;
```
```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 2px; }
```
Apply to any scrollable tool output area.
