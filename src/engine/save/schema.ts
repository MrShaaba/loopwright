import { isSectionType, normaliseParams } from '../track/sections';
import type { SectionParams } from '../track/sections/types';
import type { SectionSpec } from '../track/Track';

/** Track save format. Bump the version and add a migration whenever the shape changes. */
export const TRACK_FORMAT_VERSION = 2 as const;

export interface TrackDoc {
  version: typeof TRACK_FORMAT_VERSION;
  name: string;
  theme: string;
  sections: SectionSpec[];
}

export function createTrackDoc(name: string, theme: string, sections: SectionSpec[]): TrackDoc {
  return { version: TRACK_FORMAT_VERSION, name, theme, sections: sections.map(cloneSection) };
}

export function cloneSection(section: SectionSpec): SectionSpec {
  return { type: section.type, params: { ...section.params } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a section from untrusted data, normalising its params. Returns null when the type is unknown. */
export function parseSection(raw: unknown): SectionSpec | null {
  if (!isRecord(raw) || !isSectionType(raw.type)) return null;
  const params: SectionParams = {};
  if (isRecord(raw.params)) {
    for (const [key, value] of Object.entries(raw.params)) {
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
        params[key] = value;
      }
    }
  }
  return { type: raw.type, params: normaliseParams(raw.type, params) };
}

/** Reads a track document from untrusted JSON. Unknown sections are dropped; a bad shape returns null. */
export function parseTrackDoc(raw: unknown): TrackDoc | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== TRACK_FORMAT_VERSION) return null;
  if (!Array.isArray(raw.sections)) return null;
  const sections: SectionSpec[] = [];
  for (const item of raw.sections) {
    const section = parseSection(item);
    if (section) sections.push(section);
  }
  return {
    version: TRACK_FORMAT_VERSION,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 80) : 'Untitled',
    theme: typeof raw.theme === 'string' ? raw.theme : 'minimal',
    sections,
  };
}
