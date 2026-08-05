import type { Viewport } from "../types";

/**
 * Compute a viewport that fits the entire gridW x gridH world inside a
 * containerW x containerH viewing area, centered. This is what makes the
 * simulation visible in full the moment it loads, rather than opening at
 * some arbitrary fixed zoom level that only shows a corner of a 200+-cell
 * grid.
 */
export function fitViewport(gridW: number, gridH: number, containerW: number, containerH: number): Viewport {
  if (containerW <= 0 || containerH <= 0 || gridW <= 0 || gridH <= 0) {
    return { offsetX: 0, offsetY: 0, cellSize: 6 };
  }
  const cellSize = Math.max(2, Math.min(28, Math.floor(Math.min(containerW / gridW, containerH / gridH))));
  const totalW = gridW * cellSize;
  const totalH = gridH * cellSize;
  const offsetX = -((containerW - totalW) / 2) / cellSize;
  const offsetY = -((containerH - totalH) / 2) / cellSize;
  return { offsetX, offsetY, cellSize };
}
