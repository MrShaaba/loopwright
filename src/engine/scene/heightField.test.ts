import { describe, expect, it } from 'vitest';
import { createHeightField, type HeightFieldParams } from './heightField';

const params: HeightFieldParams = {
  size: 320,
  seed: 1031,
  hillHeight: 7,
  hillScale: 46,
  plateauRadius: 42,
  plateauHeight: 0,
  rimHeight: 14,
};

describe('createHeightField', () => {
  it('is deterministic for a given seed', () => {
    const a = createHeightField(params);
    const b = createHeightField(params);
    for (let i = 0; i < 50; i++) {
      const x = -150 + i * 6.1;
      const z = 140 - i * 5.3;
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
    }
  });

  it('differs between seeds', () => {
    const a = createHeightField(params);
    const b = createHeightField({ ...params, seed: 2 });
    expect(a.heightAt(90, 70)).not.toBe(b.heightAt(90, 70));
  });

  it('is perfectly flat inside the station plateau', () => {
    const field = createHeightField(params);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      for (const r of [0, 10, 25, 41]) {
        expect(field.heightAt(Math.cos(angle) * r, Math.sin(angle) * r)).toBe(0);
        expect(field.slopeAt(Math.cos(angle) * r, Math.sin(angle) * r)).toBeCloseTo(0, 6);
      }
    }
  });

  it('stays within a sane range and rises towards the rim', () => {
    const field = createHeightField(params);
    let min = Infinity;
    let max = -Infinity;
    for (let x = -160; x <= 160; x += 8) {
      for (let z = -160; z <= 160; z += 8) {
        const h = field.heightAt(x, z);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    expect(min).toBeGreaterThan(-params.hillHeight * 2);
    expect(max).toBeLessThan(params.hillHeight * 2 + params.rimHeight);
    const edgeAverage =
      (field.heightAt(158, 0) +
        field.heightAt(-158, 0) +
        field.heightAt(0, 158) +
        field.heightAt(0, -158)) /
      4;
    const midAverage =
      (field.heightAt(80, 0) +
        field.heightAt(-80, 0) +
        field.heightAt(0, 80) +
        field.heightAt(0, -80)) /
      4;
    expect(edgeAverage).toBeGreaterThan(midAverage);
  });

  it('is continuous', () => {
    const field = createHeightField(params);
    for (let x = -150; x < 150; x += 0.25) {
      const step = Math.abs(field.heightAt(x + 0.25, 33) - field.heightAt(x, 33));
      expect(step).toBeLessThan(0.6);
    }
  });
});
