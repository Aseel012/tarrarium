/**
 * Time-travel support: periodically stores full deep-clone snapshots of the
 * cell buffers so the user can scrub backward through the simulation's
 * history. Storing every single generation for a 100k+-cell grid would be
 * far too much memory (each snapshot is several MB), so snapshots are taken
 * every SNAPSHOT_INTERVAL generations and the oldest are evicted once
 * MAX_SNAPSHOTS is reached — a bounded ring buffer, not infinite history.
 */
import type { CellBuffers, StatsFrame } from "../types";
import { cloneCellBuffers } from "./buffers";

export const SNAPSHOT_INTERVAL = 10;
export const MAX_SNAPSHOTS = 120; // ~1200 generations of scrubbable history

export interface Snapshot {
  generation: number;
  cells: CellBuffers;
  stats: StatsFrame;
}

export class HistoryManager {
  private snapshots: Snapshot[] = [];

  maybeCapture(generation: number, cells: CellBuffers, stats: StatsFrame) {
    if (generation % SNAPSHOT_INTERVAL !== 0) return;
    if (this.snapshots.length > 0 && this.snapshots[this.snapshots.length - 1].generation === generation) return;

    this.snapshots.push({ generation, cells: cloneCellBuffers(cells), stats });
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }
  clear() {
    this.snapshots = [];
  }

  list(): { generation: number; stats: StatsFrame }[] {
    return this.snapshots.map((s) => ({ generation: s.generation, stats: s.stats }));
  }

  getClosest(generation: number): Snapshot | null {
    if (this.snapshots.length === 0) return null;
    let best = this.snapshots[0];
    for (const snap of this.snapshots) {
      if (Math.abs(snap.generation - generation) < Math.abs(best.generation - generation)) {
        best = snap;
      }
    }
    return best;
  }

  get count() {
    return this.snapshots.length;
  }

  get oldestGeneration() {
    return this.snapshots[0]?.generation ?? 0;
  }

  get newestGeneration() {
    return this.snapshots[this.snapshots.length - 1]?.generation ?? 0;
  }
}
