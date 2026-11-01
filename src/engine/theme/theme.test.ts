import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, getTheme, hasTheme, listThemes, nextThemeId } from './index';

describe('themes', () => {
  it('lists Minimal first and three skins after it', () => {
    expect(listThemes().map((theme) => theme.id)).toEqual([
      'minimal',
      'haunted-hollow',
      'primeval-valley',
      'xeno-reach',
    ]);
    expect(DEFAULT_THEME_ID).toBe('minimal');
  });

  it('cycles in order and wraps', () => {
    expect(nextThemeId('minimal')).toBe('haunted-hollow');
    expect(nextThemeId('xeno-reach')).toBe('minimal');
    expect(nextThemeId('nope')).toBe('minimal');
    expect(hasTheme('primeval-valley')).toBe(true);
    expect(hasTheme('park')).toBe(false);
  });

  it('gives every theme a complete look and a readable tube', () => {
    for (const theme of listThemes()) {
      expect(theme.name.length).toBeGreaterThan(2);
      expect(theme.tagline.length).toBeGreaterThan(8);
      expect(theme.sky.horizon.equals(theme.fog.color)).toBe(true);
      expect(theme.tube.intensity).toBeGreaterThan(0.5);
      expect(theme.ball.light).toBeGreaterThan(0);
      expect(theme.ui.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(() => getTheme('nope')).toThrow();
  });
});
