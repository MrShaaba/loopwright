<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  const fpsTone = $derived(ui.fps >= 55 ? 'ok' : ui.fps >= 30 ? 'warn' : 'danger');
  let tracksOpen = $state(false);
  let confirmId: string | null = $state(null);

  function openTracks(): void {
    tracksOpen = !tracksOpen;
    confirmId = null;
  }

  function choose(id: string): void {
    if (confirmId === id) {
      tracksOpen = false;
      confirmId = null;
      controller.loadStarter(id);
    } else {
      confirmId = id;
    }
  }
</script>

<header class="topbar" class:quiet={ui.mode === 'ride'}>
  <div class="brand panel">
    <span class="wordmark">Loopwright</span>
    <div class="tracks">
      <button
        class="track-name"
        onclick={openTracks}
        aria-expanded={tracksOpen}
        aria-haspopup="menu"
        title="Starter tracks"
      >
        {ui.track.name} <span class="caret" aria-hidden="true">▾</span>
      </button>
      {#if tracksOpen}
        <div class="menu panel" role="menu" aria-label="Starter tracks">
          <p class="eyebrow">Starter tracks</p>
          {#each controller.starters as starter (starter.id)}
            <button class="menu-item" role="menuitem" onclick={() => choose(starter.id)}>
              <span class="menu-label">
                {starter.name}
                {#if confirmId === starter.id}
                  <span class="confirm">Replace the current track?</span>
                {/if}
              </span>
              <span class="menu-description">{starter.tagline}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
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

  .tracks {
    position: relative;
  }

  .track-name {
    padding: 4px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .track-name:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
  }

  .caret {
    font-size: 10px;
  }

  .menu {
    position: absolute;
    left: 0;
    top: calc(100% + 10px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 320px;
    padding: 10px;
    background: var(--panel-strong);
    z-index: 6;
  }

  .menu .eyebrow {
    padding: 4px 8px 6px;
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
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
  }

  .confirm {
    color: var(--accent-text);
    font-size: 12px;
    font-weight: 500;
  }

  .menu-description {
    color: var(--muted);
    font-size: 12px;
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
