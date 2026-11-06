import { render } from 'preact';
import {
  GRAPH_COLORS,
  GRAPH_GROUP_NAMES,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
} from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';

export interface VisTooltipNodeData {
  id: string;
  name: string;
  size: number;
  group: number;
  image?: string;
  tags?: string[];
  date?: string;
  typeLabel?: string;
  description?: string;
}

export type RawGraphNode = VisTooltipNodeData;

export interface VisTooltipThemeTokens {
  textHeading: string;
  textSubtle: string;
  nodeDefault: string;
}

export interface VisNetworkTooltipProps {
  node: VisTooltipNodeData;
  typeLabel: string;
  accentColor: string;
  tagColor: string;
  themeTokens: VisTooltipThemeTokens;
}

export interface TooltipPoint {
  x: number;
  y: number;
}

export interface ProximityNodeCandidate {
  node: VisTooltipNodeData;
  x: number;
  y: number;
}

export interface ProximityInteractionConfig {
  getScreenNodes: () => ProximityNodeCandidate[];
  adjacency: Map<string, Set<string>>;
  isLight: () => boolean;
  isDragging?: () => boolean;
  getLastDraggedAt?: () => number;
  onActiveNodeChange: (nodeId: string | null) => void;
  onNavigate: (node: VisTooltipNodeData) => void;
}

export const MOUSE_PROXIMITY_RADIUS = 24;
export const TOUCH_PROXIMITY_RADIUS = 36;

export function VisNetworkTooltip({
  node,
  typeLabel,
  accentColor,
  themeTokens,
}: VisNetworkTooltipProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '1px',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '250px',
        whiteSpace: 'normal',
      }}
    >
      {node.image && (
        <div
          style={{
            width: '40px',
            height: '40px',
            flexShrink: 0,
            overflow: 'hidden',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={node.image}
            alt={node.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '7px',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '2px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: accentColor,
              flexShrink: 0,
            }}
          >
            {typeLabel}
          </span>
          {node.date && (
            <span
              style={{
                fontSize: '10px',
                color: themeTokens.textSubtle,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {node.date}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            lineHeight: 1.25,
            color: themeTokens.textHeading,
            whiteSpace: 'normal',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {node.name}
        </div>
      </div>
    </div>
  );
}

export function renderVisNetworkTooltip(
  container: HTMLElement,
  props: VisNetworkTooltipProps
): void {
  render(<VisNetworkTooltip {...props} />, container);
}

export interface GraphTooltipController {
  show(
    node: VisTooltipNodeData,
    isLight: boolean,
    x?: number,
    y?: number,
    neighborCoords?: TooltipPoint[]
  ): void;
  move(x: number, y: number): void;
  hide(): void;
  bindProximityInteraction(config: ProximityInteractionConfig): void;
  destroy(): void;
}

export function createGraphTooltipController(container: HTMLElement): GraphTooltipController {
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'vis-tooltip';
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.zIndex = '1000';
  tooltipEl.style.opacity = '0';
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.left = '0px';
  tooltipEl.style.top = '0px';

  const cardEl = document.createElement('div');
  cardEl.style.fontFamily = 'Outfit, Inter, sans-serif';
  cardEl.style.width = 'max-content';
  cardEl.style.maxWidth = '250px';
  cardEl.style.boxSizing = 'border-box';
  cardEl.style.whiteSpace = 'normal';
  cardEl.style.overflowWrap = 'break-word';
  cardEl.style.wordBreak = 'break-word';

  tooltipEl.appendChild(cardEl);
  container.appendChild(tooltipEl);

  let lastX = 0;
  let lastY = 0;
  let lastNeighbors: TooltipPoint[] = [];
  let activeNodeId: string | null = null;
  let activeNodeData: VisTooltipNodeData | null = null;
  let currentOpacity = 0;
  let fadeFrameId: number | null = null;
  let cleanupProximityListeners: (() => void) | null = null;

  function animateOpacityTo(targetOpacity: number, startOpacityOverride?: number) {
    if (fadeFrameId !== null) {
      cancelAnimationFrame(fadeFrameId);
      fadeFrameId = null;
    }

    const startOpacity = startOpacityOverride ?? currentOpacity;
    if (startOpacityOverride !== undefined) {
      currentOpacity = startOpacity;
      tooltipEl.style.opacity = String(startOpacity);
    }

    if (targetOpacity > 0) {
      tooltipEl.style.visibility = 'visible';
    }

    if (Math.abs(targetOpacity - startOpacity) < 0.001) {
      currentOpacity = targetOpacity;
      tooltipEl.style.opacity = String(targetOpacity);
      if (targetOpacity <= 0) {
        tooltipEl.style.visibility = 'hidden';
      }
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / HIGHLIGHT_TRANSITION_MS);
      const ease = easeHighlightTransition(progress);
      currentOpacity = startOpacity + (targetOpacity - startOpacity) * ease;
      tooltipEl.style.opacity = currentOpacity.toFixed(3);

      if (progress < 1) {
        fadeFrameId = requestAnimationFrame(step);
      } else {
        fadeFrameId = null;
        currentOpacity = targetOpacity;
        tooltipEl.style.opacity = String(targetOpacity);
        if (targetOpacity <= 0) {
          tooltipEl.style.visibility = 'hidden';
        }
      }
    };

    fadeFrameId = requestAnimationFrame(step);
  }

  function rectsOverlap(
    l1: number,
    t1: number,
    r1: number,
    b1: number,
    l2: number,
    t2: number,
    r2: number,
    b2: number
  ): boolean {
    return l1 < r2 && r1 > l2 && t1 < b2 && b1 > t2;
  }

  function computeBestPosition(x: number, y: number, neighbors: TooltipPoint[]) {
    const cWidth = container.clientWidth || 800;
    const cHeight = container.clientHeight || 500;
    const tWidth = tooltipEl.offsetWidth || 236;
    const tHeight = tooltipEl.offsetHeight || 56;
    const pad = 12;
    const gap = 22;

    const parent = container.parentElement || container;
    const legendEl = parent.querySelector<HTMLElement>('.z-20:not(#layout-control-container)');
    const layoutEl = parent.querySelector<HTMLElement>('#layout-control-container');

    const legendRect = legendEl
      ? {
          l: legendEl.offsetLeft - 6,
          t: legendEl.offsetTop - 6,
          r: legendEl.offsetLeft + legendEl.offsetWidth + 6,
          b: legendEl.offsetTop + legendEl.offsetHeight + 6,
        }
      : null;

    const layoutRect = layoutEl
      ? {
          l: layoutEl.offsetLeft - 6,
          t: layoutEl.offsetTop - 6,
          r: layoutEl.offsetLeft + layoutEl.offsetWidth + 6,
          b: layoutEl.offsetTop + layoutEl.offsetHeight + 6,
        }
      : null;

    // 8 candidate sectors around the hovered node (N, S, E, W, NE, NW, SE, SW)
    const diag = Math.round(gap * 0.78);
    const candidates = [
      { left: x - tWidth / 2, top: y - gap - tHeight, bias: 0 },       // N
      { left: x + diag, top: y - diag - tHeight, bias: 2 },            // NE
      { left: x - diag - tWidth, top: y - diag - tHeight, bias: 2 },   // NW
      { left: x + gap, top: y - tHeight / 2, bias: 4 },                // E
      { left: x - gap - tWidth, top: y - tHeight / 2, bias: 4 },       // W
      { left: x + diag, top: y + diag, bias: 6 },                      // SE
      { left: x - diag - tWidth, top: y + diag, bias: 6 },             // SW
      { left: x - tWidth / 2, top: y + gap, bias: 8 },                 // S
    ];

    let bestLeft = candidates[0].left;
    let bestTop = candidates[0].top;
    let minPenalty = Infinity;

    for (const c of candidates) {
      let penalty = c.bias;
      const right = c.left + tWidth;
      const bottom = c.top + tHeight;

      // 1. Viewport boundary overflow penalty
      if (c.left < pad) penalty += 2000 + (pad - c.left) * 25;
      if (c.top < pad) penalty += 2000 + (pad - c.top) * 25;
      if (right > cWidth - pad) penalty += 2000 + (right - (cWidth - pad)) * 25;
      if (bottom > cHeight - pad) penalty += 2000 + (bottom - (cHeight - pad)) * 25;

      // 2. Legend and layout selector overlap penalty
      if (legendRect && rectsOverlap(c.left, c.top, right, bottom, legendRect.l, legendRect.t, legendRect.r, legendRect.b)) {
        penalty += 1800;
      }
      if (layoutRect && rectsOverlap(c.left, c.top, right, bottom, layoutRect.l, layoutRect.t, layoutRect.r, layoutRect.b)) {
        penalty += 1800;
      }

      // 3. 1-hop neighbor nodes and connecting edge segments penalty
      const boxCx = c.left + tWidth / 2;
      const boxCy = c.top + tHeight / 2;
      const dirX = boxCx - x;
      const dirY = boxCy - y;
      const dirLen = Math.hypot(dirX, dirY) || 1;

      for (const np of neighbors) {
        const samples = [
          { px: np.x, py: np.y, weight: 420 },
          { px: x + (np.x - x) * 0.35, py: y + (np.y - y) * 0.35, weight: 220 },
          { px: x + (np.x - x) * 0.68, py: y + (np.y - y) * 0.68, weight: 220 },
        ];
        const margin = 14;
        for (const s of samples) {
          if (
            s.px >= c.left - margin &&
            s.px <= right + margin &&
            s.py >= c.top - margin &&
            s.py <= bottom + margin
          ) {
            penalty += s.weight;
          }
          const dist = Math.hypot(boxCx - s.px, boxCy - s.py);
          if (dist < 130) {
            penalty += (130 - dist) * (s.weight === 420 ? 1.4 : 0.5);
          }
        }

        // Angular alignment penalty: penalize sectors that point in the same direction as a 1-hop edge
        const edgeX = np.x - x;
        const edgeY = np.y - y;
        const edgeLen = Math.hypot(edgeX, edgeY);
        if (edgeLen > 2) {
          const cosSim = (dirX * edgeX + dirY * edgeY) / (dirLen * edgeLen);
          if (cosSim > 0.2) {
            penalty += cosSim * 160;
          }
        }
      }

      if (penalty < minPenalty) {
        minPenalty = penalty;
        bestLeft = c.left;
        bestTop = c.top;
      }
    }

    const clampedLeft = Math.max(pad, Math.min(bestLeft, Math.max(pad, cWidth - tWidth - pad)));
    const clampedTop = Math.max(pad, Math.min(bestTop, Math.max(pad, cHeight - tHeight - pad)));

    tooltipEl.style.left = `${Math.round(clampedLeft)}px`;
    tooltipEl.style.top = `${Math.round(clampedTop)}px`;
  }

  function showInternal(
    node: VisTooltipNodeData,
    isLight: boolean,
    x?: number,
    y?: number,
    neighborCoords?: TooltipPoint[]
  ) {
    const isNewNode = activeNodeId !== node.id;
    activeNodeId = node.id;
    activeNodeData = node;

    const themeTokens = getThemeTokens(isLight);
    const groupColors = GRAPH_COLORS[isLight ? 'light' : 'dark'];
    const typeLabel = node.typeLabel || GRAPH_GROUP_NAMES[node.group] || 'Item';
    const accentColor = groupColors[node.group] || themeTokens.nodeDefault;
    const tagColor = groupColors[0];

    render(
      <VisNetworkTooltip
        node={node}
        typeLabel={typeLabel}
        accentColor={accentColor}
        tagColor={tagColor}
        themeTokens={themeTokens}
      />,
      cardEl
    );

    if (typeof x === 'number' && typeof y === 'number') {
      lastX = x;
      lastY = y;
    }
    lastNeighbors = neighborCoords || [];

    computeBestPosition(lastX, lastY, lastNeighbors);
    animateOpacityTo(1, isNewNode ? 0 : undefined);
  }

  function hideInternal() {
    activeNodeId = null;
    activeNodeData = null;
    animateOpacityTo(0);
  }

  return {
    show: showInternal,

    move(_x: number, _y: number) {
      // Tooltip remains anchored to the hovered node's sector without cursor jitter
    },

    hide: hideInternal,

    bindProximityInteraction(config: ProximityInteractionConfig) {
      if (cleanupProximityListeners) {
        cleanupProximityListeners();
        cleanupProximityListeners = null;
      }

      let lastPointerType = 'mouse';
      let pointerDown = false;
      let downX = 0;
      let downY = 0;
      let dragMoved = false;

      const isControlTarget = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null;
        return Boolean(el?.closest?.('#layout-control-container'));
      };

      const isPointInsideTooltip = (px: number, py: number): boolean => {
        if (currentOpacity < 0.25 || tooltipEl.style.visibility === 'hidden') return false;
        const left = parseFloat(tooltipEl.style.left) || 0;
        const top = parseFloat(tooltipEl.style.top) || 0;
        const width = tooltipEl.offsetWidth || 0;
        const height = tooltipEl.offsetHeight || 0;
        return px >= left && px <= left + width && py >= top && py <= top + height;
      };

      const findNearest = (
        px: number,
        py: number,
        maxRadius: number
      ): { node: VisTooltipNodeData; x: number; y: number; neighborCoords: TooltipPoint[] } | null => {
        const candidates = config.getScreenNodes();
        let best: ProximityNodeCandidate | null = null;
        let minDist = maxRadius;

        for (const c of candidates) {
          if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
          const d = Math.hypot(px - c.x, py - c.y);
          if (d <= minDist) {
            minDist = d;
            best = c;
          }
        }

        if (!best) return null;

        const neighborSet = config.adjacency.get(best.node.id);
        const neighborCoords: TooltipPoint[] = [];
        if (neighborSet && neighborSet.size > 0) {
          for (const c of candidates) {
            if (neighborSet.has(c.node.id) && Number.isFinite(c.x) && Number.isFinite(c.y)) {
              neighborCoords.push({ x: c.x, y: c.y });
            }
          }
        }

        return {
          node: best.node,
          x: best.x,
          y: best.y,
          neighborCoords,
        };
      };

      const onPointerDown = (e: PointerEvent) => {
        if (isControlTarget(e.target)) return;
        lastPointerType = e.pointerType || 'mouse';
        const rect = container.getBoundingClientRect();
        downX = e.clientX - rect.left;
        downY = e.clientY - rect.top;
        pointerDown = true;
        dragMoved = false;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (isControlTarget(e.target)) return;
        if (e.pointerType) {
          lastPointerType = e.pointerType;
        }
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        if (pointerDown && Math.hypot(px - downX, py - downY) > 6) {
          dragMoved = true;
        }

        if (lastPointerType === 'touch') return;
        if (pointerDown || e.buttons !== 0 || config.isDragging?.()) return;

        const hit = findNearest(px, py, MOUSE_PROXIMITY_RADIUS);
        const nextId = hit ? hit.node.id : null;
        container.style.cursor = nextId ? 'pointer' : 'default';

        if (nextId !== activeNodeId) {
          config.onActiveNodeChange(nextId);
          if (hit) {
            showInternal(hit.node, config.isLight(), hit.x, hit.y, hit.neighborCoords);
          } else {
            hideInternal();
          }
        }
      };

      const onPointerLeave = (e: PointerEvent) => {
        if (e.pointerType === 'touch' || lastPointerType === 'touch') return;
        if (config.isDragging?.()) return;
        if (activeNodeId !== null) {
          container.style.cursor = 'default';
          config.onActiveNodeChange(null);
          hideInternal();
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (isControlTarget(e.target)) return;
        if (e.pointerType) {
          lastPointerType = e.pointerType;
        }
        const lastDraggedAt = config.getLastDraggedAt?.() || 0;
        const wasDrag =
          dragMoved ||
          Boolean(config.isDragging?.()) ||
          (lastDraggedAt > 0 && performance.now() - lastDraggedAt < 250);
        pointerDown = false;

        if (wasDrag) return;
        if (lastPointerType !== 'touch' && e.button !== 0) return;

        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        if (lastPointerType === 'touch') {
          if (activeNodeData && isPointInsideTooltip(px, py)) {
            config.onNavigate(activeNodeData);
            return;
          }

          const hit = findNearest(px, py, TOUCH_PROXIMITY_RADIUS);
          if (hit) {
            if (activeNodeId === hit.node.id) {
              config.onNavigate(hit.node);
            } else {
              config.onActiveNodeChange(hit.node.id);
              showInternal(hit.node, config.isLight(), hit.x, hit.y, hit.neighborCoords);
            }
          } else if (activeNodeId !== null) {
            config.onActiveNodeChange(null);
            hideInternal();
          }
          return;
        }

        // Mouse / Pen click within proximity radius
        const hit = findNearest(px, py, MOUSE_PROXIMITY_RADIUS);
        if (hit) {
          config.onNavigate(hit.node);
        }
      };

      container.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
      container.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
      container.addEventListener('pointerleave', onPointerLeave, { passive: true });
      container.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });

      cleanupProximityListeners = () => {
        container.removeEventListener('pointerdown', onPointerDown, { capture: true });
        container.removeEventListener('pointermove', onPointerMove, { capture: true });
        container.removeEventListener('pointerleave', onPointerLeave);
        container.removeEventListener('pointerup', onPointerUp, { capture: true });
      };
    },

    destroy() {
      if (cleanupProximityListeners) {
        cleanupProximityListeners();
        cleanupProximityListeners = null;
      }
      if (fadeFrameId !== null) {
        cancelAnimationFrame(fadeFrameId);
        fadeFrameId = null;
      }
      render(null, cardEl);
      tooltipEl.remove();
    },
  };
}
