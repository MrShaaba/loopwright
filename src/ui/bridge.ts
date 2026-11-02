import type { CameraMode, CameraPreset } from '../engine/camera/CameraRig';
import { Game, type GameMode } from '../engine/Game';
import type { KeyBinding } from '../engine/input/Keys';
import { trackFromHash } from '../engine/save/codec';
import {
  hasSeenHowToPlay,
  loadPrefs,
  loadSavedTrack,
  markHowToPlaySeen,
  savePrefs,
} from '../engine/save/storage';
import type { Progress } from '../engine/progress/progress';
import { isUnlocked, nextUnlock } from '../engine/progress/unlocks';
import { BALL_SKINS } from '../engine/ride/skins';
import { TRAILS } from '../engine/ride/trails';
import { cssColor } from './skinPreview';
import { DEFAULT_STARTER_ID, getStarter, STARTERS } from '../engine/starters';
import { DEFAULT_THEME_ID, getTheme, hasTheme, listThemes } from '../engine/theme';
import type { ThemeConfig } from '../engine/theme/ThemeConfig';
import { listSectionDefs } from '../engine/track/sections';
import type { ParamValue, SectionType } from '../engine/track/sections/types';
import { edit } from './state/edit.svelte';
import { ui } from './state/game.svelte';
import { locker, type LockerTab } from './state/locker.svelte';
import { play } from './state/play.svelte';
import { ride } from './state/ride.svelte';

/** Everything a HUD component may ask the engine to do. */
export interface Controller {
  readonly presets: readonly CameraPreset[];
  readonly bindings: readonly KeyBinding[];
  readonly isMac: boolean;
  readonly starters: readonly { id: string; name: string; tagline: string }[];
  readonly themes: readonly { id: string; name: string; tagline: string }[];
  setTheme: (id: string) => void;
  rename: (name: string) => void;
  copyLink: () => Promise<void>;
  exportJson: () => void;
  importJson: (file: File) => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleCamera: () => void;
  flyTo: (presetId: string) => void;
  frameTrack: () => void;
  requestMode: (mode: GameMode) => void;
  takePhoto: () => void;
  toggleHelp: () => void;
  setMultiplier: (value: number) => void;
  nudgeMultiplier: (direction: 1 | -1) => void;
  togglePause: () => void;
  toggleMute: () => void;
  cycleView: () => void;
  toggleEndless: () => void;
  restartRide: () => void;
  steer: (input: number) => void;
  dismissSummary: () => void;
  openHowToPlay: () => void;
  closeHowToPlay: () => void;
  openLocker: () => void;
  closeLocker: () => void;
  toggleLocker: () => void;
  setLockerTab: (tab: LockerTab) => void;
  equipSkin: (id: string) => void;
  equipTrail: (id: string) => void;
  setPlayMode: (mode: 'game' | 'time' | 'cruise') => void;
  toggleItems: () => void;
  reshuffleItems: () => void;
  loadStarter: (id: string) => void;
  showIssue: (index: number) => void;
  selectSection: (id: string | null, focus?: boolean) => void;
  addSection: (type: SectionType) => void;
  removeSection: () => void;
  duplicateSection: () => void;
  moveSection: (delta: number) => void;
  setParam: (id: string, key: string, value: ParamValue) => void;
  beginDrag: (id: string, key: string) => void;
  previewParam: (id: string, key: string, value: ParamValue) => void;
  endDrag: (value?: ParamValue) => void;
  undo: () => void;
  redo: () => void;
  dispose: () => void;
}

declare global {
  interface Window {
    /** Dev-only handle for poking the engine from the browser console. */
    loopwright?: Game;
  }
}

function applyAccent(accent: { accent: string; accentSoft: string; accentText: string }): void {
  const root = document.documentElement.style;
  root.setProperty('--accent', accent.accent);
  root.setProperty('--accent-soft', accent.accentSoft);
  root.setProperty('--accent-text', accent.accentText);
}

function themeSummary(theme: ThemeConfig): typeof ui.theme {
  const { r, g, b } = theme.ball.color;
  return { id: theme.id, name: theme.name, tagline: theme.tagline, ball: [r, g, b] };
}

/** Rebuilds the locker's lists from the lifetime totals. */
function applyProgress(progress: Progress): void {
  locker.gems = progress.gems;
  locker.rings = progress.rings;
  locker.laps = progress.laps;
  locker.skins = BALL_SKINS.map((skin) => ({
    id: skin.id,
    name: skin.name,
    description: skin.description,
    cost: skin.cost,
    unlocked: isUnlocked(skin.cost, progress.gems),
    pattern: skin.pattern,
  }));
  locker.trails = TRAILS.map((trail) => {
    const p = trail.particles;
    const first = p ? (p.color === 'theme' ? ui.theme.ball : p.color) : null;
    const second = p ? (p.color2 ?? first) : null;
    return {
      id: trail.id,
      name: trail.name,
      description: trail.description,
      cost: trail.cost,
      unlocked: isUnlocked(trail.cost, progress.gems),
      swatch: first && second ? [cssColor(first), cssColor(second)] : null,
    };
  });
  const next = nextUnlock(progress.gems);
  locker.next = next
    ? { name: next.item.name, kind: next.item.kind, remaining: next.remaining }
    : null;
}

/** Boots the engine on the canvas and wires its events into the rune state. */
export async function bootGame(canvas: HTMLCanvasElement): Promise<Controller> {
  const starter = getStarter(DEFAULT_STARTER_ID);
  if (!starter) throw new Error('Missing starter track');
  const shared = trackFromHash(location.hash);
  const doc = shared ?? loadSavedTrack() ?? starter.doc;
  const prefs = loadPrefs();
  const theme = getTheme(hasTheme(doc.theme) ? doc.theme : DEFAULT_THEME_ID);
  applyAccent(theme.ui);
  ui.theme = themeSummary(theme);
  ui.phase = 'loading';

  const game = await Game.create(canvas, theme, doc, (progress) => {
    ui.progress = progress;
  });
  if (prefs.multiplier !== undefined) game.ride.setMultiplier(prefs.multiplier);
  if (prefs.muted) game.audio.setMuted(true);
  if (prefs.view) game.ride.setView(prefs.view);
  if (prefs.endless !== undefined) game.ride.setEndless(prefs.endless);
  if (prefs.playMode) game.setPlayMode(prefs.playMode);
  if (prefs.skin) game.setSkin(prefs.skin);
  if (prefs.trail) game.setTrail(prefs.trail);
  ui.track = game.summary();
  locker.skin = game.skinId;
  locker.trail = game.trailId;
  applyProgress(game.tracker.progress);

  const persistPrefs = (): void => {
    savePrefs({
      multiplier: game.ride.multiplier,
      muted: game.audio.muted,
      view: game.ride.camera.view,
      endless: game.ride.endless,
      playMode: game.game.mode,
      skin: game.skinId,
      trail: game.trailId,
    });
  };

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
      // The first ride in Game mode opens the how-to card and holds the ball until it is read.
      if (mode === 'ride' && game.game.mode === 'game' && !hasSeenHowToPlay()) openHowToPlay();
    }),
    game.events.on('toast', (text) => {
      ui.toast = { text, id: ui.toast.id + 1 };
    }),
    game.events.on('track', (summary) => {
      ui.track = summary;
      play.seed = summary.seed;
    }),
    game.events.on('reducedMotion', (reduced) => {
      ui.reducedMotion = reduced;
    }),
    game.events.on('theme', (next) => {
      applyAccent(next.ui);
      ui.theme = themeSummary(next);
      applyProgress(game.tracker.progress);
    }),
    game.events.on('cosmetics', ({ skin, trail }) => {
      locker.skin = skin;
      locker.trail = trail;
    }),
    game.tracker.events.on('progress', applyProgress),
    game.ride.events.on('status', (status) => {
      ride.speed = status.speed * 3.6;
      ride.baseSpeed = status.baseSpeed * 3.6;
      ride.multiplier = status.multiplier;
      ride.boost = status.boost;
      ride.paused = status.paused;
      ride.progress = status.progress;
      ride.laps = status.laps;
      ride.time = status.time;
      ride.muted = status.muted;
      ride.view = status.view;
      ride.gVertical = status.gVertical;
      ride.phase = status.phase;
      ride.endless = status.endless;
      ride.lapTime = status.lapTime;
      ride.lastLap = status.lastLap;
      ride.bestLap = status.bestLap;
    }),
  ];
  ride.multiplier = game.ride.multiplier;
  ride.muted = game.audio.muted;
  edit.defs = listSectionDefs().map((def) => ({
    type: def.type,
    label: def.label,
    description: def.description,
    params: def.params,
  }));
  const applyEdit = (summary: ReturnType<typeof game.edit.summary>): void => {
    edit.sections = summary.sections;
    edit.returnLength = summary.returnLength;
    edit.selectedId = summary.selectedId;
    edit.canUndo = summary.canUndo;
    edit.canRedo = summary.canRedo;
  };
  unsubscribe.push(game.edit.events.on('change', applyEdit));
  applyEdit(game.edit.summary());
  const applyValidation = (result: typeof game.validation): void => {
    edit.issues = result.issues.map(({ kind, severity, sectionIndex, message }) => ({
      kind,
      severity,
      sectionIndex,
      message,
    }));
    edit.ok = result.ok;
  };
  unsubscribe.push(game.events.on('validation', applyValidation));
  applyValidation(game.validation);
  const applyGame = (status: ReturnType<typeof game.game.status>): void => {
    play.mode = status.mode;
    play.score = status.score;
    play.combo = status.combo;
    play.bestCombo = status.bestCombo;
    play.rings = status.rings;
    play.ringsTotal = status.ringsTotal;
    play.gems = status.gems;
    play.gemsTotal = status.gemsTotal;
    play.valueFactor = status.valueFactor;
    play.topScore = status.topScore;
    play.band = status.band;
    play.bestLapTime = status.bestLapTime;
    play.ghostAvailable = status.ghostAvailable;
  };
  unsubscribe.push(game.game.events.on('status', applyGame));
  applyGame(game.game.status());
  play.showItems = game.game.showsInEditor;
  let summaryTimer: ReturnType<typeof setTimeout> | null = null;
  unsubscribe.push(
    game.game.events.on('summary', (summary) => {
      play.summary = summary;
      if (summaryTimer) clearTimeout(summaryTimer);
      // With Endless on the ride keeps going, so the card steps aside by itself.
      if (game.ride.endless) {
        summaryTimer = setTimeout(() => {
          play.summary = null;
        }, 5000);
      }
    }),
    game.ride.events.on('active', (active) => {
      if (!active) play.summary = null;
    }),
  );
  let splitTimer: ReturnType<typeof setTimeout> | null = null;
  let splitId = 0;
  unsubscribe.push(
    game.game.events.on('split', (split) => {
      play.split = { delta: split.delta, id: ++splitId };
      if (splitTimer) clearTimeout(splitTimer);
      splitTimer = setTimeout(() => {
        play.split = null;
      }, 2200);
    }),
  );
  let popId = 0;
  unsubscribe.push(
    game.events.on('pop', (pop) => {
      const id = ++popId;
      play.pops = [...play.pops.slice(-11), { id, ...pop }];
      setTimeout(() => {
        play.pops = play.pops.filter((p) => p.id !== id);
      }, 950);
    }),
  );

  const toggleHelp = (): void => {
    ui.helpOpen = !ui.helpOpen;
  };
  const openHowToPlay = (): void => {
    ui.howToOpen = true;
    game.ride.setPaused(true);
  };
  const closeHowToPlay = (): void => {
    if (!ui.howToOpen) return;
    ui.howToOpen = false;
    markHowToPlaySeen();
    game.ride.setPaused(false);
  };
  // The locker pauses a running ride and lets it go again when it closes.
  let lockerPaused = false;
  const openLocker = (): void => {
    if (locker.open) return;
    locker.open = true;
    ui.helpOpen = false;
    lockerPaused = game.mode === 'ride' && !game.ride.paused;
    if (lockerPaused) game.ride.setPaused(true);
  };
  const closeLocker = (): void => {
    if (!locker.open) return;
    locker.open = false;
    if (lockerPaused) game.ride.setPaused(false);
    lockerPaused = false;
  };
  const toggleLocker = (): void => {
    if (locker.open) closeLocker();
    else openLocker();
  };
  game.keys.bind({
    scope: 'global',
    combo: 'KeyL',
    label: 'Open the locker: skins, trails and achievements',
    handler: toggleLocker,
  });
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
    label: 'Close the shortcuts panel, or leave the ride',
    handler: () => {
      if (locker.open) closeLocker();
      else if (ui.howToOpen) closeHowToPlay();
      else if (ui.helpOpen) ui.helpOpen = false;
      else if (edit.addMenuOpen) edit.addMenuOpen = false;
      else if (edit.checksOpen) edit.checksOpen = false;
      else if (game.mode === 'ride') game.requestMode('edit');
      else game.edit.select(null);
    },
  });

  game.modalOpen = () => ui.howToOpen || locker.open;
  for (const combo of ['Enter', 'Space']) {
    game.keys.bind({
      scope: 'ride',
      combo,
      label: 'Close the how-to-play card',
      when: () => ui.howToOpen,
      handler: closeHowToPlay,
    });
  }
  game.start();
  ui.phase = 'ready';
  if (shared) game.toast(`Opened a shared track: ${shared.name}`);
  if (import.meta.env.DEV) window.loopwright = game;

  const download = (name: string, text: string, type: string): void => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const slug = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'track';

  return {
    presets: game.presets,
    bindings: game.bindings,
    isMac: /Mac|iPhone|iPad/i.test(navigator.userAgent),
    starters: STARTERS.map(({ id, name, tagline }) => ({ id, name, tagline })),
    themes: listThemes().map(({ id, name, tagline }) => ({ id, name, tagline })),
    setTheme: (id) => game.setTheme(id),
    rename: (name) => game.rename(name),
    copyLink: async () => {
      const link = game.shareLink();
      try {
        await navigator.clipboard.writeText(link);
        game.toast('Link copied. Anyone who opens it gets this track.');
      } catch {
        ui.toast = { text: link, id: ui.toast.id + 1 };
      }
    },
    exportJson: () => {
      download(`${slug(game.doc.name)}.loopwright.json`, game.exportJson(), 'application/json');
      game.toast('Track saved as JSON');
    },
    importJson: (file) => {
      file
        .text()
        .then((text) => {
          game.importJson(text);
        })
        .catch(() => game.toast('Could not read that file'));
    },
    setCameraMode: (mode) => game.setCameraMode(mode),
    toggleCamera: () => game.toggleCamera(),
    flyTo: (id) => game.flyTo(id),
    frameTrack: () => game.frameTrack(true),
    requestMode: (mode) => game.requestMode(mode),
    takePhoto: () => {
      game.takePhoto().catch((error: unknown) => {
        console.error(error);
        game.toast('Could not save the photo');
      });
    },
    toggleHelp,
    setMultiplier: (value) => {
      game.ride.setMultiplier(value);
      persistPrefs();
    },
    nudgeMultiplier: (direction) => {
      game.ride.nudgeMultiplier(direction);
      persistPrefs();
    },
    togglePause: () => {
      game.ride.togglePause();
    },
    toggleMute: () => {
      game.ride.toggleMute();
      persistPrefs();
    },
    cycleView: () => {
      game.ride.cycleView();
      persistPrefs();
    },
    toggleEndless: () => {
      game.ride.setEndless(!game.ride.endless);
      persistPrefs();
    },
    restartRide: () => {
      play.summary = null;
      game.ride.restart();
    },
    dismissSummary: () => {
      play.summary = null;
    },
    openHowToPlay,
    closeHowToPlay,
    openLocker,
    closeLocker,
    toggleLocker,
    setLockerTab: (tab) => {
      locker.tab = tab;
    },
    equipSkin: (id) => {
      if (game.setSkin(id)) persistPrefs();
    },
    equipTrail: (id) => {
      if (game.setTrail(id)) persistPrefs();
    },
    steer: (input) => game.ride.setSteer(input),
    setPlayMode: (mode) => {
      game.setPlayMode(mode);
      persistPrefs();
    },
    toggleItems: () => {
      game.game.setShowInEditor(!game.game.showsInEditor);
      play.showItems = game.game.showsInEditor;
    },
    reshuffleItems: () => {
      game.reshuffleItems();
      game.toast('New item layout');
    },
    loadStarter: (id) => {
      const found = getStarter(id);
      if (!found) return;
      game.loadDoc(found.doc);
      game.toast(`Loaded ${found.name}`);
    },
    showIssue: (index) => game.showIssue(index),
    selectSection: (id, focus = false) => {
      game.edit.select(id);
      if (id && focus) game.focusSection(id);
    },
    addSection: (type) => {
      const id = game.edit.add(type);
      game.focusSection(id);
    },
    removeSection: () => {
      if (!game.edit.remove()) game.toast('A track needs at least one section');
    },
    duplicateSection: () => {
      game.edit.duplicate();
    },
    moveSection: (delta) => {
      const selected = game.edit.selected;
      if (selected) game.edit.moveBy(selected.id, delta);
    },
    setParam: (id, key, value) => game.edit.setParam(id, key, value),
    beginDrag: (id, key) => game.edit.beginDrag(id, key),
    previewParam: (id, key, value) => game.edit.preview(id, key, value),
    endDrag: (value) => game.edit.endDrag(value),
    undo: () => {
      if (!game.edit.undo()) game.toast('Nothing to undo');
    },
    redo: () => {
      if (!game.edit.redo()) game.toast('Nothing to redo');
    },
    dispose: () => {
      for (const off of unsubscribe) off();
      game.dispose();
    },
  };
}
