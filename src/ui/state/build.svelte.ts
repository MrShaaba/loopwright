import type { TrackSummary } from '../../engine/build/BuildController';
import type { MarkerKind, RideStats } from '../../engine/ride/validate';
import type { ParamValue, PieceCategory, PieceParams } from '../../engine/track/types';

export interface MarkerSummary {
  kind: MarkerKind;
  severity: 'error' | 'warning';
  reason: string;
}

export interface ValidationSummary {
  ok: boolean;
  markers: MarkerSummary[];
  stats: RideStats;
}

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
  validation: ValidationSummary;
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
  validation: {
    ok: false,
    markers: [],
    stats: { rideTime: 0, maxSpeed: 0, maxVerticalG: 1, minVerticalG: 1, maxLateralG: 0 },
  },
  canUndo: false,
  canRedo: false,
});
