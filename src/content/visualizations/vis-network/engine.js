export default {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container, payload, layout, isLight, extraOptions = {}) {
    const vis = await import('https://unpkg.com/vis-network@9.1.9/standalone/esm/index.js');
    this.vis = vis;

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
      { // 3: Project (Green)
        background: isLight ? '#059669' : '#10b981', 
        border: isLight ? '#047857' : '#34d399', 
        highlight: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' },
        hover: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' }
      },
      { // 4: Course (Yellow)
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' },
        hover: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' }
      },
      { // 5: Service (Purple)
        background: isLight ? '#9333ea' : '#a855f7', 
        border: isLight ? '#7e22ce' : '#c084fc', 
        highlight: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' },
        hover: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' }
      }
    ];

    const groupNames = ['Tag', 'Post', 'Publication', 'Project', 'Course', 'Service'];
    const groupColors = [
      isLight ? '#0284c7' : '#38bdf8', // 0: Tag (sky)
      isLight ? '#2563eb' : '#60a5fa', // 1: Post (blue)
      isLight ? '#4f46e5' : '#818cf8', // 2: Publication (indigo)
      isLight ? '#059669' : '#34d399', // 3: Project (green)
      isLight ? '#b45309' : '#fbbf24', // 4: Course (yellow)
      isLight ? '#7e22ce' : '#c084fc'  // 5: Service (purple)
    ];

    // Initialize with randomized coordinates. Avoid Vis.js native group styling issues by omitting group
    // property and explicitly defining color object on each node.
    this.visNodes = new vis.DataSet(this.nodes.map(n => {
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
            ${n.tags.map(t => `<span style="font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: ${groupColors[0]};">#${t}</span>`).join('')}
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
          node: (values, _id, selected, hovering) => {
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

    this.visEdges = new vis.DataSet(this.connections.map(c => ({
      from: c.sourceId,
      to: c.targetId,
      color: {
        color: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255,255,255,0.15)',
        highlight: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255,255,255,0.35)'
      }
    })));

    const data = {
      nodes: this.visNodes,
      edges: this.visEdges
    };

    const interactionOptions = Object.assign({
      hover: true,
      hoverConnectedEdges: false,
      tooltipDelay: 100,
      zoomView: true,
      dragView: true,
      dragNodes: true
    }, extraOptions && extraOptions.interaction ? extraOptions.interaction : {});

    const utmSource = (extraOptions && extraOptions.utmSource) || 'vis_network';
    const utmMedium = (extraOptions && extraOptions.utmMedium) || 'interactive_graph';
    const utmCampaign = (extraOptions && extraOptions.utmCampaign) || 'knowledge_network';

    this.options = {
      nodes: {
        shape: 'dot',
        chosen: {
          node: (values, _id, selected, hovering) => {
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

    this.network = new vis.Network(container, data, this.options);

    if (interactionOptions.dragView === false) {
      container.style.touchAction = 'pan-y';
      const canvasEl = container.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'pan-y';
      }
      const visWrapper = container.querySelector('.vis-network');
      if (visWrapper) {
        visWrapper.style.touchAction = 'pan-y';
      }
    }

    await new Promise((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          resolve();
        }
      };
      this.network.once("stabilizationIterationsDone", finish);
      this.network.once("stabilized", finish);
      setTimeout(finish, 1500);
    });

    this.network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const targetPath = params.nodes[0];
        if (
          targetPath.startsWith('/posts') ||
          targetPath.startsWith('/publications') ||
          targetPath.startsWith('/projects') ||
          targetPath.startsWith('/courses') ||
          targetPath.startsWith('/services') ||
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
      { // 3: Project (Green)
        background: isLight ? '#059669' : '#10b981', 
        border: isLight ? '#047857' : '#34d399', 
        highlight: { background: isLight ? '#065f46' : '#059669', border: isLight ? '#059669' : '#6ee7b7' } 
      },
      { // 4: Course (Yellow)
        background: isLight ? '#d97706' : '#f59e0b', 
        border: isLight ? '#b45309' : '#fbbf24', 
        highlight: { background: isLight ? '#92400e' : '#d97706', border: isLight ? '#b45309' : '#fde68a' } 
      },
      { // 5: Service (Purple)
        background: isLight ? '#9333ea' : '#a855f7', 
        border: isLight ? '#7e22ce' : '#c084fc', 
        highlight: { background: isLight ? '#6b21a8' : '#9333ea', border: isLight ? '#7e22ce' : '#e9d5ff' } 
      }
    ];

    // Batch node styling updates (colors & fonts)
    const nodeUpdates = [];
    this.visNodes.forEach(node => {
      nodeUpdates.push({
        id: node.id,
        color: colors[node.rawGroup] || colors[0],
        font: {
          color: isLight ? '#0f172a' : '#f8fafc',
          strokeColor: isLight ? '#ffffff' : '#0f172a'
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
          color: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255,255,255,0.15)',
          highlight: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255,255,255,0.35)'
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
      const projects = this.nodes.filter(n => n.group === 3);
      const courses = this.nodes.filter(n => n.group === 4);
      const services = this.nodes.filter(n => n.group === 5);

      const isMobile = window.innerWidth < 768;
      const heightFactor = 45;
      const widthFactor = 45;

      if (isMobile) {
        posts.forEach((n, idx) => {
          targets[n.id] = {
            x: posts.length > 1 ? (idx - (posts.length - 1) / 2) * widthFactor : 0,
            y: -350
          };
        });

        courses.forEach((n, idx) => {
          targets[n.id] = {
            x: courses.length > 1 ? (idx - (courses.length - 1) / 2) * widthFactor : 0,
            y: -210
          };
        });

        tags.forEach((n, idx) => {
          targets[n.id] = {
            x: tags.length > 1 ? (idx - (tags.length - 1) / 2) * widthFactor : 0,
            y: -70
          };
        });

        projects.forEach((n, idx) => {
          targets[n.id] = {
            x: projects.length > 1 ? (idx - (projects.length - 1) / 2) * widthFactor : 0,
            y: 70
          };
        });

        services.forEach((n, idx) => {
          targets[n.id] = {
            x: services.length > 1 ? (idx - (services.length - 1) / 2) * widthFactor : 0,
            y: 210
          };
        });

        publications.forEach((n, idx) => {
          targets[n.id] = {
            x: publications.length > 1 ? (idx - (publications.length - 1) / 2) * widthFactor : 0,
            y: 350
          };
        });
      } else {
        posts.forEach((n, idx) => {
          targets[n.id] = {
            x: -500,
            y: posts.length > 1 ? (idx - (posts.length - 1) / 2) * heightFactor : 0
          };
        });

        courses.forEach((n, idx) => {
          targets[n.id] = {
            x: -300,
            y: courses.length > 1 ? (idx - (courses.length - 1) / 2) * heightFactor : 0
          };
        });

        tags.forEach((n, idx) => {
          targets[n.id] = {
            x: -100,
            y: tags.length > 1 ? (idx - (tags.length - 1) / 2) * heightFactor : 0
          };
        });

        projects.forEach((n, idx) => {
          targets[n.id] = {
            x: 100,
            y: projects.length > 1 ? (idx - (projects.length - 1) / 2) * heightFactor : 0
          };
        });

        services.forEach((n, idx) => {
          targets[n.id] = {
            x: 300,
            y: services.length > 1 ? (idx - (services.length - 1) / 2) * heightFactor : 0
          };
        });

        publications.forEach((n, idx) => {
          targets[n.id] = {
            x: 500,
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
