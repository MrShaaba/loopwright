import { lerp, smoothstep } from '../util/math';
import { fbm2 } from '../util/noise';

export interface HeightFieldParams {
  size: number;
  seed: number;
  hillHeight: number;
  hillScale: number;
  plateauRadius: number;
  plateauHeight: number;
  rimHeight: number;
}

/** Pure height function shared by the terrain mesh, supports, props and cameras. */
export interface HeightField {
  readonly params: HeightFieldParams;
  heightAt(x: number, z: number): number;
  /** Magnitude of the surface gradient, 0 on flat ground. */
  slopeAt(x: number, z: number): number;
}

export function createHeightField(params: HeightFieldParams): HeightField {
  const { size, seed, hillHeight, hillScale, plateauRadius, plateauHeight, rimHeight } = params;
  const half = size / 2;

  const rawHeight = (x: number, z: number): number => {
    const fine = fbm2(x / hillScale + 100, z / hillScale + 100, seed, 4);
    const broad = fbm2(x / (hillScale * 3) + 37, z / (hillScale * 3) + 37, seed + 7, 2);
    let h = (fine - 0.5) * 2 * hillHeight + (broad - 0.5) * hillHeight;
    const r = Math.hypot(x, z);
    h += rimHeight * smoothstep(half * 0.55, half, r);
    return h;
  };

  const heightAt = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const blend = smoothstep(plateauRadius, plateauRadius * 1.7, r);
    if (blend <= 0) return plateauHeight;
    return lerp(plateauHeight, rawHeight(x, z), blend);
  };

  const slopeAt = (x: number, z: number): number => {
    const e = 0.5;
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  };

  return { params, heightAt, slopeAt };
}
