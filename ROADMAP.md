# Roadmap

Phase 1 (scaffold, night park, cameras, HUD shell) is done. Each later phase ends with lint, tests
and build green, a commit, and a note on what to look at in the browser.

## Phase 2: track building

- Piece registry with one file per piece: station, straight (three lengths), curve left and
  right (radii 8, 14, 22 m; 45 and 90 degrees), slope up, slope down, level out, lift hill with
  chain, drop with depth, vertical loop, corkscrew left and right, helix left and right, brake run
- Centripetal Catmull-Rom through piece keys, arc-length resampling at 0.25 m
- Rotation-minimising frames by double reflection; gravity-framed bank for ordinary pieces and
  transport-framed twist through loops and corkscrews
- Auto-bank on curves from radius and design speed, with an override parameter
- Rail tubes, box spine, thin-instanced ties and supports dropped to the terrain
- Palette with variant chips, ghost preview at the track end, snap on place, remove last
- Undo and redo through a command stack (`Ctrl`/`Cmd+Z`, `Shift` to redo)
- Closure readout: distance and heading gap back to the station
- Tests: piece exit poses, frame orthonormality, arc-length tables, undo stack

## Phase 3: ride mode

- Energy physics: gravity along the tangent averaged over the cars, rolling resistance, air drag,
  chain lift speed floor, brake and station decel
- Four-car train mesh following the frames
- Seat camera with smoothed up vector and speed-scaled head bob; orbit chase camera
- Speed and vertical/lateral g readouts on the HUD
- `Space` start, `C` switch camera, `Esc` exit
- Validation sim from a standing start with red stall markers and reasons, open-circuit marker,
  lateral-g warnings
- Web Audio engine with wind and rumble whose pitch follows speed
- Tests: integrator, stall detection

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

## Deferred from Phase 1

- WebGPU engine option (the scene uses WebGL2; the sky shader is GLSL)
- `@babylonjs/loaders` for `.glb` assets, added when the first file asset lands
- Settings panel: MSAA, shadow quality, render scale override, auto scaling on and off
- Touch controls for the fly camera and a pointer-lock fallback
- Ground mist that avoids hillsides instead of drifting through them
- Terrain level of detail for larger parks
