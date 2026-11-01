import { describe, expect, it } from 'vitest';
import { GhostRecorder } from './ghost';
import { loadGhost, saveGhost, type GhostStore } from './ghostStore';

function memoryStore(): GhostStore & { text: string | null } {
  const store = {
    text: null as string | null,
    read: () => store.text,
    write: (text: string) => {
      store.text = text;
    },
  };
  return store;
}

function ghost(lapTime: number) {
  const recorder = new GhostRecorder(2);
  recorder.record(0, 0, 0, 0);
  recorder.record(lapTime / 2, 10, 0.3, 1);
  return recorder.finish(lapTime, 20);
}

describe('ghost store', () => {
  it('saves and loads a ghost per key and keeps the newest twelve', () => {
    const store = memoryStore();
    expect(loadGhost('a', store)).toBeNull();
    saveGhost('a', ghost(30), store);
    saveGhost('a', ghost(28), store);
    expect(loadGhost('a', store)?.lapTime).toBe(28);
    for (let i = 0; i < 14; i++) saveGhost(`k${i}`, ghost(40 + i), store);
    expect(loadGhost('a', store)).toBeNull();
    expect(loadGhost('k13', store)?.lapTime).toBe(53);
    expect(loadGhost('k1', store)).toBeNull();
    expect(loadGhost('k2', store)?.lapTime).toBe(42);
  });

  it('ignores broken storage', () => {
    const store = memoryStore();
    store.text = '{"a": {"lapTime": "x"}, "b": 5}';
    expect(loadGhost('a', store)).toBeNull();
    saveGhost('c', ghost(10), store);
    expect(loadGhost('c', store)?.lapTime).toBe(10);
  });
});
