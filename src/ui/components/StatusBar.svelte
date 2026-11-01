<script lang="ts">
  import { ui } from '../state/game.svelte';
</script>

<footer class="status panel">
  <span class="mode">{ui.mode === 'build' ? 'Build mode' : 'Ride mode'}</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="tagline">{ui.theme.tagline}</span>
</footer>

<style>
  .status {
    position: absolute;
    left: calc(12px + var(--safe-left));
    bottom: calc(12px + var(--safe-bottom));
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 14px;
    color: var(--muted);
    font-size: 13px;
  }

  .mode {
    color: var(--text);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .divider {
    width: 1px;
    height: 16px;
    background: var(--line-strong);
  }

  @media (max-width: 900px) {
    .status {
      display: none;
    }
  }
</style>
