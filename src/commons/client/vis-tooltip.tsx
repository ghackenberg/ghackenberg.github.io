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
  isPinned?: boolean;
  secondaryHint?: string;
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
  onFocusNodeChange?: (nodeId: string | null, focusNodeIds: Set<string> | null) => void;
  onSecondaryHoverNodeChange?: (nodeId: string | null) => void;
  onNavigate: (node: VisTooltipNodeData) => void;
  onNodePointerDown?: (node: VisTooltipNodeData | null, x: number, y: number) => void;
  onNodeDragStart?: (node: VisTooltipNodeData, x: number, y: number) => void;
  onNodeDragMove?: (node: VisTooltipNodeData, x: number, y: number) => void;
  onNodeDragEnd?: (node: VisTooltipNodeData) => void;
}

export const MOUSE_PROXIMITY_RADIUS = 24;
export const TOUCH_PROXIMITY_RADIUS = 36;
export const DRAG_DEADZONE_PX = 8;

export function VisNetworkTooltip({
  node,
  typeLabel,
  accentColor,
  themeTokens,
  isPinned,
  secondaryHint,
}: VisNetworkTooltipProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '1px',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '250px',
        whiteSpace: 'normal',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
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
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '7px',
                userSelect: 'none',
                pointerEvents: 'none',
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

      {isPinned && (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '5px',
            borderTop: '1px solid rgba(148, 163, 184, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '10px', color: themeTokens.textSubtle, fontWeight: 500 }}>
            Pinned • Click node to walk
          </span>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: accentColor, flexShrink: 0 }}>
            Open ↗
          </span>
        </div>
      )}

      {!isPinned && secondaryHint && (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '5px',
            borderTop: '1px solid rgba(148, 163, 184, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '10px', color: themeTokens.textSubtle, fontWeight: 500 }}>
            {secondaryHint}
          </span>
        </div>
      )}
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
  clearFocus(): void;
  bindProximityInteraction(config: ProximityInteractionConfig): void;
  destroy(): void;
}

export function createGraphTooltipController(container: HTMLElement): GraphTooltipController {
  container.style.userSelect = 'none';
  container.style.setProperty('-webkit-user-select', 'none');

  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'vis-tooltip';
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.userSelect = 'none';
  tooltipEl.style.setProperty('-webkit-user-select', 'none');
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

  const hoverTooltipEl = document.createElement('div');
  hoverTooltipEl.className = 'vis-tooltip vis-tooltip-secondary';
  hoverTooltipEl.style.position = 'absolute';
  hoverTooltipEl.style.pointerEvents = 'none';
  hoverTooltipEl.style.userSelect = 'none';
  hoverTooltipEl.style.setProperty('-webkit-user-select', 'none');
  hoverTooltipEl.style.zIndex = '1001';
  hoverTooltipEl.style.opacity = '0';
  hoverTooltipEl.style.visibility = 'hidden';
  hoverTooltipEl.style.left = '0px';
  hoverTooltipEl.style.top = '0px';

  const hoverCardEl = document.createElement('div');
  hoverCardEl.style.fontFamily = 'Outfit, Inter, sans-serif';
  hoverCardEl.style.width = 'max-content';
  hoverCardEl.style.maxWidth = '250px';
  hoverCardEl.style.boxSizing = 'border-box';
  hoverCardEl.style.whiteSpace = 'normal';
  hoverCardEl.style.overflowWrap = 'break-word';
  hoverCardEl.style.wordBreak = 'break-word';

  hoverTooltipEl.appendChild(hoverCardEl);
  container.appendChild(hoverTooltipEl);

  let lastX = 0;
  let lastY = 0;
  let lastNeighbors: TooltipPoint[] = [];
  let activeNodeId: string | null = null;
  let activeNodeData: VisTooltipNodeData | null = null;
  let pinnedNodeId: string | null = null;
  let pinnedNodeData: VisTooltipNodeData | null = null;
  let lastSectorIndex = -1;
  let currentOpacity = 0;
  let fadeFrameId: number | null = null;

  let secondaryHoveredNodeId: string | null = null;
  let lastHoverX = 0;
  let lastHoverY = 0;
  let lastHoverNeighbors: TooltipPoint[] = [];
  let lastHoverSectorIndex = -1;
  let hoverOpacity = 0;
  let hoverFadeFrameId: number | null = null;

  let cleanupProximityListeners: (() => void) | null = null;
  let activeConfig: ProximityInteractionConfig | null = null;

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

  function animateHoverOpacityTo(targetOpacity: number, startOpacityOverride?: number) {
    if (hoverFadeFrameId !== null) {
      cancelAnimationFrame(hoverFadeFrameId);
      hoverFadeFrameId = null;
    }

    const startOpacity = startOpacityOverride ?? hoverOpacity;
    if (startOpacityOverride !== undefined) {
      hoverOpacity = startOpacity;
      hoverTooltipEl.style.opacity = String(startOpacity);
    }

    if (targetOpacity > 0) {
      hoverTooltipEl.style.visibility = 'visible';
    }

    if (Math.abs(targetOpacity - startOpacity) < 0.001) {
      hoverOpacity = targetOpacity;
      hoverTooltipEl.style.opacity = String(targetOpacity);
      if (targetOpacity <= 0) {
        hoverTooltipEl.style.visibility = 'hidden';
      }
      return;
    }

    const durationMs = 220;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const ease = easeHighlightTransition(progress);
      hoverOpacity = startOpacity + (targetOpacity - startOpacity) * ease;
      hoverTooltipEl.style.opacity = hoverOpacity.toFixed(3);

      if (progress < 1) {
        hoverFadeFrameId = requestAnimationFrame(step);
      } else {
        hoverFadeFrameId = null;
        hoverOpacity = targetOpacity;
        hoverTooltipEl.style.opacity = String(targetOpacity);
        if (targetOpacity <= 0) {
          hoverTooltipEl.style.visibility = 'hidden';
        }
      }
    };

    hoverFadeFrameId = requestAnimationFrame(step);
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

  function computePositionForElement(
    targetEl: HTMLElement,
    x: number,
    y: number,
    neighbors: TooltipPoint[],
    prevSectorIdx: number,
    avoidRect?: { l: number; t: number; r: number; b: number } | null
  ): number {
    const cWidth = container.clientWidth || 800;
    const cHeight = container.clientHeight || 500;
    const tWidth = targetEl.offsetWidth || 236;
    const tHeight = targetEl.offsetHeight || 56;
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
    let bestSectorIndex = 0;
    let minPenalty = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let penalty = c.bias;
      if (i === prevSectorIdx) {
        penalty -= 45;
      }
      const right = c.left + tWidth;
      const bottom = c.top + tHeight;

      // 1. Viewport boundary overflow penalty
      if (c.left < pad) penalty += 2000 + (pad - c.left) * 25;
      if (c.top < pad) penalty += 2000 + (pad - c.top) * 25;
      if (right > cWidth - pad) penalty += 2000 + (right - (cWidth - pad)) * 25;
      if (bottom > cHeight - pad) penalty += 2000 + (bottom - (cHeight - pad)) * 25;

      // 2. Legend, layout selector, and primary pinned tooltip overlap penalty
      if (legendRect && rectsOverlap(c.left, c.top, right, bottom, legendRect.l, legendRect.t, legendRect.r, legendRect.b)) {
        penalty += 1800;
      }
      if (layoutRect && rectsOverlap(c.left, c.top, right, bottom, layoutRect.l, layoutRect.t, layoutRect.r, layoutRect.b)) {
        penalty += 1800;
      }
      if (avoidRect && rectsOverlap(c.left, c.top, right, bottom, avoidRect.l, avoidRect.t, avoidRect.r, avoidRect.b)) {
        penalty += 2600;
      }

      // 3. 1-hop neighbor nodes and connecting edge segments penalty
      const boxCx = c.left + tWidth / 2;
      const boxCy = c.top + tHeight / 2;
      const dirX = boxCx - x;
      const dirY = boxCy - y;
      const dirLen = Math.hypot(dirX, dirY) || 1;

      if (avoidRect) {
        const avoidCx = (avoidRect.l + avoidRect.r) / 2;
        const avoidCy = (avoidRect.t + avoidRect.b) / 2;
        const avoidDist = Math.hypot(boxCx - avoidCx, boxCy - avoidCy);
        if (avoidDist < 180) {
          penalty += (180 - avoidDist) * 2.5;
        }
      }

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
        bestSectorIndex = i;
      }
    }

    const clampedLeft = Math.max(pad, Math.min(bestLeft, Math.max(pad, cWidth - tWidth - pad)));
    const clampedTop = Math.max(pad, Math.min(bestTop, Math.max(pad, cHeight - tHeight - pad)));

    targetEl.style.left = `${Math.round(clampedLeft)}px`;
    targetEl.style.top = `${Math.round(clampedTop)}px`;
    return bestSectorIndex;
  }

  function computeBestPosition(x: number, y: number, neighbors: TooltipPoint[]) {
    lastSectorIndex = computePositionForElement(tooltipEl, x, y, neighbors, lastSectorIndex, null);
  }

  function getPrimaryTooltipRect(): { l: number; t: number; r: number; b: number } | null {
    if (currentOpacity < 0.1 || tooltipEl.style.visibility === 'hidden') return null;
    const left = parseFloat(tooltipEl.style.left) || 0;
    const top = parseFloat(tooltipEl.style.top) || 0;
    const width = tooltipEl.offsetWidth || 236;
    const height = tooltipEl.offsetHeight || 68;
    return {
      l: left - 10,
      t: top - 10,
      r: left + width + 10,
      b: top + height + 10,
    };
  }

  function computeBestHoverPosition(x: number, y: number, neighbors: TooltipPoint[]) {
    lastHoverSectorIndex = computePositionForElement(
      hoverTooltipEl,
      x,
      y,
      neighbors,
      lastHoverSectorIndex,
      getPrimaryTooltipRect()
    );
  }

  function showInternal(
    node: VisTooltipNodeData,
    isLight: boolean,
    x?: number,
    y?: number,
    neighborCoords?: TooltipPoint[],
    isPinnedOverride?: boolean
  ) {
    const isNewNode = activeNodeId !== node.id;
    if (isNewNode) {
      lastSectorIndex = -1;
    }
    activeNodeId = node.id;
    activeNodeData = node;

    const isPinned = isPinnedOverride ?? (pinnedNodeId !== null && pinnedNodeId === node.id);

    const themeTokens = getThemeTokens(isLight);
    const groupColors = GRAPH_COLORS[isLight ? 'light' : 'dark'];
    const typeLabel = node.typeLabel || GRAPH_GROUP_NAMES[node.group] || 'Item';
    const accentColor = groupColors[node.group] || themeTokens.nodeDefault;
    const tagColor = groupColors[0];

    if (pinnedNodeId !== null) {
      tooltipEl.style.pointerEvents = 'auto';
      tooltipEl.style.cursor = 'pointer';
      tooltipEl.style.borderColor = accentColor;
    } else {
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.cursor = 'default';
      tooltipEl.style.borderColor = '';
    }

    render(
      <VisNetworkTooltip
        node={node}
        typeLabel={typeLabel}
        accentColor={accentColor}
        tagColor={tagColor}
        themeTokens={themeTokens}
        isPinned={isPinned}
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

  function showSecondaryHover(
    node: VisTooltipNodeData,
    isLight: boolean,
    x: number,
    y: number,
    neighborCoords: TooltipPoint[],
    isNeighbor: boolean
  ) {
    const isNewHover = secondaryHoveredNodeId !== node.id;
    if (isNewHover) {
      lastHoverSectorIndex = -1;
    }
    secondaryHoveredNodeId = node.id;

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
        isPinned={false}
        secondaryHint={isNeighbor ? 'Click to focus • Neighbor' : 'Click to focus'}
      />,
      hoverCardEl
    );

    lastHoverX = x;
    lastHoverY = y;
    lastHoverNeighbors = neighborCoords;

    computeBestHoverPosition(lastHoverX, lastHoverY, lastHoverNeighbors);
    animateHoverOpacityTo(1, isNewHover ? 0 : undefined);
  }

  function hideSecondaryHover() {
    if (secondaryHoveredNodeId !== null) {
      secondaryHoveredNodeId = null;
      lastHoverSectorIndex = -1;
      activeConfig?.onSecondaryHoverNodeChange?.(null);
      animateHoverOpacityTo(0);
    } else if (hoverOpacity > 0) {
      animateHoverOpacityTo(0);
    }
  }

  function hideInternal() {
    activeNodeId = null;
    activeNodeData = null;
    lastSectorIndex = -1;
    if (pinnedNodeId === null) {
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.cursor = 'default';
      tooltipEl.style.borderColor = '';
    }
    hideSecondaryHover();
    animateOpacityTo(0);
  }

  function clearFocusInternal() {
    const hadPin = pinnedNodeId !== null;
    pinnedNodeId = null;
    pinnedNodeData = null;
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.cursor = 'default';
    tooltipEl.style.borderColor = '';
    hideSecondaryHover();
    if (hadPin || activeNodeId !== null) {
      activeConfig?.onActiveNodeChange(null);
      hideInternal();
    }
  }

  return {
    show: showInternal,

    move(_x: number, _y: number) {
      // Tooltip remains anchored to the hovered node's sector without cursor jitter
    },

    hide: hideInternal,

    clearFocus: clearFocusInternal,

    bindProximityInteraction(config: ProximityInteractionConfig) {
      if (cleanupProximityListeners) {
        cleanupProximityListeners();
        cleanupProximityListeners = null;
      }
      activeConfig = config;

      let lastPointerType = 'mouse';
      let lastTouchTime = 0;
      let pointerDown = false;
      let lastTapHandledAt = 0;
      let downX = 0;
      let downY = 0;
      let dragMoved = false;
      let dragCandidate: VisTooltipNodeData | null = null;
      let customDragActive = false;
      let lastMouseX = -9999;
      let lastMouseY = -9999;
      let isMouseInside = false;
      let postDragWatchUntil = 0;
      let proximityWatchFrameId: number | null = null;
      let lastProximityCheckAt = 0;
      let userSelectLocked = false;

      const setGlobalDragUserSelectLock = (locked: boolean) => {
        if (locked === userSelectLocked) return;
        userSelectLocked = locked;
        if (locked) {
          try {
            window.getSelection?.()?.removeAllRanges?.();
          } catch {
            // Ignore selection clear errors
          }
          document.body.style.userSelect = 'none';
          document.body.style.setProperty('-webkit-user-select', 'none');
          document.documentElement.style.userSelect = 'none';
          document.documentElement.style.setProperty('-webkit-user-select', 'none');
        } else {
          document.body.style.userSelect = '';
          document.body.style.removeProperty('-webkit-user-select');
          document.documentElement.style.userSelect = '';
          document.documentElement.style.removeProperty('-webkit-user-select');
        }
      };

      const onSelectOrDragStart = (e: Event) => {
        if (pointerDown || customDragActive || Boolean(config.isDragging?.())) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };

      const clampDragCoords = (px: number, py: number, rect: DOMRect) => {
        const margin = 80;
        const w = rect.width || container.clientWidth || 800;
        const h = rect.height || container.clientHeight || 500;
        return {
          x: Math.max(-margin, Math.min(w + margin, px)),
          y: Math.max(-margin, Math.min(h + margin, py)),
        };
      };

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

      const isTooltipEventTarget = (target: EventTarget | null, px: number, py: number): boolean => {
        if (currentOpacity < 0.25 || tooltipEl.style.visibility === 'hidden') return false;
        if (target instanceof Node && tooltipEl.contains(target)) return true;
        return isPointInsideTooltip(px, py);
      };

      const buildFocusSet = (centerId: string): Set<string> => {
        const neighbors = config.adjacency.get(centerId);
        return new Set<string>([centerId, ...(neighbors || [])]);
      };

      let cachedScreenNodes: ProximityNodeCandidate[] | null = null;
      let cachedScreenNodesAt = -Infinity;
      const getCachedScreenNodes = (): ProximityNodeCandidate[] => {
        const now = performance.now();
        if (!cachedScreenNodes || now - cachedScreenNodesAt > 8) {
          cachedScreenNodes = config.getScreenNodes();
          cachedScreenNodesAt = now;
        }
        return cachedScreenNodes;
      };

      const getNodeScreenInfo = (
        nodeId: string
      ): { node: VisTooltipNodeData; x: number; y: number; neighborCoords: TooltipPoint[] } | null => {
        const candidates = getCachedScreenNodes();
        let target: ProximityNodeCandidate | null = null;
        for (const c of candidates) {
          if (c.node.id === nodeId && Number.isFinite(c.x) && Number.isFinite(c.y)) {
            target = c;
            break;
          }
        }
        if (!target) return null;

        const neighborSet = config.adjacency.get(target.node.id);
        const neighborCoords: TooltipPoint[] = [];
        if (neighborSet && neighborSet.size > 0) {
          for (const c of candidates) {
            if (neighborSet.has(c.node.id) && Number.isFinite(c.x) && Number.isFinite(c.y)) {
              neighborCoords.push({ x: c.x, y: c.y });
            }
          }
        }

        return {
          node: target.node,
          x: target.x,
          y: target.y,
          neighborCoords,
        };
      };

      const findNearest = (
        px: number,
        py: number,
        maxRadius: number
      ): { node: VisTooltipNodeData; x: number; y: number; neighborCoords: TooltipPoint[] } | null => {
        const candidates = getCachedScreenNodes();
        let best: ProximityNodeCandidate | null = null;
        let minDist = maxRadius;

        if (pinnedNodeId !== null) {
          const focusSet = buildFocusSet(pinnedNodeId);
          for (const c of candidates) {
            if (!focusSet.has(c.node.id)) continue;
            if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
            const d = Math.hypot(px - c.x, py - c.y);
            if (d <= minDist) {
              minDist = d;
              best = c;
            }
          }
        }

        if (!best) {
          minDist = maxRadius;
          for (const c of candidates) {
            if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
            const d = Math.hypot(px - c.x, py - c.y);
            if (d <= minDist) {
              minDist = d;
              best = c;
            }
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

      const ensureProximityWatcher = () => {
        if (proximityWatchFrameId === null) {
          proximityWatchFrameId = requestAnimationFrame(runProximityWatchTick);
        }
      };

      const restorePinnedTooltip = () => {
        if (pinnedNodeId === null || pinnedNodeData === null) return;
        hideSecondaryHover();
        config.onActiveNodeChange(pinnedNodeId);
        const info = getNodeScreenInfo(pinnedNodeId);
        if (info) {
          showInternal(pinnedNodeData, config.isLight(), info.x, info.y, info.neighborCoords, true);
        } else {
          showInternal(pinnedNodeData, config.isLight(), lastX, lastY, lastNeighbors, true);
        }
        ensureProximityWatcher();
      };

      const pinNode = (
        node: VisTooltipNodeData,
        x?: number,
        y?: number,
        neighborCoords?: TooltipPoint[]
      ) => {
        hideSecondaryHover();
        pinnedNodeId = node.id;
        pinnedNodeData = node;
        const focusSet = buildFocusSet(node.id);
        config.onActiveNodeChange(node.id);
        config.onFocusNodeChange?.(node.id, focusSet);
        showInternal(node, config.isLight(), x, y, neighborCoords, true);
        ensureProximityWatcher();
      };

      const unpinNode = (
        keepHoverNode?: {
          node: VisTooltipNodeData;
          x: number;
          y: number;
          neighborCoords: TooltipPoint[];
        } | null
      ) => {
        pinnedNodeId = null;
        pinnedNodeData = null;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.cursor = 'default';
        tooltipEl.style.borderColor = '';
        hideSecondaryHover();
        config.onFocusNodeChange?.(null, null);

        if (keepHoverNode) {
          container.style.cursor = 'pointer';
          config.onActiveNodeChange(keepHoverNode.node.id);
          showInternal(
            keepHoverNode.node,
            config.isLight(),
            keepHoverNode.x,
            keepHoverNode.y,
            keepHoverNode.neighborCoords,
            false
          );
          ensureProximityWatcher();
        } else {
          container.style.cursor = 'default';
          config.onActiveNodeChange(null);
          hideInternal();
        }
      };

      const runProximityWatchTick = (now: number) => {
        proximityWatchFrameId = null;
        const shouldWatch =
          pinnedNodeId !== null ||
          (activeNodeId !== null && lastPointerType === 'mouse') ||
          now < postDragWatchUntil;
        if (!shouldWatch) return;

        const isBusyDragging =
          pointerDown || customDragActive || Boolean(config.isDragging?.());

        if (!isBusyDragging && activeNodeId !== null) {
          const curr = getNodeScreenInfo(activeNodeId);
          if (curr && Math.hypot(curr.x - lastX, curr.y - lastY) > 0.3) {
            lastX = curr.x;
            lastY = curr.y;
            lastNeighbors = curr.neighborCoords;
            computeBestPosition(lastX, lastY, lastNeighbors);
          }
        }

        if (!isBusyDragging && secondaryHoveredNodeId !== null) {
          const currHover = getNodeScreenInfo(secondaryHoveredNodeId);
          if (currHover && Math.hypot(currHover.x - lastHoverX, currHover.y - lastHoverY) > 0.3) {
            lastHoverX = currHover.x;
            lastHoverY = currHover.y;
            lastHoverNeighbors = currHover.neighborCoords;
            computeBestHoverPosition(lastHoverX, lastHoverY, lastHoverNeighbors);
          }
        }

        if (!isBusyDragging && lastPointerType === 'mouse' && now - lastProximityCheckAt >= 50) {
          lastProximityCheckAt = now;
          if (pinnedNodeId !== null) {
            if (!isMouseInside) {
              container.style.cursor = 'default';
              hideSecondaryHover();
            } else if (isPointInsideTooltip(lastMouseX, lastMouseY)) {
              container.style.cursor = 'pointer';
              hideSecondaryHover();
            } else {
              const hit = findNearest(lastMouseX, lastMouseY, MOUSE_PROXIMITY_RADIUS);
              if (hit && hit.node.id !== pinnedNodeId) {
                container.style.cursor = 'pointer';
                if (secondaryHoveredNodeId !== hit.node.id) {
                  config.onSecondaryHoverNodeChange?.(hit.node.id);
                  const isNeighbor = Boolean(config.adjacency.get(pinnedNodeId)?.has(hit.node.id));
                  showSecondaryHover(
                    hit.node,
                    config.isLight(),
                    hit.x,
                    hit.y,
                    hit.neighborCoords,
                    isNeighbor
                  );
                }
              } else {
                container.style.cursor = hit ? 'pointer' : 'default';
                hideSecondaryHover();
              }
            }
          } else {
            if (!isMouseInside) {
              if (activeNodeId !== null) {
                container.style.cursor = 'default';
                config.onActiveNodeChange(null);
                hideInternal();
              }
            } else {
              const hit = findNearest(lastMouseX, lastMouseY, MOUSE_PROXIMITY_RADIUS);
              const nextId = hit ? hit.node.id : null;
              if (nextId !== activeNodeId) {
                container.style.cursor = nextId ? 'pointer' : 'default';
                config.onActiveNodeChange(nextId);
                if (hit) {
                  showInternal(hit.node, config.isLight(), hit.x, hit.y, hit.neighborCoords, false);
                } else {
                  hideInternal();
                }
              }
            }
          }
        }

        if (
          pinnedNodeId !== null ||
          (activeNodeId !== null && lastPointerType === 'mouse') ||
          performance.now() < postDragWatchUntil
        ) {
          proximityWatchFrameId = requestAnimationFrame(runProximityWatchTick);
        }
      };

      const finishCustomDrag = () => {
        if (customDragActive && dragCandidate) {
          cachedScreenNodes = null;
          config.onNodeDragEnd?.(dragCandidate);
          container.style.cursor = 'default';
          if (pinnedNodeId !== null && pinnedNodeData !== null) {
            restorePinnedTooltip();
          } else {
            config.onActiveNodeChange(null);
            hideInternal();
          }
          postDragWatchUntil = performance.now() + 1000;
          ensureProximityWatcher();
        }
        customDragActive = false;
        dragCandidate = null;
      };

      const handleTouchTap = (px: number, py: number, target?: EventTarget | null) => {
        const now = performance.now();
        if (now - lastTapHandledAt < 180) return;
        lastTapHandledAt = now;

        const navTarget = pinnedNodeData || activeNodeData;
        if (navTarget && isTooltipEventTarget(target ?? null, px, py)) {
          config.onNavigate(navTarget);
          return;
        }

        const hit = findNearest(px, py, TOUCH_PROXIMITY_RADIUS);
        if (hit) {
          if (pinnedNodeId === hit.node.id) {
            unpinNode(null);
          } else {
            pinNode(hit.node, hit.x, hit.y, hit.neighborCoords);
          }
        } else if (pinnedNodeId !== null) {
          unpinNode(null);
        } else if (activeNodeId !== null) {
          config.onActiveNodeChange(null);
          hideInternal();
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        if (isControlTarget(e.target)) return;
        const isSyntheticMouseAfterTouch =
          e.pointerType !== 'touch' && performance.now() - lastTouchTime < 1200;
        if (isSyntheticMouseAfterTouch) return;

        lastPointerType = e.pointerType || 'mouse';
        if (lastPointerType === 'touch') {
          lastTouchTime = performance.now();
        }
        const rect = container.getBoundingClientRect();
        downX = e.clientX - rect.left;
        downY = e.clientY - rect.top;
        pointerDown = true;
        dragMoved = false;
        customDragActive = false;
        setGlobalDragUserSelectLock(true);

        if (lastPointerType !== 'touch' && e.button === 0 && e.cancelable) {
          e.preventDefault();
        }

        if (isTooltipEventTarget(e.target, downX, downY) && (pinnedNodeData || activeNodeData)) {
          dragCandidate = null;
        } else if (config.onNodeDragStart && (lastPointerType === 'touch' || e.button === 0)) {
          const radius = lastPointerType === 'touch' ? TOUCH_PROXIMITY_RADIUS : MOUSE_PROXIMITY_RADIUS;
          const hit = findNearest(downX, downY, radius);
          dragCandidate = hit ? hit.node : null;
        } else {
          dragCandidate = null;
        }
        config.onNodePointerDown?.(dragCandidate, downX, downY);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!pointerDown && !customDragActive && isControlTarget(e.target)) return;
        const isSyntheticMouseAfterTouch =
          e.pointerType !== 'touch' && performance.now() - lastTouchTime < 1200;
        if (isSyntheticMouseAfterTouch) return;

        if (e.pointerType) {
          lastPointerType = e.pointerType;
          if (lastPointerType === 'touch') {
            lastTouchTime = performance.now();
          }
        }
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const insideBounds =
          px >= 0 && px <= rect.width && py >= 0 && py <= rect.height && !isControlTarget(e.target);

        if (lastPointerType === 'mouse') {
          lastMouseX = px;
          lastMouseY = py;
          isMouseInside = insideBounds;
        }

        if (pointerDown || customDragActive) {
          if (lastPointerType === 'mouse' && e.buttons === 0) {
            pointerDown = false;
            setGlobalDragUserSelectLock(false);
            if (customDragActive) {
              finishCustomDrag();
            } else {
              dragCandidate = null;
              config.onNodePointerDown?.(null, px, py);
            }
            return;
          }

          const clamped = clampDragCoords(px, py, rect);

          if (Math.hypot(px - downX, py - downY) > DRAG_DEADZONE_PX) {
            dragMoved = true;
            if (dragCandidate && config.onNodeDragStart) {
              if (!customDragActive) {
                customDragActive = true;
                hideSecondaryHover();
                hideInternal();
                container.style.cursor = 'grabbing';
                config.onActiveNodeChange(dragCandidate.id);
                config.onNodeDragStart(dragCandidate, clamped.x, clamped.y);
              }
              config.onNodeDragMove?.(dragCandidate, clamped.x, clamped.y);
              return;
            }
            if (pinnedNodeId === null && activeNodeId !== null && !config.isDragging?.()) {
              container.style.cursor = 'default';
              config.onActiveNodeChange(null);
              hideInternal();
            }
          }
          if (customDragActive && dragCandidate) {
            config.onNodeDragMove?.(dragCandidate, clamped.x, clamped.y);
            return;
          }
        }

        if (lastPointerType === 'touch') return;
        if (pointerDown || e.buttons !== 0 || config.isDragging?.() || customDragActive) return;

        if (!insideBounds) {
          if (pinnedNodeId !== null) {
            container.style.cursor = 'default';
            hideSecondaryHover();
          } else if (activeNodeId !== null) {
            container.style.cursor = 'default';
            config.onActiveNodeChange(null);
            hideInternal();
          }
          return;
        }

        if (pinnedNodeId !== null) {
          if (isTooltipEventTarget(e.target, px, py)) {
            container.style.cursor = 'pointer';
            hideSecondaryHover();
            ensureProximityWatcher();
            return;
          }

          const hit = findNearest(px, py, MOUSE_PROXIMITY_RADIUS);
          if (hit) {
            container.style.cursor = 'pointer';
            if (hit.node.id === pinnedNodeId) {
              hideSecondaryHover();
              ensureProximityWatcher();
            } else {
              if (secondaryHoveredNodeId !== hit.node.id) {
                config.onSecondaryHoverNodeChange?.(hit.node.id);
                const isNeighbor = Boolean(config.adjacency.get(pinnedNodeId)?.has(hit.node.id));
                showSecondaryHover(
                  hit.node,
                  config.isLight(),
                  hit.x,
                  hit.y,
                  hit.neighborCoords,
                  isNeighbor
                );
              }
              ensureProximityWatcher();
            }
          } else {
            container.style.cursor = 'default';
            hideSecondaryHover();
            ensureProximityWatcher();
          }
          return;
        }

        const hit = findNearest(px, py, MOUSE_PROXIMITY_RADIUS);
        const nextId = hit ? hit.node.id : null;
        container.style.cursor = nextId ? 'pointer' : 'default';

        if (nextId !== activeNodeId) {
          config.onActiveNodeChange(nextId);
          if (hit) {
            showInternal(hit.node, config.isLight(), hit.x, hit.y, hit.neighborCoords, false);
            ensureProximityWatcher();
          } else {
            hideInternal();
          }
        } else if (hit && activeNodeId !== null) {
          ensureProximityWatcher();
        }
      };

      const onPointerLeave = (e: PointerEvent) => {
        if (
          e.pointerType === 'touch' ||
          lastPointerType === 'touch' ||
          performance.now() - lastTouchTime < 1200
        ) {
          return;
        }
        isMouseInside = false;
        if (pointerDown || customDragActive || config.isDragging?.()) {
          return;
        }
        if (pinnedNodeId !== null) {
          container.style.cursor = 'default';
          hideSecondaryHover();
          return;
        }
        if (activeNodeId !== null) {
          container.style.cursor = 'default';
          config.onActiveNodeChange(null);
          hideInternal();
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (!pointerDown && !customDragActive) return;
        const isSyntheticMouseAfterTouch =
          e.pointerType !== 'touch' && performance.now() - lastTouchTime < 1200;
        if (isSyntheticMouseAfterTouch) return;

        setGlobalDragUserSelectLock(false);

        if (e.pointerType) {
          lastPointerType = e.pointerType;
        }
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const insideBounds =
          px >= 0 && px <= rect.width && py >= 0 && py <= rect.height && !isControlTarget(e.target);

        if (lastPointerType === 'mouse') {
          lastMouseX = px;
          lastMouseY = py;
          isMouseInside = insideBounds;
        }

        const hadCustomDrag = customDragActive;
        if (customDragActive) {
          finishCustomDrag();
        } else {
          dragCandidate = null;
          config.onNodePointerDown?.(null, px, py);
        }

        const lastDraggedAt = config.getLastDraggedAt?.() || 0;
        const wasDrag =
          hadCustomDrag ||
          dragMoved ||
          Boolean(config.isDragging?.()) ||
          (lastDraggedAt > 0 && performance.now() - lastDraggedAt < 250);
        pointerDown = false;

        if (wasDrag) {
          if (lastPointerType === 'touch') {
            lastTouchTime = performance.now();
          } else if (lastPointerType === 'mouse') {
            postDragWatchUntil = performance.now() + 1000;
            ensureProximityWatcher();
          }
          return;
        }
        if (!insideBounds) return;
        if (lastPointerType !== 'touch' && lastPointerType !== 'pen' && e.button !== 0) return;

        if (lastPointerType === 'touch' || lastPointerType === 'pen') {
          handleTouchTap(px, py, e.target);
          lastTouchTime = performance.now();
          return;
        }

        const navTarget = pinnedNodeData || activeNodeData;
        if (navTarget && isTooltipEventTarget(e.target, px, py)) {
          config.onNavigate(navTarget);
          return;
        }

        const hit = findNearest(px, py, MOUSE_PROXIMITY_RADIUS);
        if (hit) {
          if (pinnedNodeId === hit.node.id) {
            unpinNode(hit);
          } else {
            pinNode(hit.node, hit.x, hit.y, hit.neighborCoords);
          }
        } else if (pinnedNodeId !== null) {
          unpinNode(null);
        }
      };

      const onPointerCancel = () => {
        pointerDown = false;
        setGlobalDragUserSelectLock(false);
        if (customDragActive) {
          finishCustomDrag();
        } else {
          dragCandidate = null;
          config.onNodePointerDown?.(null, 0, 0);
        }
      };

      const onTouchStart = (e: TouchEvent) => {
        if (isControlTarget(e.target) || e.touches.length === 0) return;
        lastTouchTime = performance.now();
        lastPointerType = 'touch';
        if (e.touches.length > 1) {
          dragMoved = true;
          dragCandidate = null;
          config.onNodePointerDown?.(null, 0, 0);
          return;
        }
        if (pointerDown) {
          return;
        }
        const rect = container.getBoundingClientRect();
        downX = e.touches[0].clientX - rect.left;
        downY = e.touches[0].clientY - rect.top;
        pointerDown = true;
        dragMoved = false;
        setGlobalDragUserSelectLock(true);

        if (isTooltipEventTarget(e.target, downX, downY) && (pinnedNodeData || activeNodeData)) {
          dragCandidate = null;
        } else if (config.onNodeDragStart) {
          const hit = findNearest(downX, downY, TOUCH_PROXIMITY_RADIUS);
          dragCandidate = hit ? hit.node : null;
        } else {
          dragCandidate = null;
        }
        config.onNodePointerDown?.(dragCandidate, downX, downY);
      };

      const onTouchMove = (e: TouchEvent) => {
        if ((!pointerDown && !customDragActive) || e.touches.length === 0) return;
        lastTouchTime = performance.now();
        lastPointerType = 'touch';
        const rect = container.getBoundingClientRect();
        const tx = e.touches[0].clientX - rect.left;
        const ty = e.touches[0].clientY - rect.top;

        if (e.touches.length > 1) {
          dragMoved = true;
          if (customDragActive) {
            finishCustomDrag();
          } else {
            dragCandidate = null;
            config.onNodePointerDown?.(null, tx, ty);
          }
          if (pinnedNodeId === null && activeNodeId !== null && !config.isDragging?.()) {
            config.onActiveNodeChange(null);
            hideInternal();
          }
          return;
        }

        const clamped = clampDragCoords(tx, ty, rect);

        if (Math.hypot(tx - downX, ty - downY) > DRAG_DEADZONE_PX) {
          dragMoved = true;
          if (dragCandidate && config.onNodeDragStart) {
            if (e.cancelable) {
              e.preventDefault();
            }
            if (!customDragActive) {
              customDragActive = true;
              hideSecondaryHover();
              hideInternal();
              config.onActiveNodeChange(dragCandidate.id);
              config.onNodeDragStart(dragCandidate, clamped.x, clamped.y);
            }
            config.onNodeDragMove?.(dragCandidate, clamped.x, clamped.y);
            return;
          }
          if (pinnedNodeId === null && activeNodeId !== null && !config.isDragging?.()) {
            config.onActiveNodeChange(null);
            hideInternal();
          }
        } else if (customDragActive && dragCandidate) {
          if (e.cancelable) {
            e.preventDefault();
          }
          config.onNodeDragMove?.(dragCandidate, clamped.x, clamped.y);
        }
      };

      const onTouchEnd = (e: TouchEvent) => {
        if (!pointerDown && !customDragActive) return;
        lastTouchTime = performance.now();
        lastPointerType = 'touch';
        setGlobalDragUserSelectLock(false);

        const hadCustomDrag = customDragActive;
        if (customDragActive) {
          finishCustomDrag();
        } else {
          dragCandidate = null;
          config.onNodePointerDown?.(null, 0, 0);
        }

        const lastDraggedAt = config.getLastDraggedAt?.() || 0;
        const wasDrag =
          hadCustomDrag ||
          dragMoved ||
          Boolean(config.isDragging?.()) ||
          (lastDraggedAt > 0 && performance.now() - lastDraggedAt < 250);
        pointerDown = false;

        if (wasDrag || e.changedTouches.length === 0) {
          lastTouchTime = performance.now();
          return;
        }
        if (isControlTarget(e.target)) return;
        const rect = container.getBoundingClientRect();
        const px = e.changedTouches[0].clientX - rect.left;
        const py = e.changedTouches[0].clientY - rect.top;
        if (px < 0 || px > rect.width || py < 0 || py > rect.height) return;
        handleTouchTap(px, py, e.target);
        lastTouchTime = performance.now();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && pinnedNodeId !== null) {
          unpinNode(null);
        }
      };

      container.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
      window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
      container.addEventListener('pointerleave', onPointerLeave, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
      window.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
      container.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
      window.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
      window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
      window.addEventListener('touchcancel', onPointerCancel, { capture: true, passive: true });
      window.addEventListener('selectstart', onSelectOrDragStart, { capture: true, passive: false });
      window.addEventListener('dragstart', onSelectOrDragStart, { capture: true, passive: false });
      window.addEventListener('blur', onPointerCancel);
      window.addEventListener('keydown', onKeyDown);

      cleanupProximityListeners = () => {
        setGlobalDragUserSelectLock(false);
        if (proximityWatchFrameId !== null) {
          cancelAnimationFrame(proximityWatchFrameId);
          proximityWatchFrameId = null;
        }
        container.removeEventListener('pointerdown', onPointerDown, { capture: true });
        window.removeEventListener('pointermove', onPointerMove, { capture: true });
        container.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('pointerup', onPointerUp, { capture: true });
        window.removeEventListener('pointercancel', onPointerCancel, { capture: true });
        container.removeEventListener('touchstart', onTouchStart, { capture: true });
        window.removeEventListener('touchmove', onTouchMove, { capture: true });
        window.removeEventListener('touchend', onTouchEnd, { capture: true });
        window.removeEventListener('touchcancel', onPointerCancel, { capture: true });
        window.removeEventListener('selectstart', onSelectOrDragStart, { capture: true });
        window.removeEventListener('dragstart', onSelectOrDragStart, { capture: true });
        window.removeEventListener('blur', onPointerCancel);
        window.removeEventListener('keydown', onKeyDown);
      };
    },

    destroy() {
      if (cleanupProximityListeners) {
        cleanupProximityListeners();
        cleanupProximityListeners = null;
      }
      activeConfig = null;
      if (fadeFrameId !== null) {
        cancelAnimationFrame(fadeFrameId);
        fadeFrameId = null;
      }
      if (hoverFadeFrameId !== null) {
        cancelAnimationFrame(hoverFadeFrameId);
        hoverFadeFrameId = null;
      }
      render(null, cardEl);
      render(null, hoverCardEl);
      tooltipEl.remove();
      hoverTooltipEl.remove();
    },
  };
}
