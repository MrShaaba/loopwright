export type KeyMode = 'build' | 'ride';
export type KeyScope = KeyMode | 'global';

/** The subset of KeyboardEvent the registry reads, so tests can feed plain objects. */
export interface KeyInput {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface KeyBinding {
  scope: KeyScope;
  /** `KeyboardEvent.code` with optional `mod+`, `shift+`, `alt+` prefixes, e.g. `mod+KeyZ`. */
  combo: string;
  label: string;
  handler: () => void;
  /** Optional guard; the binding is skipped when it returns false. */
  when?: () => boolean;
}

interface ParsedCombo {
  code: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export function parseCombo(combo: string): ParsedCombo {
  const parts = combo.split('+');
  const code = parts.pop();
  if (!code) throw new Error(`Empty key combo: "${combo}"`);
  return {
    code,
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

const CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: 'Backspace',
  Slash: '/',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** Human-readable form of a combo for the help overlay, e.g. `⌘Z` on Mac and `Ctrl+Z` elsewhere. */
export function describeCombo(combo: string, isMac: boolean): string {
  const parsed = parseCombo(combo);
  let key = CODE_LABELS[parsed.code] ?? parsed.code;
  if (parsed.code.startsWith('Key')) key = parsed.code.slice(3);
  if (parsed.code.startsWith('Digit')) key = parsed.code.slice(5);
  if (parsed.code === 'Slash' && parsed.shift) return '?';
  const parts: string[] = [];
  if (parsed.mod) parts.push(isMac ? '⌘' : 'Ctrl');
  if (parsed.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (parsed.shift) parts.push(isMac ? '⇧' : 'Shift');
  parts.push(key);
  return parts.join(isMac ? '' : '+');
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Keyboard bindings scoped by game mode. The help overlay is generated from `list()`,
 * so a binding only exists in one place.
 */
export class KeyRegistry {
  mode: KeyMode = 'build';
  private readonly bindings: (KeyBinding & { parsed: ParsedCombo })[] = [];

  bind(binding: KeyBinding): () => void {
    const entry = { ...binding, parsed: parseCombo(binding.combo) };
    this.bindings.push(entry);
    return () => {
      const index = this.bindings.indexOf(entry);
      if (index >= 0) this.bindings.splice(index, 1);
    };
  }

  list(): readonly KeyBinding[] {
    return this.bindings.map(({ parsed: _parsed, ...binding }) => binding);
  }

  /** Returns true when a binding handled the input. */
  dispatch(input: KeyInput): boolean {
    const mod = Boolean(input.ctrlKey ?? false) || Boolean(input.metaKey ?? false);
    const shift = input.shiftKey ?? false;
    const alt = input.altKey ?? false;
    for (const binding of this.bindings) {
      if (binding.scope !== 'global' && binding.scope !== this.mode) continue;
      const p = binding.parsed;
      if (p.code !== input.code || p.mod !== mod || p.shift !== shift || p.alt !== alt) continue;
      if (binding.when && !binding.when()) continue;
      binding.handler();
      return true;
    }
    return false;
  }

  /** Listens on the window; ignores keys typed into form fields. */
  attach(target: Window): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || isTextTarget(event.target)) return;
      if (this.dispatch(event)) event.preventDefault();
    };
    target.addEventListener('keydown', onKeyDown);
    return () => {
      target.removeEventListener('keydown', onKeyDown);
    };
  }
}
