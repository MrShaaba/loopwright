import type { CameraMode } from '../../engine/camera/CameraRig';
import type { GameMode, LoadProgress, TrackSummary } from '../../engine/Game';

export interface UiState {
  phase: 'loading' | 'ready' | 'error';
  progress: LoadProgress;
  error: string;
  mode: GameMode;
  cameraMode: CameraMode;
  fps: number;
  renderScale: number;
  theme: { id: string; name: string; tagline: string };
  track: TrackSummary;
  helpOpen: boolean;
  howToOpen: boolean;
  reducedMotion: boolean;
  toast: { text: string; id: number };
}

/** Rune state shared by every HUD component. Only the bridge writes engine-derived fields. */
export const ui: UiState = $state({
  phase: 'loading',
  progress: { step: 'Starting', fraction: 0 },
  error: '',
  mode: 'edit',
  cameraMode: 'orbit',
  fps: 0,
  renderScale: 1,
  theme: { id: '', name: '', tagline: '' },
  track: { name: '', length: 0, sections: 0, seed: 1 },
  helpOpen: false,
  howToOpen: false,
  reducedMotion: false,
  toast: { text: '', id: 0 },
});
