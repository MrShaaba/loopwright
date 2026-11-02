/** The slice of the Gamepad API the reader needs, so tests can feed plain objects. */
export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** Standard-layout button indices. */
export const PAD = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftTrigger: 6,
  rightTrigger: 7,
  select: 8,
  start: 9,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export type PadButton = keyof typeof PAD;

export interface PadReading {
  /** -1 left to 1 right, from the left stick or the d-pad. */
  steer: number;
  /** Right trigger minus left trigger, -1 to 1. */
  throttle: number;
  /** The south face button, held. */
  boost: boolean;
  /** Which named buttons are down. */
  held: ReadonlySet<PadButton>;
}

export const STICK_DEADZONE = 0.18;
/** How fast a fully pulled trigger moves the speed multiplier, per second. */
export const THROTTLE_RATE = 1.2;

/** Removes the dead zone and rescales so the first live reading starts at zero. */
export function applyDeadzone(value: number, deadzone = STICK_DEADZONE): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

function value(pad: PadLike, index: number): number {
  const button = pad.buttons[index];
  return button ? Math.max(0, Math.min(1, button.value)) : 0;
}

function pressed(pad: PadLike, index: number): boolean {
  return pad.buttons[index]?.pressed ?? false;
}

/** Reads one frame of a pad into steer, throttle, boost and held buttons. */
export function readPad(pad: PadLike): PadReading {
  const stick = applyDeadzone(pad.axes[0] ?? 0);
  const dpad = (pressed(pad, PAD.dpadRight) ? 1 : 0) - (pressed(pad, PAD.dpadLeft) ? 1 : 0);
  const steer = Math.max(-1, Math.min(1, stick + dpad));
  const throttle = value(pad, PAD.rightTrigger) - value(pad, PAD.leftTrigger);
  const held = new Set<PadButton>();
  for (const name of Object.keys(PAD) as PadButton[]) {
    if (pressed(pad, PAD[name])) held.add(name);
  }
  return { steer, throttle, boost: held.has('south'), held };
}

/**
 * Polls the first connected pad each frame and turns button presses into edges, so a press
 * fires once however long it is held. Throttle is accumulated into multiplier steps.
 */
export class GamepadInput {
  private previous = new Set<PadButton>();
  private throttleAccumulator = 0;

  constructor(private readonly source: () => PadLike | null = firstPad) {}

  /** The current reading plus buttons that went down this frame, or null with no pad. */
  poll(dt: number): (PadReading & { justPressed: PadButton[]; multiplierSteps: number }) | null {
    const pad = this.source();
    if (!pad) {
      this.previous = new Set();
      this.throttleAccumulator = 0;
      return null;
    }
    const reading = readPad(pad);
    const justPressed = [...reading.held].filter((name) => !this.previous.has(name));
    this.previous = new Set(reading.held);
    this.throttleAccumulator += reading.throttle * THROTTLE_RATE * dt;
    // A little slack so sixty sixtieths of a second add up to the whole step they should.
    const slack = Math.sign(this.throttleAccumulator) * 1e-6;
    const steps = Math.trunc(this.throttleAccumulator / 0.05 + slack);
    this.throttleAccumulator -= steps * 0.05;
    return { ...reading, justPressed, multiplierSteps: steps };
  }
}

/** The first connected pad, preferring the standard layout. */
export function firstPad(): PadLike | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  let fallback: Gamepad | null = null;
  for (const pad of navigator.getGamepads()) {
    if (!pad?.connected) continue;
    if (pad.mapping === 'standard') return pad;
    fallback ??= pad;
  }
  return fallback;
}

/** A short rumble, for a ring or a barrier. Quietly does nothing without haptics. */
export function rumble(strength: number, milliseconds: number): void {
  const pad = firstPad();
  const actuator = (pad as Gamepad | null)?.vibrationActuator;
  if (!actuator) return;
  try {
    void actuator.playEffect('dual-rumble', {
      duration: milliseconds,
      weakMagnitude: Math.min(1, strength),
      strongMagnitude: Math.min(1, strength * 0.4),
    });
  } catch {
    // Some browsers expose the actuator without supporting the effect.
  }
}
