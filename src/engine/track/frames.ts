import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { smoothstep, wrapAngle } from '../util/math';
import { dedupeIndices, resampleSpline } from './spline';
import type { TrackFrame, TrackKey } from './types';

export const FRAME_STEP = 0.25;
const UP = Vector3.Up();

/** Normal that points as close to world up as the tangent allows; null when the tangent is vertical. */
export function gravityNormal(tangent: Vector3): Vector3 | null {
  const n = UP.subtract(tangent.scale(Vector3.Dot(UP, tangent)));
  const len = n.length();
  if (len < 1e-3) return null;
  return n.scale(1 / len);
}

/**
 * Builds evenly spaced frames from the model's keys.
 *
 * 1. Centripetal Catmull-Rom through the keys, resampled every 0.25 m.
 * 2. Tangents by central difference.
 * 3. Rotation-minimising frames by the double-reflection method.
 * 4. Up vectors: gravity-framed keys bank against world up; transport-framed runs
 *    (loops) follow the minimised frames with a gentle twist to meet both ends.
 */
export function buildFrames(
  keys: readonly TrackKey[],
  closed: boolean,
  step = FRAME_STEP,
): TrackFrame[] {
  const kept = dedupeIndices(
    keys.map((k) => k.position),
    closed,
  );
  const ordered = kept.map((i) => keys[i]).filter((k): k is TrackKey => k !== undefined);
  if (ordered.length < 2) return [];

  const { samples, length } = resampleSpline(
    ordered.map((k) => k.position),
    closed,
    step,
  );
  const count = samples.length;
  if (count < 2) return [];

  const positions = samples.map((s) => s.position);
  const at = (i: number): Vector3 => {
    if (closed) return positions[((i % count) + count) % count] ?? Vector3.Zero();
    return positions[Math.min(count - 1, Math.max(0, i))] ?? Vector3.Zero();
  };

  const tangents: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = at(i + 1).subtract(at(i - 1));
    if (t.lengthSquared() < 1e-12) t.copyFrom(i > 0 ? (tangents[i - 1] ?? UP) : UP);
    tangents.push(t.normalize());
  }

  // Rotation-minimising frames (Wang et al. 2008, double reflection).
  const normals: Vector3[] = [];
  let normal = gravityNormal(tangents[0] ?? UP) ?? Vector3.Right();
  normals.push(normal);
  for (let i = 0; i < count - 1; i++) {
    const t0 = tangents[i] ?? UP;
    const t1 = tangents[i + 1] ?? UP;
    const v1 = (positions[i + 1] ?? Vector3.Zero()).subtract(positions[i] ?? Vector3.Zero());
    const c1 = Vector3.Dot(v1, v1);
    if (c1 < 1e-12) {
      normals.push(normal.clone());
      continue;
    }
    const rL = normal.subtract(v1.scale((2 / c1) * Vector3.Dot(v1, normal)));
    const tL = t0.subtract(v1.scale((2 / c1) * Vector3.Dot(v1, t0)));
    const v2 = t1.subtract(tL);
    const c2 = Vector3.Dot(v2, v2);
    normal = c2 < 1e-12 ? rL : rL.subtract(v2.scale((2 / c2) * Vector3.Dot(v2, rL)));
    // Re-orthogonalise against drift.
    normal = normal.subtract(t1.scale(Vector3.Dot(normal, t1))).normalize();
    normals.push(normal);
  }

  // Per-sample attributes from the key segment each sample sits on.
  const keyCount = ordered.length;
  const frames: TrackFrame[] = [];
  const modes: ('gravity' | 'transport')[] = [];
  for (let i = 0; i < count; i++) {
    const sample = samples[i];
    const tangent = tangents[i] ?? UP;
    if (!sample) continue;
    const k0 = ordered[sample.segment] ?? ordered[keyCount - 1];
    const k1 = ordered[(sample.segment + 1) % keyCount] ?? k0;
    if (!k0 || !k1) continue;
    const sameSection = k1.sectionIndex === k0.sectionIndex;
    const bank = k0.bank + wrapAngle(k1.bank - k0.bank) * sample.t;
    const t1 = sameSection ? k1.t : 1;
    const t = k0.t + (t1 - k0.t) * sample.t;
    modes.push(k0.frame);
    frames.push({
      s: sample.s,
      position: sample.position,
      tangent,
      up: UP.clone(),
      right: Vector3.Right(),
      curvature: 0,
      bank,
      sectionIndex: k0.sectionIndex,
      t,
      flags: k0.flags,
    });
  }

  // Gravity-framed up vectors.
  for (let i = 0; i < count; i++) {
    const frame = frames[i];
    if (!frame || modes[i] !== 'gravity') continue;
    const n = gravityNormal(frame.tangent) ?? normals[i] ?? UP;
    const r = Vector3.Cross(n, frame.tangent).normalize();
    frame.up = n
      .scale(Math.cos(frame.bank))
      .add(r.scale(Math.sin(frame.bank)))
      .normalize();
  }

  // Transport-framed runs.
  const angleIn = (i: number): number => {
    const frame = frames[i];
    const n = normals[i];
    if (!frame || !n) return 0;
    const b = Vector3.Cross(n, frame.tangent);
    return Math.atan2(Vector3.Dot(frame.up, b), Vector3.Dot(frame.up, n));
  };
  let i = 0;
  while (i < count) {
    if (modes[i] !== 'transport') {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < count && modes[end + 1] === 'transport') end++;
    const entryIndex = i > 0 ? i - 1 : closed ? count - 1 : -1;
    const exitIndex = end + 1 < count ? end + 1 : closed ? 0 : -1;
    const phiEntry = entryIndex >= 0 && modes[entryIndex] === 'gravity' ? angleIn(entryIndex) : 0;
    const phiExit =
      exitIndex >= 0 && modes[exitIndex] === 'gravity' ? angleIn(exitIndex) : phiEntry;
    const delta = wrapAngle(phiExit - phiEntry);
    const span = end - i + 2;
    for (let j = i; j <= end; j++) {
      const frame = frames[j];
      const n = normals[j];
      if (!frame || !n) continue;
      const phi = phiEntry + delta * smoothstep(0, 1, (j - i + 1) / span);
      const b = Vector3.Cross(n, frame.tangent);
      frame.up = n
        .scale(Math.cos(phi))
        .add(b.scale(Math.sin(phi)))
        .normalize();
    }
    i = end + 1;
  }

  // Right vectors, re-orthogonalised up, curvature.
  for (let j = 0; j < count; j++) {
    const frame = frames[j];
    if (!frame) continue;
    frame.right = Vector3.Cross(frame.up, frame.tangent).normalize();
    frame.up = Vector3.Cross(frame.tangent, frame.right).normalize();
    const prev = tangents[closed ? (j - 1 + count) % count : Math.max(0, j - 1)] ?? frame.tangent;
    const next = tangents[closed ? (j + 1) % count : Math.min(count - 1, j + 1)] ?? frame.tangent;
    const span = closed ? 2 * step : (Math.min(count - 1, j + 1) - Math.max(0, j - 1)) * step;
    frame.curvature = span > 0 ? next.subtract(prev).length() / span : 0;
  }

  void length;
  return frames;
}
