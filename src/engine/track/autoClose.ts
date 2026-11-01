import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TAU, wrapAngle } from '../util/math';
import { autoBank, easedBank } from './bank';
import { Cursor } from './cursor';
import type { Pose, SectionGeometry } from './types';

/** Horizontal turn radius of the return section. */
export const RETURN_RADIUS = 14;
/** Below this the exit already sits on the start and no return keys are needed. */
const CLOSED_EPSILON = 0.05;
const FULL_TURN_EPSILON = 1e-6;

type Turn = 'left' | 'right';

export interface ReturnPlan {
  /** Path type as first turn, straight, second turn. */
  type: `${'L' | 'R'}S${'L' | 'R'}`;
  first: { direction: Turn; angle: number };
  straight: number;
  second: { direction: Turn; angle: number };
  /** Horizontal length of the whole return. */
  length: number;
}

function rightOf(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function positiveAngle(angle: number): number {
  let a = angle % TAU;
  if (a < 0) a += TAU;
  if (a > TAU - FULL_TURN_EPSILON) a = 0;
  return a;
}

/**
 * Shortest arc-straight-arc path (Dubins) in the horizontal plane from `exit` to `start`.
 * The two same-direction paths always exist; the two opposite-direction paths need the turn
 * circles to be at least a diameter apart.
 */
export function planReturn(exit: Pose, start: Pose, radius = RETURN_RADIUS): ReturnPlan {
  const yaw0 = exit.yaw;
  const yaw1 = start.yaw;
  const p0 = { x: exit.position.x, z: exit.position.z };
  const p1 = { x: start.position.x, z: start.position.z };
  const r0 = rightOf(yaw0);
  const r1 = rightOf(yaw1);
  const centre = (p: { x: number; z: number }, r: { x: number; z: number }, dir: Turn) => {
    const sign = dir === 'right' ? 1 : -1;
    return { x: p.x + sign * radius * r.x, z: p.z + sign * radius * r.z };
  };

  let best: ReturnPlan | null = null;
  const combos: [Turn, Turn][] = [
    ['right', 'right'],
    ['left', 'left'],
    ['right', 'left'],
    ['left', 'right'],
  ];
  for (const [d0, d1] of combos) {
    const c0 = centre(p0, r0, d0);
    const c1 = centre(p1, r1, d1);
    const dx = c1.x - c0.x;
    const dz = c1.z - c0.z;
    const distance = Math.hypot(dx, dz);
    const psi = Math.atan2(dx, dz);
    let headingS: number;
    let straight: number;
    if (d0 === d1) {
      headingS = psi;
      straight = distance;
    } else {
      if (distance < 2 * radius) continue;
      const offset = Math.asin((2 * radius) / distance);
      headingS = d0 === 'right' ? psi + offset : psi - offset;
      straight = Math.sqrt(Math.max(0, distance * distance - 4 * radius * radius));
    }
    const angle0 = positiveAngle(d0 === 'right' ? headingS - yaw0 : yaw0 - headingS);
    const angle1 = positiveAngle(d1 === 'right' ? yaw1 - headingS : headingS - yaw1);
    const length = radius * (angle0 + angle1) + straight;
    if (!best || length < best.length) {
      best = {
        type: `${d0 === 'right' ? 'R' : 'L'}S${d1 === 'right' ? 'R' : 'L'}`,
        first: { direction: d0, angle: angle0 },
        straight,
        second: { direction: d1, angle: angle1 },
        length,
      };
    }
  }
  if (!best) throw new Error('No return path');
  return best;
}

/** Cubic Hermite height profile over horizontal distance that matches both end pitches. */
export function heightProfile(
  y0: number,
  pitch0: number,
  y1: number,
  pitch1: number,
  horizontal: number,
): (h: number) => number {
  const H = Math.max(horizontal, 1e-6);
  const m0 = Math.tan(pitch0) * H;
  const m1 = Math.tan(pitch1) * H;
  return (h) => {
    const t = Math.min(1, Math.max(0, h / H));
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1
    );
  };
}

/** True when the exit already matches the start closely enough to need no return keys. */
export function isClosedAt(exit: Pose, start: Pose): boolean {
  return (
    Vector3.Distance(exit.position, start.position) < CLOSED_EPSILON &&
    Math.abs(wrapAngle(exit.yaw - start.yaw)) < 1e-3 &&
    Math.abs(exit.pitch - start.pitch) < 1e-3
  );
}

/**
 * The return section: the shortest Dubins path back to the start with eased banking through
 * its arcs and a smooth height blend that honours the exit pitch.
 */
export function buildReturn(exit: Pose, start: Pose, radius = RETURN_RADIUS): SectionGeometry {
  if (isClosedAt(exit, start)) {
    return {
      keys: [],
      exit: { position: start.position.clone(), yaw: start.yaw, pitch: start.pitch },
      length: 0,
    };
  }
  const plan = planReturn(exit, start, radius);
  const cursor = new Cursor({ position: exit.position.clone(), yaw: exit.yaw, pitch: 0 });
  const turnBank = (direction: Turn, angle: number): ((t: number) => number) => {
    // Short arcs get proportionally less bank so the view does not snap.
    const scale = Math.min(1, angle / (Math.PI / 3));
    return easedBank(autoBank(radius, direction) * scale);
  };
  if (plan.first.angle > 1e-6) {
    cursor.turn(radius, (plan.first.angle * 180) / Math.PI, plan.first.direction, {
      bank: turnBank(plan.first.direction, plan.first.angle),
    });
  }
  if (plan.straight > 1e-6) cursor.straight(plan.straight);
  if (plan.second.angle > 1e-6) {
    cursor.turn(radius, (plan.second.angle * 180) / Math.PI, plan.second.direction, {
      bank: turnBank(plan.second.direction, plan.second.angle),
    });
  }
  const horizontal = cursor.horizontalLength;
  cursor.reshapeHeights(
    heightProfile(exit.position.y, exit.pitch, start.position.y, start.pitch, horizontal),
  );
  const geometry = cursor.finish();
  // Snap the final key onto the start so the closed spline meets itself exactly.
  const last = geometry.keys[geometry.keys.length - 1];
  if (last) last.position.copyFrom(start.position);
  geometry.exit = { position: start.position.clone(), yaw: start.yaw, pitch: start.pitch };
  return geometry;
}
