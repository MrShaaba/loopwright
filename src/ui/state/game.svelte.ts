import type { CameraMode } from '../../engine/camera/CameraRig';
import type { GameMode, LoadProgress } from '../../engine/Game';

export interface UiState {
  phase: 'loading' | 'ready' | 'error';
  progress: LoadProgress;
  error: string;
  mode: GameMode;
  cameraMode: CameraMode;
  fps: number;
  renderScale: number;
  theme: { id: string; name: string; tagline: string };
  helpOpen: boolean;
  dockOpen: boolean;
  toast: { text: string; id: number };
}

/** Rune state shared by every HUD component. Only the bridge writes engine-derived fields. */
export const ui: UiState = $state({
  phase: 'loading',
  progress: { step: 'Starting', fraction: 0 },
  error: '',
  mode: 'build',
  cameraMode: 'orbit',
  fps: 0,
  renderScale: 1,
  theme: { id: '', name: '', tagline: '' },
  helpOpen: false,
  dockOpen: typeof window === 'undefined' ? true : window.innerWidth > 900,
  toast: { text: '', id: 0 },
});
