# Project geometry editor

## Purpose

Project geometry belongs to the canonical adventure project, not the scene-composition sidecar. The geometry workspace edits:

- scene dimensions and framing context;
- walkable navigation polygons;
- perspective and depth-scaling bands;
- authored hotspots and their interaction geometry;
- scene entrances and their initial facing.

Placed actors, stateful objects and navigation portals remain in the scene-composition workspace.

## Run the workspace

```powershell
pnpm dev:studio
```

Open the scene composer at:

```text
http://localhost:5174/
```

Open project geometry at:

```text
http://localhost:5174/?workspace=geometry
```

A persistent workspace switcher is shown in both modes.

## Project editor core

`@evavo/adventure-project-editor-core` owns immutable source-project edits.

Supported command families include:

- replace the presentation profile;
- insert, remove and replace scenes;
- insert, remove and replace navigation areas;
- insert, remove and replace depth bands;
- insert, remove and replace hotspots;
- insert, remove and replace entrances;
- atomic command batches.

Every successful command returns an inverse command. Undo and redo use those inverses rather than storing UI snapshots.

The editor protects:

- the project start scene;
- the project start entrance;
- stable entity identity during replacement;
- globally unique IDs, including hotspot interaction IDs;
- non-empty command batches;
- valid insertion indices.

Project collections are cloned into ordinary schema-compatible arrays. The editor remains immutable at the document level without introducing readonly arrays that conflict with the canonical Zod output types.

## Geometry workspace

The geometry workspace currently provides four tools.

### Walkmesh

- View all navigation polygons in native coordinates.
- Select polygons.
- Drag individual vertices.
- Edit elevation.
- Insert and remove navigation areas.

### Depth scaling

- View the far and near Y boundaries of each band.
- Inspect the affected screen span.
- Edit far and near scale values.
- Add and remove bands.

### Hotspots

- View authored hotspot polygons independently from visual objects.
- Drag hotspot vertices.
- Edit the player-facing name and cursor override.
- Preserve authored interaction IDs and actions.
- Add and remove hotspots.

### Entrances

- View entrance anchors on the native scene.
- Drag anchors.
- Edit initial facing.
- Add entrances.
- Prevent deletion of the canonical start entrance.

## Source-project export

The geometry workspace exports the complete source `project.json`, not a runtime bundle. Export marks the current project history as saved.

The exported project must still pass ordinary project schema and semantic validation, then compile against verified asset evidence before it can be packaged.

## Manual verification

The CI workflow supports `workflow_dispatch` in addition to push and pull-request triggers. A manual run verifies the repository on both Windows and Linux using the pinned Node.js and pnpm versions.

The workflow runs:

- Biome checks;
- the complete TypeScript project graph;
- Vitest regression suites;
- the browser player build;
- the visual studio build.

A successful run is required before reporting the current repository as build-verified.

## Remaining geometry work

The next geometry features are:

- add and remove polygon vertices;
- multi-selection and marquee selection;
- snapping to native pixels, vertices and guide lines;
- explicit occluder and mask editing;
- visual depth-band handles;
- portal creation that coordinates project navigation areas with scene composition;
- project schema migrations;
- imported compiled-background previews instead of deterministic fixture art.
