<script lang="ts">
  import { describeSection } from '../../engine/track/sections/describe';
  import type { Controller } from '../bridge';
  import { edit } from '../state/edit.svelte';
  import { ui } from '../state/game.svelte';
  import { play } from '../state/play.svelte';

  let { controller }: { controller: Controller } = $props();

  let strip: HTMLDivElement | undefined = $state();

  const errors = $derived(edit.issues.filter((issue) => issue.severity === 'error').length);
  const warnings = $derived(edit.issues.length - errors);
  const checksLabel = $derived(
    errors > 0
      ? `${errors} problem${errors === 1 ? '' : 's'}`
      : warnings > 0
        ? `${warnings} note${warnings === 1 ? '' : 's'}`
        : 'Ready to ride',
  );

  function pick(type: (typeof edit.defs)[number]['type']): void {
    edit.addMenuOpen = false;
    controller.addSection(type);
  }

  function worstFor(index: number): 'error' | 'warning' | null {
    let worst: 'error' | 'warning' | null = null;
    for (const issue of edit.issues) {
      if (issue.sectionIndex !== index) continue;
      if (issue.severity === 'error') return 'error';
      worst = 'warning';
    }
    return worst;
  }

  function show(index: number): void {
    edit.checksOpen = false;
    controller.showIssue(index);
  }

  // Keep the selected chip in view when the selection changes.
  $effect(() => {
    const id = edit.selectedId;
    if (!id || !strip) return;
    const chip = strip.querySelector<HTMLElement>(`[data-id="${id}"]`);
    chip?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
</script>

<div class="dock panel">
  <div class="head">
    <div class="title">
      <p class="eyebrow">Track</p>
      <p class="line">
        <strong>{ui.track.name}</strong>
        <span class="muted">· {Math.round(ui.track.length)} m</span>
      </p>
    </div>
    <div class="tools">
      <div class="checks">
        <button
          class="pill"
          class:error={errors > 0}
          class:warning={errors === 0 && warnings > 0}
          class:ok={edit.issues.length === 0}
          onclick={() => (edit.checksOpen = !edit.checksOpen)}
          aria-expanded={edit.checksOpen}
          aria-haspopup="dialog"
        >
          <span class="dot" aria-hidden="true"></span>
          {checksLabel}
        </button>
        {#if edit.checksOpen}
          <div class="checklist panel" role="dialog" aria-label="Track checks">
            {#if edit.issues.length === 0}
              <p class="check-ok">The track closes, stays above the floor and clears itself.</p>
            {:else}
              {#each edit.issues as issue, index (index)}
                <div class="check" class:error={issue.severity === 'error'}>
                  <span class="dot" aria-hidden="true"></span>
                  <p class="check-text">{issue.message}</p>
                  <button class="button small" onclick={() => show(index)}>Show</button>
                </div>
              {/each}
              {#if errors > 0}
                <p class="check-note">Problems block the ride. Notes are only advice.</p>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      <button
        class="button"
        class:on={play.showItems}
        onclick={controller.toggleItems}
        aria-pressed={play.showItems}
        title="Show the rings, gems, pads and barriers while editing"
      >
        Items
      </button>
      <button
        class="button"
        onclick={controller.reshuffleItems}
        title="A new item layout for this track"
      >
        Reshuffle
      </button>
      <button
        class="button icon"
        onclick={controller.undo}
        disabled={!edit.canUndo}
        aria-label="Undo"
        title="Undo (⌘Z)"
      >
        ↶
      </button>
      <button
        class="button icon"
        onclick={controller.redo}
        disabled={!edit.canRedo}
        aria-label="Redo"
        title="Redo (⇧⌘Z)"
      >
        ↷
      </button>
      <button
        class="button primary"
        class:blocked={errors > 0}
        onclick={() => controller.requestMode('ride')}
        title={errors > 0 ? 'Fix the problems first' : 'Ride (Enter)'}
      >
        Ride <span class="kbd">Enter</span>
      </button>
    </div>
  </div>

  <div class="strip" bind:this={strip} role="listbox" aria-label="Track sections">
    {#each edit.sections as section, index (section.id)}
      {@const worst = worstFor(index)}
      <button
        class="chip"
        class:selected={section.id === edit.selectedId}
        data-id={section.id}
        role="option"
        aria-selected={section.id === edit.selectedId}
        onclick={() => controller.selectSection(section.id, true)}
      >
        <span class="index">{index + 1}</span>
        <span class="name">
          {describeSection(section.type, section.params)}
          {#if worst}
            <span class="flag {worst}" aria-label={worst}></span>
          {/if}
        </span>
        <span class="length">{Math.round(section.length)} m</span>
      </button>
    {/each}
    <div class="chip return" title="Added automatically so the track always closes">
      <span class="index">↺</span>
      <span class="name">Return</span>
      <span class="length">{Math.round(edit.returnLength)} m</span>
    </div>
    <div class="add">
      <button
        class="button add-button"
        onclick={() => (edit.addMenuOpen = !edit.addMenuOpen)}
        aria-expanded={edit.addMenuOpen}
        aria-haspopup="menu"
      >
        + Add
      </button>
      {#if edit.addMenuOpen}
        <div class="menu panel" role="menu">
          {#each edit.defs as def (def.type)}
            <button class="menu-item" role="menuitem" onclick={() => pick(def.type)}>
              <span class="menu-label">{def.label}</span>
              <span class="menu-description">{def.description}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dock {
    position: absolute;
    left: calc(14px + var(--safe-left));
    right: calc(14px + var(--safe-right));
    bottom: calc(14px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px 14px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .line {
    margin: 0;
    font-size: 15px;
  }

  .muted {
    color: var(--muted);
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .checks {
    position: relative;
    margin-right: 6px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    font-size: 13px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    flex-shrink: 0;
  }

  .pill.ok .dot,
  .check-ok::before {
    background: var(--ok);
    box-shadow: 0 0 8px var(--ok);
  }

  .pill.warning .dot,
  .check .dot {
    background: var(--warn);
    box-shadow: 0 0 8px var(--warn);
  }

  .pill.error .dot,
  .check.error .dot {
    background: var(--danger);
    box-shadow: 0 0 8px var(--danger);
  }

  .checklist {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(420px, calc(100vw - 48px));
    padding: 12px;
    background: var(--panel-strong);
    z-index: 5;
  }

  .check {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    border-top: 1px solid var(--line);
  }

  .check:first-child {
    border-top: 0;
  }

  .check-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.35;
  }

  .check-ok {
    margin: 0;
    padding: 4px;
    font-size: 13px;
    color: var(--text);
  }

  .check-note {
    margin: 2px 4px 0;
    font-size: 12px;
    color: var(--muted);
  }

  .button.small {
    min-height: 28px;
    padding: 0 10px;
    font-size: 12px;
  }

  .button.on {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  .button.blocked {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(255, 92, 108, 0.12);
  }

  .flag {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-left: 6px;
    border-radius: 50%;
    vertical-align: middle;
  }

  .flag.error {
    background: var(--danger);
    box-shadow: 0 0 6px var(--danger);
  }

  .flag.warning {
    background: var(--warn);
    box-shadow: 0 0 6px var(--warn);
  }

  .strip {
    display: flex;
    align-items: stretch;
    gap: 8px;
    overflow-x: auto;
    overflow-y: visible;
    padding: 4px 2px 6px;
    scrollbar-width: thin;
  }

  .chip {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 8px;
    align-items: baseline;
    min-width: 128px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    text-align: left;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }

  .chip.return {
    border-style: dashed;
    color: var(--muted);
    cursor: default;
  }

  .index {
    grid-row: 1 / span 2;
    align-self: center;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }

  .name {
    font-weight: 600;
    white-space: nowrap;
  }

  .length {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }

  .add {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .add-button {
    min-height: 100%;
    border-style: dashed;
  }

  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    display: grid;
    grid-template-columns: repeat(3, minmax(170px, 1fr));
    gap: 4px;
    width: max-content;
    max-width: min(640px, calc(100vw - 48px));
    padding: 8px;
    background: var(--panel-strong);
    z-index: 5;
  }

  .menu-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .menu-label {
    font-weight: 600;
  }

  .menu-description {
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 900px) {
    .menu {
      grid-template-columns: 1fr 1fr;
      max-width: calc(100vw - 48px);
    }

    .title .muted {
      display: none;
    }
  }
</style>
