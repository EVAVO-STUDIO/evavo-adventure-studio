# Foundation Implementation Roadmap

## Delivery rule

Each phase must produce a tested vertical capability and preserve all earlier fixtures. The studio UI does not lead the architecture. Canonical schemas, deterministic services and renderer contracts are established first, then exposed through the editor.

## Phase 1: Repository and schema kernel

Deliver:

- workspace package boundaries;
- shared TypeScript configurations;
- canonical ID and revision types;
- Zod document schemas;
- generated JSON Schema;
- schema fixture corpus;
- pure versioned migrations;
- diagnostic model and stable diagnostic codes;
- CLI commands for parse, validate and migrate preview.

Acceptance:

- a minimal project can be parsed and validated;
- invalid fixtures fail with exact document paths;
- generated schemas are stable across two runs;
- migration fixtures are byte-stable after normalised formatting;
- no schema package imports renderer, editor or platform code.

## Phase 2: Deterministic runtime kernel

Deliver:

- immutable canonical runtime state;
- serialisable commands and events;
- fixed-step scheduler;
- named seeded random streams;
- condition evaluator;
- typed action executor;
- scene entry and exit lifecycle;
- inventory and idempotent score awards;
- save and replay format.

Acceptance:

- identical command logs produce identical state hashes;
- save, load and continue matches uninterrupted execution;
- repeated score awards cannot duplicate points;
- simulation results are independent of render frame cadence;
- rejected commands are typed and do not partially mutate state.

## Phase 3: Scene geometry and interaction

Deliver:

- robust point, segment and polygon operations;
- hotspot hit testing with deterministic overlap priority;
- navigation surfaces, links and portals;
- path solving and authored staging points;
- elevation and scale solving;
- stable depth sorting;
- baseline, mask and depth-field occlusion contracts;
- verb, cursor, inventory-target and fallback resolution.

Acceptance:

- fixtures cover narrow passages, holes, disconnected surfaces, stairs and balconies;
- walk targets are validated as reachable;
- overlapping hotspots resolve predictably;
- equal-depth entities retain stable order;
- navigation, scaling and occlusion can be changed independently.

## Phase 4: Renderer contract and rendering laboratory

Deliver:

- renderer-neutral frame description;
- PixiJS WebGL adapter;
- native render texture and integer presentation scaler;
- asset, atlas, pivot and frame metadata loader;
- software cursor and native input mapping;
- camera and parallax resolver;
- palette-index shader path;
- bitmap text and pixel UI primitives;
- golden rendering laboratory.

Acceptance:

- exact-pixel nearest-neighbour fixtures pass;
- no atlas bleeding at supported scales;
- strict camera motion has no alternating one-pixel jitter;
- all occlusion modes match golden images;
- cursor hit coordinates remain correct through letterboxing;
- palette cycles are deterministic in replay.

## Phase 5: Characters and performance

Deliver:

- actor definitions and scene instances;
- semantic animation state machine;
- per-frame tick durations;
- pivots, foot points and attachment sockets;
- facing and mirroring policy;
- locomotion following scene paths;
- turn, start, stop and interaction transitions;
- speech animation and optional mouth cues;
- animation event markers.

Acceptance:

- feet remain planted across trimmed frames;
- actor movement and animation remain deterministic;
- props attached to hands do not alter story state through rendering;
- interruption and transition policies are fixture-tested;
- low-cadence held-frame animation remains visually intentional.

## Phase 6: Dialogue and cinematic sequences

Deliver:

- dialogue graph schema and evaluator;
- visibility, availability, exhaustion and repeatability states;
- topic memory and conversation variables;
- speech, subtitle and portrait presentation contracts;
- typed parallel sequence tracks;
- waits, movement, animation, camera, audio, state and transition actions;
- safe skip boundaries and deterministic completion actions;
- sequence debugger and timeline trace.

Acceptance:

- dialogue reachability diagnostics identify dead nodes;
- choices cannot accidentally disappear before required information is available;
- skipping and watching a sequence produce equivalent canonical story state;
- parallel tracks have deterministic ordering for same-tick events;
- save policy is explicit at every sequence boundary.

## Phase 7: Asset compiler

Deliver:

- source asset manifest;
- image inspection and validation;
- deterministic trimming and atlas packing;
- palette quantisation and indexed export;
- bitmap-font compiler;
- cursor and animation imports;
- content-addressed cache;
- compiled asset manifest and provenance records.

Acceptance:

- unchanged inputs produce unchanged output hashes;
- pivots and source dimensions survive trimming;
- palette, alpha and colour-count diagnostics are reproducible;
- corrupted or unsupported assets fail before runtime packaging;
- compiler output can be fully verified by readback.

## Phase 8: Semantic project compiler

Deliver:

- cross-document reference resolver;
- scene, dialogue and sequence compilation;
- narrative reachability graph;
- item and prerequisite analysis;
- possible-score analysis;
- soft-lock warnings;
- compiled runtime bundle and manifest;
- development and release build profiles.

Acceptance:

- a complete vertical-slice project compiles without editor involvement;
- runtime opens only the compiled bundle;
- missing references cannot reach packaging;
- the bundle verifies its content hashes before launch;
- unused drafts can be excluded without breaking source projects.

## Phase 9: Editor core and first studio shell

Deliver:

- document repository and revision tracking;
- serialisable editor commands;
- transactions, undo and redo;
- autosave and crash-recovery journal;
- incremental worker validation;
- project, scene and playtest workspaces;
- Tauri capability adapter and browser fallback;
- selection, zoom, guides and native-pixel preview.

Acceptance:

- editor and CLI operations use the same project service;
- compound operations undo as one transaction;
- interrupted writes leave the original project recoverable;
- external file changes are detected rather than overwritten;
- the browser build can edit an in-memory or user-selected project without desktop APIs.

## Phase 10: Full adventure-production workspaces

Add in measured vertical slices:

- navigation, scale and occlusion workspace;
- hotspot and interaction workspace;
- character and sprite animation workspace;
- dialogue graph;
- sequence timeline;
- inventory and puzzle-state tools;
- interface and cursor designer;
- audio and ambience editor;
- localisation and text-fit tools;
- validation centre and reachability explorer;
- save-state inspector and replay debugger;
- build and export centre.

Each workspace must manipulate canonical documents through editor commands and include at least one end-to-end fixture.

## Phase 11: Export targets

Deliver in this order:

1. browser development player;
2. static web release;
3. Tauri Windows player;
4. Tauri Windows studio package;
5. macOS and Linux packages after automated compatibility evidence;
6. optional mobile wrappers only after interaction and layout profiles are validated.

The runtime remains the same compiled bundle consumer across targets.

## Continuous quality gates

Every pull request eventually runs:

- formatting and linting;
- strict type checking;
- unit and property tests;
- migration and schema fixtures;
- deterministic replay checks;
- semantic project compilation;
- asset compiler stability tests;
- renderer pixel-readback tests;
- controlled Playwright visual comparisons;
- application production builds;
- dependency licence and vulnerability review.

## First playable milestone

The first complete milestone is a five-room mystery vignette that proves:

- splash, title and save flow;
- scrolling and fixed rooms;
- actor walk, turn, talk and use animation;
- layered depth, stairs and partial occlusion;
- at least three interaction presentations;
- inventory combination and evidence presentation;
- branching dialogue with remembered topics;
- a skippable in-scene cinematic;
- score and non-score project profiles;
- music, ambience, speech and positional effects;
- save, load and deterministic replay;
- web and Windows development builds;
- automated validation for one deliberately broken puzzle variant.

This milestone is intentionally small enough to finish but broad enough to prove that the architecture can create the intended range of games.
