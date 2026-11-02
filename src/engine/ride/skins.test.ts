import { describe, expect, it } from 'vitest';
import { BALL_SKINS, getSkin, skinFactor, skinPixel, type SkinPattern } from './skins';
import { getTrail, TRAILS } from './trails';

describe('ball skins', () => {
  it('has unique ids, rising costs and a free default', () => {
    const ids = new Set(BALL_SKINS.map((skin) => skin.id));
    expect(ids.size).toBe(BALL_SKINS.length);
    expect(BALL_SKINS[0]?.cost).toBe(0);
    for (let i = 1; i < BALL_SKINS.length; i++) {
      expect(BALL_SKINS[i]!.cost).toBeGreaterThan(BALL_SKINS[i - 1]!.cost);
    }
    expect(getSkin('nope').id).toBe('lattice');
    expect(getSkin('nova').name).toBe('Nova');
  });

  it('paints every pattern within a sane brightness range with real contrast', () => {
    for (const skin of BALL_SKINS) {
      let min = Infinity;
      let max = -Infinity;
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 96; x++) {
          const f = skinFactor(skin.pattern, (x + 0.5) / 96, (y + 0.5) / 48);
          expect(Number.isFinite(f)).toBe(true);
          min = Math.min(min, f);
          max = Math.max(max, f);
        }
      }
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(1.6);
      expect(max - min).toBeGreaterThan(0.5);
    }
  });

  it('tiles seamlessly around the ball', () => {
    const patterns: SkinPattern[] = ['lattice', 'meridian', 'nova', 'honeycomb'];
    for (const pattern of patterns) {
      for (const v of [0.2, 0.5, 0.8]) {
        expect(skinFactor(pattern, 0.0001, v)).toBeCloseTo(skinFactor(pattern, 0.9999, v), 1);
      }
    }
  });

  it('tints pixels with the base colour and shifts hue only on the prism', () => {
    const px = { r: 0, g: 0, b: 0 };
    skinPixel('meridian', 0.02, 0.5, [1, 0.5, 0.25], px);
    expect(px.r / px.g).toBeCloseTo(2, 5);
    expect(px.g / px.b).toBeCloseTo(2, 5);
    skinPixel('prism', 0.3, 0.3, [1, 0.5, 0.25], px);
    expect(px.r + px.g + px.b).toBeGreaterThan(0);
    expect(px.r / px.g).not.toBeCloseTo(2, 2);
  });
});

describe('trails', () => {
  it('has a free empty trail and particle recipes that make sense', () => {
    expect(TRAILS[0]?.particles).toBeNull();
    expect(TRAILS[0]?.cost).toBe(0);
    expect(getTrail('nope').id).toBe('none');
    for (const trail of TRAILS.slice(1)) {
      const p = trail.particles;
      expect(p).not.toBeNull();
      if (!p) continue;
      expect(p.rate).toBeGreaterThan(0);
      expect(p.life[0]).toBeGreaterThan(0);
      expect(p.life[1]).toBeGreaterThanOrEqual(p.life[0]);
      expect(p.size[1]).toBeGreaterThanOrEqual(p.size[0]);
      expect(p.alpha).toBeGreaterThan(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
    }
  });
});
