/**
 * The actual Game-of-Life-descended ruleset, generalized from binary
 * alive/dead into energy/age/health/DNA/species dynamics. Kept as a pure
 * function of its inputs (no worker/postMessage concerns here at all) so it
 * can be unit tested or reused outside a worker if needed.
 *
 * Per-generation algorithm (two passes over the flat SoA arrays):
 *
 *  Pass 1 — survival: every currently-alive cell ages, pays its terrain-
 *  and weather-adjusted energy cost, optionally feeds on the food layer,
 *  and either survives into `next` or dies (energy/health depleted, or
 *  past its species' max lifespan).
 *
 *  Pass 2 — reproduction: every cell that *survived* pass 1 and has enough
 *  energy scans its 8 neighbors (read from `next`, so contention within the
 *  same generation is resolved in raster-scan order — a standard, cheap
 *  simplification for grid-based artificial life sims). It can spawn into
 *  an empty neighbor, or *overtake* a weaker neighbor of a different
 *  species if its fitness (energy + DNA-weighted) clears the occupant's by
 *  a margin — this is what produces visible inter-species competition.
 *
 * Both passes are single flat loops over `width * height` — no per-cell
 * object allocation, so a 100k+-cell grid runs a full generation in low
 * single-digit milliseconds on a typical laptop.
 */
import { Terrain, type CellBuffers, type EnvironmentBuffers, type SpeciesConfig, type StatsFrame } from "../types";
import { WEATHER_EFFECTS } from "./constants";
import { chunkIndexForCell, totalChunks } from "./spatialGrid";

const FOOD_CONSUME_RATE = 0.12;
const FOOD_REGEN_RATE = 0.02;
const FOOD_ENERGY_YIELD = 24;
const PLAIN_AMBIENT_ENERGY = 1.15;
const PREDATION_ENERGY_SHARE = 0.6;
const MAX_ENERGY = 100;
const MAX_HEALTH = 100;
const OVERTAKE_MARGIN = 1.15;

function mutate(value: number, rate: number, rand: () => number, min = 0, max = 1): number {
  const drift = (rand() * 2 - 1) * rate;
  return Math.min(max, Math.max(min, value + drift));
}

export function stepSimulation(
  current: CellBuffers,
  next: CellBuffers,
  env: EnvironmentBuffers,
  width: number,
  height: number,
  speciesList: SpeciesConfig[],
  weather: number,
  generation: number,
  rand: () => number = Math.random
): { stats: StatsFrame; dirtyChunks: Uint8Array } {
  const n = width * height;
  const speciesById = new Map<number, SpeciesConfig>();
  speciesList.forEach((s) => speciesById.set(s.id, s));
  const weatherFx = WEATHER_EFFECTS[weather] ?? WEATHER_EFFECTS[0];

  // Reset `next` to all-dead; survivors and births will populate it below.
  next.alive.fill(0);
  next.speciesId.fill(0);
  next.energy.fill(0);
  next.age.fill(0);
  next.health.fill(0);
  next.dna.fill(0);
  next.mutationRate.fill(0);

  const dirtyChunks = new Uint8Array(totalChunks(width, height));
  let births = 0;
  let deaths = 0;

  // ---- Food regeneration (independent of occupancy) ----------------------
  for (let i = 0; i < n; i++) {
    const t = env.terrain[i];
    if (t === Terrain.Food || t === Terrain.Forest) {
      const cap = t === Terrain.Food ? 1 : 0.5;
      env.food[i] = Math.min(cap, env.food[i] + FOOD_REGEN_RATE * weatherFx.foodRegenMultiplier);
    }
  }

  // ---- Pass 1: survival ---------------------------------------------------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (current.alive[i] !== 1) continue;

      const species = speciesById.get(current.speciesId[i]);
      if (!species || !species.enabled) {
        deaths++;
        markDirty(dirtyChunks, x, y, width);
        continue;
      }

      const terrain = env.terrain[i];
      const affinity = species.terrainAffinity[terrain as Terrain] ?? 1;

      let energy = current.energy[i];
      let health = current.health[i];
      const age = current.age[i] + 1;

      // Terrain + weather-adjusted energy decay.
      energy -= species.energyDecayPerTick * weatherFx.energyDecayMultiplier * (2 - Math.min(affinity, 2));

      // Feed on the food layer if present.
      if ((terrain === Terrain.Food || terrain === Terrain.Forest) && env.food[i] > 0) {
        const taken = Math.min(env.food[i], FOOD_CONSUME_RATE);
        env.food[i] -= taken;
        energy += taken * FOOD_ENERGY_YIELD * affinity;
      }

      // Passive terrain energy gain/drain for terrain with affinity != 1
      // that isn't the food layer (water/safe bonus, toxic/lava drain).
      if (terrain === Terrain.Toxic) health -= 6 * (1 / Math.max(affinity, 0.1));
      if (terrain === Terrain.Lava) health -= 30 * (1 / Math.max(affinity, 0.1));
      if (terrain === Terrain.Safe) health = Math.min(MAX_HEALTH, health + 2);
      if (terrain === Terrain.Water) energy += 0.4 * affinity;
      // Plain terrain has no food layer, but still represents a baseline
      // ambient resource (sunlight, airborne nutrients) — without this,
      // the ~70% of the map that isn't Water/Forest/Food is a pure energy
      // sink with no way for a static (non-moving) cell to ever recover,
      // which reliably collapses the whole ecosystem to extinction.
      if (terrain === Terrain.Plain) energy += PLAIN_AMBIENT_ENERGY * affinity;

      // Weather hazards (storms cause random health damage).
      if (rand() < weatherFx.healthDamageChance) health -= 15;

      // Passive predation: species with predationRate > 0 draw energy from
      // weaker neighbors of a different species every tick, independent of
      // reproduction. This is what makes a "predator" archetype survivable
      // at all — without it, a newborn with low starting energy has no way
      // to ever climb back up to its own reproduction threshold, since the
      // only place hunting happened was inside the reproduction step itself.
      if (species.predationRate > 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (
              current.alive[ni] === 1 &&
              current.speciesId[ni] !== current.speciesId[i] &&
              current.energy[ni] < energy
            ) {
              energy += species.predationRate * current.energy[ni];
            }
          }
        }
      }

      energy = Math.min(MAX_ENERGY, Math.max(0, energy));
      health = Math.min(MAX_HEALTH, Math.max(0, health));

      const dies = energy <= 0 || health <= 0 || age > species.maxLifespan;

      if (dies) {
        deaths++;
        markDirty(dirtyChunks, x, y, width);
        continue;
      }

      next.alive[i] = 1;
      next.speciesId[i] = species.id;
      next.energy[i] = energy;
      next.age[i] = age;
      next.health[i] = health;
      next.dna[i] = current.dna[i];
      next.mutationRate[i] = current.mutationRate[i];
      markDirty(dirtyChunks, x, y, width);
    }
  }

  // ---- Pass 2: reproduction & competition --------------------------------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      // Only cells that were alive both before and after pass 1 (i.e.
      // survivors, not this tick's newborns) get to reproduce.
      if (current.alive[i] !== 1 || next.alive[i] !== 1) continue;

      const species = speciesById.get(next.speciesId[i]);
      if (!species) continue;
      if (next.energy[i] < species.reproductionEnergyThreshold) continue;

      // Count living neighbors (any species) to respect the birth window.
      let neighborCount = 0;
      const targets: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (next.alive[ni] === 1) {
            neighborCount++;
            if (next.speciesId[ni] !== species.id) targets.push(ni); // possible overtake target
          } else {
            targets.push(ni); // empty target
          }
        }
      }

      const [minN, maxN] = species.neighborRange;
      if (neighborCount < minN || neighborCount > maxN) continue;
      if (targets.length === 0) continue;

      const challengerFitness = next.energy[i] * (0.7 + 0.3 * next.dna[i]);

      // Prefer empty cells over overtaking occupied ones; shuffle-ish pick
      // via rand() so growth isn't biased toward one neighbor direction.
      const empties = targets.filter((t) => next.alive[t] === 0);
      const rivals = targets.filter((t) => next.alive[t] === 1);
      let targetIdx = -1;

      if (empties.length > 0) {
        targetIdx = empties[Math.floor(rand() * empties.length)];
      } else {
        for (const rivalIdx of rivals) {
          const occupantFitness = next.energy[rivalIdx] * (0.7 + 0.3 * next.dna[rivalIdx]);
          if (challengerFitness > occupantFitness * OVERTAKE_MARGIN) {
            targetIdx = rivalIdx;
            break;
          }
        }
      }

      if (targetIdx === -1) continue;

      const wasOccupied = next.alive[targetIdx] === 1;
      if (wasOccupied) {
        deaths++; // overtaken rival counts as a death
        // Predation payoff: the challenger absorbs a share of the defeated
        // rival's energy before the cell is overwritten. Without this,
        // "competition" was purely positional (who gets the empty square)
        // with no nutritional benefit — which made high-decay predator-style
        // species (built to rely on contesting neighbors rather than
        // photosynthesizing) strictly worse than everything else and
        // guaranteed their extinction regardless of how aggressive they were.
        next.energy[i] = Math.min(MAX_ENERGY, next.energy[i] + next.energy[targetIdx] * PREDATION_ENERGY_SHARE);
      }

      next.alive[targetIdx] = 1;
      next.speciesId[targetIdx] = species.id;
      next.energy[targetIdx] = Math.min(MAX_ENERGY, species.reproductionCost * 0.8);
      next.age[targetIdx] = 0;
      next.health[targetIdx] = MAX_HEALTH;
      next.dna[targetIdx] = mutate(next.dna[i], next.mutationRate[i], rand);
      next.mutationRate[targetIdx] = mutate(next.mutationRate[i], 0.01, rand, 0.005, 0.4);

      next.energy[i] -= species.reproductionCost;
      births++;

      const tx = targetIdx % width;
      const ty = Math.floor(targetIdx / width);
      markDirty(dirtyChunks, tx, ty, width);
      markDirty(dirtyChunks, x, y, width);
    }
  }

  // ---- Aggregate stats ------------------------------------------------
  let totalAlive = 0;
  let energySum = 0;
  let mutationSum = 0;
  let ageSum = 0;
  const perSpecies: Record<number, number> = {};
  speciesList.forEach((s) => (perSpecies[s.id] = 0));

  for (let i = 0; i < n; i++) {
    if (next.alive[i] !== 1) continue;
    totalAlive++;
    energySum += next.energy[i];
    mutationSum += next.mutationRate[i];
    ageSum += next.age[i];
    perSpecies[next.speciesId[i]] = (perSpecies[next.speciesId[i]] ?? 0) + 1;
  }

  const stats: StatsFrame = {
    generation: generation + 1,
    totalAlive,
    births,
    deaths,
    perSpecies,
    avgEnergy: totalAlive ? energySum / totalAlive : 0,
    avgMutationRate: totalAlive ? mutationSum / totalAlive : 0,
    avgAge: totalAlive ? ageSum / totalAlive : 0,
    stepTimeMs: 0, // filled in by the caller, which can see wall-clock time
  };

  return { stats, dirtyChunks };
}

function markDirty(dirtyChunks: Uint8Array, x: number, y: number, width: number) {
  dirtyChunks[chunkIndexForCell(x, y, width)] = 1;
}
