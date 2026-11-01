const SCORES_KEY = 'loopwright.scores.v1';
export const SCORES_PER_TRACK = 10;
const MAX_TRACKS = 40;

export interface ScoreEntry {
  score: number;
  rings: number;
  gems: number;
  bestCombo: number;
  /** km/h */
  topSpeed: number;
  /** Lap time in seconds. */
  lapTime: number;
  /** Speed multiplier set when the lap ended. */
  multiplier: number;
  /** ISO date of the lap. */
  date: string;
}

type Table = Record<string, ScoreEntry[]>;

export interface ScoreStore {
  read: () => string | null;
  write: (text: string) => void;
}

/** localStorage, wrapped so a private window or a full quota never throws. */
export const browserScoreStore: ScoreStore = {
  read: () => {
    try {
      return localStorage.getItem(SCORES_KEY);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      localStorage.setItem(SCORES_KEY, text);
    } catch {
      // Nothing to do: the table simply does not persist.
    }
  },
};

function isEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === 'number' &&
    typeof v.rings === 'number' &&
    typeof v.gems === 'number' &&
    typeof v.bestCombo === 'number' &&
    typeof v.topSpeed === 'number' &&
    typeof v.lapTime === 'number' &&
    typeof v.multiplier === 'number' &&
    typeof v.date === 'string'
  );
}

function readTable(store: ScoreStore): Table {
  try {
    const raw: unknown = JSON.parse(store.read() ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const table: Table = {};
    for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(list)) table[key] = list.filter(isEntry);
    }
    return table;
  } catch {
    return {};
  }
}

/** Best scores first; ties go to the earlier lap. */
export function sortScores(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

/** The high-score table for a track key (its share code), best first. */
export function loadScores(key: string, store: ScoreStore = browserScoreStore): ScoreEntry[] {
  return sortScores(readTable(store)[key] ?? []);
}

export interface ScoreResult {
  /** 1-based position in the table, or null when the lap did not make it. */
  rank: number | null;
  table: ScoreEntry[];
}

/** Adds a lap to a track's table, keeping the top ten, and the most recent forty tracks. */
export function recordScore(
  key: string,
  entry: ScoreEntry,
  store: ScoreStore = browserScoreStore,
): ScoreResult {
  const table = readTable(store);
  const list = sortScores([...(table[key] ?? []), entry]).slice(0, SCORES_PER_TRACK);
  const rank = list.indexOf(entry);
  delete table[key];
  const entries = Object.entries(table).slice(-(MAX_TRACKS - 1));
  entries.push([key, list]);
  store.write(JSON.stringify(Object.fromEntries(entries)));
  return { rank: rank >= 0 ? rank + 1 : null, table: list };
}

/** Speed bands keep scores fair: a 3x lap only competes with other 3x laps. */
export type SpeedBand = 'band1' | 'band2' | 'band3';

export const SPEED_BAND_LABELS: Record<SpeedBand, string> = {
  band1: '1x and under',
  band2: 'up to 2x',
  band3: 'above 2x',
};

/** The band for the highest speed multiplier used during a lap. */
export function speedBand(multiplier: number): SpeedBand {
  if (multiplier <= 1.0001) return 'band1';
  if (multiplier <= 2.0001) return 'band2';
  return 'band3';
}

/** The table key for a track and band. */
export function bandKey(trackKey: string, band: SpeedBand): string {
  return `${trackKey}|${band}`;
}
