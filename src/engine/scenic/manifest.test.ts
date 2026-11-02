import { describe, expect, it } from 'vitest';
import {
  confirmCredit,
  creditFor,
  isAcceptedLicense,
  parseCredit,
  parseManifest,
  readGlbAssetExtras,
  type ModelCredit,
} from './manifest';

function credit(overrides: Partial<ModelCredit> = {}): ModelCredit {
  return {
    file: 'deep-space.glb',
    title: 'Deep Space skybox',
    author: 'Jungle Jim',
    authorUrl: 'https://sketchfab.com/jungle_jim',
    source: 'https://sketchfab.com/3d-models/deep-space-skybox-2d87bae35cff40598c859f2163b4b3b0',
    license: 'CC BY 4.0',
    licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    modified: 'compressed and resized for real-time use',
    bytes: 1234,
    ...overrides,
  };
}

/** Builds a GLB 2 file in memory: header, padded JSON chunk, no binary chunk. */
function glb(json: unknown): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(text.length / 4) * 4;
  const bytes = new Uint8Array(20 + padded);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(text, 20);
  for (let i = 20 + text.length; i < bytes.length; i++) bytes[i] = 0x20;
  return bytes;
}

describe('scenic manifest', () => {
  it('accepts CC BY 4.0 in its spellings and nothing else', () => {
    expect(isAcceptedLicense('CC BY 4.0')).toBe(true);
    expect(isAcceptedLicense('CC-BY-4.0')).toBe(true);
    expect(isAcceptedLicense(' cc by 4.0 ')).toBe(true);
    expect(isAcceptedLicense('CC BY-NC 4.0')).toBe(false);
    expect(isAcceptedLicense('CC0')).toBe(false);
    expect(isAcceptedLicense('')).toBe(false);
  });

  it('keeps complete credits and drops the rest', () => {
    expect(parseCredit(credit())).toEqual(credit());
    expect(parseCredit(credit({ author: '' }))).toBeNull();
    expect(parseCredit(credit({ license: 'All rights reserved' }))).toBeNull();
    expect(parseCredit(credit({ modified: '' }))).toBeNull();
    expect(parseCredit('nope')).toBeNull();
    const manifest = parseManifest({
      generated: '2026-11-02T00:00:00Z',
      files: [credit(), credit({ file: 'bad.glb', source: '' }), 5],
    });
    expect(manifest.files.map((entry) => entry.file)).toEqual(['deep-space.glb']);
    expect(creditFor(manifest, 'deep-space.glb')?.title).toBe('Deep Space skybox');
    expect(creditFor(manifest, 'bad.glb')).toBeNull();
    expect(parseManifest(null).files).toEqual([]);
  });

  it('reads asset.extras out of a GLB and rejects other bytes', () => {
    const extras = { title: 'Deep Space skybox', license: 'CC-BY-4.0 (http://x)' };
    expect(readGlbAssetExtras(glb({ asset: { version: '2.0', extras } }))).toEqual(extras);
    expect(readGlbAssetExtras(glb({ asset: { version: '2.0' } }))).toBeNull();
    expect(readGlbAssetExtras(new Uint8Array([1, 2, 3]))).toBeNull();
    const broken = glb({ asset: { version: '2.0', extras } });
    broken[0] = 0;
    expect(readGlbAssetExtras(broken)).toBeNull();
  });

  it('confirms a file against its credit', () => {
    const extras = {
      author: 'Jungle Jim (https://sketchfab.com/jungle_jim)',
      license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
      title: 'Deep Space skybox',
    };
    expect(confirmCredit(credit(), extras).ok).toBe(true);
    expect(confirmCredit(credit(), null).ok).toBe(false);
    expect(confirmCredit(credit(), { ...extras, license: 'CC-BY-NC-4.0 (x)' }).ok).toBe(false);
    expect(confirmCredit(credit(), { ...extras, title: 'Something else' }).reason).toContain(
      'titled',
    );
    expect(confirmCredit(credit(), { ...extras, author: 'Nobody' }).reason).toContain('credits');
    expect(confirmCredit(credit(), { license: 'CC BY 4.0' }).ok).toBe(true);
  });
});
