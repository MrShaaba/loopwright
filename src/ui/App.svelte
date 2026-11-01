<script lang="ts">
  import { onMount } from 'svelte';
  import { bootGame, type Controller } from './bridge';
  import HelpOverlay from './components/HelpOverlay.svelte';
  import Inspector from './components/Inspector.svelte';
  import LoadingScreen from './components/LoadingScreen.svelte';
  import Pops from './components/Pops.svelte';
  import RideHud from './components/RideHud.svelte';
  import Timeline from './components/Timeline.svelte';
  import Toast from './components/Toast.svelte';
  import TopBar from './components/TopBar.svelte';
  import { ui } from './state/game.svelte';

  let canvas: HTMLCanvasElement | undefined = $state();
  let controller: Controller | null = $state(null);

  onMount(() => {
    let disposed = false;
    let live: Controller | null = null;
    if (canvas) {
      bootGame(canvas)
        .then((created) => {
          if (disposed) {
            created.dispose();
            return;
          }
          live = created;
          controller = created;
        })
        .catch((error: unknown) => {
          console.error(error);
          ui.phase = 'error';
          ui.error = error instanceof Error ? error.message : String(error);
        });
    }
    return () => {
      disposed = true;
      live?.dispose();
    };
  });
</script>

<canvas bind:this={canvas} class="stage" tabindex="-1" aria-label="Ride view"></canvas>

{#if controller}
  <div class="hud" class:riding={ui.mode === 'ride'}>
    <TopBar {controller} />
    {#if ui.mode === 'ride'}
      <Pops />
      <RideHud {controller} />
    {:else}
      <Timeline {controller} />
      <Inspector {controller} />
    {/if}
    {#if ui.helpOpen}
      <HelpOverlay {controller} />
    {/if}
    <Toast />
  </div>
{/if}

{#if ui.phase !== 'ready'}
  <LoadingScreen />
{/if}

<style>
  .stage {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
    touch-action: none;
    background: var(--bg);
  }

  .hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }
</style>
