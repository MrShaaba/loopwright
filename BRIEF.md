# Brief: Loopwright, build a themed roller coaster in 3D, then ride it at night

**Project type:** browser 3D game / creative sandbox · **Stack:** Babylon.js 7, TypeScript (strict),
Vite, Svelte 5 for the UI overlay, Web Audio, Vitest, ESLint and Prettier

## Vision

Loopwright is my own take on a roller coaster experience. You build a coaster piece by piece in a
3D park, dress the scene with themed props, then ride it in first person. The building part should
feel tactile and satisfying: pieces snap together, the camera glides around the build, and the park
comes alive as you add to it. The ride should feel like a real dark ride: speed, drops, airtime,
and scares timed to the track.

There are three themes, each a complete world with its own lighting, props, sounds and scares:

1. **Haunted Hollow (Halloween, first theme to build):** night time, full moon, fog, a graveyard,
   crooked trees, jack-o'-lanterns, a haunted mansion the track dives through, and ghosts that drift
   alongside the train or burst out at trigger points.
2. **Primeval Valley (second):** a prehistoric jungle at dusk with volcanoes, ferns, river gorges,
   and dinosaurs that roar, chase the train or loom over a turn. Original look only.
3. **Xeno Reach (third):** an alien planet or space station under twin moons, with crystal spires,
   low-gravity hills, tractor-beam lifts and creatures that track the train.

## Naming and originality

- The app is called **Loopwright**. Do not use names, logos, characters or designs from any film,
  game or theme park (for example no "Jurassic Park", no "Alien" franchise, no Disney or Universal
  rides). Themes are generic genres, designed from scratch.
- Write all code from scratch. Do not copy code from any other project. Do not open or reference
  any other repository on this machine.
- No external art or audio files in the first pass. Build geometry procedurally from Babylon.js
  primitives, extrusions, tubes and node materials, and synthesise sound with Web Audio. Design
  the asset system so a `.glb` model or an audio file can replace a procedural one later through
  one config entry.

## Stack

- Babylon.js 7 (`@babylonjs/core`, `@babylonjs/materials`, `@babylonjs/gui` only where Svelte is a
  poor fit), TypeScript in strict mode, no `any`.
- Svelte 5 for menus, the build palette, the HUD and dialogs, layered over the Babylon canvas. Keep
  the 3D engine code framework-free in its own modules so the UI layer stays thin.
- Vite for dev and build. Vitest for unit tests on the track math, validation and save format.
- No backend. Save parks to localStorage wrapped in try/catch, plus export and import as a JSON file.

## Core systems

1. **Track model:** a spline-based track (Catmull-Rom or cubic Bezier segments) with banking/roll,
   built from pieces: straight, curve left/right (several radii), slope up/down, lift hill, drop,
   loop, corkscrew, helix, brake run and station. Store the track as data and generate the rail
   and support meshes from it.
2. **Build mode:**
   - An orbit and free-fly camera with smooth fly-to presets.
   - A piece palette; the next piece previews as a ghost at the track end and snaps on when
     placed. Undo and redo.
   - Supports that drop to the terrain automatically.
   - Validation: the circuit must close back at the station, and the train must have enough
     speed to clear each hill. Show red markers where it would stall, with a reason.
   - Prop placement: theme props on the terrain with rotate and scale, and scare triggers placed
     on track segments (a ghost burst, a dinosaur roar, an alien sweep).
3. **Ride mode:**
   - A train that follows the track with simple energy physics: gravity, friction, and a chain
     lift that adds energy.
   - A first-person seat camera with head bob, plus an orbit chase camera.
   - Speed and g-force readout on the HUD.
   - Scares fire when the train passes their triggers.
   - Wind and track rumble whose pitch follows speed.
4. **Themes:** each theme is a config module (sky, fog, lighting, terrain material, prop set, scare
   set, ambient sound, music bed). Switching theme re-skins the same track. Build Haunted Hollow
   fully in the first pass. Stub the other two with sky, lighting and two or three props each, and
   list their full build-out in ROADMAP.md.
5. **Night and atmosphere:** moonlight with shadows, volumetric-looking fog, glowing emissive
   pumpkins and windows, flickering lanterns, particle mist, and a glow layer. Keep it readable;
   the track must never disappear into darkness.
6. **Starter parks:** one ready-made coaster per theme so someone can ride immediately, plus an
   empty park.

## Performance and quality

- Hold 60fps on a modern laptop: instance repeated props and supports, merge the static
  scenery, freeze world matrices where possible, and use adaptive hardware scaling.
- Show a loading screen while the scene builds.
- Keyboard shortcuts:
  - build: R rotate, Delete remove, Ctrl/Cmd+Z undo
  - ride: Space start, C switch camera, Esc exit
- Responsive: desktop first, but the HUD must not break on a tablet.

## How to work

1. Start in plan mode. Propose:
   - the module layout
   - the track data model and the math for generating the rail and banking
   - the physics approach
   - the theme config shape
   - a phased roadmap

   Wait for my approval before writing code.
2. Suggested phases, each one runnable and committed before moving on:
   - Phase 1: scaffold, Babylon scene, cameras, terrain, night lighting, Svelte HUD shell
   - Phase 2: track data model, piece palette, snapping, ghost preview, undo/redo, supports
   - Phase 3: ride mode with physics, seat and chase cameras, validation markers
   - Phase 4: Haunted Hollow complete with props, ghosts, scare triggers, sound and a starter park
   - Phase 5: save/load/export, polish, performance; stubs for Primeval Valley and Xeno Reach
3. After each phase run `npm run build`, `npm run lint` and `npm test`, fix every error, and tell
   me exactly what to look at in the browser. If something looks crude, say so and improve it.
4. I will keep adding ideas over the coming days. Keep the architecture open for new piece types,
   new scare types and new themes without rewrites.

## Repo basics

- The repo is already initialised. Commit each working step with a clear message.
- README (what it is, who it is for, stack, how to run it, a screenshot), MIT LICENSE under
  "Bello Mohammed", `.gitignore` (including `.env`, `node_modules`, `dist`), and a GitHub Actions
  workflow running lint, test and build.
- ROADMAP.md with the remaining theme build-outs and anything deferred, as concrete items.
- Ignore any global instructions about AWS, tagging, alarms or infrastructure-as-code. This is a
  frontend-only project.
- No secrets, no personal names or family photos anywhere in the repo.
