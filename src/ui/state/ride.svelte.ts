import type { RideCameraMode } from '../../engine/camera/RideCameras';
import type { RidePhase } from '../../engine/ride/TrainPhysics';

export interface RideUiState {
  phase: RidePhase;
  /** km/h */
  speed: number;
  gVertical: number;
  gLateral: number;
  time: number;
  lap: number;
  camera: RideCameraMode;
  onChain: boolean;
  muted: boolean;
}

export const ride: RideUiState = $state({
  phase: 'idle',
  speed: 0,
  gVertical: 1,
  gLateral: 0,
  time: 0,
  lap: 0,
  camera: 'seat',
  onChain: false,
  muted: false,
});
