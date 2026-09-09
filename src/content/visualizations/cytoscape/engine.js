const colorsDark = ['#0ea5e9', '#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#a855f7'];
const colorsLight = ['#0284c7', '#2563eb', '#4f46e5', '#059669', '#d97706', '#9333ea'];

function getNodeColor(node, isLight) {
  const grp = node.data('group') ?? 0;
  return isLight ? (colorsLight[grp] || colorsLight[0]) : (colorsDark[grp] || colorsDark[0]);
}

export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
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
            'background-color': (node) => getNodeColor(node, isLight),
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
      if (
        id.startsWith('/posts/') ||
        id.startsWith('/publications/') ||
        id.startsWith('/projects/') ||
        id.startsWith('/courses/') ||
        id.startsWith('/services/') ||
        id.startsWith('/tags/')
      ) {
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
      'border-color': isLight ? '#ffffff' : '#030712',
      'background-color': (node) => getNodeColor(node, isLight)
    }).update();

    if (layout === 'radial') {
      this.cy.layout({
        name: 'concentric',
        concentric: function(node) {
          return node.data('group') === 0 ? 2 : 1;
        },
        levelWidth: function() { return 1; },
        animate: true,
        animationDuration: 600
      }).run();
    } else if (layout === 'columns') {
      const width = this.cy.width();
      const height = this.cy.height();
      const nodes = this.cy.nodes();

      const posts = nodes.filter(n => n.data('group') === 1);
      const courses = nodes.filter(n => n.data('group') === 4);
      const tags = nodes.filter(n => n.data('group') === 0);
      const projects = nodes.filter(n => n.data('group') === 3);
      const services = nodes.filter(n => n.data('group') === 5);
      const publications = nodes.filter(n => n.data('group') === 2);

      const categories = [posts, courses, tags, projects, services, publications];
      const pos = {};
      const isMobile = width < 768 || window.innerWidth < 768;
      
      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx + 1) * (height / (categories.length + 1));
          catNodes.forEach((n, idx) => {
            pos[n.id()] = {
              x: (idx + 1) * (width / (catNodes.length + 1)),
              y: rowY
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx + 1) * (width / (categories.length + 1));
          catNodes.forEach((n, idx) => {
            pos[n.id()] = {
              x: colX,
              y: (idx + 1) * (height / (catNodes.length + 1))
            };
          });
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
