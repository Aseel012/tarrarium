import { Panel } from "./Panel";

export default function AboutSection() {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 px-4 pb-6 md:grid-cols-2">
      <Panel title="About">
        <h3 className="mb-2 font-display text-base font-semibold text-white">What this is</h3>
        <p className="text-[13px] leading-relaxed text-slate-400">
          Terrarium is a multi-species artificial life simulation: thousands of cells with energy, age, health, DNA,
          and mutation rate evolve across procedurally generated terrain under a live weather system. Reproduction,
          predation, and territorial competition are the same generalized "birth/survival" rules from Conway's Game
          of Life, extended from binary alive/dead into a full energy economy.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
          The simulation runs on a Web Worker over typed-array buffers so the UI stays smooth regardless of grid
          size, with chunked dirty-rectangle rendering so only the parts of the world that actually changed get
          repainted each generation. Tune species behavior, weather, and terrain live from the panels alongside the
          grid.
        </p>
      </Panel>

      <Panel title="Roadmap">
        <h3 className="mb-2 font-display text-base font-semibold text-white">Where this goes next</h3>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-slate-400">
          <li>
            <span className="font-medium text-slate-300">Visual rule editor —</span> a no-code condition/action
            builder over the existing species ruleset, so new behaviors don't require touching code.
          </li>
          <li>
            <span className="font-medium text-slate-300">Evolutionary strategy search —</span> DNA + mutation already
            give a light evolutionary-algorithm flavor; a real fitness-driven strategy search is the natural next
            step.
          </li>
          <li>
            <span className="font-medium text-slate-300">WebGL rendering —</span> to push past the current 100k+-cell
            ceiling toward millions, at the cost of real shader complexity.
          </li>
          <li>
            <span className="font-medium text-slate-300">Recording & export —</span> MP4/GIF capture of a running
            simulation via the canvas's native <code className="text-slate-500">captureStream()</code>.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
