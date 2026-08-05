import { CHUNK_SIZE } from "./constants";

/**
 * The simulation grid doubles as its own spatial partitioning structure:
 * every cell is addressed directly by `y * width + x`, so neighbor lookups
 * (the only spatial query the simulation needs) are O(1) array reads with
 * no separate quadtree/bucket structure to maintain. A quadtree earns its
 * keep when objects move continuously through free space and queries are
 * "find everything near point P" — neither is true here, cells live on
 * fixed integer coordinates and neighbor queries are always the same fixed
 * 3x3 offset pattern. Building one anyway would add indirection without
 * doing anything the flat array doesn't already do for free.
 *
 * What chunking *does* buy us is cheap dirty-rectangle rendering: the grid
 * is divided into CHUNK_SIZE x CHUNK_SIZE tiles, and the worker flags a
 * chunk dirty whenever any cell inside it changes. The renderer then only
 * clears+redraws chunks that are both on-screen and flagged dirty, instead
 * of repainting the whole canvas every frame.
 */

export function chunkDims(width: number, height: number) {
  return {
    chunksX: Math.ceil(width / CHUNK_SIZE),
    chunksY: Math.ceil(height / CHUNK_SIZE),
  };
}

export function chunkIndexForCell(x: number, y: number, width: number): number {
  const { chunksX } = chunkDims(width, 0);
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  return cy * chunksX + cx;
}

export function totalChunks(width: number, height: number): number {
  const { chunksX, chunksY } = chunkDims(width, height);
  return chunksX * chunksY;
}
