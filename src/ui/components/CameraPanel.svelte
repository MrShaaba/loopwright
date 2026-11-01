<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  const hint = $derived(
    ui.cameraMode === 'orbit'
      ? 'Drag to orbit · right-drag to pan · scroll to zoom'
      : 'Click to look · WASD to move · Q/E down and up · Shift to hurry',
  );
</script>

<div class="camera panel">
  <div class="row">
    <p class="eyebrow">Camera</p>
    <div class="segmented" role="group" aria-label="Camera mode">
      <button
        class="segment"
        class:active={ui.cameraMode === 'orbit'}
        onclick={() => controller.setCameraMode('orbit')}
        aria-pressed={ui.cameraMode === 'orbit'}
      >
        Orbit
      </button>
      <button
        class="segment"
        class:active={ui.cameraMode === 'fly'}
        onclick={() => controller.setCameraMode('fly')}
        aria-pressed={ui.cameraMode === 'fly'}
      >
        Fly
      </button>
    </div>
  </div>
  <div class="presets">
    {#each controller.presets as preset, index (preset.id)}
      <button class="button" onclick={() => controller.flyTo(preset.id)}>
        <span class="kbd">{index + 1}</span>
        {preset.label}
      </button>
    {/each}
  </div>
  <p class="hint">{hint}</p>
</div>

<style>
  .camera {
    position: absolute;
    right: calc(12px + var(--safe-right));
    bottom: calc(12px + var(--safe-bottom));
    width: 336px;
    padding: 12px 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .segmented {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.25);
  }

  .segment {
    min-height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }

  .segment.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text);
  }

  .presets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .presets .button {
    padding: 0 6px;
    font-size: 13px;
    white-space: nowrap;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 900px) {
    .camera {
      width: auto;
      left: calc(12px + var(--safe-left));
      right: calc(12px + var(--safe-right));
      bottom: calc(12px + var(--safe-bottom));
    }

    .hint {
      display: none;
    }
  }
</style>
