import { minimal } from './minimal';
import { registerTheme } from './registry';

registerTheme(minimal);

export { getTheme, listThemes } from './registry';
export type { ThemeConfig } from './ThemeConfig';
export const DEFAULT_THEME_ID = minimal.id;
