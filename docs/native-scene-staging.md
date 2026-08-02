# Native scene staging and initial runtime state

## Purpose

The Native Staging Lab reviews the canonical actor, object and portal instances that make one adventure room playable. It works from `project.json` and the matching `scene-instances.json` sidecar.

Open the workspace at:

```text
http://localhost:5174/?workspace=staging
```

The lab complements the Native Composition Lab. Composition proves that walk geometry, depth, entrances, hotspots and foreground masks form a coherent room. Staging proves that the initial actors, stateful props, navigation handoffs and draw order can inhabit that room without breaking control, readability or interaction.

## Why initial staging is a separate contract

A room can have valid polygons and still fail when the real instances are placed:

- two walkable actors can make packaged player control ambiguous;
- an actor pivot can place most of the sprite outside the native canvas;
- two opening silhouettes can collapse into one unreadable mass;
- a stateful prop can remain interactive while invisible;
- an object approach point can fall outside navigation;
- an ambient foreground object can accidentally become a consequential target;
- a long portal handoff can teleport the actor without a traversal animation;
- a prop can obstruct an entrance or portal endpoint;
- two nodes can share the same layer, elevation, baseline and z-offset even though their overlap is artistically important.

These are not renderer-specific concerns. They arise from canonical scene data and should be reviewable before final atlases and backgrounds are locked.

## Runtime control contract

The packaged runtime automatically selects a controlled actor only when the start scene contains exactly one walkable actor instance.

The staging audit therefore blocks the start scene when it has:

- no walkable actor, which would create a view-only runtime;
- more than one walkable actor, which requires an explicit actor-instance launch selection.

Fixed actors remain valid for seated characters, crowds, vehicles, portraits and other non-player staging.

## Deterministic report

`evaluateAdventureSceneStaging` returns a stable report containing:

- a score out of 100;
- `ready`, `attention` or `blocked` status;
- actor, object, portal and occupied-layer metrics;
- canonical scene-instance validation findings relevant to the scene;
- actor visual bounds resolved from the initial animation frame;
- object state, visibility, interaction shape and approach point;
- portal handoff geometry and traversal intent;
- deterministic draw order;
- an optional link to the matching Adventure Design location.

Use `createAdventureSceneStagingReports` to evaluate all project scenes in canonical project order.

## Actor staging

The report evaluates:

- start-scene player-control ambiguity;
- actor foot positions outside the native canvas;
- unresolved initial animation frames;
- sprite bounds that are mostly or visibly clipped;
- extreme local scale multipliers;
- actors that occupy an entrance at the control handoff;
- substantial overlap between initial actor silhouettes.

Actor bounds use the initial animation clip, frame foot point, scene depth band and local scale multiplier. The result is suitable for native-size staging review without owning renderer state.

## Stateful object staging

For each placed object, the report resolves the effective initial state from the instance override or definition default. It then evaluates:

- object position and interaction geometry against the scene canvas;
- interaction approach points against navigation;
- interactive objects with no authored approach point;
- hidden states that remain interactive;
- interactive targets placed on ambient layers;
- low-opacity interactive targets;
- extreme local scale multipliers;
- entrance obstruction;
- missing definitions, states, visuals and referenced entities through the canonical validator.

Sprite-frame visuals produce explicit native bounds. Image visuals remain represented by their pivot and interaction geometry because source dimensions belong to compiled asset evidence.

Mirroring and local scale are applied consistently to object interaction shapes and walk-to offsets.

## Portal staging

Navigation portals connect otherwise separate navigation areas. The audit reports:

- portals that connect one area to itself;
- effectively identical handoff points;
- large native-pixel handoffs without a traversal animation state;
- unusually high traversal cost;
- visible objects that obstruct the start or end point;
- missing areas or invalid portal points through canonical validation.

A large handoff can be correct for stairs, ladders, doors, squeezes and climb transitions, but the movement must be visually authored rather than reading as an unexplained teleport.

## Layer order

Initial stage nodes are sorted by:

1. render layer;
2. elevation;
3. baseline Y;
4. local z-offset;
5. stable ID.

Stable-ID tie breaking keeps the runtime deterministic. It is not a substitute for artistic intent. The audit records a note when visible nodes share the same layer, elevation, baseline and z-offset so the team can decide whether the overlap should be controlled explicitly.

The audit also reports overloaded front-ambient staging and unusually dense native scenes. Decorative activity should be grouped into background production where possible so actors, clues, exits and stateful props retain visual priority.

## Studio overlay

The Native Staging Lab renders:

- canonical navigation areas;
- entrance markers;
- actor frame bounds and foot points;
- stateful object bounds;
- object interaction shapes;
- object walk-to crosshairs;
- portal lines and endpoints;
- visible versus hidden initial states;
- the final deterministic layer list.

The overlay is a construction view. It uses abstract scene masses so the same contract remains useful before and after final background art exists.

## Production handoff

Before initial scene lock, confirm:

1. the start scene has one deliberate implicit player candidate or an explicit launch actor;
2. actors remain readable at 1× native size and do not collide at the opening pose;
3. every consequential object is visible or intentionally signposted;
4. every authored approach point is reachable;
5. portal movement has believable visual continuity;
6. entrances and handoff points remain clear;
7. foreground and ambient layers frame rather than hide gameplay;
8. object-state transitions preserve target geometry, feedback and ordering;
9. save, load and deterministic replay restore the same staged state.

## Scope boundary

The staging score is not proof of final art, animation, sound or puzzle quality. It does not replace:

- the Adventure Design Director;
- the authored-intent Authenticity Lab;
- the Compiled Proof Lab;
- the Native Composition Lab;
- the Composer, Objects and Animation workspaces;
- Player and Playtest Inspector runtime evidence.

A scene is ready to ship only when its design intent, geometry, initial staging, compiled pixels, interaction feedback and deterministic playtest evidence agree.
