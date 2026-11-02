<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Controller } from '../bridge';
  import { paintSkinPreview } from '../skinPreview';
  import { ui } from '../state/game.svelte';
  import { locker, type LockerSkin, type LockerTab } from '../state/locker.svelte';

  let { controller }: { controller: Controller } = $props();

  const tabs: { id: LockerTab; label: string }[] = [
    { id: 'ball', label: 'Ball' },
    { id: 'trail', label: 'Trail' },
  ];

  function preview(
    canvas: HTMLCanvasElement,
    skin: LockerSkin,
  ): { update: (s: LockerSkin) => void } {
    const paint = (s: LockerSkin): void => paintSkinPreview(canvas, s.pattern, ui.theme.ball, 0.1);
    paint(skin);
    return { update: paint };
  }
</script>

<div class="overlay" transition:fade={{ duration: 160 }}>
  <button class="backdrop" onclick={controller.closeLocker} aria-label="Close the locker"></button>
  <div class="sheet panel" role="dialog" aria-modal="true" aria-labelledby="locker-title">
    <div class="head">
      <div>
        <p class="eyebrow">Locker</p>
        <h2 id="locker-title">
          <span class="gem">◆</span>
          {locker.gems}
          {locker.gems === 1 ? 'gem' : 'gems'} collected
        </h2>
        <p class="sub">
          {#if locker.next}
            {locker.next.remaining} more {locker.next.remaining === 1 ? 'gem' : 'gems'} unlocks the
            {locker.next.name}
            {locker.next.kind}.
          {:else}
            Everything is unlocked.
          {/if}
          {locker.rings} rings and {locker.laps}
          {locker.laps === 1 ? 'lap' : 'laps'} so far.
        </p>
      </div>
      <button class="button icon" onclick={controller.closeLocker} aria-label="Close">×</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Locker sections">
      {#each tabs as tab (tab.id)}
        <button
          class="tab"
          class:active={locker.tab === tab.id}
          role="tab"
          aria-selected={locker.tab === tab.id}
          onclick={() => controller.setLockerTab(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if locker.tab === 'ball'}
      <div class="grid">
        {#each locker.skins as skin (skin.id)}
          <button
            class="card"
            class:locked={!skin.unlocked}
            class:equipped={locker.skin === skin.id}
            disabled={!skin.unlocked}
            onclick={() => controller.equipSkin(skin.id)}
            title={skin.unlocked ? `Wear ${skin.name}` : `${skin.cost} gems to unlock`}
          >
            <canvas class="ball" width="72" height="72" use:preview={skin} aria-hidden="true"
            ></canvas>
            <span class="name">{skin.name}</span>
            <span class="description">{skin.description}</span>
            <span class="status">
              {#if locker.skin === skin.id}
                Equipped
              {:else if skin.unlocked}
                Unlocked
              {:else}
                <span class="gem">◆</span> {skin.cost}
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {:else if locker.tab === 'trail'}
      <div class="grid">
        {#each locker.trails as trail (trail.id)}
          <button
            class="card"
            class:locked={!trail.unlocked}
            class:equipped={locker.trail === trail.id}
            disabled={!trail.unlocked}
            onclick={() => controller.equipTrail(trail.id)}
            title={trail.unlocked ? `Use ${trail.name}` : `${trail.cost} gems to unlock`}
          >
            <span
              class="swatch"
              class:empty={trail.swatch === null}
              style="--c1: {trail.swatch?.[0] ?? 'transparent'}; --c2: {trail.swatch?.[1] ??
                'transparent'}"
              aria-hidden="true"
            >
              <span class="dot"></span>
            </span>
            <span class="name">{trail.name}</span>
            <span class="description">{trail.description}</span>
            <span class="status">
              {#if locker.trail === trail.id}
                Equipped
              {:else if trail.unlocked}
                Unlocked
              {:else}
                <span class="gem">◆</span> {trail.cost}
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
    <p class="hint">
      Gems count across every track. Ride in Game mode and hunt the three on each track.
      <span class="kbd">L</span> opens the locker anywhere.
    </p>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 22;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(5, 6, 12, 0.55);
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    padding: 18px 22px 20px;
    overflow-y: auto;
    background: var(--panel-strong);
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    margin: 4px 0 2px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .gem {
    color: #ffb8ff;
    text-shadow: 0 0 10px #ff6ef5;
  }

  .sub {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.25);
    align-self: flex-start;
  }

  .tab {
    min-height: 32px;
    padding: 0 18px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .tab.active {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 12px 12px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
    text-align: center;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.1s ease;
  }

  .card:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    border-color: var(--line-strong);
  }

  .card:active:not(:disabled) {
    transform: translateY(1px);
  }

  .card.equipped {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .card.locked {
    cursor: not-allowed;
  }

  .card.locked .ball,
  .card.locked .swatch {
    filter: grayscale(0.9) brightness(0.45);
  }

  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .ball {
    width: 72px;
    height: 72px;
  }

  .swatch {
    position: relative;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .swatch::before {
    content: '';
    position: absolute;
    left: 2px;
    right: 34px;
    top: 50%;
    height: 10px;
    transform: translateY(-50%);
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, var(--c2), var(--c1));
    filter: blur(1px);
    opacity: 0.9;
  }

  .swatch.empty::before {
    display: none;
  }

  .dot {
    position: absolute;
    right: 14px;
    top: 50%;
    width: 22px;
    height: 22px;
    transform: translateY(-50%);
    border-radius: 50%;
    background: radial-gradient(circle at 38% 36%, #fff8e6, var(--accent) 65%, transparent 72%);
    box-shadow: 0 0 14px var(--accent);
  }

  .name {
    font-weight: 600;
  }

  .description {
    min-height: 2.8em;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.35;
  }

  .status {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .card.equipped .status {
    color: var(--accent-text);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }
</style>
