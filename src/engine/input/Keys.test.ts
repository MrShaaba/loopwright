import { describe, expect, it } from 'vitest';
import { KeyRegistry, describeCombo, parseCombo } from './Keys';

describe('parseCombo', () => {
  it('reads modifiers and the key code', () => {
    expect(parseCombo('shift+mod+KeyZ')).toEqual({
      code: 'KeyZ',
      mod: true,
      shift: true,
      alt: false,
    });
    expect(parseCombo('Delete')).toEqual({ code: 'Delete', mod: false, shift: false, alt: false });
  });

  it('rejects an empty combo', () => {
    expect(() => parseCombo('')).toThrow();
  });
});

describe('describeCombo', () => {
  it('renders platform-specific modifiers', () => {
    expect(describeCombo('mod+KeyZ', true)).toBe('⌘Z');
    expect(describeCombo('mod+KeyZ', false)).toBe('Ctrl+Z');
    expect(describeCombo('shift+Slash', false)).toBe('?');
    expect(describeCombo('Digit1', false)).toBe('1');
    expect(describeCombo('Escape', true)).toBe('Esc');
  });
});

describe('KeyRegistry', () => {
  it('dispatches to the binding for the active mode only', () => {
    const keys = new KeyRegistry();
    const hits: string[] = [];
    keys.bind({
      scope: 'edit',
      combo: 'KeyR',
      label: 'Rotate',
      handler: () => hits.push('rotate'),
    });
    keys.bind({
      scope: 'ride',
      combo: 'KeyR',
      label: 'Restart',
      handler: () => hits.push('restart'),
    });
    keys.bind({ scope: 'global', combo: 'KeyH', label: 'Help', handler: () => hits.push('help') });

    expect(keys.dispatch({ code: 'KeyR' })).toBe(true);
    keys.mode = 'ride';
    expect(keys.dispatch({ code: 'KeyR' })).toBe(true);
    expect(keys.dispatch({ code: 'KeyH' })).toBe(true);
    expect(keys.dispatch({ code: 'KeyQ' })).toBe(false);
    expect(hits).toEqual(['rotate', 'restart', 'help']);
  });

  it('treats ctrl and cmd both as the mod key and requires exact modifiers', () => {
    const keys = new KeyRegistry();
    let undo = 0;
    let rotate = 0;
    keys.bind({ scope: 'edit', combo: 'mod+KeyZ', label: 'Undo', handler: () => undo++ });
    keys.bind({ scope: 'edit', combo: 'KeyR', label: 'Rotate', handler: () => rotate++ });

    expect(keys.dispatch({ code: 'KeyZ', ctrlKey: true })).toBe(true);
    expect(keys.dispatch({ code: 'KeyZ', metaKey: true })).toBe(true);
    expect(keys.dispatch({ code: 'KeyZ' })).toBe(false);
    expect(keys.dispatch({ code: 'KeyR', ctrlKey: true })).toBe(false);
    expect(keys.dispatch({ code: 'KeyR', shiftKey: true })).toBe(false);
    expect(undo).toBe(2);
    expect(rotate).toBe(0);
  });

  it('honours guards and unbinding', () => {
    const keys = new KeyRegistry();
    let allowed = false;
    let fired = 0;
    const unbind = keys.bind({
      scope: 'global',
      combo: 'Space',
      label: 'Start',
      handler: () => fired++,
      when: () => allowed,
    });
    expect(keys.dispatch({ code: 'Space' })).toBe(false);
    allowed = true;
    expect(keys.dispatch({ code: 'Space' })).toBe(true);
    unbind();
    expect(keys.dispatch({ code: 'Space' })).toBe(false);
    expect(fired).toBe(1);
    expect(keys.list()).toHaveLength(0);
  });
});
