# Dialogue graph editor

## Purpose

The Dialogue workspace authors conversation structure independently from presentation layout. The same graph can later appear as sentence choices, topic menus, portrait close-ups, interrogations or automatic in-scene exchanges.

## Run the workspace

```powershell
pnpm dev:studio
```

Open:

```text
http://localhost:5174/?workspace=dialogue
```

## Dialogue editor core

`@evavo/adventure-dialogue-editor-core` owns immutable graph commands for:

- graph replacement;
- node insertion, removal and replacement;
- spoken line insertion, removal and replacement;
- player choice insertion, removal and replacement;
- atomic command batches;
- undo, redo and saved-state comparison.

The core protects:

- the dialogue start node;
- nodes referenced by automatic continuation;
- nodes referenced by player choices;
- stable graph, node, line and choice identity;
- globally unique nested dialogue IDs;
- non-empty command batches.

## Current visual workspace

The representative `Missing Ledger` interview demonstrates:

- topic-node navigation;
- a compact graph overview strip;
- speaker-specific performance lines;
- optional acting animation states;
- interruptible lines;
- player-facing response text;
- branch targets;
- dialogue closure;
- one-time or exhausted choices;
- typed choice actions;
- undo and redo;
- standalone graph export.

## Canonical project integration

Standalone dialogue edits are merged into `project.json` through `@evavo/adventure-narrative-library-editor-core`.

The project library rejects dialogue removal while any typed `start-dialogue` action still references it. It scans scene interactions, other dialogue actions, sequence skip actions and sequence story tracks.

## Runtime relationship

The runtime dialogue engine keeps these concepts separate:

- visibility;
- availability;
- consumed or exhausted state;
- line delivery;
- node entry actions;
- node exit actions;
- automatic continuation;
- explicit closure.

The visual editor must preserve these distinctions rather than reducing dialogue to a list of text strings.

## Remaining work

The next dialogue features are:

- true spatial node layout with branch connectors;
- condition builders for visible and enabled choices;
- typed action editing for choices and node boundaries;
- conversation simulation against a selected save state;
- localization columns and missing-translation diagnostics;
- voice asset linking and subtitle timing;
- portrait, close-up and interrogation presentation profiles;
- speaker animation validation;
- project-integrated save rather than standalone graph export;
- safe graph and node rename operations.
