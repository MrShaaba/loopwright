import { describe, expect, it } from 'vitest';
import { STARTERS } from '../starters';
import { createSection } from '../track/Track';
import { decodeTrack, encodeTrack, shareLink, trackFromHash } from './codec';
import { createTrackDoc, parseTrackDoc } from './schema';

describe('share codec', () => {
  it.each(STARTERS.map((starter) => [starter.name, starter]))(
    'round-trips %s exactly and stays short',
    (_name, starter) => {
      const encoded = encodeTrack(starter.doc);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encoded.length).toBeLessThan(140);
      const decoded = decodeTrack(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.name).toBe(starter.doc.name);
      expect(decoded?.theme).toBe(starter.doc.theme);
      expect(decoded?.sections).toEqual(starter.doc.sections);
    },
  );

  it('keeps the theme, the seed and a unicode name', () => {
    const doc = createTrackDoc(
      'Löopy ✨',
      'xeno-reach',
      [createSection('loop', { radius: 12.5 })],
      4242,
    );
    const decoded = decodeTrack(encodeTrack(doc));
    expect(decoded?.name).toBe('Löopy ✨');
    expect(decoded?.theme).toBe('xeno-reach');
    expect(decoded?.seed).toBe(4242);
    expect(decoded?.sections[0]?.params.radius).toBe(12.5);
  });

  it('still opens a version 1 link, with the default seed', () => {
    // Version 1 bytes by hand: version, theme, name, count, then two straights of 24 m.
    const bytes = [1, 0, 4, 70, 108, 111, 119, 2, 0, 0, 20, 0, 0, 0, 20, 0];
    const v1 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const decoded = decodeTrack(v1);
    expect(decoded?.name).toBe('Flow');
    expect(decoded?.seed).toBe(1);
    expect(decoded?.sections).toEqual([
      { type: 'straight', params: { length: 24, tunnel: false } },
      { type: 'straight', params: { length: 24, tunnel: false } },
    ]);
  });

  it('rejects garbage, truncated and tampered strings', () => {
    expect(decodeTrack('')).toBeNull();
    expect(decodeTrack('not base64!!')).toBeNull();
    const good = encodeTrack(STARTERS[0]?.doc ?? createTrackDoc('x', 'minimal', []));
    expect(decodeTrack(good.slice(0, good.length - 6))).toBeNull();
    expect(decodeTrack(good + 'AAAA')).toBeNull();
    expect(decodeTrack('Zg')).toBeNull();
  });

  it('builds a link that the hash reader understands', () => {
    const doc = STARTERS[1]?.doc;
    expect(doc).toBeDefined();
    if (!doc) return;
    const link = shareLink(doc, 'https://example.test/ride/');
    expect(link.startsWith('https://example.test/ride/#t=')).toBe(true);
    const hash = link.slice(link.indexOf('#'));
    expect(trackFromHash(hash)?.sections).toEqual(doc.sections);
    expect(trackFromHash('#nothing')).toBeNull();
    expect(trackFromHash('')).toBeNull();
  });

  it('agrees with the JSON format', () => {
    const doc = STARTERS[2]?.doc;
    if (!doc) return;
    const json = JSON.parse(JSON.stringify(doc)) as unknown;
    expect(parseTrackDoc(json)).toEqual(doc);
    expect(decodeTrack(encodeTrack(doc))).toEqual(doc);
  });
});
