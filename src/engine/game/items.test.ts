import { describe, expect, it } from 'vitest';
import { STARTERS } from '../starters';
import { compileTrack, createSection } from '../track/Track';
import { generateItems, laneTheta, PLACEMENT } from './items';

const flow = STARTERS.find((s) => s.id === 'flow');

describe('generateItems', () => {
  it('gives the same layout for the same track and seed, and a different one for another seed', () => {
    if (!flow) throw new Error('no Flow');
    const track = compileTrack(flow.doc.sections);
    const a = generateItems(track, 1);
    const b = generateItems(track, 1);
    const c = generateItems(track, 2);
    expect(a.items).toEqual(b.items);
    expect(a.items.length).toBeGreaterThan(40);
    expect(JSON.stringify(c.items)).not.toBe(JSON.stringify(a.items));
  });

  it('places rings, three gems, hazards and boosts on every starter', () => {
    for (const starter of STARTERS) {
      const track = compileTrack(starter.doc.sections);
      const layout = generateItems(track, 1);
      const kinds = (kind: string) => layout.items.filter((i) => i.kind === kind).length;
      expect(kinds('ring')).toBe(layout.rings);
      expect(layout.rings).toBeGreaterThan(25);
      expect(layout.gems).toBe(PLACEMENT.gems);
      expect(kinds('hazard')).toBeGreaterThan(1);
      expect(kinds('boost')).toBeGreaterThan(1);
    }
  });

  it('keeps every item clear of the start, the joins and jump gaps, and sorted along the track', () => {
    for (const starter of STARTERS) {
      const track = compileTrack(starter.doc.sections);
      const layout = generateItems(track, 3);
      let last = -1;
      for (const item of layout.items) {
        expect(item.s).toBeGreaterThanOrEqual(PLACEMENT.startMargin);
        expect(item.s).toBeGreaterThanOrEqual(last);
        last = item.s;
        const range = track.ranges[item.sectionIndex];
        expect(range).toBeDefined();
        if (!range) continue;
        expect(range.type).not.toBe('jump');
        expect(item.s).toBeGreaterThanOrEqual(range.s0 + PLACEMENT.joinMargin - 1e-6);
        expect(item.s).toBeLessThanOrEqual(range.s1 - PLACEMENT.joinMargin + 1e-6);
        expect(Math.abs(item.theta)).toBeLessThanOrEqual(Math.PI);
      }
    }
  });

  it('gives hazards a clear run-in and keeps them off loops and corkscrews', () => {
    for (const starter of STARTERS) {
      const track = compileTrack(starter.doc.sections);
      const layout = generateItems(track, 5);
      const hazards = layout.items.filter((i) => i.kind === 'hazard');
      for (const hazard of hazards) {
        const type = track.ranges[hazard.sectionIndex]?.type;
        expect(type === 'loop' || type === 'corkscrew').toBe(false);
        for (const other of layout.items) {
          if (other === hazard || other.group === hazard.group) continue;
          expect(Math.abs(other.s - hazard.s)).toBeGreaterThanOrEqual(PLACEMENT.hazardClear - 1e-6);
        }
      }
    }
  });

  it('spreads hazards and boost pads across the lanes, never floor-only', () => {
    const lanesOf = (kind: string): Set<number> => {
      const lanes = new Set<number>();
      for (const starter of STARTERS) {
        const track = compileTrack(starter.doc.sections);
        for (const item of generateItems(track, 1).items) {
          if (item.kind === kind)
            lanes.add(Math.round((item.theta / (Math.PI * 2)) * PLACEMENT.lanes));
        }
      }
      return lanes;
    };
    expect(lanesOf('boost').size).toBeGreaterThanOrEqual(4);
    expect(lanesOf('hazard').size).toBeGreaterThanOrEqual(4);
    expect(laneTheta(0)).toBe(0);
    expect(laneTheta(2)).toBeCloseTo((4 * Math.PI) / 5, 9);
  });

  it('pairs some boost pads with a ring line on the far side of the tube', () => {
    for (const starter of STARTERS) {
      const track = compileTrack(starter.doc.sections);
      const layout = generateItems(track, 1);
      const choices = layout.items.filter((i) => i.pattern === 'choice');
      const pads = choices.filter((i) => i.kind === 'boost');
      expect(pads.length).toBeGreaterThan(0);
      for (const pad of pads) {
        const rings = choices.filter((i) => i.kind === 'ring' && i.group === pad.group);
        expect(rings.length).toBe(4);
        for (const ring of rings) {
          expect(Math.abs(ring.s - pad.s)).toBeLessThan(8);
          const apart = Math.abs(((ring.theta - pad.theta + Math.PI) % (Math.PI * 2)) - Math.PI);
          expect(apart).toBeGreaterThan(2.4);
        }
      }
    }
  });

  it('lays weave runs with hazards alternating sides at a fair spacing', () => {
    for (const starter of STARTERS) {
      const track = compileTrack(starter.doc.sections);
      const layout = generateItems(track, 2);
      const groups = new Map<number, typeof layout.items>();
      for (const item of layout.items) {
        if (item.pattern !== 'weave' || item.kind !== 'hazard') continue;
        groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
      }
      expect(groups.size).toBeGreaterThan(0);
      for (const hazards of groups.values()) {
        expect(hazards.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < hazards.length; i++) {
          const a = hazards[i - 1];
          const b = hazards[i];
          if (!a || !b) continue;
          expect(b.s - a.s).toBeCloseTo(PLACEMENT.weaveSpacing, 6);
          expect(Math.sign(a.theta)).toBe(-Math.sign(b.theta));
        }
      }
    }
  });

  it('handles a tiny track without items', () => {
    const track = compileTrack([createSection('straight', { length: 6 })]);
    const layout = generateItems(track, 1);
    expect(layout.items.length).toBeGreaterThanOrEqual(0);
    expect(layout.gems).toBeLessThanOrEqual(PLACEMENT.gems);
  });
});
