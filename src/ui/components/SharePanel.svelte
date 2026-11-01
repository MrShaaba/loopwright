<script lang="ts">
  import type { Controller } from '../bridge';
  import { ui } from '../state/game.svelte';

  let { controller, close }: { controller: Controller; close: () => void } = $props();

  let fileInput: HTMLInputElement | undefined = $state();

  function onName(event: Event): void {
    controller.rename((event.currentTarget as HTMLInputElement).value);
  }

  function onFile(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) controller.importJson(file);
    input.value = '';
    close();
  }

  function copy(): void {
    void controller.copyLink();
  }
</script>

<div class="share panel" role="dialog" aria-label="Share this track">
  <label class="name">
    <span class="eyebrow">Track name</span>
    <input type="text" value={ui.track.name} maxlength="48" onchange={onName} />
  </label>
  <div class="actions">
    <button class="button primary" onclick={copy}>Copy link</button>
    <button class="button" onclick={controller.exportJson}>Export JSON</button>
    <button class="button" onclick={() => fileInput?.click()}>Import JSON</button>
    <button class="button" onclick={controller.takePhoto}>Photo <span class="kbd">O</span></button>
  </div>
  <p class="hint">
    The link holds the whole track, so it works without any server. The address bar keeps it current
    as you edit.
  </p>
  <input
    bind:this={fileInput}
    class="file"
    type="file"
    accept=".json,application/json"
    onchange={onFile}
    aria-hidden="true"
    tabindex="-1"
  />
</div>

<style>
  .share {
    position: absolute;
    right: 0;
    top: calc(100% + 10px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(360px, calc(100vw - 28px));
    padding: 14px;
    background: var(--panel-strong);
    z-index: 6;
  }

  .name {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  input[type='text'] {
    min-height: 36px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
    color: var(--text);
    font: inherit;
  }

  input[type='text']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .file {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
  }
</style>
