export function drawPixelRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

/** Two-pixel chalk lines, including rectangles drawn inward from the right goal line. */
export function drawPixelOutline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const left = Math.round(Math.min(x, x + width));
  const right = Math.round(Math.max(x, x + width));
  const top = Math.round(Math.min(y, y + height));
  const bottom = Math.round(Math.max(y, y + height));
  drawPixelRect(context, left - 1, top - 1, right - left + 2, 2, color);
  drawPixelRect(context, left - 1, bottom - 1, right - left + 2, 2, color);
  drawPixelRect(context, left - 1, top, 2, bottom - top, color);
  drawPixelRect(context, right - 1, top, 2, bottom - top, color);
}

/** Rasterize a narrow annulus once in the stadium cache; Canvas strokes antialias even
 * with imageSmoothingEnabled=false. Geometry retains its metre-derived radius. */
export function drawPixelArc(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  start: number,
  end: number,
  color: string,
): void {
  const turn = Math.PI * 2;
  const span = end - start;
  context.fillStyle = color;
  for (let y = Math.floor(centerY - radius - 1); y <= Math.ceil(centerY + radius + 1); y++) {
    for (let x = Math.floor(centerX - radius - 1); x <= Math.ceil(centerX + radius + 1); x++) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      if (Math.abs(Math.hypot(dx, dy) - radius) > 0.85) continue;
      const angle = (((Math.atan2(dy, dx) - start) % turn) + turn) % turn;
      if (span >= turn || angle <= span) context.fillRect(x, y, 1, 1);
    }
  }
}
