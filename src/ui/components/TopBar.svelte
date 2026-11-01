<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  const fpsTone = $derived(ui.fps >= 55 ? 'ok' : ui.fps >= 30 ? 'warn' : 'danger');
</script>

<header class="topbar panel">
  <div class="brand">
    <button
      class="button icon dock-toggle"
      onclick={controller.toggleDock}
      aria-label={ui.dockOpen ? 'Hide the side panel' : 'Show the side panel'}
      aria-pressed={ui.dockOpen}
    >
      <span class="burger" aria-hidden="true"></span>
    </button>
    <span class="wordmark">Loopwright</span>
    <span class="theme">{ui.theme.name}</span>
  </div>

  <nav class="tabs" aria-label="Mode">
    <button
      class="tab"
      class:active={ui.mode === 'build'}
      onclick={() => controller.requestMode('build')}
      aria-pressed={ui.mode === 'build'}
    >
      Build
    </button>
    <button
      class="tab"
      class:active={ui.mode === 'ride'}
      onclick={() => controller.requestMode('ride')}
      aria-pressed={ui.mode === 'ride'}
      title="Ride mode arrives in Phase 3"
    >
      Ride <span class="soon">soon</span>
    </button>
  </nav>

  <div class="meters">
    <span class="fps {fpsTone}" title="Frames per second · render scale 1/{ui.renderScale}">
      {ui.fps || '–'} fps{#if ui.renderScale > 1}<span class="scale">
          · {ui.renderScale}×</span
        >{/if}
    </span>
    <button
      class="button icon"
      onclick={controller.takePhoto}
      aria-label="Save a photo"
      title="Save a photo (P)"
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
    top: calc(12px + var(--safe-top));
    left: calc(12px + var(--safe-left));
    right: calc(12px + var(--safe-right));
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    height: 52px;
    padding: 0 10px 0 8px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .wordmark {
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .theme {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: #ffd9a8;
    font-size: 12px;
    white-space: nowrap;
  }

  .burger {
    position: relative;
    display: block;
    width: 14px;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }

  .burger::before,
  .burger::after {
    content: '';
    position: absolute;
    left: 0;
    width: 14px;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }

  .burger::before {
    top: -5px;
  }

  .burger::after {
    top: 5px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
  }

  .tab {
    min-height: 30px;
    padding: 0 16px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .tab.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text);
  }

  .soon {
    margin-left: 4px;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .meters {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .fps {
    min-width: 64px;
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.25);
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

    .theme {
      display: none;
    }

    .tabs {
      justify-self: center;
    }

    .fps {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .wordmark {
      display: none;
    }
  }
</style>
