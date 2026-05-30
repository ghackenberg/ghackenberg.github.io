export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Posts)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const [
      { Sigma },
      { Graph },
      { default: forceAtlas2 }
    ] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/sigma@2.4.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/graphology@0.25.4/+esm'),
      import('https://cdn.jsdelivr.net/npm/graphology-layout-forceatlas2@0.10.1/+esm')
    ]);

    this.Sigma = Sigma;
    this.Graph = Graph;
    this.forceAtlas2 = forceAtlas2;

    this.graph = new Graph();
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;

    nodes.forEach(n => {
      this.graph.addNode(n.id, {
        label: n.label,
        x: n.x || Math.random(),
        y: n.y || Math.random(),
        size: n.size * 3 + 2,
        color: n.color
      });
    });

    const edgeColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    edges.forEach(e => {
      this.graph.addEdge(e.source, e.target, {
        size: 1,
        color: edgeColor
      });
    });

    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: '#3b82f6',
      defaultEdgeColor: edgeColor,
      labelColor: { color: isLight ? '#0f172a' : '#f3f4f6' },
      labelFont: 'Outfit, Inter, sans-serif',
      labelSize: 10
    });

    this.sigma.on('clickNode', ({ node }) => {
      if (node.startsWith('/posts/') || node.startsWith('/publications/')) {
        window.location.href = node;
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    this.updateLayout(layout, isLight);
    
    // Zoom to fit the graph
    setTimeout(() => {
      if (this.sigma) {
        this.sigma.getCamera().animatedReset();
      }
    }, 100);

    // Bind ResizeObserver to handle container size changes dynamically
    this.resizeObserver = new ResizeObserver(() => {
      if (this.sigma) {
        this.sigma.refresh();
        this.sigma.getCamera().animatedReset();
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  updateLayout(layout, isLight) {
    if (!this.graph || !this.sigma) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to node labels and edges based on theme
    const edgeColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const labelColor = isLight ? '#0f172a' : '#f3f4f6';

    this.graph.forEachEdge(edge => {
      this.graph.setEdgeAttribute(edge, 'color', edgeColor);
    });

    this.sigma.setSetting('labelColor', { color: labelColor });
    this.sigma.setSetting('defaultEdgeColor', edgeColor);

    const targets = {};

    if (layout === 'radial') {
      const nodes = this.graph.nodes();
      const tags = nodes.filter(n => this.graph.getNodeAttribute(n, 'color') === '#3b82f6');
      const others = nodes.filter(n => this.graph.getNodeAttribute(n, 'color') !== '#3b82f6');

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n] = {
          x: 5 * Math.cos(theta),
          y: 5 * Math.sin(theta)
        };
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n] = {
          x: 12 * Math.cos(theta),
          y: 12 * Math.sin(theta)
        };
      });

      this.animateTo(targets);

    } else if (layout === 'columns') {
      const nodes = this.graph.nodes();
      const tags = nodes.filter(n => this.graph.getNodeAttribute(n, 'color') === '#3b82f6');
      const posts = nodes.filter(n => this.graph.getNodeAttribute(n, 'color') === '#10b981');
      const publications = nodes.filter(n => this.graph.getNodeAttribute(n, 'color') === '#f59e0b');

      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        posts.forEach((n, idx) => {
          targets[n] = {
            x: posts.length > 1 ? (idx - (posts.length - 1) / 2) * (20 / (posts.length - 1)) : 0,
            y: -8
          };
        });

        tags.forEach((n, idx) => {
          targets[n] = {
            x: tags.length > 1 ? (idx - (tags.length - 1) / 2) * (20 / (tags.length - 1)) : 0,
            y: 0
          };
        });

        publications.forEach((n, idx) => {
          targets[n] = {
            x: publications.length > 1 ? (idx - (publications.length - 1) / 2) * (20 / (publications.length - 1)) : 0,
            y: 8
          };
        });
      } else {
        tags.forEach((n, idx) => {
          targets[n] = {
            x: 0,
            y: tags.length > 1 ? (idx - (tags.length - 1) / 2) * (20 / (tags.length - 1)) : 0
          };
        });

        posts.forEach((n, idx) => {
          targets[n] = {
            x: -8,
            y: posts.length > 1 ? (idx - (posts.length - 1) / 2) * (20 / (posts.length - 1)) : 0
          };
        });

        publications.forEach((n, idx) => {
          targets[n] = {
            x: 8,
            y: publications.length > 1 ? (idx - (publications.length - 1) / 2) * (20 / (publications.length - 1)) : 0
          };
        });
      }

      this.animateTo(targets);

    } else {
      // default: force directed
      // Run ForceAtlas2 synchronously on a temporary setup or on the graph
      // To get starting points, we save them, run it, then interpolate.
      const startingPos = {};
      this.graph.forEachNode(node => {
        startingPos[node] = {
          x: this.graph.getNodeAttribute(node, 'x'),
          y: this.graph.getNodeAttribute(node, 'y')
        };
      });

      // Run ForceAtlas2 (which will change coordinates in graph)
      this.forceAtlas2.assign(this.graph, {
        iterations: 100,
        settings: {
          gravity: 0.8
        }
      });

      // Read resulting targets and reset graph to starting positions
      this.graph.forEachNode(node => {
        targets[node] = {
          x: this.graph.getNodeAttribute(node, 'x'),
          y: this.graph.getNodeAttribute(node, 'y')
        };
        this.graph.setNodeAttribute(node, 'x', startingPos[node].x);
        this.graph.setNodeAttribute(node, 'y', startingPos[node].y);
      });

      this.animateTo(targets);
    }
  },

  animateTo(targets, duration = 600) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const startTime = performance.now();
    const startPositions = {};
    this.graph.forEachNode(node => {
      startPositions[node] = {
        x: this.graph.getNodeAttribute(node, 'x'),
        y: this.graph.getNodeAttribute(node, 'y')
      };
    });

    const step = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.graph.forEachNode(node => {
        const start = startPositions[node];
        const target = targets[node];
        if (start && target) {
          const currentX = start.x + (target.x - start.x) * ease;
          const currentY = start.y + (target.y - start.y) * ease;
          this.graph.setNodeAttribute(node, 'x', currentX);
          this.graph.setNodeAttribute(node, 'y', currentY);
        }
      });

      if (this.sigma) {
        this.sigma.refresh();
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        if (this.sigma) {
          this.sigma.getCamera().animatedReset();
        }
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
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    this.graph = null;
  }
};
