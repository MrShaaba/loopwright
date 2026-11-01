<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();
</script>

<div class="editbar panel">
  <div class="summary">
    <p class="eyebrow">Track</p>
    <p class="line">
      <strong>{ui.track.name}</strong>
      <span class="muted">· {Math.round(ui.track.length)} m · {ui.track.sections} sections</span>
    </p>
    <p class="muted hint">Sliders, the timeline and the inspector arrive in the next step.</p>
  </div>
  <div class="actions">
    <button class="button" onclick={() => controller.frameTrack()}>
      Frame <span class="kbd">1</span>
    </button>
    <button class="button primary" onclick={() => controller.requestMode('ride')}>
      Ride <span class="kbd">Enter</span>
    </button>
  </div>
</div>

<style>
  .editbar {
    position: absolute;
    left: 50%;
    bottom: calc(22px + var(--safe-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    width: min(680px, calc(100vw - 32px));
    padding: 14px 20px;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .line {
    margin: 0;
    font-size: 15px;
  }

  .muted {
    color: var(--muted);
  }

  .hint {
    margin: 2px 0 0;
    font-size: 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .hint {
      display: none;
    }
  }
</style>
