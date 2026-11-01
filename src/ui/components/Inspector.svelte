<script lang="ts">
  import type { ParamValue } from '../../engine/track/sections/types';
  import type { Controller } from '../bridge';
  import { edit } from '../state/edit.svelte';

  let { controller }: { controller: Controller } = $props();

  const selected = $derived(edit.sections.find((s) => s.id === edit.selectedId) ?? null);
  const def = $derived(selected ? (edit.defs.find((d) => d.type === selected.type) ?? null) : null);
  const index = $derived(edit.sections.findIndex((s) => s.id === edit.selectedId));

  function asNumber(value: ParamValue | undefined, fallback: number): number {
    return typeof value === 'number' ? value : fallback;
  }

  function format(value: number, step: number, unit: string | undefined): string {
    const decimals = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
    return `${value.toFixed(decimals)}${unit === '°' ? '°' : unit ? ` ${unit}` : ''}`;
  }

  function onInput(id: string, key: string, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    controller.previewParam(id, key, Number(input.value));
  }

  function onChange(id: string, key: string, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    controller.endDrag(Number(input.value));
    void id;
    void key;
  }
</script>

{#if selected && def}
  <aside class="inspector panel" aria-label="Section inspector">
    <div class="head">
      <div>
        <p class="eyebrow">Section {index + 1}</p>
        <h2>{def.label}</h2>
      </div>
      <button
        class="button icon"
        onclick={() => controller.selectSection(null)}
        aria-label="Close"
        title="Close (Esc)"
      >
        ×
      </button>
    </div>
    <p class="description">{def.description}</p>

    <div class="params">
      {#each def.params as spec (spec.key)}
        {#if spec.kind === 'number'}
          {@const value = asNumber(selected.params[spec.key], spec.default)}
          <label class="param">
            <span class="row">
              <span class="label">{spec.label}</span>
              <span class="value">{format(value, spec.step, spec.unit)}</span>
            </span>
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              {value}
              onpointerdown={() => controller.beginDrag(selected.id, spec.key)}
              oninput={(event) => onInput(selected.id, spec.key, event)}
              onchange={(event) => onChange(selected.id, spec.key, event)}
            />
          </label>
        {:else if spec.kind === 'boolean'}
          <label class="param toggle">
            <span class="label">{spec.label}</span>
            <input
              type="checkbox"
              checked={selected.params[spec.key] === true}
              onchange={(event) =>
                controller.setParam(selected.id, spec.key, event.currentTarget.checked)}
            />
            <span class="switch" aria-hidden="true"></span>
          </label>
        {:else}
          <div class="param">
            <span class="label">{spec.label}</span>
            <div class="segmented" role="group" aria-label={spec.label}>
              {#each spec.options as option (option)}
                <button
                  class="segment"
                  class:active={selected.params[spec.key] === option}
                  aria-pressed={selected.params[spec.key] === option}
                  onclick={() => controller.setParam(selected.id, spec.key, option)}
                >
                  {option}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <div class="actions">
      <button
        class="button icon"
        onclick={() => controller.moveSection(-1)}
        disabled={index <= 0}
        aria-label="Move earlier"
        title="Move earlier"
      >
        ◀
      </button>
      <button
        class="button icon"
        onclick={() => controller.moveSection(1)}
        disabled={index >= edit.sections.length - 1}
        aria-label="Move later"
        title="Move later"
      >
        ▶
      </button>
      <button class="button" onclick={controller.duplicateSection} title="Duplicate (⌘D)">
        Duplicate
      </button>
      <button
        class="button danger"
        onclick={controller.removeSection}
        disabled={edit.sections.length <= 1}
        title="Remove (Delete)"
      >
        Remove
      </button>
    </div>
  </aside>
{/if}

<style>
  .inspector {
    position: absolute;
    top: calc(76px + var(--safe-top));
    right: calc(14px + var(--safe-right));
    width: min(320px, calc(100vw - 28px));
    max-height: calc(100vh - 230px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
    overflow-y: auto;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 2px 0 0;
    font-size: 18px;
  }

  .description {
    margin: 0;
    color: var(--muted);
    font-size: 12.5px;
  }

  .params {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .param {
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: auto;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .label {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .value {
    font-family: var(--mono);
    font-size: 12px;
  }

  input[type='range'] {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
  }

  .toggle {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch {
    position: relative;
    width: 38px;
    height: 22px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.12);
    transition: background 0.15s ease;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--text);
    transition: transform 0.15s ease;
  }

  .toggle input:checked + .switch {
    background: var(--accent);
  }

  .toggle input:checked + .switch::after {
    transform: translateX(16px);
  }

  .toggle input:focus-visible + .switch {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .segmented {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.25);
  }

  .segment {
    flex: 1;
    min-height: 28px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    text-transform: capitalize;
  }

  .segment.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text);
  }

  .actions {
    display: flex;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }

  .actions .button:not(.icon) {
    flex: 1;
  }

  .button.danger {
    color: var(--danger);
  }

  @media (max-width: 900px) {
    .inspector {
      top: auto;
      bottom: calc(150px + var(--safe-bottom));
      right: calc(14px + var(--safe-right));
      left: calc(14px + var(--safe-left));
      width: auto;
      max-height: 44vh;
    }
  }
</style>
