# Roadmap

Loopwright is ride first: a glowing ball in a glass tube at the speed you choose. The ride, the
slider editor, validation, five starter tracks, seven looks, sharing, the game layer, speed bands,
Time Attack with ghosts, the locker with skins and trails, achievements, gamepad support and the
music beds shipped on 1 and 2 November 2026 (see `docs/PLAN.md`). This file lists what would make
it better, as concrete items with a working estimate in hours. The estimates assume the codebase
as it stands and include tests and a browser check for each item.

## Next up: about 62 hours

### Track gallery (10 h)

Saved tracks live in localStorage one at a time today: the last track wins. A gallery keeps many.

| Item                                                                                             | Hours |
| ------------------------------------------------------------------------------------------------ | ----: |
| `gallery.ts`: a store of named tracks with id, name, theme, length, date and a share code        |   1.5 |
| Save and Save as from the Share panel, with an overwrite prompt on a name clash                  |   1.5 |
| A Gallery sheet listing cards with a tiny top-down line drawing of each track, drawn to a canvas |   3.0 |
| Open, rename, duplicate and delete from the card, with undo of a delete via a toast              |   2.0 |
| Import a shared link into the gallery without replacing the current track                        |   1.0 |
| Export the whole gallery as one JSON file and import it back                                     |   1.0 |

### Daily challenge (9 h)

The same track and layout for everyone on a given day, with its own table.

| Item                                                                                            | Hours |
| ----------------------------------------------------------------------------------------------- | ----: |
| A deterministic track generator: pick sections and params from a seed, validated and retried    |   3.0 |
| Date to seed: the UTC day number, so every player gets the same track and item layout           |   0.5 |
| A Daily entry in the tracks menu that builds today's track and locks the seed and the Reshuffle |   1.5 |
| A daily table keyed by the day, with the best score and lap of the day on the summary card      |   1.5 |
| A streak counter in the locker: days in a row with a finished daily lap                         |   1.0 |
| A share code that carries the day, so a link opens the same daily for a friend                  |   1.5 |

### Item editor (12 h)

Hand placement of rings, gems, pads and barriers on top of the generated layout.

| Item                                                                                             | Hours |
| ------------------------------------------------------------------------------------------------ | ----: |
| Track document version 3: an optional list of placed items, each with kind, metres and lane      |   1.5 |
| An Items tab in the inspector: pick a kind, click the tube to drop one at that point and lane    |   3.0 |
| Drag a placed item along the tube and around it; Delete removes; undo and redo through the stack |   2.5 |
| Validation: keep the clearances from `PLACEMENT` and flag items too close to a barrier or a join |   1.5 |
| Share codec version 3 with the placed items packed compactly, old links still opening            |   1.5 |
| A toggle to show the generated layout under the placed items, and a Clear placed items button    |   1.0 |
| Ring counts, gem counts and the how-to text reflect placed items                                 |   1.0 |

### Polish (31 h)

| Item                                                                                              | Hours |
| ------------------------------------------------------------------------------------------------- | ----: |
| Rolling start option, so a flying lap and a standing lap compare fairly in Time Attack            |   1.5 |
| A near-miss bonus for skimming a barrier within one lane, with its own pop and a small chime      |   1.5 |
| Gem placement that reads the track harder: after a jump landing, inside a corkscrew roll          |   2.0 |
| Export a ghost with the track link and race a friend's ghost                                      |   3.0 |
| Kelp and pines that sway: a vertex shader bend driven by time and a per-instance phase            |   2.0 |
| Snow that settles on the tube's top and the supports in Frostline                                 |   2.0 |
| Fish that scatter when the ball passes within a few metres                                        |   1.5 |
| A reflection of the skyline in Neon District's wet asphalt, as a flipped second render at low res |   3.0 |
| A free orbit view around the ball as a third camera                                               |   1.5 |
| A settings sheet: render scale override, auto scaling on and off, MSAA, reduced motion override   |   2.0 |
| Drag chips in the timeline to reorder, in addition to the arrow buttons                           |   2.0 |
| Type a value into a slider's readout                                                              |   1.0 |
| Section presets (a gentle hill, a tight hairpin) in the Add menu                                  |   1.5 |
| A theme editor: pick the tube, ball and accent colours live, saved with the track                 |   3.0 |
| Music: a per-theme stinger when a gem is found and a key change on a new top score                |   1.5 |
| Haptics on touch devices for rings and barriers, where the Vibration API exists                   |   0.5 |
| A best-lap marker on the progress bar                                                             |   1.0 |
| Record a short ride video with the MediaRecorder API and download it                              |   2.5 |

## Later

- Daily and weekly leaderboards need a server; everything above stays local on purpose
- A WebGPU engine option, once the tube and sky shaders have WGSL versions
- Track compilation in a worker for very long tracks
- Touch controls for the fly camera and a pointer-lock fallback
- A clothoid loop profile so the entry pull-out is softer
- Jump gaps that match the parabola to the ball's actual speed
- A slider for the return section's turn radius
