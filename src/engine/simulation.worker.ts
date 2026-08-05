/**
 * Simulation Web Worker.
 *
 * This is intentionally a thin wrapper: all the actual rules live in
 * simulationRules.ts (pure, easily testable). The worker's job is state
 * ownership and message plumbing — keeping the potentially-expensive
 * per-generation computation off the main thread so panning/zooming/UI
 * stays responsive at 60fps regardless of grid size or simulation speed.
 *
 * Double buffering: `currentBuffers` and `scratchBuffers` are allocated
 * once and reused generation after generation (ping-ponged by reference
 * swap), so stepping never allocates new typed arrays. When the main
 * thread asks for a batch of N generations (to support the 1x-20x speed
 * control without N postMessage round trips), we run all N steps against
 * the same pair of buffers and only clone+transfer the *final* state back
 * — one memory copy per rendered frame, not per simulated generation.
 */
import type { CellBuffers, EnvironmentBuffers, SpeciesConfig, WorkerRequest, WorkerResponse } from "../types";
import { cloneCellBuffers, cellBufferList } from "./buffers";
import { stepSimulation } from "./simulationRules";
import { totalChunks } from "./spatialGrid";

// Cast rather than pull in the WebWorker lib globally, which would conflict
// with the DOM lib used by the rest of the app in the same tsconfig.
const ctx = self as unknown as {
  postMessage: (message: WorkerResponse, transfer: Transferable[]) => void;
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
};

let width = 0;
let height = 0;
let currentBuffers: CellBuffers | null = null;
let scratchBuffers: CellBuffers | null = null;
let env: EnvironmentBuffers | null = null;
let species: SpeciesConfig[] = [];
let generation = 0;

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;

  switch (msg.type) {
    case "init": {
      width = msg.width;
      height = msg.height;
      currentBuffers = msg.cells;
      scratchBuffers = {
        alive: new Uint8Array(width * height),
        speciesId: new Uint8Array(width * height),
        energy: new Float32Array(width * height),
        age: new Uint16Array(width * height),
        health: new Float32Array(width * height),
        dna: new Float32Array(width * height),
        mutationRate: new Float32Array(width * height),
      };
      env = msg.env;
      species = msg.species;
      generation = 0;
      ctx.postMessage({ type: "ready" }, []);
      break;
    }

    case "setSpecies": {
      species = msg.species;
      break;
    }

    case "setEnvironment": {
      env = msg.env;
      break;
    }

    case "setCells": {
      currentBuffers = msg.cells;
      generation = msg.generation;
      break;
    }

    case "step": {
      if (!currentBuffers || !scratchBuffers || !env) break;
      let cur: CellBuffers = currentBuffers;
      let scratch: CellBuffers = scratchBuffers;
      const activeEnv = env;

      const start = performance.now();
      const combinedDirty = new Uint8Array(totalChunks(width, height));
      let lastStats = null;

      for (let s = 0; s < msg.steps; s++) {
        const { stats, dirtyChunks } = stepSimulation(
          cur,
          scratch,
          activeEnv,
          width,
          height,
          species,
          msg.weather,
          generation
        );
        // Swap buffers by reference — no allocation, just relabeling.
        const tmp: CellBuffers = cur;
        cur = scratch;
        scratch = tmp;
        generation = stats.generation;
        lastStats = stats;
        for (let i = 0; i < combinedDirty.length; i++) {
          if (dirtyChunks[i]) combinedDirty[i] = 1;
        }
      }

      currentBuffers = cur;
      scratchBuffers = scratch;

      if (!lastStats) break;
      lastStats.stepTimeMs = performance.now() - start;

      // Clone (not transfer) the worker's own authoritative buffers so it
      // keeps a valid copy to continue simulating from, and transfer the
      // clone to the main thread at zero additional copy cost.
      const outgoing = cloneCellBuffers(cur);
      ctx.postMessage(
        { type: "stepResult", cells: outgoing, stats: lastStats, dirtyChunks: combinedDirty },
        [...cellBufferList(outgoing), combinedDirty.buffer]
      );
      break;
    }
  }
};
