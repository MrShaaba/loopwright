import { describe, expect, it } from 'vitest';
import { createRunStats } from '../game/scoring';
import {
  addCollected,
  addLap,
  createProgress,
  isCleanLap,
  isPerfectLap,
  loadProgress,
  parseProgress,
  saveProgress,
  type LapRecord,
  type ProgressStore,
} from './progress';
import { isUnlocked, listUnlockables, newlyUnlocked, nextUnlock } from './unlocks';

function memoryStore(initial: string | null = null): ProgressStore & { text: string | null } {
  const store = {
    text: initial,
    read: () => store.text,
    write: (text: string) => {
      store.text = text;
    },
  };
  return store;
}

function lap(overrides: Partial<LapRecord> = {}): LapRecord {
  const stats = createRunStats();
  stats.rings = 20;
  stats.bestCombo = 20;
  stats.gems = 3;
  stats.boosts = 2;
  stats.topSpeedKmh = 143.6;
  return {
    mode: 'game',
    stats,
    ringsTotal: 20,
    gemsTotal: 3,
    hazardsTotal: 4,
    trackKey: 'track-a',
    themeId: 'minimal',
    multiplier: 1,
    beatGhost: false,
    ...overrides,
  };
}

describe('progress', () => {
  it('starts at zero and survives a round trip through storage', () => {
    const store = memoryStore();
    expect(loadProgress(store)).toEqual(createProgress());
    let progress = addCollected(createProgress(), 2, 7);
    progress = addLap(progress, lap());
    saveProgress(progress, store);
    expect(loadProgress(store)).toEqual(progress);
    expect(loadProgress(store).gems).toBe(2);
    expect(loadProgress(store).rings).toBe(7);
  });

  it('folds a lap into the totals and remembers tracks and themes once', () => {
    let progress = addLap(createProgress(), lap());
    progress = addLap(progress, lap({ trackKey: 'track-b', themeId: 'abyss' }));
    progress = addLap(progress, lap({ trackKey: 'track-a' }));
    expect(progress.laps).toBe(3);
    expect(progress.boosts).toBe(6);
    expect(progress.bestCombo).toBe(20);
    expect(progress.topSpeedKmh).toBe(144);
    expect(progress.tracks).toEqual(['track-a', 'track-b']);
    expect(progress.themes).toEqual(['minimal', 'abyss']);
    expect(progress.perfectLaps).toBe(3);
    expect(progress.cleanLaps).toBe(3);
  });

  it('knows a perfect lap from a clean one', () => {
    expect(isPerfectLap(lap())).toBe(true);
    const missed = lap();
    missed.stats.bestCombo = 12;
    expect(isPerfectLap(missed)).toBe(false);
    expect(isCleanLap(missed)).toBe(true);
    const hit = lap();
    hit.stats.hazards = 1;
    hit.stats.bestCombo = 9;
    expect(isCleanLap(hit)).toBe(false);
    expect(isCleanLap(lap({ hazardsTotal: 0 }))).toBe(false);
    expect(isPerfectLap(lap({ mode: 'time' }))).toBe(false);
    expect(isPerfectLap(lap({ ringsTotal: 0 }))).toBe(false);
  });

  it('counts ghosts beaten only in Time Attack', () => {
    const progress = addLap(
      addLap(createProgress(), lap({ mode: 'time', beatGhost: true })),
      lap({ beatGhost: true }),
    );
    expect(progress.ghostsBeaten).toBe(1);
    expect(progress.laps).toBe(2);
  });

  it('repairs broken storage instead of throwing', () => {
    expect(loadProgress(memoryStore('not json'))).toEqual(createProgress());
    const repaired = parseProgress({
      gems: -4,
      rings: 'x',
      laps: 3.7,
      tracks: [1, 'a'],
      themes: 5,
    });
    expect(repaired.gems).toBe(0);
    expect(repaired.rings).toBe(0);
    expect(repaired.laps).toBe(3);
    expect(repaired.tracks).toEqual(['a']);
    expect(repaired.themes).toEqual([]);
  });
});

describe('unlocks', () => {
  it('lists every skin and trail cheapest first with the defaults free', () => {
    const items = listUnlockables();
    expect(items[0]?.cost).toBe(0);
    expect(items.filter((item) => item.cost === 0).map((item) => item.id)).toEqual([
      'lattice',
      'none',
    ]);
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.cost).toBeGreaterThanOrEqual(items[i - 1]!.cost);
    }
    expect(items.filter((item) => item.kind === 'skin')).toHaveLength(9);
    expect(items.filter((item) => item.kind === 'trail')).toHaveLength(8);
  });

  it('opens items as gems come in and names the next one', () => {
    expect(isUnlocked(0, 0)).toBe(true);
    expect(isUnlocked(3, 2)).toBe(false);
    expect(isUnlocked(3, 3)).toBe(true);
    expect(newlyUnlocked(0, 3).map((item) => item.id)).toEqual(['comet', 'meridian']);
    expect(newlyUnlocked(3, 3)).toEqual([]);
    expect(newlyUnlocked(4, 6).map((item) => item.id)).toEqual(['sparks', 'honeycomb']);
    expect(nextUnlock(0)).toEqual({
      item: { kind: 'trail', id: 'comet', name: 'Comet', cost: 2 },
      remaining: 2,
    });
    expect(nextUnlock(49)?.item.id).toBe('eclipse');
    expect(nextUnlock(50)).toBeNull();
  });
});
