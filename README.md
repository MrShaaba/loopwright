# Loopwright

Build a themed roller coaster in 3D, then ride it at night. Loopwright runs entirely in the
browser: you snap track pieces together in a moonlit park, dress the scene with props and scares,
and ride the result in first person.

![Haunted Hollow at night: a coaster with a lift hill, loop and corkscrew leaving the station, with the build palette](docs/screenshot.png)

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

| Context  | Keys and mouse                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------- |
| Build    | pick a piece in the palette, `Enter` or click the scene to snap it on, `Backspace` remove last     |
| Build    | `Ctrl`/`Cmd+Z` undo, `Shift+Ctrl`/`Cmd+Z` redo, `4` fly to the track end, `Esc` drop the selection |
| Ride     | `Space` dispatch the train, `C` switch seat and chase camera, `Esc` back to build mode             |
| Orbit    | drag to orbit, right-drag to pan, scroll to zoom, `1` `2` `3` fly to presets                       |
| Fly      | `F` to toggle, click to capture the mouse, `WASD` move, `Q`/`E` down/up, `Shift` hurry             |
| Anywhere | `P` save a photo, `M` mute, `?` or `H` shortcuts                                                   |

Prop controls (rotate, delete) arrive with Phase 4.

## Project layout

```
src/engine/scene/   terrain, sky, lighting, fog, performance governor
src/engine/track/   pieces, pose cursor, spline, frames, track model, rail and support meshes
src/engine/build/   build controller and command stack (undo/redo)
src/engine/ride/    energy physics, validation sim, train, ride controller, markers
src/engine/camera/  orbit, fly, seat and chase cameras
src/engine/audio/   Web Audio synths for wind, rumble and the chain lift
src/engine/theme/   theme configs (Haunted Hollow)
src/ui/             Svelte 5 HUD, state and the single bridge module that talks to the engine
```

The engine never imports Svelte and the UI never imports Babylon. Track math, physics and the
save format are pure TypeScript so they run under Vitest without a browser.

## Status

Phases 1 to 3 of 5 are complete: the night park, cameras and HUD; track building with twelve
piece types, snapping, ghost preview, undo and redo, supports and circuit closure; and ride mode
with energy physics, a four-car train, seat and chase cameras, speed and g readouts, a validation
sim with marked stall points, and synthesised wind and rumble. See [ROADMAP.md](ROADMAP.md) for
what comes next and what is deferred.

## License

MIT, see [LICENSE](LICENSE).
