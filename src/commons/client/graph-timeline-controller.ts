import {
  CLUSTER_TRANSITION_MS,
  TIMELINE_ANCHOR_ENABLED,
  TIMELINE_BASE_STEPS_PER_SECOND,
  TIMELINE_CLUSTER_ANCHOR_ENABLED,
  TIMELINE_PROCRUSTES_ENABLED,
  alignAndBlendToFinalLayout,
  annotateClusterTransition,
  buildTemporalGraphKeyframes,
  computeTimelineStartPositions,
  formatTimelineDateLabel,
  sampleTimelineNodeFx,
  type CanonicalGraphPayload,
  type GraphConnectionPayload,
  type GraphNodePayload,
  type TemporalGraphKeyframes,
  type TemporalKeyframe,
  type TimelineNodeFx,
} from '@commons/shared/graph-payload';

export interface TimelinePoint {
  x: number;
  y: number;
  z?: number;
}

export interface TimelineSnapshot {
  nodes: GraphNodePayload[];
  connections: GraphConnectionPayload[];
  mergeTargetByOldClusterId?: Record<string, string>;
  clusterCount: number;
}

export interface TimelineGhostNode {
  id: string;
  group: number;
  x: number;
  y: number;
  z?: number;
  colorDark?: string;
  colorLight?: string;
  alpha: number;
  scale: number;
}

/** Small engine-specific adapter; all timeline logic lives in the controller. */
export interface TimelineAdapter {
  isForceLayout(): boolean;
  is3D(): boolean;
  getCanonical(): CanonicalGraphPayload | null;
  /** Current K_target (Tune slider value). */
  getKTarget(): number;
  getPhysicsKey(): string;
  isDefaultTuning(): boolean;
  getCurrentNodes(): GraphNodePayload[];
  getLivePositions(): Map<string, TimelinePoint>;
  /** Static (initial) layout positions, used for the identical end state. */
  getRestPositions(): ReadonlyMap<string, TimelinePoint> | null;
  /** Swaps the topology (nodes placed at `start`); `morph` keeps a K-change transition pending. */
  applySnapshot(snapshot: TimelineSnapshot, start: Map<string, TimelinePoint>, morph: boolean): void;
  /** Headless warm-started solve (never touches the rendered positions). */
  solveWarm(
    snapshot: TimelineSnapshot,
    seeds: ReadonlyMap<string, TimelinePoint>,
    shouldCancel: () => boolean,
    /** Previous settled positions (weak spring targets) or undefined for no anchors. */
    anchors?: ReadonlyMap<string, TimelinePoint>,
    /** Optional per-node anchor weights in [0, 1] (e.g. cluster-only anchors). */
    anchorWeights?: ReadonlyMap<string, number>
  ): Promise<Map<string, TimelinePoint> | null>;
  playMorph(next: Map<string, TimelinePoint>, durationMs?: number): boolean;
  setNodeFx(fx: ReadonlyMap<string, TimelineNodeFx>, ghosts: TimelineGhostNode[]): void;
  /** Directly sets node positions; the final flag commits secondary engine state. */
  setPositions(positions: ReadonlyMap<string, TimelinePoint>, final: boolean): void;
  /** Completes running engine transitions immediately. */
  finishMorph(): void;
}

export interface TimelineState {
  step: number;
  lastStep: number;
  total: number;
  playing: boolean;
  speed: number;
  itemCount: number;
  clusterCount: number;
  dateLabel: string;
  atEnd: boolean;
  /** True while a step is being solved in the background or animated. */
  busy: boolean;
  /** True when no step solve/animation is pending or running. */
  settled: boolean;
}

export interface GraphTimelineController {
  getState(): TimelineState;
  subscribe(listener: (state: TimelineState) => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  stepBy(delta: number): void;
  seek(step: number): void;
  setSpeed(speed: number): void;
  /** True while the graph shows a partial timeline state or playback is running. */
  isActive(): boolean;
  /** Returns to the static end state (identical to the initial graph). */
  resetToEnd(): Promise<void>;
  /** Tuning (K / physics) changed while the timeline is mid-run. */
  onTuningChanged(): void;
  /** Drops cached solves (e.g. after drag-and-drop). */
  invalidate(): void;
  getStats(): TimelineStats;
  destroy(): void;
}

export interface TimelineStepLogEntry {
  step: number;
  startedAt: number;
  /** When the converged targets were ready and the animation started. */
  animStartedAt: number | null;
  /** When the animation completed (step settled). */
  settledAt: number | null;
  viaPlayback: boolean;
}

export interface TimelineStats {
  steps: number;
  solves: number;
  cacheHits: number;
  lastSolveMs: number;
  maxSolveMs: number;
  totalSolveMs: number;
  lastApplyMs: number;
  maxApplyMs: number;
  relaxRounds: number;
  /** Playback-driven steps that started before the previous step settled (must stay 0). */
  playbackViolations: number;
  stepLog: TimelineStepLogEntry[];
  /** Per-step displacement (px) of nodes present before and after a step. */
  displacement: { count: number; mean: number; median: number; p95: number };
  procrustesEnabled: boolean;
  anchorEnabled: boolean;
  lastProcrustes: {
    scale: number;
    rotation: number;
    rmsBefore: number;
    rmsAfter: number;
    commonCount: number;
  } | null;
}

type StatsBase = Omit<
  TimelineStats,
  'displacement' | 'procrustesEnabled' | 'anchorEnabled'
>;

export function createGraphTimelineController(
  adapter: TimelineAdapter,
  options?: { reducedMotion?: boolean }
): GraphTimelineController {
  const reduced =
    options?.reducedMotion ??
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const morphDuration = reduced ? 1 : CLUSTER_TRANSITION_MS;
  const fxDuration = reduced ? 120 : CLUSTER_TRANSITION_MS;

  let keyframes: TemporalGraphKeyframes | null = null;
  let step = -1; // logical (target) step; -1 => end state (resolved lazily)
  let playing = false;
  let speed = 1;
  let busy = false;
  let destroyed = false;
  let generation = 0;
  let rafId: number | null = null;
  let seekRaf: number | null = null;
  let pendingSeek: number | null = null;
  const listeners = new Set<(s: TimelineState) => void>();
  const solveCache = new Map<string, Map<string, TimelinePoint>>();
  /** Converged + aligned targets of finished steps; used for instant response while scrubbing. */
  const settledCache = new Map<string, Map<string, TimelinePoint>>();
  const finalPositionsCache = new Map<string, Map<string, TimelinePoint>>();
  const stats: StatsBase = {
    steps: 0,
    solves: 0,
    cacheHits: 0,
    lastSolveMs: 0,
    maxSolveMs: 0,
    totalSolveMs: 0,
    lastApplyMs: 0,
    maxApplyMs: 0,
    relaxRounds: 0,
    playbackViolations: 0,
    stepLog: [],
    lastProcrustes: null,
  };
  const displacements: number[] = [];
  let stepReference: Map<string, TimelinePoint> | null = null;
  let stepAppliedAt = 0;

  const recordDisplacement = () => {
    if (!stepReference) return;
    const live = adapter.getLivePositions();
    for (const [id, p] of live) {
      const r = stepReference.get(id);
      if (r) displacements.push(Math.hypot(p.x - r.x, p.y - r.y, (p.z ?? 0) - (r.z ?? 0)));
    }
    if (displacements.length > 40000) displacements.splice(0, displacements.length - 40000);
  };

  const getFinalPositions = async (
    kfs: TemporalGraphKeyframes,
    myGen: number
  ): Promise<ReadonlyMap<string, TimelinePoint> | null> => {
    const finalKf = kfs.getKeyframe(kfs.total - 1);
    const rest = adapter.getRestPositions();
    if (adapter.isDefaultTuning() && rest !== null && finalKf.nodes.every((n) => rest.has(n.id))) {
      return rest;
    }
    const fKey = `${kfs.kTarget}|${adapter.getPhysicsKey()}`;
    const cached = finalPositionsCache.get(fKey);
    if (cached) return cached;
    const solved = await adapter.solveWarm(
      {
        nodes: finalKf.nodes,
        connections: finalKf.connections,
        clusterCount: finalKf.clusterCount,
      },
      new Map(),
      () => generation !== myGen || destroyed
    );
    if (!solved || generation !== myGen || destroyed) return null;
    finalPositionsCache.set(fKey, solved);
    return solved;
  };

  const ensure = (): TemporalGraphKeyframes | null => {
    const canonical = adapter.getCanonical();
    if (!canonical) return null;
    const k = Math.max(2, Math.min(18, Math.round(adapter.getKTarget())));
    if (!keyframes || keyframes.kTarget !== k) {
      keyframes = buildTemporalGraphKeyframes(canonical, k);
      solveCache.clear();
      settledCache.clear();
    }
    return keyframes;
  };

  const lastStep = (): number => {
    const kfs = ensure();
    return kfs ? Math.max(0, kfs.total - 1) : 0;
  };

  const currentStep = (): number => (step < 0 ? lastStep() : step);

  const getState = (): TimelineState => {
    const kfs = ensure();
    if (!kfs || kfs.total === 0) {
      return {
        step: 0,
        lastStep: 0,
        total: 0,
        playing: false,
        speed,
        itemCount: 0,
        clusterCount: 0,
        dateLabel: '',
        atEnd: true,
        busy: false,
        settled: true,
      };
    }
    const s = currentStep();
    const kf = kfs.getKeyframe(s);
    return {
      step: s,
      lastStep: kfs.total - 1,
      total: kfs.total,
      playing,
      speed,
      itemCount: kf.itemCount,
      clusterCount: kf.clusterCount,
      dateLabel: formatTimelineDateLabel(kf.timestamp),
      atEnd: s >= kfs.total - 1,
      busy,
      settled: !busy,
    };
  };

  const emit = () => {
    const state = getState();
    for (const l of listeners) l(state);
  };

  // ---------------- per-node fx loop (appear / vanish), driven by the morph start ----------------
  const fxEntries = new Map<string, { t0: number }>();
  const ghostEntries = new Map<string, { node: GraphNodePayload; pos: TimelinePoint; t0: number }>();
  let fxRaf: number | null = null;

  const runFx = (now: number) => {
    fxRaf = null;
    if (destroyed) return;
    const fx = new Map<string, TimelineNodeFx>();
    const ghosts: TimelineGhostNode[] = [];
    for (const [id, e] of fxEntries) {
      const p = Math.min(1, (now - e.t0) / fxDuration);
      fx.set(id, sampleTimelineNodeFx('in', p));
      if (p >= 1) fxEntries.delete(id);
    }
    for (const [id, g] of ghostEntries) {
      const p = Math.min(1, (now - g.t0) / fxDuration);
      const s = sampleTimelineNodeFx('out', p);
      ghosts.push({
        id,
        group: g.node.group,
        x: g.pos.x,
        y: g.pos.y,
        z: g.pos.z,
        colorDark: g.node.colorDark,
        colorLight: g.node.colorLight,
        alpha: s.alpha,
        scale: s.scale,
      });
      if (p >= 1) ghostEntries.delete(id);
    }
    adapter.setNodeFx(fx, ghosts);
    if (fxEntries.size > 0 || ghostEntries.size > 0) {
      fxRaf = requestAnimationFrame(runFx);
    }
  };
  const kickFx = () => {
    if (fxRaf === null) runFx(performance.now());
  };

  const markAnimStarted = () => {
    const last = stats.stepLog[stats.stepLog.length - 1];
    if (last && last.animStartedAt === null) last.animStartedAt = performance.now();
  };
  const markSettled = () => {
    const last = stats.stepLog[stats.stepLog.length - 1];
    if (last && last.settledAt === null) {
      recordDisplacement();
      last.settledAt = performance.now();
    }
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  /**
   * One timeline step: (1) headless warm-started solve (anchor + iterate until converged, nothing rendered),
   * (2) Procrustes alignment, (3) only now swap the topology and animate previous -> converged positions.
   */
  const goTo = async (
    targetIn: number,
    force = false,
    viaPlayback = false,
    viaSeek = false
  ): Promise<void> => {
    const kfs = ensure();
    if (!kfs || kfs.total === 0 || destroyed) return;
    const target = Math.max(0, Math.min(kfs.total - 1, Math.round(targetIn)));
    if (!force && target === currentStep() && step >= 0) return;
    if (viaPlayback && busy) stats.playbackViolations++;
    const myGen = ++generation;
    adapter.finishMorph();
    const tStart = performance.now();
    busy = true;
    step = target;
    stats.stepLog.push({ step: target, startedAt: tStart, animStartedAt: null, settledAt: null, viaPlayback });
    if (stats.stepLog.length > 600) stats.stepLog.shift();
    emit();

    const kf: TemporalKeyframe = kfs.getKeyframe(target);
    const curNodes = adapter.getCurrentNodes();
    const live = adapter.getLivePositions();
    stepReference = new Map(live);
    const annotated = annotateClusterTransition(kf.nodes, curNodes);
    const snapshot: TimelineSnapshot = {
      nodes: annotated.nodes,
      connections: kf.connections,
      mergeTargetByOldClusterId: annotated.mergeTargetByOldClusterId,
      clusterCount: kf.clusterCount,
    };
    const start = computeTimelineStartPositions({
      nextNodes: snapshot.nodes,
      connections: snapshot.connections,
      live,
      is3D: adapter.is3D(),
    });

    // ---- (1) headless solve seeded from filtered final layout (path-independent, anchor-free) ----
    let targets: Map<string, TimelinePoint> | null = null;
    const cacheKey = `${target}|${kfs.kTarget}|${adapter.getPhysicsKey()}`;
    const finalPositions = await getFinalPositions(kfs, myGen);
    if (!finalPositions || generation !== myGen || destroyed) {
      if (generation === myGen) {
        busy = false;
        emit();
      }
      return;
    }
    const restApplies = target === kfs.total - 1 && finalPositions.size >= snapshot.nodes.length;
    if (target === kfs.total - 1) {
      targets = new Map(finalPositions);
    } else if (viaSeek && settledCache.has(cacheKey)) {
      stats.cacheHits++;
      targets = new Map(settledCache.get(cacheKey)!);
    } else {
      const seedForStep = new Map<string, TimelinePoint>();
      for (const n of snapshot.nodes) {
        const pt = finalPositions.get(n.id);
        if (pt) seedForStep.set(n.id, { x: pt.x, y: pt.y, z: pt.z });
      }
      let solved: Map<string, TimelinePoint> | null = solveCache.get(cacheKey) ?? null;
      if (solved) {
        stats.cacheHits++;
      } else {
        const s0 = performance.now();
        const maxRounds = playing ? 2 : 3;
        let seeds: ReadonlyMap<string, TimelinePoint> = seedForStep;
        for (let round = 0; round < maxRounds && performance.now() - s0 < 5000; round++) {
          const res = await adapter.solveWarm(
            snapshot,
            seeds,
            () => generation !== myGen || destroyed
          );
          if (!res || generation !== myGen || destroyed) {
            solved = null;
            break;
          }
          stats.relaxRounds++;
          let maxD = 0;
          for (const [id, t] of res) {
            const s = seeds.get(id);
            if (s) maxD = Math.max(maxD, Math.hypot(t.x - s.x, t.y - s.y, (t.z ?? 0) - (s.z ?? 0)));
          }
          solved = res;
          seeds = res;
          if (maxD < (playing ? 4 : 1)) break;
        }
        if (!solved || generation !== myGen || destroyed) {
          if (generation === myGen) {
            busy = false;
            emit();
          }
          return;
        }
        const dt = performance.now() - s0;
        stats.solves++;
        stats.lastSolveMs = dt;
        stats.maxSolveMs = Math.max(stats.maxSolveMs, dt);
        stats.totalSolveMs += dt;
        solveCache.set(cacheKey, solved);
      }
      if (TIMELINE_PROCRUSTES_ENABLED) {
        const { blended, procrustes } = alignAndBlendToFinalLayout(
          solved,
          finalPositions,
          snapshot.nodes,
          target,
          kfs.total,
          adapter.is3D()
        );
        stats.lastProcrustes = {
          scale: procrustes.scale,
          rotation: procrustes.rotation,
          rmsBefore: procrustes.rmsBefore,
          rmsAfter: procrustes.rmsAfter,
          commonCount: procrustes.commonCount,
        };
        targets = blended;
      } else {
        targets = new Map(solved);
      }
    }
    if (!targets || generation !== myGen || destroyed) {
      if (generation === myGen) {
        busy = false;
        emit();
      }
      return;
    }

    // ---- (3) targets are ready: swap topology and animate everything together ----
    const now = performance.now();
    const curContent = new Map(curNodes.filter((n) => n.group !== 0).map((n) => [n.id, n]));
    const nextContentIds = new Set(snapshot.nodes.filter((n) => n.group !== 0).map((n) => n.id));
    for (const n of snapshot.nodes) {
      if (n.group === 0) continue;
      if (!curContent.has(n.id)) {
        fxEntries.set(n.id, { t0: now });
        ghostEntries.delete(n.id);
      } else {
        fxEntries.delete(n.id);
      }
    }
    for (const [id, node] of curContent) {
      if (nextContentIds.has(id)) continue;
      const pos = live.get(id);
      if (pos) ghostEntries.set(id, { node, pos: { ...pos }, t0: now });
      fxEntries.delete(id);
    }
    for (const id of Array.from(ghostEntries.keys())) {
      if (nextContentIds.has(id)) ghostEntries.delete(id);
    }
    const tApply = performance.now();
    adapter.applySnapshot(snapshot, start, true);
    stats.steps++;
    stats.lastApplyMs = performance.now() - tApply;
    stats.maxApplyMs = Math.max(stats.maxApplyMs, stats.lastApplyMs);
    stepAppliedAt = performance.now();
    markAnimStarted();
    kickFx();
    adapter.playMorph(targets, morphDuration);
    await sleep(morphDuration + 30);
    if (generation !== myGen || destroyed) return;
    if (!restApplies && !viaPlayback) settledCache.set(cacheKey, new Map(targets));
    busy = false;
    markSettled();
    if (playing && target >= kfs.total - 1) {
      playing = false;
      stopLoop();
    }
    emit();
  };

    // End of step apply

  // ---------------- scrubbing (latest wins, one apply per frame) ----------------
  const scheduleSeek = (target: number) => {
    pendingSeek = target;
    if (seekRaf !== null) return;
    seekRaf = requestAnimationFrame(() => {
      seekRaf = null;
      const t = pendingSeek;
      pendingSeek = null;
      if (t !== null && !destroyed) void goTo(t, false, false, true);
    });
  };

  // ---------------- playback ----------------
  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const loop = (now: number) => {
    rafId = null;
    if (!playing || destroyed) return;
    // Playback is gated by convergence: the next step starts only after the previous step was solved,
    // animated and settled AND the minimum dwell time (speed setting) elapsed.
    const dwell = 1000 / (TIMELINE_BASE_STEPS_PER_SECOND * speed);
    if (!busy && pendingSeek === null && seekRaf === null && now - stepAppliedAt >= dwell) {
      const next = currentStep() + 1;
      if (next > lastStep()) {
        playing = false;
        stopLoop();
        emit();
        return;
      }
      void goTo(next, false, true);
    }
    rafId = requestAnimationFrame(loop);
  };

  const controller: GraphTimelineController = {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      if (!ensure() || getState().total === 0) return;
      if (!adapter.isForceLayout()) return;
      if (currentStep() >= lastStep()) {
        void goTo(0);
      }
      playing = true;
      emit();
      if (rafId === null) rafId = requestAnimationFrame(loop);
    },
    pause() {
      playing = false;
      stopLoop();
      emit();
    },
    toggle() {
      if (playing) controller.pause();
      else controller.play();
    },
    stepBy(delta) {
      if (!adapter.isForceLayout()) return;
      scheduleSeek(currentStep() + delta);
    },
    seek(target) {
      if (!adapter.isForceLayout()) return;
      scheduleSeek(target);
    },
    setSpeed(next) {
      speed = next > 0 ? next : 1;
      emit();
    },
    isActive() {
      return playing || (step >= 0 && step < lastStep());
    },
    async resetToEnd() {
      controller.pause();
      if (seekRaf !== null) cancelAnimationFrame(seekRaf);
      seekRaf = null;
      pendingSeek = null;
      if (step >= 0 && step < lastStep()) {
        await goTo(lastStep(), true);
      } else {
        generation++;
        adapter.finishMorph();
        busy = false;
      }
      step = -1;
      fxEntries.clear();
      ghostEntries.clear();
      adapter.setNodeFx(new Map(), []);
      emit();
    },
    onTuningChanged() {
      solveCache.clear();
      settledCache.clear();
      const wasStep = currentStep();
      keyframes = null;
      const kfs = ensure();
      if (!kfs) return;
      void goTo(Math.min(wasStep, kfs.total - 1), true);
    },
    invalidate() {
      solveCache.clear();
      settledCache.clear();
      finalPositionsCache.clear();
    },
    getStats: () => {
      const sorted = [...displacements].sort((a, b) => a - b);
      const n = sorted.length;
      const mean = n > 0 ? sorted.reduce((a, b) => a + b, 0) / n : 0;
      return {
        ...stats,
        stepLog: [...stats.stepLog],
        displacement: {
          count: n,
          mean,
          median: n > 0 ? sorted[Math.floor(n / 2)] : 0,
          p95: n > 0 ? sorted[Math.min(n - 1, Math.floor(n * 0.95))] : 0,
        },
        procrustesEnabled: TIMELINE_PROCRUSTES_ENABLED,
        anchorEnabled: TIMELINE_ANCHOR_ENABLED || TIMELINE_CLUSTER_ANCHOR_ENABLED,
      };
    },
    destroy() {
      destroyed = true;
      generation++;
      stopLoop();
      if (seekRaf !== null) cancelAnimationFrame(seekRaf);
      if (fxRaf !== null) cancelAnimationFrame(fxRaf);
      seekRaf = null;
      fxRaf = null;
      listeners.clear();
      solveCache.clear();
      settledCache.clear();
      fxEntries.clear();
      ghostEntries.clear();
    },
  };
  return controller;
}
