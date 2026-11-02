import { parseTrackDoc, type TrackDoc } from './schema';

const TRACK_KEY = 'loopwright.track.v2';
const PREFS_KEY = 'loopwright.prefs.v1';
const BEST_LAPS_KEY = 'loopwright.bestLaps.v1';
const HOWTO_KEY = 'loopwright.howto.v1';
const MAX_BEST_LAPS = 60;

export interface Prefs {
  multiplier: number;
  muted: boolean;
  view: 'inside' | 'follow';
  endless: boolean;
  playMode: 'game' | 'time' | 'cruise';
  /** Equipped ball skin and trail ids. */
  skin: string;
  trail: string;
  /** Master volume, 0 to 1. */
  volume: number;
  /** Whether the ambient music bed plays. */
  music: boolean;
  /** The Scenic World to open next time, and its sky variant, or null for the theme. */
  world: string | null;
  worldSky: string | null;
}

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedTrack(): TrackDoc | null {
  return parseTrackDoc(read(TRACK_KEY));
}

export function saveTrack(doc: TrackDoc): boolean {
  return write(TRACK_KEY, doc);
}

export function loadPrefs(): Partial<Prefs> {
  const raw = read(PREFS_KEY);
  if (typeof raw !== 'object' || raw === null) return {};
  const record = raw as Record<string, unknown>;
  const prefs: Partial<Prefs> = {};
  if (typeof record.multiplier === 'number' && Number.isFinite(record.multiplier)) {
    prefs.multiplier = record.multiplier;
  }
  if (typeof record.muted === 'boolean') prefs.muted = record.muted;
  if (record.view === 'inside' || record.view === 'follow') prefs.view = record.view;
  if (typeof record.endless === 'boolean') prefs.endless = record.endless;
  if (record.playMode === 'game' || record.playMode === 'time' || record.playMode === 'cruise') {
    prefs.playMode = record.playMode;
  }
  if (typeof record.skin === 'string') prefs.skin = record.skin;
  if (typeof record.trail === 'string') prefs.trail = record.trail;
  if (typeof record.volume === 'number' && Number.isFinite(record.volume)) {
    prefs.volume = Math.min(1, Math.max(0, record.volume));
  }
  if (typeof record.music === 'boolean') prefs.music = record.music;
  if (typeof record.world === 'string' || record.world === null) prefs.world = record.world;
  if (typeof record.worldSky === 'string' || record.worldSky === null) {
    prefs.worldSky = record.worldSky;
  }
  return prefs;
}

export function savePrefs(prefs: Prefs): boolean {
  return write(PREFS_KEY, prefs);
}

function readBestLaps(): Record<string, number> {
  const raw = read(BEST_LAPS_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value;
  }
  return out;
}

/** Best lap in seconds for a track key (its share code), or null. */
export function loadBestLap(key: string): number | null {
  return readBestLaps()[key] ?? null;
}

/** Records a lap if it beats the stored best. Keeps the most recent sixty tracks. */
export function saveBestLap(key: string, seconds: number): boolean {
  const laps = readBestLaps();
  const current = laps[key];
  if (current !== undefined && current <= seconds) return false;
  delete laps[key];
  const entries = Object.entries(laps).slice(-(MAX_BEST_LAPS - 1));
  entries.push([key, seconds]);
  return write(BEST_LAPS_KEY, Object.fromEntries(entries));
}

/** Whether the first-ride card has been dismissed before. */
export function hasSeenHowToPlay(): boolean {
  try {
    return localStorage.getItem(HOWTO_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function markHowToPlaySeen(): void {
  try {
    localStorage.setItem(HOWTO_KEY, 'seen');
  } catch {
    // Nothing to do: the card will show again next time.
  }
}
