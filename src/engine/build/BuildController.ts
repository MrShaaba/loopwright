import { Emitter } from '../events';
import { validateTrack, type ValidationResult } from '../ride/validate';
import type { PlacedPiece } from '../save/schema';
import { defaultParams, getPiece } from '../track/pieces';
import { TrackModel, type Candidate } from '../track/TrackModel';
import type { ParamValue, PieceDef, PieceParams, TrackFrame } from '../track/types';
import { DEG } from '../util/math';
import { CommandStack } from './CommandStack';

export interface TrackSummary {
  pieces: number;
  length: number;
  closed: boolean;
  distance: number;
  headingDeg: number;
  exitHeight: number;
  exitPitchDeg: number;
}

export interface SelectionState {
  pieceId: string | null;
  params: PieceParams;
  canPlace: boolean;
  reason: string | null;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface GhostState {
  frames: TrackFrame[];
  valid: boolean;
}

export interface BuildEvents {
  track: TrackSummary;
  selection: SelectionState;
  history: HistoryState;
  ghost: GhostState | null;
  validation: ValidationResult;
}

/** Build-mode logic: piece selection, ghost preview, placement and undo history. */
export class BuildController {
  readonly events = new Emitter<BuildEvents>();
  readonly stack = new CommandStack();
  selectedId: string | null = null;
  params: PieceParams = {};
  private candidate: Candidate | null = null;
  private ghost: GhostState | null = null;
  validation: ValidationResult;

  constructor(readonly model: TrackModel) {
    this.validation = validateTrack(model.frames, model.closure);
  }

  get selected(): PieceDef | null {
    return this.selectedId ? getPiece(this.selectedId) : null;
  }

  summary(): TrackSummary {
    const { closure, exitPose } = this.model;
    return {
      pieces: this.model.pieces.length,
      length: this.model.length,
      closed: closure.closed,
      distance: closure.distance,
      headingDeg: closure.headingDeg,
      exitHeight: exitPose.position.y,
      exitPitchDeg: exitPose.pitch / DEG,
    };
  }

  selection(): SelectionState {
    return {
      pieceId: this.selectedId,
      params: { ...this.params },
      canPlace: this.candidate !== null && this.candidate.reason === null,
      reason: this.candidate?.reason ?? null,
    };
  }

  history(): HistoryState {
    return { canUndo: this.stack.canUndo, canRedo: this.stack.canRedo };
  }

  /** Emits every state so a fresh subscriber can sync. */
  publishAll(): void {
    this.events.emit('track', this.summary());
    this.events.emit('validation', this.validation);
    this.events.emit('selection', this.selection());
    this.events.emit('history', this.history());
    this.events.emit('ghost', this.ghost);
  }

  select(pieceId: string | null): void {
    if (pieceId === this.selectedId) return;
    this.selectedId = pieceId;
    this.params = pieceId ? defaultParams(getPiece(pieceId)) : {};
    this.refreshCandidate();
  }

  setParam(key: string, value: ParamValue): void {
    const def = this.selected;
    if (!def || !(key in def.params)) return;
    this.params = { ...this.params, [key]: value };
    this.refreshCandidate();
  }

  private refreshCandidate(): void {
    const def = this.selected;
    if (!def) {
      this.candidate = null;
      this.ghost = null;
    } else {
      this.candidate = this.model.candidate(def, this.params);
      // Nothing can be added to a closed circuit, so there is nothing to preview.
      this.ghost = this.model.closure.closed
        ? null
        : {
            frames: this.model.ghostFrames(def, this.candidate.geometry),
            valid: this.candidate.reason === null,
          };
    }
    this.events.emit('selection', this.selection());
    this.events.emit('ghost', this.ghost);
  }

  private afterModelChange(): void {
    this.validation = validateTrack(this.model.frames, this.model.closure);
    this.events.emit('track', this.summary());
    this.events.emit('validation', this.validation);
    this.events.emit('history', this.history());
    this.refreshCandidate();
  }

  /** Snaps the selected piece onto the track end. Returns false when nothing could be placed. */
  place(): boolean {
    const def = this.selected;
    if (!def || this.candidate?.reason !== null) return false;
    const piece: PlacedPiece = { type: def.id, params: { ...this.params } };
    this.stack.execute({
      label: `Place ${def.label}`,
      execute: () => this.model.push(piece),
      undo: () => {
        this.model.pop();
      },
    });
    this.afterModelChange();
    return true;
  }

  removeLast(): boolean {
    if (this.model.pieces.length <= 1) return false;
    let removed: PlacedPiece | null = null;
    this.stack.execute({
      label: 'Remove last piece',
      execute: () => {
        removed = this.model.pop();
      },
      undo: () => {
        if (removed) this.model.push(removed);
      },
    });
    this.afterModelChange();
    return true;
  }

  undo(): boolean {
    const command = this.stack.undo();
    if (!command) return false;
    this.afterModelChange();
    return true;
  }

  redo(): boolean {
    const command = this.stack.redo();
    if (!command) return false;
    this.afterModelChange();
    return true;
  }

  /** Replaces the track wholesale (loading a park) and clears history. */
  load(pieces: readonly PlacedPiece[]): void {
    this.model.setPieces(pieces);
    this.stack.clear();
    this.afterModelChange();
  }

  dispose(): void {
    this.events.clear();
  }
}

export { TrackModel };
