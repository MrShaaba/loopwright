import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import { DEG } from '../../util/math';
import { makePose } from '../pose';
import { defaultParams, getSectionDef, listSectionDefs, normaliseParams } from './index';
import { easedRamp } from './types';

const ENTRY = makePose(new Vector3(0, 3.2, 0), 0, 0);

describe('section definitions', () => {
  it('cover the nine section types with defaults inside their ranges', () => {
    const types = listSectionDefs().map((def) => def.type);
    expect(types).toEqual([
      'straight',
      'hill',
      'turn',
      'loop',
      'corkscrew',
      'helix',
      'spiral',
      'wave',
      'jump',
    ]);
    for (const def of listSectionDefs()) {
      for (const spec of def.params) {
        if (spec.kind === 'number') {
          expect(spec.default).toBeGreaterThanOrEqual(spec.min);
          expect(spec.default).toBeLessThanOrEqual(spec.max);
        }
      }
    }
  });

  it('build from defaults, end level and keep keys close together', () => {
    for (const def of listSectionDefs()) {
      const geometry = def.build(ENTRY, defaultParams(def.type));
      expect(geometry.keys.length).toBeGreaterThan(2);
      expect(geometry.length).toBeGreaterThan(3);
      expect(Math.abs(geometry.exit.pitch)).toBeLessThan(1e-9);
      const first = geometry.keys[0];
      expect(first && Vector3.Distance(first.position, ENTRY.position)).toBeLessThan(1e-9);
      const last = geometry.keys[geometry.keys.length - 1];
      expect(last && Vector3.Distance(last.position, geometry.exit.position)).toBeLessThan(1e-9);
      for (let i = 1; i < geometry.keys.length; i++) {
        const a = geometry.keys[i - 1]?.position ?? Vector3.Zero();
        const b = geometry.keys[i]?.position ?? Vector3.Zero();
        expect(Vector3.Distance(a, b)).toBeLessThan(2.5);
      }
    }
  });

  it('straight runs exactly its length and flags tunnels', () => {
    const geometry = getSectionDef('straight').build(ENTRY, { length: 30, tunnel: true });
    expect(geometry.length).toBeCloseTo(30, 6);
    expect(geometry.exit.position.z).toBeCloseTo(30, 6);
    expect(geometry.keys.every((key) => key.flags.tunnel)).toBe(true);
  });

  it('hill rises by its height, or dives by it', () => {
    const up = getSectionDef('hill').build(ENTRY, { height: 15, length: 50, dive: false });
    expect(up.exit.position.y).toBeCloseTo(ENTRY.position.y + 15, 6);
    expect(up.exit.position.z).toBeCloseTo(50, 6);
    const down = getSectionDef('hill').build(ENTRY, { height: 15, length: 50, dive: true });
    expect(down.exit.position.y).toBeCloseTo(ENTRY.position.y - 15, 6);
  });

  it('banked turn changes heading by its angle and banks into the bend', () => {
    const geometry = getSectionDef('turn').build(ENTRY, {
      direction: 'left',
      radius: 20,
      angle: 90,
      bank: 40,
    });
    expect(geometry.exit.yaw).toBeCloseTo(-90 * DEG, 9);
    expect(geometry.length).toBeCloseTo((Math.PI / 2) * 20, 1);
    const middle = geometry.keys[Math.floor(geometry.keys.length / 2)];
    expect(middle?.bank).toBeLessThan(-30 * DEG);
    expect(geometry.keys[geometry.keys.length - 1]?.bank).toBeCloseTo(0, 6);
  });

  it('loop returns to the entry heading and climbs to twice its radius', () => {
    const geometry = getSectionDef('loop').build(ENTRY, { radius: 10 });
    expect(geometry.exit.yaw).toBeCloseTo(0, 9);
    const top = Math.max(...geometry.keys.map((key) => key.position.y));
    expect(top).toBeCloseTo(ENTRY.position.y + 22, 1);
    expect(geometry.exit.position.x).toBeGreaterThan(3);
  });

  it('corkscrew rolls a full turn and returns level', () => {
    const geometry = getSectionDef('corkscrew').build(ENTRY, {
      direction: 'left',
      radius: 4,
      length: 30,
    });
    expect(geometry.keys[geometry.keys.length - 1]?.bank).toBeCloseTo(-Math.PI * 2, 6);
    expect(geometry.exit.position.z).toBeCloseTo(30, 6);
    expect(geometry.exit.position.y).toBeCloseTo(ENTRY.position.y, 6);
  });

  it('helix turns and climbs per turn', () => {
    const geometry = getSectionDef('helix').build(ENTRY, {
      direction: 'right',
      radius: 12,
      turns: 2,
      climb: 5,
    });
    expect(geometry.exit.position.y).toBeCloseTo(ENTRY.position.y + 10, 6);
    expect(Math.abs(geometry.exit.position.x)).toBeLessThan(1e-6);
    expect(Math.abs(geometry.exit.position.z)).toBeLessThan(1e-6);
    expect(geometry.exit.yaw).toBeCloseTo(4 * Math.PI, 9);
  });

  it('spiral narrows from the start radius to the end radius', () => {
    const geometry = getSectionDef('spiral').build(ENTRY, {
      direction: 'left',
      startRadius: 20,
      endRadius: 6,
      turns: 1,
      climb: 0,
    });
    // After one turn the point sits (startRadius - endRadius) short of the entry, along the forward axis' side.
    const centre = new Vector3(-20, ENTRY.position.y, 0);
    expect(Vector3.Distance(geometry.exit.position, centre)).toBeCloseTo(6, 6);
  });

  it('wave returns level after its waves and never dips below the entry', () => {
    const geometry = getSectionDef('wave').build(ENTRY, { length: 60, waves: 3, amplitude: 4 });
    expect(geometry.exit.position.y).toBeCloseTo(ENTRY.position.y, 6);
    for (const key of geometry.keys)
      expect(key.position.y).toBeGreaterThanOrEqual(ENTRY.position.y - 1e-9);
    const top = Math.max(...geometry.keys.map((key) => key.position.y));
    expect(top).toBeCloseTo(ENTRY.position.y + 4, 1);
  });

  it('jump flags only the airborne keys and lands level at the entry height', () => {
    const geometry = getSectionDef('jump').build(ENTRY, { gap: 14, angle: 18 });
    const gapKeys = geometry.keys.filter((key) => key.flags.gap);
    expect(gapKeys.length).toBeGreaterThan(5);
    expect(gapKeys.length).toBeLessThan(geometry.keys.length);
    expect(geometry.exit.position.y).toBeCloseTo(ENTRY.position.y, 6);
    expect(geometry.exit.pitch).toBeCloseTo(0, 9);
  });
});

describe('normaliseParams', () => {
  it('clamps numbers to their range and step and fills defaults', () => {
    const params = normaliseParams('turn', { radius: 1000, angle: 17.2, bank: -5 });
    expect(params).toEqual({ direction: 'right', radius: 60, angle: 15, bank: 0 });
  });

  it('drops unknown keys and rejects wrong types', () => {
    const params = normaliseParams('straight', { length: 'long', tunnel: 1, extra: 2 });
    expect(params).toEqual({ length: 24, tunnel: false });
  });
});

describe('easedRamp', () => {
  it('runs from 0 to 1 with flat ends and a constant middle', () => {
    expect(easedRamp(0)).toBe(0);
    expect(easedRamp(1)).toBeCloseTo(1, 9);
    expect(easedRamp(0.5)).toBeCloseTo(0.5, 9);
    expect(easedRamp(0.001) - easedRamp(0)).toBeLessThan(1e-4);
    const middleSlope = (easedRamp(0.6) - easedRamp(0.4)) / 0.2;
    expect(middleSlope).toBeCloseTo(1 / 0.78, 6);
  });
});
