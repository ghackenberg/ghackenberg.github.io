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
  description: "Farbenfrohes 3D-Relief-Diorama eines Flussdeltas mit lebendigen Biomen, GPU-Wasserströmungsbahnen und autonomen Sensorstationen"
screenshots:
  - image: "./screenshot1.png"
    title: "Ecosystem Simulation View"
    description: "Low-poly terrain visualization with active resource flows and LLM-driven AI agents."
  - image: "./screenshot2.png"
    title: "Terrain Editor UI"
    description: "Interactive tools to manipulate topography, water flow vectors, and simulation parameters."
challenge: "Real-time ecosystem simulation with fluid mechanics and autonomous entity behavior typically requires native desktop engines or heavy server infrastructure."
solution: "A lightweight client-side ecosystem simulator in React and Three.js running GPGPU shallow-water equations in custom shaders and local LLM agents in-browser via Web-LLM."
keyCapabilities:
  - title: "GPGPU Water Simulation"
    description: "Real-time shallow-water equations evaluated via ping-pong framebuffers in GLSL fragment shaders with CFL stability clamping."
    icon: "🌊"
  - title: "Local AI Agents"
    description: "On-device entity reasoning powered by Web-LLM directly in the browser without server API calls."
    icon: "🧠"
  - title: "Low-Poly Topography"
    description: "Interactive terrain sculpting and dynamic moisture routing in an isometric 3D landscape."
    icon: "🏔️"
  - title: "Resource Ecosystem"
    description: "Dynamic interaction between water levels, vegetation growth, and autonomous agent life cycles."
    icon: "🌱"
techStackHighlights:
  - category: "Graphics & Simulation"
    technologies:
      - "React"
      - "Three.js"
      - "WebGL / WebGPU"
      - "Custom GLSL Shaders"
  - category: "Hydrology Model"
    technologies:
      - "Shallow Water Equations"
      - "CFL Flux Clamping"
      - "Ping-Pong Framebuffers"
  - category: "Client-Side AI"
    technologies:
      - "Web-LLM"
      - "In-Browser Inference"
      - "TypeScript"
outcomes:
  - "Real-time 60 FPS water flow simulation computed entirely on the GPU."
  - "100% client-side execution with zero backend infrastructure requirements."
  - "In-browser local LLM integration enabling autonomous agent behavior."
---
