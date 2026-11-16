import {
  createKChangeTransition,
  getKChangeTransitionProgress,
  type GraphKChangeTransition,
  type GraphNodePayload,
  type TransitionPoint,
} from '@commons/shared/graph-payload';

export interface KChangeBeginOptions {
  prevNodes: ReadonlyArray<GraphNodePayload>;
  prevPositions: ReadonlyMap<string, TransitionPoint>;
  nextNodes: ReadonlyArray<GraphNodePayload>;
  nextStartPositions: ReadonlyMap<string, TransitionPoint>;
  mergeTargetByOldClusterId?: Readonly<Record<string, string>>;
}

export interface KChangePlayCallbacks {
  /** Called every frame (and once synchronously at progress 0) with raw linear progress. */
  onFrame: (tr: GraphKChangeTransition, progress: number) => void;
  /** Called once when the transition completes or is finished early. */
  onFinish: (tr: GraphKChangeTransition) => void;
  /** Overrides CLUSTER_TRANSITION_MS (e.g. ~1 ms for prefers-reduced-motion). */
  durationMs?: number;
}

export interface KChangeController {
  /** Registers a pending K change; returns the progress-0 transition (ghosts at rest, splits hidden). */
  begin(opts: KChangeBeginOptions): GraphKChangeTransition;
  hasPending(): boolean;
  /** Positions of the previous node set (warm-start seeds), or null when nothing is pending. */
  getSeedPositions(): ReadonlyMap<string, TransitionPoint> | null;
  /** Currently visible transition state for overlay renderers (progress 0 while pending). */
  getActive(): { tr: GraphKChangeTransition; progress: number } | null;
  play(nextPositions: ReadonlyMap<string, TransitionPoint>, cb: KChangePlayCallbacks): boolean;
  /** Completes a running transition immediately (snaps to final state). */
  finish(): void;
  /** Drops a pending (not yet playing) transition and clears the overlay state. */
  discard(): void;
  destroy(): void;
}

export function createKChangeController(): KChangeController {
  let pending: KChangeBeginOptions | null = null;
  let active: { tr: GraphKChangeTransition; progress: number } | null = null;
  let frameId: number | null = null;
  let finishCb: (() => void) | null = null;

  const controller: KChangeController = {
    begin(opts) {
      controller.finish();
      pending = opts;
      const tr = createKChangeTransition({
        prevNodes: opts.prevNodes,
        prevPositions: opts.prevPositions,
        nextNodes: opts.nextNodes,
        nextPositions: opts.nextStartPositions,
        mergeTargetByOldClusterId: opts.mergeTargetByOldClusterId,
        now: performance.now(),
      });
      active = { tr, progress: 0 };
      return tr;
    },
    hasPending: () => pending !== null,
    getSeedPositions: () => pending?.prevPositions ?? null,
    getActive: () => active,
    play(nextPositions, cb) {
      const pk = pending;
      if (!pk) return false;
      pending = null;
      controller.finish();
      const tr = createKChangeTransition({
        prevNodes: pk.prevNodes,
        prevPositions: pk.prevPositions,
        nextNodes: pk.nextNodes,
        nextPositions,
        mergeTargetByOldClusterId: pk.mergeTargetByOldClusterId,
        now: performance.now(),
        durationMs: cb.durationMs,
      });
      active = { tr, progress: 0 };
      const finish = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        finishCb = null;
        active = null;
        cb.onFinish(tr);
      };
      finishCb = finish;
      const frame = (now: number) => {
        const progress = getKChangeTransitionProgress(tr, now);
        if (active) active.progress = progress;
        cb.onFrame(tr, progress);
        if (progress < 1) {
          frameId = requestAnimationFrame(frame);
        } else {
          finish();
        }
      };
      frame(performance.now());
      return true;
    },
    finish() {
      if (finishCb) finishCb();
    },
    discard() {
      if (!pending) return;
      pending = null;
      active = null;
    },
    destroy() {
      controller.finish();
      pending = null;
      active = null;
    },
  };
  return controller;
}
