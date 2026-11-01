import { corkscrew } from './corkscrew';
import { helix } from './helix';
import { hill } from './hill';
import { jump } from './jump';
import { loop } from './loop';
import { spiral } from './spiral';
import { straight } from './straight';
import { turn } from './turn';
import type { ParamSpec, SectionDef, SectionParams, SectionType } from './types';
import { wave } from './wave';

const DEFS: readonly SectionDef[] = [
  straight,
  hill,
  turn,
  loop,
  corkscrew,
  helix,
  spiral,
  wave,
  jump,
];

const BY_TYPE = new Map<SectionType, SectionDef>(DEFS.map((def) => [def.type, def]));

export function listSectionDefs(): readonly SectionDef[] {
  return DEFS;
}

export function getSectionDef(type: SectionType): SectionDef {
  const def = BY_TYPE.get(type);
  if (!def) throw new Error(`Unknown section type "${type}"`);
  return def;
}

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && BY_TYPE.has(value as SectionType);
}

export function defaultParams(type: SectionType): SectionParams {
  const params: SectionParams = {};
  for (const spec of getSectionDef(type).params) params[spec.key] = spec.default;
  return params;
}

/** Clamps and rounds a value to a param's range and step; other kinds pass through when valid. */
export function normaliseParam(spec: ParamSpec, value: unknown): SectionParams[string] {
  switch (spec.kind) {
    case 'number': {
      const n = typeof value === 'number' && Number.isFinite(value) ? value : spec.default;
      const stepped = Math.round((n - spec.min) / spec.step) * spec.step + spec.min;
      const clamped = Math.min(spec.max, Math.max(spec.min, stepped));
      return Number(clamped.toFixed(4));
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : spec.default;
    case 'choice':
      return typeof value === 'string' && spec.options.includes(value) ? value : spec.default;
  }
}

/** Fills missing params with defaults and drops unknown ones. */
export function normaliseParams(type: SectionType, params: SectionParams): SectionParams {
  const out: SectionParams = {};
  for (const spec of getSectionDef(type).params)
    out[spec.key] = normaliseParam(spec, params[spec.key]);
  return out;
}

export type { ParamSpec, ParamValue, SectionDef, SectionParams, SectionType } from './types';
