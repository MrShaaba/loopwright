import { describe, expect, it } from 'vitest';
import { compileTrack, createSection, type SectionSpec } from '../track/Track';
import { validateTrack } from './validate';

function check(sections: SectionSpec[]) {
  return validateTrack(sections, compileTrack(sections));
}

describe('validateTrack', () => {
  it('passes a sensible track', () => {
    const result = check([
      createSection('hill', { height: 14, length: 44 }),
      createSection('hill', { height: 12, length: 36, dive: true }),
      createSection('turn', { direction: 'right', radius: 20, angle: 90 }),
      createSection('loop'),
    ]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports a track that is too short as an error on the whole track', () => {
    const result = check([createSection('straight', { length: 6 })]);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.kind).toBe('too-short');
    expect(result.issues[0]?.sectionIndex).toBe(-1);
  });

  it('points at the section that dives underground', () => {
    const result = check([
      createSection('straight', { length: 40 }),
      createSection('hill', { height: 20, length: 40, dive: true }),
    ]);
    const issue = result.issues.find((i) => i.kind === 'underground');
    expect(issue?.severity).toBe('error');
    expect(issue?.sectionIndex).toBe(1);
    expect(issue?.message).toContain('Section 2');
    expect(issue?.position?.y).toBeLessThan(1.6);
  });

  it('warns about a hill that is too steep', () => {
    const result = check([
      createSection('straight', { length: 40 }),
      createSection('hill', { height: 40, length: 12 }),
      createSection('turn', { radius: 30, angle: 180 }),
    ]);
    const issue = result.issues.find((i) => i.kind === 'too-steep');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sectionIndex).toBe(1);
  });

  it('flags a helix whose coils overlap as pitched too tight, once', () => {
    const result = check([
      createSection('straight', { length: 40 }),
      createSection('helix', { radius: 12, turns: 3, climb: 1 }),
    ]);
    const tight = result.issues.filter((i) => i.kind === 'spiral-tight');
    expect(tight).toHaveLength(1);
    expect(tight[0]?.sectionIndex).toBe(1);
    // The overlap inside the helix is reported as the tight pitch, not again as a crossing.
    expect(result.issues.some((i) => i.kind === 'crossing' && i.sectionIndex === 1)).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('detects the tube crossing itself', () => {
    // A long straight, a hairpin back and a parallel straight that overlaps the first.
    const result = check([
      createSection('straight', { length: 60 }),
      createSection('turn', { direction: 'right', radius: 6, angle: 180, bank: 10 }),
      createSection('straight', { length: 20 }),
      createSection('turn', { direction: 'right', radius: 6, angle: 180, bank: 10 }),
      createSection('straight', { length: 40 }),
    ]);
    const crossing = result.issues.find((i) => i.kind === 'crossing');
    expect(crossing?.severity).toBe('error');
    expect(crossing?.position).not.toBeNull();
  });

  it('orders errors before warnings', () => {
    const result = check([
      createSection('hill', { height: 20, length: 12 }),
      createSection('hill', { height: 40, length: 20, dive: true }),
    ]);
    expect(result.issues[0]?.severity).toBe('error');
    expect(result.issues[0]?.kind).toBe('underground');
    expect(result.issues[result.issues.length - 1]?.severity).toBe('warning');
    expect(result.errors).toBeGreaterThan(0);
    expect(result.warnings).toBeGreaterThan(0);
  });
});
