---
title: "OpenCASCADE Tools"
trl: 7
description: "Open-source TypeScript wrapper and CLI converting STEP and IGES CAD geometries into web-optimized 3D formats (GLTF, GLB, OBJ) via OpenCASCADE Technology and WebAssembly."
href: "https://github.com/ghackenberg/opencascade-tools"
repoName: "opencascade-tools"
accentColor: "blue"
order: 6
tags:
  - "cad"
  - "open-source"
  - "computer-graphics"
  - "webgl"
  - "threejs"
  - "typescript"
  - "web-development"
  - "software-architecture"
screenshot:
  src: "./preview.png"
  title: "OpenCASCADE Tools: Open-Source CAD Geometry Conversion Toolkit"
  description: "Showcase preview of opencascade-tools open-source repository and toolkit for WebGL and Three.js."
screenshots:
  - src: "./pipeline-architecture.png"
    title: "End-to-End Geometry Pipeline"
    description: "Four-stage dataflow covering CAD ingestion, OpenCASCADE Technology kernel processing, adaptive tessellation, and 3D web serialization."
  - src: "./cli-interface.png"
    title: "Command-Line Interface & Automated Meshing"
    description: "Terminal session demonstrating the opencascade-tools CLI converting industrial CAD files with custom linear and angular deflection tolerances."
  - src: "./api-usage.png"
    title: "TypeScript & Node.js / Browser API"
    description: "Code walkthrough showcasing dual-target execution across Node.js CLI scripts and in-browser Web Workers with Three.js compatibility."
pubDate: 2023-02-02
challenge: "Industrial CAD models are predominantly distributed in neutral boundary-representation (B-Rep) formats like STEP (ISO 10303-21) and IGES, which standard web browsers and 3D engines like Three.js cannot natively parse or render without heavy native desktop software or expensive cloud conversion pipelines."
solution: "An easy-to-use, dual-target TypeScript wrapper around OpenCASCADE Technology (OCCT) compiled to WebAssembly via OpenCascade.js. It enables fast, local tessellation and conversion of STEP and IGES assemblies into lightweight GLTF, GLB, and OBJ meshes directly in Node.js CLIs and in-browser Web Workers."
keyCapabilities:
  - title: "STEP & IGES CAD Ingestion"
    description: "Directly parses standard ISO 10303-21 STEP and legacy IGES files into hierarchical TDocStd_Document trees."
    icon: "📐"
  - title: "Adaptive BRep Meshing"
    description: "Configurable linear deflection (chordal error) and angular deflection parameters for fine-grained polygon budget control."
    icon: "⚙️"
  - title: "3D Web Format Export"
    description: "Serializes tessellated CAD assemblies into binary GLTF 2.0 (.glb), JSON GLTF, and Wavefront OBJ formats ready for WebGL."
    icon: "🌐"
  - title: "Dual Node.js & Browser Runtime"
    description: "Unified API callable via standalone CLI scripts or asynchronously inside browser Web Workers without server roundtrips."
    icon: "⚡"
techStackHighlights:
  - category: "CAD Kernel & Core Engine"
    technologies:
      - "Open CASCADE Technology (OCCT)"
      - "OpenCascade.js"
      - "WebAssembly (WASM)"
      - "B-Rep Geometry"
  - category: "Language & Tooling"
    technologies:
      - "TypeScript"
      - "Node.js"
      - "Commander.js"
      - "Figlet"
  - category: "3D Graphics & Serialization"
    technologies:
      - "Khronos GLTF 2.0 / GLB"
      - "Wavefront OBJ"
      - "Three.js Integration"
      - "WebGL"
outcomes:
  - "Powers the 3D model ingestion and STEP/FreeCAD meshing engine inside CADdrive (caddrive.org)."
  - "Over 22 GitHub stars and active npm distribution as a standalone open-source CLI and library."
  - "Enables zero-backend, client-side CAD model visualization for educational design platforms."
---
