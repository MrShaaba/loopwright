#!/usr/bin/env node
/**
 * Compresses the Scenic Worlds models for the web.
 *
 * Reads the original GLB files from ~/Downloads/loopwright-assets/ (or the folder in
 * LOOPWRIGHT_ASSETS), simplifies the terrain, resizes and re-encodes every texture as WebP,
 * quantises and meshopt-compresses the geometry, and writes the results to
 * public/models/scenic/ with a manifest built from each file's asset.extras. The originals are
 * never committed; only the outputs are. Fails when a file passes 15 MB or the set passes 40 MB.
 *
 *   npm run assets:scenic
 */
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  meshopt,
  normals,
  prune,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE =
  process.env.LOOPWRIGHT_ASSETS ?? path.join(homedir(), 'Downloads', 'loopwright-assets');
const OUT = path.join(ROOT, 'public', 'models', 'scenic');
const DECODER_OUT = path.join(ROOT, 'public', 'decoders', 'meshopt_decoder.js');
const FILE_BUDGET = 15 * 1024 * 1024;
const TOTAL_BUDGET = 40 * 1024 * 1024;
const MODIFIED = 'compressed and resized for real-time use';

/** One entry per model: the source file, the output name and how hard to squeeze it. */
const JOBS = [
  {
    source: 'alien_space_nebula_1_skybox.glb',
    out: 'alien-space-nebula-1.glb',
    texture: 2048,
    quality: 90,
  },
  {
    source: 'alien_space_nebula_2_skybox.glb',
    out: 'alien-space-nebula-2.glb',
    texture: 4096,
    quality: 82,
  },
  { source: 'deep_space_skybox.glb', out: 'deep-space.glb', texture: 8192, quality: 82 },
  {
    source: 'landscape_of_an_alien_planet_skybox.glb',
    out: 'alien-planet-landscape.glb',
    texture: 4096,
    quality: 84,
  },
  { source: 'need_some_space.glb', out: 'need-some-space.glb', texture: 1024, quality: 85 },
  {
    source: 'snowy-terrain.glb',
    out: 'snowy-terrain.glb',
    texture: 1024,
    quality: 85,
    // Half a million triangles for a backdrop is far more than the eye needs from the tube.
    simplify: { ratio: 0.1, error: 0.02 },
  },
];

/** "Name (https://...)" as Sketchfab writes it, split into the two parts. */
function splitAuthor(text) {
  const match = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(text ?? '');
  return match ? { author: match[1], authorUrl: match[2] } : { author: text ?? '', authorUrl: '' };
}

/** "CC-BY-4.0 (http://...)" into a readable name and its URL. */
function splitLicense(text) {
  const match = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(text ?? '');
  const raw = (match ? match[1] : (text ?? '')).trim();
  const name = raw.replace(/^CC-BY-4\.0$/i, 'CC BY 4.0');
  return { license: name, licenseUrl: match ? match[2] : '' };
}

/** Removes the attributes that only exist to split vertices on a terrain that is lit flat anyway. */
function stripSplitAttributes() {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        for (const semantic of ['NORMAL', 'TANGENT', 'TEXCOORD_1', 'TEXCOORD_2']) {
          const attribute = primitive.getAttribute(semantic);
          if (attribute) primitive.setAttribute(semantic, null);
        }
      }
    }
  };
}

function megabytes(bytes) {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.dirname(DECODER_OUT), { recursive: true });
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const manifest = { generated: new Date().toISOString(), modified: MODIFIED, files: [] };
  let total = 0;
  for (const job of JOBS) {
    const sourcePath = path.join(SOURCE, job.source);
    const before = (await stat(sourcePath)).size;
    const document = await io.read(sourcePath);
    const root = document.getRoot();
    const asset = root.getAsset();
    const extras = typeof asset.extras === 'object' && asset.extras !== null ? asset.extras : {};
    if (typeof extras.license !== 'string' || !/CC-?BY-?4\.0/i.test(extras.license)) {
      throw new Error(`${job.source}: asset.extras has no CC BY 4.0 licence; refusing to ship it`);
    }
    const transforms = [];
    if (job.simplify) {
      // The terrain ships with per-face normals, tangents and three UV sets, which split every
      // vertex and leave the simplifier nothing to collapse. Drop them, weld by position and UV,
      // simplify, then recompute smooth normals.
      transforms.push(stripSplitAttributes(), prune(), dedup(), weld());
      transforms.push(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: job.simplify.ratio,
          error: job.simplify.error,
          lockBorder: true,
        }),
        normals({ overwrite: true }),
      );
    } else {
      transforms.push(dedup(), weld());
    }
    transforms.push(
      prune({ keepAttributes: false, keepLeaves: false }),
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [job.texture, job.texture],
        quality: job.quality,
        effort: 60,
      }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    await document.transform(...transforms);
    // The licence metadata travels with the file: the app reads it back before loading.
    asset.extras = { ...extras, modified: MODIFIED };
    const outPath = path.join(OUT, job.out);
    await io.write(outPath, document);
    const after = (await stat(outPath)).size;
    total += after;
    const triangles = root
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, primitive) => {
        const indices = primitive.getIndices();
        const position = primitive.getAttribute('POSITION');
        const count = indices ? indices.getCount() : position ? position.getCount() : 0;
        return sum + (primitive.getMode() === 4 ? count / 3 : 0);
      }, 0);
    console.log(
      `${job.source} -> ${job.out}: ${megabytes(before)} -> ${megabytes(after)}, ` +
        `${Math.round(triangles).toLocaleString()} triangles`,
    );
    if (after > FILE_BUDGET) throw new Error(`${job.out} is over the 15 MB budget`);
    manifest.files.push({
      file: job.out,
      title: String(extras.title ?? job.source),
      ...splitAuthor(extras.author),
      source: String(extras.source ?? ''),
      ...splitLicense(extras.license),
      modified: MODIFIED,
      bytes: after,
    });
  }
  if (total > TOTAL_BUDGET)
    throw new Error(`The set is ${megabytes(total)}, over the 40 MB budget`);
  await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // The meshopt decoder the browser needs, served locally like everything else.
  await copyFile(
    path.join(ROOT, 'node_modules', 'meshoptimizer', 'meshopt_decoder.cjs'),
    DECODER_OUT,
  );
  const decoderBytes = (await readFile(DECODER_OUT)).length;
  console.log(
    `Total ${megabytes(total)} of ${megabytes(TOTAL_BUDGET)}; decoder ${megabytes(decoderBytes)}`,
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
