import { skinPixel, type Rgb, type SkinPattern } from '../engine/ride/skins';

const TAU = Math.PI * 2;

/**
 * Paints a lit sphere wearing a skin into a 2D canvas, using the same pure painter as the
 * ball's texture, so the locker card shows exactly what the ball will wear.
 */
export function paintSkinPreview(
  canvas: HTMLCanvasElement,
  pattern: SkinPattern,
  base: Rgb,
  spin = 0,
): void {
  const size = canvas.width;
  const context = canvas.getContext('2d');
  if (!context || size === 0) return;
  const image = context.createImageData(size, size);
  const data = image.data;
  const px = { r: 0, g: 0, b: 0 };
  // Key light from the upper left, a touch of rim light from the right.
  const lx = -0.45;
  const ly = 0.6;
  const lz = 0.66;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = 1 - ((y + 0.5) / size) * 2;
      const r2 = nx * nx + ny * ny;
      const i = (y * size + x) * 4;
      if (r2 > 1) {
        data[i + 3] = 0;
        continue;
      }
      const nz = Math.sqrt(1 - r2);
      const u = (Math.atan2(nx, nz) / TAU + 0.5 + spin) % 1;
      const v = Math.acos(Math.max(-1, Math.min(1, ny))) / Math.PI;
      skinPixel(pattern, u, v, base, px);
      const lambert = Math.max(0, nx * lx + ny * ly + nz * lz);
      const rim = Math.pow(1 - nz, 3) * 0.35;
      const shade = 0.3 + 0.7 * lambert + rim;
      // Emissive skins read brighter than a plain lit surface; lift the curve like tone mapping.
      const tone = (value: number): number => Math.pow(Math.min(1, value * shade), 0.7) * 255;
      data[i] = tone(px.r);
      data[i + 1] = tone(px.g);
      data[i + 2] = tone(px.b);
      // Soft anti-aliased edge.
      data[i + 3] = Math.min(1, (1 - Math.sqrt(r2)) * size * 0.5) * 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/** CSS colour from linear channels, lifted for the dark panel. */
export function cssColor(rgb: Rgb): string {
  const channel = (value: number): number => Math.round(Math.pow(Math.min(1, value), 0.8) * 255);
  return `rgb(${channel(rgb[0])}, ${channel(rgb[1])}, ${channel(rgb[2])})`;
}
