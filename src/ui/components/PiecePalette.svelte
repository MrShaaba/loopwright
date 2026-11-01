<script lang="ts">
  import type { Controller } from '../bridge';
  import { build } from '../state/build.svelte';

  let { controller }: { controller: Controller } = $props();

  const categories: { id: string; title: string }[] = [
    { id: 'basic', title: 'Track' },
    { id: 'hills', title: 'Hills' },
    { id: 'inversions', title: 'Inversions' },
    { id: 'special', title: 'Special' },
  ];

  const selected = $derived(build.palette.find((p) => p.id === build.selectedId) ?? null);
  const status = $derived.by(() => {
    const t = build.track;
    if (t.closed) return 'Circuit closed';
    if (t.pieces <= 1) return 'Start from the station';
    return `Open · ${t.distance.toFixed(1)} m and ${Math.round(t.headingDeg)}° from the station`;
  });
</script>

<div class="palette">
  <section class="summary" class:closed={build.track.closed}>
    <div class="stats">
      <span><strong>{build.track.pieces - 1}</strong> pieces</span>
      <span><strong>{Math.round(build.track.length)}</strong> m</span>
      <span><strong>{build.track.exitHeight.toFixed(1)}</strong> m high</span>
    </div>
    <p class="status">{status}</p>
  </section>

  <section class="actions">
    <button
      class="button"
      disabled={!build.canUndo}
      onclick={() => controller.undo()}
      title="Undo (Ctrl/Cmd+Z)"
    >
      Undo
    </button>
    <button
      class="button"
      disabled={!build.canRedo}
      onclick={() => controller.redo()}
      title="Redo (Shift+Ctrl/Cmd+Z)"
    >
      Redo
    </button>
    <button
      class="button"
      disabled={build.track.pieces <= 1}
      onclick={() => controller.removeLast()}
      title="Remove the last piece (Backspace)"
    >
      Remove last
    </button>
  </section>

  {#each categories as category (category.id)}
    <section class="group">
      <p class="eyebrow">{category.title}</p>
      <div class="pieces">
        {#each build.palette.filter((p) => p.category === category.id) as piece (piece.id)}
          <button
            class="piece"
            class:active={piece.id === build.selectedId}
            onclick={() => controller.selectPiece(piece.id === build.selectedId ? null : piece.id)}
            title={piece.description}
          >
            {piece.label}
          </button>
        {/each}
      </div>
    </section>
  {/each}

  {#if selected}
    <section class="detail">
      <p class="description">{selected.description}</p>
      {#each selected.params as param (param.key)}
        <div class="param">
          <span class="label">{param.label}</span>
          <div class="chips" role="group" aria-label={param.label}>
            {#each param.options as option (option.value)}
              <button
                class="chip"
                class:active={build.params[param.key] === option.value}
                onclick={() => controller.setParam(param.key, option.value)}
                aria-pressed={build.params[param.key] === option.value}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
      <button
        class="button primary place"
        disabled={!build.canPlace}
        onclick={() => controller.place()}
      >
        Place piece <span class="kbd">↵</span>
      </button>
      {#if build.reason}
        <p class="reason">{build.reason}</p>
      {:else}
        <p class="hint">Click the scene or press Enter to snap it on.</p>
      {/if}
    </section>
  {:else}
    <p class="hint">Pick a piece to preview it at the end of the track.</p>
  {/if}
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .summary {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line);
  }

  .summary.closed {
    border-color: rgba(122, 216, 142, 0.5);
  }

  .stats {
    display: flex;
    gap: 12px;
    color: var(--muted);
    font-size: 12px;
  }

  .stats strong {
    color: var(--text);
    font-weight: 600;
  }

  .status {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--moon);
  }

  .summary.closed .status {
    color: var(--ok);
  }

  .group .eyebrow {
    margin-bottom: 6px;
  }

  .pieces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .piece {
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    font-size: 13px;
  }

  .piece:hover {
    border-color: var(--line-strong);
  }

  .piece.active {
    background: var(--accent-soft);
    border-color: rgba(255, 166, 62, 0.55);
    color: #ffd9a8;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 166, 62, 0.3);
    background: rgba(255, 166, 62, 0.06);
  }

  .description {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .param {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    min-height: 26px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
  }

  .chip.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--line-strong);
  }

  .place {
    margin-top: 4px;
    justify-content: center;
  }

  .reason {
    margin: 0;
    color: var(--warn);
    font-size: 12px;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr;
    gap: 6px;
  }

  .actions .button {
    padding: 0 8px;
    font-size: 12px;
  }
</style>
