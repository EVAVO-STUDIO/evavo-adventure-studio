# Adventure Studio editor expansion

This index maps the current authoring surfaces to their canonical data and command packages.

| Workspace | Route or app | Canonical document | Command package |
| --- | --- | --- | --- |
| Scene Composer | `/?workspace=composer` | scene composition manifest | `@evavo/adventure-editor-core` |
| Project Geometry | `/?workspace=geometry` | source `project.json` scenes | `@evavo/adventure-project-editor-core` |
| Object States | `/?workspace=objects` | scene composition object definitions | `@evavo/adventure-editor-core` |
| Sprite & Animation | `/?workspace=animation` | focused actor definition | `@evavo/adventure-animation-editor-core` |
| Art Direction | `/?workspace=art` | art policy plus compiled pixel evidence | `@evavo/adventure-art-direction` |
| Bitmap Fonts | `/?workspace=fonts` | project bitmap-font sidecar | `@evavo/adventure-bitmap-font-editor-core` |
| Dialogue | `/?workspace=dialogue` | focused dialogue graph | `@evavo/adventure-dialogue-editor-core` |
| Validation | `/?workspace=validation` | source project plus scene composition | canonical validators |
| Cinematic Timeline Lab | port `5175` | focused sequence | `@evavo/adventure-sequence-editor-core` |
| Narrative Project Library | service layer | project dialogues and sequences | `@evavo/adventure-narrative-library-editor-core` |

## Shared rules

All command packages use:

- serializable discriminated commands;
- inverse commands for undo;
- stable ID protection;
- schema-compatible immutable collection clones;
- deterministic dirty-state comparison;
- recursive batch schemas;
- tests that do not require a browser.

## Focused documents and project integration

Dialogue graphs, cinematic sequences and actors are edited as focused documents for usable tooling. They are not independent shipping formats.

The Narrative Project Library performs protected dialogue and sequence replacement in canonical `project.json`. Typed action callers prevent unsafe removal.

The animation project-integration contract performs protected actor replacement. It rejects global ID collisions and missing performance states or facings requested by dialogue and cinematic cues.

Art direction is a project-scoped sidecar rather than a focused replacement document. It is evaluated against both `AssetBuildManifest` and `ArtVisualEvidenceManifest`, whose pixel data is measured from encoded PNG outputs.

Bitmap fonts are also a project-scoped sidecar. They compile into the runtime bundle only after project-atlas and compiled-glyph validation. The player renders glyph sprites from validated runtime assets and never substitutes CSS or vector text.

## Verification

The primary repository workflow remains `.github/workflows/ci.yml`.

The editor expansion also has `.github/workflows/editor-expansion-ci.yml`, which verifies:

- the dedicated TypeScript expansion graph;
- editor command and workspace tests;
- art-direction policy and evidence tests;
- bitmap-font layout, authoring, compilation and runtime tests;
- browser player, Studio, Timeline Lab and CLI builds;
- Windows and Linux behavior.

Run the expansion graph locally with:

```powershell
pnpm install
pnpm exec tsc -b tsconfig.editor-expansion.json --pretty false
pnpm exec vitest run `
  packages/editor-core/tests `
  packages/project-editor-core/tests `
  packages/dialogue-editor-core/tests `
  packages/sequence-editor-core/tests `
  packages/narrative-library-editor-core/tests `
  packages/animation-editor-core/tests `
  packages/art-direction/tests `
  packages/bitmap-font/tests `
  packages/bitmap-font-editor-core/tests `
  packages/renderer-pixi/tests `
  apps/player/tests `
  apps/studio/tests `
  apps/timeline-lab/tests `
  tools/cli/tests
pnpm --filter @evavo/adventure-player build
pnpm --filter @evavo/adventure-studio-app build
pnpm --filter @evavo/adventure-timeline-lab build
pnpm --filter @evavo/adventure-cli build
```

A build must not be described as successful until one of these workflows or commands has completed with evidence.
