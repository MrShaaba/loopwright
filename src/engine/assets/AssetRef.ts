/**
 * Every prop, creature and sound in a theme is referenced through an AssetRef.
 * The first pass builds everything procedurally; swapping in a `.glb` model or an
 * audio file later is a one-line change in the theme config, not a code change.
 */
export type AssetRef =
  | { kind: 'procedural'; builder: string; params?: Record<string, number> }
  | { kind: 'glb'; url: string; scale?: number }
  | { kind: 'synth'; patch: string; params?: Record<string, number> }
  | { kind: 'audio'; url: string; gain?: number };
