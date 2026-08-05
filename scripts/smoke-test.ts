import { generateTerrain } from "../src/engine/terrain";
import { seedPopulation } from "../src/engine/populate";
import { createCellBuffers } from "../src/engine/buffers";
import { stepSimulation } from "../src/engine/simulationRules";
import { DEFAULT_SPECIES } from "../src/engine/constants";

const W = 220;
const H = 220;

const env = generateTerrain(W, H, 42);
let current = seedPopulation(W, H, env, DEFAULT_SPECIES, 0.05);
let scratch = createCellBuffers(W, H);

const terrainCounts: Record<number, number> = {};
for (const t of env.terrain) terrainCounts[t] = (terrainCounts[t] ?? 0) + 1;
console.log("Terrain distribution:", terrainCounts);

let initialAlive = 0;
for (const a of current.alive) if (a === 1) initialAlive++;
console.log(`Initial population: ${initialAlive} / ${W * H}`);

for (let gen = 0; gen < 500; gen++) {
  const { stats } = stepSimulation(current, scratch, env, W, H, DEFAULT_SPECIES, 0, gen);
  const tmp = current;
  current = scratch;
  scratch = tmp;

  if (gen % 40 === 0 || gen === 499) {
    console.log(
      `gen ${stats.generation}: alive=${stats.totalAlive} births=${stats.births} deaths=${stats.deaths} ` +
        `avgEnergy=${stats.avgEnergy.toFixed(1)} avgAge=${stats.avgAge.toFixed(1)} avgMut=${(stats.avgMutationRate * 100).toFixed(2)}% ` +
        `species=${JSON.stringify(stats.perSpecies)} stepTime=${stats.stepTimeMs.toFixed(2)}ms`
    );
  }

  // Sanity checks: no NaNs, no negative populations, energy/health within bounds.
  for (let i = 0; i < W * H; i++) {
    if (current.alive[i] === 1) {
      if (Number.isNaN(current.energy[i]) || current.energy[i] < 0 || current.energy[i] > 100) {
        throw new Error(`Bad energy at gen ${gen}, cell ${i}: ${current.energy[i]}`);
      }
      if (Number.isNaN(current.dna[i]) || current.dna[i] < 0 || current.dna[i] > 1) {
        throw new Error(`Bad DNA at gen ${gen}, cell ${i}: ${current.dna[i]}`);
      }
      if (current.speciesId[i] < 1 || current.speciesId[i] > 4) {
        throw new Error(`Bad speciesId at gen ${gen}, cell ${i}: ${current.speciesId[i]}`);
      }
    }
  }
}

console.log("\n✅ 200 generations completed with no invariant violations.");
