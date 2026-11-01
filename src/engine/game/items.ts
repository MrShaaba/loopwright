import { createRng, type Rng } from '../util/random';
import type { CompiledTrack, SectionRange } from '../track/Track';

export type ItemKind = 'ring' | 'gem' | 'boost' | 'hazard';

export interface Item {
  id: number;
  kind: ItemKind;
  /** Arc length along the loop, metres. */
  s: number;
  /** Angle around the tube's centre, radians: 0 on the floor, positive to the right. */
  theta: number;
  /** Section index the item sits in. */
  sectionIndex: number;
}

export interface ItemLayout {
  seed: number;
  items: Item[];
  rings: number;
  gems: number;
}

/** Spacing rules, in metres, that keep the layout fair at speed. */
export const PLACEMENT = {
  /** Nothing in the first stretch after the start line, so the ride opens clean. */
  startMargin: 24,
  /** Nothing this close to a section join, where the tube bends from one shape to the next. */
  joinMargin: 4,
  /** Rings in a line or arc sit this far apart. */
  ringSpacing: 3.5,
  /** Gap kept clear before and after a hazard so there is time to see and steer. */
  hazardClear: 18,
  /** Least distance between any two placed groups. */
  groupGap: 5,
  /** Gems per track, when the track has room. */
  gems: 3,
  /** Hazards per 100 m, rounded. */
  hazardsPer100m: 0.6,
  /** Boost pads per 100 m, rounded. */
  boostsPer100m: 0.7,
} as const;

interface Span {
  s0: number;
  s1: number;
  sectionIndex: number;
  type: SectionRange['type'];
}

interface Placed {
  s0: number;
  s1: number;
  /** Clearance this group needs from anything else. */
  gap: number;
}

const TAU = Math.PI * 2;

function wrap(theta: number): number {
  let a = theta % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** The usable stretches of each section: inside its range, clear of both joins and of jump gaps. */
function usableSpans(track: CompiledTrack): Span[] {
  const spans: Span[] = [];
  for (const range of track.ranges) {
    if (range.type === 'jump') continue;
    const s0 = Math.max(range.s0 + PLACEMENT.joinMargin, PLACEMENT.startMargin);
    const s1 = range.s1 - PLACEMENT.joinMargin;
    if (s1 - s0 < PLACEMENT.ringSpacing * 2) continue;
    spans.push({ s0, s1, sectionIndex: range.index, type: range.type });
  }
  return spans;
}

/** Stretches of a span still free for a group of `length`, honouring every placed group's clearance. */
function freeIntervals(
  span: Span,
  placed: readonly Placed[],
  length: number,
  gap: number,
): { s0: number; s1: number }[] {
  const blocked = placed
    .map((p) => {
      const clear = Math.max(gap, p.gap);
      return { s0: p.s0 - clear, s1: p.s1 + clear };
    })
    .filter((b) => b.s1 > span.s0 && b.s0 < span.s1)
    .sort((a, b) => a.s0 - b.s0);
  const free: { s0: number; s1: number }[] = [];
  let cursor = span.s0;
  for (const b of blocked) {
    if (b.s0 - cursor >= length) free.push({ s0: cursor, s1: b.s0 });
    cursor = Math.max(cursor, b.s1);
  }
  if (span.s1 - cursor >= length) free.push({ s0: cursor, s1: span.s1 });
  return free;
}

/** Picks a span and a start point for a group of a given length, or null when nothing fits. */
function findSlot(
  rng: Rng,
  spans: readonly Span[],
  placed: readonly Placed[],
  length: number,
  gap: number,
  prefer?: (span: Span) => boolean,
): { span: Span; s0: number } | null {
  const options: { span: Span; s0: number; s1: number }[] = [];
  for (const span of spans) {
    for (const interval of freeIntervals(span, placed, length, gap)) {
      options.push({ span, s0: interval.s0, s1: interval.s1 });
    }
  }
  if (options.length === 0) return null;
  const preferred = prefer ? options.filter((o) => prefer(o.span)) : options;
  const list = preferred.length > 0 ? preferred : options;
  // Weight by free length so long empty stretches fill first.
  const total = list.reduce((sum, o) => sum + (o.s1 - o.s0 - length + 1), 0);
  let pick = rng() * total;
  for (const option of list) {
    const weight = option.s1 - option.s0 - length + 1;
    if (pick <= weight) {
      const s0 = option.s0 + rng() * (option.s1 - option.s0 - length);
      return { span: option.span, s0 };
    }
    pick -= weight;
  }
  const last = list[list.length - 1];
  return last ? { span: last.span, s0: last.s0 } : null;
}

/**
 * Generates the gameplay items for a track from a seed. The same track and seed always give the
 * same layout. Items keep clear of section joins and jump gaps, hazards get a clear run-in, and
 * gems hide on harder lines: the ceiling, a loop, or a tunnel wall.
 */
export function generateItems(track: CompiledTrack, seed: number): ItemLayout {
  const rng = createRng((seed * 7919 + Math.round(track.length * 10)) >>> 0);
  const spans = usableSpans(track);
  const items: Item[] = [];
  const placed: Placed[] = [];
  let nextId = 1;
  const push = (kind: ItemKind, s: number, theta: number, sectionIndex: number): void => {
    items.push({ id: nextId++, kind, s, theta: wrap(theta), sectionIndex });
  };
  if (spans.length === 0) return { seed, items, rings: 0, gems: 0 };

  // Hazards first: they need the most room, and rings are laid out around them.
  const hazardCount = Math.round((track.length / 100) * PLACEMENT.hazardsPer100m);
  for (let i = 0; i < hazardCount; i++) {
    const slot = findSlot(
      rng,
      spans,
      placed,
      1,
      PLACEMENT.hazardClear,
      (span) => span.type !== 'loop' && span.type !== 'corkscrew',
    );
    if (!slot) break;
    // Hazards sit at one of five lanes so there is always a clear line past them.
    const lane = Math.floor(rng() * 5) - 2;
    push('hazard', slot.s0, (lane * TAU) / 5, slot.span.sectionIndex);
    placed.push({ s0: slot.s0, s1: slot.s0 + 1, gap: PLACEMENT.hazardClear });
  }

  // Boost pads on the floor, on sections where a burst reads well.
  const boostCount = Math.round((track.length / 100) * PLACEMENT.boostsPer100m);
  for (let i = 0; i < boostCount; i++) {
    const slot = findSlot(
      rng,
      spans,
      placed,
      2,
      PLACEMENT.groupGap,
      (span) =>
        span.type === 'straight' ||
        span.type === 'hill' ||
        span.type === 'wave' ||
        span.type === 'return',
    );
    if (!slot) break;
    push('boost', slot.s0 + 1, 0, slot.span.sectionIndex);
    placed.push({ s0: slot.s0, s1: slot.s0 + 2, gap: PLACEMENT.groupGap });
  }

  // Gems: the ceiling of a loop, the wall of a tunnel, or a high line elsewhere.
  const hard = (span: Span): boolean => span.type === 'loop' || span.type === 'straight';
  let gems = 0;
  for (let i = 0; i < PLACEMENT.gems; i++) {
    const slot = findSlot(rng, spans, placed, 1, PLACEMENT.groupGap, hard);
    if (!slot) break;
    const side = rng() < 0.5 ? -1 : 1;
    const theta =
      slot.span.type === 'loop' ? Math.PI : side * (Math.PI * 0.62 + rng() * Math.PI * 0.25);
    push('gem', slot.s0, theta, slot.span.sectionIndex);
    placed.push({ s0: slot.s0, s1: slot.s0 + 1, gap: PLACEMENT.groupGap });
    gems++;
  }

  // Rings: lines and arcs until the track is comfortably full.
  let rings = 0;
  const target = Math.round(track.length / 9);
  for (let attempt = 0; attempt < 200 && rings < target; attempt++) {
    const count = 4 + Math.floor(rng() * 4);
    const length = (count - 1) * PLACEMENT.ringSpacing;
    const slot = findSlot(rng, spans, placed, length, PLACEMENT.groupGap);
    if (!slot) break;
    const arc = rng() < 0.45;
    const start = (Math.floor(rng() * 8) - 4) * (Math.PI / 6);
    const sweep = arc ? (rng() < 0.5 ? -1 : 1) * (Math.PI / 3 + rng() * (Math.PI / 2)) : 0;
    for (let k = 0; k < count; k++) {
      const t = count > 1 ? k / (count - 1) : 0;
      push('ring', slot.s0 + k * PLACEMENT.ringSpacing, start + sweep * t, slot.span.sectionIndex);
    }
    placed.push({ s0: slot.s0, s1: slot.s0 + length, gap: PLACEMENT.groupGap });
    rings += count;
  }

  items.sort((a, b) => a.s - b.s);
  return { seed, items, rings, gems };
}
