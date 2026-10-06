---
title: "CADdrive"
tagline: "Product Design Platform"
description: "CADdrive is a web-based, collaborative product design platform for schools and universities, lowering the learning curve for CAD and team engineering."
href: "https://caddrive.org"
tags: ["cad", "collaborative-software", "education", "open-source", "product-design", "systems-engineering", "web-development"]
accentColor: "blue"
order: 1
repoName: "caddrive"
screenshot:
  src: "./preview.jpg"
  title: "CADdrive: Kollaboratives Web-CAD & Versionsgraph"
  description: "Orthogonale Schautafel der CADdrive-Web-App mit kollaborativem 3D-CAD-Modell, Bemaßungs- und Kommentar-Annotationen sowie integriertem Versionsgraphen mit Branching und Merging"
screenshots:
  - image: "./screenshot1.png"
    title: "CADdrive Home Page"
    description: "Welcome screen of the web-based collaborative CAD platform."
  - image: "./screenshot2.png"
    title: "Interactive CAD Overview"
    description: "Detailed description of school and university collaborative project tools."
challenge: "Traditional desktop CAD software requires expensive workstation hardware, proprietary licensing, and cumbersome file exchanges, creating high barriers to entry for engineering education and collaborative student design projects."
solution: "A lightweight, browser-native CAD and product design platform featuring real-time multiplayer editing, cloud geometry evaluation, intuitive dimensioning tools, and a Git-style branching and merging version graph."
keyCapabilities:
  - title: "Multiplayer 3D Collaboration"
    description: "Simultaneous browser-based modeling with real-time cursor tracking, component locking, and synchronized viewpoint inspection."
    icon: "👥"
  - title: "Git-Style Version Graph"
    description: "Non-destructive design exploration with visual branching, merge dispute resolution, and complete revision provenance."
    icon: "🌿"
  - title: "Intuitive Parametric Modeling"
    description: "Direct sketch constraints, extrusion, boolean operations, and automated engineering drawings accessible without CAD expertise."
    icon: "📐"
  - title: "Educational Team Workspaces"
    description: "Role-based classroom management, assignment templating, inline design reviews, and contextual rubric grading."
    icon: "🎓"
techStackHighlights:
  - category: "Frontend & 3D Rendering"
    technologies:
      - "TypeScript"
      - "WebGL"
      - "Three.js"
      - "Tailwind CSS"
  - category: "Backend & Synchronization"
    technologies:
      - "Node.js"
      - "WebSockets"
      - "CRDTs"
      - "Docker"
  - category: "Geometry Engine & Storage"
    technologies:
      - "WebAssembly"
      - "PostgreSQL"
      - "MinIO / S3"
outcomes:
  - "Over 1,000 students onboarded across university and secondary school engineering curricula."
  - "Zero local installation footprint running smoothly on Chromebooks and low-spec laptops."
  - "Sub-50ms peer-to-peer latency during concurrent multi-user editing sessions."
  - "Open-source codebase empowering educators to customize modules and exercise templates."
---
