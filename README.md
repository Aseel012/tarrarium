# Terrarium — Cellular Intelligence Simulation Engine

A dashboard-style artificial life simulator: thousands of autonomous, multi-species cells with energy, age, health, DNA, and mutation evolve across procedurally generated terrain under a live weather system. Built with React, TypeScript, Zustand, and a Web Worker–driven simulation core over typed-array (Structure-of-Arrays) buffers.

This is a generalization of Conway's Game of Life — the birth/survival neighbor-counting rules are still there, but "alive/dead" became "energy, age, health, DNA, species, and competition."

## Setup

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

```bash
npm run build      # production build
npm run preview    # serve the production build locally
npm run test:engine # run the engine smoke test (see "Testing the engine" below)
```

## Architecture

```
src/
  types.ts                    Shared types: CellBuffers (SoA), SpeciesConfig, StatsFrame, ...
  engine/
    constants.ts               Species presets, weather effects, terrain colors/labels
    buffers.ts                 Typed-array allocation, cloning, transfer-list helpers
    terrain.ts                 Procedural terrain generation (seeded, smoothed cellular automaton)
    populate.ts                Random population seeding
    spatialGrid.ts             Chunk/dirty-rectangle math (see "Spatial partitioning" below)
    simulationRules.ts         The actual per-generation ruleset — pure, worker-agnostic
    simulation.worker.ts       Web Worker wrapper: owns state, runs batched steps off-thread
    workerClient.ts            Main-thread promise-based API around the worker
    history.ts                 Bounded snapshot manager for time-travel scrubbing
  store/
    simulationStore.ts         Zustand store orchestrating world state + worker + UI actions
  components/
    canvas/SimulationCanvas.tsx   Chunked dirty-rectangle Canvas2D renderer, pan/zoom/paint
    controls/                     Left panel: playback, speed, weather, species tuning
    analytics/                    Right panel: live population/energy/mutation charts
    timeline/                     Bottom panel: generation scrubber
    layout/                       Shared Panel/Button/Slider primitives
scripts/
  smoke-test.ts                 Standalone engine correctness/stability test (see below)
```

## Design decisions worth knowing about

**Structure-of-Arrays, not objects.** Cell state lives in one typed array per attribute (`Uint8Array` for `alive`/`speciesId`, `Float32Array` for `energy`/`health`/`dna`, etc.), not an array of per-cell objects. At 100k+ cells, allocating a JS object per cell per generation would thrash the garbage collector; SoA buffers keep memory compact, cache-friendly, and let whole generations transfer to/from the Web Worker at zero copy cost.

**The grid *is* the spatial partitioning structure.** There's no separate quadtree or bucket structure for neighbor queries — every cell is addressed directly by `y * width + x`, so the only spatial query the simulation ever needs (the fixed 3x3 Moore neighborhood) is an O(1) array read. A quadtree earns its keep when objects move continuously through free space and queries are "find everything near an arbitrary point"; neither is true here. Building one anyway would add indirection without buying anything the flat array doesn't already do for free. (See the comment in `engine/spatialGrid.ts` for the full reasoning.)

**Chunking exists for rendering, not simulation.** The grid is divided into 16x16 chunks purely so the renderer can do real dirty-rectangle repainting: the worker reports which chunks changed each generation, and `SimulationCanvas` intersects those with the visible viewport and repaints only that area — the canvas is never fully cleared during a running simulation, only on pan/zoom/resize. For a sparse world, most of a 100k+-cell grid is empty and simply never gets touched.

**Web Worker with double-buffered ping-pong.** The worker allocates its `current`/`scratch` buffer pairs once and swaps them by reference every generation — no per-generation allocation. When the main thread asks for a batch of N generations, the worker runs all N against the same buffer pair and only clones + transfers the *final* state back, so the (unavoidable) memory copy happens once per rendered frame, not once per simulated generation.

**Terrain generation** uses the classic "random fill + majority-neighbor smoothing" cellular automaton technique (the same one commonly used for roguelike cave generation) rather than a full Perlin/Simplex noise implementation — it's simpler, has no external dependency, and produces convincingly organic lake/forest/rock clusters.

**Charts are hand-built SVG**, not a charting library. The analytics panel only needs simple sparklines and a histogram; a ~50-line component keeps the bundle small and the data flow obvious rather than pulling in Chart.js/Recharts for two chart types.

## The ecosystem, honestly

Four species — Flora (photosynthetic generalist), Predator (hunts via passive energy drain from weaker neighbors), Scavenger (thrives on Toxic/Rock terrain nothing else tolerates), Nomad (highest mutation, widest reproduction window) — compete, reproduce with DNA mutation, and can overtake weaker neighboring cells of a different species (with an energy payoff for the winner, i.e. actual predation, not just repainting a square a different color).

Tuning a 4-species spatial predator/prey/competition model to stay in a permanent four-way equilibrium is a genuinely hard, open-ended balance problem (the same is true of real Lotka-Volterra-style models). With the current parameters, you'll typically see real multi-generation boom/bust dynamics — visible predator-prey cycles, territory competition, extinction cascades — for the first several hundred generations, after which the system usually settles toward one or two dominant species. That's not a bug so much as a real, well-documented phenomenon (the *competitive exclusion principle*) showing up in a finite spatial simulation. The `predationRate`, `energyDecayPerTick`, and `reproductionEnergyThreshold` fields per species in `engine/constants.ts` are the knobs to pull if you want to push the balance point further toward long-run coexistence.

## Testing the engine

`scripts/smoke-test.ts` runs the simulation headless (no browser, no worker) for 500 generations at the default 220x220 grid size and asserts invariants every generation — no NaNs, energy/health/DNA stay within bounds, species IDs stay valid — while printing population/energy/mutation stats every 40 generations. Run it with `npm run test:engine`. This is what caught (and let me fix) an extinction bug during development: predators were starting with too little energy to ever reach their own reproduction threshold, since hunting was originally only possible *during* reproduction — a circular dependency that guaranteed their extinction. Fixing it meant decoupling passive predation from the reproduction step, and is a good example of why the pure, worker-independent `simulationRules.ts` is valuable — it made it possible to catch and debug that outside a browser at all.

## Controls

- **Playback:** Run/Pause, Step (single generation), Reseed (new population on the same terrain), Clear, New World (regenerates terrain + population)
- **Speed:** 1x–20x generations/second
- **Cell size:** zoom level (also adjustable with the mouse wheel)
- **Grid size:** 40–400 per side (regenerates the world — this is what scales you toward the 100k+/160,000-cell range)
- **Weather:** Clear/Rain/Heatwave/Cold/Storm/Drought, with an auto-cycle toggle
- **Heatmap overlay:** Species (default), Population, Energy, Age, Mutation
- **Species panel:** enable/disable each species, tune mutation rate and reproduction threshold live, select a species as the paint brush
- **Save World / Load World:** exports/imports the full terrain + population as JSON
- **Export PNG:** saves the current canvas view
- **Fit to screen:** the grid auto-fits the viewing area on load and whenever grid size changes (`engine/viewportFit.ts`); the button/`F` key re-fits any time after you've manually panned or zoomed away

### Mouse & keyboard

- Click / left-drag to paint the selected brush species; right-click / right-drag to erase
- Shift-drag or middle-mouse-drag to pan; scroll to zoom
- **Space** — Play/Pause · **N** — Step · **R** — Reseed · **C** — Clear · **F** — Fit to screen

### A note on the header's "Source" link

It points at `github.com` as a placeholder — there's no actual public repo behind it yet. Point it at your own repo once you push this somewhere (`src/App.tsx`, the `href="https://github.com"` anchor). I deliberately didn't fabricate star/fork counts anywhere in the UI, since that would just be fake social proof.

## Explicitly out of scope (roadmap)

These were deliberately cut to ship a deep, correct core rather than a shallow pass at everything:

- **Visual no-code rule editor.** The rule engine (`simulationRules.ts`) is a clean, well-isolated place to add one — the natural extension point is generalizing `SpeciesConfig` into a small rule-condition/action AST that the reproduction/survival checks interpret instead of the current hardcoded thresholds.
- **RL-trained agents / evolutionary strategy search.** DNA + mutation + fitness-driven competition already gives a lightweight evolutionary-algorithm flavor; a real RL loop (e.g. training a policy network against the simulation as an environment) is a substantial separate project.
- **PixiJS/WebGL rendering.** Canvas2D + chunked dirty-rect redraws comfortably handles 100k+ cells; WebGL would raise the ceiling further (millions of cells) at the cost of real shader/instancing complexity.
- **MP4 export / GIF recording.** `MediaRecorder` against the canvas's `captureStream()` is the realistic browser-native path here; not wired up.
- **Plugin system / preset ecosystem library.** `SpeciesConfig` and the terrain generator are already parameterized enough to define new presets in a JSON config; a loader + UI for browsing/importing community presets is the remaining piece.
