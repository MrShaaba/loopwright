<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  const line = $derived(
    ui.world
      ? ui.world.credits
          .map((credit) => `${credit.title} by ${credit.author}, ${credit.license}`)
          .join(' · ')
      : '',
  );
</script>

{#if ui.world}
  <button
    class="credit"
    class:riding={ui.mode === 'ride'}
    onclick={controller.openCredits}
    title="Model credits"
  >
    {line}
  </button>
{/if}

<style>
  .credit {
    position: absolute;
    left: calc(14px + var(--safe-left));
    top: calc(66px + var(--safe-top));
    max-width: min(520px, calc(100vw - 28px));
    padding: 3px 8px;
    border: 0;
    border-radius: 8px;
    background: rgba(5, 6, 12, 0.35);
    color: var(--muted);
    font-size: 11px;
    line-height: 1.3;
    text-align: left;
    pointer-events: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .credit:hover {
    color: var(--text);
  }

  .credit.riding {
    top: auto;
    bottom: calc(70px + var(--safe-bottom));
  }

  @media (max-width: 900px) {
    .credit.riding {
      bottom: calc(190px + var(--safe-bottom));
    }
  }
</style>
