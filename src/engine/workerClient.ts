/**
 * Main-thread wrapper around the simulation Web Worker. Presents a small
 * promise-based API (init/step/setSpecies/setEnvironment/setCells) so the
 * rest of the app never touches postMessage/onmessage directly.
 */
import type { CellBuffers, EnvironmentBuffers, SpeciesConfig, StatsFrame, WorkerRequest, WorkerResponse } from "../types";
import { cellBufferList } from "./buffers";

export interface StepResult {
  cells: CellBuffers;
  stats: StatsFrame;
  dirtyChunks: Uint8Array;
}

export class SimulationWorkerClient {
  private worker: Worker;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private pendingStep: ((result: StepResult) => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.handleMessage(ev.data);
  }

  private handleMessage(msg: WorkerResponse) {
    if (msg.type === "ready") {
      this.resolveReady();
    } else if (msg.type === "stepResult") {
      this.pendingStep?.({ cells: msg.cells, stats: msg.stats, dirtyChunks: msg.dirtyChunks });
      this.pendingStep = null;
    }
  }

  private post(msg: WorkerRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  async init(width: number, height: number, cells: CellBuffers, env: EnvironmentBuffers, species: SpeciesConfig[]) {
    this.post({ type: "init", width, height, cells, env, species }, [...cellBufferList(cells)]);
    await this.readyPromise;
  }

  /** Advance `steps` generations in one batch, resolving with the final state. */
  step(steps: number, weather: number): Promise<StepResult> {
    return new Promise((resolve) => {
      this.pendingStep = resolve;
      this.post({ type: "step", steps, weather });
    });
  }

  setSpecies(species: SpeciesConfig[]) {
    this.post({ type: "setSpecies", species });
  }

  setEnvironment(env: EnvironmentBuffers) {
    this.post({ type: "setEnvironment", env });
  }

  setCells(cells: CellBuffers, generation: number) {
    this.post({ type: "setCells", cells, generation }, [...cellBufferList(cells)]);
  }

  terminate() {
    this.worker.terminate();
  }
}
