import { Terrain, type SpeciesConfig } from "../types";

/** Grid is divided into square chunks for dirty-rectangle rendering — see
 * spatialGrid.ts for how chunk indices are derived from cell coordinates. */
export const CHUNK_SIZE = 16;
/**
 * Four species with meaningfully different survival strategies, so the
 * ecosystem produces visible emergent dynamics rather than four cosmetic
 * palette swaps of the same automaton:
 *
 * - Flora: photosynthetic, thrives on Forest/Food, low mutation, dies fast
 *   off safe terrain. The ecosystem's energy base.
 * - Predator: high energy needs, low reproduction threshold, aggressively
 *   contests neighboring cells (see competition rule in simulationRules.ts).
 * - Scavenger: tolerates Toxic/Rock where nothing else survives well, average
 *   everything else — the opportunist.
 * - Nomad: highest mutation rate, no strong terrain affinity, wide
 *   reproduction window — the generalist that adapts fastest but wastes
 *   energy doing it.
 */
export const DEFAULT_SPECIES: SpeciesConfig[] = [
  {
    id: 1,
    name: "Flora",
    color: "#4ade80",
    baseMutationRate: 0.03,
    reproductionEnergyThreshold: 48,
    reproductionCost: 25,
    energyDecayPerTick: 0.85,
    maxLifespan: 90,
    neighborRange: [1, 3],
    terrainAffinity: {
      [Terrain.Forest]: 1.8,
      [Terrain.Food]: 2.2,
      [Terrain.Water]: 1.1,
      [Terrain.Safe]: 1.15,
      [Terrain.Rock]: 0.6,
      [Terrain.Toxic]: 0.25,
      [Terrain.Lava]: 0.05,
    },
    predationRate: 0,
    enabled: true,
  },
  {
    id: 2,
    name: "Predator",
    color: "#f87171",
    baseMutationRate: 0.05,
    reproductionEnergyThreshold: 42,
    reproductionCost: 22,
    energyDecayPerTick: 1.7,
    maxLifespan: 60,
    neighborRange: [1, 3],
    terrainAffinity: {
      [Terrain.Forest]: 0.9,
      [Terrain.Food]: 0.7,
      [Terrain.Water]: 1.0,
      [Terrain.Safe]: 0.9,
      [Terrain.Rock]: 0.8,
      [Terrain.Toxic]: 0.4,
      [Terrain.Lava]: 0.05,
    },
    predationRate: 0.22,
    enabled: true,
  },
  {
    id: 3,
    name: "Scavenger",
    color: "#facc15",
    baseMutationRate: 0.04,
    reproductionEnergyThreshold: 46,
    reproductionCost: 24,
    energyDecayPerTick: 1.1,
    maxLifespan: 75,
    neighborRange: [1, 5],
    terrainAffinity: {
      [Terrain.Forest]: 1.0,
      [Terrain.Food]: 1.3,
      [Terrain.Water]: 0.9,
      [Terrain.Safe]: 1.0,
      [Terrain.Rock]: 1.4,
      [Terrain.Toxic]: 1.6,
      [Terrain.Lava]: 0.15,
    },
    predationRate: 0.08,
    enabled: true,
  },
  {
    id: 4,
    name: "Nomad",
    color: "#60a5fa",
    baseMutationRate: 0.09,
    reproductionEnergyThreshold: 44,
    reproductionCost: 22,
    energyDecayPerTick: 1.3,
    maxLifespan: 70,
    neighborRange: [1, 4],
    terrainAffinity: {
      [Terrain.Forest]: 1.1,
      [Terrain.Food]: 1.2,
      [Terrain.Water]: 1.1,
      [Terrain.Safe]: 1.05,
      [Terrain.Rock]: 1.0,
      [Terrain.Toxic]: 0.7,
      [Terrain.Lava]: 0.1,
    },
    predationRate: 0.03,
    enabled: true,
  },
];

/** Global per-tick multipliers applied on top of species/terrain effects. */
export const WEATHER_EFFECTS: Record<
  number,
  { energyDecayMultiplier: number; foodRegenMultiplier: number; healthDamageChance: number; label: string }
> = {
  0: { energyDecayMultiplier: 1.0, foodRegenMultiplier: 1.0, healthDamageChance: 0, label: "Clear" },
  1: { energyDecayMultiplier: 0.85, foodRegenMultiplier: 1.4, healthDamageChance: 0, label: "Rain" },
  2: { energyDecayMultiplier: 1.35, foodRegenMultiplier: 0.7, healthDamageChance: 0.01, label: "Heatwave" },
  3: { energyDecayMultiplier: 1.25, foodRegenMultiplier: 0.85, healthDamageChance: 0, label: "Cold" },
  4: { energyDecayMultiplier: 1.15, foodRegenMultiplier: 0.9, healthDamageChance: 0.04, label: "Storm" },
  5: { energyDecayMultiplier: 1.2, foodRegenMultiplier: 0.4, healthDamageChance: 0, label: "Drought" },
};

export const TERRAIN_LABELS: Record<number, string> = {
  [Terrain.Plain]: "Plain",
  [Terrain.Water]: "Water",
  [Terrain.Forest]: "Forest",
  [Terrain.Rock]: "Rock",
  [Terrain.Lava]: "Lava",
  [Terrain.Food]: "Food",
  [Terrain.Toxic]: "Toxic",
  [Terrain.Safe]: "Safe",
};

export const TERRAIN_COLORS: Record<number, string> = {
  [Terrain.Plain]: "#12161f",
  [Terrain.Water]: "#0e3a5f",
  [Terrain.Forest]: "#0f3d24",
  [Terrain.Rock]: "#2a2a2e",
  [Terrain.Lava]: "#5c1a0e",
  [Terrain.Food]: "#3a3312",
  [Terrain.Toxic]: "#2c1a3d",
  [Terrain.Safe]: "#123328",
};
