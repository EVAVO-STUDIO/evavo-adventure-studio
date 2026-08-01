# Adventure Studio editor expansion

This index maps the current authoring and inspection surfaces to their canonical data and service packages.

| Workspace | Route or app | Canonical document | Command or service package |
| --- | --- | --- | --- |
| Scene Composer | `/?workspace=composer` | scene composition manifest | `@evavo/adventure-editor-core` |
| Adventure Design Director | `/?workspace=design` | production bible, map, chapters, puzzles, clues and storyboards | `@evavo/adventure-design` |
| Authenticity Lab | `/?workspace=authenticity` | deterministic production audit and native scene briefs | `@evavo/adventure-design/authenticity` |
| Compiled Proof Lab | `/?workspace=evidence` | project, art policy, build manifest, pixel evidence, fonts and UI skins | `@evavo/adventure-design/compiled-evidence` |
| Project Geometry | `/?workspace=geometry` | source `project.json` scenes | `@evavo/adventure-project-editor-core` |
| Object States | `/?workspace=objects` | scene composition object definitions | `@evavo/adventure-editor-core` |
| Sprite & Animation | `/?workspace=animation` | focused actor definition | `@evavo/adventure-animation-editor-core` |
| Art Direction | `/?workspace=art` | art policy plus compiled pixel evidence | `@evavo/adventure-art-direction` |
| Bitmap Fonts | `/?workspace=fonts` | project bitmap-font sidecar | `@evavo/adventure-bitmap-font-editor-core` |
| Interface Skins | `/?workspace=interface` | project UI-skin sidecar | `@evavo/adventure-ui-skin-editor-core` |
| Dialogue | `/?workspace=dialogue` | focused dialogue graph | `@evavo/adventure-dialogue-editor-core` |
| Playtest Inspector | `/?workspace=playtest` | runtime bundle, saves and replay logs | `@evavo/adventure-playtest-inspector` |
| Validation | `/?workspace=validation` | source project plus scene composition | canonical validators |
| Cinematic Timeline Lab | port `5175` | focused sequence | `@evavo/adventure-sequence-editor-core` |
| Narrative Project Library | service layer | project dialogues and sequences | `@evavo/adventure-narrative-library-editor-core` |

## Shared rules

Adventure Design Director provides a deterministic 100-point authored-intent audit and native scene-production briefs. The separate Compiled Proof Lab validates the corresponding build manifests, encoded pixel evidence, bitmap fonts and native interface geometry. A document score cannot stand in for compiled evidence, and a technically valid build cannot stand in for artistic review.

All command packages use:

- serializable discriminated commands;
- inverse commands for undo;
- stable ID protection;
- schema-compatible immutable collection clones;
- deterministic dirty-state comparison;
- recursive batch commands;
- tests that do not require a browser.

Inspection services use the same principle without mutation: parse canonical artifacts, validate exact project and bundle identity, produce deterministic summaries and sort findings by stable evidence path.

## Adventure-level production direction

The Adventure Design Director is a project-scoped production sidecar. It owns the connective design information that would otherwise be scattered across unrelated editor screens:

- native-resolution visual doctrine and authenticity guardrails;
- illustrated locations, travel routes and chapter availability;
- acts, days, missions, eras and open phases;
- puzzle dependencies, clues, hints, alternate solutions and recovery policy;
- shot-based cutscene storyboards with deterministic completion actions;
- production review checklists.

It does not replace executable documents. Cross-document validation links design locations to real project scenes, puzzle steps to inventory items, dialogue-choice triggers to dialogue graphs and completion actions to their canonical project entities.

The package protects referenced locations, chapters, clues, puzzles and cutscenes from unsafe removal. Studio creation tools use atomic command batches when one design operation spans several collections.

## Compiled production proof

`@evavo/adventure-design/compiled-evidence` combines the existing canonical validators and adds adventure-specific production gates. It checks exact project identity, native canvas alignment, integer nearest-neighbour presentation, indexed colour policy, background dimensions, actor atlas completeness, binary alpha, bitmap-font coverage, interface geometry and encoded visual-evidence coverage.

The browser workspace reads all files locally and performs no mutation. A report is verified only when all six required artifacts agree and every visual asset carries encoded pixel evidence. Human 1× native-size review and deterministic playtesting remain required after the technical gate passes.

## Focused documents and project integration

Dialogue graphs, cinematic sequences and actors are edited as focused documents for usable tooling. They are not independent shipping formats.

The Narrative Project Library performs protected dialogue and sequence replacement in canonical `project.json`. Typed action callers prevent unsafe removal.

The animation project-integration contract performs protected actor replacement. It rejects global ID collisions and missing performance states or facings requested by dialogue and cinematic cues.

Art direction is a project-scoped sidecar rather than a focused replacement document. It is evaluated against both `AssetBuildManifest` and `ArtVisualEvidenceManifest`, whose pixel data is measured from encoded PNG outputs.

Bitmap fonts compile into the runtime bundle only after project-atlas and compiled-glyph validation. The player renders glyph sprites from validated runtime assets and never substitutes CSS or vector text.

Interface skins bind the canonical interaction mode to native regions, verbs, bitmap-font roles, inventory, parser, score, dialogue choices and verb coins. They compile only after source validation and compiled icon-frame validation, then drive the same renderer-neutral composer in Studio and packaged gameplay.

Save games and replay logs are packaged-runtime artifacts. Their payload fingerprints and exact runtime-bundle fingerprints are validated before inspection, loading, replay execution or semantic diffing.

## Verification

The primary repository workflow remains `.github/workflows/ci.yml`.

The editor expansion also has `.github/workflows/editor-expansion-ci.yml`. A governed exact-SHA dispatch runs one deliberately selected operating-system lane and calls the shared `check:editor-expansion` command.

The expansion verification includes:

- the dedicated TypeScript expansion graph;
- Adventure Design parsing, semantic validation, dependency ordering and protected history tests;
- authored-intent authenticity and compiled-evidence regression tests;
- editor command and workspace tests;
- art-direction policy and evidence tests;
- bitmap-font layout, authoring, compilation and runtime tests;
- interface-skin schema, editor, compiler, runtime, hit-testing and player tests;
- save-game, deterministic replay and playtest-inspector tests;
- browser Player, Studio, Timeline Lab and CLI builds.

Run the canonical expansion gate from an installed workspace with:

```powershell
pnpm run check:editor-expansion
```

The underlying focused test selection includes:

```text
packages/adventure-design/tests
packages/editor-core/tests
packages/project-editor-core/tests
packages/dialogue-editor-core/tests
packages/sequence-editor-core/tests
packages/narrative-library-editor-core/tests
packages/animation-editor-core/tests
packages/art-direction/tests
packages/bitmap-font/tests
packages/bitmap-font-editor-core/tests
packages/ui-skin/tests
packages/ui-skin-editor-core/tests
packages/save-game/tests
packages/replay/tests
packages/runtime-controller/tests
packages/playtest-inspector/tests
apps/player/tests
apps/studio/tests
apps/timeline-lab/tests
tools/cli/tests
```

A build must not be described as successful until the governed installed-workspace command or workflow has completed with evidence.
