# Native scene composition and readability

## Purpose

The Native Composition Lab reviews the level geometry that must support finished 1990s-style adventure artwork. It works from canonical `project.json` scene data and an optional matching Adventure Design document.

Open the workspace at:

```text
http://localhost:5174/?workspace=composition
```

The lab does not infer quality from a genre label or a pixel filter. It checks whether the authored walk lane, actor depth, entrances, interaction targets and foreground occlusion form a coherent playable stage at the final native canvas.

## Why geometry is part of the art direction

At 320 × 200, a few pixels can decide whether the player understands an exit, whether a character separates from the background, or whether a foreground prop hides the exact interaction it is meant to frame. Background painting and level geometry therefore cannot be reviewed independently.

The composition contract keeps these concerns in one coordinate system:

- background canvas;
- navigation polygons;
- actor foot positions;
- far and near depth boundaries;
- entrance and arrival points;
- hotspot shapes and approach points;
- foreground baselines and masks;
- linked location visual promise and arrival beat.

## Deterministic report

`evaluateAdventureSceneReadability` returns a stable report containing:

- a score out of 100;
- `ready`, `attention` or `blocked` status;
- union-based navigation and hotspot coverage;
- walkable vertical span;
- counts for navigation, depth, entrances, hotspots, exits and occluders;
- a renderer-neutral native overlay;
- an optional link to the matching Adventure Design location;
- sorted findings with impact and corrective recommendations.

Use `createAdventureSceneReadabilityReports` to evaluate every project scene in canonical project order.

## Geometry gates

### Native canvas

A scene must use the same dimensions as the project presentation. A mismatch blocks review because art, interface, hit testing and runtime geometry would no longer share one coordinate system.

The lab records a note for non-320 × 200 scenes. Other canvases can be deliberate, but they still require 1× native review.

### Navigation

Navigation must exist, remain inside the scene and form a purposeful stage. Degenerate or impractically tiny polygons are rejected because they cannot reliably contain an actor foot point or route-solver tolerance. Coverage is sampled as the union of polygons, so overlapping areas do not falsely inflate the metric.

Extreme coverage is reported for review rather than automatically rejected. A cramped close-up and a broad outdoor stage can both be valid, but neither should happen accidentally.

Heavy overlap is reported separately because several nearly identical areas can obscure elevation and routing intent.

### Entrances

Every entrance must be visible and land on navigation. An arrival outside the walk area blocks the scene unless an explicit deterministic handoff moves the actor before player control.

The arrival position is not merely technical. It establishes the first silhouette, eyeline and player objective.

### Depth and actor scale

Depth bands must remain inside the canvas, use a valid far-to-near range and cover every reachable vertical foot position without gaps. Reversed scale is reported because distant actors normally should not become larger than foreground actors.

The lab does not decide the artistic scale curve. It proves that the authored curve is complete and internally coherent.

### Hotspots and approach points

Hotspot polygons must remain inside the scene and have a usable non-zero target area. Any authored `walkTo` point must be reachable through navigation. Individual targets that cover an excessive portion of the native canvas are reported separately from overall hotspot density.

The report also identifies:

- targets with no interaction or fallback response;
- unusually broad target coverage;
- multi-scene projects with no source-project exit hotspot.

Object-state definitions and sequences can provide valid exits or interactions, so the absence of a source hotspot remains a visible note rather than a false hard failure.

### Occlusion

Foreground positions, baselines and optional masks must remain inside the canvas. Optional masks must also have a usable non-zero area. Baselines identify where actors change from in front of a foreground element to behind it.

Occlusion review must include movement, dialogue, cutscenes and changed object states. A static screenshot is not sufficient evidence.

## Studio overlay

The Native Composition Lab renders:

- rule-of-thirds and pixel grids;
- navigation polygons and elevation labels;
- far and near depth boundaries with scale values;
- hotspot polygons;
- explicit scene-change hotspots;
- walk-to crosshairs;
- entrance markers;
- foreground masks and baselines.

The overlay intentionally uses canonical geometry instead of a hand-drawn mockup. It is suitable for level-review discussions even before final background art exists.

## Handoff review

The handoff view translates the report into shared production language for:

- background artists;
- character and animation artists;
- level and interaction designers;
- audio designers;
- runtime engineers;
- playtest reviewers.

Before asset lock, confirm:

1. the final background, actors and interface read at 1× native size;
2. every entrance, exit and approach point is understandable without persistent hotspot markers;
3. depth scaling preserves character identity and animation contact;
4. foreground masks frame rather than hide consequential action;
5. decorative detail does not compete with actors, obstacles, clues or exits;
6. changed chapter and puzzle state remains visible when the player revisits the scene.

## Scope boundary

The scene-readability score is not proof of finished art quality. It does not measure drawing, painting, sprite animation, typography, sound, puzzle enjoyment or player comprehension.

Use it with:

- Adventure Design Director for authored intent;
- Authenticity Lab for project-level production discipline;
- Compiled Proof Lab for encoded asset evidence;
- Geometry and Composer workspaces for editing;
- Player and Playtest Inspector for runtime behaviour and deterministic closure.

A scene is ready to ship only when geometry, final pixels, interaction feedback and playtest evidence agree.
