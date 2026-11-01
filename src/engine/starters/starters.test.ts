import { describe, expect, it } from 'vitest';
import { compileTrack } from '../track/Track';
import { validateTrack } from '../validate/validate';
import { STARTERS } from './index';

describe('starter tracks', () => {
  it('are five, with distinct ids and names', () => {
    expect(STARTERS).toHaveLength(5);
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(5);
    expect(new Set(STARTERS.map((s) => s.name)).size).toBe(5);
  });

  it.each(STARTERS.map((starter) => [starter.name, starter]))(
    '%s compiles, closes and validates with no issues',
    (_name, starter) => {
      const track = compileTrack(starter.doc.sections);
      const result = validateTrack(starter.doc.sections, track);
      const problems = result.issues.map(
        (issue) => `${issue.kind}@${issue.sectionIndex}: ${issue.message}`,
      );
      expect(problems).toEqual([]);
      expect(track.length).toBeGreaterThan(300);
      expect(track.length).toBeLessThan(1200);
    },
  );
});
