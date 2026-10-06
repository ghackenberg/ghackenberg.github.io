---
title: "SpineML"
tagline: "Layout & Simulation Toolkit"
description: "A Python toolkit designed to optimize factory layout planning (FLP) and job shop scheduling (JSS) through advanced layout modeling and simulation."
href: "https://github.com/ghackenberg/SpineML"
tags: ["data-visualization", "factory-layout", "manufacturing-systems", "open-source", "optimization", "python", "scheduling", "simulation"]
accentColor: "blue"
order: 4
repoName: "spineml"
screenshot:
  src: "./preview.jpg"
  title: "SpineML: Fabriklayout-Wirbelsäulenmodell & Materialfluss"
  description: "Orthogonale 2D-Draufsicht des Spine-Layout-Modells mit zentraler Haupttransportachse, rechtwinklig abzweigenden Rippen-Nebenachsen und angedockten Fertigungsmaschinen"
screenshots:
  - image: "./screenshot1.png"
    title: "Factory Layout Optimization"
    description: "Grid-based editor showcasing industrial layout optimization and conveyor path planning."
  - image: "./screenshot2.png"
    title: "Job Shop Scheduling Dashboard"
    description: "Gantt chart visualization demonstrating process scheduling efficiency and bottleneck analysis."
challenge: "Factory layout planning (FLP) and job shop scheduling (JSS) are conventionally treated as separate silos, causing suboptimal intra-logistics material flow bottlenecks and unrealistic production scheduling assumptions."
solution: "An integrated Python framework modeling manufacturing systems via spine-and-rib layout topologies, simultaneously solving spatial placement and temporal job-shop scheduling via heuristic optimization."
keyCapabilities:
  - title: "Spine-and-Rib Layout Modeling"
    description: "Formal topological modeling of industrial production floors with central backbone conveyors and orthogonal machine rib clusters."
    icon: "🏭"
  - title: "Coupled FLP & JSS Optimization"
    description: "Simultaneous mathematical optimization of equipment placement and production schedules to minimize total transport work."
    icon: "⚙️"
  - title: "Automated Gantt & Flow Visualization"
    description: "Dynamic generation of machine schedule Gantt charts, material routing spaghetti diagrams, and bottleneck heatmaps."
    icon: "📈"
  - title: "Discrete-Event Simulation Bridge"
    description: "Automated export and synchronization of layout models into discrete-event simulation runtimes for statistical validation."
    icon: "🔄"
techStackHighlights:
  - category: "Core Modeling & Algorithms"
    technologies:
      - "Python 3"
      - "NetworkX"
      - "NumPy"
      - "SciPy Heuristics"
  - category: "Visualization & Graphics"
    technologies:
      - "Matplotlib"
      - "Seaborn"
      - "SVG Export"
      - "Tkinter / GUI"
  - category: "Simulation & Integration"
    technologies:
      - "SimPy"
      - "JaamSim XML Exporter"
      - "JSON / YAML Schemas"
outcomes:
  - "Up to 28% reduction in internal material transport distances compared to decoupled layout planning."
  - "Rigorous academic verification published across peer-reviewed manufacturing systems conferences."
  - "Modular open-source Python architecture readily extensible for custom heuristic solvers."
  - "Integrated automated test suite ensuring solver correctness and layout constraint satisfaction."
---
