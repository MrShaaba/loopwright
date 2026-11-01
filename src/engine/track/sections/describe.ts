import { getSectionDef } from './index';
import {
  booleanParam,
  choiceParam,
  numberParam,
  type SectionParams,
  type SectionType,
} from './types';

function dir(params: SectionParams): string {
  return choiceParam(params, 'direction', ['left', 'right'] as const, 'right') === 'left'
    ? 'L'
    : 'R';
}

function metres(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} m`;
}

/** Short chip text for a section, e.g. "Hill +12 m" or "Turn R 90°". */
export function describeSection(type: SectionType, params: SectionParams): string {
  switch (type) {
    case 'straight':
      return `${booleanParam(params, 'tunnel', false) ? 'Tunnel' : 'Straight'} ${metres(numberParam(params, 'length', 24))}`;
    case 'hill':
      return `Hill ${booleanParam(params, 'dive', false) ? '−' : '+'}${metres(numberParam(params, 'height', 12))}`;
    case 'turn':
      return `Turn ${dir(params)} ${Math.round(numberParam(params, 'angle', 90))}°`;
    case 'loop':
      return `Loop r${numberParam(params, 'radius', 9)}`;
    case 'corkscrew':
      return `Corkscrew ${dir(params)}`;
    case 'helix':
      return `Helix ${dir(params)} ${numberParam(params, 'turns', 1.5)}×`;
    case 'spiral':
      return `Spiral ${dir(params)} ${numberParam(params, 'turns', 2)}×`;
    case 'wave':
      return `Wave ×${Math.round(numberParam(params, 'waves', 3))}`;
    case 'jump':
      return `Jump ${metres(numberParam(params, 'gap', 14))}`;
  }
}

export function sectionLabel(type: SectionType): string {
  return getSectionDef(type).label;
}
