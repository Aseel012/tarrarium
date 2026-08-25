import { useEffect, useRef, useState } from "react";
import SimulationCanvas from "./components/canvas/SimulationCanvas";
import SimulationControls from "./components/controls/SimulationControls";
import SpeciesPanel from "./components/controls/SpeciesPanel";
import AnalyticsPanel from "./components/analytics/AnalyticsPanel";
import TimelinePanel from "./components/timeline/TimelinePanel";
import AboutSection from "./components/layout/AboutSection";
import { Button } from "./components/layout/Panel";
import { useSimulationStore } from "./store/simulationStore";
import { fitViewport } from "./engine/viewportFit";
import type { Viewport } from "./types";

export default function App() {
  const {
    ready,
    init,
    width,
    height,
    cells,
    env,
    species,
    dirtyChunks,
    heatmapMode,
    paintCell,
    start,
    pause,
    isRunning,
    stepOnce,
    randomizePopulation,
    clearPopulation,
  } = useSimulationStore((s) => s);

  const [viewport, setViewport] = useState<Viewport>({ offsetX: 0, offsetY: 0, cellSize: 6 });

  // Tracks the actual pixel size of the canvas viewing area (reported by
  // SimulationCanvas), used both for the initial auto-fit and the manual
  // "Fit to screen" button.
  const containerSizeRef = useRef({ width: 0, height: 0 });
  // Guards against re-fitting on every ordinary window resize — only the
  // first size report for a given grid configuration triggers an auto-fit,
  // so a user's manual pan/zoom afterward isn't clobbered.
  const autoFitKeyRef = useRef<string>("");

  useEffect(() => {
    init();
    return () => {
      useSimulationStore.getState().pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFitToScreen = () => {
    const { width: cw, height: ch } = containerSizeRef.current;
    if (cw === 0 || ch === 0) return;
    setViewport(fitViewport(width, height, cw, ch));
  };

  const handleContainerSize = (size: { width: number; height: number }) => {
    containerSizeRef.current = size;
    const key = `${width}x${height}`;
    // Auto-fit the very first time we learn the container's size for this
    // grid configuration (covers both initial load and "New World"/grid
    // size changes) — this is what stops the simulation from opening at an
    // arbitrary zoom level that only shows a corner of the grid.
    if (autoFitKeyRef.current !== key && size.width > 0 && size.height > 0) {
      autoFitKeyRef.current = key;
      setViewport(fitViewport(width, height, size.width, size.height));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          isRunning ? pause() : start();
          break;
        case "n":
          stepOnce();
          break;
        case "r":
          randomizePopulation();
          break;
        case "c":
          clearPopulation();
          break;
        case "f":
          handleFitToScreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, start, pause, stepOnce, randomizePopulation, clearPopulation, width, height]);

  const handleExportPng = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrarium-gen${useSimulationStore.getState().generation}.png`;
    a.click();
  };

  return (
    <div className="flex min-h-screen flex-col bg-void text-slate-100">
      <header className="border-b border-edge px-5 py-4">
        <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-signal to-pulse shadow-glass">
              <span className="h-3 w-3 rounded-full bg-void" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-semibold tracking-tight text-white">Terrarium</h1>
                <span className="rounded-full border border-edge bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  v1.0
                </span>
              </div>
              <p className="mt-0.5 max-w-xl text-[12px] leading-snug text-slate-500">
                A dynamic multi-species ecosystem simulation — energy, mutation, predation, and terrain unfolding
                across a live cellular grid.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#about"
              className="hidden items-center gap-1.5 rounded-lg border border-edge bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.07] sm:flex"
            >
              About
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-edge bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.07]"
              title="View source"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Source
            </a>
          </div>
        </div>
        <p className="mx-auto mt-3 hidden max-w-[1600px] text-[11px] text-slate-600 md:block">
          Space play/pause · N step · R reseed · C clear · F fit to screen · scroll to zoom · drag to pan/paint
        </p>
      </header>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Spinning up the simulation worker…</div>
      ) : (
        <>
          <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[280px_1fr_320px]">
            <div className="order-2 overflow-y-auto pr-1 lg:order-1 lg:max-h-[calc(100vh-220px)]">
              <SimulationControls
                cellSize={viewport.cellSize}
                onCellSizeChange={(v: number) => setViewport((prev: Viewport) => ({ ...prev, cellSize: v }))}
                onExportPng={handleExportPng}
              />
              <div className="mt-4">
                <SpeciesPanel />
              </div>
            </div>

            <div className="order-1 relative min-h-[420px] rounded-2xl border border-edge shadow-glass lg:order-2">
              <SimulationCanvas
                width={width}
                height={height}
                cells={cells}
                env={env}
                species={species}
                dirtyChunks={dirtyChunks}
                viewport={viewport}
                onViewportChange={setViewport}
                onPaintCell={paintCell}
                heatmapMode={heatmapMode}
                pendingPattern={null}
                onStampPattern={() => {}}
                onContainerSize={handleContainerSize}
              />
              <div className="absolute right-3 top-3">
                <Button variant="secondary" onClick={handleFitToScreen} title="Fit the whole grid on screen (F)">
                  ⤢ Fit to screen
                </Button>
              </div>
            </div>

            <div className="order-3 overflow-y-auto pl-1 lg:max-h-[calc(100vh-220px)]">
              <AnalyticsPanel />
            </div>
          </main>

          <div className="mx-auto w-full max-w-[1600px] px-4 pb-4">
            <TimelinePanel />
          </div>

          <div id="about">
            <AboutSection />
          </div>
        </>
      )}
    </div>
  );
}
