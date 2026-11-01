import type { PieceDef, PieceParams } from '../types';

const pieces = new Map<string, PieceDef>();

export function registerPiece(def: PieceDef): void {
  pieces.set(def.id, def);
}

export function getPiece(id: string): PieceDef {
  const def = pieces.get(id);
  if (!def) throw new Error(`Unknown track piece "${id}"`);
  return def;
}

/** Pieces the palette offers, in registration order. */
export function listPieces(): PieceDef[] {
  return [...pieces.values()].filter((def) => !def.hidden);
}

export function defaultParams(def: PieceDef): PieceParams {
  const params: PieceParams = {};
  for (const [key, param] of Object.entries(def.params)) params[key] = param.default;
  return params;
}

export function numberParam(params: PieceParams, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
}

export function stringParam(params: PieceParams, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

export function directionParam(params: PieceParams, key = 'direction'): 'left' | 'right' {
  return params[key] === 'left' ? 'left' : 'right';
}
