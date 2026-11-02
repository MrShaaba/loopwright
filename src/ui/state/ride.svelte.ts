import type { RideView } from '../../engine/camera/RideCamera';
import type { RidePhase } from '../../engine/ride/BallPhysics';

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
  volume: number;
  music: boolean;
  view: RideView;
  gVertical: number;
  phase: RidePhase;
  endless: boolean;
  lapTime: number;
  lastLap: number;
  bestLap: number | null;
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
  volume: 0.8,
  music: false,
  view: 'inside',
  gVertical: 1,
  phase: 'running',
  endless: false,
  lapTime: 0,
  lastLap: 0,
  bestLap: null,
});
