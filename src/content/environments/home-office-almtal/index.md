---
name: "Home Office Grünau im Almtal"
category: "Workspace"
canonicalPrompt: "A cozy modern home office inside a contemporary timber house (Wolf Haus) in Grünau im Almtal, Upper Austria. Natural horizontal pine timber plank walls and ceiling with recessed spotlights, warm wooden flooring with a woven rug. On the left timber wall hangs a large framed modern abstract art painting above an electric height-adjustable standing desk. The desk holds a mini PC, a curved ultra-wide monitor, black keyboard, mouse, a small potted succulent, and an ALMTAL coffee mug, paired with a modern grey ergonomic swivel chair. Centered on the back timber wall is a large horizontal magnetic whiteboard with a silver aluminum frame. On the right, a massive floor-to-ceiling panoramic picture window frames a breathtaking alpine landscape with snow-capped mountain peaks, pine forests, the winding Alm river, and valley meadows, with an elliptical cross-trainer and lush potted indoor plants beside it. Modern Disney/Pixar comic-book illustration style, crisp ink linework, vibrant colors, warm cel shading."
referenceImage: "./reference.jpg"
dna:
  architecture: "Wolf Haus contemporary timber architecture"
  materials:
    walls: "Warm horizontal pine timber planks with subtle dark woodgrain ink lines"
    ceiling: "Pine timber ceiling with warm recessed LED spotlights"
    flooring: "Natural light oak floorboards covered by a light woven textile rug"
  lighting: "Warm ambient recessed spotlights paired with bright natural alpine daylight pouring from the panoramic window"
  palette:
    - "#f59e0b"
    - "#10b981"
    - "#3b82f6"
    - "#030712"
  view: "Floor-to-ceiling panoramic picture window looking out onto snow-capped alpine peaks, dense pine forests, the turquoise Alm river, and valley meadows"
variants:
  - name: "full-room"
    shotType: "wide-angle"
    cameraAngle: "Wide eye-level perspective from the entrance corner capturing the entire room"
    focalTarget: "Entire home office interior"
    visibleObjects:
      - "almtal-abstract-painting"
    image: "./reference.jpg"
    promptSnippet: "Interior view of the Grünau im Almtal timber home office with large floor-to-ceiling mountain panorama window, standing desk with curved ultra-wide monitor, framed art on the left, centered magnetic whiteboard on the pine back wall, and elliptical cross-trainer."
    characterSlots:
      - id: "workstation-seat"
        role: "Primary Operator / Author"
        priority: 1
        required: false
        spatialPlacement: "Center-left midground, seated in the grey ergonomic swivel chair at the standing desk"
        allowedPoses:
          - "seated"
          - "seated-turning-to-camera"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated at desk working on keyboard or turning towards camera"
        cutline: "Seated full figure with legs naturally under desk"
      - id: "panoramic-window-stand"
        role: "Collaborator / Observer"
        priority: 2
        required: false
        spatialPlacement: "Right midground, standing beside the floor-to-ceiling panoramic alpine window"
        allowedPoses:
          - "standing"
          - "standing-looking-at-view"
        prohibitedPoses:
          - "seated"
        defaultAction: "Standing naturally near the window looking out at mountain panorama or conversing with workstation operator"
        cutline: "Standing full figure with grounded feet on oak floorboards"
  - name: "whiteboard-focus"
    shotType: "eye-level"
    cameraAngle: "Direct perpendicular eye-level perspective focused on the rear pine wall"
    focalTarget: "Centered magnetic whiteboard"
    visibleObjects: []
    image: "./whiteboard-focus.jpg"
    promptSnippet: "Direct eye-level perspective inside the Grünau im Almtal timber office focused closely on the large centered magnetic whiteboard on the pine wall, leaving the whiteboard area unobstructed for schematics."
    characterSlots:
      - id: "whiteboard-presenter"
        role: "Architecture Presenter"
        priority: 1
        required: false
        spatialPlacement: "Left or right third of frame, standing beside the magnetic whiteboard"
        allowedPoses:
          - "standing"
          - "standing-gesturing"
        prohibitedPoses:
          - "seated"
        defaultAction: "Whiteboard marker in hand, body turned towards camera, central whiteboard unobstructed"
        cutline: "Standing medium shot or full figure with feet clearly grounded"
  - name: "workplace-focus"
    shotType: "three-quarters"
    cameraAngle: "Dynamic three-quarters eye-level perspective angled towards the workstation and front display screen"
    focalTarget: "Curved ultra-wide computer monitor on standing desk"
    visibleObjects:
      - "almtal-abstract-painting"
    depthLayers:
      foreground: "Standing desk edge with black mechanical keyboard, mouse, succulent, and ALMTAL ceramic mug"
      midground: "Massive curved ultra-wide monitor with glowing blank screen and modern grey ergonomic swivel chair"
      background: "Horizontal pine timber wall with framed modernist alpine painting, rear whiteboard, and sunny mountain window"
    image: "./workplace-focus.jpg"
    promptSnippet: "Three-quarters eye-level perspective focused on the standing desk workstation inside the timber home office in Grünau im Almtal. The massive curved ultra-wide monitor is prominent with a clean screen, standing desk with ALMTAL mug, mini PC, and grey ergonomic chair against the warm horizontal timber walls and mountain window backdrop."
    characterSlots:
      - id: "workstation-operator"
        role: "Software Architect / Operator"
        priority: 1
        required: false
        spatialPlacement: "Center-left midground, seated directly in the grey ergonomic swivel chair at the desk"
        allowedPoses:
          - "seated"
          - "seated-turning-to-camera"
          - "seated-working"
        prohibitedPoses:
          - "standing"
          - "walking"
        defaultAction: "One hand near mechanical keyboard, one on armrest, turning three-quarters towards viewer"
        cutline: "Three-quarters medium shot or seated full figure with legs and feet resting naturally on floor rug"
characters:
  - "georg"
objects:
  - "almtal-abstract-painting"
tags:
  - "almtal"
  - "home-office"
  - "wolf-haus"
  - "workspace"
  - "austria"
---


# Home Office Grünau im Almtal

This is Dr. Georg Hackenberg's primary creative and engineering environment, situated in Grünau im Almtal, Upper Austria.

## Key Features
- **Wolf Haus Timber Architecture**: Warm horizontal pine timber plank walls, timber ceiling with recessed spotlights, and wooden flooring with a light woven rug.
- **Modern Workstation**: Height-adjustable standing desk on the left, curved ultrawide monitor, mini PC, ergonomic grey swivel chair, and ALMTAL ceramic mug.
- **Framed Art & Whiteboard**: Modern framed abstract artwork on the left wall and a large centered magnetic whiteboard on the rear timber wall for architecture sketches.
- **Alpine Panorama**: Grand floor-to-ceiling picture window overlooking the Alm river valley, pine forests, and mountain peaks.
- **Regeneration**: An elliptical trainer and potted green plants (fiddle-leaf fig, monstera) situated along the panoramic window.
