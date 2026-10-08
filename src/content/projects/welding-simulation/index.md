---
title: "Welding Simulation"
trl: 4
description: "Interactive physics-based simulation and 3D visualization tool for thermal welding processes and automated weld seam geometry estimation."
href: "https://github.com/ghackenberg/welding-simulation"
tags: ["computer-graphics", "java", "manufacturing-engineering", "open-source", "simulation", "systems-engineering", "thermal-engineering"]
accentColor: "blue"
order: 6
repoName: "welding-simulation"
screenshot:
  src: "./screenshot.png"
  title: "Welding Simulation: 3D-Temperaturfeld & Schweißnaht-Geometrie"
  description: "Interaktive OpenGL-Visualisierung des räumlichen Temperaturfelds und der Schmelzbad-Isothermen mit orthogonalen 2D-Schnittansichten"
screenshots:
  - image: "./screenshot.png"
    title: "Welding Simulation Desktop Workspace"
    description: "Multi-dock Swing GUI showing 3D OpenGL thermal contours, orthogonal 2D heat cross-sections, and dynamic parameter tuning."
pubDate: 2024-07-31
challenge: "Predicting weld pool geometry (weld width and penetration depth) and transient heat-affected zones in arc welding traditionally requires either costly empirical trial-and-error experimentation or computationally prohibitive non-linear finite element method (FEM) simulations."
solution: "A lightweight, interactive Java engineering application combining analytical moving heat source models (extended Rosenthal solution with multi-source weaving discretization), fast numerical isotherm root-finding, and hardware-accelerated 3D OpenGL visualization."
keyCapabilities:
  - title: "Analytical Thermal Field Modeling"
    description: "Evaluates temperature distributions using moving point-heat formulations with parameterized welding speed, heat input, and thermal diffusivity."
    icon: "🔥"
  - title: "Torch Weaving Discretization"
    description: "Simulates oscillatory torch motion through distributed discrete point-source superposition across parameterized bead widths."
    icon: "〰️"
  - title: "Automated Isotherm Search"
    description: "Adaptive numerical root-finding that calculates maximum weld width and depth at critical liquidus/solidus melting boundaries."
    icon: "🎯"
  - title: "Interactive 3D OpenGL & Orthogonal 2D Views"
    description: "Real-time rendering of spatial thermal contours and orthogonal cross-sections (XY, XZ, YZ planes) with dynamic parameter sliders."
    icon: "🧊"
techStackHighlights:
  - category: "Core Platform & GUI"
    technologies:
      - "Java 23"
      - "JavaFX Properties & Bindings"
      - "Swing & Docking Frames"
  - category: "Thermal Physics & Mathematics"
    technologies:
      - "Rosenthal Heat Equation"
      - "Superposition & Weaving Discretization"
      - "Adaptive Root-Finding"
      - "Apache Commons Math"
  - category: "Visualization & Rendering"
    technologies:
      - "JogAmp JOGL (OpenGL 3D)"
      - "JFreeChart (2D Cross-Sections)"
outcomes:
  - "Instantaneous estimation of weld seam width and depth without expensive finite element computation."
  - "Interactive parameter exploration for heat input, torch velocity, and material properties with real-time visual feedback."
  - "Open-source research tool published on GitHub providing a modular architecture for welding process simulation."
---
