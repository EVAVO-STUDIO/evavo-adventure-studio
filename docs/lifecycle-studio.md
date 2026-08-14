# Endings Studio

The Endings workspace authors deterministic failure states and successful endings without hand-editing lifecycle JSON.

Open it at:

```text
/?workspace=lifecycle
```

## Same runtime contract

The workspace edits `GameLifecycleManifest` from `@evavo/adventure-project-schema/lifecycle`. There is no Studio-only outcome model. Exported data can be attached directly through `@evavo/adventure-compiler/with-lifecycle` and evaluated by the packaged Player.

All edits run through `@evavo/adventure-project-schema/lifecycle-editor`, which provides schema-validated commands, exact inverse operations, undo/redo, stable project/outcome identity and deterministic dirty-state tracking. The command schema is also suitable for CLI or automation workers.

## Outcome list

Each outcome has:

- stable ID;
- `failure` or `success` kind;
- priority;
- canonical trigger condition;
- player-facing title and message;
- recovery policy and labels.

IDs cannot be renamed through a replace command. Removing the final remaining outcome is blocked because lifecycle manifests must always contain at least one route.

## Native preview

The centre canvas presents a 320 by 200 terminal-frame preview at an enlarged pixel scale. Failure and success treatments remain visually distinct while preserving the same player menu geometry.

The preview shows authored recovery routes. Quick Retry and Load are explicitly marked as save-dependent. Restart Game and Return to Title are unconditional routes when enabled.

## Conditions

Common trigger forms have direct authoring controls:

- always;
- flag equality;
- scalar variable comparisons;
- held inventory item;
- completed interaction;
- completed dialogue choice.

Nested `all`, `any` and `not` logic remains fully supported through the Advanced condition JSON editor. That editor parses against the canonical `Condition` schema before any change is committed, so it cannot create a Studio-only condition shape.

Runtime ordering remains deterministic: highest priority wins, then stable outcome ID.

## Recovery policy

Each outcome can offer:

- Quick Retry;
- Load Game;
- Restart Game;
- Return to Title.

Quick Retry and Load depend on compatible save data at runtime. The schema therefore requires Restart Game or Return to Title to remain enabled so an authored ending can never trap the player behind missing saves.

## History and export

`Ctrl/Cmd + Z`, redo and `Ctrl/Cmd + S` follow the same Studio conventions as other authoring workspaces. Export writes a canonically ordered `game-lifecycle.json` suitable for runtime compilation.

Lifecycle changes remain part of save-compatible runtime identity because they alter gameplay termination semantics. Copy-only front-end and localisation changes remain presentation-neutral under their separate contracts.

## Verification boundary

The Editor Expansion gate covers project-schema lifecycle/editor tests, runtime-bundle lifecycle validation, compiler attachment, save compatibility, Player lifecycle state/resolution and the complete Studio test directory. Native visual review of final game-specific artwork and typography remains a separate release proof.