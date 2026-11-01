import { describe, expect, it } from 'vitest';
import {
  loadScores,
  recordScore,
  SCORES_PER_TRACK,
  type ScoreEntry,
  type ScoreStore,
} from './scores';

function memoryStore(initial: string | null = null): ScoreStore & { text: string | null } {
  const store = {
    text: initial,
    read: () => store.text,
    write: (text: string) => {
      store.text = text;
    },
  };
  return store;
}

function entry(score: number, date = '2026-11-01T10:00:00Z'): ScoreEntry {
  return {
    score,
    rings: 12,
    gems: 1,
    bestCombo: 6,
    topSpeed: 74,
    lapTime: 38.2,
    multiplier: 1,
    date,
  };
}

describe('high scores', () => {
  it('starts empty and records laps best first', () => {
    const store = memoryStore();
    expect(loadScores('track-a', store)).toEqual([]);
    expect(recordScore('track-a', entry(300), store).rank).toBe(1);
    expect(recordScore('track-a', entry(900), store).rank).toBe(1);
    expect(recordScore('track-a', entry(500), store).rank).toBe(2);
    expect(loadScores('track-a', store).map((e) => e.score)).toEqual([900, 500, 300]);
  });

  it('keeps tracks apart and caps each table at ten', () => {
    const store = memoryStore();
    for (let i = 0; i < 14; i++)
      recordScore(
        'track-a',
        entry(i * 100, `2026-11-01T10:${String(i).padStart(2, '0')}:00Z`),
        store,
      );
    recordScore('track-b', entry(1), store);
    const a = loadScores('track-a', store);
    expect(a).toHaveLength(SCORES_PER_TRACK);
    expect(a[0]?.score).toBe(1300);
    expect(a[a.length - 1]?.score).toBe(400);
    expect(loadScores('track-b', store).map((e) => e.score)).toEqual([1]);
    expect(recordScore('track-a', entry(50), store).rank).toBeNull();
  });

  it('breaks ties by the earlier lap and survives junk in storage', () => {
    const store = memoryStore('not json');
    expect(loadScores('x', store)).toEqual([]);
    recordScore('x', entry(100, '2026-11-02T00:00:00Z'), store);
    recordScore('x', entry(100, '2026-11-01T00:00:00Z'), store);
    expect(loadScores('x', store).map((e) => e.date)).toEqual([
      '2026-11-01T00:00:00Z',
      '2026-11-02T00:00:00Z',
    ]);
    const broken = memoryStore(JSON.stringify({ x: [{ score: 'high' }, entry(5)] }));
    expect(loadScores('x', broken).map((e) => e.score)).toEqual([5]);
  });
});
