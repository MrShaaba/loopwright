import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

export interface PerformanceSample {
  fps: number;
  /** Render scale relative to the base resolution; 1 is full, 2 is half on each axis. */
  scale: number;
}

const LEVELS = [1, 1.25, 1.5, 2] as const;

/**
 * Adaptive hardware scaling. Samples the smoothed frame rate once a second and steps
 * the render resolution down when it drops, back up once it has been comfortable for a while.
 */
export class PerformanceGovernor {
  auto = true;
  private index = 0;
  private readonly base: number;
  private accumulator = 0;
  private goodStreak = 0;
  private warmupSeconds = 3;

  constructor(
    private readonly engine: AbstractEngine,
    private readonly onSample: (sample: PerformanceSample) => void,
  ) {
    this.base = engine.getHardwareScalingLevel();
  }

  get scale(): number {
    return LEVELS[this.index] ?? 1;
  }

  update(dt: number): void {
    this.accumulator += dt;
    if (this.accumulator < 1) return;
    this.accumulator = 0;
    const fps = this.engine.getFps();
    if (this.auto) this.adjust(fps);
    this.onSample({ fps, scale: this.scale });
  }

  private adjust(fps: number): void {
    if (this.warmupSeconds > 0) {
      this.warmupSeconds--;
      return;
    }
    if (fps < 45 && this.index < LEVELS.length - 1) {
      this.index++;
      this.goodStreak = 0;
      this.apply();
    } else if (fps > 57) {
      this.goodStreak++;
      if (this.goodStreak >= 4 && this.index > 0) {
        this.index--;
        this.goodStreak = 0;
        this.apply();
      }
    } else {
      this.goodStreak = 0;
    }
  }

  private apply(): void {
    this.engine.setHardwareScalingLevel(this.base * this.scale);
  }
}
