import { Network, type Options, type Node as VisNode, type Edge as VisEdge } from 'vis-network';
import { DataSet } from 'vis-data';

export interface VisPayloadNode {
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

export interface VisPayloadConnection {
  sourceId: string;
  targetId: string;
}

export interface VisNetworkPayload {
  'vis-network': {
    nodes: VisPayloadNode[];
    connections: VisPayloadConnection[];
  };
}

export interface VisCustomNode extends VisNode {
  rawGroup?: number;
}

export interface VisNetworkExtraOptions extends Options {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface VisNetworkEngine {
  layouts: { id: string; label: string }[];
  nodes?: VisPayloadNode[];
  connections?: VisPayloadConnection[];
  visNodes?: DataSet<VisCustomNode> | null;
  visEdges?: DataSet<VisEdge> | null;
  options?: Options;
  network?: Network | null;
  isDragging?: boolean;
  dragStabilizeTimeout?: ReturnType<typeof setTimeout> | null;
  currentLayout?: string;
  isLight?: boolean;
  resizeObserver?: ResizeObserver | null;
  intersectionObserver?: IntersectionObserver | null;
  animationFrameId?: number | null;
  init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions?: VisNetworkExtraOptions): Promise<VisNetworkEngine>;
  updateLayout(layout: string, isLight: boolean): void;
  pause(): void;
  resume(): void;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number): void;
  destroy(): void;
}

const engine: VisNetworkEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions: VisNetworkExtraOptions = {}) {
    this.nodes = payload['vis-network'].nodes;
    this.connections = payload['vis-network'].connections;

    const colors = [
      { // 0: Tag (Sky)
        background: isLight ? '#0284c7' : '#0ea5e9', 
        border: isLight ? '#0369a1' : '#38bdf8', 
        highlight: { background: isLight ? '#075985' : '#0284c7', border: isLight ? '#0284c7' : '#7dd3fc' },
        hover: { background: isLight ? '#075985' : '#0284c7', border: isLight ? '#0284c7' : '#7dd3fc' }
      },
      { // 1: Post (Blue)
        background: isLight ? '#2563eb' : '#3b82f6', 
        border: isLight ? '#1d4ed8' : '#60a5fa', 
        highlight: { background: isLight ? '#1e40af' : '#1d4ed8', border: isLight ? '#2563eb' : '#93c5fd' },
        hover: { background: isLight ? '#1e40af' : '#1d4ed8', border: isLight ? '#2563eb' : '#93c5fd' }
      },
      { // 2: Publication (Indigo)
        background: isLight ? '#4f46e5' : '#6366f1', 
        border: isLight ? '#4338ca' : '#818cf8', 
        highlight: { background: isLight ? '#3730a3' : '#4f46e5', border: isLight ? '#4f46e5' : '#c7d2fe' },
        hover: { background: isLight ? '#3730a3' : '#4f46e5', border: isLight ? '#4f46e5' : '#c7d2fe' }
      },
      { // 3: Presentation (Cyan)
        background: isLight ? '#0891b2' : '#06b6d4', 
        border: isLight ? '#0e7490' : '#22d3ee', 
        highlight: { background: isLight ? '#155e75' : '#0891b2', border: isLight ? '#0891b2' : '#67e8f9' },
        hover: { background: isLight ? '#155e75' : '#0891b2', border: isLight ? '#0891b2' : '#67e8f9' }
      },
      { // 4: Course (Yellow)
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' },
        hover: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' }
      },
      { // 5: Project (Green)
        background: isLight ? '#059669' : '#10b981', 
        border: isLight ? '#047857' : '#34d399', 
        highlight: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' },
        hover: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' }
      },
      { // 6: Service (Purple)
        background: isLight ? '#9333ea' : '#a855f7', 
        border: isLight ? '#7e22ce' : '#c084fc', 
        highlight: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' },
        hover: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' }
      },
      { // 7: Interest (Rose)
        background: isLight ? '#e11d48' : '#f43f5e', 
        border: isLight ? '#be123c' : '#fb7185', 
        highlight: { background: isLight ? '#9f1239' : '#e11d48', border: isLight ? '#e11d48' : '#fda4af' },
        hover: { background: isLight ? '#9f1239' : '#e11d48', border: isLight ? '#e11d48' : '#fda4af' }
      }
    ];

    const groupNames = ['Tag', 'Post', 'Publication', 'Presentation', 'Course', 'Project', 'Service', 'Interest'];
    const groupColors = [
      isLight ? '#0284c7' : '#38bdf8', // 0: Tag (sky)
      isLight ? '#2563eb' : '#60a5fa', // 1: Post (blue)
      isLight ? '#4f46e5' : '#818cf8', // 2: Publication (indigo)
      isLight ? '#0891b2' : '#22d3ee', // 3: Presentation (cyan)
      isLight ? '#b45309' : '#fbbf24', // 4: Course (yellow)
      isLight ? '#059669' : '#34d399', // 5: Project (green)
      isLight ? '#7e22ce' : '#c084fc', // 6: Service (purple)
      isLight ? '#be123c' : '#fb7185'  // 7: Interest (rose)
    ];

    // Initialize with randomized coordinates. Avoid Vis.js native group styling issues by omitting group
    // property and explicitly defining color object on each node.
    this.visNodes = new DataSet<VisCustomNode>((this.nodes || []).map((n) => {
      const card = document.createElement('div');
      card.style.fontFamily = 'Outfit, Inter, sans-serif';
      card.style.width = '250px';
      card.style.maxWidth = '270px';
      card.style.boxSizing = 'border-box';
      card.style.whiteSpace = 'normal';
      card.style.overflowWrap = 'break-word';
      card.style.wordBreak = 'break-word';
      
      let imageHtml = '';
      if (n.image) {
        imageHtml = `
          <div style="width: 100%; height: 110px; overflow: hidden; border-radius: 10px; margin-bottom: 8px; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;">
            <img src="${n.image}" alt="${n.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" />
          </div>
        `;
      }

      let tagsHtml = '';
      if (n.tags && n.tags.length > 0) {
        tagsHtml = `
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
            ${n.tags.map((t: string) => `<span style="font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: ${groupColors[0]};">#${t}</span>`).join('')}
          </div>
        `;
      }

      let dateHtml = '';
      if (n.date) {
        dateHtml = `<span style="font-size: 10px; color: ${isLight ? '#64748b' : '#94a3b8'}; font-weight: 500; shrink: 0;">${n.date}</span>`;
      }

      card.innerHTML = `
        <div style="padding: 2px; box-sizing: border-box; width: 100%; white-space: normal;">
          ${imageHtml}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${groupColors[n.group] || '#3b82f6'}; flex-shrink: 0;">
              ${n.typeLabel || groupNames[n.group] || 'Item'}
            </span>
            ${dateHtml}
          </div>
          <div style="font-size: 13px; font-weight: 700; line-height: 1.35; color: ${isLight ? '#0f172a' : '#f8fafc'}; margin-bottom: 6px; white-space: normal; overflow-wrap: break-word; word-break: break-word;">
            ${n.name}
          </div>
          ${n.description ? `<div style="font-size: 11px; line-height: 1.45; color: ${isLight ? '#475569' : '#cbd5e1'}; white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; overflow-wrap: break-word; word-break: break-word;">${n.description}</div>` : ''}
          ${tagsHtml}
        </div>
      `;

      const isTagNode = n.group === 0;
      const nodeValue = isTagNode ? (Math.pow(n.size, 2) * 16 + 10) : (n.size * 3 + 2);
      return {
        id: n.id,
        label: isTagNode ? n.name : '',
        title: card,
        shape: 'dot',
        value: nodeValue,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
        rawGroup: n.group,
        color: colors[n.group],
        chosen: {
          node: (values: { color?: string; borderColor?: string; hoverBackground?: string; hoverBorder?: string }, _id: string | number, selected: boolean, hovering: boolean) => {
            if (hovering || selected) {
              if (values.hoverBackground) values.color = values.hoverBackground;
              if (values.hoverBorder) values.borderColor = values.hoverBorder;
            }
          },
          label: false
        },
        font: {
          color: isLight ? '#0f172a' : '#f8fafc',
          size: isTagNode ? Math.min(19 + Math.round(n.size * 3.6), 32) : 15,
          face: 'Outfit, Inter, sans-serif',
          align: 'center',
          vadjust: isTagNode ? -Math.round(nodeValue * 0.35) : 0,
          strokeWidth: isLight ? 2.5 : 3,
          strokeColor: isLight ? '#ffffff' : '#0f172a'
        }
      };
    }));

    this.visEdges = new DataSet<VisEdge>((this.connections || []).map((c, idx) => ({
      id: `${c.sourceId}-${c.targetId}-${idx}`,
      from: c.sourceId,
      to: c.targetId,
      color: {
        color: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255,255,255,0.15)',
        highlight: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255,255,255,0.35)'
      }
    })));

    const data = {
      nodes: this.visNodes || undefined,
      edges: this.visEdges || undefined
    };

    const extraInteraction = extraOptions.interaction || {};
    const interactionOptions = Object.assign({
      hover: true,
      hoverConnectedEdges: false,
      tooltipDelay: 100,
      zoomView: false,
      dragView: true,
      dragNodes: true
    }, extraInteraction);

    const utmSource = String(extraOptions.utmSource || 'vis_network');
    const utmMedium = String(extraOptions.utmMedium || 'interactive_graph');
    const utmCampaign = String(extraOptions.utmCampaign || 'knowledge_network');

    this.options = {
      nodes: {
        shape: 'dot',
        chosen: {
          node: (values: { color?: string; borderColor?: string; hoverBackground?: string; hoverBorder?: string }, _id: string | number, selected: boolean, hovering: boolean) => {
            if (hovering || selected) {
              if (values.hoverBackground) values.color = values.hoverBackground;
              if (values.hoverBorder) values.borderColor = values.hoverBorder;
            }
          },
          label: false
        },
        scaling: {
          min: 10,
          max: 84,
          label: {
            enabled: true,
            min: 18,
            max: 53,
            drawThreshold: 1
          }
        },
        borderWidth: 1.5,
        borderWidthSelected: 3
      },
      edges: {
        width: 1,
        smooth: {
          enabled: true,
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        }
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 80,
          springConstant: 0.08,
          damping: 0.4
        },
        stabilization: {
          iterations: 100,
          updateInterval: 25
        }
      },
      interaction: interactionOptions
    };

    this.network = new Network(container, data, this.options);

    if (interactionOptions.dragView === false) {
      container.style.touchAction = 'pan-y';
      const canvasEl = container.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'pan-y';
      }
      const visWrapper = container.querySelector('.vis-network') as HTMLElement | null;
      if (visWrapper) {
        visWrapper.style.touchAction = 'pan-y';
      }
    }

    await new Promise<void>((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          if (this.network) {
            this.network.setOptions({ physics: { enabled: false } });
            this.network.stopSimulation();
          }
          resolve();
        }
      };
      if (this.network) {
        this.network.once("stabilizationIterationsDone", finish);
        this.network.once("stabilized", finish);
      }
      setTimeout(finish, 1500);
    });

    if (interactionOptions.dragNodes) {
      this.isDragging = false;
      this.dragStabilizeTimeout = null;

      this.network.on("dragStart", () => {
        this.isDragging = true;
        if (this.dragStabilizeTimeout) {
          clearTimeout(this.dragStabilizeTimeout);
          this.dragStabilizeTimeout = null;
        }
        this.network?.setOptions({ physics: { enabled: true } });
      });

      this.network.on("dragEnd", () => {
        this.isDragging = false;

        const stopAfterDrag = () => {
          if (this.network && !this.isDragging) {
            this.network.setOptions({ physics: { enabled: false } });
            this.network.stopSimulation();
          }
          if (this.dragStabilizeTimeout) {
            clearTimeout(this.dragStabilizeTimeout);
            this.dragStabilizeTimeout = null;
          }
        };

        this.network?.once("stabilized", stopAfterDrag);

        if (this.dragStabilizeTimeout) {
          clearTimeout(this.dragStabilizeTimeout);
        }
        // Graceful fallback timeout: if complex graphs oscillate indefinitely, stabilize after 5 seconds
        this.dragStabilizeTimeout = setTimeout(stopAfterDrag, 5000);
      });
    }

    this.network.on("click", (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        const targetPath = params.nodes[0];
        if (
          targetPath.startsWith('/posts') ||
          targetPath.startsWith('/publications') ||
          targetPath.startsWith('/projects') ||
          targetPath.startsWith('/courses') ||
          targetPath.startsWith('/services') ||
          targetPath.startsWith('/interests') ||
          targetPath.startsWith('/tags')
        ) {
          const targetUrl = new URL(targetPath, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      }
    });

    this.network.on("hoverNode", () => {
      container.style.cursor = "pointer";
    });

    this.network.on("blurNode", () => {
      container.style.cursor = "default";
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    if (layout !== 'force') {
      this.updateLayout(layout, isLight);
    }

    // Bind ResizeObserver to handle network container changes dynamically with dimension threshold
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2) {
          lastWidth = width;
          lastHeight = height;
          if (this.network) {
            this.network.redraw();
            this.network.fit();
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    // Automatically pause physics/animation when container is scrolled out of view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }, { rootMargin: '100px 0px' });
    this.intersectionObserver.observe(container);

    return this;
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.network || !this.visNodes || !this.visEdges) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to node labels and edges based on theme
    const colors = [
      { // 0: Tag (Sky)
        background: isLight ? '#0284c7' : '#0ea5e9', 
        border: isLight ? '#0369a1' : '#38bdf8', 
        highlight: { background: isLight ? '#075985' : '#0284c7', border: isLight ? '#0284c7' : '#7dd3fc' } 
      },
      { // 1: Post (Blue)
        background: isLight ? '#2563eb' : '#3b82f6', 
        border: isLight ? '#1d4ed8' : '#60a5fa', 
        highlight: { background: isLight ? '#1e40af' : '#1d4ed8', border: isLight ? '#2563eb' : '#93c5fd' } 
      },
      { // 2: Publication (Indigo)
        background: isLight ? '#4f46e5' : '#6366f1', 
        border: isLight ? '#4338ca' : '#818cf8', 
        highlight: { background: isLight ? '#3730a3' : '#4f46e5', border: isLight ? '#4f46e5' : '#c7d2fe' } 
      },
      { // 3: Presentation (Cyan)
        background: isLight ? '#0891b2' : '#06b6d4', 
        border: isLight ? '#0e7490' : '#22d3ee', 
        highlight: { background: isLight ? '#155e75' : '#0891b2', border: isLight ? '#0891b2' : '#67e8f9' } 
      },
      { // 4: Course (Yellow)
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' } 
      },
      { // 5: Project (Green)
        background: isLight ? '#059669' : '#10b981', 
        border: isLight ? '#047857' : '#34d399', 
        highlight: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' } 
      },
      { // 6: Service (Purple)
        background: isLight ? '#9333ea' : '#a855f7', 
        border: isLight ? '#7e22ce' : '#c084fc', 
        highlight: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' } 
      },
      { // 7: Interest (Rose)
        background: isLight ? '#e11d48' : '#f43f5e', 
        border: isLight ? '#be123c' : '#fb7185', 
        highlight: { background: isLight ? '#9f1239' : '#e11d48', border: isLight ? '#e11d48' : '#fda4af' } 
      }
    ];

    // Batch node styling updates (colors & fonts)
    const nodeUpdates: (VisNode & { rawGroup?: number })[] = [];
    this.visNodes?.forEach((node: VisCustomNode) => {
      nodeUpdates.push({
        id: node.id,
        color: colors[node.rawGroup ?? 0] || colors[0],
        font: {
          color: isLight ? '#0f172a' : '#f8fafc',
          strokeColor: isLight ? '#ffffff' : '#0f172a'
        }
      });
    });
    this.visNodes?.update(nodeUpdates);

    // Batch edge updates
    const edgeUpdates: VisEdge[] = [];
    this.visEdges?.forEach((edge: VisEdge) => {
      edgeUpdates.push({
        id: edge.id,
        color: {
          color: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255,255,255,0.15)',
          highlight: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255,255,255,0.35)'
        }
      });
    });
    this.visEdges?.update(edgeUpdates);

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial') {
      const targets: Record<string, { x: number; y: number }> = {};
      const tags = (this.nodes || []).filter(n => n.group === 0);
      const others = (this.nodes || []).filter(n => n.group !== 0);

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n.id] = {
          x: 120 * Math.cos(theta),
          y: 120 * Math.sin(theta)
        };
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n.id] = {
          x: 280 * Math.cos(theta),
          y: 280 * Math.sin(theta)
        };
      });

      this.animateTo(targets);

    } else if (layout === 'columns') {
      const targets: Record<string, { x: number; y: number }> = {};
      const tags = (this.nodes || []).filter(n => n.group === 0);
      const posts = (this.nodes || []).filter(n => n.group === 1);
      const publications = (this.nodes || []).filter(n => n.group === 2);
      const presentations = (this.nodes || []).filter(n => n.group === 3);
      const courses = (this.nodes || []).filter(n => n.group === 4);
      const projects = (this.nodes || []).filter(n => n.group === 5);
      const services = (this.nodes || []).filter(n => n.group === 6);
      const interests = (this.nodes || []).filter(n => n.group === 7);

      const categories = [posts, publications, presentations, tags, courses, projects, services, interests];

      const isMobile = window.innerWidth < 768;
      const heightFactor = 45;
      const widthFactor = 45;

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - 3.5) * 120;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * widthFactor : 0,
              y: rowY
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - 3.5) * 200;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * heightFactor : 0
            };
          });
        });
      }

      this.animateTo(targets);

    } else {
      // default: force directed
      if (layoutChanged) {
        this.network.setOptions({
          physics: {
            enabled: true,
            stabilization: { iterations: 100, updateInterval: 25 }
          }
        });
        const stopForce = () => {
          if (this.network) {
            this.network.setOptions({ physics: { enabled: false } });
            this.network.stopSimulation();
          }
        };
        this.network.once("stabilizationIterationsDone", stopForce);
        this.network.once("stabilized", stopForce);
        setTimeout(stopForce, 1500);
      } else {
        // Layout didn't change (e.g. theme toggle), keep physics frozen to avoid battery/CPU drain
        this.network.setOptions({ physics: { enabled: false } });
        this.network.stopSimulation();
      }
    }
  },

  pause() {
    if (this.dragStabilizeTimeout) {
      clearTimeout(this.dragStabilizeTimeout);
      this.dragStabilizeTimeout = null;
    }
    if (this.network) {
      this.network.setOptions({ physics: { enabled: false } });
      this.network.stopSimulation();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  },

  resume() {
    if (this.network) {
      this.network.redraw();
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600) {
    if (!this.network || !this.visNodes) return;
    this.network.setOptions({ physics: { enabled: false } });

    const startTime = performance.now();
    const startPositions = this.network.getPositions();

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const updates: (VisNode & { rawGroup?: number })[] = [];
      (this.nodes || []).forEach(n => {
        const start = startPositions[n.id] || { x: 0, y: 0 };
        const target = targets[n.id];
        if (target) {
          updates.push({
            id: n.id,
            x: start.x + (target.x - start.x) * ease,
            y: start.y + (target.y - start.y) * ease
          });
        }
      });

      this.visNodes?.update(updates);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.pause();
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.visNodes = null;
    this.visEdges = null;
  }
};

export default engine;
