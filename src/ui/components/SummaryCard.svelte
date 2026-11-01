<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Controller } from '../bridge';
  import { play } from '../state/play.svelte';
  import { ride } from '../state/ride.svelte';

  let { controller }: { controller: Controller } = $props();

  function lap(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
  }
</script>

{#if play.summary}
  {@const s = play.summary}
  <div
    class="card panel"
    role="dialog"
    aria-label="Lap summary"
    transition:fade={{ duration: 160 }}
  >
    <div class="head">
      <p class="eyebrow">Lap {s.lap} complete</p>
      {#if s.rank !== null}
        <p class="rank" class:top={s.rank === 1}>
          {s.rank === 1 ? 'New top score' : `#${s.rank} on this track`}
        </p>
      {/if}
    </div>
    <p class="total">{s.entry.score.toLocaleString()}</p>
    <dl class="facts">
      <div>
        <dt>Rings</dt>
        <dd>{s.entry.rings} / {play.ringsTotal}</dd>
      </div>
      <div>
        <dt>Gems</dt>
        <dd>{s.entry.gems} / {play.gemsTotal}</dd>
      </div>
      <div>
        <dt>Best combo</dt>
        <dd>×{s.entry.bestCombo}</dd>
      </div>
      <div>
        <dt>Top speed</dt>
        <dd>{s.entry.topSpeed} km/h</dd>
      </div>
      <div>
        <dt>Lap time</dt>
        <dd>{lap(s.entry.lapTime)}</dd>
      </div>
      <div>
        <dt>Speed</dt>
        <dd>{s.entry.multiplier.toFixed(2)}×</dd>
      </div>
    </dl>
    {#if s.table.length > 1}
      <ol class="table">
        {#each s.table.slice(0, 5) as row, index (row.date + index)}
          <li class:you={row === s.entry}>
            <span class="place">{index + 1}</span>
            <span class="score">{row.score.toLocaleString()}</span>
            <span class="meta"
              >{row.rings} rings · {row.gems} gems · {row.multiplier.toFixed(2)}×</span
            >
          </li>
        {/each}
      </ol>
    {/if}
    <div class="actions">
      {#if ride.phase === 'complete'}
        <button class="button primary" onclick={controller.restartRide}>
          Go again <span class="kbd">Space</span>
        </button>
        <button class="button" onclick={() => controller.requestMode('edit')}>
          Edit <span class="kbd">Esc</span>
        </button>
      {:else}
        <button class="button" onclick={controller.dismissSummary}>Keep riding</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .card {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(400px, calc(100vw - 32px));
    padding: 18px 20px 20px;
    background: var(--panel-strong);
    z-index: 8;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .rank {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .rank.top {
    color: var(--accent-text);
  }

  .total {
    margin: 0;
    font-size: 44px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 12px;
    margin: 0;
  }

  .facts div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  dt {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-family: var(--mono);
    font-size: 14px;
  }

  .table {
    margin: 0;
    padding: 8px 0 0;
    list-style: none;
    border-top: 1px solid var(--line);
  }

  .table li {
    display: grid;
    grid-template-columns: 24px 80px 1fr;
    gap: 8px;
    padding: 4px 0;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }

  .table li.you {
    color: var(--accent-text);
  }

  .place {
    text-align: right;
  }

  .score {
    color: var(--text);
  }

  .table li.you .score {
    color: var(--accent-text);
  }

  .actions {
    display: flex;
    gap: 8px;
    padding-top: 4px;
  }
</style>
