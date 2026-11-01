<script lang="ts">
  import type { Controller } from '../bridge';
  import PiecePalette from './PiecePalette.svelte';

  let { controller }: { controller: Controller } = $props();
</script>

<aside class="dock panel" aria-label="Build palette">
  <PiecePalette {controller} />
  <p class="note">Props and scares arrive with Phase 4.</p>
</aside>

<style>
  .dock {
    position: absolute;
    top: calc(76px + var(--safe-top));
    left: calc(12px + var(--safe-left));
    bottom: calc(84px + var(--safe-bottom));
    width: 296px;
    padding: 14px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .note {
    margin: auto 0 0;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
  }

  @media (max-width: 900px) {
    .dock {
      top: auto;
      left: calc(12px + var(--safe-left));
      right: calc(12px + var(--safe-right));
      bottom: calc(132px + var(--safe-bottom));
      width: auto;
      max-height: 46vh;
    }
  }
</style>
