import { speedBand } from '../save/scores';
import { isCleanLap, isPerfectLap, type LapRecord, type Progress } from './progress';

const ACHIEVEMENTS_KEY = 'loopwright.achievements.v1';

export interface Achievement {
  id: string;
  name: string;
  description: string;
}

/** What a rule can look at: the lap that just ended, if any, and the lifetime totals after it. */
export interface AchievementContext {
  lap: LapRecord | null;
  progress: Progress;
  /** How many themes exist, for the world tour. */
  themeCount: number;
}

interface Rule extends Achievement {
  test: (context: AchievementContext) => boolean;
}

const gameLap = (context: AchievementContext): LapRecord | null =>
  context.lap?.mode === 'game' ? context.lap : null;

const RULES: readonly Rule[] = [
  {
    id: 'first-gem',
    name: 'First Light',
    description: 'Collect your first gem.',
    test: ({ progress }) => progress.gems >= 1,
  },
  {
    id: 'first-lap',
    name: 'Around Once',
    description: 'Finish a lap in any mode.',
    test: ({ progress }) => progress.laps >= 1,
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    description: 'Collect every ring on a track in one lap.',
    test: (context) => {
      const lap = gameLap(context);
      return lap !== null && lap.ringsTotal > 0 && lap.stats.rings === lap.ringsTotal;
    },
  },
  {
    id: 'unbroken',
    name: 'Unbroken',
    description: 'A perfect combo lap: every ring, not one miss.',
    test: ({ lap }) => lap !== null && isPerfectLap(lap),
  },
  {
    id: 'untouched',
    name: 'Untouched',
    description: 'Get past every barrier on a track without a hit.',
    test: ({ lap }) => lap !== null && isCleanLap(lap),
  },
  {
    id: 'gem-hunter',
    name: 'Gem Hunter',
    description: 'Find every gem on a track in one lap.',
    test: (context) => {
      const lap = gameLap(context);
      return lap !== null && lap.gemsTotal > 0 && lap.stats.gems === lap.gemsTotal;
    },
  },
  {
    id: 'flat-out',
    name: 'Flat Out',
    description: 'Finish a lap in the band above 2x.',
    test: ({ lap }) => lap !== null && speedBand(lap.multiplier) === 'band3',
  },
  {
    id: 'chain-twenty',
    name: 'Chain of Twenty',
    description: 'Run a twenty-ring combo.',
    test: ({ progress }) => progress.bestCombo >= 20,
  },
  {
    id: 'pad-hopper',
    name: 'Pad Hopper',
    description: 'Roll over five boost pads in one lap.',
    test: (context) => (gameLap(context)?.stats.boosts ?? 0) >= 5,
  },
  {
    id: 'shadow-runner',
    name: 'Shadow Runner',
    description: 'Beat your own ghost in Time Attack.',
    test: ({ lap }) => lap !== null && lap.mode === 'time' && lap.beatGhost,
  },
  {
    id: 'collector',
    name: 'Collector',
    description: 'Collect 25 gems across all tracks.',
    test: ({ progress }) => progress.gems >= 25,
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    description: 'Collect 100 gems across all tracks.',
    test: ({ progress }) => progress.gems >= 100,
  },
  {
    id: 'ring-road',
    name: 'Ring Road',
    description: 'Collect 500 rings across all tracks.',
    test: ({ progress }) => progress.rings >= 500,
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Finish ten laps.',
    test: ({ progress }) => progress.laps >= 10,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Finish fifty laps.',
    test: ({ progress }) => progress.laps >= 50,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Finish a lap on five different tracks.',
    test: ({ progress }) => progress.tracks.length >= 5,
  },
  {
    id: 'world-tour',
    name: 'World Tour',
    description: 'Finish a lap in every theme.',
    test: ({ progress, themeCount }) => themeCount > 0 && progress.themes.length >= themeCount,
  },
  {
    id: 'blur',
    name: 'Blur',
    description: 'Hit 250 km/h.',
    test: ({ progress }) => progress.topSpeedKmh >= 250,
  },
];

export const ACHIEVEMENTS: readonly Achievement[] = RULES.map(({ id, name, description }) => ({
  id,
  name,
  description,
}));

export function getAchievement(id: string): Achievement | null {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id) ?? null;
}

/** Achievements the context earns that are not in `earned` yet, in list order. */
export function evaluateAchievements(
  context: AchievementContext,
  earned: ReadonlySet<string>,
): Achievement[] {
  return RULES.filter((rule) => !earned.has(rule.id) && rule.test(context)).map(
    ({ id, name, description }) => ({ id, name, description }),
  );
}

export interface AchievementStore {
  read: () => string | null;
  write: (text: string) => void;
}

export const browserAchievementStore: AchievementStore = {
  read: () => {
    try {
      return localStorage.getItem(ACHIEVEMENTS_KEY);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, text);
    } catch {
      // Earned achievements simply do not persist this time.
    }
  },
};

/** Earned achievement ids with the ISO date each was earned. Unknown ids are dropped. */
export function loadEarned(store: AchievementStore = browserAchievementStore): Map<string, string> {
  const earned = new Map<string, string>();
  try {
    const raw: unknown = JSON.parse(store.read() ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return earned;
    for (const [id, date] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof date === 'string' && getAchievement(id)) earned.set(id, date);
    }
  } catch {
    // Broken storage reads as nothing earned.
  }
  return earned;
}

export function saveEarned(
  earned: ReadonlyMap<string, string>,
  store: AchievementStore = browserAchievementStore,
): void {
  store.write(JSON.stringify(Object.fromEntries(earned)));
}
