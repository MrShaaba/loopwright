import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface SplineSample {
  position: Vector3;
  /** Index of the control segment this sample lies on. */
  segment: number;
  /** Position within that segment, 0 to 1. */
  t: number;
  /** Arc length from the start. */
  s: number;
}

export interface ResampledSpline {
  samples: SplineSample[];
  length: number;
}

/** Fine subdivisions per control segment used to measure arc length. */
const SUBDIVISIONS = 8;
const DUPLICATE_DISTANCE = 1e-4;

function lerpTo(a: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

/** Centripetal Catmull-Rom (Barry-Goldman form) between p1 and p2. */
export function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const alpha = 0.5;
  const t0 = 0;
  const t1 = t0 + Math.pow(Vector3.Distance(p0, p1), alpha);
  const t2 = t1 + Math.pow(Vector3.Distance(p1, p2), alpha);
  const t3 = t2 + Math.pow(Vector3.Distance(p2, p3), alpha);
  const tt = t1 + (t2 - t1) * t;
  const a1 = lerpTo(p0, p1, (tt - t0) / (t1 - t0), new Vector3());
  const a2 = lerpTo(p1, p2, (tt - t1) / (t2 - t1), new Vector3());
  const a3 = lerpTo(p2, p3, (tt - t2) / (t3 - t2), new Vector3());
  const b1 = lerpTo(a1, a2, (tt - t0) / (t2 - t0), a1);
  const b2 = lerpTo(a2, a3, (tt - t1) / (t3 - t1), a3);
  return lerpTo(b1, b2, (tt - t1) / (t2 - t1), new Vector3());
}

/** Drops consecutive points that coincide, which would break the centripetal knots. Returns kept indices. */
export function dedupeIndices(points: readonly Vector3[], closed: boolean): number[] {
  const kept: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const previous = kept.length > 0 ? points[kept[kept.length - 1] ?? 0] : undefined;
    if (previous && Vector3.Distance(previous, point) < DUPLICATE_DISTANCE) {
      // Keep the later point: it carries the newer piece's attributes.
      kept[kept.length - 1] = i;
      continue;
    }
    kept.push(i);
  }
  if (closed && kept.length > 2) {
    const first = points[kept[0] ?? 0];
    const last = points[kept[kept.length - 1] ?? 0];
    if (first && last && Vector3.Distance(first, last) < DUPLICATE_DISTANCE) kept.pop();
  }
  return kept;
}

/**
 * Resamples a Catmull-Rom spline through `points` at a uniform arc-length `step`.
 * Open splines start and end exactly on the first and last points; closed ones wrap.
 */
export function resampleSpline(
  points: readonly Vector3[],
  closed: boolean,
  step: number,
): ResampledSpline {
  const n = points.length;
  if (n === 0) return { samples: [], length: 0 };
  if (n === 1) {
    const only = points[0] ?? Vector3.Zero();
    return { samples: [{ position: only.clone(), segment: 0, t: 0, s: 0 }], length: 0 };
  }
  const segments = closed ? n : n - 1;
  const control = (index: number): Vector3 => {
    if (closed) return points[((index % n) + n) % n] ?? Vector3.Zero();
    if (index < 0) {
      const a = points[0] ?? Vector3.Zero();
      const b = points[1] ?? a;
      return a.scale(2).subtract(b);
    }
    if (index >= n) {
      const a = points[n - 1] ?? Vector3.Zero();
      const b = points[n - 2] ?? a;
      return a.scale(2).subtract(b);
    }
    return points[index] ?? Vector3.Zero();
  };

  // Arc-length table: cumulative length at every subdivision of every segment.
  const cumulative = new Float64Array(segments * SUBDIVISIONS + 1);
  let total = 0;
  for (let i = 0; i < segments; i++) {
    const p0 = control(i - 1);
    const p1 = control(i);
    const p2 = control(i + 1);
    const p3 = control(i + 2);
    let previous = p1;
    for (let k = 1; k <= SUBDIVISIONS; k++) {
      const point = catmullRom(p0, p1, p2, p3, k / SUBDIVISIONS);
      total += Vector3.Distance(previous, point);
      cumulative[i * SUBDIVISIONS + k] = total;
      previous = point;
    }
  }

  const count = closed
    ? Math.max(4, Math.round(total / step))
    : Math.max(2, Math.round(total / step) + 1);
  const actualStep = closed ? total / count : total / (count - 1);
  const samples: SplineSample[] = [];
  let cursor = 0;
  const last = cumulative.length - 1;
  for (let j = 0; j < count; j++) {
    const s = Math.min(j * actualStep, total);
    while (cursor < last - 1 && (cumulative[cursor + 1] ?? total) < s) cursor++;
    const a = cumulative[cursor] ?? 0;
    const b = cumulative[cursor + 1] ?? total;
    const u = b > a ? (s - a) / (b - a) : 0;
    const segment = Math.min(Math.floor(cursor / SUBDIVISIONS), segments - 1);
    const t = Math.min(1, (cursor - segment * SUBDIVISIONS + u) / SUBDIVISIONS);
    const position = catmullRom(
      control(segment - 1),
      control(segment),
      control(segment + 1),
      control(segment + 2),
      t,
    );
    samples.push({ position, segment, t, s });
  }
  return { samples, length: total };
}
