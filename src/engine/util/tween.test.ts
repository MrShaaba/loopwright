import { describe, expect, it } from 'vitest';
import { Tweens, easeInOutCubic, easeOutCubic, easeOutQuint, linear } from './tween';

describe('easing', () => {
  it.each([
    ['linear', linear],
    ['easeOutCubic', easeOutCubic],
    ['easeInOutCubic', easeInOutCubic],
    ['easeOutQuint', easeOutQuint],
  ])('%s starts at 0, ends at 1 and never goes backwards', (_name, ease) => {
    expect(ease(0)).toBeCloseTo(0, 10);
    expect(ease(1)).toBeCloseTo(1, 10);
    let previous = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = v;
    }
  });
});

describe('Tweens', () => {
  it('drives a tween to completion and calls onComplete once', () => {
    const tweens = new Tweens();
    const values: number[] = [];
    let completed = 0;
    tweens.start({
      duration: 1,
      ease: linear,
      onUpdate: (k) => values.push(k),
      onComplete: () => completed++,
    });
    for (let i = 0; i < 12; i++) tweens.update(0.1);
    expect(values.at(-1)).toBe(1);
    expect(completed).toBe(1);
    expect(tweens.active).toBe(0);
  });

  it('stops updating a cancelled tween', () => {
    const tweens = new Tweens();
    let calls = 0;
    const handle = tweens.start({ duration: 1, onUpdate: () => calls++ });
    tweens.update(0.1);
    handle.cancel();
    tweens.update(0.1);
    expect(calls).toBe(1);
    expect(handle.done).toBe(true);
  });

  it('completes a zero-length tween on the first update', () => {
    const tweens = new Tweens();
    let last = -1;
    tweens.start({ duration: 0, onUpdate: (k) => (last = k) });
    tweens.update(0.016);
    expect(last).toBe(1);
  });
});
