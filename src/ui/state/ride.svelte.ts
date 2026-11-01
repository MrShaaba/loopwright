import type { RideView } from '../../engine/camera/RideCamera';

export interface RideUiState {
  /** km/h, multiplier and boost included. */
  speed: number;
  /** km/h from physics alone. */
  baseSpeed: number;
  multiplier: number;
  boost: boolean;
  paused: boolean;
  progress: number;
  laps: number;
  time: number;
  muted: boolean;
  view: RideView;
}

export const ride: RideUiState = $state({
  speed: 0,
  baseSpeed: 0,
  multiplier: 1,
  boost: false,
  paused: false,
  progress: 0,
  laps: 0,
  time: 0,
  muted: false,
  view: 'inside',
});
