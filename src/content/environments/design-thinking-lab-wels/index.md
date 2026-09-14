---
name: "Design Thinking Lab Campus Wels"
category: "Innovation Lab & Workshop Space"
canonicalPrompt: "A modern, creative Design Thinking Lab on the 3rd floor at the University of Applied Sciences Upper Austria (FH OÖ Campus Wels, Stelzhamerstraße 23). A spacious innovation workshop interior features modular high-top solid timber workshop tables surrounded by colorful modern ergonomic workshop stools. Mobile rolling magnetic whiteboards filled with hand-drawn technical system diagrams, flowcharts, and organized colorful sticky notes. Wall-mounted interactive digital presentation screens. Large 3rd-floor windows reveal an elevated view over the red-tile rooftops of Wels with a prominent historic church tower. Modern ceiling track lights. Disney/Pixar comic-book vector illustration style, crisp ink line art, bold cel shading, dark slate foundation (#030712) with subtle ambient brand blue (#3b82f6) and purple (#a855f7) accents."
referenceImage: "./reference.jpg"
dna:
  architecture: "3rd-floor Innovation Workshop & Collaboration Space at FH OÖ Campus Wels, Stelzhamerstraße 23"
  materials:
    walls: "Smooth contemporary light grey studio walls with magnetic mounting tracks"
    ceiling: "Open industrial ceiling with matte black track spotlights and suspended cable trays"
    flooring: "Polished light grey concrete studio flooring with subtle brand color zoning"
  lighting: "Crisp directional LED track spotlights combined with bright elevated daylight from 3rd-floor windows"
  palette:
    - "#3b82f6"
    - "#a855f7"
    - "#030712"
  view: "Elevated 3rd-floor windows revealing historic red-tiled rooftops of Wels and the prominent historic church tower"
variants:
  - name: "full-lab"
    shotType: "wide-angle"
    cameraAngle: "Wide eye-level perspective from the corner showing high-top timber tables, colorful stools, and mobile whiteboards"
    focalTarget: "Entire innovation workshop space"
    visibleObjects: []
    image: "./reference.jpg"
    promptSnippet: "Interior view of the Design Thinking Lab on the 3rd floor at FH OÖ Campus Wels with modular high-top tables, colorful stools, mobile whiteboards, digital presentation displays, and windows showing the historic church tower and rooftops of Wels."
    characterSlots:
      - id: "workshop-facilitator"
        role: "Facilitator / Professor"
        priority: 1
        required: false
        spatialPlacement: "Center-left midground, standing actively beside mobile rolling whiteboard"
        allowedPoses:
          - "standing"
          - "standing-gesturing"
        prohibitedPoses:
          - "seated"
        defaultAction: "Holding whiteboard marker or sticky notes, facilitating workshop"
        cutline: "Standing full figure with grounded posture"
      - id: "table-participant-left"
        role: "Workshop Participant / Student"
        priority: 2
        required: false
        spatialPlacement: "Left midground, perched on colorful ergonomic workshop stool at timber high-top table"
        allowedPoses:
          - "seated"
          - "perched-on-stool"
        prohibitedPoses:
          - "lying"
        defaultAction: "Taking notes or collaborating on table surface"
        cutline: "Perched medium or full figure"
      - id: "table-participant-right"
        role: "Workshop Participant / Innovator"
        priority: 3
        required: false
        spatialPlacement: "Right midground, standing or perched at second high-top workshop table"
        allowedPoses:
          - "standing"
          - "perched-on-stool"
        prohibitedPoses:
          - "lying"
        defaultAction: "Engaged in discussion or examining prototyping materials"
        cutline: "Medium or full figure"
  - name: "beamer-screen-focus"
    shotType: "eye-level"
    cameraAngle: "Direct eye-level perspective focused tightly on the presentation projection wall"
    focalTarget: "Large motorized projection beamer screen"
    visibleObjects: []
    depthLayers:
      foreground: "Clean presentation stage area with edge of wooden sideboard and floor marker line"
      midground: "Massive blank white motorized projection beamer screen filling the frame with a soft even glow"
      background: "Light grey studio wall framed by potted monstera plant and modern black track lighting above"
    image: "./beamer-screen-focus.jpg"
    promptSnippet: "Close, direct eye-level perspective inside the Design Thinking Lab on the 3rd floor at FH OÖ Campus Wels, tightly focused on the presentation wall. The large, clean, blank white motorized projection beamer screen dominates and fills the vast majority of the frame, brightly illuminated with a soft, even glow, providing an expansive canvas for slides. The surrounding wall is pleasant light grey, with potted monstera leaves on the left, modern ceiling spotlights above, and a neat wooden sideboard below."
    characterSlots:
      - id: "stage-keynote-presenter"
        role: "Lead Presenter / Keynote Speaker"
        priority: 1
        required: false
        spatialPlacement: "Left third of the stage foreground, standing clearly beside the beamer projection screen"
        allowedPoses:
          - "standing"
          - "standing-presenting"
          - "standing-gesturing-to-screen"
        prohibitedPoses:
          - "seated"
        defaultAction: "Holding remote clicker or gesturing towards projection screen, body turned three-quarters toward audience, beamer screen completely unobstructed"
        cutline: "Standing medium shot or full figure with feet clearly on stage floor"
      - id: "stage-co-presenter"
        role: "Co-Presenter / Panel Moderator"
        priority: 2
        required: false
        spatialPlacement: "Right third of the stage foreground, standing symmetrically on opposite side of screen"
        allowedPoses:
          - "standing"
          - "standing-listening"
          - "standing-presenting"
        prohibitedPoses:
          - "seated"
        defaultAction: "Standing attentively, engaging with audience and presentation"
        cutline: "Standing medium shot or full figure"
characters:
  - "georg"
objects: []
tags:
  - "wels"
  - "campus"
  - "fh-ooe"
  - "lab"
  - "workshop"
  - "design-thinking"
---


# Design Thinking Lab Campus Wels

This is the creative innovation workshop and customer collaboration environment at the University of Applied Sciences Upper Austria, School of Engineering, Wels (Stelzhamerstraße 23, 3rd Floor).

## Key Features
- **Workshop Layout**: Mobile high-top timber tables with colorful ergonomic standing/sitting stools.
- **Ideation Boards**: Rolling magnetic whiteboards with system architecture flows, design thinking diagrams, and structured color-coded sticky notes.
- **Presentation Wall**: Motorized large-format beamer projection screen on a clean light grey wall, framed by indoor plants and studio lighting.
- **Interactive Tech**: Wall-mounted interactive digital presentation displays for software architectures and system blueprints.
- **Urban Skyline**: 3rd-floor windows looking out over the historic city rooftops and church tower of Wels.
