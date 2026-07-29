# Visual Studio workspace

## Purpose

The visual studio is an authoring client for the canonical adventure project and scene-composition contracts. React owns presentation and input only. It does not own project truth, runtime state or serialization rules.

The first workspace is available in `apps/studio` and runs independently from the packaged game player.

```powershell
pnpm dev:studio
```

The development server uses port `5174` by default.

## Data boundaries

The workspace distinguishes five different artifacts.

1. **Adventure project** — scenes, navigation geometry, depth bands, actors, animation definitions, dialogues, sequences, assets and inventory definitions.
2. **Scene composition manifest** — placed actor instances, stateful object definitions, placed object instances and navigation portals.
3. **Editor commands** — serializable insert, remove, replace and batch operations.
4. **Recovery snapshot or operation log** — local recovery evidence and replayable edit history.
5. **Runtime bundle** — source-free compiled data consumed by the player.

The visual studio currently edits the scene-composition manifest. It does not mutate the canonical project schema directly.

## Editor-core contract

`@evavo/adventure-editor-core` owns immutable document transformation and history.

Every edit is represented as a serializable command:

- insert, remove or replace a scene composition;
- insert, remove or replace an object definition;
- insert, remove or replace an actor instance;
- insert, remove or replace an object instance;
- insert, remove or replace a navigation portal;
- execute an atomic batch of commands.

The public package entrypoint preflights commands before execution. In particular, it prevents more than one composition document from being created for the same scene, including conflicting inserts inside a batch.

Each successful command returns an inverse command. Undo and redo therefore use the same document API as ordinary edits rather than keeping UI-specific snapshots.

## Visual workspace

The first scene composer provides:

- project and scene navigation;
- actor, object and portal layer lists;
- native-resolution scene framing;
- optional native grid, walkmesh and portal overlays;
- drag-to-place actor and object instances;
- actor animation, facing, mobility and scale properties;
- object layer, state, mirroring and scale properties;
- portal endpoint, direction and navigation-area properties;
- insert and delete commands;
- keyboard undo, redo, delete and export;
- scene-composition JSON import and export;
- saved-versus-dirty document state;
- a recoverable error boundary.

The initial visual backdrop is a deterministic editor fixture rather than imported production art. Runtime asset previews will be connected through compiled asset manifests so the editor never guesses source-to-runtime geometry.

## Command schemas and operation logs

`@evavo/adventure-editor-core/command-schema` defines Zod schemas for every editor command and for versioned operation logs.

An operation log contains:

- the project ID;
- the expected base revision;
- stable operation IDs;
- commands in their intended execution order.

`@evavo/adventure-editor-core/operation-log` replays a log through validated history. Replay rejects:

- the wrong project;
- an unexpected base revision;
- duplicate operation IDs;
- any invalid editor command.

This is the integration surface for automation agents and future collaboration services.

## Validation

The studio validation service uses the same `validateSceneInstanceManifest` function used by compilation and packaged runtime validation.

Issues are grouped by:

- scene;
- object definition;
- whole document.

The validation service does not invent softer editor-only rules. A composition accepted by the studio should be accepted by the compiler when its compiled asset evidence is also valid.

## Recovery

Browser recovery snapshots are local, versioned and project-scoped. Each snapshot records:

- snapshot version;
- project ID;
- editor operation revision;
- save time;
- a fully parsed scene-composition manifest.

Loading recovery data always reparses the canonical manifest schema. Invalid JSON, unsupported versions, wrong projects, invalid revisions and invalid manifests are rejected instead of being coerced.

Recovery snapshots are not runtime build inputs and are never packaged with a game.

## Current limitations

The first workspace intentionally does not yet include:

- production image and atlas previews;
- polygon point editing;
- visual object-state and interaction editing;
- dialogue graph editing;
- cutscene timeline editing;
- asset importing and atlas compilation;
- desktop filesystem integration;
- autosave lifecycle integration in the React shell;
- multi-user collaboration.

Those features will build on the existing command, validation and recovery contracts rather than adding separate state models.
