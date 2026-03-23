/**
 * Draws a Saturation/Lightness plane for the given hue onto a canvas element.
 *
 * Layout:
 *   X-axis → Saturation 0% (left) to 100% (right)
 *   Y-axis ↓ Lightness 100% (top) to 0% (bottom)
 *   White is top-left, black is bottom, pure hue is top-right at L=50%.
 *
 * The picked color's position is marked with a circle.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} pickedH - Hue 0–360
 * @param {number} pickedS - Saturation 0–100
 * @param {number} pickedL - Lightness 0–100
 */
export function drawColorChart(canvas, pickedH, pickedS, pickedL) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Draw the SL plane row by row for the picked hue
  for (let y = 0; y < H; y++) {
    const l = 100 - (y / H) * 100; // 100 at top, 0 at bottom
    const gradient = ctx.createLinearGradient(0, y, W, y);
    gradient.addColorStop(0, `hsl(${pickedH}, 0%, ${l}%)`);
    gradient.addColorStop(1, `hsl(${pickedH}, 100%, ${l}%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, W, 1);
  }

  // Marker position
  const markerX = (pickedS / 100) * W;
  const markerY = ((100 - pickedL) / 100) * H;

  // Outer ring (white or black depending on lightness for contrast)
  const ringColor = pickedL > 50 ? '#000000' : '#ffffff';
  ctx.beginPath();
  ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner fill shows the exact color
  ctx.beginPath();
  ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${pickedH}, ${pickedS}%, ${pickedL}%)`;
  ctx.fill();
}

/**
 * Draws a placeholder state on the canvas (neutral grey gradient).
 * Called on init before any color has been picked.
 *
 * @param {HTMLCanvasElement} canvas
 */
export function drawPlaceholderChart(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  for (let y = 0; y < H; y++) {
    const l = 100 - (y / H) * 100;
    const gradient = ctx.createLinearGradient(0, y, W, y);
    gradient.addColorStop(0, `hsl(0, 0%, ${l}%)`);
    gradient.addColorStop(1, `hsl(0, 0%, ${l}%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, W, 1);
  }
}
