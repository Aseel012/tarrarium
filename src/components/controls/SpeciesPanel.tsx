import { Panel } from "../layout/Panel";
import { Slider } from "../layout/Slider";
import { useSimulationStore } from "../../store/simulationStore";

export default function SpeciesPanel() {
  const { species, updateSpecies, selectedBrushSpecies, setBrushSpecies } = useSimulationStore((s) => s);

  return (
    <Panel title="Species">
      <div className="flex flex-col gap-4">
        {species.map((sp) => (
          <div key={sp.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setBrushSpecies(sp.id)}
                title="Select as paint brush"
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  selectedBrushSpecies === sp.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
                {sp.name}
              </button>
              <input
                type="checkbox"
                checked={sp.enabled}
                onChange={(e) => updateSpecies(sp.id, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-signal"
                title="Enabled"
              />
            </div>
            <Slider
              label="Mutation rate"
              value={Math.round(sp.baseMutationRate * 100)}
              min={1}
              max={30}
              unit="%"
              onChange={(v) => updateSpecies(sp.id, { baseMutationRate: v / 100 })}
            />
            <div className="mt-2">
              <Slider
                label="Reproduction threshold"
                value={sp.reproductionEnergyThreshold}
                min={30}
                max={90}
                onChange={(v) => updateSpecies(sp.id, { reproductionEnergyThreshold: v })}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-snug text-slate-500">
        Click a species name to select it as the paint brush, then click/drag on the grid to place cells. Right-click
        erases.
      </p>
    </Panel>
  );
}
