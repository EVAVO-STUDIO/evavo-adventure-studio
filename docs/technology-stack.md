# Technology Stack

## Decision

EVAVO Adventure Studio uses a TypeScript monorepo with a renderer-independent adventure runtime, a PixiJS WebGL renderer, a React and Vite authoring studio, and an optional Tauri desktop shell.

The stack is deliberately smaller than a general-purpose game engine. Adventure logic, authored content and save data must not depend on PixiJS, React, the browser DOM, Tauri or any editor component.

## Supported platform baseline

- Node.js 24 LTS for development, builds and command-line tooling.
- pnpm 11 workspaces for dependency management.
- TypeScript 7 in strict mode.
- ES2022 as the shared package output baseline.
- Modern Chromium, Firefox, Safari and Tauri webviews for the editor and web player.
- Windows is the primary desktop development environment, while packages remain portable.

Exact tool versions are pinned at the repository root and updated deliberately.

## Monorepo responsibilities

### Applications

- `apps/studio`: visual authoring application.
- `apps/player`: browser player and development preview shell.
- `apps/desktop`: Tauri desktop wrapper for filesystem access, native dialogs, updates and packaged editor builds.

### Core packages

- `packages/project-schema`: canonical authoring schemas, migrations and generated JSON Schema.
- `packages/core`: deterministic state, commands, events, fixed-step scheduler, seeded random streams and save contracts.
- `packages/scene`: geometry, hit testing, navigation, scale, elevation, depth, occlusion and camera solving.
- `packages/interaction`: verbs, cursors, inventory targeting and interaction resolution.
- `packages/dialogue`: dialogue graphs, topic memory, conditions, choice state and conversation playback.
- `packages/sequence`: typed cinematic and ambient timelines.
- `packages/render-contract`: renderer-neutral frame descriptions and presentation contracts.
- `packages/renderer-pixi`: PixiJS implementation of the render contract.
- `packages/audio-web`: audio buses, cues, speech, music and ambience adapter.
- `packages/editor-core`: documents, transactions, commands, undo, redo, selection and dirty-state tracking.
- `packages/validation`: structural, semantic, reachability and soft-lock analysis.
- `packages/asset-pipeline`: image inspection, quantisation, atlases, metadata and deterministic asset builds.
- `packages/testkit`: fixtures, replay tools, golden scenes and deterministic test helpers.

### Tools and examples

- `tools/cli`: project validation, builds, migrations and diagnostics.
- `tools/schema-generator`: checked-in JSON Schema generation.
- `tools/golden-render`: repeatable renderer capture and comparison.
- `examples/vertical-slice`: small complete playable game exercising the whole stack.
- `examples/rendering-lab`: isolated visual authenticity fixtures.
- `examples/puzzle-fixtures`: reachability and interaction validation cases.

## Approved dependency families

### Runtime and rendering

- `pixi.js`: production WebGL rendering, texture atlases, render textures, filters and explicit render layers.
- `@pixi/sound`: Pixi-integrated Web Audio playback behind the EVAVO audio adapter.
- `earcut`: triangulation of authored polygons when the renderer or debugging overlays require meshes.
- `robust-predicates`: numerically safer orientation tests for geometry tooling where ordinary floating-point tests are insufficient.

PixiJS is an adapter, not the engine model. No canonical project file stores a Pixi class, texture object or display-object reference.

### Schemas and validation

- `zod`: the canonical TypeScript-authored runtime schema and migration boundary.
- `ajv`: compiled validation of emitted JSON Schema for CLI, worker and external-tool workflows.

Zod is the source of structural truth. JSON Schema is generated and checked into the repository. Semantic validation remains separate because file schemas cannot prove puzzle reachability, score correctness or absence of soft locks.

### Editor

- `react` and `react-dom`: editor application composition.
- `vite`: editor and player development, production builds and worker bundling.
- `@xyflow/react`: dialogue, sequence and logic graph canvases.
- Radix UI primitives: accessible behaviour for menus, dialogs, popovers, tabs and controls without imposing a visual style.
- `zustand`: small transient editor and workspace state only.
- `react-resizable-panels`: docked studio panels.
- `@dnd-kit/*`: accessible drag-and-drop interactions.
- `monaco-editor`: advanced script, JSON and diagnostic editing when a code surface is appropriate.

Canonical project documents are owned by `editor-core`, not by React component state or Zustand. React views dispatch serialisable editor commands.

### Desktop integration

- Tauri 2 and narrowly scoped official plugins for filesystem access, dialogs, logging, process control, single-instance handling, update delivery and window-state persistence.

The web studio remains functional without Tauri. Desktop capabilities are requested through an adapter with explicit permissions.

### Assets and packaging

- `sharp`: deterministic image inspection, resizing, palette conversion, indexed PNG export, controlled dithering and atlas preparation.
- `fflate`: deterministic archive creation for portable project and build bundles.

External tools such as Aseprite or FFmpeg may be integrated through optional import adapters. They are not required to open, edit or build a project.

### Quality

- `vitest`: unit, scenario, migration, replay and package tests.
- `@playwright/test`: editor workflows and controlled visual regression captures.
- `fast-check`: property tests for geometry, reducers, commands and serialisation.
- Biome: formatting, linting and import organisation.

## Dependency direction

Dependencies point inward:

```text
apps and tools
    -> editor, renderer and adapters
        -> scene, interaction, dialogue, sequence and validation
            -> core and render-contract
                -> project-schema
```

The following are prohibited:

- `project-schema` importing a runtime, renderer or editor package;
- the renderer mutating game state;
- the runtime importing React, PixiJS or Tauri;
- editor components directly rewriting JSON files;
- circular workspace dependencies;
- project content depending on application routes or browser globals.

## Technologies not selected initially

- Phaser is not the runtime foundation because EVAVO needs a bespoke adventure compositor and editor rather than arcade-game conventions and physics systems.
- Electron is not the initial desktop shell because the browser-first studio can use Tauri for a smaller native wrapper and capability-scoped filesystem access.
- A general ECS is not the authored story model. Adventure concepts such as scenes, actors, conversations, entrances and score awards remain explicit domain types.
- XState is not the global game runtime. The deterministic command reducer and task scheduler remain the canonical state machine; focused editor workflows may still use local finite-state machines.
- A physics engine is not included. Navigation, collision and staging are authored two-dimensional geometry problems.
- A database is not the source project format. Projects remain reviewable, versionable files with stable IDs and migrations.
- A task orchestrator is not required at repository creation. pnpm recursive scripts are sufficient until measured build scale justifies another system.

## Package admission rule

A new production dependency must provide a capability that is expensive or risky to maintain ourselves, have a compatible licence, support current runtime targets, avoid owning canonical project state, and be covered by an adapter or a clear package boundary.

Dependency additions must include:

1. the problem being solved;
2. why an existing package cannot solve it;
3. licence and maintenance status;
4. browser, Node and desktop compatibility;
5. deterministic-build implications;
6. an exit or replacement strategy for foundational adapters.
