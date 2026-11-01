<script lang="ts">
  import { RIDE_VIEW_LABELS } from '../../engine/camera/RideCamera';
  import { SPEED_BAND_LABELS } from '../../engine/save/scores';
  import type { Controller } from '../bridge';
  import { play } from '../state/play.svelte';
  import { ride } from '../state/ride.svelte';

  let { controller }: { controller: Controller } = $props();

  function lap(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
  }

  function onSlider(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    controller.setMultiplier(Number(input.value));
  }

  function hold(direction: number): (event: PointerEvent) => void {
    return (event) => {
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      controller.steer(direction);
    };
  }

  function release(): void {
    controller.steer(0);
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
  {#if play.mode === 'game'}
    <div class="score panel">
      <span class="score-value">{play.score.toLocaleString()}</span>
      <span class="score-row">
        {#if play.topScore !== null}
          <span class="top" title="Top score, {SPEED_BAND_LABELS[play.band]}"
            >top {play.topScore.toLocaleString()}</span
          >
        {/if}
        <span class="combo" class:hot={play.combo >= 5}>
          {#if play.combo > 0}×{play.combo} combo{:else}no combo{/if}
        </span>
        <span class="gems">◆ {play.gems}/{play.gemsTotal}</span>
        <span class="rings">○ {play.rings}/{play.ringsTotal}</span>
      </span>
      {#if play.valueFactor < 1}
        <span class="value-note"
          >rings worth {Math.round(play.valueFactor * 100)}% until you rebuild speed</span
        >
      {/if}
    </div>
  {/if}

  <p class="gforce" class:airtime={ride.gVertical < 0.4} class:heavy={ride.gVertical > 2.5}>
    {#if ride.gVertical < 0.4}
      Airtime
    {:else if ride.gVertical > 9.95}
      9.9+ g
    {:else}
      {ride.gVertical.toFixed(1)} g
    {/if}
  </p>

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

  {#if ride.phase === 'complete' && !play.summary}
    <div class="finished panel">
      <p class="finished-title">Lap complete · {lap(ride.lastLap)}</p>
      <p class="finished-hint">
        <span class="kbd">Space</span> go again · <span class="kbd">Esc</span> edit
      </p>
    </div>
  {/if}

  <div class="stats panel">
    <span class="stat"
      ><span class="label">Lap</span> {ride.phase === 'complete' ? ride.laps : ride.laps + 1}</span
    >
    <span class="stat"><span class="label">Time</span> {lap(ride.lapTime)}</span>
    {#if ride.lastLap > 0}
      <span class="stat"><span class="label">Last</span> {lap(ride.lastLap)}</span>
    {/if}
    {#if ride.bestLap !== null}
      <span class="stat best"><span class="label">Best</span> {lap(ride.bestLap)}</span>
    {/if}
    <span class="stat"><span class="label">Around</span> {Math.round(ride.progress * 100)}%</span>
  </div>

  <button
    class="steer left"
    aria-label="Steer left"
    onpointerdown={hold(-1)}
    onpointerup={release}
    onpointercancel={release}
    onlostpointercapture={release}
    oncontextmenu={(event) => event.preventDefault()}
  >
    ◀
  </button>
  <button
    class="steer right"
    aria-label="Steer right"
    onpointerdown={hold(1)}
    onpointerup={release}
    onpointercancel={release}
    onlostpointercapture={release}
    oncontextmenu={(event) => event.preventDefault()}
  >
    ▶
  </button>

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
      <div class="segmented" role="group" aria-label="Play mode">
        <button
          class="segment"
          class:active={play.mode === 'game'}
          aria-pressed={play.mode === 'game'}
          onclick={() => controller.setPlayMode('game')}
        >
          Game
        </button>
        <button
          class="segment"
          class:active={play.mode === 'cruise'}
          aria-pressed={play.mode === 'cruise'}
          onclick={() => controller.setPlayMode('cruise')}
        >
          Cruise
        </button>
      </div>
      <button class="button" onclick={() => controller.cycleView()} title="Switch view (C)">
        {RIDE_VIEW_LABELS[ride.view]} <span class="kbd">C</span>
      </button>
      <button class="button" onclick={() => controller.togglePause()} aria-pressed={ride.paused}>
        {ride.paused ? 'Resume' : 'Pause'} <span class="kbd">P</span>
      </button>
      <button
        class="button"
        class:on={ride.endless}
        onclick={() => controller.toggleEndless()}
        aria-pressed={ride.endless}
        title="Keep riding lap after lap"
      >
        Endless {ride.endless ? 'on' : 'off'}
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

  .gforce {
    position: absolute;
    top: calc(150px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
    transition: color 0.2s ease;
  }

  .gforce.airtime {
    color: var(--accent-text);
  }

  .gforce.heavy {
    color: var(--warn);
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

  .score {
    position: absolute;
    top: calc(76px + var(--safe-top));
    left: calc(14px + var(--safe-left));
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
    padding: 10px 14px;
  }

  .score-value {
    font-size: 30px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .score-row {
    display: flex;
    gap: 12px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }

  .combo.hot {
    color: var(--accent-text);
  }

  .top {
    color: var(--text);
  }

  .gems {
    color: #ffb8ff;
  }

  .value-note {
    font-size: 11px;
    color: var(--warn);
  }

  .segmented {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.25);
  }

  .segment {
    min-height: 30px;
    padding: 0 12px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }

  .segment.active {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .steer {
    position: absolute;
    bottom: calc(96px + var(--safe-bottom));
    width: 72px;
    height: 120px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(13, 15, 28, 0.45);
    color: var(--text);
    font-size: 22px;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    display: none;
  }

  .steer:active {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .steer.left {
    left: calc(14px + var(--safe-left));
  }

  .steer.right {
    right: calc(14px + var(--safe-right));
  }

  @media (hover: none), (pointer: coarse) {
    .steer {
      display: block;
    }
  }

  .finished {
    position: absolute;
    top: calc(190px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    text-align: center;
  }

  .finished-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .finished-hint {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .button.on {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  .stat.best {
    color: var(--accent-text);
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
