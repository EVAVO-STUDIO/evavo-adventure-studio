# Scene Composition, Navigation and Stateful Objects

## Purpose

Scene composition is the authored bridge between reusable game definitions and one concrete room. Global actors describe frames and animation clips. Global assets describe source files and compiled runtime evidence. A scene-composition manifest places those definitions, gives them persistent instance identities and authors the room-specific staging required by a 1990s point-and-click adventure.

The composition format is deliberately separate from renderer classes and editor component state. The visual editor, CLI, automation workers and packaged player must all read and write the same versioned manifest.

## File format

A project may supply one sidecar document:

```text
scene-instances.json
```

Its root contract is:

```ts
interface SceneInstanceManifest {
  manifestVersion: 1;
  projectId: Id<"project">;
  objectDefinitions: ObjectDefinition[];
  scenes: SceneComposition[];
}
```

The sidecar is optional. Projects without one compile with an empty composition manifest. This preserves compatibility with projects that currently contain backgrounds, hotspots, dialogue or sequences but no placed actor or object instances.

## CLI workflow

Validate a composition without compiled assets:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --scene-instances .\game\scene-instances.json
```

Validate exact sprite and object evidence as well:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json
```

Compile and package use the same option:

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --out .\game\build\game.bundle.json

pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --out .\game\release
```

The CLI emits scene-specific structural and semantic diagnostics. It also protects the sidecar from bundle, report and release-directory overwrite.

## Actor definitions and actor instances

An actor definition is reusable. One guard definition may be placed several times, and each placement has an independent stable instance ID.

```json
{
  "id": "actor-instance.office.detective",
  "actorId": "actor.detective",
  "position": { "x": 46, "y": 163 },
  "facing": "east",
  "animationState": "idle",
  "mobility": "walkable",
  "elevation": 0,
  "zOffset": 0,
  "scaleMultiplier": 1
}
```

Actor placement controls:

- native foot position;
- initial animation state and facing;
- whether navigation may move the actor;
- elevation and local depth offset;
- scale multiplier after scene perspective scaling;
- conditional visibility.

The runtime gives every actor instance independent position, animation playback and visibility state. Save data therefore stores instance state rather than mutating the reusable actor definition.

Walkable actors must begin inside an enabled navigation area. Fixed actors may be staged outside walk geometry for portraits, vehicles, seated characters, background crowds or cinematic compositions.

## Object definitions and object instances

Object definitions describe reusable state machines. Object instances place those definitions in rooms and use IDs compatible with the existing `set-object-state` story action.

```json
{
  "id": "object-definition.cabinet",
  "name": "Filing cabinet",
  "initialStateId": "object-state.cabinet.closed",
  "states": [
    {
      "id": "object-state.cabinet.closed",
      "visual": {
        "kind": "image",
        "assetId": "asset.cabinet.closed",
        "pivot": { "x": 18, "y": 42 }
      },
      "interactionShape": {
        "points": [
          { "x": 0, "y": 0 },
          { "x": 36, "y": 0 },
          { "x": 36, "y": 44 },
          { "x": 0, "y": 44 }
        ]
      },
      "walkToOffset": { "x": 0, "y": 18 },
      "cursor": "use",
      "interactions": [
        {
          "id": "interaction.cabinet.open",
          "verb": "use",
          "actions": [
            {
              "kind": "set-object-state",
              "objectId": "object.office.cabinet",
              "state": "object-state.cabinet.open"
            }
          ]
        }
      ]
    }
  ]
}
```

A placed object is small because its reusable definition owns state-specific visuals and commands:

```json
{
  "id": "object.office.cabinet",
  "definitionId": "object-definition.cabinet",
  "position": { "x": 188, "y": 144 },
  "layer": "world",
  "elevation": 0,
  "zOffset": 0,
  "scaleMultiplier": 1,
  "mirrored": false
}
```

Object states may control:

- standalone image or exact compiled sprite-frame visual;
- visibility;
- local interaction polygon;
- authored walk-to staging offset;
- arrival-facing intent;
- semantic cursor;
- state-specific interactions and fallback response.

The interaction polygon is transformed with the same anchor, scale, mirroring and pivot used by the visual. Overlapping objects are hit-tested from front to back using the resolved render order.

State changes are persistent. The active state determines both what the player sees and which verbs are currently valid. A queued action is re-resolved after the actor arrives, so an object that disappeared, locked or changed while the actor was walking cannot execute a stale command.

## Exact compiled visual evidence

A sprite-frame object state repeats the frame geometry needed by the renderer:

- `frameId`;
- source rectangle;
- original untrimmed size;
- trim offset;
- authored pivot.

Build validation compares the state against the compiled spritesheet manifest. Stale rectangles, wrong trim offsets and missing atlas frames stop compilation rather than shifting the object at runtime.

## Navigation areas and portals

Navigation areas remain part of the canonical scene. Room composition adds explicit portals between those areas.

```json
{
  "id": "portal.office.stairs",
  "fromAreaId": "navigation.office.floor",
  "toAreaId": "navigation.office.mezzanine",
  "fromPoint": { "x": 226, "y": 158 },
  "toPoint": { "x": 244, "y": 112 },
  "bidirectional": true,
  "traversalCost": 0,
  "traversalAnimationState": "climb",
  "enabledWhen": {
    "kind": "flag",
    "flag": "stairsAvailable",
    "equals": true
  }
}
```

A portal may represent:

- stairs or ladders;
- a bridge between separated walk surfaces;
- a doorway whose two staging points are not geometrically adjacent;
- a balcony or raised platform transition;
- a narrow traversal requiring a special animation;
- a story-gated route.

Portal endpoints must lie inside their authored source and destination areas. Conditional portals use the same deterministic condition evaluator as interactions, dialogue and visibility.

## Deterministic route solving

The scene package uses a visibility graph over:

- start and destination;
- polygon vertices;
- portal endpoints.

It supports concave navigation polygons, snaps outside clicks to the nearest reachable boundary when allowed and uses stable lexical tie-breaking for equal-cost routes. Separate navigation areas remain disconnected unless an authored portal joins them.

A route records exact points and typed segments:

```ts
interface NavigationRouteSegment {
  from: Point;
  to: Point;
  kind: "walk" | "portal";
  areaId: Id<"navigation-area"> | null;
  portalId: Id<"navigation-portal"> | null;
  distance: number;
}
```

The route is serializable and suitable for saves and replays.

## Fixed-tick movement

Actor movement stores subpixel position internally and advances only on logical ticks. Walk speed is expressed in native pixels per second and divided by the project logical tick rate.

During movement the runtime:

1. resolves a route from the current actor position;
2. selects walk or portal traversal animation;
3. derives the desired eight-direction facing;
4. falls back to available four-direction animation where necessary;
5. advances along route segments in stable actor-instance order;
6. emits segment and portal completion events;
7. restores the arrival animation when the route ends.

The renderer only displays the resolved position and frame. Browser refresh rate does not determine movement distance or animation cadence.

## Deferred point-and-click commands

A context click on an object follows classic adventure staging:

1. resolve the current frontmost object hotspot;
2. derive the context verb from its cursor;
3. queue the object command;
4. walk the controlled actor to the state’s authored walk-to point;
5. re-resolve the target state at arrival;
6. execute the interaction or emit state-specific fallback feedback.

Immediate commands remain possible for objects without a walk-to point. A new floor click cancels the pending object command and starts ordinary movement.

## Browser player

Packaged playback remains available through:

```text
http://localhost:5173/?bundle=/release/game.bundle.json
```

When one walkable actor is placed in the start room, it is selected automatically. Games with several walkable actors select one explicitly:

```text
http://localhost:5173/?bundle=/release/game.bundle.json&actor=actor-instance.office.detective
```

The packaged player:

- hides the operating-system cursor;
- maps pointer coordinates through integer letterboxing to native pixels;
- maps native screen coordinates through the camera into world space;
- displays a native software cursor;
- changes cursor form and colour over stateful objects;
- starts deterministic routes on floor clicks;
- queues context verbs on object clicks;
- surfaces fallback and temporary speech text in the status rail.

The external status rail is an interim diagnostic surface. Canonical bitmap subtitles, dialogue menus and speech balloons will be rendered on the native game surface in a later slice.

## Editor requirements

The future scene editor must treat every visual operation as a serializable document command. At minimum it needs tools for:

- placing, selecting, duplicating and deleting actor instances;
- choosing initial state, facing and animation;
- placing stateful object instances;
- editing local pivots, interaction shapes and walk-to points;
- previewing every object state;
- drawing and validating navigation portals;
- simulating conditions and state changes;
- previewing perspective, depth and hit-test order;
- running click-to-walk and deferred-command playtests;
- undo, redo and deterministic save output.

Editor state must not become runtime state. The editor writes the sidecar; the compiler validates and embeds its canonical form; the packaged player consumes only the source-free runtime bundle.
