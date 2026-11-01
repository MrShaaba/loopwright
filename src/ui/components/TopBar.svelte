<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  const fpsTone = $derived(ui.fps >= 55 ? 'ok' : ui.fps >= 30 ? 'warn' : 'danger');
</script>

<header class="topbar" class:quiet={ui.mode === 'ride'}>
  <div class="brand panel">
    <span class="wordmark">Loopwright</span>
    <span class="track-name">{ui.track.name}</span>
  </div>

  <nav class="tabs panel" aria-label="Mode">
    <button
      class="tab"
      class:active={ui.mode === 'edit'}
      onclick={() => controller.requestMode('edit')}
      aria-pressed={ui.mode === 'edit'}
    >
      Edit
    </button>
    <button
      class="tab"
      class:active={ui.mode === 'ride'}
      onclick={() => controller.requestMode('ride')}
      aria-pressed={ui.mode === 'ride'}
      title="Ride (Enter)"
    >
      Ride
    </button>
  </nav>

  <div class="meters panel">
    <span class="fps {fpsTone}" title="Frames per second · render scale 1/{ui.renderScale}">
      {ui.fps || '–'} fps{#if ui.renderScale > 1}<span class="scale">
          · {ui.renderScale}×</span
        >{/if}
    </span>
    <button
      class="button icon"
      onclick={controller.takePhoto}
      aria-label="Save a photo"
      title="Save a photo (C)"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path
          d="M4 6h3l1.2-2h3.6L13 6h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
    <button
      class="button icon"
      onclick={controller.toggleHelp}
      aria-label="Keyboard shortcuts"
      aria-pressed={ui.helpOpen}
      title="Keyboard shortcuts (?)"
    >
      ?
    </button>
  </div>
</header>

<style>
  .topbar {
    position: absolute;
    top: calc(14px + var(--safe-top));
    left: calc(14px + var(--safe-left));
    right: calc(14px + var(--safe-right));
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    transition: opacity 0.3s ease;
  }

  .topbar.quiet .brand,
  .topbar.quiet .meters {
    opacity: 0.55;
  }

  .brand {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
    padding: 0 16px;
  }

  .wordmark {
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .track-name {
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
  }

  .tab {
    min-height: 34px;
    padding: 0 20px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .tab.active {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .meters {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 8px 0 10px;
  }

  .fps {
    min-width: 64px;
    font-family: var(--mono);
    font-size: 12px;
    text-align: right;
  }

  .fps.ok {
    color: var(--ok);
  }

  .fps.warn {
    color: var(--warn);
  }

  .fps.danger {
    color: var(--danger);
  }

  .scale {
    color: var(--muted);
  }

  @media (max-width: 900px) {
    .topbar {
      grid-template-columns: auto 1fr auto;
      gap: 8px;
    }

    .track-name,
    .fps {
      display: none;
    }

    .tabs {
      justify-self: center;
    }
  }

  @media (max-width: 560px) {
    .brand {
      display: none;
    }
  }
</style>
