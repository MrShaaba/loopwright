/** A recorded lap: where the ball was at each moment, and when it entered each section. */
export interface GhostRecording {
  /** Lap time in seconds. */
  lapTime: number;
  /** Times, arc lengths and angles, in step with each other. */
  times: number[];
  positions: number[];
  thetas: number[];
  /** Lap time at which each section was entered, by section index; -1 when never entered. */
  splits: number[];
}

export interface GhostSample {
  s: number;
  theta: number;
}

/** Seconds between recorded samples: ten a second is plenty to replay a smooth ghost. */
export const GHOST_INTERVAL = 0.1;
const TAU = Math.PI * 2;

function wrapAngle(theta: number): number {
  let a = theta % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** Records one lap at a steady interval. `record` is called every frame; only some calls keep a sample. */
export class GhostRecorder {
  private times: number[] = [];
  private positions: number[] = [];
  private thetas: number[] = [];
  private splits: number[];
  private lastSection = -1;

  constructor(sectionCount: number) {
    this.splits = new Array<number>(sectionCount).fill(-1);
  }

  reset(sectionCount: number): void {
    this.times = [];
    this.positions = [];
    this.thetas = [];
    this.splits = new Array<number>(sectionCount).fill(-1);
    this.lastSection = -1;
  }

  record(time: number, s: number, theta: number, sectionIndex: number): void {
    if (sectionIndex !== this.lastSection) {
      if (
        sectionIndex >= 0 &&
        sectionIndex < this.splits.length &&
        this.splits[sectionIndex] === -1
      ) {
        this.splits[sectionIndex] = time;
      }
      this.lastSection = sectionIndex;
    }
    const last = this.times[this.times.length - 1];
    if (last !== undefined && time - last < GHOST_INTERVAL) return;
    this.times.push(time);
    this.positions.push(s);
    this.thetas.push(theta);
  }

  get sampleCount(): number {
    return this.times.length;
  }

  /** The finished lap. Always ends with a sample at the lap time so playback reaches the line. */
  finish(lapTime: number, trackLength: number): GhostRecording {
    const times = [...this.times];
    const positions = [...this.positions];
    const thetas = [...this.thetas];
    const last = times[times.length - 1];
    if (last === undefined || last < lapTime) {
      times.push(lapTime);
      positions.push(trackLength);
      thetas.push(thetas[thetas.length - 1] ?? 0);
    }
    return {
      lapTime,
      times: times.map((t) => Number(t.toFixed(3))),
      positions: positions.map((p) => Number(p.toFixed(2))),
      thetas: thetas.map((t) => Number(t.toFixed(3))),
      splits: this.splits.map((t) => (t < 0 ? -1 : Number(t.toFixed(3)))),
    };
  }
}

/** Where the ghost was at lap time `t`, interpolated; clamps to the first and last samples. */
export function sampleGhost(recording: GhostRecording, t: number): GhostSample {
  const { times, positions, thetas } = recording;
  const n = times.length;
  if (n === 0) return { s: 0, theta: 0 };
  const first = times[0] ?? 0;
  if (t <= first) return { s: positions[0] ?? 0, theta: thetas[0] ?? 0 };
  const lastTime = times[n - 1] ?? 0;
  if (t >= lastTime) return { s: positions[n - 1] ?? 0, theta: thetas[n - 1] ?? 0 };
  // Binary search for the sample pair around t.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? 0) <= t) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo] ?? 0;
  const t1 = times[hi] ?? t0;
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const s0 = positions[lo] ?? 0;
  const s1 = positions[hi] ?? s0;
  const th0 = thetas[lo] ?? 0;
  const th1 = thetas[hi] ?? th0;
  return {
    s: s0 + (s1 - s0) * f,
    theta: wrapAngle(th0 + wrapAngle(th1 - th0) * f),
  };
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** Reads a recording from untrusted JSON, or null. */
export function parseGhost(raw: unknown): GhostRecording | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.lapTime !== 'number' || !Number.isFinite(r.lapTime) || r.lapTime <= 0) return null;
  if (!isNumberArray(r.times) || !isNumberArray(r.positions) || !isNumberArray(r.thetas))
    return null;
  if (!isNumberArray(r.splits)) return null;
  if (r.times.length !== r.positions.length || r.times.length !== r.thetas.length) return null;
  if (r.times.length < 2) return null;
  return {
    lapTime: r.lapTime,
    times: r.times,
    positions: r.positions,
    thetas: r.thetas,
    splits: r.splits,
  };
}
