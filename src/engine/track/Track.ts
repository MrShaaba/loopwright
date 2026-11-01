import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { buildReturn } from './autoClose';
import { buildFrames } from './frames';
import { makePose } from './pose';
import { defaultParams, getSectionDef, normaliseParams } from './sections';
import type { SectionParams, SectionType } from './sections/types';
import type { Pose, TrackFrame, TrackKey } from './types';

/** Every track starts here, heading +Z. The tube's bottom sits above the floor at y = 0. */
export const START_POSE: Pose = makePose(new Vector3(0, 3.2, 0), 0, 0);

export interface SectionSpec {
  type: SectionType;
  params: SectionParams;
}

export interface SectionRange {
  /** Index into the sections list; the return section uses `sections.length`. */
  index: number;
  type: SectionType | 'return';
  s0: number;
  s1: number;
  length: number;
  /** Highest and lowest tube centre along the section. */
  minY: number;
  maxY: number;
}

export interface CompiledTrack {
  frames: TrackFrame[];
  /** Total arc length in metres; the track is always closed. */
  length: number;
  ranges: SectionRange[];
  /** Exit pose of every section, including the return's. */
  exits: Pose[];
  returnLength: number;
}

export function createSection(type: SectionType, params: SectionParams = {}): SectionSpec {
  return { type, params: { ...defaultParams(type), ...params } };
}

/** Builds the closed track frames for a list of sections. Empty lists get a single straight. */
export function compileTrack(sections: readonly SectionSpec[]): CompiledTrack {
  const list = sections.length > 0 ? sections : [createSection('straight')];
  const keys: TrackKey[] = [];
  const exits: Pose[] = [];
  let pose = START_POSE;
  list.forEach((section, index) => {
    const def = getSectionDef(section.type);
    const geometry = def.build(pose, normaliseParams(section.type, section.params));
    for (const key of geometry.keys) keys.push({ ...key, sectionIndex: index, frame: def.frame });
    pose = geometry.exit;
    exits.push(pose);
  });
  const back = buildReturn(pose, START_POSE);
  for (const key of back.keys) keys.push({ ...key, sectionIndex: list.length, frame: 'gravity' });
  exits.push(back.exit);

  const frames = buildFrames(keys, true);
  const length = frames.length * 0.25;
  const ranges = sectionRanges(frames, list, length);
  return { frames, length, ranges, exits, returnLength: back.length };
}

function sectionRanges(
  frames: readonly TrackFrame[],
  sections: readonly SectionSpec[],
  length: number,
): SectionRange[] {
  const count = sections.length + 1;
  const ranges: SectionRange[] = [];
  for (let index = 0; index < count; index++) {
    const type = sections[index]?.type ?? 'return';
    ranges.push({ index, type, s0: 0, s1: 0, length: 0, minY: Infinity, maxY: -Infinity });
  }
  let current = -1;
  for (const frame of frames) {
    const range = ranges[frame.sectionIndex];
    if (!range) continue;
    if (frame.sectionIndex !== current) {
      range.s0 = frame.s;
      current = frame.sectionIndex;
    }
    range.s1 = frame.s;
    range.minY = Math.min(range.minY, frame.position.y);
    range.maxY = Math.max(range.maxY, frame.position.y);
  }
  for (const range of ranges) {
    if (range.minY === Infinity) {
      range.minY = 0;
      range.maxY = 0;
    }
    // The last range runs to the end of the loop, not to its last frame.
    range.s1 = range.index === count - 1 ? length : range.s1;
    range.length = Math.max(0, range.s1 - range.s0);
  }
  return ranges;
}

/** Index of the frame nearest to `s`, wrapping around the loop. */
export function frameIndexAt(track: CompiledTrack, s: number): number {
  const n = track.frames.length;
  if (n === 0) return 0;
  const wrapped = ((s % track.length) + track.length) % track.length;
  return Math.min(n - 1, Math.round(wrapped / 0.25)) % n;
}

/** Section index owning the frame nearest to a world point, by brute-force distance. */
export function sectionAtPoint(track: CompiledTrack, point: Vector3): number {
  let best = -1;
  let bestDistance = Infinity;
  for (const frame of track.frames) {
    const d = Vector3.DistanceSquared(frame.position, point);
    if (d < bestDistance) {
      bestDistance = d;
      best = frame.sectionIndex;
    }
  }
  return best;
}
