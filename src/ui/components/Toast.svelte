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
  <div
    class="toast panel"
    class:achievement={ui.toast.kind === 'achievement'}
    role="status"
    transition:fade={{ duration: 180 }}
  >
    {#if ui.toast.kind === 'achievement'}
      <span class="badge" aria-hidden="true">★</span>
      <span class="lines">
        <span class="title">{ui.toast.title}</span>
        <span>{ui.toast.text}</span>
      </span>
    {:else}
      {ui.toast.text}
    {/if}
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

  .toast.achievement {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px 10px 14px;
    border-color: var(--accent);
    text-align: left;
    box-shadow:
      var(--shadow),
      0 0 24px var(--accent-soft);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-size: 16px;
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .title {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-text);
  }

  @media (max-width: 900px) {
    .toast {
      bottom: calc(120px + var(--safe-bottom));
    }
  }
</style>
