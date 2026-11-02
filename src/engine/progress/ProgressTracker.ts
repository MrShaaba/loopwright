import { Emitter } from '../events';
import {
  addCollected,
  addLap,
  browserProgressStore,
  loadProgress,
  saveProgress,
  type LapRecord,
  type Progress,
  type ProgressStore,
} from './progress';
import { newlyUnlocked, type Unlockable } from './unlocks';

export interface ProgressEvents {
  progress: Progress;
  /** A skin or trail just came within reach. */
  unlock: Unlockable;
}

/** Keeps the lifetime totals current and saved, and announces anything they unlock. */
export class ProgressTracker {
  readonly events = new Emitter<ProgressEvents>();
  progress: Progress;

  constructor(private readonly store: ProgressStore = browserProgressStore) {
    this.progress = loadProgress(store);
  }

  /** Gems and rings count as soon as they are collected. */
  collect(gems: number, rings: number): void {
    if (gems <= 0 && rings <= 0) return;
    const before = this.progress.gems;
    this.progress = addCollected(this.progress, gems, rings);
    this.commit();
    for (const item of newlyUnlocked(before, this.progress.gems)) this.events.emit('unlock', item);
  }

  lap(record: LapRecord): void {
    this.progress = addLap(this.progress, record);
    this.commit();
  }

  private commit(): void {
    saveProgress(this.progress, this.store);
    this.events.emit('progress', this.progress);
  }

  dispose(): void {
    this.events.clear();
  }
}
