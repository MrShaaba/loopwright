import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { coilMaxPitch } from '../track/sections/helix';
import { hillMaxPitch } from '../track/sections/hill';
import { numberParam } from '../track/sections/types';
import { waveMaxPitch } from '../track/sections/wave';
import type { CompiledTrack, SectionSpec } from '../track/Track';
import { TUBE_RADIUS } from '../tube/TubeView';
import { DEG } from '../util/math';

export type IssueKind =
  'too-steep' | 'underground' | 'crossing' | 'spiral-tight' | 'too-short' | 'too-long';

export interface Issue {
  kind: IssueKind;
  severity: 'error' | 'warning';
  /** Section index the issue points at; `sections.length` is the return, -1 is the whole track. */
  sectionIndex: number;
  message: string;
  /** Where to look in the scene, when the issue has a place. */
  position: Vector3 | null;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  errors: number;
  warnings: number;
}

export const LIMITS = {
  /** Metres around the loop. */
  minLength: 150,
  maxLength: 2500,
  /** Tube centre must stay this high above the floor. */
  floorClearance: TUBE_RADIUS + 0.1,
  /** Hills, waves and coils steeper than this get a warning. */
  steepDeg: 62,
  /** Two stretches of tube closer than this (centre to centre) cross. */
  crossingDistance: TUBE_RADIUS * 2 + 0.3,
  /** Frames closer than this along the track (7 m) are neighbours, not a crossing. */
  crossingSkip: 28,
} as const;

function sectionName(sections: readonly SectionSpec[], index: number): string {
  if (index >= sections.length) return 'the return section';
  return `section ${index + 1}`;
}

function midpoint(track: CompiledTrack, index: number): Vector3 | null {
  const range = track.ranges[index];
  if (!range) return null;
  const frame = track.frames[Math.round((range.s0 + range.s1) / 2 / 0.25)];
  return frame ? frame.position.clone() : null;
}

function checkLength(track: CompiledTrack, issues: Issue[]): void {
  if (track.length < LIMITS.minLength) {
    issues.push({
      kind: 'too-short',
      severity: 'error',
      sectionIndex: -1,
      message: `The track is ${Math.round(track.length)} m around; it needs at least ${LIMITS.minLength} m. Add a section or two.`,
      position: null,
    });
  } else if (track.length > LIMITS.maxLength) {
    issues.push({
      kind: 'too-long',
      severity: 'error',
      sectionIndex: -1,
      message: `The track is ${Math.round(track.length)} m around; ${LIMITS.maxLength} m is the most the ride handles. Shorten or remove a section.`,
      position: null,
    });
  }
}

function checkSteep(sections: readonly SectionSpec[], track: CompiledTrack, issues: Issue[]): void {
  sections.forEach((section, index) => {
    const p = section.params;
    let pitch = 0;
    switch (section.type) {
      case 'hill':
        pitch = hillMaxPitch(numberParam(p, 'height', 12), numberParam(p, 'length', 40));
        break;
      case 'wave':
        pitch = waveMaxPitch(
          numberParam(p, 'amplitude', 4),
          numberParam(p, 'length', 60),
          Math.round(numberParam(p, 'waves', 3)),
        );
        break;
      case 'helix':
        pitch = coilMaxPitch(numberParam(p, 'radius', 14), numberParam(p, 'climb', 6));
        break;
      case 'spiral':
        pitch = coilMaxPitch(numberParam(p, 'endRadius', 8), numberParam(p, 'climb', -4));
        break;
      case 'straight':
      case 'turn':
      case 'loop':
      case 'corkscrew':
      case 'jump':
        return;
    }
    if (pitch > LIMITS.steepDeg * DEG) {
      issues.push({
        kind: 'too-steep',
        severity: 'warning',
        sectionIndex: index,
        message: `${capitalise(sectionName(sections, index))} climbs at ${Math.round(pitch / DEG)}°, which is steeper than ${LIMITS.steepDeg}°. Make it longer or lower for a smoother ride.`,
        position: midpoint(track, index),
      });
    }
  });
}

function checkUnderground(
  sections: readonly SectionSpec[],
  track: CompiledTrack,
  issues: Issue[],
): void {
  const reported = new Set<number>();
  for (const frame of track.frames) {
    if (frame.position.y >= LIMITS.floorClearance) continue;
    const index = frame.sectionIndex;
    if (reported.has(index)) continue;
    reported.add(index);
    const depth = LIMITS.floorClearance - frame.position.y;
    const isReturn = index >= sections.length;
    const advice = isReturn
      ? 'Raise the end of the last section so the return has room to level out.'
      : 'Reduce the dive or raise the sections before it.';
    issues.push({
      kind: 'underground',
      severity: 'error',
      sectionIndex: index,
      message: `${capitalise(sectionName(sections, index))} goes ${depth.toFixed(1)} m underground. ${advice}`,
      position: frame.position.clone(),
    });
  }
}

/** Spatial hash over the frames; any two frames that are far apart along the track but close in space cross. */
function checkCrossing(
  sections: readonly SectionSpec[],
  track: CompiledTrack,
  issues: Issue[],
): void {
  const cell = LIMITS.crossingDistance;
  const buckets = new Map<string, number[]>();
  const key = (x: number, y: number, z: number): string =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  track.frames.forEach((frame, index) => {
    const k = key(frame.position.x, frame.position.y, frame.position.z);
    const list = buckets.get(k);
    if (list) list.push(index);
    else buckets.set(k, [index]);
  });
  const n = track.frames.length;
  const reported = new Set<number>();
  const limit2 = LIMITS.crossingDistance * LIMITS.crossingDistance;
  for (let i = 0; i < n; i += 2) {
    const frame = track.frames[i];
    if (!frame) continue;
    const cx = Math.floor(frame.position.x / cell);
    const cy = Math.floor(frame.position.y / cell);
    const cz = Math.floor(frame.position.z / cell);
    let hit = -1;
    for (let dx = -1; dx <= 1 && hit < 0; dx++) {
      for (let dy = -1; dy <= 1 && hit < 0; dy++) {
        for (let dz = -1; dz <= 1 && hit < 0; dz++) {
          const list = buckets.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!list) continue;
          for (const j of list) {
            const along = Math.min(Math.abs(i - j), n - Math.abs(i - j));
            if (along <= LIMITS.crossingSkip) continue;
            const other = track.frames[j];
            if (!other) continue;
            if (Vector3.DistanceSquared(frame.position, other.position) < limit2) {
              hit = j;
              break;
            }
          }
        }
      }
    }
    if (hit < 0) continue;
    const a = frame.sectionIndex;
    const b = track.frames[hit]?.sectionIndex ?? a;
    const index = Math.max(a, b);
    if (reported.has(index)) continue;
    reported.add(index);
    const other = a === b ? 'itself' : sectionName(sections, Math.min(a, b));
    issues.push({
      kind: 'crossing',
      severity: 'error',
      sectionIndex: index,
      message: `${capitalise(sectionName(sections, index))} runs through ${other}. Widen a turn, change a height or shorten a straight so the tube clears itself.`,
      position: frame.position.clone(),
    });
  }
}

function checkSpirals(
  sections: readonly SectionSpec[],
  track: CompiledTrack,
  issues: Issue[],
): void {
  sections.forEach((section, index) => {
    if (section.type !== 'spiral' && section.type !== 'helix') return;
    const p = section.params;
    const turns = numberParam(p, 'turns', 1);
    // Below a full turn the coil never passes over itself.
    if (turns < 1) return;
    const climb = Math.abs(numberParam(p, 'climb', 0));
    const radialGap =
      section.type === 'spiral'
        ? Math.abs(numberParam(p, 'startRadius', 24) - numberParam(p, 'endRadius', 8)) / turns
        : 0;
    const clearance = TUBE_RADIUS * 2 + 0.3;
    if (climb >= clearance || radialGap >= clearance) return;
    issues.push({
      kind: 'spiral-tight',
      severity: 'error',
      sectionIndex: index,
      message: `${capitalise(sectionName(sections, index))} is pitched too tight: its coils are ${Math.max(climb, radialGap).toFixed(1)} m apart and the tube needs ${clearance.toFixed(1)} m. Raise the climb per turn, use fewer turns or widen the radius.`,
      position: midpoint(track, index),
    });
  });
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ORDER: Record<IssueKind, number> = {
  'too-short': 0,
  'too-long': 0,
  underground: 1,
  crossing: 2,
  'spiral-tight': 3,
  'too-steep': 4,
};

/** Checks a compiled track. Errors block riding; warnings only advise. */
export function validateTrack(
  sections: readonly SectionSpec[],
  track: CompiledTrack,
): ValidationResult {
  const issues: Issue[] = [];
  checkLength(track, issues);
  checkUnderground(sections, track, issues);
  checkSpirals(sections, track, issues);
  // A spiral that is too tight always crosses itself; report it once, with the friendlier message.
  const tightSpirals = new Set(
    issues.filter((issue) => issue.kind === 'spiral-tight').map((issue) => issue.sectionIndex),
  );
  const crossings: Issue[] = [];
  checkCrossing(sections, track, crossings);
  for (const issue of crossings) if (!tightSpirals.has(issue.sectionIndex)) issues.push(issue);
  checkSteep(sections, track, issues);
  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    if (ORDER[a.kind] !== ORDER[b.kind]) return ORDER[a.kind] - ORDER[b.kind];
    return a.sectionIndex - b.sectionIndex;
  });
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return { ok: errors === 0, issues, errors, warnings: issues.length - errors };
}
