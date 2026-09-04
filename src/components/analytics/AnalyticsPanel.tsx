import { useMemo } from "react";
import { Panel } from "../layout/Panel";
import SparklineChart from "./SparklineChart";
import Histogram from "./Histogram";
import StatOverview from "./StatOverview";
import { useSimulationStore } from "../../store/simulationStore";

function estimateBufferBytes(width: number, height: number): number {
  const n = width * height;
  const perCell = 1 + 1 + 4 + 2 + 4 + 4 + 4;
  const perEnv = 1 + 4;
  return n * (perCell + perEnv);
}


export default function AnalyticsPanel() {
  const { stats, statsHistory, species, cells, width, height } = useSimulationStore((s) => ({
    stats: s.stats,
    statsHistory: s.statsHistory,
    species: s.species,
    cells: s.cells,
    width: s.width,
    height: s.height,
  }));

  const populationSeries = useMemo(
    () => [{ data: statsHistory.map((s) => s.totalAlive), color: "#5eead4", label: "Total" }],
    [statsHistory]
  );

  const perSpeciesSeries = useMemo(
    () =>
      species
        .filter((sp) => sp.enabled)
        .map((sp) => ({
          data: statsHistory.map((s) => s.perSpecies[sp.id] ?? 0),
          color: sp.color,
          label: sp.name,
        })),
    [statsHistory, species]
  );

  const birthDeathSeries = useMemo(
    () => [
      { data: statsHistory.map((s) => s.births), color: "#4ade80", label: "Births" },
      { data: statsHistory.map((s) => s.deaths), color: "#f87171", label: "Deaths" },
    ],
    [statsHistory]
  );

  const mutationSeries = useMemo(
    () => [{ data: statsHistory.map((s) => s.avgMutationRate * 100), color: "#f472b6", label: "Avg mutation %" }],
    [statsHistory]
  );

  const perfSeries = useMemo(
    () => [{ data: statsHistory.map((s) => s.stepTimeMs), color: "#fbbf24", label: "Step time (ms)" }],
    [statsHistory]
  );

  const energyValues = useMemo(() => {
    const values: number[] = [];
    for (let i = 0; i < cells.alive.length; i++) {
      if (cells.alive[i] === 1) values.push(cells.energy[i]);
    }
    return values;
  }, [cells]);

  const memoryBytes = estimateBufferBytes(width, height);

  return (
    <div className="flex flex-col gap-4">
      <StatOverview />

      <Panel title="Population">
        <div className="mb-2 flex flex-wrap gap-3 text-xs">
          {species
            .filter((sp) => sp.enabled)
            .map((sp) => (
              <div key={sp.id} className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: sp.color }} />
                {sp.name}
                <span className="font-mono text-slate-500">{stats?.perSpecies[sp.id] ?? 0}</span>
              </div>
            ))}
        </div>
        <SparklineChart series={perSpeciesSeries.length ? perSpeciesSeries : populationSeries} fill />
      </Panel>

      <Panel title="Birth / Death Rate">
        <div className="mb-1 flex gap-4 text-xs text-slate-400">
          <span className="text-emerald-400">● Births {stats?.births ?? 0}</span>
          <span className="text-rose-400">● Deaths {stats?.deaths ?? 0}</span>
        </div>
        <SparklineChart series={birthDeathSeries} />
      </Panel>

      <Panel title="Energy Distribution">
        <div className="mb-1 text-xs text-slate-400">
          Avg <span className="font-mono text-slate-200">{(stats?.avgEnergy ?? 0).toFixed(1)}</span>
        </div>
        <Histogram values={energyValues} min={0} max={100} color="#5eead4" />
      </Panel>

      <Panel title="Mutation Rate">
        <div className="mb-1 text-xs text-slate-400">
          Avg <span className="font-mono text-slate-200">{((stats?.avgMutationRate ?? 0) * 100).toFixed(2)}%</span>
        </div>
        <SparklineChart series={mutationSeries} />
      </Panel>

      <Panel title="Performance">
        <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div>
            Gen time <span className="block font-mono text-sm text-slate-200">{(stats?.stepTimeMs ?? 0).toFixed(2)}ms</span>
          </div>
          <div>
            Cells <span className="block font-mono text-sm text-slate-200">{(width * height).toLocaleString()}</span>
          </div>
          <div>
            Alive <span className="block font-mono text-sm text-slate-200">{(stats?.totalAlive ?? 0).toLocaleString()}</span>
          </div>
          <div>
            Buffers <span className="block font-mono text-sm text-slate-200">{(memoryBytes / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        </div>
        <SparklineChart series={perfSeries} />
      </Panel>
    </div>
  );
}
