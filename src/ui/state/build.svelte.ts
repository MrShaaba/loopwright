import type { TrackSummary } from '../../engine/build/BuildController';
import type { ParamValue, PieceCategory, PieceParams } from '../../engine/track/types';

export interface PaletteParam {
  key: string;
  label: string;
  options: { value: ParamValue; label: string }[];
}

export interface PaletteEntry {
  id: string;
  label: string;
  category: PieceCategory;
  description: string;
  params: PaletteParam[];
}

export interface BuildState {
  palette: PaletteEntry[];
  selectedId: string | null;
  params: PieceParams;
  canPlace: boolean;
  reason: string;
  track: TrackSummary;
  canUndo: boolean;
  canRedo: boolean;
}

export const build: BuildState = $state({
  palette: [],
  selectedId: null,
  params: {},
  canPlace: false,
  reason: '',
  track: {
    pieces: 1,
    length: 0,
    closed: false,
    distance: 0,
    headingDeg: 0,
    exitHeight: 0,
    exitPitchDeg: 0,
  },
  canUndo: false,
  canRedo: false,
});
