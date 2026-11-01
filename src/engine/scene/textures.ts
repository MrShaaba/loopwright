import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { clamp, smoothstep } from '../util/math';
import { fbm2 } from '../util/noise';

interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Paints a square DynamicTexture pixel by pixel. Colour channels are 0 to 1. */
function paint(
  scene: Scene,
  name: string,
  size: number,
  mipmaps: boolean,
  fill: (x: number, y: number, px: Pixel) => void,
): DynamicTexture {
  const texture = new DynamicTexture(
    name,
    { width: size, height: size },
    scene,
    mipmaps,
    mipmaps ? Texture.TRILINEAR_SAMPLINGMODE : Texture.BILINEAR_SAMPLINGMODE,
  );
  const ctx = texture.getContext();
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const px: Pixel = { r: 0, g: 0, b: 0, a: 1 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      px.r = 0;
      px.g = 0;
      px.b = 0;
      px.a = 1;
      fill(x, y, px);
      const i = (y * size + x) * 4;
      data[i] = clamp(px.r, 0, 1) * 255;
      data[i + 1] = clamp(px.g, 0, 1) * 255;
      data[i + 2] = clamp(px.b, 0, 1) * 255;
      data[i + 3] = clamp(px.a, 0, 1) * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.update(false);
  return texture;
}

/** Tileable grey noise for ground albedo. Dark scenes need the subtle variation to read as a surface. */
export function createGrainTexture(
  scene: Scene,
  name: string,
  size: number,
  seed: number,
): DynamicTexture {
  const period = 8;
  const texture = paint(scene, name, size, true, (x, y, px) => {
    const u = (x / size) * period;
    const v = (y / size) * period;
    const broad = fbm2(u, v, seed, 3, 2, 0.5, period);
    const fine = fbm2(u * 4, v * 4, seed + 3, 3, 2, 0.5, period * 4);
    const grey = 0.72 + 0.28 * (broad * 0.6 + fine * 0.4);
    px.r = grey * 0.98;
    px.g = grey;
    px.b = grey * 1.04;
  });
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

/** Tangent-space normal map derived from the same tileable noise, for moonlit micro-relief. */
export function createNormalTexture(
  scene: Scene,
  name: string,
  size: number,
  seed: number,
  strength: number,
): DynamicTexture {
  const period = 8;
  const height = (x: number, y: number): number => {
    const u = (x / size) * period;
    const v = (y / size) * period;
    return fbm2(u * 6, v * 6, seed + 11, 3, 2, 0.5, period * 6);
  };
  const texture = paint(scene, name, size, true, (x, y, px) => {
    const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
    const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    px.r = (-dx / len) * 0.5 + 0.5;
    px.g = (-dy / len) * 0.5 + 0.5;
    px.b = (1 / len) * 0.5 + 0.5;
  });
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

/** Soft white disc with a feathered edge, used as the mist particle sprite. */
export function createSoftDiscTexture(scene: Scene, name: string, size: number): DynamicTexture {
  const half = size / 2;
  const texture = paint(scene, name, size, false, (x, y, px) => {
    const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half;
    const a = Math.pow(smoothstep(1, 0.1, d), 1.6);
    px.r = 1;
    px.g = 1;
    px.b = 1;
    px.a = a;
  });
  texture.hasAlpha = true;
  return texture;
}

/** Radial glow in a given colour, additive-friendly (black outside, bright core). */
export function createGlowTexture(
  scene: Scene,
  name: string,
  size: number,
  color: Color3,
): DynamicTexture {
  const half = size / 2;
  const texture = paint(scene, name, size, false, (x, y, px) => {
    const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half;
    const f = Math.pow(1 - clamp(d, 0, 1), 2.4);
    px.r = color.r * f;
    px.g = color.g * f;
    px.b = color.b * f;
    px.a = f;
  });
  texture.hasAlpha = true;
  return texture;
}

/** A pale moon face with darker seas and limb darkening. */
export function createMoonTexture(
  scene: Scene,
  name: string,
  size: number,
  seed: number,
  tint: Color3,
): DynamicTexture {
  const half = size / 2;
  return paint(scene, name, size, true, (x, y, px) => {
    const u = x / size;
    const v = y / size;
    const seas = fbm2(u * 4 + 3, v * 4 + 3, seed, 4);
    const craters = fbm2(u * 14, v * 14, seed + 5, 3);
    const dark = smoothstep(0.42, 0.72, seas) * 0.42 + smoothstep(0.55, 0.85, craters) * 0.14;
    const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half;
    const limb = 1 - 0.38 * smoothstep(0.55, 1.02, d);
    const shade = (1 - dark) * limb;
    px.r = tint.r * shade;
    px.g = tint.g * shade;
    px.b = tint.b * shade;
  });
}

/** A glowing ball skin: a bright dotted lattice on a dimmer base so the roll reads. */
export function createBallTexture(
  scene: Scene,
  name: string,
  size: number,
  color: Color3,
): DynamicTexture {
  const cells = 8;
  const texture = paint(scene, name, size, true, (x, y, px) => {
    const u = (x / size) * cells;
    const v = (y / size) * cells;
    const cu = u - Math.floor(u) - 0.5;
    const cv = v - Math.floor(v) - 0.5;
    const d = Math.hypot(cu, cv);
    const dot = smoothstep(0.34, 0.2, d);
    const band = smoothstep(0.06, 0.02, Math.abs(cv)) * 0.35;
    const f = 0.28 + 1.1 * Math.max(dot, band);
    px.r = color.r * f;
    px.g = color.g * f;
    px.b = color.b * f;
  });
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}
