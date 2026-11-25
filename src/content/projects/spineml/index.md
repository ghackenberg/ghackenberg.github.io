---
title: "SpineML: Factory Layout & Job Shop Optimization"
trl: 4
description: "A Python toolkit designed to optimize factory layout planning (FLP) and job shop scheduling (JSS) through advanced layout modeling and simulation."
tags: ["data-visualization", "factory-layout", "manufacturing-systems", "open-source", "optimization", "python", "scheduling", "simulation"]
accentColor: "blue"
order: 4
repoName: "spineml"
image:
  src: "./preview.jpg"
  title: "SpineML: 3D Factory Simulation with Salabim"
  description: "Discrete-event 3D animation showing gantry robot material transport, buffer stations, and machining cells."
screenshots:
  - src: "./salabim.png"
    title: "3D Discrete-Event Simulation"
    description: "Real-time 3D animation of gantry robots, machining stations, and buffer zones modeled in Salabim."
  - src: "./sample-layout.png"
    title: "Factory Layout Architecture"
    description: "Formal spine layout topology with central automated transport axis, machine cells, and input/output buffers."
  - src: "./sample-process.png"
    title: "Manufacturing Process Flow"
    description: "Process configuration model specifying product transformations, operations, and intermediate states."
  - src: "./networkx.png"
    title: "Configuration Model Graph"
    description: "NetworkX graph visualization displaying product types, manufacturing operations, and material dependencies."
  - src: "./pyplot.png"
    title: "Simulation Performance Metrics"
    description: "Matplotlib performance evaluation charting machine utilization, operational workloads, and queue statistics."
challenge: "Industrial factory layout planning (FLP) and job shop scheduling (JSS) are complex combinatorial problems with high coordination effort and planning overhead."
solution: "A Python-based toolkit for spine layout modeling, discrete-event simulation, and optimization of manufacturing systems and material transport."
keyCapabilities:
  - title: "Spine Layout Modeling"
    description: "Formal modeling of factory architectures with a central transport spine and perpendicular side ribs."
    icon: "🦴"
  - title: "Discrete-Event Simulation"
    description: "Performance evaluation of material flow, robot transport corridors, and machine buffer stations."
    icon: "⏱️"
  - title: "Bottleneck Optimization"
    description: "Algorithmic derivation of optimal job routing, scheduling strategies, and machine utilization."
    icon: "📊"
  - title: "Modular Python Toolkit"
    description: "Extensible open-source architecture allowing rapid exploration of factory layout design spaces."
    icon: "🐍"
techStackHighlights:
  - category: "Core Language & Modeling"
    technologies:
      - "Python"
      - "Spine Layout Architecture"
      - "Domain Modeling"
  - category: "Simulation & Operations"
    technologies:
      - "Discrete-Event Simulation"
      - "Material Flow Analysis"
      - "Job Shop Scheduling"
outcomes:
  - "Presented and published at the CIRP Conference on Manufacturing Systems (CIRP-CMS 2025)."
  - "Open-source Python toolkit available on GitHub (github.com/ghackenberg/SpineML)."
  - "Proven methodology for optimizing machine utilization and factory logistics throughput."
---

## Research Grounding & Course Integration

**SpineML** formalizes spine-based factory layout planning (FLP) and job shop scheduling (JSS) around a central automated material transport axis paired with modular machining ribs. Using discrete-event simulation in Salabim, NetworkX dependency graphs, and Matplotlib utilization analytics, engineers can evaluate buffer capacities, gantry travel times, and throughput bottlenecks prior to shop-floor commissioning.

The formal spine modeling methodology and empirical scheduling results are published in our [Procedia CIRP 2025 paper](/publications/2025_01_01_procedia_cirp/). Hands-on discrete-event factory modeling exercises and bottleneck optimization labs built for graduate students are available in our open [Digital Factory Simulation & JaamSim Labs course](/courses/course-digital-factory/).
