# Loopwright

Build a themed roller coaster in 3D, then ride it at night. Loopwright runs entirely in the
browser: you snap track pieces together in a moonlit park, dress the scene with props and scares,
and ride the result in first person.

![Haunted Hollow at night: a moonlit valley with fog, boulders and the build HUD](docs/screenshot.png)

## Who it is for

Anyone who wants to design a coaster and ride it straight away, with no install and no account.
Parks save in the browser and export as JSON files you can share.

## Stack

- [Babylon.js 9](https://www.babylonjs.com/) for the 3D engine, WebGL2
- TypeScript in strict mode
- [Svelte 5](https://svelte.dev/) for the HUD, menus and dialogs, layered over the canvas
- Vite for dev and build, Vitest for unit tests, ESLint and Prettier
- Web Audio for synthesised sound (no audio files)
- No backend

All geometry is generated procedurally from Babylon primitives and all sound is synthesised. The
asset system is designed so a `.glb` model or an audio file can replace any procedural asset
through one config entry.

## Run it

Requires Node 22 or newer.

```bash
npm ci
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check with svelte-check, then production build into dist/
npm run preview  # serve the production build
npm test         # Vitest unit tests
npm run lint     # ESLint and Prettier checks
npm run format   # Prettier write
```

## Controls

| Context  | Keys and mouse                                                                         |
| -------- | -------------------------------------------------------------------------------------- |
| Orbit    | drag to orbit, right-drag to pan, scroll to zoom, `1` `2` `3` fly to presets           |
| Fly      | `F` to toggle, click to capture the mouse, `WASD` move, `Q`/`E` down/up, `Shift` hurry |
| Anywhere | `P` save a photo, `?` or `H` shortcuts, `Esc` close                                    |

Build and ride shortcuts (rotate, delete, undo, start, camera switch) arrive with those phases.

## Project layout

```
src/engine/   framework-free Babylon code: scene, cameras, input, theme configs, save schema
src/ui/       Svelte 5 HUD, state and the single bridge module that talks to the engine
src/parks/    starter parks (from Phase 4)
```

The engine never imports Svelte and the UI never imports Babylon. Track math, physics and the
save format are pure TypeScript so they run under Vitest without a browser.

## Status

Phase 1 of 5 is complete: scaffold, night park scene, cameras and the HUD shell. See
[ROADMAP.md](ROADMAP.md) for what comes next and what is deferred.

## License

MIT, see [LICENSE](LICENSE).
