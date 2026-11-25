# Visual Archetype: Projects (`preview.jpg`)

Project previews spotlight real-world software systems, developer platforms, engineering tools, and simulation engines by showing **who uses them and what concrete operational pain they solve**.

## Visual Archetype: Real-World Value-in-Action (Customer & Pain Solved)

A grounded, mature editorial graphic-novel scene depicting the actual customer or domain practitioner (30s–40s engineers, factory planners, researchers, CTOs) actively using the software in an authentic workplace setting to resolve a tangible real-world problem.

## Composition & Storytelling Rules
* **Authentic Workplace Context**: Anchor the scene in the real physical environment where the software delivers value (e.g., mechanical engineering design studio, industrial factory floor, research lab, or executive architecture suite)—never abstract floating UI boxes in an empty void.
* **Customer & Concrete Pain Solved**: Frame 1–2 adult practitioners interacting with the software on a crisp workstation monitor, tablet, or collaborative display so the viewer immediately grasps the domain problem being solved:
  * **CADdrive**: Two mechanical engineers at a studio workstation smoothly merging branching 3D CAD assembly revisions without file-lock conflicts.
  * **Delta Dynamics**: An environmental or systems engineer inspecting a live terraced terrain and water-flow simulation on a wide lab display.
  * **MentaWise**: A researcher or knowledge architect navigating a radial ego-graph knowledge map to synthesize complex literature without getting lost.
  * **SpineML**: An industrial plant planner on a modern factory floor comparing a clean spine-and-rib production line layout against physical automated workcells.
* **Thumbnail Legibility**: Project cards render at ~300–400px wide in portfolio grids. Keep the foreground uncluttered, emphasize 1 clear focal workstation/screen + 1–2 adult figures, and avoid tiny unreadable UI text.

## Avatar, Character & Style Conditioning Rules
* **Mature Editorial Graphic Novel / Ligne Claire**: Realistic adult human proportions (30s–40s), crisp dark ink outlines, clean 2D cel shading. **ZERO oversized cartoon eyes, bobble-head ratios, or child-like proportions.**
* **Visual Style Reference Anchor**: Pass an existing `src/content/services/` hero image (e.g., `src/content/services/software-engineering/preview.jpg`) as a visual style reference in `ImagePaths` so character anatomy, ink linework, and cel shading stay 100% consistent with `src/content/services/` and `src/content/presentations/`.
* **Avatar Inclusion (Optional / Sporadic)**: Primarily feature authentic domain customers/practitioners. Dr. Georg Hackenberg's avatar (`src/content/characters/georg/portrait.png`) may appear sporadically only for projects where he is a genuine real-world user.

## Environment & Palette
* **Foundation**: Deep slate-black shadows and dark-mode architectural surfaces (`#030712`) illuminated by warm workplace lighting and the project's signature accent palette:
  * CADdrive: Brand Blue (`#3b82f6`) and Cyan (`#06b6d4`)
  * Delta Dynamics: Emerald Green (`#10b981`) and Water Cyan (`#06b6d4`)
  * MentaWise: Purple (`#a855f7`) and Violet
  * SpineML: Factory Amber (`#f59e0b`) and Industrial Slate
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved as `preview.jpg` in `src/content/projects/[project_id]/preview.jpg`.

## Canonical Prompt Template

```text
Mature editorial graphic novel / ligne claire illustration matching the character anatomy, crisp dark ink outlines, and clean 2D cel shading of the reference services illustration. Authentic real-world workplace scene in [domain setting: mechanical engineering studio / industrial factory floor / research lab] showing [1–2 realistic adult practitioners in their 30s–40s with realistic human proportions] actively solving [concrete operational pain] using [project software] on a prominent crisp display. On the screen, clean high-contrast visual schematics of [core project mechanism] glow in [project accent colors, e.g. #3b82f6 blue and #06b6d4 cyan] against dark slate (#030712) UI surfaces. Warm architectural lighting balanced with deep slate shadows (#030712) for dark-mode integration. Strictly borderless full-bleed composition, zero oversized cartoon eyes or child-like proportions, no unreadable tiny text, no soft 3D renders. 16:9 aspect ratio.
```
