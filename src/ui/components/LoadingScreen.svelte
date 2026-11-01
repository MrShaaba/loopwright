<script lang="ts">
  import { fade } from 'svelte/transition';
  import { ui } from '../state/game.svelte';
</script>

<div class="loading" out:fade={{ duration: 700 }}>
  <div class="moon" aria-hidden="true"></div>
  <h1 class="wordmark">Loopwright</h1>
  <p class="tagline">A glowing ball. A glass tube. Your speed.</p>
  {#if ui.phase === 'error'}
    <p class="error">Something went wrong while opening the ride.</p>
    <p class="detail">{ui.error}</p>
    <button class="button" onclick={() => location.reload()}>Try again</button>
  {:else}
    <p class="step">{ui.progress.step}</p>
    <div
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(ui.progress.fraction * 100)}
    >
      <div class="fill" style="width: {Math.round(ui.progress.fraction * 100)}%"></div>
    </div>
  {/if}
</div>

<style>
  .loading {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    text-align: center;
    background: radial-gradient(ellipse at 50% 35%, #1a1733 0%, #0b0d18 55%, #05060c 100%);
  }

  .moon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 38%, #fff4d6, #ffd27a 60%, #d9a447 100%);
    box-shadow:
      0 0 24px 6px rgba(255, 210, 122, 0.35),
      0 0 90px 30px rgba(111, 195, 255, 0.18);
    margin-bottom: 18px;
    animation: breathe 3.2s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .wordmark {
    margin: 0;
    font-size: clamp(32px, 6vw, 48px);
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text);
  }

  .tagline {
    margin: 0 0 18px;
    color: var(--muted);
    font-size: 15px;
    letter-spacing: 0.04em;
  }

  .step {
    margin: 0;
    min-height: 1.4em;
    color: var(--moon);
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bar {
    width: min(360px, 70vw);
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #ffd27a);
    transition: width 0.3s ease-out;
  }

  .error {
    margin: 10px 0 0;
    color: var(--danger);
  }

  .detail {
    margin: 0 0 12px;
    max-width: 480px;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
  }
</style>
