import { fbm2, hash2 } from '../util/noise';
import { smoothstep } from '../util/math';

/** Linear colour channels, 0 to 1. Plain tuples so the UI can paint previews without Babylon. */
export type Rgb = readonly [number, number, number];

export type SkinPattern =
  | 'lattice'
  | 'meridian'
  | 'honeycomb'
  | 'ember'
  | 'orbit'
  | 'nova'
  | 'pulsar'
  | 'prism'
  | 'eclipse';

/** A ball skin. Every skin takes the theme's ball colour, so it fits any world. */
export interface BallSkin {
  id: string;
  name: string;
  description: string;
  /** Gems collected across all tracks needed to unlock it. */
  cost: number;
  pattern: SkinPattern;
}

export const BALL_SKINS: readonly BallSkin[] = [
  {
    id: 'lattice',
    name: 'Lattice',
    description: 'A bright dotted lattice on a soft glow. The one you start with.',
    cost: 0,
    pattern: 'lattice',
  },
  {
    id: 'meridian',
    name: 'Meridian',
    description: 'Twelve bands from pole to pole, so every roll shows.',
    cost: 3,
    pattern: 'meridian',
  },
  {
    id: 'honeycomb',
    name: 'Honeycomb',
    description: 'Glowing seams between dim hexagonal cells.',
    cost: 6,
    pattern: 'honeycomb',
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'A dark crust split by bright veins of light.',
    cost: 10,
    pattern: 'ember',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Three thin rings around a quiet core, with caps at both poles.',
    cost: 15,
    pattern: 'orbit',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Sixteen rays bursting out from the equator.',
    cost: 20,
    pattern: 'nova',
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    description: 'Ripples spreading from two opposite points.',
    cost: 30,
    pattern: 'pulsar',
  },
  {
    id: 'prism',
    name: 'Prism',
    description: 'Facets that each lean the colour a different way.',
    cost: 40,
    pattern: 'prism',
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    description: 'Almost dark, with one blazing ring of light.',
    cost: 50,
    pattern: 'eclipse',
  },
];

export const DEFAULT_SKIN_ID = 'lattice';

export function getSkin(id: string): BallSkin {
  return BALL_SKINS.find((skin) => skin.id === id) ?? BALL_SKINS[0]!;
}

export interface Pixel {
  r: number;
  g: number;
  b: number;
}

const TAU = Math.PI * 2;

/** Angular distance in radians between two points on the unit sphere given as texture coordinates. */
function angleBetween(u: number, v: number, u2: number, v2: number): number {
  const phi = (v - 0.5) * Math.PI;
  const phi2 = (v2 - 0.5) * Math.PI;
  const theta = u * TAU;
  const theta2 = u2 * TAU;
  const dot =
    Math.cos(phi) * Math.cos(theta) * Math.cos(phi2) * Math.cos(theta2) +
    Math.sin(phi) * Math.sin(phi2) +
    Math.cos(phi) * Math.sin(theta) * Math.cos(phi2) * Math.sin(theta2);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/** Rotates a colour's hue by `degrees` without touching its brightness much. */
function hueShift(color: Rgb, degrees: number): Rgb {
  const [r, g, b] = color;
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Rotation about the grey axis (1, 1, 1) / sqrt 3.
  const k = 1 / 3;
  const s = Math.sqrt(1 / 3);
  const m = [
    cos + k * (1 - cos),
    k * (1 - cos) - s * sin,
    k * (1 - cos) + s * sin,
    k * (1 - cos) + s * sin,
    cos + k * (1 - cos),
    k * (1 - cos) - s * sin,
    k * (1 - cos) - s * sin,
    k * (1 - cos) + s * sin,
    cos + k * (1 - cos),
  ];
  return [
    Math.max(0, m[0]! * r + m[1]! * g + m[2]! * b),
    Math.max(0, m[3]! * r + m[4]! * g + m[5]! * b),
    Math.max(0, m[6]! * r + m[7]! * g + m[8]! * b),
  ];
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

/**
 * Distance to the nearest edge of a hexagonal grid in the plane, in cell units. Centres sit one
 * unit apart on two interleaved rows, so the pattern repeats every unit along x.
 */
function hexEdge(x: number, y: number): number {
  const sy = Math.sqrt(3);
  const ax = mod(x, 1) - 0.5;
  const ay = mod(y, sy) - sy / 2;
  const bx = mod(x - 0.5, 1) - 0.5;
  const by = mod(y - sy / 2, sy) - sy / 2;
  const near = ax * ax + ay * ay < bx * bx + by * by;
  const vx = Math.abs(near ? ax : bx);
  const vy = Math.abs(near ? ay : by);
  const hexDistance = Math.max(vx, vx * 0.5 + vy * 0.8660254);
  return Math.max(0, 0.5 - hexDistance);
}

/**
 * Brightness factor of a skin at texture coordinates `u` (around) and `v` (top to bottom),
 * from about 0.1 (dark) to about 1.4 (brighter than the base colour). Pure, so the texture
 * painter and the locker preview agree pixel for pixel.
 */
export function skinFactor(pattern: SkinPattern, u: number, v: number): number {
  switch (pattern) {
    case 'lattice': {
      const cells = 8;
      const cu = u * cells - Math.floor(u * cells) - 0.5;
      const cv = v * cells - Math.floor(v * cells) - 0.5;
      const dot = smoothstep(0.34, 0.2, Math.hypot(cu, cv));
      const band = smoothstep(0.06, 0.02, Math.abs(cv)) * 0.35;
      return 0.28 + 1.1 * Math.max(dot, band);
    }
    case 'meridian': {
      const band = Math.abs(((u * 12 + 0.5) % 1) - 0.5);
      return 0.3 + 1.05 * smoothstep(0.3, 0.42, band);
    }
    case 'honeycomb': {
      const edge = hexEdge(u * 6, v * 3.2);
      return 0.26 + 1.1 * smoothstep(0.1, 0.03, edge);
    }
    case 'ember': {
      const n = fbm2(u * 6, v * 3, 17, 4, 2, 0.5, 6);
      const veins = smoothstep(0.09, 0.01, Math.abs(n - 0.5));
      return 0.16 + 1.25 * veins;
    }
    case 'orbit': {
      let f = 0.3;
      for (const ring of [0.3, 0.5, 0.7]) f += 1.1 * smoothstep(0.03, 0.008, Math.abs(v - ring));
      const cap = smoothstep(0.1, 0.03, Math.min(v, 1 - v));
      return Math.min(1.4, f + cap);
    }
    case 'nova': {
      const ray = Math.pow(Math.abs(Math.sin(u * 16 * Math.PI)), 10);
      return 0.24 + 1.15 * ray * Math.sin(v * Math.PI);
    }
    case 'pulsar': {
      const d = Math.min(angleBetween(u, v, 0.25, 0.5), angleBetween(u, v, 0.75, 0.5));
      const ripple = smoothstep(0.2, 0.04, Math.abs(((d * 2.2 + 0.5) % 1) - 0.5));
      return 0.26 + 1.1 * ripple * (1 - d / Math.PI) + 0.2 * smoothstep(0.5, 0, d);
    }
    case 'prism': {
      const cx = Math.floor(u * 8);
      const cy = Math.floor(v * 4);
      const brightness = 0.55 + 0.75 * hash2(cx, cy, 5);
      const gx = Math.abs(((u * 8 + 0.5) % 1) - 0.5);
      const gy = Math.abs(((v * 4 + 0.5) % 1) - 0.5);
      const grout = smoothstep(0.04, 0.0, Math.min(gx, gy));
      return brightness * (1 - 0.85 * grout);
    }
    case 'eclipse': {
      const d = angleBetween(u, v, 0, 0.5);
      const ring = smoothstep(0.12, 0.02, Math.abs(d - 1.1));
      const glow = smoothstep(1.6, 1.1, d) * 0.22;
      return 0.08 + 1.25 * ring + glow;
    }
  }
}

/** The colour of a skin at `u`, `v` for a base colour, written into `out`. */
export function skinPixel(pattern: SkinPattern, u: number, v: number, base: Rgb, out: Pixel): void {
  const f = skinFactor(pattern, u, v);
  let color = base;
  if (pattern === 'prism') {
    const shift = (hash2(Math.floor(u * 8), Math.floor(v * 4), 9) - 0.5) * 110;
    color = hueShift(base, shift);
  }
  out.r = color[0] * f;
  out.g = color[1] * f;
  out.b = color[2] * f;
}
