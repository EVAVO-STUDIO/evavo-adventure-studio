# Studio validation centre

## Purpose

The Validation Centre exposes semantic authoring diagnostics before compilation. It uses the same scene-composition validator as the compiler rather than maintaining a lighter UI-only checklist.

## Run the workspace

```powershell
pnpm dev:studio
```

Open:

```text
http://localhost:5174/?workspace=validation
```

## Input

The current workspace validates a versioned scene-composition manifest against the representative studio project.

It can:

- load a local JSON manifest;
- reject malformed schema data;
- reject a manifest for another project;
- run semantic validation;
- group issues by scene, object definition or document scope;
- export a machine-readable report.

A valid fixture and deliberately broken demonstration are built in for interface testing.

## Semantic rules

The Validation Centre currently reports:

- project identity mismatch;
- duplicate IDs;
- duplicate scene composition documents;
- missing scenes and actors;
- missing actor animation state and facing;
- walkable actors outside navigation polygons;
- missing object definitions and states;
- visible states without visuals;
- invalid object visual asset kinds;
- invalid initial states;
- invalid object-state transition actions;
- missing dialogue and sequence action targets;
- missing inventory item action targets;
- navigation portals with missing areas;
- navigation portal endpoints outside their declared polygons.

## Build-time validation

A valid composition manifest is not yet a valid release.

Compilation adds:

- compiled asset evidence checks;
- source and output byte lengths;
- SHA-256 verification;
- portable runtime paths;
- atlas page and frame geometry;
- authored-versus-compiled actor and object frame parity;
- runtime-bundle structural and semantic parsing.

The UI clearly distinguishes scene-composition validity from complete release validity.

## Report format

Exported reports include:

- report version;
- project ID;
- valid or blocked status;
- issue count;
- manifest version;
- stable issue codes, paths and messages.

These reports can be consumed by CI workers, maintenance agents or the future project dashboard.

## Remaining work

The next validation features are:

- validate the loaded source project and asset manifest together;
- navigate directly from an issue to its editor and field;
- add filters for errors, warnings and workspaces;
- add reachability and soft-lock analysis;
- add dialogue graph and cinematic sequence validation groups;
- add automatic safe fixes with command previews;
- add saved report comparison and regression baselines;
- add compiled release verification and artifact download.
