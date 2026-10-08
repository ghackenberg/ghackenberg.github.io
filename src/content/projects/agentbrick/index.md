---
title: "AgentBrick"
trl: 4
description: "Open-source framework translating natural language prompts into structured LDraw CAD models and voxel assemblies using LangChain agents and LangGraph workflows."
href: "https://github.com/ghackenberg/agentbrick"
repoName: "agentbrick"
accentColor: "blue"
order: 5
tags:
  - "agentic-ai"
  - "artificial-intelligence"
  - "cad"
  - "generative-ai"
  - "langgraph"
  - "open-source"
  - "product-design"
  - "python"
  - "software-architecture"
screenshot:
  src: "./voxel_model.png"
  title: "AgentBrick: Discrete 3D Voxel Model"
  description: "Volumetric coordinate discretization mapping conversational concepts into discrete voxel cells for physical brick placement."
screenshots:
  - src: "./voxel_model.png"
    title: "Discrete 3D Voxel Model"
    description: "Volumetric coordinate discretization mapping conversational concepts into discrete voxel cells for physical brick placement."
  - src: "./component_graph.png"
    title: "Component & Interface Graph"
    description: "Extracted topological graph of interconnected physical sub-assemblies and interface boundaries derived by LLM agents."
pubDate: 2026-02-06
challenge: "Generating valid 3D CAD assemblies and physical brick models directly from unconstrained natural language prompts is prone to hallucination, geometrical inconsistencies, and structural syntax violations inherent to discrete modeling standards like LDraw."
solution: "A multi-stage agentic CAD pipeline built with LangChain and LangGraph that systematically decomposes prompts into descriptive specifications, topological component graphs, and discrete voxel grids before synthesizing validated LDraw assemblies."
keyCapabilities:
  - title: "Conversational CAD Generation"
    description: "Translates high-level natural language prompts into syntactically valid and modular LDraw CAD models."
    icon: "💬"
  - title: "LangGraph State Machine"
    description: "Orchestrates multi-phase workflows with deterministic state transitions across description, topology, and voxel resolution."
    icon: "🔄"
  - title: "Topological Component Extraction"
    description: "Derives structural sub-assemblies and interface contact graphs to guarantee coherent mechanical connectivity."
    icon: "🕸️"
  - title: "Discrete Voxel Discretization"
    description: "Evaluates coordinate occupancy within configurable 3D bounding grids for precise brick mapping."
    icon: "🧱"
techStackHighlights:
  - category: "Agentic AI & Orchestration"
    technologies:
      - "LangGraph"
      - "LangChain"
      - "Pydantic"
      - "Llama 3.2"
  - category: "CAD & Spatial Representation"
    technologies:
      - "LDraw Standard"
      - "Discrete Voxel Grids"
      - "Component-Interface Graphs"
  - category: "Engineering & Quality"
    technologies:
      - "Python"
      - "Pyright Static Typing"
      - "Black Formatter"
outcomes:
  - "Functional open-source framework demonstrating end-to-end Chat-to-CAD synthesis for discrete brick models."
  - "Multi-agent architecture replacing unstructured LLM generation with validated topological and spatial intermediate states."
  - "Extensible modular repository with custom agent middlewares, state validation schemas, and reproducible workflow tests."
---
