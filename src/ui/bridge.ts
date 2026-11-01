import type { CameraMode, CameraPreset } from '../engine/camera/CameraRig';
import { Game, type GameMode } from '../engine/Game';
import type { KeyBinding } from '../engine/input/Keys';
import { getTheme } from '../engine/theme';
import { ui } from './state/game.svelte';

/** Everything a HUD component may ask the engine to do. */
export interface Controller {
  readonly presets: readonly CameraPreset[];
  readonly bindings: readonly KeyBinding[];
  readonly isMac: boolean;
  setCameraMode: (mode: CameraMode) => void;
  toggleCamera: () => void;
  flyTo: (presetId: string) => void;
  requestMode: (mode: GameMode) => void;
  takePhoto: () => void;
  toggleHelp: () => void;
  toggleDock: () => void;
  dispose: () => void;
}

const DEFAULT_THEME = 'haunted-hollow';

declare global {
  interface Window {
    /** Dev-only handle for poking the engine from the browser console. */
    loopwright?: Game;
  }
}

/** Boots the engine on the canvas and wires its events into the rune state. */
export async function bootGame(canvas: HTMLCanvasElement): Promise<Controller> {
  const theme = getTheme(DEFAULT_THEME);
  ui.theme = { id: theme.id, name: theme.name, tagline: theme.tagline };
  ui.phase = 'loading';

  const game = await Game.create(canvas, theme, (progress) => {
    ui.progress = progress;
  });

  const unsubscribe = [
    game.events.on('performance', ({ fps, scale }) => {
      ui.fps = Math.round(fps);
      ui.renderScale = scale;
    }),
    game.events.on('cameraMode', (mode) => {
      ui.cameraMode = mode;
      if (mode === 'fly') {
        ui.toast = {
          text: 'Click the scene to look around. WASD moves, Q/E lowers and raises.',
          id: ui.toast.id + 1,
        };
      }
    }),
    game.events.on('mode', (mode) => {
      ui.mode = mode;
    }),
    game.events.on('toast', (text) => {
      ui.toast = { text, id: ui.toast.id + 1 };
    }),
  ];

  const toggleHelp = (): void => {
    ui.helpOpen = !ui.helpOpen;
  };
  game.keys.bind({
    scope: 'global',
    combo: 'shift+Slash',
    label: 'Show keyboard shortcuts',
    handler: toggleHelp,
  });
  game.keys.bind({
    scope: 'global',
    combo: 'KeyH',
    label: 'Show keyboard shortcuts',
    handler: toggleHelp,
  });
  game.keys.bind({
    scope: 'global',
    combo: 'Escape',
    label: 'Close the shortcuts panel',
    handler: () => {
      ui.helpOpen = false;
    },
    when: () => ui.helpOpen,
  });

  game.start();
  ui.phase = 'ready';
  if (import.meta.env.DEV) window.loopwright = game;

  return {
    presets: game.presets,
    bindings: game.bindings,
    isMac: /Mac|iPhone|iPad/i.test(navigator.userAgent),
    setCameraMode: (mode) => game.setCameraMode(mode),
    toggleCamera: () => game.toggleCamera(),
    flyTo: (id) => game.flyTo(id),
    requestMode: (mode) => game.requestMode(mode),
    takePhoto: () => {
      game.takePhoto().catch((error: unknown) => {
        console.error(error);
        game.toast('Could not save the photo');
      });
    },
    toggleHelp,
    toggleDock: () => {
      ui.dockOpen = !ui.dockOpen;
    },
    dispose: () => {
      for (const off of unsubscribe) off();
      game.dispose();
    },
  };
}
