/** Pure helpers for the music beds: note maths and the melody walk, testable without audio. */

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface DroneSpec {
  wave: Wave;
  /** Multipliers of the root for each layer, for example [0.5, 1] for an octave below and the root. */
  layers: number[];
  /** Spread between the two oscillators of each layer, cents. */
  detune: number;
  /** Low-pass cutoff, Hz. */
  cutoff: number;
  /** Slow sweep of the cutoff: rate in Hz and depth in Hz. */
  lfoRate: number;
  lfoDepth: number;
  gain: number;
}

export interface MelodySpec {
  wave: Wave;
  /** Seconds between notes, min and max. */
  interval: [number, number];
  /** Multiplier of the root, 2 for an octave up, 4 for two. */
  octave: number;
  attack: number;
  release: number;
  gain: number;
  /** Seconds a note slides from the previous pitch; 0 jumps. */
  glide: number;
  /** Echo delay in seconds; 0 for none. */
  echo: number;
}

export interface PulseSpec {
  bpm: number;
  wave: Wave;
  cutoff: number;
  gain: number;
  /** Semitone offsets per eighth note, -1 for a rest. */
  pattern: number[];
  decay: number;
}

/** A theme's ambient bed: a drone, a slow melody walk and an optional pulse. */
export interface MusicSpec {
  /** Root note, Hz. */
  root: number;
  /** Semitones above the root the melody may land on. */
  scale: number[];
  drone: DroneSpec;
  melody: MelodySpec;
  pulse?: PulseSpec;
}

export function noteFrequency(root: number, octave: number, semitones: number): number {
  return root * octave * Math.pow(2, semitones / 12);
}

/**
 * The next scale degree for the melody: mostly a step up or down, sometimes a leap, and never
 * the same note twice in a row when the scale has more than one note.
 */
export function nextDegree(
  scale: readonly number[],
  current: number,
  random: () => number,
): number {
  if (scale.length <= 1) return 0;
  const roll = random();
  let next: number;
  if (roll < 0.38) next = current + 1;
  else if (roll < 0.76) next = current - 1;
  else next = Math.floor(random() * scale.length);
  if (next < 0) next = 1;
  if (next >= scale.length) next = scale.length - 2;
  if (next === current) next = (current + 1) % scale.length;
  return next;
}

export function stepSeconds(bpm: number): number {
  return 60 / bpm / 2;
}

/** Validates a spec the way the beds rely on it. */
export function isPlayable(spec: MusicSpec): boolean {
  return (
    spec.root > 0 &&
    spec.scale.length > 0 &&
    spec.drone.layers.length > 0 &&
    spec.drone.gain > 0 &&
    spec.melody.interval[0] > 0 &&
    spec.melody.interval[1] >= spec.melody.interval[0] &&
    spec.melody.gain > 0 &&
    (spec.pulse === undefined ||
      (spec.pulse.bpm > 0 && spec.pulse.pattern.length > 0 && spec.pulse.gain > 0))
  );
}
