---
name: "Campus Office Wels"
category: "Academic Office"
canonicalPrompt: "A university professor's academic office at the University of Applied Sciences Upper Austria (FH OÖ Campus Wels, Stelzhamerstraße 23). A professional workstation desk holds a laptop on a dock connected to a large 16:10 monitor with an integrated soundbar underneath. Next to the desk is a round visitor consultation table with modern chairs. Along the wall stands a large lockable shelving cabinet filled with academic textbooks, binders, and journals. A single whiteboard with equations and diagrams hangs on the wall. A large window overlooks urban city backyards and brick buildings. Potted indoor plants sit on the windowsill. Disney/Pixar comic-book illustration style, crisp ink line art, clean cel shading."
referenceImage: "./reference.png"
dna:
  architecture: "Academic engineering office at University of Applied Sciences Upper Austria (FH OÖ Campus Wels, Stelzhamerstraße 23)"
  materials:
    walls: "Smooth light cream painted office drywall with silver baseboard trim"
    ceiling: "White acoustic modular office ceiling with embedded flat daylight panel lights"
    flooring: "Warm natural oak plank flooring with an understated geometric office rug"
  lighting: "Bright diffused natural daylight pouring through the double-hung urban window combined with neutral office task lighting"
  palette:
    - "#3b82f6"
    - "#f59e0b"
    - "#030712"
  view: "Double window looking out onto historic brick urban facades, red tiled backyards, and city rooftops of Wels"
variants:
  - name: "full-office"
    shotType: "wide-angle"
    cameraAngle: "Wide eye-level perspective showing the full office layout from the doorway"
    focalTarget: "Entire academic professor office"
    visibleObjects: []
    image: "./reference.png"
    promptSnippet: "Academic office view at FH OÖ Campus Wels showing lockable book cabinets, consultation table, laptop dock with 16:10 monitor and soundbar, single whiteboard, and window overlooking city backyards."
    characterSlots:
      - id: "workstation-seat"
        role: "Professor / Primary Operator"
        priority: 1
        required: false
        spatialPlacement: "Center-right midground, seated in the black ergonomic mesh chair at the main desk"
        allowedPoses:
          - "seated"
          - "seated-working"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated at desk working or consulting"
        cutline: "Seated full figure"
      - id: "consultation-host-seat"
        role: "Host / Professor"
        priority: 2
        required: false
        spatialPlacement: "Center-left midground, seated at the round consultation table facing right"
        allowedPoses:
          - "seated"
          - "seated-conversing"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated in armchair at meeting table in discussion"
        cutline: "Seated full figure"
      - id: "consultation-guest-seat"
        role: "Student / Visiting Colleague"
        priority: 3
        required: false
        spatialPlacement: "Far-left midground, seated opposite host at consultation table"
        allowedPoses:
          - "seated"
          - "seated-conversing"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated in visitor armchair in consultation"
        cutline: "Seated full figure"
  - name: "visitor-table-focus"
    shotType: "close-up"
    cameraAngle: "Elevated high-angle perspective looking down on the consultation table"
    focalTarget: "Round wooden visitor meeting table"
    visibleObjects: []
    image: "./visitor-table-focus.jpg"
    promptSnippet: "Close, elevated high-angle perspective tightly focused on the intimate two-person round wooden consultation table at FH OÖ Campus Wels, with clean tabletop surface filling the frame, two modern armchairs, and warm sunny indoor lighting."
    characterSlots:
      - id: "consultation-host-seat"
        role: "Professor / Host"
        priority: 1
        required: false
        spatialPlacement: "Right side of the round table, seated comfortably in modern armchair"
        allowedPoses:
          - "seated"
          - "seated-conversing"
          - "seated-gesturing-to-table"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated at meeting table with notebook or cup, engaged in consultation"
        cutline: "High-angle seated medium shot from waist up"
      - id: "consultation-guest-seat"
        role: "Visiting Colleague / Student"
        priority: 2
        required: false
        spatialPlacement: "Left side of the round table, seated opposite in modern armchair"
        allowedPoses:
          - "seated"
          - "seated-conversing"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated at table taking notes or conversing"
        cutline: "High-angle seated medium shot from waist up"
  - name: "workplace-focus"
    shotType: "three-quarters"
    cameraAngle: "Dynamic three-quarters eye-level perspective facing directly towards the front display screen of the 16:10 monitor"
    focalTarget: "16:10 monitor with integrated soundbar on professor's desk"
    visibleObjects: []
    depthLayers:
      foreground: "Desk front with engraved DR. GEORG HACKENBERG nameplate, FH OÖ ceramic mug, and black keyboard"
      midground: "Large 16:10 monitor with soundbar underneath, glowing blank screen, laptop on stand, and black mesh chair"
      background: "Whiteboard with mathematical formulas, glass-door academic bookcase with binders, and sunny window with potted plants"
    image: "./workplace-focus.jpg"
    promptSnippet: "Three-quarters eye-level perspective inside the academic office at FH OÖ Campus Wels focused closely on the workstation desk. A large 16:10 monitor with integrated soundbar underneath is angled towards the viewer with a clean blank screen, alongside a closed laptop on stand, FH OÖ mug, Dr. Georg Hackenberg nameplate, ergonomic black mesh chair, with the formula whiteboard, bookcase, and sunny window in the background."
    characterSlots:
      - id: "workstation-operator"
        role: "Professor / Software Architect"
        priority: 1
        required: false
        spatialPlacement: "Center midground, seated directly in the ergonomic black mesh chair at the workstation desk"
        allowedPoses:
          - "seated"
          - "seated-turning-to-camera"
          - "seated-working"
        prohibitedPoses:
          - "standing"
          - "walking"
        defaultAction: "One hand on desk near keyboard or notebook, turning engagingly three-quarters toward viewer"
        cutline: "Three-quarters medium shot or seated full figure with legs naturally under desk"
characters:
  - "georg"
objects: []
tags:
  - "wels"
  - "campus"
  - "fh-ooe"
  - "academic"
  - "office"
---


# Campus Office Wels

This is Dr. Georg Hackenberg's university office at the University of Applied Sciences Upper Austria, School of Engineering, Wels (Stelzhamerstraße 23).

## Key Features
- **Workstation Focus**: Direct front-facing perspective tightly zoomed onto the professor's desk, 16:10 monitor with soundbar, laptop dock, and whiteboard.
- **Consultation Area**: Round visitor meeting table with comfortable chairs for student coaching and project discussions.
- **Academic Storage**: Tall lockable office cabinet with glass upper doors for textbooks, theses, binders, and research publications.
- **Urban View**: Large window looking out onto brick city backyards of Wels.
