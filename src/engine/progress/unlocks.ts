import { BALL_SKINS, type BallSkin } from '../ride/skins';
import { TRAILS, type TrailStyle } from '../ride/trails';

export type UnlockKind = 'skin' | 'trail';

export interface Unlockable {
  kind: UnlockKind;
  id: string;
  name: string;
  cost: number;
}

/** Every skin and trail, cheapest first. */
export function listUnlockables(): Unlockable[] {
  const skins: Unlockable[] = BALL_SKINS.map((skin: BallSkin) => ({
    kind: 'skin',
    id: skin.id,
    name: skin.name,
    cost: skin.cost,
  }));
  const trails: Unlockable[] = TRAILS.map((trail: TrailStyle) => ({
    kind: 'trail',
    id: trail.id,
    name: trail.name,
    cost: trail.cost,
  }));
  return [...skins, ...trails].sort((a, b) => a.cost - b.cost);
}

/** An item is unlocked once the lifetime gem count reaches its cost. */
export function isUnlocked(cost: number, gems: number): boolean {
  return gems >= cost;
}

/** Items that `after` gems unlock which `before` gems did not, cheapest first. */
export function newlyUnlocked(before: number, after: number): Unlockable[] {
  return listUnlockables().filter((item) => item.cost > before && item.cost <= after);
}

/** The next locked item and how many gems it still needs, or null when everything is open. */
export function nextUnlock(gems: number): { item: Unlockable; remaining: number } | null {
  const item = listUnlockables().find((candidate) => candidate.cost > gems);
  return item ? { item, remaining: item.cost - gems } : null;
}
