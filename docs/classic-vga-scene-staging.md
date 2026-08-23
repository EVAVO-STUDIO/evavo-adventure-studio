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

`PreferredWalkLane` describes a polyline with a soft influence radius and cost multiplier. It allows a route solver to prefer visually intentional movement such as:

- following a carpet runner;
- staying on a pavement;
- curving around a fountain;
- approaching a desk from the front;
- using the centre of a corridor;
- preserving a dramatic foreground composition.

A preferred lane never makes another valid route impossible. It biases route cost rather than becoming a compulsory spline.

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

The runtime chooses deterministically: preferred valid slots first, then reachable distance, then stable ID ordering.

This supports interactions such as:

- opening a desk drawer from the front;
- talking to a seated NPC from either side;
- pushing furniture from behind;
- inserting an item from a precise side;
- examining an object from a readable pose without forcing every verb to use that pose.

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

## Runtime integration

The staging contracts are exported from:

```ts
@evavo/adventure-scene-instances/staging
```

Runtime-facing resolution helpers are exported from:

```ts
@evavo/adventure-scene-runtime/staging
```

The initial runtime helpers provide:

- deterministic object approach selection;
- piecewise perspective scale resolution by navigation area;
- preferred-lane cost sampling;
- surface-zone lookup.

These helpers are intentionally renderer-independent so player, testkit and future editor previews can evaluate the same decisions.

## Integration sequence

The next runtime/editor slices should build on the contracts in this order:

1. route solver samples preferred-lane cost and actor footprint clearance;
2. interaction controller asks for an approach slot before queuing movement;
3. movement runtime applies per-area perspective scale and surface state;
4. interaction runtime executes choreography beats after arrival;
5. scene transitions execute entry choreography before unlocking input;
6. renderer consumes ordered occlusion planes and palette-light zones;
7. Scene Director edits every layer visually on the native canvas;
8. validation rejects unreachable approaches, invalid scale curves, impossible footprint corridors and choreography references that cannot execute;
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
