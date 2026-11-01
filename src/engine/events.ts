type Handler<T> = (payload: T) => void;

/**
 * Minimal typed event emitter. The engine talks to the UI layer only through this,
 * so the Babylon code never imports Svelte and the UI never reaches into the scene.
 */
export class Emitter<E extends object> {
  private readonly handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const stored = handler as Handler<never>;
    set.add(stored);
    return () => {
      set.delete(stored);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Handler<E[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
