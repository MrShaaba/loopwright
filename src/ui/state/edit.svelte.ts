import type { SectionItem } from '../../engine/edit/EditController';
import type { ParamSpec, SectionType } from '../../engine/track/sections/types';

export interface SectionDefSummary {
  type: SectionType;
  label: string;
  description: string;
  params: readonly ParamSpec[];
}

export interface EditUiState {
  defs: SectionDefSummary[];
  sections: SectionItem[];
  returnLength: number;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  addMenuOpen: boolean;
}

export const edit: EditUiState = $state({
  defs: [],
  sections: [],
  returnLength: 0,
  selectedId: null,
  canUndo: false,
  canRedo: false,
  addMenuOpen: false,
});
