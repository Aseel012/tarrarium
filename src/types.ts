/**
 * Shared type definitions for the Terrarium simulation engine.
 *
 * Design note — Structure of Arrays (SoA): cell state is stored as one
 * typed array per attribute (all `alive` values contiguous, all `energy`
 * values contiguous, etc.) rather than an array of per-cell objects. This
 * is what makes 100k+ cells tractable: it keeps memory compact and
 * cache-friendly, lets us `transfer` whole buffers to/from the Web Worker
 * with zero copy, and avoids allocating millions of small JS objects that
 * would otherwise thrash the garbage collector every generation.
 */

/** Terrain types. Encoded as small integers in a Uint8Array for compactness. */
export enum Terrain {
  Plain = 0,
  Water = 1,
  Forest = 2,
  Rock = 3,
  Lava = 4,
  Food = 5,
  Toxic = 6,
  Safe = 7,
}

/** Global weather state, cycles over time and modulates survival rules. */
export enum Weather {
  Clear = 0,
  Rain = 1,
  Heatwave = 2,
  Cold = 3,
  Storm = 4,
  Drought = 5,
}

/** Static, tunable parameters for one species. */
export interface SpeciesConfig {
  id: number; // 1-4 (0 is reserved for "no species / dead cell")
  name: string;
  color: string; // base hex color, modulated by DNA + energy at render time
  baseMutationRate: number; // 0-1, chance-scaled drift applied to offspring DNA
  reproductionEnergyThreshold: number;
  reproductionCost: number; // energy spent by the parent per birth
  energyDecayPerTick: number;
  maxLifespan: number;
  neighborRange: [min: number, max: number]; // Conway-like survival/birth window
  terrainAffinity: Partial<Record<Terrain, number>>; // energy multiplier by terrain
  /** Fraction of a weaker neighboring cell's energy passively drained per
   * tick (0 = peaceful/photosynthetic, higher = predatory). Decoupled from
   * reproduction so low-energy newborns of a hunting species can still earn
   * their way back up instead of being stuck below their own reproduction
   * threshold forever. */
  predationRate: number;
  enabled: boolean;
}

/**
 * The full simulation state, as Structure-of-Arrays typed buffers.
 * Every array has length `width * height`, indexed by `y * width + x`.
 */
export interface CellBuffers {
  alive: Uint8Array;
  speciesId: Uint8Array;
  energy: Float32Array;
  age: Uint16Array;
  health: Float32Array;
  dna: Float32Array; // 0-1 scalar trait, drives color + fitness in competition
  mutationRate: Float32Array;
}

/** Static environment layers. */
export interface EnvironmentBuffers {
  terrain: Uint8Array;
  food: Float32Array; // dynamic, regenerating resource level per cell
}

/** Aggregate statistics computed once per generation for the analytics panel. */
export interface StatsFrame {
  generation: number;
  totalAlive: number;
  births: number;
  deaths: number;
  perSpecies: Record<number, number>; // speciesId -> population
  avgEnergy: number;
  avgMutationRate: number;
  avgAge: number;
  stepTimeMs: number;
}

/** Overlay modes for the heatmap toggle on the canvas. */
export type HeatmapMode = "none" | "population" | "energy" | "age" | "mutation" | "species";

/** Camera/viewport transform used to render the world onto the canvas. */
export interface Viewport {
  offsetX: number;
  offsetY: number;
  cellSize: number;
}

/** A reusable stamp-able cell cluster (kept for potential future pattern presets). */
export interface Pattern {
  id: string;
  name: string;
  cells: { x: number; y: number }[];
}


/** Messages sent from the main thread to the simulation worker. */
export type WorkerRequest =
  | {
      type: "init";
      width: number;
      height: number;
      cells: CellBuffers;
      env: EnvironmentBuffers;
      species: SpeciesConfig[];
    }
  | { type: "step"; weather: Weather; steps: number }
  | { type: "setSpecies"; species: SpeciesConfig[] }
  | { type: "setEnvironment"; env: EnvironmentBuffers }
  | { type: "setCells"; cells: CellBuffers; generation: number };

/** Messages sent from the simulation worker back to the main thread. */
export type WorkerResponse =
  | { type: "ready" }
  | {
      type: "stepResult";
      cells: CellBuffers;
      stats: StatsFrame;
      dirtyChunks: Uint8Array;
    };
