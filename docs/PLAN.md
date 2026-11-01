# Plan: Loopwright, ride first

Loopwright is a ride. A glowing ball rolls through a glowing translucent tube at a speed you
control, in a clean minimalist scene. The track is shaped with sliders, closes itself, and can be
shared as a link. Themed worlds are optional skins.

This plan replaces the park-builder direction. The physics integrator, the Web Audio synths, the
camera smoothing, the spline and frame maths, the key registry, the command stack and the
scene classes (sky, lighting, fog, post-processing, performance governor) carry over from Phase 3.
The snap-piece builder, the station, the four-car train and the terrain are gone.

## Steps

1. **The ride.** A starter track, the tube and ball, the inside camera, speed physics with a live
   multiplier, boost and pause, speed cues (field of view, streaks, rings, wind) and the ride HUD.
   Enter or Space starts the ride from the editor; Esc or the same key returns.
2. **Shape the track.** Sections with sliders that reshape the tube live, a horizontal timeline
   in the bottom dock, a floating inspector, click-to-select on the tube, undo and redo where a
   whole slider drag is one step.
3. **Validation and starters.** Friendly checks that link to the offending section, errors that
   block riding, warnings that advise, and five original starter tracks.
4. **Themes as skins.** Minimal first, then Haunted Hollow, Primeval Valley and Xeno Reach as
   looks only. T cycles. A skin never changes the track or the ride.
5. **Keep and polish.** Autosave to localStorage, JSON export and import, a URL-hash share link,
   PNG photo, reduced-motion handling, README and ROADMAP.

Each step ends with lint, tests and build green and a commit.

## Track model

- A track is a list of sections. Each section is `{ type, params }` with numeric or boolean
  params that the inspector shows as sliders and toggles. Types: straight (optional tunnel),
  hill (climb or dive), banked turn, loop, corkscrew, helix coil, narrowing spiral, wave run,
  jump gap.
- Each section builds from an entry pose (position, yaw, pitch) and returns keys every metre
  plus an exit pose. Sections are plain functions over the existing pose cursor.
- The track always closes. A return section is computed from the last exit pose back to the
  fixed start pose: the shortest of the four arc-straight-arc Dubins paths in the horizontal
  plane with a 14 m turn radius, with a cubic vertical profile that matches both pitches and
  eased banking through the arcs.
- Keys go through a closed centripetal Catmull-Rom spline, resampled every 0.25 m, with
  rotation-minimising frames. Loops use parallel-transport framing so the up vector rolls over
  the top; everything else is gravity-framed with the section's bank.
- Each frame knows its section, so a click on the tube finds the section, validation can point
  at a section, and the inspector can highlight a range of the tube.

## Ride

- Physics: one body on the closed track. Acceleration is gravity along the tangent minus rolling
  resistance and quadratic drag, integrated at 240 Hz. Speed is clamped between 6 and 40 m/s so
  the ride never stalls and never runs away.
- The speed multiplier (0.25x to 3x) scales how fast the ball advances along the track. Up and
  Down nudge it by 0.25. Shift ramps a 1.6x boost in and out. P pauses.
- Camera: sits 3 m behind the ball inside the tube, looks at a point 5 m ahead of the ball along
  the curve, and takes its up vector from the track frame, so the view rolls with the bank and
  inverts through loops. Position and orientation are exponentially smoothed with a quaternion,
  never Euler angles, so vertical track is stable.
- Speed cues: field of view widens with speed, glow streaks on the tube scroll faster than the
  ball, rings every 6 m rush past, and wind pitch and level follow speed. With
  prefers-reduced-motion the field of view stays fixed, the streaks calm down and the camera
  smoothing is stiffer.

## Rendering

- Tube: a custom mesh built from the frames (20 segments around, a ring every 0.5 m) with a
  shader that adds a Fresnel edge glow, scrolling streaks, a glow falloff around the ball and
  exponential fog, blended additively so draw order never matters. Jump gaps leave the tube open.
  Tunnels wrap a straight in an opaque dark shell lit by the ball.
- Ball: an emissive sphere with a procedural pattern so its roll reads, a point light that lights
  the tunnel shell, floor and supports, and the glow layer for bloom.
- Scene: gradient sky dome, gentle exponential fog, a flat floor with a faint grid that fades
  into the fog, thin instanced supports and rings, FXAA and ACES tone mapping.

## Persistence and sharing

- Track document: `{ version, name, theme, sections }`. Autosaved to localStorage, exported and
  imported as JSON, and encoded as a compact byte string in the URL hash (type index plus
  quantised params per section) so a link rebuilds the track with no server.

## Tests

Section geometry (lengths, exits, level ends), the Dubins return (closes to the start pose for
many configurations), the compiled track (closed, continuous, section ranges), physics (speed
clamps, downhill gain, uphill loss, multiplier), validation rules, undo over slider drags, and
the share codec round trip.
