export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Posts)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const d3 = await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm');
    this.d3 = d3;

    this.width = container.offsetWidth;
    this.height = container.offsetHeight;

    this.nodes = payload.d3.nodes.map(n => ({ ...n }));
    // Randomize initial node positions
    this.nodes.forEach(n => {
      n.x = Math.random() * this.width;
      n.y = Math.random() * this.height;
    });

    this.links = payload.d3.connections.map(c => ({
      source: c.sourceId,
      target: c.targetId
    })).filter(l => this.nodes.some(n => n.id === l.source) && this.nodes.some(n => n.id === l.target));

    this.svg = d3.select(container).append("svg")
      .attr("width", this.width)
      .attr("height", this.height);

    this.svgGroup = this.svg.append("g");

    this.zoom = d3.zoom()
      .scaleExtent([0.3, 8])
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

    const colors = ["#3b82f6", "#10b981", "#f59e0b"]; // blue, green, yellow
    
    this.nodeElements.append("circle")
      .attr("r", d => d.size * 6 + 4)
      .style("fill", d => colors[d.group])
      .style("stroke-width", "1.5px");

    this.nodeElements.append("text")
      .attr("dx", d => d.size * 6 + 8)
      .attr("dy", ".35em")
      .style("font-size", "9px")
      .style("font-family", "Outfit, Inter, sans-serif")
      .style("font-weight", "500")
      .style("pointer-events", "none");

    this.nodeElements.on("dblclick", (event, d) => {
      if (d.id.startsWith('/posts/') || d.id.startsWith('/publications/')) {
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

    this.updateLayout(layout, isLight);
    return this;
  },

  updateLayout(layout, isLight) {
    if (!this.simulation) return;

    // Apply color update to D3 texts and circles based on theme
    this.linkElements.style("stroke", isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255,255,255,0.06)");
    this.nodeElements.selectAll("circle").style("stroke", isLight ? "#ffffff" : "#030712");
    this.nodeElements.selectAll("text").style("fill", isLight ? "#334155" : "#9ca3af");

    if (layout === 'radial') {
      // Calculate concentric coordinates
      const cx = this.width / 2;
      const cy = this.height / 2;

      const tags = this.nodes.filter(n => n.group === 0);
      const others = this.nodes.filter(n => n.group !== 0);

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        n.targetX = cx + 110 * Math.cos(theta);
        n.targetY = cy + 110 * Math.sin(theta);
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        n.targetX = cx + 250 * Math.cos(theta);
        n.targetY = cy + 250 * Math.sin(theta);
      });

      // Apply positional forces
      this.simulation
        .force("link", this.d3.forceLink(this.links).id(d => d.id).distance(30).strength(0.1))
        .force("charge", this.d3.forceManyBody().strength(-30))
        .force("center", null)
        .force("x", this.d3.forceX(d => d.targetX).strength(1.2))
        .force("y", this.d3.forceY(d => d.targetY).strength(1.2))
        .force("collide", this.d3.forceCollide(d => d.size * 6 + 10).strength(0.8));

    } else if (layout === 'columns') {
      // Calculate columnar coordinates
      const tags = this.nodes.filter(n => n.group === 0);
      const posts = this.nodes.filter(n => n.group === 1);
      const publications = this.nodes.filter(n => n.group === 2);

      tags.forEach((n, idx) => {
        n.targetX = this.width / 2;
        n.targetY = (idx + 1) * (this.height / (tags.length + 1));
      });

      posts.forEach((n, idx) => {
        n.targetX = this.width / 4;
        n.targetY = (idx + 1) * (this.height / (posts.length + 1));
      });

      publications.forEach((n, idx) => {
        n.targetX = (3 * this.width) / 4;
        n.targetY = (idx + 1) * (this.height / (publications.length + 1));
      });

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
      this.simulation
        .force("link", this.d3.forceLink(this.links).id(d => d.id).distance(90))
        .force("charge", this.d3.forceManyBody().strength(-250))
        .force("center", this.d3.forceCenter(this.width / 2, this.height / 2))
        .force("x", null)
        .force("y", null)
        .force("collide", null);
    }

    // Trigger transition
    this.simulation.alpha(0.3).restart();
  },

  destroy() {
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
