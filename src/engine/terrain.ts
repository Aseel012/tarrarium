import { Terrain } from "../types";
import type { EnvironmentBuffers } from "../types";
import { createEnvironmentBuffers } from "./buffers";

/** Small deterministic PRNG (mulberry32) so a given seed always reproduces the same world. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates terrain using the classic "random fill + majority smoothing"
 * cellular automaton technique (well known from roguelike cave generation):
 * seed each terrain type at low density, then run smoothing passes so a
 * cell adopts the terrain type of the majority of its neighbors. This
 * produces organic, clustered lakes/forests/rock formations instead of
 * uniform noise speckle, without needing a full Perlin/Simplex implementation.
 */
export function generateTerrain(width: number, height: number, seed: number): EnvironmentBuffers {
  const rand = mulberry32(seed);
  const env = createEnvironmentBuffers(width, height);
  const n = width * height;

  // Seed base geography: water and rock clusters first (they're the most
  // structurally dominant), lava pockets, then scatter food/forest/toxic/safe.
  for (let i = 0; i < n; i++) {
    const r = rand();
    if (r < 0.08) env.terrain[i] = Terrain.Water;
    else if (r < 0.14) env.terrain[i] = Terrain.Rock;
    else if (r < 0.16) env.terrain[i] = Terrain.Lava;
    else env.terrain[i] = Terrain.Plain;
  }

  // Smooth water/rock/lava into coherent blobs via majority-neighbor voting.
  for (let pass = 0; pass < 4; pass++) {
    const next = env.terrain.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const current = env.terrain[idx];
        if (current !== Terrain.Water && current !== Terrain.Rock && current !== Terrain.Lava) continue;

        const counts: Partial<Record<number, number>> = {};
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const t = env.terrain[ny * width + nx];
            if (t === Terrain.Water || t === Terrain.Rock || t === Terrain.Lava) {
              counts[t] = (counts[t] ?? 0) + 1;
            }
          }
        }
        const total = (counts[Terrain.Water] ?? 0) + (counts[Terrain.Rock] ?? 0) + (counts[Terrain.Lava] ?? 0);
        // Erode isolated single cells back to Plain; keep clustered ones.
        next[idx] = total >= 3 ? current : Terrain.Plain;
      }
    }
    env.terrain.set(next);
  }

  // Scatter forest around water (fertile ground), food inside forest,
  // toxic pockets near lava/rock, and small safe sanctuaries elsewhere.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (env.terrain[idx] !== Terrain.Plain) continue;

      let nearWater = false;
      let nearHazard = false;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const t = env.terrain[ny * width + nx];
          if (t === Terrain.Water) nearWater = true;
          if (t === Terrain.Lava || t === Terrain.Rock) nearHazard = true;
        }
      }

      const r = rand();
      if (nearWater && r < 0.55) {
        env.terrain[idx] = r < 0.42 ? Terrain.Forest : Terrain.Food;
      } else if (nearHazard && r < 0.2) {
        env.terrain[idx] = Terrain.Toxic;
      } else if (r < 0.015) {
        env.terrain[idx] = Terrain.Safe;
      } else if (r < 0.05) {
        env.terrain[idx] = Terrain.Forest;
      }
    }
  }

  // Initialize food resource levels: full on Food tiles, moderate on
  // Forest, empty elsewhere. This regenerates over time in the worker.
  for (let i = 0; i < n; i++) {
    if (env.terrain[i] === Terrain.Food) env.food[i] = 1;
    else if (env.terrain[i] === Terrain.Forest) env.food[i] = 0.5;
  }

  return env;
}
