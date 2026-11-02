import type { CameraMode } from '../../engine/camera/CameraRig';
import type { GameMode, LoadProgress, TrackSummary } from '../../engine/Game';
import type { Rgb } from '../../engine/ride/skins';
import type { ModelCredit } from '../../engine/scenic/manifest';

export interface UiState {
  phase: 'loading' | 'ready' | 'error';
  progress: LoadProgress;
  error: string;
  mode: GameMode;
  cameraMode: CameraMode;
  fps: number;
  renderScale: number;
  theme: { id: string; name: string; tagline: string; ball: Rgb };
  track: TrackSummary;
  helpOpen: boolean;
  howToOpen: boolean;
  reducedMotion: boolean;
  toast: { text: string; id: number; kind?: 'achievement'; title?: string };
  /** The active Scenic World, or null while a theme shows. */
  world: { id: string; name: string; skyId: string | null; credits: ModelCredit[] } | null;
  scenicLoading: { name: string; fraction: number } | null;
  creditsOpen: boolean;
  /** Every model credit from the manifest, for the credits panel. */
  credits: ModelCredit[];
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
  theme: { id: '', name: '', tagline: '', ball: [1, 1, 1] },
  track: { name: '', length: 0, sections: 0, seed: 1 },
  helpOpen: false,
  howToOpen: false,
  reducedMotion: false,
  toast: { text: '', id: 0 },
  world: null,
  scenicLoading: null,
  creditsOpen: false,
  credits: [],
});
