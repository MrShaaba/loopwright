<script lang="ts">
  import { play } from '../state/play.svelte';
</script>

<div class="pops" aria-hidden="true">
  {#each play.pops as pop (pop.id)}
    <span class="pop {pop.kind}" style="left: {pop.x}px; top: {pop.y}px">{pop.text}</span>
  {/each}
</div>

<style>
  .pops {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .pop {
    position: absolute;
    transform: translate(-50%, -50%);
    font-family: var(--mono);
    font-size: 20px;
    font-weight: 700;
    color: var(--accent-text);
    text-shadow:
      0 0 12px var(--accent),
      0 2px 10px rgba(0, 0, 0, 0.7);
    animation: rise 0.9s ease-out forwards;
  }

  .pop.gem {
    color: #ffd9ff;
    text-shadow:
      0 0 14px #ff6ef5,
      0 2px 10px rgba(0, 0, 0, 0.7);
    font-size: 24px;
  }

  .pop.boost {
    color: #d6ffe2;
    text-shadow:
      0 0 14px #5dff8a,
      0 2px 10px rgba(0, 0, 0, 0.7);
  }

  .pop.hazard,
  .pop.miss {
    color: #ffc2c8;
    text-shadow:
      0 0 14px var(--danger),
      0 2px 10px rgba(0, 0, 0, 0.7);
    font-size: 16px;
    font-weight: 600;
  }

  @keyframes rise {
    0% {
      opacity: 0;
      transform: translate(-50%, -30%) scale(0.8);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -150%) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pop {
      animation: fade 0.9s ease-out forwards;
    }

    @keyframes fade {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  }
</style>
