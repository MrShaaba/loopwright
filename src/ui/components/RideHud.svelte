<script lang="ts">
  import type { Controller } from '../bridge';
  import { ride } from '../state/ride.svelte';

  let { controller }: { controller: Controller } = $props();

  const clock = $derived.by(() => {
    const total = Math.floor(ride.time);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  function onSlider(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    controller.setMultiplier(Number(input.value));
  }
</script>

<div class="ride-hud">
  <div class="speed">
    <span class="value">{Math.round(ride.speed)}</span>
    <span class="unit">km/h</span>
    {#if ride.boost}
      <span class="badge boost">Boost</span>
    {/if}
    {#if ride.paused}
      <span class="badge paused">Paused</span>
    {/if}
  </div>

  <div
    class="progress"
    role="progressbar"
    aria-label="Lap progress"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(ride.progress * 100)}
  >
    <div class="fill" style="width: {ride.progress * 100}%"></div>
  </div>

  <div class="stats panel">
    <span class="stat"><span class="label">Lap</span> {ride.laps + 1}</span>
    <span class="stat"><span class="label">Time</span> {clock}</span>
    <span class="stat"><span class="label">Around</span> {Math.round(ride.progress * 100)}%</span>
  </div>

  <div class="controls panel">
    <div class="multiplier">
      <button
        class="button icon"
        onclick={() => controller.nudgeMultiplier(-1)}
        aria-label="Slower"
        title="Slower (↓)"
      >
        −
      </button>
      <label class="slider">
        <span class="label">Speed <strong>{ride.multiplier.toFixed(2)}×</strong></span>
        <input
          type="range"
          min="0.25"
          max="3"
          step="0.05"
          value={ride.multiplier}
          oninput={onSlider}
          aria-label="Speed multiplier"
        />
      </label>
      <button
        class="button icon"
        onclick={() => controller.nudgeMultiplier(1)}
        aria-label="Faster"
        title="Faster (↑)"
      >
        +
      </button>
    </div>
    <p class="hint">
      Hold <span class="kbd">Shift</span> to boost · <span class="kbd">↑</span>
      <span class="kbd">↓</span> nudge
    </p>
    <div class="buttons">
      <button class="button" onclick={() => controller.togglePause()} aria-pressed={ride.paused}>
        {ride.paused ? 'Resume' : 'Pause'} <span class="kbd">P</span>
      </button>
      <button class="button" onclick={() => controller.toggleMute()} aria-pressed={ride.muted}>
        {ride.muted ? 'Unmute' : 'Mute'} <span class="kbd">M</span>
      </button>
      <button class="button" onclick={() => controller.requestMode('edit')}>
        Edit <span class="kbd">Esc</span>
      </button>
    </div>
  </div>
</div>

<style>
  .ride-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .speed {
    position: absolute;
    top: calc(84px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: baseline;
    gap: 8px;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
  }

  .value {
    font-size: 56px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .unit {
    color: var(--muted);
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .badge {
    margin-left: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .badge.boost {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .badge.paused {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text);
  }

  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
  }

  .fill {
    height: 100%;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
    transition: width 0.05s linear;
  }

  .stats {
    position: absolute;
    left: calc(14px + var(--safe-left));
    bottom: calc(22px + var(--safe-bottom));
    display: flex;
    gap: 18px;
    padding: 10px 16px;
    font-size: 13px;
  }

  .stat {
    display: inline-flex;
    gap: 6px;
    align-items: baseline;
    font-family: var(--mono);
  }

  .label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--font);
  }

  .controls {
    position: absolute;
    right: calc(14px + var(--safe-right));
    bottom: calc(22px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(340px, calc(100vw - 28px));
    padding: 14px 16px;
  }

  .multiplier {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: auto;
  }

  .slider strong {
    margin-left: 4px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0;
  }

  input[type='range'] {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .buttons {
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px;
  }

  @media (max-width: 900px) {
    .value {
      font-size: 44px;
    }

    .hint,
    .stats {
      display: none;
    }

    .controls {
      left: calc(14px + var(--safe-left));
      width: auto;
    }
  }
</style>
