# Roadmap

Loopwright is ride first: a glowing ball in a glass tube at the speed you choose. The ride, the
slider editor, validation, five starter tracks, four looks and sharing shipped on 1 November 2026
(see `docs/PLAN.md`). This file lists what would make it better, as concrete items.

## The ride

- A free orbit view around the ball as a third camera
- Camera shake and a stronger lean into banked turns at high speed, off under reduced motion
- A best-lap marker on the progress bar and a lap time board per track
- Ball trail: a short additive ribbon behind the ball at speed
- Doppler and a whoosh when passing light rings; a bass thump on landing after a jump
- Gamepad: triggers for the multiplier, a button for boost

## Shaping the track

- Drag chips in the timeline to reorder, in addition to the arrow buttons
- Type a value into a slider's readout
- Drag the ends of a section on the tube itself to change its length
- Section presets (a gentle hill, a tight hairpin) and a random track generator
- A clothoid loop profile so the entry pull-out is softer
- Jump gaps could match the parabola to the ball's actual speed
- Return section settings: a slider for its turn radius

## Looks

- Minimal: a soft reflection of the tube in the floor
- Haunted Hollow: fog wisps, a graveyard silhouette ring at the park edge, bats
- Primeval Valley: a volcano on the horizon with embers, fern silhouettes
- Xeno Reach: a nebula layer and drifting asteroids
- More skins from earlier ideas: Frostline, Abyss, Neon District
- A theme editor: pick the tube, ball and accent colours live

## Sharing and saving

- A gallery of saved tracks in localStorage, not only the last one
- Share links that also carry the speed multiplier and the camera choice
- Export a short ride video with the MediaRecorder API

## Engine

- WebGPU engine option (the scene uses WebGL2; the shaders are GLSL)
- Move track compilation to a worker for very long tracks
- Touch controls for the fly camera and a pointer-lock fallback
- Settings panel: MSAA, render scale override, auto scaling on and off
