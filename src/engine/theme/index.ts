import { hauntedHollow } from './haunted-hollow';
import { registerTheme } from './registry';

registerTheme(hauntedHollow);

export { getTheme, listThemes } from './registry';
export type { ThemeConfig } from './ThemeConfig';
