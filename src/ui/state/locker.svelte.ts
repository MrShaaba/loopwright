import type { SkinPattern } from '../../engine/ride/skins';

export type LockerTab = 'ball' | 'trail' | 'achievements';

export interface LockerItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  unlocked: boolean;
}

export interface LockerSkin extends LockerItem {
  pattern: SkinPattern;
}

export interface LockerTrail extends LockerItem {
  /** CSS colours for the card's swatch. */
  swatch: [string, string] | null;
}

export interface LockerState {
  open: boolean;
  tab: LockerTab;
  /** Lifetime gems, the currency. */
  gems: number;
  rings: number;
  laps: number;
  skins: LockerSkin[];
  trails: LockerTrail[];
  skin: string;
  trail: string;
  /** What the next gem unlocks, or null once everything is open. */
  next: { name: string; kind: string; remaining: number } | null;
}

export const locker: LockerState = $state({
  open: false,
  tab: 'ball',
  gems: 0,
  rings: 0,
  laps: 0,
  skins: [],
  trails: [],
  skin: 'lattice',
  trail: 'none',
  next: null,
});
