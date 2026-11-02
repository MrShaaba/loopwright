import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { TrailParticles } from '../ride/trails';
import type {
  BallStyle,
  FloorConfig,
  FogConfig,
  LightingConfig,
  PropConfig,
  SkyConfig,
  TubeStyle,
  UiAccent,
} from '../theme/ThemeConfig';

/** A skybox model a world can wear; the first in a world's list is its default. */
export interface SkyVariant {
  id: string;
  name: string;
  file: string;
}

/** A model placed far off as set dressing. */
export interface SceneryPlacement {
  file: string;
  /** Where the model's centre goes. */
  position: [number, number, number];
  /** Metres across its longest side after fitting. */
  size: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  /** Pixel size for point-cloud models. */
  pointSize: number;
}

/** A terrain model stretched under the track. */
export interface TerrainPlacement {
  file: string;
  /** Metres kept between the terrain's highest point and the lowest point of the tube. */
  clearance: number;
  /** Metres the terrain reaches beyond the track's footprint on every side. */
  margin: number;
}

/** A soft glow at the sun that swells on crests. */
export interface SunFlare {
  color: Color3;
  azimuthDeg: number;
  elevationDeg: number;
  /** Apparent size in metres at the sky distance. */
  size: number;
}

/** The look a world paints over the track. The same fields a theme has, minus a procedural sky. */
export interface WorldLook {
  /** Procedural sky for worlds without a skybox model. */
  sky: SkyConfig | null;
  fog: FogConfig;
  lighting: LightingConfig;
  /** Null draws no ground at all. */
  floor: FloorConfig | null;
  tube: TubeStyle;
  ball: BallStyle;
  ui: UiAccent;
  props?: PropConfig;
  /** Whether the tube's supports and feet show; space has nothing to stand on. */
  supports: boolean;
  /** Brightness multiplier for the skybox texture. */
  skyLevel: number;
  flare?: SunFlare;
  /** A trail the world adds to the ball on top of whatever is equipped. */
  ballTrail?: TrailParticles;
}

export type WorldStatus = 'ready' | 'placeholder';

export interface ScenicWorld {
  id: string;
  name: string;
  tagline: string;
  status: WorldStatus;
  skies: SkyVariant[];
  scenery: SceneryPlacement | null;
  terrain: TerrainPlacement | null;
  look: WorldLook;
}

const SPACE_FOG = new Color3(0.01, 0.008, 0.02);

/** Soft holographic glass for space, where there is nothing behind it to compete. */
const spaceTube: TubeStyle = {
  tint: new Color3(0.22, 0.38, 0.72),
  edge: new Color3(0.62, 0.82, 1.0),
  streak: new Color3(0.9, 0.95, 1.0),
  intensity: 0.85,
  support: new Color3(0.2, 0.23, 0.32),
  tunnel: new Color3(0.03, 0.03, 0.06),
};

const nebulaDrift: ScenicWorld = {
  id: 'nebula-drift',
  name: 'Nebula Drift',
  tagline: 'Adrift in a nebula, with dust in the light and a sun that flares on every crest.',
  status: 'ready',
  skies: [
    { id: 'nebula-2', name: 'Nebula II', file: 'alien-space-nebula-2.glb' },
    { id: 'nebula-1', name: 'Nebula I', file: 'alien-space-nebula-1.glb' },
  ],
  scenery: null,
  terrain: null,
  look: {
    sky: null,
    fog: { color: SPACE_FOG, density: 0.0004 },
    lighting: {
      key: {
        azimuthDeg: 40,
        elevationDeg: 28,
        color: new Color3(1.0, 0.72, 0.9),
        intensity: 1.3,
        shadows: false,
      },
      fill: {
        sky: new Color3(0.3, 0.18, 0.42),
        ground: new Color3(0.06, 0.03, 0.1),
        intensity: 0.9,
      },
      glow: 0.9,
      exposure: 1.05,
      contrast: 1.1,
      vignette: 1.4,
    },
    floor: null,
    tube: spaceTube,
    ball: { color: new Color3(0.98, 0.78, 1.0), light: 1.4 },
    ui: { accent: '#d29bff', accentSoft: 'rgba(210, 155, 255, 0.16)', accentText: '#f0dcff' },
    props: {
      weather: {
        kind: 'dust',
        color: new Color3(0.9, 0.78, 1.0),
        rate: 90,
        size: [0.05, 0.14],
        speed: [0.15, 0.5],
      },
    },
    supports: false,
    skyLevel: 1.05,
    flare: {
      color: new Color3(1.0, 0.82, 0.95),
      azimuthDeg: 40,
      elevationDeg: 28,
      size: 160,
    },
  },
};

const deepField: ScenicWorld = {
  id: 'deep-field',
  name: 'Deep Field',
  tagline: 'Black space and old starlight, with a comet tail behind the ball.',
  status: 'ready',
  skies: [{ id: 'deep-space', name: 'Deep Space', file: 'deep-space.glb' }],
  scenery: {
    file: 'need-some-space.glb',
    position: [-340, 120, 520],
    size: 360,
    yaw: 0.6,
    pointSize: 2,
  },
  terrain: null,
  look: {
    sky: null,
    fog: { color: new Color3(0.005, 0.006, 0.012), density: 0.0002 },
    lighting: {
      key: {
        azimuthDeg: 300,
        elevationDeg: 40,
        color: new Color3(0.82, 0.88, 1.0),
        intensity: 1.4,
        shadows: false,
      },
      fill: {
        sky: new Color3(0.16, 0.2, 0.34),
        ground: new Color3(0.02, 0.02, 0.05),
        intensity: 0.8,
      },
      glow: 1.0,
      exposure: 1.1,
      contrast: 1.12,
      vignette: 1.6,
    },
    floor: null,
    tube: {
      ...spaceTube,
      tint: new Color3(0.18, 0.3, 0.58),
      edge: new Color3(0.82, 0.92, 1.0),
      intensity: 1.15,
    },
    // Pale gold against a white tube and a sky full of starlight.
    ball: { color: new Color3(1.0, 0.86, 0.6), light: 1.6 },
    ui: { accent: '#9fd4ff', accentSoft: 'rgba(159, 212, 255, 0.16)', accentText: '#dff0ff' },
    props: {
      weather: {
        kind: 'dust',
        color: new Color3(0.8, 0.88, 1.0),
        rate: 40,
        size: [0.04, 0.1],
        speed: [0.05, 0.25],
      },
    },
    supports: false,
    skyLevel: 0.85,
    ballTrail: {
      sprite: 'disc',
      color: [0.75, 0.88, 1.0],
      color2: [0.95, 0.98, 1.0],
      rate: 110,
      life: [0.5, 0.9],
      size: [0.4, 0.7],
      endSize: 0.08,
      power: [0.3, 1.0],
      spread: 0.12,
      gravity: 0,
      alpha: 0.5,
      drift: 'behind',
    },
  },
};

const FAR_SHORE_HAZE = new Color3(0.58, 0.4, 0.3);

const farShore: ScenicWorld = {
  id: 'far-shore',
  name: 'Far Shore',
  tagline: 'A low alien horizon under a warm sun, with haze over the flats.',
  status: 'ready',
  skies: [{ id: 'alien-planet', name: 'Alien planet', file: 'alien-planet-landscape.glb' }],
  scenery: null,
  terrain: null,
  look: {
    sky: null,
    fog: { color: FAR_SHORE_HAZE, density: 0.0013 },
    lighting: {
      key: {
        azimuthDeg: 60,
        elevationDeg: 18,
        color: new Color3(1.0, 0.8, 0.55),
        intensity: 2.2,
        shadows: false,
      },
      fill: {
        sky: new Color3(0.5, 0.36, 0.3),
        ground: new Color3(0.16, 0.09, 0.06),
        intensity: 0.9,
      },
      glow: 0.8,
      exposure: 1.0,
      contrast: 1.12,
      vignette: 1.6,
    },
    // The painted ground of the skybox is the shore; a flat plane would cut its horizon in two.
    floor: null,
    tube: {
      tint: new Color3(0.16, 0.34, 0.62),
      edge: new Color3(0.45, 0.85, 1.0),
      streak: new Color3(0.85, 0.96, 1.0),
      intensity: 1.15,
      support: new Color3(0.22, 0.16, 0.14),
      tunnel: new Color3(0.06, 0.035, 0.025),
    },
    ball: { color: new Color3(0.5, 0.95, 1.0), light: 1.6 },
    ui: { accent: '#ffb070', accentSoft: 'rgba(255, 176, 112, 0.18)', accentText: '#ffe0c2' },
    supports: true,
    skyLevel: 1.0,
  },
};

const SNOW_FOG = new Color3(0.42, 0.48, 0.62);

const snowfield: ScenicWorld = {
  id: 'snowfield',
  name: 'Snowfield',
  tagline: 'Real snowy ground rolling under the tube, snow in the air and a cold moon.',
  status: 'ready',
  skies: [],
  scenery: null,
  terrain: { file: 'snowy-terrain.glb', clearance: 1.2, margin: 420 },
  look: {
    sky: {
      horizon: SNOW_FOG,
      band: new Color3(0.3, 0.36, 0.5),
      zenith: new Color3(0.03, 0.04, 0.09),
      starDensity: 0.025,
      bandStrength: 0.4,
      moons: [
        {
          azimuthDeg: 300,
          elevationDeg: 38,
          angularSizeDeg: 3.6,
          tint: new Color3(0.95, 0.97, 1.0),
          glow: new Color3(0.35, 0.42, 0.6),
        },
      ],
    },
    fog: { color: SNOW_FOG, density: 0.0032 },
    lighting: {
      key: {
        azimuthDeg: 300,
        elevationDeg: 38,
        color: new Color3(0.76, 0.84, 1.0),
        intensity: 2.0,
        shadows: false,
      },
      fill: {
        sky: new Color3(0.34, 0.4, 0.56),
        ground: new Color3(0.2, 0.22, 0.28),
        intensity: 0.9,
      },
      glow: 0.9,
      exposure: 1.1,
      contrast: 1.1,
      vignette: 1.8,
    },
    floor: null,
    tube: {
      tint: new Color3(0.16, 0.3, 0.52),
      edge: new Color3(0.6, 0.85, 1.0),
      streak: new Color3(0.9, 0.97, 1.0),
      intensity: 1.05,
      support: new Color3(0.78, 0.84, 0.94),
      tunnel: new Color3(0.05, 0.055, 0.08),
    },
    ball: { color: new Color3(1.0, 0.72, 0.4), light: 1.6 },
    ui: { accent: '#9fd4ff', accentSoft: 'rgba(159, 212, 255, 0.16)', accentText: '#dff0ff' },
    props: {
      weather: {
        kind: 'snow',
        color: new Color3(0.92, 0.95, 1.0),
        rate: 260,
        size: [0.07, 0.16],
        speed: [1.4, 2.4],
      },
    },
    supports: true,
    skyLevel: 1.0,
  },
};

/** A slot kept open for a haunted model: the picker shows it, greyed out, until a file arrives. */
const haunted: ScenicWorld = {
  id: 'haunted',
  name: 'Haunted',
  tagline: 'Waiting for a model. Add the file to the manifest and point this slot at it.',
  status: 'placeholder',
  skies: [],
  scenery: null,
  terrain: null,
  look: snowfield.look,
};

export const SCENIC_WORLDS: readonly ScenicWorld[] = [
  nebulaDrift,
  deepField,
  farShore,
  snowfield,
  haunted,
];

export function getWorld(id: string): ScenicWorld | null {
  return SCENIC_WORLDS.find((world) => world.id === id) ?? null;
}

/** Worlds that can be entered today. */
export function readyWorlds(): ScenicWorld[] {
  return SCENIC_WORLDS.filter((world) => world.status === 'ready');
}

/** Every model file a world needs, with the chosen sky variant first. */
export function worldFiles(world: ScenicWorld, skyId?: string): string[] {
  const files: string[] = [];
  const sky = world.skies.find((variant) => variant.id === skyId) ?? world.skies[0];
  if (sky) files.push(sky.file);
  if (world.scenery) files.push(world.scenery.file);
  if (world.terrain) files.push(world.terrain.file);
  return files;
}

/** The ready world after `id`, or null to go back to no world; null leads to the first. */
export function nextWorldId(id: string | null): string | null {
  const worlds = readyWorlds();
  if (id === null) return worlds[0]?.id ?? null;
  const index = worlds.findIndex((world) => world.id === id);
  return worlds[index + 1]?.id ?? null;
}
