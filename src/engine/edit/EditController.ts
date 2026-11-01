import { CommandStack, type Command } from '../build/CommandStack';
import { Emitter } from '../events';
import { cloneSection } from '../save/schema';
import { createSection, type SectionRange, type SectionSpec } from '../track/Track';
import type { ParamValue, SectionParams, SectionType } from '../track/sections/types';
import { normaliseParam, getSectionDef } from '../track/sections';

export interface EditSection {
  id: string;
  spec: SectionSpec;
}

export interface SectionItem {
  id: string;
  type: SectionType;
  params: SectionParams;
  /** Metres of tube this section produced in the last compile. */
  length: number;
}

export interface EditSummary {
  sections: SectionItem[];
  returnLength: number;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditEvents {
  change: EditSummary;
}

let nextId = 1;

function makeId(): string {
  return `s${nextId++}`;
}

/**
 * Holds the editable section list, selection and undo history. Every change goes through
 * `apply`, which recompiles the track. Slider drags are batched: `beginDrag` snapshots the
 * value, `preview` reshapes the tube without recording, and `endDrag` records one step.
 */
export class EditController {
  readonly events = new Emitter<EditEvents>();
  private sections: EditSection[] = [];
  private selectedId: string | null = null;
  private readonly history = new CommandStack();
  private ranges: readonly SectionRange[] = [];
  private returnLength = 0;
  private drag: { id: string; key: string; before: ParamValue } | null = null;
  private pending: { id: string; key: string; value: ParamValue } | null = null;

  constructor(
    private readonly apply: (sections: SectionSpec[]) => {
      ranges: readonly SectionRange[];
      returnLength: number;
    },
  ) {}

  /** Replaces the list without recording history, for loading a document. */
  load(sections: readonly SectionSpec[]): void {
    this.sections = sections.map((spec) => ({ id: makeId(), spec: cloneSection(spec) }));
    this.selectedId = null;
    this.history.clear();
    this.drag = null;
    this.pending = null;
    this.recompile();
  }

  specs(): SectionSpec[] {
    return this.sections.map((section) => cloneSection(section.spec));
  }

  get selected(): EditSection | null {
    return this.sections.find((section) => section.id === this.selectedId) ?? null;
  }

  /** Range of the selected section in the compiled track, or null. */
  selectedRange(): SectionRange | null {
    const index = this.sections.findIndex((section) => section.id === this.selectedId);
    return index >= 0 ? (this.ranges[index] ?? null) : null;
  }

  rangeOf(id: string): SectionRange | null {
    const index = this.sections.findIndex((section) => section.id === id);
    return index >= 0 ? (this.ranges[index] ?? null) : null;
  }

  idAt(index: number): string | null {
    return this.sections[index]?.id ?? null;
  }

  select(id: string | null): void {
    if (id !== null && !this.sections.some((section) => section.id === id)) return;
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.publish();
  }

  summary(): EditSummary {
    return {
      sections: this.sections.map((section, index) => ({
        id: section.id,
        type: section.spec.type,
        params: { ...section.spec.params },
        length: this.ranges[index]?.length ?? 0,
      })),
      returnLength: this.returnLength,
      selectedId: this.selectedId,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
  }

  add(type: SectionType, afterId: string | null = this.selectedId): string {
    const section: EditSection = { id: makeId(), spec: createSection(type) };
    const index = afterId ? this.sections.findIndex((s) => s.id === afterId) : -1;
    const at = index >= 0 ? index + 1 : this.sections.length;
    this.run({
      label: `Add ${getSectionDef(type).label}`,
      execute: () => {
        this.sections.splice(at, 0, section);
        this.selectedId = section.id;
      },
      undo: () => {
        this.sections.splice(at, 1);
        this.selectedId = afterId;
      },
    });
    return section.id;
  }

  remove(id: string = this.selectedId ?? ''): boolean {
    const index = this.sections.findIndex((section) => section.id === id);
    if (index < 0 || this.sections.length <= 1) return false;
    const section = this.sections[index];
    if (!section) return false;
    const previousSelection = this.selectedId;
    this.run({
      label: 'Remove section',
      execute: () => {
        this.sections.splice(index, 1);
        if (this.selectedId === id) {
          this.selectedId = this.sections[Math.min(index, this.sections.length - 1)]?.id ?? null;
        }
      },
      undo: () => {
        this.sections.splice(index, 0, section);
        this.selectedId = previousSelection;
      },
    });
    return true;
  }

  duplicate(id: string = this.selectedId ?? ''): string | null {
    const index = this.sections.findIndex((section) => section.id === id);
    const source = this.sections[index];
    if (!source) return null;
    const copy: EditSection = { id: makeId(), spec: cloneSection(source.spec) };
    const previousSelection = this.selectedId;
    this.run({
      label: 'Duplicate section',
      execute: () => {
        this.sections.splice(index + 1, 0, copy);
        this.selectedId = copy.id;
      },
      undo: () => {
        this.sections.splice(index + 1, 1);
        this.selectedId = previousSelection;
      },
    });
    return copy.id;
  }

  /** Moves a section to a new index in the list. */
  move(id: string, to: number): boolean {
    const from = this.sections.findIndex((section) => section.id === id);
    const target = Math.max(0, Math.min(this.sections.length - 1, to));
    if (from < 0 || from === target) return false;
    const reorder = (a: number, b: number): void => {
      const [section] = this.sections.splice(a, 1);
      if (section) this.sections.splice(b, 0, section);
    };
    this.run({
      label: 'Move section',
      execute: () => reorder(from, target),
      undo: () => reorder(target, from),
    });
    return true;
  }

  moveBy(id: string, delta: number): boolean {
    const from = this.sections.findIndex((section) => section.id === id);
    return from >= 0 && this.move(id, from + delta);
  }

  /** Sets a param and records one history step. */
  setParam(id: string, key: string, value: ParamValue): void {
    const section = this.sections.find((s) => s.id === id);
    if (!section) return;
    const before = section.spec.params[key];
    const after = this.normalise(section.spec.type, key, value);
    if (before === undefined || after === undefined || before === after) return;
    this.run({
      label: 'Change section',
      execute: () => {
        section.spec.params[key] = after;
      },
      undo: () => {
        section.spec.params[key] = before;
      },
    });
  }

  /** Starts a slider drag: the whole drag becomes one history step. */
  beginDrag(id: string, key: string): void {
    const section = this.sections.find((s) => s.id === id);
    const before = section?.spec.params[key];
    if (!section || before === undefined) return;
    if (this.drag && (this.drag.id !== id || this.drag.key !== key)) this.endDrag();
    this.drag = { id, key, before };
  }

  /** Reshapes the tube to a value during a drag without recording it. Coalesced per frame. */
  preview(id: string, key: string, value: ParamValue): void {
    if (this.drag?.id !== id || this.drag.key !== key) this.beginDrag(id, key);
    this.pending = { id, key, value };
  }

  /** Applies the latest preview; the game calls this once per frame. */
  flush(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    const section = this.sections.find((s) => s.id === pending.id);
    if (!section) return;
    const value = this.normalise(section.spec.type, pending.key, pending.value);
    if (value === undefined || section.spec.params[pending.key] === value) return;
    section.spec.params[pending.key] = value;
    this.recompile();
  }

  /** Ends the drag and records the change from the snapshot to the final value. */
  endDrag(value?: ParamValue): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    if (value !== undefined) this.pending = { id: drag.id, key: drag.key, value };
    this.flush();
    const section = this.sections.find((s) => s.id === drag.id);
    if (!section) return;
    const after = section.spec.params[drag.key];
    if (after === undefined || after === drag.before) return;
    // The value is already applied; record a command whose execute is a no-op the first time.
    this.history.execute({
      label: 'Change section',
      execute: () => {
        section.spec.params[drag.key] = after;
      },
      undo: () => {
        section.spec.params[drag.key] = drag.before;
      },
    });
    this.publish();
  }

  undo(): boolean {
    this.endDrag();
    const command = this.history.undo();
    if (!command) return false;
    this.recompile();
    return true;
  }

  redo(): boolean {
    this.endDrag();
    const command = this.history.redo();
    if (!command) return false;
    this.recompile();
    return true;
  }

  private normalise(type: SectionType, key: string, value: ParamValue): ParamValue | undefined {
    const spec = getSectionDef(type).params.find((p) => p.key === key);
    return spec ? normaliseParam(spec, value) : undefined;
  }

  private run(command: Command): void {
    this.endDrag();
    this.history.execute(command);
    this.recompile();
  }

  private recompile(): void {
    const result = this.apply(this.specs());
    this.ranges = result.ranges;
    this.returnLength = result.returnLength;
    this.publish();
  }

  private publish(): void {
    this.events.emit('change', this.summary());
  }

  dispose(): void {
    this.events.clear();
  }
}
