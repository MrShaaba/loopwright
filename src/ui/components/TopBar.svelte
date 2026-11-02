<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';
  import { locker } from '../state/locker.svelte';
  import SharePanel from './SharePanel.svelte';

  let { controller }: { controller: Controller } = $props();

  const fpsTone = $derived(ui.fps >= 55 ? 'ok' : ui.fps >= 30 ? 'warn' : 'danger');
  let tracksOpen = $state(false);
  let confirmId: string | null = $state(null);
  let themesOpen = $state(false);
  let shareOpen = $state(false);
  let lookTab: 'themes' | 'worlds' = $state('themes');

  // Open on the tab that matches what is showing.
  $effect(() => {
    if (themesOpen) lookTab = ui.world ? 'worlds' : 'themes';
  });

  function pickTheme(id: string): void {
    themesOpen = false;
    controller.setTheme(id);
  }

  function pickWorld(id: string): void {
    themesOpen = false;
    controller.enterWorld(id);
  }

  function pickNoWorld(): void {
    themesOpen = false;
    if (ui.world) controller.leaveWorld();
  }

  function openCredits(): void {
    themesOpen = false;
    controller.openCredits();
  }

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
    <div class="themes">
      <button
        class="theme-button"
        onclick={() => (themesOpen = !themesOpen)}
        aria-expanded={themesOpen}
        aria-haspopup="menu"
        title={ui.world ? 'Scenic World (Shift+T cycles)' : 'Theme (T cycles)'}
      >
        <span class="swatch" aria-hidden="true"></span>
        {ui.world ? ui.world.name : ui.theme.name}
        {#if ui.world}<span class="world-mark">world</span>{/if}
      </button>
      {#if themesOpen}
        <div class="menu theme-menu panel" role="menu" aria-label="Look">
          <div class="menu-tabs" role="tablist" aria-label="Look type">
            <button
              class="menu-tab"
              class:active={lookTab === 'themes'}
              role="tab"
              aria-selected={lookTab === 'themes'}
              onclick={() => (lookTab = 'themes')}
            >
              Themes <span class="kbd">T</span>
            </button>
            <button
              class="menu-tab"
              class:active={lookTab === 'worlds'}
              role="tab"
              aria-selected={lookTab === 'worlds'}
              onclick={() => (lookTab = 'worlds')}
            >
              Scenic Worlds <span class="kbd">⇧T</span>
            </button>
          </div>
          {#if lookTab === 'themes'}
            {#each controller.themes as theme (theme.id)}
              <button
                class="menu-item"
                class:current={!ui.world && theme.id === ui.theme.id}
                role="menuitemradio"
                aria-checked={!ui.world && theme.id === ui.theme.id}
                onclick={() => pickTheme(theme.id)}
              >
                <span class="menu-label">{theme.name}</span>
                <span class="menu-description">{theme.tagline}</span>
              </button>
            {/each}
          {:else}
            <button
              class="menu-item"
              class:current={!ui.world}
              role="menuitemradio"
              aria-checked={!ui.world}
              onclick={pickNoWorld}
            >
              <span class="menu-label">None</span>
              <span class="menu-description">Show the theme: {ui.theme.name}.</span>
            </button>
            {#each controller.worlds as world (world.id)}
              <button
                class="menu-item"
                class:current={ui.world?.id === world.id}
                class:placeholder={world.status === 'placeholder'}
                role="menuitemradio"
                aria-checked={ui.world?.id === world.id}
                disabled={world.status === 'placeholder'}
                onclick={() => pickWorld(world.id)}
              >
                <span class="menu-label">
                  {world.name}
                  {#if world.status === 'placeholder'}<span class="slot">slot open</span>{/if}
                </span>
                <span class="menu-description">{world.tagline}</span>
              </button>
              {#if ui.world?.id === world.id && world.skies.length > 1}
                <div class="variants" role="group" aria-label="Sky variant">
                  {#each world.skies as sky (sky.id)}
                    <button
                      class="variant"
                      class:active={ui.world?.skyId === sky.id}
                      aria-pressed={ui.world?.skyId === sky.id}
                      onclick={() => controller.enterWorld(world.id, sky.id)}
                    >
                      {sky.name}
                    </button>
                  {/each}
                </div>
              {/if}
            {/each}
            <p class="menu-note">
              Worlds are built from downloaded models under CC BY 4.0 and never change the track.
              <button class="link" onclick={openCredits}>Credits</button>
            </p>
          {/if}
        </div>
      {/if}
    </div>
    <span class="fps {fpsTone}" title="Frames per second · render scale 1/{ui.renderScale}">
      {ui.fps || '–'} fps{#if ui.renderScale > 1}<span class="scale">
          · {ui.renderScale}×</span
        >{/if}
    </span>
    <button
      class="button locker-button"
      onclick={controller.toggleLocker}
      aria-pressed={locker.open}
      title="Locker: skins, trails and achievements (L)"
    >
      <span class="gem" aria-hidden="true">◆</span>
      {locker.gems}
    </button>
    <div class="share-wrap">
      <button
        class="button"
        onclick={() => (shareOpen = !shareOpen)}
        aria-expanded={shareOpen}
        aria-haspopup="dialog"
      >
        Share
      </button>
      {#if shareOpen}
        <SharePanel {controller} close={() => (shareOpen = false)} />
      {/if}
    </div>
    <button
      class="button icon"
      onclick={controller.takePhoto}
      aria-label="Save a photo"
      title="Save a photo (O)"
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

  .themes {
    position: relative;
  }

  .theme-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    font-size: 13px;
    white-space: nowrap;
  }

  .theme-button:hover {
    background: rgba(255, 255, 255, 0.09);
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }

  .theme-menu {
    left: auto;
    right: 0;
    width: 360px;
  }

  .menu-tabs {
    display: flex;
    gap: 4px;
    margin: 2px 0 8px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
  }

  .menu-tab {
    flex: 1;
    min-height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    font-size: 12px;
  }

  .menu-tab.active {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .world-mark {
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .menu-item.placeholder {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .slot {
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }

  .variants {
    display: flex;
    gap: 4px;
    padding: 0 10px 8px;
  }

  .variant {
    min-height: 26px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--muted);
    font-size: 12px;
  }

  .variant.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .menu-note {
    margin: 6px 0 0;
    padding: 8px 8px 2px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font-size: 11px;
    text-decoration: underline;
  }

  .share-wrap {
    position: relative;
  }

  .locker-button {
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
  }

  .locker-button .gem {
    color: #ffb8ff;
    text-shadow: 0 0 8px #ff6ef5;
    font-family: var(--font);
  }

  .menu-item.current {
    background: var(--accent-soft);
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
    .fps,
    .theme-button {
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
