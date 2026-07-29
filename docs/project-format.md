# Project Format and Compilation

## Principle

The source project is a directory of small, versioned, human-readable documents and original assets. The playable game consumes a compiled bundle. Editor state, source documents, runtime state and exported builds are distinct formats.

A project must remain reviewable in Git, recoverable after an interrupted save, migratable across schema versions and editable without loading every room into memory.

## Source layout

```text
my-adventure/
  project.json
  presentation.json
  assets/
    manifest.json
    source/
  characters/
    <character-id>.json
  scenes/
    <scene-id>/
      scene.json
      navigation.json
      depth.json
      occlusion.json
      ambience.json
  dialogues/
    <dialogue-id>.json
  sequences/
    <sequence-id>.json
  inventory/
    items.json
  score/
    awards.json
  interfaces/
    <interface-id>.json
  locales/
    en-AU.json
  extensions/
  .evavo/
    workspace.json
```

The `.evavo` directory contains local workspace information such as open panels, recent selections and editor-only cache records. It is not part of game logic and can normally be ignored by source control.

## Canonical identity

Every addressable authored entity has:

- a stable typed ID;
- a display name that may change without breaking references;
- an optional author note;
- creation and schema metadata where useful.

File names use stable IDs rather than mutable display names. References are IDs, never array positions or relative object pointers.

IDs are generated once and are not recycled. Copying an entity generates new IDs for the copy and rewrites references within the copied subgraph.

## Schema ownership

Canonical structural schemas are authored in `packages/project-schema` with Zod. The build generates checked-in JSON Schema artifacts for:

- external tooling;
- editor workers;
- command-line validation;
- schema-aware text editors;
- future third-party integrations.

Schema generation is deterministic and tested. Refinements that cannot be represented faithfully in JSON Schema remain explicit semantic validators.

Every document includes a document kind and schema version. The project root also declares the project-format version and minimum compatible studio version.

## Migrations

Migrations are pure, ordered transformations:

```text
old document -> migrated document + migration diagnostics
```

Rules:

1. source files are backed up before a write migration;
2. migrations can run in memory for preview;
3. each migration is fixture-tested;
4. a migration never depends on current editor UI state;
5. cross-document migrations run through a project transaction;
6. failures leave the original project untouched;
7. migration reports list every changed document and generated ID.

The studio reads supported older projects through the migration layer. Runtime builds contain only the current compiled format.

## Editor document transactions

The editor never lets a React component write files directly. A user or automation operation becomes an `EditorCommand` handled by `editor-core`.

A transaction contains:

- command ID and command kind;
- input arguments;
- affected document IDs;
- before and after revisions;
- generated diagnostics;
- inverse command or reversible patch;
- optional grouping key for compound undo.

The in-memory document store applies the transaction, runs incremental validation and marks affected documents dirty. Saving writes a complete candidate to temporary files, synchronises them, then replaces canonical files atomically where the host permits.

Multi-document changes use a transaction journal so recovery can identify incomplete operations.

## Undo and redo

Undo and redo operate on semantic editor commands rather than arbitrary text diffs. This preserves intent for operations such as:

- moving a polygon vertex;
- renaming an entity;
- changing a sprite pivot;
- connecting dialogue nodes;
- splitting a navigation surface;
- moving a timeline event;
- replacing an asset and updating metadata.

External file edits are detected by revision hashes. The editor offers reload, compare or merge rather than silently overwriting changed source.

## Asset source and compiled asset separation

Original assets remain in the source project. The compiler produces deterministic runtime assets in a build cache keyed by:

- source content hash;
- import settings;
- compiler version;
- target presentation profile;
- output format version.

Runtime asset metadata is generated, not hand-edited. Source metadata such as pivots, palette ranges and animation markers remains authored and versioned.

## Project compilation

Compilation performs these stages:

1. discover root and documents from explicit manifests;
2. parse and structurally validate source documents;
3. migrate supported older documents in memory;
4. resolve and type-check references;
5. run semantic and reachability validation;
6. compile images, atlases, fonts and audio metadata;
7. compile conditions, actions, dialogue and sequences into runtime records;
8. assign stable bundle indexes without changing source IDs;
9. emit a content manifest and hashes;
10. verify the emitted bundle by reading it back;
11. optionally package the bundle for web or desktop targets.

The compiled bundle may optimise lookup tables and use compact binary sections, but diagnostics and save files retain stable source IDs.

## Runtime bundle

The runtime bundle includes only what is required to play:

- compiled project metadata;
- presentation profile;
- resolved scene records;
- actor, animation and interface data;
- interaction and dialogue programs;
- sequence programs;
- localisation tables;
- compiled asset manifest and assets;
- schema and build version metadata;
- bundle content hash.

Editor panel state, original source images, author notes, undo history and unused draft content are excluded unless a development build opts in.

## Save games

A save is a versioned runtime-state snapshot, not a serialised renderer or JavaScript object graph.

It records:

- project ID and compatible release identity;
- save schema version;
- current scene and entrance;
- simulation tick;
- named deterministic random-stream states;
- flags and variables;
- inventory and score awards;
- actor and object states;
- dialogue memory;
- running resumable tasks where policy permits;
- play time and user-facing metadata;
- checksum.

Transient GPU objects, audio nodes, DOM state and editor state are never stored.

The runtime defines explicit safe-save boundaries. A cutscene can either expose a resumable checkpoint or defer saving until a deterministic boundary.

## Localisation

User-visible text is stored through stable text keys. Source documents may provide convenient inline authoring text, but compilation extracts or resolves it into locale tables.

Dialogue timing uses language-aware estimates and optional recorded speech lengths. Layout validation checks each locale against its target dialogue and interface bounds.

## Extensions

Most projects use typed built-in conditions and actions. Advanced extensions are optional modules registered through explicit capabilities.

Extensions cannot directly receive renderer, filesystem or unrestricted runtime internals. They declare:

- extension ID and version;
- required capabilities;
- serialisable input and output schemas;
- deterministic or non-deterministic status;
- save and replay implications;
- supported targets.

A release build fails when a required extension is unavailable or violates the target policy.

## Validation layers

### Structural

- document parses;
- required properties and allowed values;
- version compatibility;
- basic shape and number constraints.

### Referential

- unique IDs;
- targets exist and have the expected kind;
- assets and locale keys exist;
- entry points and exits resolve.

### Geometric

- valid non-self-intersecting polygons where required;
- reachable walk targets;
- connected navigation surfaces;
- valid depth and scale ranges;
- masks and fields match scene dimensions.

### Narrative and puzzle

- reachable scenes and dialogue nodes;
- required item availability;
- possible score maximum;
- once-only awards and interactions;
- cutscene skip equivalence;
- configurable soft-lock analysis;
- required information that can become permanently unavailable.

### Presentation

- missing animation states;
- invalid pivots or frame rectangles;
- palette and colour-limit violations;
- text overflow;
- unsupported target formats;
- cursor and fallback coverage.

Diagnostics use stable codes, severity, document ID and an exact source location or entity path. Automated fixes are separate commands and are never applied silently.

## Automation contract

The same project service used by the visual editor is exposed through the CLI and future agent tools. Automation can:

- inspect entities and references;
- execute editor commands;
- run validation;
- build previews;
- capture rendering fixtures;
- compare project revisions;
- create transaction reports.

Automation does not edit JSON with blind string replacement. Every mutation passes through schemas, transactions and validation.
