import type { CameraMode, CameraPreset } from '../engine/camera/CameraRig';
import { Game, type GameMode } from '../engine/Game';
import type { KeyBinding } from '../engine/input/Keys';
import { getTheme } from '../engine/theme';
import { listPieces } from '../engine/track/pieces';
import type { ParamValue } from '../engine/track/types';
import { build, type PaletteEntry } from './state/build.svelte';
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
  selectPiece: (pieceId: string | null) => void;
  setParam: (key: string, value: ParamValue) => void;
  place: () => void;
  removeLast: () => void;
  undo: () => void;
  redo: () => void;
  goToTrackEnd: () => void;
  dispose: () => void;
}

function paletteEntries(): PaletteEntry[] {
  return listPieces().map((def) => ({
    id: def.id,
    label: def.label,
    category: def.category,
    description: def.description,
    params: Object.entries(def.params).map(([key, param]) => ({
      key,
      label: param.label,
      options: param.options.map((value) => ({
        value,
        label: param.format ? param.format(value) : String(value),
      })),
    })),
  }));
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
    game.build.events.on('track', (summary) => {
      build.track = summary;
    }),
    game.build.events.on('selection', (selection) => {
      build.selectedId = selection.pieceId;
      build.params = selection.params;
      build.canPlace = selection.canPlace;
      build.reason = selection.reason ?? '';
    }),
    game.build.events.on('history', (history) => {
      build.canUndo = history.canUndo;
      build.canRedo = history.canRedo;
    }),
  ];
  build.palette = paletteEntries();
  game.build.publishAll();

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
    label: 'Close the shortcuts panel, or drop the piece selection',
    handler: () => {
      if (ui.helpOpen) ui.helpOpen = false;
      else game.build.select(null);
    },
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
    selectPiece: (pieceId) => game.build.select(pieceId),
    setParam: (key, value) => game.build.setParam(key, value),
    place: () => game.placePiece(),
    removeLast: () => {
      if (!game.build.removeLast()) game.toast('Nothing to remove');
    },
    undo: () => game.build.undo(),
    redo: () => game.build.redo(),
    goToTrackEnd: () => game.flyToTrackEnd(),
    dispose: () => {
      for (const off of unsubscribe) off();
      game.dispose();
    },
  };
}
