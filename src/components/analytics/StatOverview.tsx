import { Panel } from "../layout/Panel";
import { useSimulationStore } from "../../store/simulationStore";

/** A tight label/value list for at-a-glance numbers — the "what's happening right now" strip. */
export default function StatOverview() {
  const { stats, generation, width, height, species, isRunning, speed } = useSimulationStore((s) => ({
    stats: s.stats,
    generation: s.generation,
    width: s.width,
    height: s.height,
    species: s.species,
    isRunning: s.isRunning,
    speed: s.speed,
  }));

  const speciesAlive = species.filter((sp) => sp.enabled && (stats?.perSpecies[sp.id] ?? 0) > 0).length;

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: "Generation", value: generation.toLocaleString() },
    { label: "Alive", value: (stats?.totalAlive ?? 0).toLocaleString(), accent: true },
    { label: "Species alive", value: `${speciesAlive} / ${species.length}` },
    { label: "Grid", value: `${width} × ${height}` },
    { label: "Avg energy", value: (stats?.avgEnergy ?? 0).toFixed(1) },
    { label: "Speed", value: `${speed}x` },
  ];

  return (
    <Panel
      title="Overview"
      action={
        <span
          className={`flex items-center gap-1.5 text-[11px] font-medium ${isRunning ? "text-emerald-400" : "text-slate-500"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`} />
          {isRunning ? "Running" : "Paused"}
        </span>
      }
    >
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="text-slate-400">{row.label}</span>
            <span className={`font-mono tabular-nums ${row.accent ? "font-semibold text-signal" : "text-slate-200"}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
