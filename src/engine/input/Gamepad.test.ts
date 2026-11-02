import { describe, expect, it } from 'vitest';
import { applyDeadzone, GamepadInput, PAD, readPad, type PadLike } from './Gamepad';

function pad(axes: number[] = [0, 0, 0, 0], down: Record<number, number> = {}): PadLike {
  const buttons = Array.from({ length: 17 }, (_, index) => {
    const value = down[index] ?? 0;
    return { pressed: value > 0.5, value };
  });
  return { axes, buttons };
}

describe('gamepad reading', () => {
  it('ignores the stick inside the dead zone and rescales outside it', () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.18)).toBe(0);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(-1)).toBe(-1);
    expect(applyDeadzone(0.59)).toBeCloseTo(0.5, 2);
  });

  it('steers from the stick or the d-pad and reads the triggers as throttle', () => {
    expect(readPad(pad([0.8])).steer).toBeCloseTo(0.756, 2);
    expect(readPad(pad([0], { [PAD.dpadLeft]: 1 })).steer).toBe(-1);
    expect(readPad(pad([1], { [PAD.dpadLeft]: 1 })).steer).toBe(0);
    const reading = readPad(pad([0], { [PAD.rightTrigger]: 0.75, [PAD.leftTrigger]: 0.25 }));
    expect(reading.throttle).toBeCloseTo(0.5, 5);
    expect(readPad(pad([0], { [PAD.leftTrigger]: 1 })).throttle).toBe(-1);
  });

  it('reports boost and the held buttons by name', () => {
    const reading = readPad(pad([0], { [PAD.south]: 1, [PAD.start]: 1 }));
    expect(reading.boost).toBe(true);
    expect([...reading.held].sort()).toEqual(['south', 'start']);
    expect(readPad(pad()).boost).toBe(false);
  });

  it('survives a pad with fewer buttons than the standard layout', () => {
    const tiny: PadLike = { axes: [0.5], buttons: [{ pressed: true, value: 1 }] };
    const reading = readPad(tiny);
    expect(reading.boost).toBe(true);
    expect(reading.throttle).toBe(0);
    expect(reading.steer).toBeCloseTo(0.39, 2);
  });
});

describe('gamepad input', () => {
  it('fires a button once per press and turns throttle into multiplier steps', () => {
    let current: PadLike | null = pad([0], { [PAD.east]: 1 });
    const input = new GamepadInput(() => current);
    expect(input.poll(0.016)?.justPressed).toEqual(['east']);
    expect(input.poll(0.016)?.justPressed).toEqual([]);
    current = pad();
    expect(input.poll(0.016)?.justPressed).toEqual([]);
    current = pad([0], { [PAD.east]: 1 });
    expect(input.poll(0.016)?.justPressed).toEqual(['east']);

    current = pad([0], { [PAD.rightTrigger]: 1 });
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += input.poll(1 / 60)?.multiplierSteps ?? 0;
    // A full second at the throttle rate of 1.2 per second is twenty-four 0.05 steps.
    expect(steps).toBe(24);
    current = pad([0], { [PAD.leftTrigger]: 1 });
    expect(input.poll(0.1)?.multiplierSteps).toBe(-2);
  });

  it('returns null and forgets its state without a pad', () => {
    let current: PadLike | null = pad([0], { [PAD.south]: 1 });
    const input = new GamepadInput(() => current);
    expect(input.poll(0.016)?.justPressed).toEqual(['south']);
    current = null;
    expect(input.poll(0.016)).toBeNull();
    current = pad([0], { [PAD.south]: 1 });
    expect(input.poll(0.016)?.justPressed).toEqual(['south']);
  });
});
