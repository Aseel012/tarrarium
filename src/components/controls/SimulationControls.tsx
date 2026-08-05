import { useState } from "react";
import { Panel, Button } from "../layout/Panel";
import { Slider } from "../layout/Slider";
import { useSimulationStore } from "../../store/simulationStore";
import { WEATHER_EFFECTS } from "../../engine/constants";
import type { HeatmapMode, Weather } from "../../types";

const HEATMAP_OPTIONS: { mode: HeatmapMode; label: string }[] = [
  { mode: "none", label: "Species" },
  { mode: "population", label: "Population" },
  { mode: "energy", label: "Energy" },
  { mode: "age", label: "Age" },
  { mode: "mutation", label: "Mutation" },
];

interface SimulationControlsProps {
  cellSize: number;
  onCellSizeChange: (v: number) => void;
  onExportPng: () => void;
}

export default function SimulationControls({ cellSize, onCellSizeChange, onExportPng }: SimulationControlsProps) {
  const {
    isRunning,
    speed,
    width,
    weather,
    autoWeather,
    heatmapMode,
    start,
    pause,
    stepOnce,
    randomizePopulation,
    regenerateWorld,
    clearPopulation,
    setSpeed,
    setGridSize,
    setWeather,
    setAutoWeather,
    setHeatmapMode,
    saveWorld,
    loadWorld,
  } = useSimulationStore((s) => s);

  const [gridSizeDraft, setGridSizeDraft] = useState(width);

  const handleSave = () => {
    const json = saveWorld();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrarium-world.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => loadWorld(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Playback">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => (isRunning ? pause() : start())}>
            {isRunning ? "⏸ Pause" : "▶ Run"}
          </Button>
          <Button onClick={stepOnce} disabled={isRunning} title="Advance one generation">
            ⏭ Step
          </Button>
          <Button onClick={randomizePopulation} title="Reseed population on the current terrain">
            🎲 Reseed
          </Button>
          <Button onClick={clearPopulation}>✖ Clear</Button>
          <Button variant="danger" onClick={regenerateWorld} title="New terrain + fresh population">
            ↺ New World
          </Button>
        </div>
      </Panel>

      <Panel title="Simulation Speed">
        <Slider label="Generations / sec" value={speed} min={1} max={20} unit="x" onChange={setSpeed} />
        <div className="mt-3">
          <Slider label="Cell size (zoom)" value={Math.round(cellSize)} min={2} max={48} unit="px" onChange={onCellSizeChange} />
        </div>
        <div className="mt-3">
          <Slider
            label="Grid size"
            value={gridSizeDraft}
            min={40}
            max={400}
            step={10}
            onChange={setGridSizeDraft}
            onCommit={(v) => setGridSize(v)}
          />
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            {(gridSizeDraft * gridSizeDraft).toLocaleString()} cells at this size. Changing this regenerates the world.
          </p>
        </div>
      </Panel>

      <Panel title="Weather">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(WEATHER_EFFECTS).map(([code, fx]) => (
            <Button
              key={code}
              variant="secondary"
              active={weather === Number(code)}
              onClick={() => setWeather(Number(code) as Weather)}
              className="!text-[11px]"
            >
              {fx.label}
            </Button>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-between text-xs text-slate-400">
          <span>Auto-cycle weather</span>
          <input
            type="checkbox"
            checked={autoWeather}
            onChange={(e) => setAutoWeather(e.target.checked)}
            className="h-3.5 w-3.5 accent-signal"
          />
        </label>
      </Panel>

      <Panel title="Heatmap Overlay">
        <div className="flex flex-wrap gap-2">
          {HEATMAP_OPTIONS.map((opt) => (
            <Button key={opt.mode} active={heatmapMode === opt.mode} onClick={() => setHeatmapMode(opt.mode)}>
              {opt.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title="Import / Export">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave}>💾 Save World</Button>
          <Button onClick={handleLoadClick}>📂 Load World</Button>
          <Button onClick={onExportPng}>🖼 Export PNG</Button>
        </div>
      </Panel>
    </div>
  );
}
