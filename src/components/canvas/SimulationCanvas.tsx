/**
 * Renders the world (terrain + cells) onto a persistent Canvas2D surface.
 *
 * Rendering strategy — real dirty-rectangle redraws, not just "redraw
 * everything every frame":
 *
 *  - The canvas is NOT cleared each frame. It's treated as a persistent
 *    surface that already holds a valid picture of the world.
 *  - A full repaint of the visible viewport only happens when the
 *    viewport itself changes (pan/zoom/resize) or the heatmap mode/theme
 *    changes — anything that invalidates the *whole* picture.
 *  - On every simulation step, the worker reports which chunks (from
 *    engine/spatialGrid.ts) actually changed. We intersect those chunk
 *    rectangles with the current viewport and repaint only that area —
 *    for a sparse world where most of a 100k+-cell grid is empty, this
 *    means the vast majority of the canvas is untouched most generations.
 *  - Hover/pattern-preview highlights are drawn as a small final overlay
 *    pass, and the previously-highlighted cell is explicitly repainted
 *    (not just redrawn over) before the new highlight is drawn, so stale
 *    highlights never linger without needing a full clear.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CellBuffers, EnvironmentBuffers, HeatmapMode, Pattern, SpeciesConfig, Viewport } from "../../types";
import { CHUNK_SIZE } from "../../engine/constants";
import { TERRAIN_COLORS } from "../../engine/constants";

interface SimulationCanvasProps {
  width: number;
  height: number;
  cells: CellBuffers;
  env: EnvironmentBuffers;
  species: SpeciesConfig[];
  dirtyChunks: Uint8Array | null;
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  onPaintCell: (x: number, y: number, erase: boolean) => void;
  heatmapMode: HeatmapMode;
  pendingPattern: Pattern | null;
  onStampPattern: (originX: number, originY: number) => void;
  /** Reports the canvas's actual pixel size whenever it changes, so the
   * parent can compute a "fit the whole grid on screen" viewport. */
  onContainerSize?: (size: { width: number; height: number }) => void;
}

const EMPTY_COLOR = "#05070a";

export default function SimulationCanvas({
  width,
  height,
  cells,
  env,
  species,
  dirtyChunks,
  viewport,
  onViewportChange,
  onPaintCell,
  heatmapMode,
  pendingPattern,
  onStampPattern,
  onContainerSize,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  const speciesById = useRef<Map<number, SpeciesConfig>>(new Map());
  speciesById.current = new Map(species.map((s) => [s.id, s]));

  const drag = useRef<{
    mode: "paint" | "erase" | "pan" | null;
    lastCellX: number | null;
    lastCellY: number | null;
    lastClientX: number;
    lastClientY: number;
    moved: boolean;
  }>({ mode: null, lastCellX: null, lastCellY: null, lastClientX: 0, lastClientY: 0, moved: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        onContainerSize?.({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const worldToScreen = useCallback(
    (wx: number, wy: number) => ({
      sx: (wx - viewport.offsetX) * viewport.cellSize,
      sy: (wy - viewport.offsetY) * viewport.cellSize,
    }),
    [viewport]
  );

  const screenToWorldCell = useCallback(
    (sx: number, sy: number) => ({
      x: Math.floor(viewport.offsetX + sx / viewport.cellSize),
      y: Math.floor(viewport.offsetY + sy / viewport.cellSize),
    }),
    [viewport]
  );

  /** Compute a cell's fill color given the current heatmap mode. */
  const colorForCell = useCallback(
    (i: number): string | null => {
      if (cells.alive[i] !== 1) return null;
      const sid = cells.speciesId[i];
      const sp = speciesById.current.get(sid);
      if (!sp) return null;

      if (heatmapMode === "species" || heatmapMode === "none") {
        const energyRatio = cells.energy[i] / 100;
        const dna = cells.dna[i];
        // Base species hue, nudged by DNA, lightness driven by energy so
        // healthy/energetic cells visibly pop against starving ones.
        const lightness = 35 + energyRatio * 30;
        return shiftColor(sp.color, dna, lightness);
      }
      if (heatmapMode === "population") {
        return "#5eead4";
      }
      if (heatmapMode === "energy") {
        return heatColor(cells.energy[i] / 100);
      }
      if (heatmapMode === "age") {
        return heatColor(Math.min(1, cells.age[i] / sp.maxLifespan));
      }
      if (heatmapMode === "mutation") {
        return heatColor(Math.min(1, cells.mutationRate[i] / 0.4));
      }
      return sp.color;
    },
    [cells, heatmapMode]
  );

  /** Repaint a world-space rectangle (terrain + grid lines + cells) in place. */
  const paintWorldRect = useCallback(
    (ctx: CanvasRenderingContext2D, wx0: number, wy0: number, wx1: number, wy1: number) => {
      const x0 = Math.max(0, Math.floor(wx0));
      const y0 = Math.max(0, Math.floor(wy0));
      const x1 = Math.min(width, Math.ceil(wx1));
      const y1 = Math.min(height, Math.ceil(wy1));
      const { cellSize } = viewport;
      const showGrid = cellSize > 3;

      // Anything outside the live grid bounds but inside the viewport
      // renders as empty void (the "infinite-looking" edge of the world).
      const { sx: rectSx, sy: rectSy } = worldToScreen(wx0, wy0);
      const { sx: rectEx, sy: rectEy } = worldToScreen(wx1, wy1);
      ctx.fillStyle = EMPTY_COLOR;
      ctx.fillRect(Math.floor(rectSx), Math.floor(rectSy), Math.ceil(rectEx - rectSx), Math.ceil(rectEy - rectSy));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * width + x;
          const { sx, sy } = worldToScreen(x, y);
          const terrain = env.terrain[i];
          ctx.fillStyle = TERRAIN_COLORS[terrain] ?? EMPTY_COLOR;
          ctx.fillRect(sx, sy, cellSize, cellSize);

          const cellColor = colorForCell(i);
          if (cellColor) {
            ctx.fillStyle = cellColor;
            ctx.fillRect(sx + 1, sy + 1, Math.max(1, cellSize - 1), Math.max(1, cellSize - 1));
          }
        }
      }

      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = x0; x <= x1; x++) {
          const { sx } = worldToScreen(x, 0);
          ctx.moveTo(sx + 0.5, rectSy);
          ctx.lineTo(sx + 0.5, rectEy);
        }
        for (let y = y0; y <= y1; y++) {
          const { sy } = worldToScreen(0, y);
          ctx.moveTo(rectSx, sy + 0.5);
          ctx.lineTo(rectEx, sy + 0.5);
        }
        ctx.stroke();
      }
    },
    [width, height, env, viewport, worldToScreen, colorForCell]
  );

  const drawHoverOverlay = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const hover = hoverRef.current;
      if (!hover) return;
      if (pendingPattern) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#5eead4";
        pendingPattern.cells.forEach(({ x, y }: { x: number; y: number }) => {
          const { sx, sy } = worldToScreen(hover.x + x, hover.y + y);
          ctx.fillRect(sx + 1, sy + 1, viewport.cellSize - 1, viewport.cellSize - 1);
        });
        ctx.globalAlpha = 1;
      } else if (viewport.cellSize > 3) {
        ctx.strokeStyle = "#5eead4";
        ctx.lineWidth = 2;
        const { sx, sy } = worldToScreen(hover.x, hover.y);
        ctx.strokeRect(sx + 1, sy + 1, viewport.cellSize - 2, viewport.cellSize - 2);
      }
    },
    [pendingPattern, viewport, worldToScreen]
  );

  const visibleWorldBounds = useCallback(() => {
    const { cellSize } = viewport;
    return {
      x0: viewport.offsetX - 1,
      y0: viewport.offsetY - 1,
      x1: viewport.offsetX + size.width / cellSize + 1,
      y1: viewport.offsetY + size.height / cellSize + 1,
    };
  }, [viewport, size]);

  // Full viewport repaint — triggered by viewport/size/theme changes.
  const fullRepaintRef = useRef<() => void>(() => {});
  fullRepaintRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const b = visibleWorldBounds();
    paintWorldRect(ctx, b.x0, b.y0, b.x1, b.y1);
    drawHoverOverlay(ctx);
  };

  useEffect(() => {
    fullRepaintRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, size, heatmapMode, width, height, env]);

  // Dirty-chunk incremental repaint — triggered by each simulation step.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dirtyChunks) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const b = visibleWorldBounds();
    const chunksX = Math.ceil(width / CHUNK_SIZE);
    const viewChunkX0 = Math.max(0, Math.floor(b.x0 / CHUNK_SIZE));
    const viewChunkY0 = Math.max(0, Math.floor(b.y0 / CHUNK_SIZE));
    const viewChunkX1 = Math.min(Math.ceil(width / CHUNK_SIZE), Math.ceil(b.x1 / CHUNK_SIZE));
    const viewChunkY1 = Math.min(Math.ceil(height / CHUNK_SIZE), Math.ceil(b.y1 / CHUNK_SIZE));

    for (let cy = viewChunkY0; cy < viewChunkY1; cy++) {
      for (let cx = viewChunkX0; cx < viewChunkX1; cx++) {
        const chunkIndex = cy * chunksX + cx;
        if (!dirtyChunks[chunkIndex]) continue;
        paintWorldRect(ctx, cx * CHUNK_SIZE, cy * CHUNK_SIZE, (cx + 1) * CHUNK_SIZE, (cy + 1) * CHUNK_SIZE);
      }
    }
    drawHoverOverlay(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, dirtyChunks]);

  const updateHover = (newHover: { x: number; y: number } | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const prev = hoverRef.current;
    hoverRef.current = newHover;
    if (!ctx) return;

    // Repaint just the previously-hovered cell(s) to erase the old highlight...
    if (prev) {
      const cellsToClear = pendingPattern ? pendingPattern.cells.map((c: { x: number; y: number }) => ({ x: prev.x + c.x, y: prev.y + c.y })) : [prev];
      cellsToClear.forEach((c: { x: number; y: number }) => paintWorldRect(ctx, c.x, c.y, c.x + 1, c.y + 1));
    }
    // ...then draw the new highlight on top.
    drawHoverOverlay(ctx);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { x, y } = screenToWorldCell(e.clientX - rect.left, e.clientY - rect.top);

    if (pendingPattern) {
      onStampPattern(x, y);
      return;
    }

    const isPan = e.button === 1 || e.shiftKey;
    const isErase = e.button === 2;

    drag.current = {
      mode: isPan ? "pan" : isErase ? "erase" : "paint",
      lastCellX: x,
      lastCellY: y,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (isErase) onPaintCell(x, y, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { x, y } = screenToWorldCell(e.clientX - rect.left, e.clientY - rect.top);
    if (!hoverRef.current || hoverRef.current.x !== x || hoverRef.current.y !== y) {
      updateHover({ x, y });
    }

    const d = drag.current;
    if (!d.mode) return;
    d.moved = true;

    if (d.mode === "pan") {
      const dx = e.clientX - d.lastClientX;
      const dy = e.clientY - d.lastClientY;
      onViewportChange({
        ...viewport,
        offsetX: viewport.offsetX - dx / viewport.cellSize,
        offsetY: viewport.offsetY - dy / viewport.cellSize,
      });
      d.lastClientX = e.clientX;
      d.lastClientY = e.clientY;
      return;
    }

    if (x !== d.lastCellX || y !== d.lastCellY) {
      onPaintCell(x, y, d.mode === "erase");
      d.lastCellX = x;
      d.lastCellY = y;
    }
  };

  const handlePointerUp = () => {
    const d = drag.current;
    if (d.mode === "paint" && !d.moved && d.lastCellX !== null && d.lastCellY !== null) {
      onPaintCell(d.lastCellX, d.lastCellY, false);
    }
    drag.current = { mode: null, lastCellX: null, lastCellY: null, lastClientX: 0, lastClientY: 0, moved: false };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldX = viewport.offsetX + sx / viewport.cellSize;
    const worldY = viewport.offsetY + sy / viewport.cellSize;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newCellSize = Math.min(48, Math.max(2, viewport.cellSize * zoomFactor));
    onViewportChange({
      cellSize: newCellSize,
      offsetX: worldX - sx / newCellSize,
      offsetY: worldY - sy / newCellSize,
    });
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-2xl">
      <canvas
        ref={canvasRef}
        className={pendingPattern ? "cursor-copy" : "cursor-crosshair"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => updateHover(null)}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
      />
    </div>
  );
}

/** Nudge a base hex color's hue by a DNA value and set an explicit lightness. */
function shiftColor(hex: string, dnaShift: number, lightness: number): string {
  const { h, s } = hexToHsl(hex);
  const newHue = (h + (dnaShift - 0.5) * 40 + 360) % 360;
  return `hsl(${newHue.toFixed(0)}, ${s}%, ${lightness}%)`;
}

/** Blue (low) -> teal -> amber -> red (high) heat gradient for overlay modes. */
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const hue = 220 - clamped * 220; // 220 (blue) -> 0 (red)
  return `hsl(${hue.toFixed(0)}, 85%, 55%)`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}
