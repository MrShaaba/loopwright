import { getSectionDef, listSectionDefs } from '../track/sections';
import type { ParamSpec, ParamValue, SectionParams } from '../track/sections/types';
import { createTrackDoc, type TrackDoc } from './schema';

/** Share link format. Version 2 adds the item seed after the name; version 1 links still open. */
export const SHARE_VERSION = 2;
const OLDEST_VERSION = 1;
export const SHARE_PARAM = 't';
const MAX_NAME_BYTES = 48;
const MAX_SECTIONS = 64;

/** Theme ids by index. Append only: the index is what the link stores. */
const THEME_IDS = [
  'minimal',
  'haunted-hollow',
  'primeval-valley',
  'xeno-reach',
  'frostline',
  'abyss',
  'neon-district',
] as const;

class Writer {
  private bytes: number[] = [];

  u8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  u16(value: number): void {
    this.u8(value >> 8);
    this.u8(value);
  }

  text(value: string, maxBytes: number): void {
    const encoded = new TextEncoder().encode(value).slice(0, maxBytes);
    this.u8(encoded.length);
    for (const byte of encoded) this.u8(byte);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class Reader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  u8(): number {
    const value = this.bytes[this.offset];
    if (value === undefined) throw new Error('Unexpected end of share data');
    this.offset++;
    return value;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  text(): string {
    const length = this.u8();
    if (this.remaining < length) throw new Error('Unexpected end of share data');
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return new TextDecoder().decode(slice);
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function writeParam(writer: Writer, spec: ParamSpec, value: ParamValue | undefined): void {
  switch (spec.kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : spec.default;
      const steps = Math.round((n - spec.min) / spec.step);
      writer.u16(Math.max(0, Math.min(0xffff, steps)));
      return;
    }
    case 'boolean':
      writer.u8(value === true ? 1 : 0);
      return;
    case 'choice': {
      const index = typeof value === 'string' ? spec.options.indexOf(value) : -1;
      writer.u8(index >= 0 ? index : spec.options.indexOf(spec.default));
      return;
    }
  }
}

function readParam(reader: Reader, spec: ParamSpec): ParamValue {
  switch (spec.kind) {
    case 'number': {
      const steps = reader.u16();
      const value = spec.min + steps * spec.step;
      return Number(Math.min(spec.max, Math.max(spec.min, value)).toFixed(4));
    }
    case 'boolean':
      return reader.u8() === 1;
    case 'choice': {
      const index = reader.u8();
      return spec.options[index] ?? spec.default;
    }
  }
}

/** Packs a track into a short URL-safe string: version, theme, name, then one type index and quantised params per section. */
export function encodeTrack(doc: TrackDoc): string {
  const types = listSectionDefs().map((def) => def.type);
  const writer = new Writer();
  writer.u8(SHARE_VERSION);
  const themeIndex = THEME_IDS.indexOf(doc.theme as (typeof THEME_IDS)[number]);
  writer.u8(themeIndex >= 0 ? themeIndex : 0);
  writer.text(doc.name, MAX_NAME_BYTES);
  writer.u16(doc.seed);
  const sections = doc.sections.slice(0, MAX_SECTIONS);
  writer.u8(sections.length);
  for (const section of sections) {
    const def = getSectionDef(section.type);
    writer.u8(types.indexOf(section.type));
    for (const spec of def.params) writeParam(writer, spec, section.params[spec.key]);
  }
  return toBase64Url(writer.finish());
}

/** Reads a share string back into a track document, or null when it is not one. */
export function decodeTrack(text: string): TrackDoc | null {
  try {
    const reader = new Reader(fromBase64Url(text.trim()));
    const version = reader.u8();
    if (version < OLDEST_VERSION || version > SHARE_VERSION) return null;
    const theme = THEME_IDS[reader.u8()] ?? THEME_IDS[0];
    const name = reader.text() || 'Shared track';
    const seed = version >= 2 ? reader.u16() : 1;
    const count = reader.u8();
    if (count === 0 || count > MAX_SECTIONS) return null;
    const types = listSectionDefs().map((def) => def.type);
    const sections = [];
    for (let i = 0; i < count; i++) {
      const type = types[reader.u8()];
      if (!type) return null;
      const def = getSectionDef(type);
      const params: SectionParams = {};
      for (const spec of def.params) params[spec.key] = readParam(reader, spec);
      sections.push({ type, params });
    }
    if (reader.remaining !== 0) return null;
    return createTrackDoc(name, theme, sections, seed);
  } catch {
    return null;
  }
}

/** The share link for a track, built on the current page. */
export function shareLink(doc: TrackDoc, base: string): string {
  return `${base}#${SHARE_PARAM}=${encodeTrack(doc)}`;
}

/** Reads a track from a URL hash such as `#t=...`, or null when there is none. */
export function trackFromHash(hash: string): TrackDoc | null {
  const match = /^#?(?:.*&)?t=([A-Za-z0-9_-]+)/.exec(hash);
  return match?.[1] ? decodeTrack(match[1]) : null;
}
