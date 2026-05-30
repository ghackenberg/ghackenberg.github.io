export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Posts)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const vis = await import('https://unpkg.com/vis-network@9.1.9/standalone/esm/index.js');
    this.vis = vis;

    this.nodes = payload['vis-network'].nodes;
    this.connections = payload['vis-network'].connections;

    const colors = [
      { 
        background: '#3b82f6', 
        border: isLight ? '#2563eb' : '#60a5fa', 
        highlight: { background: '#2563eb', border: '#1d4ed8' } 
      },
      { 
        background: '#10b981', 
        border: isLight ? '#059669' : '#34d399', 
        highlight: { background: '#059669', border: '#047857' } 
      },
      { 
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#b45309' : '#d97706', border: isLight ? '#92400e' : '#b45309' } 
      }
    ];

    // Initialize with randomized coordinates. Avoid Vis.js native group styling issues by omitting group
    // property and explicitly defining color object on each node.
    this.visNodes = new vis.DataSet(this.nodes.map(n => ({
      id: n.id,
      label: n.name,
      value: n.size * 6 + 4,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500,
      rawGroup: n.group,
      color: colors[n.group],
      font: {
        color: isLight ? '#334155' : '#e2e8f0',
        size: 11,
        face: 'Outfit, Inter, sans-serif'
      }
    })));

    this.visEdges = new vis.DataSet(this.connections.map(c => ({
      from: c.sourceId,
      to: c.targetId,
      color: {
        color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)',
        highlight: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255,255,255,0.25)'
      }
    })));

    const data = {
      nodes: this.visNodes,
      edges: this.visEdges
    };

    this.options = {
      nodes: {
        shape: 'dot',
        scaling: {
          min: 8,
          max: 20
        },
        borderWidth: 1.5,
        borderWidthSelected: 3
      },
      edges: {
        width: 1,
        smooth: {
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
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true
      }
    };

    this.network = new vis.Network(container, data, this.options);

    this.network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const id = params.nodes[0];
        if (id.startsWith('/posts/') || id.startsWith('/publications/')) {
          window.location.href = id;
        }
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    this.updateLayout(layout, isLight);

    // Bind ResizeObserver to handle network container changes dynamically
    this.resizeObserver = new ResizeObserver(() => {
      if (this.network) {
        this.network.redraw();
        this.network.fit();
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  updateLayout(layout, isLight) {
    if (!this.network) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to node labels and edges based on theme
    const colors = [
      { 
        background: '#3b82f6', 
        border: isLight ? '#2563eb' : '#60a5fa', 
        highlight: { background: '#2563eb', border: '#1d4ed8' } 
      },
      { 
        background: '#10b981', 
        border: isLight ? '#059669' : '#34d399', 
        highlight: { background: '#059669', border: '#047857' } 
      },
      { 
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#b45309' : '#d97706', border: isLight ? '#92400e' : '#b45309' } 
      }
    ];

    // Batch node styling updates (colors & fonts)
    const nodeUpdates = [];
    this.visNodes.forEach(node => {
      nodeUpdates.push({
        id: node.id,
        color: colors[node.rawGroup],
        font: {
          color: isLight ? '#334155' : '#e2e8f0'
        }
      });
    });
    this.visNodes.update(nodeUpdates);

    // Batch edge updates
    const edgeUpdates = [];
    this.visEdges.forEach(edge => {
      edgeUpdates.push({
        id: edge.id,
        color: {
          color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)',
          highlight: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255,255,255,0.25)'
        }
      });
    });
    this.visEdges.update(edgeUpdates);

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial') {
      const targets = {};
      const tags = this.nodes.filter(n => n.group === 0);
      const others = this.nodes.filter(n => n.group !== 0);

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
      const targets = {};
      const tags = this.nodes.filter(n => n.group === 0);
      const posts = this.nodes.filter(n => n.group === 1);
      const publications = this.nodes.filter(n => n.group === 2);

      const isMobile = window.innerWidth < 768;
      const heightFactor = 45;
      const widthFactor = 45;

      if (isMobile) {
        posts.forEach((n, idx) => {
          targets[n.id] = {
            x: posts.length > 1 ? (idx - (posts.length - 1) / 2) * widthFactor : 0,
            y: -250
          };
        });

        tags.forEach((n, idx) => {
          targets[n.id] = {
            x: tags.length > 1 ? (idx - (tags.length - 1) / 2) * widthFactor : 0,
            y: 0
          };
        });

        publications.forEach((n, idx) => {
          targets[n.id] = {
            x: publications.length > 1 ? (idx - (publications.length - 1) / 2) * widthFactor : 0,
            y: 250
          };
        });
      } else {
        tags.forEach((n, idx) => {
          targets[n.id] = {
            x: 0,
            y: tags.length > 1 ? (idx - (tags.length - 1) / 2) * heightFactor : 0
          };
        });

        posts.forEach((n, idx) => {
          targets[n.id] = {
            x: -250,
            y: posts.length > 1 ? (idx - (posts.length - 1) / 2) * heightFactor : 0
          };
        });

        publications.forEach((n, idx) => {
          targets[n.id] = {
            x: 250,
            y: publications.length > 1 ? (idx - (publications.length - 1) / 2) * heightFactor : 0
          };
        });
      }

      this.animateTo(targets);

    } else {
      // default: force directed
      // Re-enable physics and allow nodes to float freely
      this.network.setOptions({ physics: { enabled: true } });
    }
  },

  animateTo(targets, duration = 600) {
    this.network.setOptions({ physics: { enabled: false } });

    const startTime = performance.now();
    const startPositions = this.network.getPositions();

    const step = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const updates = [];
      this.nodes.forEach(n => {
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

      this.visNodes.update(updates);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.visNodes = null;
    this.visEdges = null;
  }
};
