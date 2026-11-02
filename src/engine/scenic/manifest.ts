/**
 * The licence manifest for the Scenic Worlds models, and the GLB metadata reader that confirms
 * each file still carries the credit it was shipped with. Pure, so it runs under Vitest.
 */

export interface ModelCredit {
  /** File name inside public/models/scenic/. */
  file: string;
  title: string;
  author: string;
  authorUrl: string;
  /** Where the original was downloaded from. */
  source: string;
  license: string;
  licenseUrl: string;
  /** What the pipeline did to the original. */
  modified: string;
  bytes: number;
}

export interface ScenicManifest {
  generated: string;
  files: ModelCredit[];
}

/** Licences the app is willing to ship. Every current model is CC BY 4.0. */
const LICENSE_PATTERN = /^CC[\s-]?BY[\s-]?4\.0$/i;

export function isAcceptedLicense(text: string): boolean {
  return LICENSE_PATTERN.test(text.trim());
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Reads one manifest entry; null when anything a credit needs is missing. */
export function parseCredit(raw: unknown): ModelCredit | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const credit: ModelCredit = {
    file: text(record.file),
    title: text(record.title),
    author: text(record.author),
    authorUrl: text(record.authorUrl),
    source: text(record.source),
    license: text(record.license),
    licenseUrl: text(record.licenseUrl),
    modified: text(record.modified),
    bytes: typeof record.bytes === 'number' && record.bytes > 0 ? Math.floor(record.bytes) : 0,
  };
  const complete =
    credit.file !== '' &&
    credit.title !== '' &&
    credit.author !== '' &&
    credit.source !== '' &&
    credit.license !== '' &&
    credit.modified !== '';
  return complete && isAcceptedLicense(credit.license) ? credit : null;
}

/** Reads the manifest, dropping entries that are not complete credits. */
export function parseManifest(raw: unknown): ScenicManifest {
  if (typeof raw !== 'object' || raw === null) return { generated: '', files: [] };
  const record = raw as Record<string, unknown>;
  const list = Array.isArray(record.files) ? record.files : [];
  return {
    generated: text(record.generated),
    files: list.map(parseCredit).filter((credit): credit is ModelCredit => credit !== null),
  };
}

/** The credit for a file, or null: a model with no entry is never loaded. */
export function creditFor(manifest: ScenicManifest, file: string): ModelCredit | null {
  return manifest.files.find((credit) => credit.file === file) ?? null;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

/**
 * The `asset.extras` object inside a GLB, read straight from the binary header and JSON chunk.
 * Null when the bytes are not a GLB 2 file or carry no extras.
 */
export function readGlbAssetExtras(
  bytes: ArrayBuffer | Uint8Array,
): Record<string, unknown> | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.byteLength < 20) return null;
  const header = new DataView(view.buffer, view.byteOffset, view.byteLength);
  if (header.getUint32(0, true) !== GLB_MAGIC || header.getUint32(4, true) !== 2) return null;
  const chunkLength = header.getUint32(12, true);
  if (header.getUint32(16, true) !== JSON_CHUNK || 20 + chunkLength > view.byteLength) return null;
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(view.subarray(20, 20 + chunkLength)));
    if (typeof json !== 'object' || json === null) return null;
    const asset = (json as Record<string, unknown>).asset;
    if (typeof asset !== 'object' || asset === null) return null;
    const extras = (asset as Record<string, unknown>).extras;
    return typeof extras === 'object' && extras !== null
      ? (extras as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface CreditCheck {
  ok: boolean;
  reason: string;
}

/**
 * Confirms a downloaded file against its manifest entry: the licence inside the file must be an
 * accepted one and the title and author must agree, so a swapped or stripped file never ships
 * under someone else's credit.
 */
export function confirmCredit(
  credit: ModelCredit,
  extras: Record<string, unknown> | null,
): CreditCheck {
  if (!extras) return { ok: false, reason: 'the file carries no licence metadata' };
  const license = text(extras.license);
  const licenseName = license.replace(/\s*\(.*\)\s*$/, '');
  if (!isAcceptedLicense(licenseName)) {
    return { ok: false, reason: `the file says "${license || 'no licence'}"` };
  }
  const title = text(extras.title);
  if (title && title.toLowerCase() !== credit.title.toLowerCase()) {
    return { ok: false, reason: `the file is titled "${title}", not "${credit.title}"` };
  }
  const author = text(extras.author);
  if (author && !author.toLowerCase().includes(credit.author.toLowerCase())) {
    return { ok: false, reason: `the file credits "${author}", not "${credit.author}"` };
  }
  return { ok: true, reason: '' };
}
