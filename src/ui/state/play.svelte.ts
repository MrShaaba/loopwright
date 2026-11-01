import type { PlayMode } from '../../engine/game/GameController';

export interface Pop {
  id: number;
  kind: 'ring' | 'gem' | 'boost' | 'hazard' | 'miss';
  text: string;
  /** CSS pixels on the canvas. */
  x: number;
  y: number;
}

export interface PlayUiState {
  mode: PlayMode;
  score: number;
  combo: number;
  bestCombo: number;
  rings: number;
  ringsTotal: number;
  gems: number;
  gemsTotal: number;
  valueFactor: number;
  showItems: boolean;
  seed: number;
  pops: Pop[];
}

export const play: PlayUiState = $state({
  mode: 'game',
  score: 0,
  combo: 0,
  bestCombo: 0,
  rings: 0,
  ringsTotal: 0,
  gems: 0,
  gemsTotal: 0,
  valueFactor: 1,
  showItems: true,
  seed: 1,
  pops: [],
});
