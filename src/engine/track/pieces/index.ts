import { curve } from './curve';
import { helix } from './helix';
import { drop, liftHill } from './hills';
import { corkscrew, loop } from './inversions';
import { registerPiece } from './registry';
import { levelOut, slopeDown, slopeUp } from './slope';
import { station } from './station';
import { brakeRun, straight } from './straight';

// Registration order is palette order.
for (const def of [
  station,
  straight,
  curve,
  helix,
  slopeUp,
  slopeDown,
  levelOut,
  liftHill,
  drop,
  loop,
  corkscrew,
  brakeRun,
]) {
  registerPiece(def);
}

export { defaultParams, getPiece, listPieces } from './registry';
