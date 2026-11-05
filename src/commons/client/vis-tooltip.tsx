import { render } from 'preact';

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
