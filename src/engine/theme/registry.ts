import type { ThemeConfig } from './ThemeConfig';

const themes = new Map<string, ThemeConfig>();

/** Registers or replaces a theme. Replacing keeps hot module reloads working in dev. */
export function registerTheme(theme: ThemeConfig): void {
  themes.set(theme.id, theme);
}

export function getTheme(id: string): ThemeConfig {
  const theme = themes.get(id);
  if (!theme) throw new Error(`Unknown theme "${id}"`);
  return theme;
}

export function listThemes(): ThemeConfig[] {
  return [...themes.values()];
}
