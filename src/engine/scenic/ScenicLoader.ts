import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import type { Scene } from '@babylonjs/core/scene';
// Registers the glTF plugin with its meshopt and WebP extensions.
import '@babylonjs/loaders/glTF/2.0';
import {
  confirmCredit,
  creditFor,
  parseManifest,
  readGlbAssetExtras,
  type ModelCredit,
  type ScenicManifest,
} from './manifest';

export interface LoadedModel {
  file: string;
  credit: ModelCredit;
  container: AssetContainer;
}

export interface LoadProgress {
  /** The file being fetched. */
  file: string;
  /** 0 to 1 across every file of the world. */
  fraction: number;
}

/** Thrown when a model may not be loaded; the message is fit for a toast. */
export class ScenicLoadError extends Error {}

const MODELS_PATH = 'models/scenic/';

/**
 * Fetches a world's models on demand. Every file must have a credit in the manifest, and the
 * licence inside the file must confirm it, before Babylon ever sees the bytes.
 */
export class ScenicLoader {
  private manifestPromise: Promise<ScenicManifest> | null = null;
  private readonly baseUrl: string;

  constructor(
    private readonly scene: Scene,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    // The decoder ships with the app; nothing is fetched from a CDN.
    MeshoptCompression.Configuration = {
      decoder: { url: `${this.baseUrl}decoders/meshopt_decoder.js` },
    };
  }

  /** The licence manifest, fetched once. */
  manifest(): Promise<ScenicManifest> {
    this.manifestPromise ??= fetch(`${this.baseUrl}${MODELS_PATH}manifest.json`)
      .then(async (response) => {
        if (!response.ok) throw new ScenicLoadError('the licence manifest is missing');
        return parseManifest(await response.json());
      })
      .catch((error: unknown) => {
        this.manifestPromise = null;
        throw error instanceof ScenicLoadError
          ? error
          : new ScenicLoadError('the licence manifest could not be read');
      });
    return this.manifestPromise;
  }

  /** Every credit in the manifest, for the credits panel. */
  async credits(): Promise<ModelCredit[]> {
    return (await this.manifest()).files;
  }

  /**
   * Loads the given files in order, reporting progress, and returns their asset containers
   * without adding anything to the scene yet. Fails on the first file that is unlicensed,
   * mislabelled, missing or broken.
   */
  async load(
    files: string[],
    onProgress: (progress: LoadProgress) => void,
  ): Promise<LoadedModel[]> {
    const manifest = await this.manifest();
    const loaded: LoadedModel[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const credit = creditFor(manifest, file);
        if (!credit) throw new ScenicLoadError(`${file} has no licence entry`);
        const bytes = await this.fetchBytes(file, credit.bytes, (fraction) => {
          onProgress({ file, fraction: (index + fraction * 0.9) / files.length });
        });
        const check = confirmCredit(credit, readGlbAssetExtras(bytes));
        if (!check.ok)
          throw new ScenicLoadError(`${file} failed its licence check: ${check.reason}`);
        const container = await LoadAssetContainerAsync(new File([bytes.buffer], file), this.scene);
        loaded.push({ file, credit, container });
        onProgress({ file, fraction: (index + 1) / files.length });
      }
    } catch (error) {
      for (const model of loaded) model.container.dispose();
      if (error instanceof ScenicLoadError) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new ScenicLoadError(`a model could not be read (${detail})`);
    }
    return loaded;
  }

  /** Fetches a model with byte progress, using the manifest's size when the server sends none. */
  private async fetchBytes(
    file: string,
    expected: number,
    onFraction: (fraction: number) => void,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const response = await fetch(`${this.baseUrl}${MODELS_PATH}${file}`);
    if (!response.ok || !response.body) {
      throw new ScenicLoadError(`${file} is missing (${response.status})`);
    }
    const header = Number(response.headers.get('content-length') ?? 0);
    const total = header > 0 ? header : expected;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) onFraction(Math.min(1, received / total));
    }
    const bytes = new Uint8Array(new ArrayBuffer(received));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
}
