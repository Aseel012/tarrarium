import { Panel, Button } from "../layout/Panel";
import { useSimulationStore } from "../../store/simulationStore";
import { SNAPSHOT_INTERVAL } from "../../engine/history";

/**
 * Time-travel scrubber. Snapshots are only taken every SNAPSHOT_INTERVAL
 * generations (see engine/history.ts) to keep memory bounded, so scrubbing
 * jumps to the closest available snapshot rather than an exact generation.
 */
export default function TimelinePanel() {
  const { generation, historyRange, isScrubbing, scrubGeneration, isRunning, stats, scrubTo, resumeFromScrub, pause } =
    useSimulationStore((s) => s);

  const hasHistory = historyRange.count > 0;

  return (
    <Panel dense className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="uppercase tracking-widest text-[11px] text-slate-500">Timeline</span>
        <div className="flex items-center gap-4 font-mono text-slate-300">
          <span>Gen {isScrubbing ? scrubGeneration : generation}</span>
          <span className={isRunning ? "text-emerald-400" : "text-slate-500"}>{isRunning ? "● running" : "○ paused"}</span>
          <span>{stats ? `${stats.stepTimeMs.toFixed(1)}ms/gen` : "—"}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(historyRange.newest, generation, SNAPSHOT_INTERVAL)}
          step={SNAPSHOT_INTERVAL}
          value={isScrubbing ? scrubGeneration : generation}
          disabled={!hasHistory}
          onChange={(e) => {
            if (isRunning) pause();
            scrubTo(Number(e.target.value));
          }}
          className="flex-1 accent-signal disabled:opacity-30"
        />
        {isScrubbing ? (
          <Button variant="primary" onClick={resumeFromScrub}>
            Resume from here
          </Button>
        ) : (
          <span className="whitespace-nowrap text-[11px] text-slate-500">
            {hasHistory ? `${historyRange.count} snapshots stored` : "no history yet"}
          </span>
        )}
      </div>
    </Panel>
  );
}
