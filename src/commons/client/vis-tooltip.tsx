import { render } from 'preact';
import { GRAPH_COLORS, GRAPH_GROUP_NAMES } from '@commons/shared/graph-payload';
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

export function VisNetworkTooltip({
  node,
  typeLabel,
  accentColor,
  tagColor,
  themeTokens,
}: VisNetworkTooltipProps) {
  return (
    <div
      style={{
        padding: '2px',
        boxSizing: 'border-box',
        width: '100%',
        whiteSpace: 'normal',
      }}
    >
      {node.image && (
        <div
          style={{
            width: '100%',
            height: '110px',
            overflow: 'hidden',
            borderRadius: '10px',
            marginBottom: '8px',
            background: 'rgba(0,0,0,0.25)',
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
              borderRadius: '10px',
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          marginBottom: '4px',
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
          fontSize: '13px',
          fontWeight: 700,
          lineHeight: 1.35,
          color: themeTokens.textHeading,
          marginBottom: '6px',
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {node.name}
      </div>

      {node.description && (
        <div
          style={{
            fontSize: '11px',
            lineHeight: 1.45,
            color: themeTokens.textSubtle,
            whiteSpace: 'normal',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {node.description}
        </div>
      )}

      {node.tags && node.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginTop: '8px',
          }}
        >
          {node.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '9px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: tagColor,
              }}
            >
              #{tag}
            </span>
          ))}
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
  show(node: VisTooltipNodeData, isLight: boolean, x?: number, y?: number): void;
  move(x: number, y: number): void;
  hide(): void;
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
  cardEl.style.width = '250px';
  cardEl.style.maxWidth = '270px';
  cardEl.style.boxSizing = 'border-box';
  cardEl.style.whiteSpace = 'normal';
  cardEl.style.overflowWrap = 'break-word';
  cardEl.style.wordBreak = 'break-word';

  tooltipEl.appendChild(cardEl);
  container.appendChild(tooltipEl);

  let lastX = 0;
  let lastY = 0;

  function updatePosition(x: number, y: number) {
    lastX = x;
    lastY = y;

    const cWidth = container.clientWidth || 800;
    const cHeight = container.clientHeight || 500;
    const tWidth = tooltipEl.offsetWidth || 278;
    const tHeight = tooltipEl.offsetHeight || 160;
    const offset = 16;
    const pad = 12;

    let left = x + offset;
    if (left + tWidth + pad > cWidth) {
      left = x - tWidth - offset;
    }
    left = Math.max(pad, Math.min(left, Math.max(pad, cWidth - tWidth - pad)));

    let top = y + offset;
    if (top + tHeight + pad > cHeight) {
      top = y - tHeight - offset;
    }
    top = Math.max(pad, Math.min(top, Math.max(pad, cHeight - tHeight - pad)));

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  }

  return {
    show(node: VisTooltipNodeData, isLight: boolean, x?: number, y?: number) {
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

      tooltipEl.style.visibility = 'visible';
      tooltipEl.style.opacity = '1';
      updatePosition(x ?? lastX, y ?? lastY);
    },

    move(x: number, y: number) {
      updatePosition(x, y);
    },

    hide() {
      tooltipEl.style.opacity = '0';
      tooltipEl.style.visibility = 'hidden';
    },

    destroy() {
      render(null, cardEl);
      tooltipEl.remove();
    },
  };
}
