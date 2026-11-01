<script lang="ts">
  import { fade } from 'svelte/transition';
  import { ui } from '../state/game.svelte';

  let visible = $state(false);

  $effect(() => {
    const { id, text } = ui.toast;
    if (id === 0 || !text) return;
    visible = true;
    const timer = setTimeout(() => {
      visible = false;
    }, 3200);
    return () => clearTimeout(timer);
  });
</script>

{#if visible}
  <div class="toast panel" role="status" transition:fade={{ duration: 180 }}>
    {ui.toast.text}
  </div>
{/if}

<style>
  .toast {
    position: absolute;
    left: 50%;
    bottom: calc(68px + var(--safe-bottom));
    transform: translateX(-50%);
    max-width: min(520px, calc(100vw - 32px));
    padding: 10px 16px;
    background: var(--panel-strong);
    font-size: 13px;
    text-align: center;
  }

  @media (max-width: 900px) {
    .toast {
      bottom: calc(120px + var(--safe-bottom));
    }
  }
</style>
