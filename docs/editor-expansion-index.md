# Adventure Studio editor expansion

This index maps the current authoring surfaces to their canonical data and command packages.

| Workspace | Route or app | Canonical document | Command package |
| --- | --- | --- | --- |
| Scene Composer | `/?workspace=composer` | scene composition manifest | `@evavo/adventure-editor-core` |
| Project Geometry | `/?workspace=geometry` | source `project.json` scenes | `@evavo/adventure-project-editor-core` |
| Object States | `/?workspace=objects` | scene composition object definitions | `@evavo/adventure-editor-core` |
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

Dialogue graphs and cinematic sequences are edited as focused documents for usable tooling. They are not independent shipping formats.

When saved into a project, the Narrative Project Library performs protected replacement in canonical `project.json`. Typed action callers prevent unsafe removal.

## Verification

The primary repository workflow remains `.github/workflows/ci.yml`.

The editor expansion also has `.github/workflows/editor-expansion-ci.yml`, which verifies:

- the dedicated TypeScript expansion graph;
- editor command and workspace tests;
- the main Studio build;
- the Cinematic Timeline Lab build;
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
  apps/studio/tests `
  apps/timeline-lab/tests
pnpm --filter @evavo/adventure-studio-app build
pnpm --filter @evavo/adventure-timeline-lab build
```

A build must not be described as successful until one of these workflows or commands has completed with evidence.
