<script lang="ts">
  const sections = [
    {
      id: 'pieces',
      title: 'Track pieces',
      note: 'Straights, curves, hills, loops and the station snap on here from Phase 2.',
    },
    {
      id: 'props',
      title: 'Props',
      note: 'Graveyard, crooked trees, pumpkins and the mansion arrive with Phase 4.',
    },
    {
      id: 'scares',
      title: 'Scares',
      note: 'Ghost bursts placed on track segments, also Phase 4.',
    },
  ];
</script>

<aside class="dock panel" aria-label="Build palette">
  {#each sections as section (section.id)}
    <section class="section">
      <p class="eyebrow">{section.title}</p>
      <p class="note">{section.note}</p>
    </section>
  {/each}
</aside>

<style>
  .dock {
    position: absolute;
    top: calc(76px + var(--safe-top));
    left: calc(12px + var(--safe-left));
    bottom: calc(84px + var(--safe-bottom));
    width: 260px;
    padding: 14px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section {
    padding: 12px;
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
  }

  .note {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 13px;
  }

  @media (max-width: 900px) {
    .dock {
      top: auto;
      left: calc(12px + var(--safe-left));
      right: calc(12px + var(--safe-right));
      bottom: calc(132px + var(--safe-bottom));
      width: auto;
      max-height: 40vh;
      flex-direction: row;
      overflow-x: auto;
    }

    .section {
      flex: 0 0 220px;
    }
  }
</style>
