export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint: Ease = (t) => 1 - Math.pow(1 - t, 5);

export interface TweenOptions {
  /** Seconds. */
  duration: number;
  ease?: Ease;
  /** Receives the eased progress in [0, 1]. */
  onUpdate: (k: number) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  readonly done: boolean;
  cancel(): void;
}

class TweenRun implements TweenHandle {
  done = false;
  private elapsed = 0;
  private readonly ease: Ease;

  constructor(private readonly options: TweenOptions) {
    this.ease = options.ease ?? easeInOutCubic;
  }

  step(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const duration = Math.max(this.options.duration, 1e-6);
    const t = Math.min(1, this.elapsed / duration);
    this.options.onUpdate(this.ease(t));
    if (t >= 1) {
      this.done = true;
      this.options.onComplete?.();
    }
  }

  cancel(): void {
    this.done = true;
  }
}

/** A tiny tween scheduler driven by the render loop. Camera fly-tos and UI-driven moves use it. */
export class Tweens {
  private readonly runs = new Set<TweenRun>();

  start(options: TweenOptions): TweenHandle {
    const run = new TweenRun(options);
    this.runs.add(run);
    return run;
  }

  update(dt: number): void {
    for (const run of this.runs) {
      run.step(dt);
      if (run.done) this.runs.delete(run);
    }
  }

  cancelAll(): void {
    for (const run of this.runs) run.cancel();
    this.runs.clear();
  }

  get active(): number {
    return this.runs.size;
  }
}
