<script lang="ts">
  import { fade } from 'svelte/transition';
  import { describeCombo, type KeyScope } from '../../engine/input/Keys';
  import type { Controller } from '../bridge';

  let { controller }: { controller: Controller } = $props();

  const groups: { scope: KeyScope; title: string }[] = [
    { scope: 'global', title: 'Anywhere' },
    { scope: 'edit', title: 'Editor' },
    { scope: 'ride', title: 'Ride mode' },
  ];

  const gamepad = [
    ['Left stick or D-pad', 'Steer around the tube'],
    ['Right trigger', 'Speed multiplier up, left trigger down'],
    ['A', 'Hold to boost'],
    ['B', 'Ride, go again, or back to the editor'],
    ['Start', 'Pause and resume'],
    ['X', 'Switch between the Inside and Follow views'],
  ];

  const mouse = [
    ['← → or A D', 'Steer around the tube while riding'],
    ['Click the tube', 'Select that section'],
    ['Drag', 'Orbit around the track'],
    ['Right-drag', 'Pan across the floor'],
    ['Scroll', 'Zoom in and out'],
    ['Click in Fly mode', 'Capture the mouse to look around'],
  ];

  const rows = $derived(
    groups
      .map((group) => {
        const items: { label: string; combos: string[] }[] = [];
        for (const binding of controller.bindings) {
          if (binding.scope !== group.scope) continue;
          const combo = describeCombo(binding.combo, controller.isMac);
          const existing = items.find((item) => item.label === binding.label);
          if (existing) existing.combos.push(combo);
          else items.push({ label: binding.label, combos: [combo] });
        }
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0),
  );
</script>

<div class="overlay" transition:fade={{ duration: 160 }}>
  <button class="backdrop" onclick={controller.toggleHelp} aria-label="Close shortcuts"></button>
  <div class="sheet panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <div class="head">
      <h2 id="help-title">Shortcuts</h2>
      <div class="head-actions">
        <button
          class="button"
          onclick={() => {
            controller.toggleHelp();
            controller.openHowToPlay();
          }}
        >
          How to play
        </button>
        <button class="button icon" onclick={controller.toggleHelp} aria-label="Close">×</button>
      </div>
    </div>
    <div class="columns">
      {#each rows as group (group.scope)}
        <section>
          <p class="eyebrow">{group.title}</p>
          <dl>
            {#each group.items as item (item.label)}
              <div class="item">
                <dt>
                  {#each item.combos as combo, index (combo)}
                    {#if index > 0}<span class="or">or</span>{/if}
                    <span class="kbd">{combo}</span>
                  {/each}
                </dt>
                <dd>{item.label}</dd>
              </div>
            {/each}
          </dl>
        </section>
      {/each}
      <section>
        <p class="eyebrow">Mouse</p>
        <dl>
          {#each mouse as [action, effect] (action)}
            <div class="item">
              <dt><span class="kbd">{action}</span></dt>
              <dd>{effect}</dd>
            </div>
          {/each}
        </dl>
      </section>
      <section>
        <p class="eyebrow">Gamepad</p>
        <dl>
          {#each gamepad as [action, effect] (action)}
            <div class="item">
              <dt><span class="kbd">{action}</span></dt>
              <dd>{effect}</dd>
            </div>
          {/each}
        </dl>
      </section>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
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
    width: min(680px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    padding: 18px 22px 22px;
    overflow-y: auto;
    background: var(--panel-strong);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .head-actions {
    display: flex;
    gap: 6px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px 28px;
  }

  dl {
    margin: 8px 0 0;
  }

  .item {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 10px;
    align-items: baseline;
    padding: 5px 0;
    border-top: 1px solid var(--line);
  }

  dt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .or {
    color: var(--muted);
    font-size: 11px;
  }

  dd {
    margin: 0;
    color: var(--text);
    font-size: 13px;
  }
</style>
