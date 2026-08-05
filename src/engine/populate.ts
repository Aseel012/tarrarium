import { Terrain, type CellBuffers, type EnvironmentBuffers, type SpeciesConfig } from "../types";
import { createCellBuffers } from "./buffers";

/** Randomly scatter living cells across the grid, round-robin across enabled species. */
export function seedPopulation(
  width: number,
  height: number,
  env: EnvironmentBuffers,
  species: SpeciesConfig[],
  density = 0.05
): CellBuffers {
  const cells = createCellBuffers(width, height);
  const enabled = species.filter((s) => s.enabled);
  if (enabled.length === 0) return cells;

  let speciesCursor = 0;
  for (let i = 0; i < width * height; i++) {
    if (env.terrain[i] === Terrain.Lava) continue; // don't spawn directly into lava
    if (Math.random() >= density) continue;

    const s = enabled[speciesCursor % enabled.length];
    speciesCursor++;

    cells.alive[i] = 1;
    cells.speciesId[i] = s.id;
    cells.energy[i] = 50 + Math.random() * 30;
    cells.age[i] = 0;
    cells.health[i] = 100;
    cells.dna[i] = Math.random();
    cells.mutationRate[i] = s.baseMutationRate;
  }

  return cells;
}
