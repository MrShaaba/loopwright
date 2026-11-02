# Credits

Everything in Loopwright is generated in code, except the models behind the optional Scenic
Worlds. Those come from the authors below under the
[Creative Commons Attribution 4.0](http://creativecommons.org/licenses/by/4.0/) licence. Each file
was modified: compressed and resized for real-time use by `scripts/compress-scenic.mjs`. The
compressed copies live in `public/models/scenic/` with the same details in `manifest.json`, which
the app reads and checks against each file's own metadata before it loads anything. The originals
are not in this repository; follow the source links.

| Title                                                                                                                                         | Author                                            | Licence                                                  | Used in                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- | --------------------------- |
| [Alien Space Nebula 1 (Skybox)](https://sketchfab.com/3d-models/alien-space-nebula-1-skybox-4a4e7aec37c04320a09ac4c7434b8810)                 | [Jungle Jim](https://sketchfab.com/jungle_jim)    | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Nebula Drift, Nebula I sky  |
| [Alien Space Nebula 2 (Skybox)](https://sketchfab.com/3d-models/alien-space-nebula-2-skybox-a1c688c6e8164fd4ad5a7e56047e8b50)                 | [Jungle Jim](https://sketchfab.com/jungle_jim)    | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Nebula Drift, Nebula II sky |
| [Deep Space skybox](https://sketchfab.com/3d-models/deep-space-skybox-2d87bae35cff40598c859f2163b4b3b0)                                       | [Jungle Jim](https://sketchfab.com/jungle_jim)    | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Deep Field sky              |
| [Landscape of an alien planet (Skybox)](https://sketchfab.com/3d-models/landscape-of-an-alien-planet-skybox-676c023d919344efbfa9876c85db7d11) | [Jungle Jim](https://sketchfab.com/jungle_jim)    | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Far Shore sky               |
| [Need some space?](https://sketchfab.com/3d-models/need-some-space-d6521362b37b48e3a82bce4911409303)                                          | [Loïc Norgeot](https://sketchfab.com/norgeotloic) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Deep Field, distant scenery |
| [Snowy-terrain](https://sketchfab.com/3d-models/snowy-terrain-eef014b3a7dd4056a2481234e5b64f74)                                               | [Kubocarte](https://sketchfab.com/Kubocarte)      | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Snowfield ground            |

The models are decoded in the browser with [meshoptimizer](https://github.com/zeux/meshoptimizer)
(MIT licence), whose decoder is shipped at `public/decoders/meshopt_decoder.js`. The engine is
[Babylon.js](https://www.babylonjs.com/) (Apache 2.0) and the interface is
[Svelte](https://svelte.dev/) (MIT).
