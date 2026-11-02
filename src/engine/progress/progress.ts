import type { RunStats } from '../game/scoring';

const PROGRESS_KEY = 'loopwright.progress.v1';
/** Distinct tracks and themes are kept as lists; cap them so storage never grows without bound. */
const MAX_DISTINCT = 64;

/** Lifetime totals across every track and every session, saved in localStorage. */
export interface Progress {
  gems: number;
  rings: number;
  laps: number;
  boosts: number;
  hazards: number;
  bestCombo: number;
  topSpeedKmh: number;
  /** Laps in Game mode with every ring and no miss. */
  perfectLaps: number;
  /** Laps in Game mode without touching a barrier, on tracks that have barriers. */
  cleanLaps: number;
  /** Time Attack laps that beat the ghost. */
  ghostsBeaten: number;
  /** Distinct track keys ridden to a lap, newest last. */
  tracks: string[];
  /** Distinct theme ids ridden in, newest last. */
  themes: string[];
}

export interface ProgressStore {
  read: () => string | null;
  write: (text: string) => void;
}

export const browserProgressStore: ProgressStore = {
  read: () => {
    try {
      return localStorage.getItem(PROGRESS_KEY);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      localStorage.setItem(PROGRESS_KEY, text);
    } catch {
      // Progress simply does not persist this time.
    }
  },
};

export function createProgress(): Progress {
  return {
    gems: 0,
    rings: 0,
    laps: 0,
    boosts: 0,
    hazards: 0,
    bestCombo: 0,
    topSpeedKmh: 0,
    perfectLaps: 0,
    cleanLaps: 0,
    ghostsBeaten: 0,
    tracks: [],
    themes: [],
  };
}

const COUNTERS = [
  'gems',
  'rings',
  'laps',
  'boosts',
  'hazards',
  'bestCombo',
  'topSpeedKmh',
  'perfectLaps',
  'cleanLaps',
  'ghostsBeaten',
] as const;

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(-MAX_DISTINCT);
}

/** Reads a progress record, repairing anything missing or broken. */
export function parseProgress(raw: unknown): Progress {
  const progress = createProgress();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return progress;
  const record = raw as Record<string, unknown>;
  for (const key of COUNTERS) progress[key] = count(record[key]);
  progress.tracks = strings(record.tracks);
  progress.themes = strings(record.themes);
  return progress;
}

export function loadProgress(store: ProgressStore = browserProgressStore): Progress {
  try {
    return parseProgress(JSON.parse(store.read() ?? 'null'));
  } catch {
    return createProgress();
  }
}

export function saveProgress(
  progress: Progress,
  store: ProgressStore = browserProgressStore,
): void {
  store.write(JSON.stringify(progress));
}

/** A finished lap, as the tracker sees it. */
export interface LapRecord {
  mode: 'game' | 'time' | 'cruise';
  stats: RunStats;
  ringsTotal: number;
  gemsTotal: number;
  hazardsTotal: number;
  trackKey: string;
  themeId: string;
  /** Highest speed multiplier used in the lap, slider times Shift boost. */
  multiplier: number;
  /** Time Attack only: this lap beat an existing ghost. */
  beatGhost: boolean;
}

function remember(list: readonly string[], value: string): string[] {
  if (!value || list.includes(value)) return [...list];
  return [...list, value].slice(-MAX_DISTINCT);
}

/** A perfect lap collects every ring without a single miss or hit. */
export function isPerfectLap(lap: LapRecord): boolean {
  return (
    lap.mode === 'game' &&
    lap.ringsTotal > 0 &&
    lap.stats.rings === lap.ringsTotal &&
    lap.stats.bestCombo === lap.ringsTotal
  );
}

/** A clean lap gets past every barrier untouched. */
export function isCleanLap(lap: LapRecord): boolean {
  return lap.mode === 'game' && lap.hazardsTotal > 0 && lap.stats.hazards === 0;
}

/** Gems and rings count the moment they are collected, so a lap you never finish still pays. */
export function addCollected(progress: Progress, gems: number, rings: number): Progress {
  return { ...progress, gems: progress.gems + gems, rings: progress.rings + rings };
}

/** Folds a finished lap into the totals. Gems and rings were already counted on collection. */
export function addLap(progress: Progress, lap: LapRecord): Progress {
  return {
    ...progress,
    laps: progress.laps + 1,
    boosts: progress.boosts + lap.stats.boosts,
    hazards: progress.hazards + lap.stats.hazards,
    bestCombo: Math.max(progress.bestCombo, lap.stats.bestCombo),
    topSpeedKmh: Math.max(progress.topSpeedKmh, Math.round(lap.stats.topSpeedKmh)),
    perfectLaps: progress.perfectLaps + (isPerfectLap(lap) ? 1 : 0),
    cleanLaps: progress.cleanLaps + (isCleanLap(lap) ? 1 : 0),
    ghostsBeaten: progress.ghostsBeaten + (lap.mode === 'time' && lap.beatGhost ? 1 : 0),
    tracks: remember(progress.tracks, lap.trackKey),
    themes: remember(progress.themes, lap.themeId),
  };
}
