import { parseGhost, type GhostRecording } from './ghost';

const GHOSTS_KEY = 'loopwright.ghosts.v1';
/** Ghosts are a few kilobytes each; keep the most recent dozen tracks and bands. */
const MAX_GHOSTS = 12;

export interface GhostStore {
  read: () => string | null;
  write: (text: string) => void;
}

export const browserGhostStore: GhostStore = {
  read: () => {
    try {
      return localStorage.getItem(GHOSTS_KEY);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      localStorage.setItem(GHOSTS_KEY, text);
    } catch {
      // The ghost simply does not persist.
    }
  },
};

function readAll(store: GhostStore): Record<string, GhostRecording> {
  try {
    const raw: unknown = JSON.parse(store.read() ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const out: Record<string, GhostRecording> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const ghost = parseGhost(value);
      if (ghost) out[key] = ghost;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadGhost(
  key: string,
  store: GhostStore = browserGhostStore,
): GhostRecording | null {
  return readAll(store)[key] ?? null;
}

export function saveGhost(
  key: string,
  ghost: GhostRecording,
  store: GhostStore = browserGhostStore,
): void {
  const all = readAll(store);
  delete all[key];
  const entries = Object.entries(all).slice(-(MAX_GHOSTS - 1));
  entries.push([key, ghost]);
  store.write(JSON.stringify(Object.fromEntries(entries)));
}
