import { describe, expect, it } from 'vitest';
import { createRunStats } from '../game/scoring';
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  loadEarned,
  saveEarned,
  type AchievementStore,
} from './achievements';
import { addLap, createProgress, type LapRecord, type Progress } from './progress';
import { ProgressTracker } from './ProgressTracker';

function memoryStore(initial: string | null = null): AchievementStore & { text: string | null } {
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
  stats.rings = 10;
  stats.bestCombo = 6;
  stats.gems = 1;
  stats.boosts = 1;
  stats.hazards = 1;
  stats.topSpeedKmh = 90;
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

function ids(progress: Progress, record: LapRecord | null, earned: string[] = []): string[] {
  return evaluateAchievements({ lap: record, progress, themeCount: 7 }, new Set(earned)).map(
    (a) => a.id,
  );
}

describe('achievements', () => {
  it('has unique ids and names', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
  });

  it('earns the first gem on collection and the first lap at the line', () => {
    expect(ids(createProgress(), null)).toEqual([]);
    expect(ids({ ...createProgress(), gems: 1 }, null)).toEqual(['first-gem']);
    const progress = addLap({ ...createProgress(), gems: 1 }, lap());
    expect(ids(progress, lap(), ['first-gem'])).toEqual(['first-lap']);
  });

  it('reads perfect, clean, full-gem and fast laps from the lap itself', () => {
    const perfect = lap();
    perfect.stats.rings = 20;
    perfect.stats.bestCombo = 20;
    perfect.stats.gems = 3;
    perfect.stats.hazards = 0;
    perfect.stats.boosts = 5;
    perfect.multiplier = 2.5;
    const progress = addLap(createProgress(), perfect);
    expect(ids(progress, perfect, ['first-lap', 'chain-twenty'])).toEqual([
      'clean-sweep',
      'unbroken',
      'untouched',
      'gem-hunter',
      'flat-out',
      'pad-hopper',
    ]);
    // A missed ring keeps the sweep and the combo achievements away.
    const missed = lap();
    missed.stats.rings = 19;
    missed.stats.bestCombo = 19;
    missed.stats.hazards = 0;
    expect(ids(addLap(createProgress(), missed), missed, ['first-lap'])).toEqual(['untouched']);
    // Time Attack laps never count as ring sweeps, but beating the ghost does count.
    const timed = lap({ mode: 'time', beatGhost: true });
    expect(ids(addLap(createProgress(), timed), timed, ['first-lap'])).toEqual(['shadow-runner']);
  });

  it('tracks lifetime milestones', () => {
    const progress: Progress = {
      ...createProgress(),
      gems: 100,
      rings: 500,
      laps: 50,
      bestCombo: 20,
      topSpeedKmh: 250,
      tracks: ['a', 'b', 'c', 'd', 'e'],
      themes: ['1', '2', '3', '4', '5', '6', '7'],
    };
    expect(ids(progress, null)).toEqual([
      'first-gem',
      'first-lap',
      'chain-twenty',
      'collector',
      'hoarder',
      'ring-road',
      'regular',
      'veteran',
      'explorer',
      'world-tour',
      'blur',
    ]);
    expect(ids({ ...progress, themes: ['1'] }, null).includes('world-tour')).toBe(false);
  });

  it('saves and loads earned dates and drops unknown ids', () => {
    const store = memoryStore('{"first-gem": "2026-11-01T10:00:00Z", "nope": "x", "blur": 5}');
    const earned = loadEarned(store);
    expect([...earned.entries()]).toEqual([['first-gem', '2026-11-01T10:00:00Z']]);
    earned.set('regular', '2026-11-02T10:00:00Z');
    saveEarned(earned, store);
    expect(loadEarned(store).get('regular')).toBe('2026-11-02T10:00:00Z');
    expect(loadEarned(memoryStore('broken')).size).toBe(0);
  });
});

describe('progress tracker', () => {
  it('announces unlocks and achievements once and persists both', () => {
    const progressStore = memoryStore();
    const achievementStore = memoryStore();
    const tracker = new ProgressTracker({
      progressStore,
      achievementStore,
      themeCount: 7,
      now: () => '2026-11-02T00:00:00Z',
    });
    const unlocks: string[] = [];
    const earned: string[] = [];
    tracker.events.on('unlock', (item) => unlocks.push(item.id));
    tracker.events.on('achievement', (a) => earned.push(a.id));
    tracker.collect(1, 0);
    tracker.collect(1, 0);
    tracker.collect(1, 3);
    expect(unlocks).toEqual(['comet', 'meridian']);
    expect(earned).toEqual(['first-gem']);
    tracker.lap(lap());
    expect(earned).toEqual(['first-gem', 'first-lap']);
    expect(tracker.progress.gems).toBe(3);
    expect(tracker.progress.laps).toBe(1);

    const again = new ProgressTracker({ progressStore, achievementStore, themeCount: 7 });
    expect(again.progress.gems).toBe(3);
    expect(again.earned.get('first-lap')).toBe('2026-11-02T00:00:00Z');
    const later: string[] = [];
    again.events.on('achievement', (a) => later.push(a.id));
    again.lap(lap());
    expect(later).toEqual([]);
  });
});
