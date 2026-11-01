<script lang="ts">
  import { fade } from 'svelte/transition';

  let { close }: { close: () => void } = $props();

  const rows = [
    {
      icon: '◀ ▶',
      title: 'Steer',
      text: 'Left and right move the ball around the inside of the tube.',
    },
    {
      icon: '○',
      title: 'Rings',
      text: 'Pass through them. Faster is worth more, and a chain without a miss builds a combo.',
    },
    {
      icon: '◆',
      title: 'Gems',
      text: 'Three per track, hidden on the harder lines. Big bonus each.',
    },
    { icon: '▲', title: 'Boost pads', text: 'Roll over one for a burst of speed.' },
    {
      icon: '▬',
      title: 'Barriers',
      text: 'They cut your speed and break the combo. The glowing lane shows which side they are on.',
    },
  ];
</script>

<div class="howto" transition:fade={{ duration: 160 }}>
  <div class="sheet panel" role="dialog" aria-modal="true" aria-labelledby="howto-title">
    <p class="eyebrow">First ride</p>
    <h2 id="howto-title">How to play</h2>
    <ul>
      {#each rows as row (row.title)}
        <li>
          <span class="icon" aria-hidden="true">{row.icon}</span>
          <span class="body"><strong>{row.title}</strong> {row.text}</span>
        </li>
      {/each}
    </ul>
    <p class="hint">
      <span class="kbd">↑</span> <span class="kbd">↓</span> change speed · hold
      <span class="kbd">Shift</span> to boost · <span class="kbd">?</span> for every shortcut
    </p>
    <button class="button primary" onclick={close}>Got it <span class="kbd">Enter</span></button>
  </div>
</div>

<style>
  .howto {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 6, 12, 0.5);
    pointer-events: auto;
  }

  .sheet {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(440px, calc(100vw - 32px));
    padding: 18px 22px 22px;
    background: var(--panel-strong);
  }

  h2 {
    margin: 0;
    font-size: 22px;
  }

  ul {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  li {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 10px;
    align-items: start;
  }

  .icon {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--accent-text);
    text-align: center;
    padding-top: 2px;
  }

  .body {
    font-size: 13.5px;
    line-height: 1.4;
  }

  .body strong {
    display: block;
  }

  .hint {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
  }

  .button {
    align-self: flex-end;
  }
</style>
