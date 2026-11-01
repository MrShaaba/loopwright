# Roadmap

Phases 1 (scaffold, night park, cameras, HUD shell), 2 (track building) and 3 (ride mode) are
done. Each later phase ends with lint, tests and build green, a commit, and a note on what to look at
in the browser.

## Phase 4: Haunted Hollow complete

- Procedural props with idle motion: gravestones, crooked trees, jack-o'-lanterns, fences,
  flickering lanterns, a mansion the track dives through
- Prop placement on terrain with `R` rotate, scale drag and `Delete`
- Ghosts that drift alongside the train and burst from trigger points
- Scare triggers placed on track segments
- Ambient bed and music bed as synth patches
- Starter park: a complete coaster through the graveyard and mansion
- Readability pass so the track never vanishes into the dark (rail glow, rim light)

## Phase 5: persistence, stubs and polish

- Save and load parks in localStorage, export and import JSON files, versioned with migrations
- Main menu with park picker and an empty park
- Primeval Valley and Xeno Reach stubs: sky, lighting, two or three props and a starter coaster each
- Performance pass against 60 fps: instancing audit, merged static scenery, frozen matrices
- Tablet HUD check, README screenshot refresh

## Theme build-outs after Phase 5

### Primeval Valley

- Dusk sky with a low orange sun, warm fog, long shadows
- Terrain material: red earth, river gorge cut through the park, lava glow on the volcano
- Props: ferns (three sizes), cycads, boulders with moss, volcano with smoke particles, river with
  animated water, bones and eggs
- Creatures: a long-necked grazer that looms over a turn, a pack hunter that chases the train,
  a flyer that circles the lift hill
- Scares: roar at a trigger, chase along a straight, loom over a curve
- Sound: jungle ambient with insects and distant roars, drum-based music bed, volcano rumble

### Xeno Reach

- Twin moons (sky shader glow currently follows the key moon only; extend to several)
- Alien terrain palette with bioluminescent patches, low-gravity hills (lower g in physics)
- Props: crystal spires that hum, tractor-beam lift as a visual chain-lift replacement,
  station modules, antenna arrays
- Creatures: a tracker drone that follows the train, a sweeper beam across the track
- Scares: beam sweep, drone dive, crystal shatter
- Sound: synth pads, radio chatter, beam hum

## Deferred from Phase 3

- Per-car physics (each car's own slope) instead of the mean slope over the train
- Clothoid loop and drop profiles to bring entry pull-out under 5 g
- Validation runs synchronously on every change; move it to a worker for very long tracks
- Block brakes and a second train
- Camera shake and a lap-time board; photo mode during the ride
- Audio: Doppler on scares, per-wheel clack timing from tie spacing, a settings slider for volume
- A rollback-friendly stall display: show the train settling in the valley instead of freezing the hint

## Deferred from Phase 2

- Select any piece by clicking it, delete or re-parameterise it in place, insert in the middle
- Smart close: suggest the curve and straight combination that brings the track back to the station
- Carry bank through consecutive curves instead of unbanking between them
- Clothoid (teardrop) loop profile instead of a stretched circle
- Collision warning when a piece passes through existing track or the station roof
- Hover highlight on the track and a piece list with per-piece length and height

## Deferred from Phase 1

- WebGPU engine option (the scene uses WebGL2; the sky shader is GLSL)
- `@babylonjs/loaders` for `.glb` assets, added when the first file asset lands
- Settings panel: MSAA, shadow quality, render scale override, auto scaling on and off
- Touch controls for the fly camera and a pointer-lock fallback
- Ground mist that avoids hillsides instead of drifting through them
- Terrain level of detail for larger parks
