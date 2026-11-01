# Loopwright

Ride a glowing ball through a glowing glass tube at the speed you choose. Shape the track with
sliders, share it as a link, and switch the look with a key. Everything runs in the browser.

![A corkscrew mid-ride: the gold ball rolls through the glass tube at 68 km/h, rings and streaks rushing past](docs/screenshot.png)

## What it is

Loopwright is ride first. The app opens on a ready-made track. Press `Enter` and you are inside
the tube, just behind the ball, looking ahead along the curve. The camera banks with the turns and
rolls through the loops. Speed comes from physics, faster after drops and slower on climbs, and a
multiplier slider from 0.25x to 3x stays live while you ride. `Shift` boosts, `P` pauses, and the
field of view, the streaks on the glass, the rings and the wind all follow your speed.

The track is a list of sections: straight (with an optional tunnel), hill, banked turn, loop,
corkscrew, helix coil, narrowing spiral, wave run and jump gap. Each has sliders, and the tube
reshapes while you drag. The track always closes itself with a smooth return section. Friendly
checks point at the section that goes underground, crosses itself or is pitched too tight.

The default look is Minimal: a soft dark gradient, gentle fog, a faint floor grid and a glass tube.
Haunted Hollow, Primeval Valley and Xeno Reach are optional skins that change only how things
look, never the track or the ride.

## Stack

- [Babylon.js 9](https://www.babylonjs.com/) for the 3D engine, WebGL2
- TypeScript in strict mode
- [Svelte 5](https://svelte.dev/) for the HUD, timeline, inspector and dialogs, layered over the canvas
- Vite for dev and build, Vitest for unit tests, ESLint and Prettier
- Web Audio for synthesised wind and roll (no audio files)
- No backend. Tracks autosave to localStorage, export as JSON and travel inside a URL hash.

All geometry is generated from the track frames and Babylon primitives. The tube is a custom mesh
with an additive glass shader; the ball, rings and supports are procedural. Nothing is downloaded
beyond the app itself.

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

| Context  | Keys and mouse                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------- |
| Anywhere | `Enter` or `Space` ride, and the same key or `Esc` returns to the editor                        |
| Ride     | `↑` `↓` nudge the speed multiplier, hold `Shift` to boost, `P` pause, `C` Inside or Follow view |
| Editor   | click the tube to select a section, `Delete` remove it, `Ctrl`/`Cmd+D` duplicate, `1` frame all |
| Editor   | `Ctrl`/`Cmd+Z` undo, `Shift+Ctrl`/`Cmd+Z` redo, a whole slider drag is one step                 |
| Orbit    | drag to orbit, right-drag to pan, scroll to zoom, `F` toggles the free-fly camera               |
| Anywhere | `T` next theme, `M` mute, `O` save a photo, `?` or `H` shortcuts                                |

The Share button in the top bar renames the track, copies a link that rebuilds it with no server,
exports and imports JSON, and takes a photo. The track name opens the five starter tracks.

## Accessibility

With `prefers-reduced-motion` set, the field of view stays fixed, the streaks calm down, the
camera smoothing is unchanged and the HUD drops its transitions.

## Project layout

```
src/engine/track/     sections, pose cursor, Dubins auto-close, spline, frames, track compiler
src/engine/tube/      the glass tube mesh and shader, light rings, supports, tunnel shells
src/engine/ride/      ball physics, the ball, the ride controller
src/engine/camera/    editor orbit and fly cameras, the inside ride camera
src/engine/edit/      section list, selection, undo with drag batching
src/engine/validate/  track checks and the scene pins
src/engine/theme/     Minimal and the three skins
src/engine/save/      track document, localStorage, the share codec
src/engine/starters/  the five starter tracks
src/engine/scene/     sky, lighting, fog and post-processing, floor, performance governor
src/engine/audio/     Web Audio wind and roll
src/ui/               Svelte 5 HUD, state and the single bridge module that talks to the engine
```

The engine never imports Svelte and the UI never imports Babylon. Track maths, physics,
validation, the edit history and the share codec are pure TypeScript and run under Vitest
without a browser.

## Status

The ride, the slider editor, validation, five starter tracks, four looks and sharing are done.
See [ROADMAP.md](ROADMAP.md) for what comes next and [docs/PLAN.md](docs/PLAN.md) for the plan
this build followed.

## License

MIT, see [LICENSE](LICENSE).
