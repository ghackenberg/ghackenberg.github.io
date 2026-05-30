export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Posts)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight) {
    const { default: cytoscape } = await import('https://cdn.jsdelivr.net/npm/cytoscape@3.31.0/+esm');
    
    this.cy = cytoscape({
      container: container,
      elements: payload.cytoscape.elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(name)',
            'width': 'data(size)',
            'height': 'data(size)',
            'color': isLight ? '#0f172a' : '#f3f4f6',
            'font-size': '10px',
            'font-family': 'Outfit, Inter, sans-serif',
            'font-weight': '600',
            'text-valign': 'center',
            'text-halign': 'right',
            'text-margin-x': 4,
            'border-width': '2px',
            'border-color': isLight ? '#ffffff' : '#030712',
            'overlay-opacity': 0,
            'transition-property': 'background-color, border-color, width, height',
            'transition-duration': '0.2s'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.06)',
            'target-arrow-color': isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255,255,255,0.1)',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': '3px',
            'border-color': '#10b981'
          }
        }
      ],
      layout: { name: 'null' }
    });

    this.cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const id = node.id();
      if (id.startsWith('/posts/') || id.startsWith('/publications/')) {
        window.location.href = id;
      }
    });

    // Cache parameters for ResizeObserver
    this.currentLayout = layout;
    this.isLight = isLight;

    // Run initial layout
    this.updateLayout(layout, isLight);

    // Bind ResizeObserver to handle container size changes dynamically
    this.resizeObserver = new ResizeObserver(() => {
      if (this.cy) {
        this.cy.resize();
        this.updateLayout(this.currentLayout, this.isLight);
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  updateLayout(layout, isLight) {
    if (!this.cy) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to node labels based on theme
    this.cy.style().selector('node').style({
      'color': isLight ? '#0f172a' : '#f3f4f6',
      'border-color': isLight ? '#ffffff' : '#030712'
    }).update();

    if (layout === 'radial') {
      this.cy.layout({
        name: 'concentric',
        concentric: function(node) {
          return node.data('color') === '#3b82f6' ? 2 : 1;
        },
        levelWidth: function() { return 1; },
        animate: true,
        animationDuration: 600
      }).run();
    } else if (layout === 'columns') {
      const width = this.cy.width();
      const height = this.cy.height();
      const nodes = this.cy.nodes();

      const tags = nodes.filter(n => n.data('color') === '#3b82f6');
      const posts = nodes.filter(n => n.data('color') === '#10b981');
      const publications = nodes.filter(n => n.data('color') === '#f59e0b');

      const pos = {};
      const isMobile = width < 768 || window.innerWidth < 768;
      
      if (isMobile) {
        posts.forEach((n, idx) => {
          pos[n.id()] = {
            x: (idx + 1) * (width / (posts.length + 1)),
            y: height / 4
          };
        });

        tags.forEach((n, idx) => {
          pos[n.id()] = {
            x: (idx + 1) * (width / (tags.length + 1)),
            y: height / 2
          };
        });

        publications.forEach((n, idx) => {
          pos[n.id()] = {
            x: (idx + 1) * (width / (publications.length + 1)),
            y: 3 * height / 4
          };
        });
      } else {
        tags.forEach((n, idx) => {
          pos[n.id()] = {
            x: width / 2,
            y: (idx + 1) * (height / (tags.length + 1))
          };
        });

        posts.forEach((n, idx) => {
          pos[n.id()] = {
            x: width / 4,
            y: (idx + 1) * (height / (posts.length + 1))
          };
        });

        publications.forEach((n, idx) => {
          pos[n.id()] = {
            x: 3 * width / 4,
            y: (idx + 1) * (height / (publications.length + 1))
          };
        });
      }

      this.cy.layout({
        name: 'preset',
        positions: function(node) {
          return pos[node.id()] || node.position();
        },
        animate: true,
        animationDuration: 600
      }).run();
    } else {
      // default: force directed
      this.cy.layout({
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: true,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000
      }).run();
    }
  },

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  }
};
