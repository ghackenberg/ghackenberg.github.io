---
title: "Digital Factory & Simulation"
description: "Master-level course on Digital Factory and Computer Simulation (including practical exercises with the discrete event simulation software JaamSim)."
repoName: "course-digital-factory"
learningGoals:
  - "Understand discrete event simulation principles and concepts."
  - "Build practical layout models with the discrete event simulation software JaamSim."
  - "Analyze production bottlenecks, throughput, and resource utilization."
terms:
  - "Winter Term 2024/25"
  - "Winter Term 2025/26"
language: "en"
screenshot:
  src: "./preview.jpg"
  title: "Digital Factory: Discrete-Event Manufacturing Cell"
  description: "Orthogonal schematic of a modular manufacturing cell with input feeder conveyor, automated robotic processing station, and pallet buffer sorting gate"
tags:
  - "simulation"
  - "factory-layout"
  - "industrial-informatics"
  - "teaching"
overview: "In modern manufacturing, building physical prototypes to test layout variations is costly and slow. Discrete Event Simulation (DES) enables engineers to construct high-fidelity digital factory twins, optimize throughput, and validate complex material flow logistics before purchasing machinery."
targetAudience: "Master's students in Industrial Informatics, Mechatronics, and Software Engineering, as well as production automation practitioners."
prerequisites:
  - "Fundamental understanding of manufacturing processes and industrial workflows"
  - "Basic principles of probability, distributions, and queuing theory"
  - "Introductory programming or scripting experience"
competencies:
  - title: "Discrete Event Simulation"
    description: "Formulate event-driven time advance models and stochastic process queues."
    icon: "⏱️"
  - title: "Digital Twin Modeling"
    description: "Build parametric 3D factory cells and conveyor routing in JaamSim."
    icon: "🏭"
  - title: "Bottleneck & Flow Analysis"
    description: "Diagnose machine starvation, buffer blocking, and optimize overall equipment effectiveness."
    icon: "📊"
  - title: "Statistical Validation"
    description: "Design simulation experiments, run replications, and compute confidence intervals."
    icon: "📐"
syllabus:
  - moduleNumber: "01"
    title: "Foundations of Discrete Event Simulation"
    description: "Simulation paradigms, state transitions, event calendars, and time-advance mechanics."
    topics:
      - "Discrete vs. Continuous Simulation"
      - "Queuing Theory & Little's Law"
      - "Random Number Generation & Distributions"
    tools:
      - "JaamSim"
  - moduleNumber: "02"
    title: "JaamSim Essentials & Layout Construction"
    description: "Navigating the 3D canvas, assembling basic processing stations, and configuring object properties."
    topics:
      - "Generators, Servers, and Sinks"
      - "Conveyors & Routing Logic"
      - "3D Asset Import & Spatial Layout"
    tools:
      - "JaamSim"
  - moduleNumber: "03"
    title: "Advanced Flow Control & Assembly Logic"
    description: "Modeling assembly/disassembly lines, batch processing, and conditional routing scripts."
    topics:
      - "Entity Assembly & Packing"
      - "Thresholds & Resource Pools"
      - "Custom Route Scripting"
    tools:
      - "JaamSim Scripting"
  - moduleNumber: "04"
    title: "Maintenance, Failures & Downtime"
    description: "Incorporating stochastic machine failures, MTBF, MTTR, and maintenance shifts."
    topics:
      - "Mean Time Between Failures (MTBF)"
      - "Mean Time to Repair (MTTR)"
      - "Shift Schedules & Availability"
    tools:
      - "JaamSim Reliability Models"
  - moduleNumber: "05"
    title: "Simulation Analytics & Bottleneck Optimization"
    description: "Exporting event logs, analyzing utilization metrics, and proving statistical confidence."
    topics:
      - "Warm-up Period Determination"
      - "Confidence Intervals & Replications"
      - "Throughput Sensitivity Analysis"
    tools:
      - "Python"
      - "Pandas"
      - "Matplotlib"
---

