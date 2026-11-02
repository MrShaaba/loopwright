import { abyss } from './abyss';
import { frostline } from './frostline';
import { hauntedHollow } from './haunted-hollow';
import { minimal } from './minimal';
import { neonDistrict } from './neon-district';
import { primevalValley } from './primeval-valley';
import { getTheme, listThemes, registerTheme } from './registry';
import { xenoReach } from './xeno-reach';

// Minimal first: it is the default and the hero look. The others are optional skins.
registerTheme(minimal);
registerTheme(hauntedHollow);
registerTheme(primevalValley);
registerTheme(xenoReach);
registerTheme(frostline);
registerTheme(abyss);
registerTheme(neonDistrict);

export { getTheme, listThemes } from './registry';
export type { ThemeConfig } from './ThemeConfig';
export const DEFAULT_THEME_ID = minimal.id;

export function hasTheme(id: string): boolean {
  return listThemes().some((theme) => theme.id === id);
}

/** The theme after `id` in picker order, wrapping around. */
export function nextThemeId(id: string): string {
  const themes = listThemes();
  const index = themes.findIndex((theme) => theme.id === id);
  const next = themes[(index + 1) % themes.length] ?? getTheme(DEFAULT_THEME_ID);
  return next.id;
}
