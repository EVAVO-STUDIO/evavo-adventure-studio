# Object state and interaction editor

## Purpose

Adventure objects are reusable definitions with persistent named states. A placed object instance points to one definition and stores its active state by placed object ID in runtime saves.

The object editor modifies the `objectDefinitions` section of the scene-composition manifest. It does not create a separate object database or UI-only state model.

## Run the workspace

```powershell
pnpm dev:studio
```

Open the object workspace at:

```text
http://localhost:5174/?workspace=objects
```

The studio workspace navigator switches between Composer, Geometry and Objects.

## Object definitions

Each object definition contains:

- a stable definition ID;
- a player-facing authoring name;
- a required initial state ID;
- one or more named states.

Definitions can be placed repeatedly in different scenes. Placed object instances keep independent persistent state through their own object IDs.

## Object states

A state may define:

- whether the object is visible;
- an image or compiled sprite-frame visual;
- an interaction polygon;
- an authored walk-to offset;
- a facing direction;
- a cursor override;
- state-specific interactions;
- fallback response text.

The editor currently exposes visibility, cursor, fallback response, initial-state selection and state-specific verbs. Visual and polygon editing will be connected to compiled asset previews and the native scene canvas.

## State-specific verbs

Interactions are canonical adventure commands, not arbitrary UI callbacks. Each interaction contains:

- a stable interaction ID;
- a verb;
- an optional selected inventory item;
- an optional condition;
- one or more typed story actions;
- optional one-time consumption.

The first interaction inspector supports verb names, one-time behavior, spoken response text and action inspection. Additional action editors will cover flags, variables, inventory, score, scene changes, dialogues, sequences and object state transitions.

## Command history

All object edits use `@evavo/adventure-editor-core`.

State creation, state removal, initial-state changes and interaction edits are implemented as `replace-object-definition` commands. The command engine validates:

- stable definition identity;
- globally unique state and interaction IDs;
- the continued existence of the initial state;
- referenced definitions before deletion;
- atomic undo and redo.

## Runtime relationship

At runtime, `set-object-state` actions update the save-state record keyed by placed object ID. Rendering, hit testing and verb resolution read the object definition's active state again after movement completes. A queued command therefore cannot execute stale state behavior.

## Current limitations

The next object-authoring features are:

- compiled visual previews;
- interaction polygon editing on the native canvas;
- walk-to offset handles;
- full typed action editing;
- condition builders;
- inventory-item selection;
- object-definition creation and safe deletion;
- object state transition graphs;
- validation navigation from issues to fields;
- automatic local recovery integration.
