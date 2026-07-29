# Narrative library editor

## Purpose

Dialogue graphs and cinematic sequences are edited as focused documents, but shipped projects store them inside canonical `project.json`.

`@evavo/adventure-narrative-library-editor-core` provides the protected bridge between standalone narrative editors and the project document.

## Supported project commands

The narrative library supports:

- insert dialogue;
- remove dialogue;
- replace dialogue;
- insert sequence;
- remove sequence;
- replace sequence;
- atomic mixed batches;
- undo, redo and saved-state comparison.

Every command is serializable and has a Zod schema.

## Global ID integrity

Inserted or replaced dialogue data is checked for collisions across:

- dialogue graph IDs;
- dialogue node IDs;
- dialogue line IDs;
- dialogue choice IDs;
- all other project IDs.

Sequence data is checked for collisions across:

- sequence IDs;
- sequence track IDs;
- all other project IDs.

Replacement keeps the graph or sequence identity stable while allowing nested content to change.

## Typed reference protection

A narrative asset cannot be removed while a typed action still references it.

The reference scanner covers:

- scene hotspot interaction actions;
- dialogue node entry actions;
- dialogue node exit actions;
- dialogue choice actions;
- sequence skip completion actions;
- sequence story-action cues.

Dialogue removal checks `start-dialogue` actions. Sequence removal checks `play-sequence` actions.

Self-references inside the asset being removed do not block removal because they disappear with the asset. Calls from any other project content do block removal and report the exact source path.

## Undo and redo

Narrative library history stores command and inverse pairs rather than whole UI snapshots.

A mixed batch can remove or replace multiple narrative assets as one user operation. If any child command fails, no partial history entry is produced.

## Editor integration

The Dialogue workspace edits an individual graph through `@evavo/adventure-dialogue-editor-core`.

The Cinematic Timeline lab edits an individual sequence through `@evavo/adventure-sequence-editor-core`.

When the focused document is saved back to a project, the library editor performs the canonical `replace-dialogue` or `replace-sequence` operation. This preserves project-level identity, undo and caller protection.

## Remaining work

The next integration tasks are:

- expose narrative library history in the main studio project session;
- merge focused editor save operations back into the loaded project automatically;
- add project-wide caller lists in dialogue and sequence inspectors;
- add safe rename operations that rewrite typed references;
- extend reference checking to authored external localization and achievement documents;
- surface narrative library validation in the Validation Centre.
