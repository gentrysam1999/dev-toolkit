/**
 * Writes text to the system clipboard.
 * Works in the popup context with the clipboardWrite permission declared.
 * Call immediately after EyeDropper resolves — do NOT defer with setTimeout.
 *
 * @param {string} text
 * @returns {Promise<boolean>} true on success
 */
export async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err);
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (fallbackErr) {
      console.error('Clipboard fallback also failed:', fallbackErr);
      return false;
    }
  }
}
