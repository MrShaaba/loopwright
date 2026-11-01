/** Park save format. Bump the version and add a migration whenever the shape changes. */
export const PARK_FORMAT_VERSION = 1 as const;

export interface PlacedPiece {
  type: string;
  params: Record<string, number | string>;
}

export interface PlacedProp {
  id: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export interface PlacedScare {
  id: string;
  pieceIndex: number;
  /** Position along the piece, 0 at its entry and 1 at its exit. */
  t: number;
  params?: Record<string, number | string>;
}

export interface ParkFile {
  version: typeof PARK_FORMAT_VERSION;
  name: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
  track: { pieces: PlacedPiece[] };
  props: PlacedProp[];
  scares: PlacedScare[];
}

export function createEmptyPark(name: string, theme: string, now = new Date()): ParkFile {
  const stamp = now.toISOString();
  return {
    version: PARK_FORMAT_VERSION,
    name,
    theme,
    createdAt: stamp,
    updatedAt: stamp,
    track: { pieces: [] },
    props: [],
    scares: [],
  };
}
