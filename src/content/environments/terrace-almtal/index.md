---
name: "Terrace Grünau im Almtal"
category: "Outdoor Workspace"
canonicalPrompt: "A scenic modern outdoor timber terrace of a contemporary wooden house (Wolf Haus) in Grünau im Almtal, Upper Austria. The terrace floor consists of dark horizontal bamboo decking boards with subtle natural grain ink outlines. Above spans a sturdy contemporary wooden timber pergola: half of the pergola roof is covered with clean transparent safety glass, while the other half is covered with warm solid horizontal timber planks. In the center stands a charming white rectangular garden table, surrounded by vintage white-painted ornate wrought-iron chairs featuring open lattice mesh grid seats and decorative curved filigree scrollwork. Beyond the bamboo deck, a breathtaking alpine landscape unfolds with lush green meadows, dense pine forests, and rocky mountain peaks under a clear blue sky. Disney/Pixar comic-book illustration style, crisp clean dark ink line art, bold cel shading, rich organic colors."
referenceImage: "./reference.jpg"
dna:
  architecture: "Wolf Haus contemporary timber terrace & pergola architecture"
  materials:
    walls: "Natural pine timber exterior facade with Wolf Haus character"
    ceiling: "Pergola with dual roofing: half transparent glass panes, half solid pine timber planks"
    flooring: "Dark horizontal bamboo decking planks with clean ink linework"
  lighting: "Vibrant alpine natural daylight with soft directional shadows cast by pergola beams and glass roof"
  palette:
    - "#030712"
    - "#10b981"
    - "#3b82f6"
    - "#f59e0b"
  view: "Panoramic mountain view over lush green Almtal meadows, pine forests, and dramatic alpine peaks of the Totes Gebirge"
variants:
  - name: "full-terrace"
    shotType: "wide-angle"
    cameraAngle: "Wide eye-level perspective capturing the full outdoor bamboo terrace, pergola, and alpine panorama"
    focalTarget: "Entire outdoor living terrace"
    visibleObjects: []
    image: "./reference.jpg"
    promptSnippet: "Wide-angle view of the outdoor timber terrace in Grünau im Almtal with dark bamboo decking, half-glass half-timber pergola, white garden table, ornate white wrought-iron chairs, and wide alpine panorama."
    characterSlots:
      - id: "table-seat-host"
        role: "Primary Host / Author"
        priority: 1
        required: false
        spatialPlacement: "Center midground, seated at the white garden table on a white ornate wrought-iron chair"
        allowedPoses:
          - "seated"
          - "seated-working"
          - "seated-turning-to-camera"
        prohibitedPoses:
          - "standing"
        defaultAction: "Seated at white table working on laptop or enjoying coffee"
        cutline: "Seated full figure"
      - id: "balustrade-stand"
        role: "Observer / Contemplator"
        priority: 2
        required: false
        spatialPlacement: "Right midground, standing near the wooden terrace railing looking toward mountains"
        allowedPoses:
          - "standing"
          - "standing-looking-at-view"
        prohibitedPoses:
          - "seated"
        defaultAction: "Standing by railing looking at alpine panorama"
        cutline: "Standing full figure"
  - name: "table-focus"
    shotType: "three-quarters"
    cameraAngle: "Three-quarters eye-level perspective tightly focused on the white outdoor table and ornate white wrought-iron chairs"
    focalTarget: "White garden table and ornate vintage white wrought-iron chairs"
    visibleObjects: []
    depthLayers:
      foreground: "Foreground ornate white wrought-iron chair back with curved scrollwork and dark bamboo deck"
      midground: "White rectangular garden table with seating positions and open mountain view"
      background: "Pergola wooden beam structure with glass roof and alpine green mountain backdrop"
    image: "./table-focus.jpg"
    promptSnippet: "Three-quarters perspective closely framed on the white garden table and ornate white wrought-iron chairs on the dark bamboo terrace in Grünau im Almtal, with timber pergola beams overhead and panoramic green alpine mountains in the background."
    characterSlots:
      - id: "table-operator"
        role: "Software Architect / Operator"
        priority: 1
        required: false
        spatialPlacement: "Midground, seated in one of the ornate white wrought-iron chairs at the white table"
        allowedPoses:
          - "seated"
          - "seated-working"
          - "seated-turning-to-camera"
        prohibitedPoses:
          - "standing"
          - "walking"
        defaultAction: "Working on laptop on the white table or holding coffee mug, turned towards viewer"
        cutline: "Three-quarters medium shot or seated full figure with legs naturally under table"
characters:
  - "georg"
objects: []
tags:
  - "almtal"
  - "terrace"
  - "outdoor"
  - "wolf-haus"
  - "workspace"
  - "austria"
---

# Terrace Grünau im Almtal

This is the outdoor terrace workspace and relaxation area at Dr. Georg Hackenberg's contemporary timber home (Wolf Haus) in Grünau im Almtal, Upper Austria.

## Key Features
- **Dark Bamboo Decking**: Premium horizontal dark bamboo floorboards with subtle grain lines.
- **Hybrid Pergola**: Contemporary solid timber pergola roofed half with transparent safety glass and half with warm solid timber planks.
- **Signature Outdoor Furniture**: A clean white rectangular garden table accompanied by six vintage white-painted ornate wrought-iron chairs with delicate filigree scrollwork and open lattice wire mesh seats.
- **Alpine Panorama**: Direct unobstructed view across rolling green meadows, pine and larch forests, towards the rugged alpine peaks of the Totes Gebirge.
