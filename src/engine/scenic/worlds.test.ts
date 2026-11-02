import { describe, expect, it } from 'vitest';
import manifestJson from '../../../public/models/scenic/manifest.json';
import { creditFor, parseManifest } from './manifest';
import { getWorld, nextWorldId, readyWorlds, SCENIC_WORLDS, worldFiles } from './worlds';

const manifest = parseManifest(manifestJson);

describe('scenic world registry', () => {
  it('has unique ids, four ready worlds and one placeholder slot', () => {
    expect(new Set(SCENIC_WORLDS.map((world) => world.id)).size).toBe(SCENIC_WORLDS.length);
    expect(readyWorlds().map((world) => world.id)).toEqual([
      'nebula-drift',
      'deep-field',
      'far-shore',
      'snowfield',
    ]);
    expect(getWorld('haunted')?.status).toBe('placeholder');
    expect(getWorld('nope')).toBeNull();
  });

  it('only points at files that have a licence entry in the manifest', () => {
    for (const world of readyWorlds()) {
      const files = [
        ...world.skies.map((variant) => variant.file),
        ...(world.scenery ? [world.scenery.file] : []),
        ...(world.terrain ? [world.terrain.file] : []),
      ];
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const credit = creditFor(manifest, file);
        expect(credit, `${world.id} needs a credit for ${file}`).not.toBeNull();
        expect(credit?.license).toBe('CC BY 4.0');
      }
    }
    expect(worldFiles(getWorld('haunted')!)).toEqual([]);
  });

  it('lists the chosen sky first and every other model after it', () => {
    const nebula = getWorld('nebula-drift')!;
    expect(worldFiles(nebula)).toEqual(['alien-space-nebula-2.glb']);
    expect(worldFiles(nebula, 'nebula-1')).toEqual(['alien-space-nebula-1.glb']);
    expect(worldFiles(nebula, 'unknown')).toEqual(['alien-space-nebula-2.glb']);
    expect(worldFiles(getWorld('deep-field')!)).toEqual(['deep-space.glb', 'need-some-space.glb']);
    expect(worldFiles(getWorld('snowfield')!)).toEqual(['snowy-terrain.glb']);
  });

  it('gives every ready world a complete look that never touches the track', () => {
    for (const world of readyWorlds()) {
      expect(Object.keys(world).sort()).toEqual(
        ['id', 'look', 'name', 'scenery', 'skies', 'status', 'tagline', 'terrain'].sort(),
      );
      expect(world.look.tube.intensity).toBeGreaterThan(0.5);
      expect(world.look.skyLevel).toBeGreaterThan(0);
      expect(world.look.ui.accent).toMatch(/^#[0-9a-f]{6}$/i);
      // A world without a skybox model brings its own procedural sky.
      if (world.skies.length === 0) expect(world.look.sky).not.toBeNull();
    }
  });

  it('cycles through the ready worlds and back to none', () => {
    expect(nextWorldId(null)).toBe('nebula-drift');
    expect(nextWorldId('nebula-drift')).toBe('deep-field');
    expect(nextWorldId('snowfield')).toBeNull();
    // A placeholder or unknown id starts the cycle over.
    expect(nextWorldId('haunted')).toBe('nebula-drift');
  });
});
