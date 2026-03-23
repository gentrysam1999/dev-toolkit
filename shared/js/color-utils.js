/**
 * Parses a 6-digit hex string (with or without #) to RGBA.
 * EyeDropper always returns lowercase 6-digit hex.
 * Returns { r, g, b, a } where a is always 255 (EyeDropper has no alpha).
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function hexToRgba(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
    a: 255,
  };
}

/**
 * Converts RGB (0–255 each) to HSL.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, l: number }} h: 0–360, s: 0–100, l: 0–100
 */
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      case b: h = ((r - g) / delta + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL (h: 0–360, s: 0–100, l: 0–100) to RGB (0–255 each).
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

/**
 * Converts RGB (0–255 each) to a 6-digit lowercase hex string (with #).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats an RGBA object as a CSS-ready string.
 * @param {{ r: number, g: number, b: number, a: number }} rgba
 * @returns {string}
 */
export function formatRgba({ r, g, b, a }) {
  const alpha = a === 255 ? 1 : parseFloat((a / 255).toFixed(2));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
