---
title: "Delta Dynamics"
tagline: "Ecosystem Simulator"
description: "Low-poly ecosystem simulator featuring real-time dynamic terrain, GPU-accelerated water flow, resource management, and local LLM-driven AI behaviors."
href: "https://dd.hackenberg.tech"
tags: ["agentic-ai", "artificial-intelligence", "gpgpu", "local-ai", "react", "shaders", "simulation", "threejs", "web-llm", "webgl"]
accentColor: "blue"
order: 3
repoName: "delta-dynamics"
screenshot:
  src: "./preview.jpg"
  title: "Delta Dynamics: Ökosystem-Topografie & GPU-Wasserlauf-Simulation"
  description: "Orthogonale Schautafel eines terrassierten Low-Poly-Geländeschnitts mit dynamischen Wasser-Fließvektoren, Wasserfall und autonomen Agenten-Wegpunkten"
screenshots:
  - image: "./screenshot1.png"
    title: "Ecosystem Simulation View"
    description: "Low-poly terrain visualization with active resource flows and LLM-driven AI agents."
  - image: "./screenshot2.png"
    title: "Terrain Editor UI"
    description: "Interactive tools to manipulate topography, water flow vectors, and simulation parameters."
challenge: "Simulating complex ecological dynamics in real time typically demands heavy server-side compute or native desktop runtimes, preventing accessible browser-based experimentation with coupled hydrology, vegetation growth, and cognitive agent behaviors."
solution: "A high-performance client-side simulation engine combining GPGPU shallow-water equations, procedural voxel terrain deformation, and in-browser local LLM inference via WebGPU and WebLLM for emergent agent reasoning."
keyCapabilities:
  - title: "GPGPU Hydraulic Simulation"
    description: "Real-time shallow-water equations computed directly in GPU fragment shaders for dynamic erosion, sediment transport, and river routing."
    icon: "🌊"
  - title: "Local LLM Agent Cognition"
    description: "Autonomous animal and plant species driven by in-browser neural reasoning (WebLLM/WebGPU) with zero cloud API latency or costs."
    icon: "🧠"
  - title: "Interactive Topography Sculpting"
    description: "Real-time terrain deformation, elevation carving, and biome seeding with dynamic cellular automata updating at 60 FPS."
    icon: "🏔️"
  - title: "Ecological Equilibrium Analytics"
    description: "Live telemetry dashboards tracking population curves, trophic cascades, moisture distribution, and resource biomass."
    icon: "📊"
techStackHighlights:
  - category: "Rendering & GPGPU"
    technologies:
      - "Three.js"
      - "WebGL / WebGPU"
      - "Custom GLSL Shaders"
      - "React"
  - category: "Simulation & Math"
    technologies:
      - "Shallow Water Equations"
      - "Cellular Automata"
      - "Perlin Noise"
      - "TypeScript"
  - category: "Edge AI & Intelligence"
    technologies:
      - "WebLLM"
      - "Llama 3 / Gemma Client-Side"
      - "Local Vector Memory"
outcomes:
  - "Fluid 60 FPS performance on consumer GPUs across 256x256 simulation grids."
  - "100% client-side execution with zero cloud inference fees or server hosting dependencies."
  - "Deterministic hydraulic dynamics with real-time erosion and pool accumulation."
  - "Autonomous agent lifecycle decision loops executing under 30ms per tick."
---
