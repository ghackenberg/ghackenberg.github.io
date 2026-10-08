import * as d3 from 'd3';

const colorsDark = ['#0ea5e9', '#3b82f6', '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#a855f7', '#f43f5e'];
const colorsLight = ['#0284c7', '#2563eb', '#4f46e5', '#0891b2', '#d97706', '#059669', '#9333ea', '#e11d48'];

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  size: number;
  group: number;
  targetX?: number;
  targetY?: number;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

export interface D3Payload {
  d3: {
    nodes: { id: string; name: string; size: number; group: number }[];
    connections: { sourceId: string; targetId: string }[];
  };
}

export interface D3Engine {
  layouts: { id: string; label: string }[];
  width: number;
  height: number;
  nodes: D3Node[] | null;
  links: D3Link[] | null;
  svg: d3.Selection<SVGSVGElement, D3Node, null, undefined> | null;
  svgGroup: d3.Selection<SVGGElement, D3Node, null, undefined> | null;
  zoom: d3.ZoomBehavior<SVGSVGElement, D3Node> | null;
  simulation: d3.Simulation<D3Node, D3Link> | null;
  linkElements: d3.Selection<SVGLineElement, D3Link, SVGGElement, D3Node> | null;
  nodeElements: d3.Selection<SVGGElement, D3Node, SVGGElement, D3Node> | null;
  currentLayout?: string;
  isLight?: boolean;
  fitTimeout?: ReturnType<typeof setTimeout>;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean): Promise<D3Engine>;
  fitToView(duration?: number): void;
  updateLayout(layout: string, isLight: boolean): void;
  destroy(): void;
}

const engine: D3Engine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  width: 800,
  height: 500,
  nodes: null,
  links: null,
  svg: null,
  svgGroup: null,
  zoom: null,
  simulation: null,
  linkElements: null,
  nodeElements: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean) {
    this.width = container.offsetWidth || 800;
    this.height = container.offsetHeight || 500;

    this.nodes = payload.d3.nodes.map((n) => ({ ...n }));
    // Randomize initial node positions around center
    this.nodes.forEach(n => {
      n.x = this.width / 2 + (Math.random() - 0.5) * (this.width * 0.4);
      n.y = this.height / 2 + (Math.random() - 0.5) * (this.height * 0.4);
    });

    this.links = payload.d3.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId
    })).filter((l) => this.nodes!.some(n => n.id === l.source) && this.nodes!.some(n => n.id === l.target));

    this.svg = d3.select<HTMLElement, D3Node>(container).append<SVGSVGElement>("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("display", "block");

    this.svgGroup = this.svg.append<SVGGElement>("g");

    this.zoom = d3.zoom<SVGSVGElement, D3Node>()
      .scaleExtent([0.1, 8])
      .filter((event) => event.type !== 'wheel')
      .on("zoom", (event) => {
        this.svgGroup?.attr("transform", event.transform.toString());
      });

    this.svg.call(this.zoom).on('wheel.zoom', null);

    // Create D3 simulation
    this.simulation = d3.forceSimulation<D3Node>(this.nodes);

    this.linkElements = this.svgGroup.selectAll<SVGLineElement, D3Link>(".link")
      .data(this.links)
      .enter().append("line")
      .style("stroke-width", "1px");

    const dragBehavior = d3.drag<SVGGElement, D3Node>()
      .on("start", (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    this.nodeElements = this.svgGroup.selectAll<SVGGElement, D3Node>(".node")
      .data(this.nodes)
      .enter().append("g")
      .call(dragBehavior);

    const colors = isLight ? colorsLight : colorsDark;
    
    this.nodeElements.append("circle")
      .attr("r", d => d.size * 6 + 4)
      .style("fill", d => colors[d.group] || colors[0])
      .style("stroke-width", "1.5px");

    this.nodeElements.append("text")
      .attr("dx", d => d.size * 6 + 8)
      .attr("dy", ".35em")
      .style("font-size", "9px")
      .style("font-family", "Outfit, Inter, sans-serif")
      .style("font-weight", "500")
      .style("pointer-events", "none");

    this.nodeElements.on("dblclick", (_event, d) => {
      if (
        d.id.startsWith('/posts/') ||
        d.id.startsWith('/publications/') ||
        d.id.startsWith('/projects/') ||
        d.id.startsWith('/courses/') ||
        d.id.startsWith('/services/') ||
        d.id.startsWith('/interests/') ||
        d.id.startsWith('/tags/')
      ) {
        window.location.href = d.id;
      }
    });

    this.simulation.on("tick", () => {
      this.linkElements
        ?.attr("x1", d => (d.source as D3Node).x ?? 0)
        ?.attr("y1", d => (d.source as D3Node).y ?? 0)
        ?.attr("x2", d => (d.target as D3Node).x ?? 0)
        ?.attr("y2", d => (d.target as D3Node).y ?? 0);

      this.nodeElements?.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    this.updateLayout(layout, isLight);

    // Warm up the simulation to compute initial equilibrium positions
    for (let i = 0; i < 70; ++i) {
      this.simulation.tick();
    }
    // Auto-fit to viewport immediately
    this.fitToView(0);

    // Bind ResizeObserver to handle SVG resizing dynamically
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        this.width = width;
        this.height = height;
        if (this.svg) {
          this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
          if (this.currentLayout !== undefined && this.isLight !== undefined) {
            this.updateLayout(this.currentLayout, this.isLight);
          }
          if (this.fitTimeout) clearTimeout(this.fitTimeout);
          this.fitTimeout = setTimeout(() => {
            this.fitToView(300);
          }, 300);
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  fitToView(duration = 600) {
    if (!this.svg || !this.zoom || !this.nodes || this.nodes.length === 0) return;
    if (this.width <= 0 || this.height <= 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      const r = (n.size || 1) * 6 + 4;
      const left = (n.x || 0) - r - 10;
      const right = (n.x || 0) + r + 80; // approximate label length
      const top = (n.y || 0) - r - 10;
      const bottom = (n.y || 0) + r + 10;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }

    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    if (boxWidth <= 0 || boxHeight <= 0) return;

    // Margins to ensure nodes don't collide with the top legend or bottom layout selector
    const padTop = 60;
    const padBottom = 55;
    const padX = 40;

    const availableWidth = Math.max(100, this.width - padX * 2);
    const availableHeight = Math.max(100, this.height - padTop - padBottom);

    const scaleX = availableWidth / boxWidth;
    const scaleY = availableHeight / boxHeight;
    const scale = Math.max(0.12, Math.min(1.1, Math.min(scaleX, scaleY)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const targetCenterX = this.width / 2;
    const targetCenterY = padTop + availableHeight / 2;

    const translateX = targetCenterX - scale * midX;
    const translateY = targetCenterY - scale * midY;

    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    if (duration > 0) {
      this.svg.transition().duration(duration).call(this.zoom.transform, transform);
    } else {
      this.svg.call(this.zoom.transform, transform);
    }
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.simulation || !this.nodes || !this.linkElements || !this.nodeElements) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to D3 texts and circles based on theme
    this.linkElements.style("stroke", isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255,255,255,0.06)");
    this.nodeElements.selectAll("circle").style("stroke", isLight ? "#ffffff" : "#030712");
    this.nodeElements.selectAll("text").style("fill", isLight ? "#334155" : "#9ca3af");
    const colors = isLight ? colorsLight : colorsDark;
    this.nodeElements.selectAll<SVGCircleElement, D3Node>("circle").style("fill", d => colors[d.group] || colors[0]);

    if (layout === 'radial') {
      const cx = this.width / 2;
      const cy = this.height / 2;

      const minDim = Math.min(this.width, this.height);
      const innerRadius = Math.max(60, minDim * 0.20);
      const outerRadius = Math.max(140, minDim * 0.42);

      const tags = this.nodes.filter(n => n.group === 0);
      const others = this.nodes.filter(n => n.group !== 0);

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        n.targetX = cx + innerRadius * Math.cos(theta);
        n.targetY = cy + innerRadius * Math.sin(theta);
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        n.targetX = cx + outerRadius * Math.cos(theta);
        n.targetY = cy + outerRadius * Math.sin(theta);
      });

      // Apply positional forces
      this.simulation
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(30).strength(0.08))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("center", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? cx).strength(1.2))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? cy).strength(1.2))
        .force("collide", d3.forceCollide<D3Node>(d => d.size * 6 + 10).strength(0.8));

    } else if (layout === 'columns') {
      const posts = this.nodes.filter(n => n.group === 1);
      const publications = this.nodes.filter(n => n.group === 2);
      const presentations = this.nodes.filter(n => n.group === 3);
      const tags = this.nodes.filter(n => n.group === 0);
      const courses = this.nodes.filter(n => n.group === 4);
      const projects = this.nodes.filter(n => n.group === 5);
      const services = this.nodes.filter(n => n.group === 6);
      const interests = this.nodes.filter(n => n.group === 7);

      const categories = [posts, publications, presentations, tags, courses, projects, services, interests];
      const isMobile = this.width < 768 || window.innerWidth < 768;

      const padX = Math.max(40, this.width * 0.08);
      const padY = Math.max(50, this.height * 0.12);
      const usableW = this.width - padX * 2;
      const usableH = this.height - padY * 2;

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = padY + (catIdx + 0.5) * (usableH / categories.length);
          catNodes.forEach((n, idx) => {
            n.targetX = padX + (idx + 0.5) * (usableW / Math.max(1, catNodes.length));
            n.targetY = rowY;
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = padX + (catIdx + 0.5) * (usableW / categories.length);
          catNodes.forEach((n, idx) => {
            n.targetX = colX;
            n.targetY = padY + (idx + 0.5) * (usableH / Math.max(1, catNodes.length));
          });
        });
      }

      // Apply columnar forces
      this.simulation
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(30).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("center", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.5))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.5))
        .force("collide", d3.forceCollide<D3Node>(d => d.size * 6 + 8).strength(0.8));

    } else {
      // Force-directed (default)
      const minDim = Math.min(this.width, this.height);
      const linkDist = Math.max(35, Math.min(65, minDim * 0.08));
      const charge = -Math.max(100, Math.min(220, minDim * 0.25));

      this.simulation
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(linkDist).strength(0.3))
        .force("charge", d3.forceManyBody().strength(charge))
        .force("center", d3.forceCenter(this.width / 2, this.height / 2))
        .force("collide", d3.forceCollide<D3Node>(d => d.size * 6 + 12).strength(0.8))
        .force("x", d3.forceX(this.width / 2).strength(0.04))
        .force("y", d3.forceY(this.height / 2).strength(0.04));
    }

    // Trigger transition
    this.simulation.alpha(0.3).restart();

    // Smoothly auto-fit once simulation transitions
    if (this.fitTimeout) clearTimeout(this.fitTimeout);
    this.fitTimeout = setTimeout(() => {
      this.fitToView(600);
    }, 350);
  },

  destroy() {
    if (this.fitTimeout) clearTimeout(this.fitTimeout);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
  }
};

export default engine;
