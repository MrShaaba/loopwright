import { describe, expect, it } from 'vitest';
import { compileTrack, createSection } from '../track/Track';
import { EditController } from './EditController';

function controller(): EditController {
  const edit = new EditController((sections) => {
    const compiled = compileTrack(sections);
    return { ranges: compiled.ranges, returnLength: compiled.returnLength };
  });
  edit.load([createSection('straight', { length: 30 }), createSection('hill')]);
  return edit;
}

describe('EditController', () => {
  it('loads sections with ids and compiled lengths', () => {
    const edit = controller();
    const summary = edit.summary();
    expect(summary.sections).toHaveLength(2);
    expect(summary.sections[0]?.length).toBeCloseTo(30, 0);
    expect(summary.returnLength).toBeGreaterThan(0);
    expect(summary.canUndo).toBe(false);
  });

  it('adds after the selection, removes, duplicates and moves with undo and redo', () => {
    const edit = controller();
    const first = edit.idAt(0);
    edit.select(first);
    const loopId = edit.add('loop');
    expect(edit.summary().sections.map((s) => s.type)).toEqual(['straight', 'loop', 'hill']);
    expect(edit.summary().selectedId).toBe(loopId);

    const copy = edit.duplicate(loopId);
    expect(edit.summary().sections.map((s) => s.type)).toEqual([
      'straight',
      'loop',
      'loop',
      'hill',
    ]);
    expect(copy).not.toBeNull();

    expect(edit.moveBy(copy ?? '', 1)).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual([
      'straight',
      'loop',
      'hill',
      'loop',
    ]);

    expect(edit.remove(copy ?? '')).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual(['straight', 'loop', 'hill']);

    expect(edit.undo()).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual([
      'straight',
      'loop',
      'hill',
      'loop',
    ]);
    expect(edit.undo()).toBe(true);
    expect(edit.undo()).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual(['straight', 'loop', 'hill']);
    expect(edit.undo()).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual(['straight', 'hill']);
    expect(edit.undo()).toBe(false);
    expect(edit.redo()).toBe(true);
    expect(edit.summary().sections.map((s) => s.type)).toEqual(['straight', 'loop', 'hill']);
    expect(edit.summary().canRedo).toBe(true);
  });

  it('refuses to remove the last section', () => {
    const edit = controller();
    expect(edit.remove(edit.idAt(0) ?? '')).toBe(true);
    expect(edit.remove(edit.idAt(0) ?? '')).toBe(false);
  });

  it('records a whole slider drag as one history step', () => {
    const edit = controller();
    const id = edit.idAt(0) ?? '';
    edit.beginDrag(id, 'length');
    edit.preview(id, 'length', 40);
    edit.flush();
    edit.preview(id, 'length', 55);
    edit.flush();
    edit.preview(id, 'length', 62);
    edit.endDrag();
    expect(edit.summary().sections[0]?.params.length).toBe(62);
    expect(edit.summary().sections[0]?.length).toBeCloseTo(62, 0);
    expect(edit.undo()).toBe(true);
    expect(edit.summary().sections[0]?.params.length).toBe(30);
    expect(edit.undo()).toBe(false);
    expect(edit.redo()).toBe(true);
    expect(edit.summary().sections[0]?.params.length).toBe(62);
  });

  it('drops a drag that ends on its starting value', () => {
    const edit = controller();
    const id = edit.idAt(0) ?? '';
    edit.beginDrag(id, 'length');
    edit.preview(id, 'length', 45);
    edit.flush();
    edit.endDrag(30);
    expect(edit.summary().canUndo).toBe(false);
    expect(edit.summary().sections[0]?.params.length).toBe(30);
  });

  it('normalises direct param changes and records them', () => {
    const edit = controller();
    const id = edit.idAt(1) ?? '';
    edit.setParam(id, 'height', 500);
    expect(edit.summary().sections[1]?.params.height).toBe(40);
    edit.setParam(id, 'dive', true);
    expect(edit.summary().sections[1]?.params.dive).toBe(true);
    edit.setParam(id, 'nonsense', 1);
    expect(edit.undo()).toBe(true);
    expect(edit.summary().sections[1]?.params.dive).toBe(false);
  });
});
