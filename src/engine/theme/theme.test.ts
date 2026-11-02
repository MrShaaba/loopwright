import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, getTheme, hasTheme, listThemes, nextThemeId } from './index';

describe('themes', () => {
  it('lists Minimal first and six skins after it', () => {
    expect(listThemes().map((theme) => theme.id)).toEqual([
      'minimal',
      'haunted-hollow',
      'primeval-valley',
      'xeno-reach',
      'frostline',
      'abyss',
      'neon-district',
    ]);
    expect(DEFAULT_THEME_ID).toBe('minimal');
  });

  it('cycles in order and wraps', () => {
    expect(nextThemeId('minimal')).toBe('haunted-hollow');
    expect(nextThemeId('xeno-reach')).toBe('frostline');
    expect(nextThemeId('neon-district')).toBe('minimal');
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

  it('gives the three new worlds their props and keeps them looks only', () => {
    expect(getTheme('frostline').props?.weather?.kind).toBe('snow');
    expect(getTheme('frostline').props?.scatter?.[0]?.kind).toBe('pine');
    expect(getTheme('frostline').props?.lights?.colors.length).toBeGreaterThan(1);
    expect(getTheme('abyss').props?.weather?.kind).toBe('bubbles');
    expect(getTheme('abyss').props?.swimmers?.schools).toBeGreaterThan(0);
    expect(getTheme('abyss').floor.caustics?.strength).toBeGreaterThan(0);
    expect(getTheme('neon-district').props?.rails).toBeDefined();
    expect(getTheme('neon-district').props?.skyline?.count).toBeGreaterThan(10);
    // A theme has no say over the track or the ride: only looks live in it.
    for (const theme of listThemes()) {
      expect(Object.keys(theme).sort()).toEqual(
        [
          'ball',
          'floor',
          'fog',
          'id',
          'lighting',
          'music',
          'name',
          'props',
          'sky',
          'tagline',
          'tube',
          'ui',
        ]
          .filter((key) => key !== 'props' || theme.props !== undefined)
          .sort(),
      );
    }
  });
});
