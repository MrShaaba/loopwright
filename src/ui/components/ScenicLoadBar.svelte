<script lang="ts">
  import { fade } from 'svelte/transition';
  import { ui } from '../state/game.svelte';

  const percent = $derived(Math.round((ui.scenicLoading?.fraction ?? 0) * 100));
</script>

{#if ui.scenicLoading}
  <div class="load panel" role="status" transition:fade={{ duration: 160 }}>
    <span class="text">Loading {ui.scenicLoading.name} · {percent}%</span>
    <div
      class="bar"
      role="progressbar"
      aria-label="World download"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
    >
      <div class="fill" style="width: {percent}%"></div>
    </div>
  </div>
{/if}

<style>
  .load {
    position: absolute;
    top: calc(72px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(320px, calc(100vw - 32px));
    padding: 10px 14px;
    background: var(--panel-strong);
    z-index: 7;
  }

  .text {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
  }

  .bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
    box-shadow: 0 0 10px var(--accent);
    transition: width 0.15s ease-out;
  }
</style>
