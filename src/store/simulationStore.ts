import { create } from "zustand";
import type { CellBuffers, EnvironmentBuffers, HeatmapMode, SpeciesConfig, StatsFrame, Weather } from "../types";
import { DEFAULT_SPECIES } from "../engine/constants";
import { generateTerrain } from "../engine/terrain";
import { seedPopulation } from "../engine/populate";
import { cloneCellBuffers, createCellBuffers } from "../engine/buffers";
import { SimulationWorkerClient } from "../engine/workerClient";
import { HistoryManager } from "../engine/history";

const DEFAULT_SIZE = 220; // 220x220 = 48,400 cells by default; slider goes up to 400 (160,000 cells)
const STATS_HISTORY_LENGTH = 240;

interface SimulationState {
  // World
  width: number;
  height: number;
  cells: CellBuffers;
  env: EnvironmentBuffers;
  species: SpeciesConfig[];
  seed: number;

  // Playback
  isRunning: boolean;
  speed: number; // generations/sec, 1-20
  weather: Weather;
  autoWeather: boolean;
  generation: number;

  // Analytics
  stats: StatsFrame | null;
  statsHistory: StatsFrame[];
  dirtyChunks: Uint8Array | null;

  // Time travel
  isScrubbing: boolean;
  scrubGeneration: number;
  historyRange: { oldest: number; newest: number; count: number };

  // UI
  heatmapMode: HeatmapMode;
  selectedBrushSpecies: number;
  ready: boolean;

  // internals
  _client: SimulationWorkerClient | null;
  _history: HistoryManager;
  _loopHandle: ReturnType<typeof setTimeout> | null;

  init: () => Promise<void>;
  start: () => void;
  pause: () => void;
  stepOnce: () => Promise<void>;
  randomizePopulation: () => Promise<void>;
  regenerateWorld: () => Promise<void>;
  clearPopulation: () => Promise<void>;
  setSpeed: (v: number) => void;
  setGridSize: (v: number) => Promise<void>;
  setWeather: (w: Weather) => void;
  setAutoWeather: (v: boolean) => void;
  updateSpecies: (id: number, patch: Partial<SpeciesConfig>) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setBrushSpecies: (id: number) => void;
  paintCell: (x: number, y: number, erase: boolean) => void;
  scrubTo: (generation: number) => void;
  resumeFromScrub: () => void;
  saveWorld: () => string;
  loadWorld: (json: string) => Promise<void>;
}

export const useSimulationStore = create<SimulationState>((set, get) => {
  const initialEnv = generateTerrain(DEFAULT_SIZE, DEFAULT_SIZE, Date.now() & 0xffffffff);
  const initialCells = seedPopulation(DEFAULT_SIZE, DEFAULT_SIZE, initialEnv, DEFAULT_SPECIES, 0.05);

  return {
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
    cells: initialCells,
    env: initialEnv,
    species: DEFAULT_SPECIES,
    seed: Date.now() & 0xffffffff,

    isRunning: false,
    speed: 6,
    weather: 0,
    autoWeather: true,
    generation: 0,

    stats: null,
    statsHistory: [],
    dirtyChunks: null,

    isScrubbing: false,
    scrubGeneration: 0,
    historyRange: { oldest: 0, newest: 0, count: 0 },

    heatmapMode: "none",
    selectedBrushSpecies: 1,
    ready: false,

    _client: null,
    _history: new HistoryManager(),
    _loopHandle: null,

    init: async () => {
      const { width, height, cells, env, species } = get();
      const client = new SimulationWorkerClient();
      // init() transfers `cells`/`env` typed arrays to the worker, which
      // detaches them on the main thread — so we hand the worker a clone
      // and keep the originals here for immediate rendering.
      await client.init(width, height, cloneCellBuffers(cells), env, species);
      set({ _client: client, ready: true });
    },

    start: () => {
      if (get().isRunning) return;
      set({ isRunning: true, isScrubbing: false });
      loop(set, get);
    },

    pause: () => {
      const handle = get()._loopHandle;
      if (handle) clearTimeout(handle);
      set({ isRunning: false, _loopHandle: null });
    },

    stepOnce: async () => {
      if (get().isRunning) return;
      await runStep(set, get);
    },

    randomizePopulation: async () => {
      const { width, height, env, species, _client } = get();
      const cells = seedPopulation(width, height, env, species, 0.05);
      get()._history.clear();
      set({ cells, generation: 0, stats: null, statsHistory: [], historyRange: { oldest: 0, newest: 0, count: 0 } });
      _client?.setCells(cloneCellBuffers(cells), 0);
    },

    regenerateWorld: async () => {
      const { width, height, species, _client } = get();
      const seed = Date.now() & 0xffffffff;
      const env = generateTerrain(width, height, seed);
      const cells = seedPopulation(width, height, env, species, 0.05);
      get()._history.clear();
      set({ env, cells, generation: 0, stats: null, statsHistory: [], seed, historyRange: { oldest: 0, newest: 0, count: 0 } });
      _client?.setEnvironment(env);
      _client?.setCells(cloneCellBuffers(cells), 0);
    },

    clearPopulation: async () => {
      const { width, height, _client } = get();
      const cells = createCellBuffers(width, height);
      get()._history.clear();
      set({ cells, generation: 0, stats: null, statsHistory: [], historyRange: { oldest: 0, newest: 0, count: 0 } });
      _client?.setCells(cloneCellBuffers(cells), 0);
    },

    setSpeed: (v) => set({ speed: v }),

    setGridSize: async (v) => {
      get().pause();
      const size = Math.max(20, Math.min(400, v));
      const { species, _client } = get();
      const env = generateTerrain(size, size, Date.now() & 0xffffffff);
      const cells = seedPopulation(size, size, env, species, 0.05);
      get()._history.clear();
      set({ width: size, height: size, env, cells, generation: 0, stats: null, statsHistory: [], historyRange: { oldest: 0, newest: 0, count: 0 } });
      if (_client) {
        await _client.init(size, size, cloneCellBuffers(cells), env, species);
      }
    },

    setWeather: (w) => set({ weather: w }),
    setAutoWeather: (v) => set({ autoWeather: v }),

    updateSpecies: (id, patch) => {
      const species = get().species.map((s) => (s.id === id ? { ...s, ...patch } : s));
      set({ species });
      get()._client?.setSpecies(species);
    },

    setHeatmapMode: (mode) => set({ heatmapMode: mode }),
    setBrushSpecies: (id) => set({ selectedBrushSpecies: id }),

    paintCell: (x, y, erase) => {
      const { width, height, cells, species, selectedBrushSpecies, _client } = get();
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      const next = cloneCellBuffers(cells);
      if (erase) {
        next.alive[i] = 0;
        next.speciesId[i] = 0;
        next.energy[i] = 0;
        next.health[i] = 0;
        next.age[i] = 0;
        next.dna[i] = 0;
        next.mutationRate[i] = 0;
      } else {
        const s = species.find((sp) => sp.id === selectedBrushSpecies) ?? species[0];
        next.alive[i] = 1;
        next.speciesId[i] = s.id;
        next.energy[i] = 70;
        next.health[i] = 100;
        next.age[i] = 0;
        next.dna[i] = Math.random();
        next.mutationRate[i] = s.baseMutationRate;
      }
      set({ cells: next });
      _client?.setCells(cloneCellBuffers(next), get().generation);
    },

    scrubTo: (generation) => {
      const snap = get()._history.getClosest(generation);
      if (!snap) return;
      set({ isScrubbing: true, scrubGeneration: snap.generation, cells: snap.cells, stats: snap.stats });
    },

    resumeFromScrub: () => {
      const { cells, generation, _client } = get();
      _client?.setCells(cloneCellBuffers(cells), generation);
      set({ isScrubbing: false });
    },

    saveWorld: () => {
      const { width, height, cells, env, generation, species, seed } = get();
      return JSON.stringify({
        version: 1,
        width,
        height,
        generation,
        seed,
        species,
        cells: {
          alive: Array.from(cells.alive),
          speciesId: Array.from(cells.speciesId),
          energy: Array.from(cells.energy),
          age: Array.from(cells.age),
          health: Array.from(cells.health),
          dna: Array.from(cells.dna),
          mutationRate: Array.from(cells.mutationRate),
        },
        env: {
          terrain: Array.from(env.terrain),
          food: Array.from(env.food),
        },
      });
    },

    loadWorld: async (json) => {
      const parsed = JSON.parse(json);
      const { width, height } = parsed;
      const cells: CellBuffers = {
        alive: Uint8Array.from(parsed.cells.alive),
        speciesId: Uint8Array.from(parsed.cells.speciesId),
        energy: Float32Array.from(parsed.cells.energy),
        age: Uint16Array.from(parsed.cells.age),
        health: Float32Array.from(parsed.cells.health),
        dna: Float32Array.from(parsed.cells.dna),
        mutationRate: Float32Array.from(parsed.cells.mutationRate),
      };
      const env: EnvironmentBuffers = {
        terrain: Uint8Array.from(parsed.env.terrain),
        food: Float32Array.from(parsed.env.food),
      };
      const species: SpeciesConfig[] = parsed.species ?? DEFAULT_SPECIES;

      get().pause();
      get()._history.clear();
      set({ width, height, cells, env, species, generation: parsed.generation ?? 0, stats: null, statsHistory: [], historyRange: { oldest: 0, newest: 0, count: 0 } });

      const client = get()._client;
      if (client) {
        await client.init(width, height, cloneCellBuffers(cells), env, species);
      }
    },
  };
});

async function runStep(set: (partial: Partial<SimulationState>) => void, get: () => SimulationState) {
  const { _client, weather, autoWeather, _history } = get();
  if (!_client) return;

  // Auto-cycling weather: shift occasionally for a living-world feel.
  let nextWeather = weather;
  if (autoWeather && Math.random() < 0.004) {
    nextWeather = Math.floor(Math.random() * 6) as Weather;
    set({ weather: nextWeather });
  }

  const result = await _client.step(1, nextWeather);
  _history.maybeCapture(result.stats.generation, result.cells, result.stats);

  const history = [...get().statsHistory, result.stats];
  if (history.length > STATS_HISTORY_LENGTH) history.shift();

  set({
    cells: result.cells,
    stats: result.stats,
    statsHistory: history,
    dirtyChunks: result.dirtyChunks,
    generation: result.stats.generation,
    historyRange: { oldest: _history.oldestGeneration, newest: _history.newestGeneration, count: _history.count },
  });
}

function loop(set: (partial: Partial<SimulationState>) => void, get: () => SimulationState) {
  const tick = async () => {
    if (!get().isRunning) return;
    const t0 = performance.now();
    await runStep(set, get);
    if (!get().isRunning) return;
    const elapsed = performance.now() - t0;
    const interval = 1000 / get().speed;
    const wait = Math.max(0, interval - elapsed);
    const handle = setTimeout(tick, wait);
    set({ _loopHandle: handle });
  };
  void tick();
}
