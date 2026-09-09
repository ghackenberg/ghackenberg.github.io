const colorsDark = ['#0ea5e9', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#a855f7'];
const colorsLight = ['#0284c7', '#2563eb', '#4f46e5', '#059669', '#d97706', '#9333ea'];

export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const d3 = await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm');
    this.d3 = d3;

    this.width = container.offsetWidth || 800;
    this.height = container.offsetHeight || 500;

    this.nodes = payload.d3.nodes.map(n => ({ ...n }));
    // Randomize initial node positions around center
    this.nodes.forEach(n => {
      n.x = this.width / 2 + (Math.random() - 0.5) * (this.width * 0.4);
      n.y = this.height / 2 + (Math.random() - 0.5) * (this.height * 0.4);
    });

    this.links = payload.d3.connections.map(c => ({
      source: c.sourceId,
      target: c.targetId
    })).filter(l => this.nodes.some(n => n.id === l.source) && this.nodes.some(n => n.id === l.target));

    this.svg = d3.select(container).append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("display", "block");

    this.svgGroup = this.svg.append("g");

    this.zoom = d3.zoom()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        this.svgGroup.attr("transform", event.transform);
      });

    this.svg.call(this.zoom);

    // Create D3 simulation
    this.simulation = d3.forceSimulation(this.nodes);

    this.linkElements = this.svgGroup.selectAll(".link")
      .data(this.links)
      .enter().append("line")
      .style("stroke-width", "1px");

    this.nodeElements = this.svgGroup.selectAll(".node")
      .data(this.nodes)
      .enter().append("g")
      .call(d3.drag()
        .on("start", (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

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

    this.nodeElements.on("dblclick", (event, d) => {
      if (
        d.id.startsWith('/posts/') ||
        d.id.startsWith('/publications/') ||
        d.id.startsWith('/projects/') ||
        d.id.startsWith('/courses/') ||
        d.id.startsWith('/services/') ||
        d.id.startsWith('/tags/')
      ) {
        window.location.href = d.id;
      }
    });

    this.simulation.on("tick", () => {
      this.linkElements
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      this.nodeElements.attr("transform", d => `translate(${d.x},${d.y})`);
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
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        this.width = width;
        this.height = height;
        if (this.svg) {
          this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
          this.updateLayout(this.currentLayout, this.isLight);
          clearTimeout(this.fitTimeout);
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
      const left = n.x - r - 10;
      const right = n.x + r + 80; // approximate label length
      const top = n.y - r - 10;
      const bottom = n.y + r + 10;

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

    const transform = this.d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    if (duration > 0) {
      this.svg.transition().duration(duration).call(this.zoom.transform, transform);
    } else {
      this.svg.call(this.zoom.transform, transform);
    }
  },

  updateLayout(layout, isLight) {
    if (!this.simulation) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to D3 texts and circles based on theme
    this.linkElements.style("stroke", isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255,255,255,0.06)");
    this.nodeElements.selectAll("circle").style("stroke", isLight ? "#ffffff" : "#030712");
    this.nodeElements.selectAll("text").style("fill", isLight ? "#334155" : "#9ca3af");
    const colors = isLight ? colorsLight : colorsDark;
    this.nodeElements.selectAll("circle").style("fill", d => colors[d.group] || colors[0]);

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
        .force("link", this.d3.forceLink(this.links).id(d => d.id).distance(30).strength(0.08))
        .force("charge", this.d3.forceManyBody().strength(-30))
        .force("center", null)
        .force("x", this.d3.forceX(d => d.targetX).strength(1.2))
        .force("y", this.d3.forceY(d => d.targetY).strength(1.2))
        .force("collide", this.d3.forceCollide(d => d.size * 6 + 10).strength(0.8));

    } else if (layout === 'columns') {
      const posts = this.nodes.filter(n => n.group === 1);
      const courses = this.nodes.filter(n => n.group === 4);
      const tags = this.nodes.filter(n => n.group === 0);
      const projects = this.nodes.filter(n => n.group === 3);
      const services = this.nodes.filter(n => n.group === 5);
      const publications = this.nodes.filter(n => n.group === 2);

      const categories = [posts, courses, tags, projects, services, publications];
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
        .force("link", this.d3.forceLink(this.links).id(d => d.id).distance(30).strength(0.02))
        .force("charge", this.d3.forceManyBody().strength(-20))
        .force("center", null)
        .force("x", this.d3.forceX(d => d.targetX).strength(1.5))
        .force("y", this.d3.forceY(d => d.targetY).strength(1.5))
        .force("collide", this.d3.forceCollide(d => d.size * 6 + 8).strength(0.8));

    } else {
      // Force-directed (default)
      const minDim = Math.min(this.width, this.height);
      const linkDist = Math.max(35, Math.min(65, minDim * 0.08));
      const charge = -Math.max(100, Math.min(220, minDim * 0.25));

      this.simulation
        .force("link", this.d3.forceLink(this.links).id(d => d.id).distance(linkDist).strength(0.3))
        .force("charge", this.d3.forceManyBody().strength(charge))
        .force("center", this.d3.forceCenter(this.width / 2, this.height / 2))
        .force("collide", this.d3.forceCollide(d => d.size * 6 + 12).strength(0.8))
        .force("x", this.d3.forceX(this.width / 2).strength(0.04))
        .force("y", this.d3.forceY(this.height / 2).strength(0.04));
    }

    // Trigger transition
    this.simulation.alpha(0.3).restart();

    // Smoothly auto-fit once simulation transitions
    clearTimeout(this.fitTimeout);
    this.fitTimeout = setTimeout(() => {
      this.fitToView(600);
    }, 350);
  },

  destroy() {
    clearTimeout(this.fitTimeout);
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
