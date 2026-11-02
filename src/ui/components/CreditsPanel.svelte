<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller }: { controller: Controller } = $props();

  function megabytes(bytes: number): string {
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }
</script>

<div class="overlay" transition:fade={{ duration: 160 }}>
  <button class="backdrop" onclick={controller.closeCredits} aria-label="Close the credits"
  ></button>
  <div class="sheet panel" role="dialog" aria-modal="true" aria-labelledby="credits-title">
    <div class="head">
      <div>
        <p class="eyebrow">Scenic Worlds</p>
        <h2 id="credits-title">Credits</h2>
      </div>
      <button class="button icon" onclick={controller.closeCredits} aria-label="Close">×</button>
    </div>
    <p class="intro">
      The Scenic Worlds are built from these models, each shared under the Creative Commons
      Attribution 4.0 licence. Every file was compressed and resized for real-time use; the
      originals are at the source links.
    </p>
    {#if ui.credits.length === 0}
      <p class="intro">Reading the manifest…</p>
    {:else}
      <ul class="list">
        {#each ui.credits as credit (credit.file)}
          <li class="credit">
            <span class="title">
              <a href={credit.source} target="_blank" rel="noopener noreferrer">{credit.title}</a>
            </span>
            <span class="by">
              by
              {#if credit.authorUrl}
                <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer"
                  >{credit.author}</a
                >
              {:else}
                {credit.author}
              {/if}
              ·
              {#if credit.licenseUrl}
                <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer"
                  >{credit.license}</a
                >
              {:else}
                {credit.license}
              {/if}
            </span>
            <span class="meta">{credit.file} · {megabytes(credit.bytes)} · {credit.modified}</span>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="intro small">
      Models are decoded with meshoptimizer (MIT licence), shipped with the app. Everything else in
      Loopwright is generated in code.
    </p>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 24;
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
    gap: 12px;
    width: min(620px, calc(100vw - 32px));
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
    margin: 4px 0 0;
    font-size: 22px;
  }

  .intro {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .intro.small {
    font-size: 12px;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .credit {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }

  .title {
    font-weight: 600;
  }

  .by {
    font-size: 13px;
  }

  .meta {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }

  a {
    color: var(--accent-text);
  }
</style>
