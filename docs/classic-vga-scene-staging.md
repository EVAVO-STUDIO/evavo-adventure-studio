# Classic VGA scene staging and Scene Director

## Purpose

Adventure Studio treats a classic adventure room as one authored 2.5D stage rather than a background image with a navigation polygon placed over it later.

The final native frame, invisible control geometry, actor grounding, perspective, foreground masks, approach positions, interaction choreography and entrances must agree. This follows the practical production logic behind early 1990s SCI, SCUMM and DGDS adventures while keeping Adventure Studio's data and examples original.

The canonical review question is:

> Could this exact room, at its native resolution and with its actual movement and interaction behaviour, plausibly have shipped as a professionally authored VGA adventure scene between roughly 1990 and 1994?

## Scene Director layers

The Studio should expose the following views over the same native coordinate system:

- **ART** — final native background, actors, objects and interface reservation;
- **WALK** — reachable floor polygons, portals and actor footprint clearance;
- **CONTROL** — exits, triggers, interaction shapes and stateful blockers;
- **DEPTH** — scale curves, area overrides, actor foot baselines and resolved scale;
- **OCCLUSION** — foreground masks, baselines and ordered visual planes;
- **HOTSPOTS** — visible interaction shapes and optional click-comfort regions;
- **APPROACH** — authored interaction positions, facing and verb/item eligibility;
- **ACTORS** — foot point, shadow anchor, footprint, facing and current animation;
- **SURFACE** — carpet, timber, stone, dirt, water, metal and special traversal zones;
- **LIGHT** — palette-remap regions rather than modern HDR lighting;
- **ENTRY** — off-screen spawn, arrival path, facing and player-control handoff;
- **DEBUG** — routes, target arbitration, state conditions and deterministic IDs.

No layer is a mock overlay. Every view must read the canonical data consumed by validation and runtime.

## Actor footprints and clearance

Classic navigation often reasons from a character's foot position, but the authoring system also needs to protect the visible body from implausible clipping.

`ActorFootprint` adds:

- authored width around the foot anchor;
- authored floor depth;
- additional clearance;
- a collision class so a child, adult, large creature, cart or vehicle can use different route clearance.

Footprints are an authored navigation constraint, not a physics simulation. The objective is visually clean staging, not rigid-body behaviour.

## Preferred walk lanes

The mathematically shortest route is not always the best-looking route.

`PreferredWalkLane` describes a polyline with a soft influence radius and cost multiplier. It allows the route solver to prefer visually intentional movement such as:

- following a carpet runner;
- staying on a pavement;
- curving around a fountain;
- approaching a desk from the front;
- using the centre of a corridor;
- preserving a dramatic foreground composition.

A preferred lane never makes another valid route impossible. It biases route cost rather than becoming a compulsory spline.

The runtime now evaluates the normal visibility-graph route plus deterministic lane-directed candidates. With no staging manifest, routing remains identical to the legacy path solver.

## Perspective and scale curves

A single near/far interpolation cannot describe every painted room convincingly.

`DepthScaleCurve` supports ordered scale keys such as:

```text
Y  76 -> 0.52
Y  94 -> 0.58
Y 116 -> 0.69
Y 140 -> 0.83
Y 166 -> 1.00
Y 190 -> 1.14
```

Linear interpolation is appropriate for many rooms. Step interpolation is available for deliberately discrete historical or stylised presentation.

Navigation areas may select a curve or force a fixed scale. This supports balconies, close foreground platforms, unusual stair landings and rooms whose painted perspective cannot be represented by one global formula.

Perspective review must happen at 1x native resolution. A technically continuous curve is still wrong if the actor looks pasted onto the painting.

## Approach slots

An interactive object can expose several authored approach positions rather than one generic `walkTo` point.

Each `ApproachSlot` defines:

- native foot position;
- arrival facing;
- eligible verbs;
- eligible inventory items;
- optional action animation;
- preferred status;
- optional state condition.

The runtime chooses deterministically: preferred valid slots first, then reachable distance, then stable ID ordering. The existing object `walkTo` remains the compatibility fallback when staging does not provide a usable slot.

This supports interactions such as:

- opening a desk drawer from the front;
- talking to a seated NPC from either side;
- pushing furniture from behind;
- inserting an item from a precise side;
- examining an object from a readable pose without forcing every verb to use that pose.

## Native click comfort

A period-authentic 320x200 prop can be visually tiny without becoming frustrating to click.

`InteractionComfortRegion` provides an optional invisible native-scene polygon for a placed object. Comfort regions use **absolute scene coordinates**. They do not scale or mirror with the object's sprite. This is deliberate: the designer authors the exact forgiving screen-space area after reviewing the final room at 1x native size.

The object's normal `interactionShape` remains local object geometry. It is transformed with the object's pivot, perspective scale and mirroring exactly as before.

Hit arbitration is strict:

1. exact visible interaction shapes are tested front-to-back;
2. if any exact shape contains the pointer, it wins immediately;
3. only an exact miss enables comfort-region testing;
4. comfort regions resolve by authored priority, then front-to-back render order, then stable region ID.

A comfort region therefore cannot steal a click from a real visible hotspot. It provides usability without glowing outlines, hotspot sparkles or other modern assist treatment.

## Interaction choreography

A polished interaction is not `walk -> stop -> object changes`.

`InteractionChoreography` can describe a sequence such as:

```text
approach
-> braking pose
-> turn to target
-> reach-low animation
-> drawer state changes
-> wooden-slide cue
-> short hold
-> inspect pose
-> recovery idle
```

Choreography beats remain discrete and deterministic. The system deliberately avoids modern procedural IK or continuous animation blending when the selected production profile calls for authored VGA poses and holds.

## Surface zones

`SurfaceZone` associates walkable regions with material and optional movement/audio treatment:

- wood;
- carpet;
- stone;
- dirt;
- grass;
- shallow water;
- metal;
- stairs;
- project-defined custom materials.

Surface state can select footsteps, modest movement multipliers or a special traversal animation. Animation events should trigger footsteps; frame rate must not determine them.

## Palette-light zones

Classic VGA lighting should normally be art-directed through the palette and sprite art rather than modern real-time lighting.

`PaletteLightZone` describes a region that selects a palette remap. Supported transitions begin with:

- hard palette boundary;
- ordered-dither transition.

Typical uses include a warm pool under a street lamp, a cool alley shadow, an interior doorway or a supernatural colour treatment. Bloom, HDR exposure and smooth alpha light gradients are not required to sell these effects.

## Entry choreography

A room entrance is an authored beat, not only a coordinate.

`EntryChoreography` can declare:

- an off-screen or occluded spawn position;
- an authored entry path;
- a traversal animation;
- final facing;
- arrival idle;
- the point where player control unlocks.

This supports walking through a doorway, descending stairs, emerging from behind a foreground element, stepping out of a lift or entering from off-screen without special-case room scripts.

## Runtime and compiler integration

The staging contracts are exported from:

```ts
@evavo/adventure-scene-instances/staging
```

Semantic validation is exported from:

```ts
@evavo/adventure-scene-instances/staging-validation
```

Runtime-facing resolution helpers are exported from:

```ts
@evavo/adventure-scene-runtime/staging
```

The staging-aware frame resolver is exported from:

```ts
@evavo/adventure-scene-runtime/staged-frame
```

The compiler can validate, canonicalise and attach a staging manifest through:

```ts
@evavo/adventure-compiler/scene-staging
```

Staging is optional in runtime bundles, preserving older packaged games. When present, its project ID must match the bundle project ID.

## CLI workflow

Staging can be supplied as its own sidecar rather than being mixed into the reusable scene-instance document:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --scene-instances .\game\scene-instances.json `
  --scene-staging .\game\scene-staging.json

pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --scene-staging .\game\scene-staging.json `
  --out .\game\build\game.bundle.json

pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --scene-staging .\game\scene-staging.json `
  --out .\game\release
```

The CLI validates staging references against the real project and placed scene instances. The staging file is also part of output-overwrite and release-directory safety checks.

## Implemented runtime slice

The current staging runtime provides:

- deterministic verb/item-specific object approach selection;
- reachability checks before an approach slot is selected;
- arrival facing and optional approach animation state;
- piecewise perspective scale resolution by active navigation area;
- preferred-lane route selection over the existing deterministic visibility graph;
- surface-zone lookup;
- native click-comfort fallback with exact-hotspot precedence;
- optional staging storage in compiled runtime bundles.

## Remaining integration sequence

The next runtime/editor slices should build on the contracts in this order:

1. apply actor footprint clearance directly to route feasibility;
2. execute full interaction choreography beats after arrival rather than only arrival facing/animation;
3. apply surface movement/audio state during movement;
4. execute entry choreography before unlocking input;
5. make staged perspective the default packaged-player frame path;
6. renderer consumes ordered occlusion planes and palette-light zones;
7. Scene Director edits every layer visually on the native canvas;
8. validation rejects impossible footprint corridors and unsafe occlusion/choreography combinations;
9. showcase projects retain 1x native screenshots and deterministic replays as evidence.

## Showcase stress tests

The staging engine should be proven by original rooms in four different production languages:

### Illustrated storybook VGA

A broad painterly room with a deep background lane, dramatic foreground framing, strong near/far scale change and a temporary icon interface.

### Procedural contemporary VGA

A grounded police or civic interior with desks, doors, chairs, evidence props, multiple small targets and tightly staged approaches. The scene should prove that mundane realistic rooms remain readable and pleasant at 320x200.

### Gothic investigation VGA

A dense interior with overlapping furniture, dark palette zones, portrait dialogue, evidence objects and several occlusion transitions without losing actor readability.

### DGDS cinematic VGA

A strongly framed techno-noir room with large foreground forms, selected character poses, palette-lit regions, a visible clock or state panel and hard editorial transitions into a close-up or action insert.

The demonstrations must use original characters, locations, artwork, dialogue and puzzles. Historical titles remain measurement and production-study references rather than redistributable content.
