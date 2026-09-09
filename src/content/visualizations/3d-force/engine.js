const colorsDark = ['#0ea5e9', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#a855f7'];
const colorsLight = ['#0284c7', '#2563eb', '#4f46e5', '#059669', '#d97706', '#9333ea'];

export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const { default: ForceGraph3D } = await import('https://esm.sh/3d-force-graph@1.73.0?bundle');
    this.ForceGraph3D = ForceGraph3D;

    const colors = isLight ? colorsLight : colorsDark;
    
    // Cache nodes and connections
    this.nodes = payload['3d-force'].nodes.map(n => ({
      id: n.id,
      name: n.name,
      val: n.size * 5 + 3,
      color: colors[n.group] || colors[0],
      group: n.group
    }));

    this.links = payload['3d-force'].connections.map(c => ({
      source: c.sourceId,
      target: c.targetId
    }));

    this.graph = ForceGraph3D()(container)
      .graphData({ nodes: this.nodes, links: this.links })
      .backgroundColor(isLight ? '#f8fafc' : '#090d16')
      .showNavInfo(false)
      .nodeLabel('name')
      .nodeVal('val')
      .nodeColor('color')
      .linkColor(isLight ? () => 'rgba(15, 23, 42, 0.15)' : () => 'rgba(255,255,255,0.08)')
      .linkWidth(1.2)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.006)
      .onNodeClick(node => {
        if (
          node.id.startsWith('/posts/') ||
          node.id.startsWith('/publications/') ||
          node.id.startsWith('/projects/') ||
          node.id.startsWith('/courses/') ||
          node.id.startsWith('/services/') ||
          node.id.startsWith('/tags/')
        ) {
          window.location.href = node.id;
        }
      });

    this.graph.d3Force('charge').strength(-120);

    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (this.graph) {
          this.graph.width(width).height(height);
        }
      }
    });
    this.resizeObserver.observe(container);

    this.initialized = false;
    this.updateLayout(layout, isLight);
    this.initialized = true;

    return this;
  },

  updateLayout(layout, isLight) {
    if (!this.graph) return;

    // Apply color update based on theme
    this.graph.backgroundColor(isLight ? '#f8fafc' : '#090d16');
    this.graph.linkColor(isLight ? () => 'rgba(15, 23, 42, 0.15)' : () => 'rgba(255,255,255,0.08)');

    const colors = isLight ? colorsLight : colorsDark;
    this.nodes.forEach(n => {
      n.color = colors[n.group] || colors[0];
    });
    this.graph.nodeColor('color');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial') {
      const targets = {};
      const tags = this.nodes.filter(n => n.group === 0);
      const others = this.nodes.filter(n => n.group !== 0);

      // Inner ring: tags (Z = 0)
      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n.id] = {
          x: 70 * Math.cos(theta),
          y: 70 * Math.sin(theta),
          z: 0
        };
      });

      // Outer ring: other items (Z = 0)
      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n.id] = {
          x: 160 * Math.cos(theta),
          y: 160 * Math.sin(theta),
          z: 0
        };
      });

      this.animateTo(targets);

    } else if (layout === 'columns') {
      const targets = {};
      const posts = this.nodes.filter(n => n.group === 1);
      const courses = this.nodes.filter(n => n.group === 4);
      const tags = this.nodes.filter(n => n.group === 0);
      const projects = this.nodes.filter(n => n.group === 3);
      const services = this.nodes.filter(n => n.group === 5);
      const publications = this.nodes.filter(n => n.group === 2);

      const categories = [posts, courses, tags, projects, services, publications];
      const isMobile = window.innerWidth < 768;
      const heightFactor = 25;
      const widthFactor = 25;

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - 2.5) * 55;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * widthFactor : 0,
              y: rowY,
              z: 0
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - 2.5) * 55;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * heightFactor : 0,
              z: 0
            };
          });
        });
      }

      this.animateTo(targets);

    } else {
      // default: force directed
      // Release node positions so the force simulation can solve them dynamically
      this.nodes.forEach(n => {
        n.fx = null;
        n.fy = null;
        n.fz = null;
      });
      
      // Only reheat the simulation if we are already initialized and switching layouts.
      // 3D-force-graph will automatically run the simulation on mount, so running it
      // during init throws asynchronous errors as Three-forcegraph tick cycles start.
      if (this.initialized) {
        try {
          this.graph.d3ReheatSimulation();
        } catch (e) {
          // Suppress if the internal engine has not loaded yet
        }
      }
    }
  },

  animateTo(targets, duration = 800) {
    const startTime = performance.now();
    const startPositions = {};
    
    this.nodes.forEach(n => {
      startPositions[n.id] = {
        x: n.x || 0,
        y: n.y || 0,
        z: n.z || 0
      };
    });

    const step = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.nodes.forEach(n => {
        const start = startPositions[n.id];
        const target = targets[n.id];
        if (start && target) {
          n.fx = start.x + (target.x - start.x) * ease;
          n.fy = start.y + (target.y - start.y) * ease;
          n.fz = start.z + (target.z - start.z) * ease;
          n.x = n.fx;
          n.y = n.fy;
          n.z = n.fz;
        }
      });

      if (this.graph && this.initialized) {
        try {
          this.graph.d3ReheatSimulation();
        } catch (e) {
          // Suppress
        }
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        try {
          if (this.graph && this.initialized) {
            this.graph.d3ReheatSimulation();
          }
        } catch (e) {
          // Suppress if the internal engine is not ready
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.graph) {
      this.graph.pauseAnimation();
      this.graph.graphData({ nodes: [], links: [] });
      this.graph = null;
    }
    this.nodes = null;
    this.links = null;
  }
};
