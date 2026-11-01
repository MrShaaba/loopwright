import { describe, expect, it } from 'vitest';
import { STARTERS } from '../starters';
import { compileTrack, createSection } from '../track/Track';
import { generateItems, PLACEMENT } from './items';

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
      expect(layout.rings).toBeGreaterThan(30);
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
          if (other === hazard) continue;
          expect(Math.abs(other.s - hazard.s)).toBeGreaterThanOrEqual(PLACEMENT.hazardClear - 1e-6);
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
