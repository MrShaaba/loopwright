<script lang="ts">
  import type { Controller } from '../bridge';
  import { ride } from '../state/ride.svelte';

  let { controller }: { controller: Controller } = $props();

  const hint = $derived.by(() => {
    switch (ride.phase) {
      case 'idle':
        return 'Press Space to dispatch';
      case 'launching':
        return 'Leaving the station';
      case 'running':
        return ride.onChain ? 'Chain lift' : '';
      case 'arriving':
        return 'Rolling into the station';
      case 'complete':
        return 'Ride complete · Space to go again';
      case 'stalled':
        return 'Stalled · Space to try again, Esc to rebuild';
    }
  });

  const clock = $derived(() => {
    const total = Math.floor(ride.time);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  function meter(value: number, min: number, max: number): number {
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  }
</script>

<div class="ride-hud">
  {#if hint}
    <p class="hint panel" class:alert={ride.phase === 'stalled'}>{hint}</p>
  {/if}

  <div class="readout panel">
    <div class="speed">
      <span class="value">{Math.round(ride.speed)}</span>
      <span class="unit">km/h</span>
    </div>
    <div class="meters">
      <div class="meter">
        <span class="label">Vertical</span>
        <div class="bar">
          <div class="zero" style="left: {meter(0, -2, 6)}%"></div>
          <div
            class="fill"
            class:negative={ride.gVertical < 0}
            style="left: {meter(Math.min(0, ride.gVertical), -2, 6)}%; width: {Math.abs(
              meter(ride.gVertical, -2, 6) - meter(0, -2, 6),
            )}%"
          ></div>
        </div>
        <span class="number">{ride.gVertical.toFixed(1)} g</span>
      </div>
      <div class="meter">
        <span class="label">Lateral</span>
        <div class="bar">
          <div class="zero" style="left: 50%"></div>
          <div
            class="fill"
            style="left: {meter(Math.min(0, ride.gLateral), -3, 3)}%; width: {Math.abs(
              meter(ride.gLateral, -3, 3) - 50,
            )}%"
          ></div>
        </div>
        <span class="number">{ride.gLateral.toFixed(1)} g</span>
      </div>
    </div>
    <div class="clock">
      <span class="label">Time</span>
      <span class="number">{clock()}</span>
      {#if ride.lap > 0}
        <span class="lap">lap {ride.lap}</span>
      {/if}
    </div>
  </div>

  <div class="controls panel">
    {#if ride.phase === 'idle' || ride.phase === 'complete' || ride.phase === 'stalled'}
      <button class="button primary" onclick={() => controller.startRide()}>
        {ride.phase === 'idle' ? 'Dispatch' : 'Go again'} <span class="kbd">Space</span>
      </button>
    {/if}
    <button class="button" onclick={() => controller.toggleRideCamera()}>
      {ride.camera === 'seat' ? 'Chase cam' : 'Seat cam'} <span class="kbd">C</span>
    </button>
    <button class="button" onclick={() => controller.toggleMute()} aria-pressed={ride.muted}>
      {ride.muted ? 'Unmute' : 'Mute'} <span class="kbd">M</span>
    </button>
    <button class="button" onclick={() => controller.requestMode('build')}>
      Exit <span class="kbd">Esc</span>
    </button>
  </div>
</div>

<style>
  .ride-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .hint {
    position: absolute;
    top: calc(76px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 16px;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--moon);
  }

  .hint.alert {
    color: var(--danger);
  }

  .readout {
    position: absolute;
    left: 50%;
    bottom: calc(16px + var(--safe-bottom));
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 18px;
    align-items: center;
    width: min(620px, calc(100vw - 32px));
    padding: 12px 18px;
  }

  .speed {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .value {
    font-size: 40px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .unit {
    color: var(--muted);
    font-size: 13px;
  }

  .meters {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .meter {
    display: grid;
    grid-template-columns: 58px 1fr 48px;
    gap: 8px;
    align-items: center;
  }

  .label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .bar {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .zero {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--line-strong);
  }

  .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--accent);
    transition: width 0.08s linear;
  }

  .fill.negative {
    background: var(--moon);
  }

  .number {
    font-family: var(--mono);
    font-size: 12px;
    text-align: right;
  }

  .clock {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .clock .number {
    font-size: 18px;
  }

  .lap {
    color: var(--muted);
    font-size: 11px;
  }

  .controls {
    position: absolute;
    right: calc(12px + var(--safe-right));
    top: calc(76px + var(--safe-top));
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
  }

  @media (max-width: 900px) {
    .readout {
      grid-template-columns: auto 1fr;
      gap: 12px;
      padding: 10px 14px;
    }

    .clock {
      display: none;
    }

    .value {
      font-size: 32px;
    }

    .controls {
      top: auto;
      bottom: calc(100px + var(--safe-bottom));
      flex-direction: row;
      flex-wrap: wrap;
      left: calc(12px + var(--safe-left));
      right: calc(12px + var(--safe-right));
      justify-content: center;
    }
  }
</style>
