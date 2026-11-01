import { parseTrackDoc, type TrackDoc } from './schema';

const TRACK_KEY = 'loopwright.track.v2';
const PREFS_KEY = 'loopwright.prefs.v1';

export interface Prefs {
  multiplier: number;
  muted: boolean;
  view: 'inside' | 'follow';
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
  return prefs;
}

export function savePrefs(prefs: Prefs): boolean {
  return write(PREFS_KEY, prefs);
}
