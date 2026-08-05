import type { CellBuffers, EnvironmentBuffers } from "../types";

/** Allocate a fresh, zeroed set of cell buffers for a width*height grid. */
export function createCellBuffers(width: number, height: number): CellBuffers {
  const n = width * height;
  return {
    alive: new Uint8Array(n),
    speciesId: new Uint8Array(n),
    energy: new Float32Array(n),
    age: new Uint16Array(n),
    health: new Float32Array(n),
    dna: new Float32Array(n),
    mutationRate: new Float32Array(n),
  };
}

/** Allocate a fresh environment (terrain + food) buffer set. */
export function createEnvironmentBuffers(width: number, height: number): EnvironmentBuffers {
  const n = width * height;
  return {
    terrain: new Uint8Array(n),
    food: new Float32Array(n),
  };
}

/** Deep-clone cell buffers (used for generation snapshots / time travel). */
export function cloneCellBuffers(cells: CellBuffers): CellBuffers {
  return {
    alive: cells.alive.slice(),
    speciesId: cells.speciesId.slice(),
    energy: cells.energy.slice(),
    age: cells.age.slice(),
    health: cells.health.slice(),
    dna: cells.dna.slice(),
    mutationRate: cells.mutationRate.slice(),
  };
}

/**
 * Every ArrayBuffer backing a CellBuffers set, in a fixed order. Used both
 * to build the `transfer` list for zero-copy postMessage calls and to
 * reconstruct a CellBuffers object from the array received on the other
 * side (order must match on both ends).
 */
export function cellBufferList(cells: CellBuffers): ArrayBufferLike[] {
  return [
    cells.alive.buffer,
    cells.speciesId.buffer,
    cells.energy.buffer,
    cells.age.buffer,
    cells.health.buffer,
    cells.dna.buffer,
    cells.mutationRate.buffer,
  ];
}

/** Rebuild typed array views over transferred ArrayBuffers (same order as cellBufferList). */
export function cellBuffersFromTransfer(buffers: ArrayBufferLike[]): CellBuffers {
  return {
    alive: new Uint8Array(buffers[0]),
    speciesId: new Uint8Array(buffers[1]),
    energy: new Float32Array(buffers[2]),
    age: new Uint16Array(buffers[3]),
    health: new Float32Array(buffers[4]),
    dna: new Float32Array(buffers[5]),
    mutationRate: new Float32Array(buffers[6]),
  };
}
