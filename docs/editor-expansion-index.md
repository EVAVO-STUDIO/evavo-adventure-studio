# Adventure Studio editor expansion

This index maps the current authoring and inspection surfaces to their canonical data and service packages.

| Workspace | Route or app | Canonical document | Command or service package |
| --- | --- | --- | --- |
| Scene Composer | `/?workspace=composer` | scene composition manifest | `@evavo/adventure-editor-core` |
| Classic Game Creator | `/?workspace=creator` | guided production profile and project seed | `@evavo/adventure-design/production-profiles` |
| Classic Experience Polish | `/?workspace=polish` | experience and presentation review | `@evavo/adventure-design` and runtime services |
| Production Profile Atelier | `/?workspace=profiles` | profile contract, canonical seed, original splash and showcase brief | `@evavo/adventure-design/production-profiles` |
| Native Showcase Gallery | `/?workspace=showcases` | original profile showcase plates | `@evavo/adventure-design/production-profiles` |
| Motion & Feel | `/?workspace=feel` | deterministic movement and camera profile | `@evavo/adventure-play-feel` |
| Adventure Design Director | `/?workspace=design` | production bible, map, chapters, puzzles, clues and storyboards | `@evavo/adventure-design` |
| Authenticity Lab | `/?workspace=authenticity` | deterministic production audit and native scene briefs | `@evavo/adventure-design/authenticity` |
| Compiled Proof Lab | `/?workspace=evidence` | project, art policy, build manifest, pixel evidence, fonts and UI skins | `@evavo/adventure-design/compiled-evidence` |
| Native Composition Lab | `/?workspace=composition` | canonical scene geometry plus linked design location | `@evavo/adventure-design/scene-readability` |
| Native Staging Lab | `/?workspace=staging` | canonical scene instances and initial runtime staging | `@evavo/adventure-design/scene-staging` |
| Progression Flow Lab | `/?workspace=progression` | bounded canonical state graph, shortest witnesses and branch recovery | `@evavo/adventure-design/progression` |
| Project Geometry | `/?workspace=geometry` | source `project.json` scenes | `@evavo/adventure-project-editor-core` |
| Object States | `/?workspace=objects` | scene composition object definitions | `@evavo/adventure-editor-core` |
| Sprite & Animation | `/?workspace=animation` | focused actor definition | `@evavo/adventure-animation-editor-core` |
| Art Direction | `/?workspace=art` | art policy plus compiled pixel evidence | `@evavo/adventure-art-direction` |
| Bitmap Fonts | `/?workspace=fonts` | project bitmap-font sidecar | `@evavo/adventure-bitmap-font-editor-core` |
| Interface Skins | `/?workspace=interface` | project UI-skin sidecar | `@evavo/adventure-ui-skin-editor-core` |
| Audio Studio | `/?workspace=audio` | project audio-mix sidecar | `@evavo/adventure-audio-editor-core` |
| Dialogue | `/?workspace=dialogue` | focused dialogue graph | `@evavo/adventure-dialogue-editor-core` |
| Playtest Inspector | `/?workspace=playtest` | runtime bundle, saves and replay logs | `@evavo/adventure-playtest-inspector` |
| Validation | `/?workspace=validation` | source project plus canonical sidecars | canonical validators |
| Cinematic Timeline Lab | port `5175` | focused sequence | `@evavo/adventure-sequence-editor-core` |
| Narrative Project Library | service layer | project dialogues and sequences | `@evavo/adventure-narrative-library-editor-core` |

## Shared rules

Production profiles establish one coherent visual, interface, puzzle, audio and splash language before content authoring begins. Adventure Design Director then provides a deterministic authored-intent audit and native scene-production briefs. The separate Compiled Proof Lab validates corresponding build manifests, encoded pixel evidence, bitmap fonts and native interface geometry. The Native Composition Lab audits canonical walk, depth, entrance, hotspot and occlusion geometry at the exact scene canvas. The Native Staging Lab audits the actors, stateful props, portal handoffs, player-control candidates and layer order that inhabit that geometry. The Progression Flow Lab explores the actual state-changing consequences that connect scenes, inventory, dialogue, sequences and object states. Audio Studio connects those same scenes, sequences and dialogue lines to deterministic soundscapes, cue policy, speech recordings and bus behavior.

A document score cannot stand in for compiled evidence, and a technically valid build cannot stand in for artistic, listening or playtest review.

All command packages use:

- serializable discriminated commands;
- inverse commands for undo;
- stable ID protection;
- schema-compatible immutable collection clones;
- deterministic dirty-state comparison;
- recursive batch commands;
- validation after a complete atomic batch;
- tests that do not require a browser.

Inspection services use the same principle without mutation: parse canonical artifacts, validate exact project and bundle identity, produce deterministic summaries and sort findings by stable evidence path.

## Production profiles

`@evavo/adventure-design/production-profiles` contains seven original production families:

- Storybook Icon VGA;
- Comic Science-Fiction VGA;
- Gothic Investigation VGA;
- Verb Panel Cartoon VGA;
- Pulp Archaeology VGA;
- Cinematic Pulp VGA;
- Neo-Noir Low-Resolution.

Each profile defines:

- native canvas, indexed palette budget and reserved UI colours;
- background, depth, foreground and revisit doctrine;
- actor silhouette, portrait, costume and performance guidance;
- animation frame range, idle, transition and environmental cadence;
- interface family, compatible interaction modes and persistent chrome allocation;
- puzzle grammars;
- music, ambience, transition and interface sound direction;
- a deterministic original publisher splash;
- an original showcase vertical-slice brief;
- authenticity rules, prohibited shortcuts and required native-review questions.

The profile seed produces canonical `PresentationProfile` defaults and an `AdventureCreativeDirection` for Adventure Design Director. The compatibility audit detects canvas, art-mode, palette, interaction, scaling, sampling, motion, score-policy and project-identity drift.

The built-in profile data contains no commercial title, character, location, dialogue, logo, puzzle solution or interface artwork. Historical game names appear only in research documentation that explains the general production methods being studied.

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

The browser workspace reads all files locally and performs no mutation. A report is verified only when all required artifacts agree and every visual asset carries encoded pixel evidence. Human 1× native-size review and deterministic playtesting remain required after the technical gate passes.

## Native scene composition

`@evavo/adventure-design/scene-readability` evaluates source-project scene geometry in the exact runtime coordinate system. It measures union coverage rather than merely summing overlapping polygons and reports deterministic findings for:

- scene and project native-canvas mismatch;
- navigation outside the canvas, extreme walk coverage and heavy overlap;
- entrance points outside navigation;
- invalid depth ranges, reversed scale and uncovered walk positions;
- hotspot shapes, unreachable walk-to points, silent targets and excessive target coverage;
- foreground positions, baselines and masks outside the scene;
- missing links to Adventure Design location briefs.

The Studio overlay combines walk polygons, far and near depth lines, entrances, hotspots, exits, approach points and occlusion masks over a 1× grid. A separate handoff view turns the same report into review language for background art, actor animation, interaction authoring and level implementation.

## Native scene staging

`@evavo/adventure-design/scene-staging` evaluates the canonical `scene-instances.json` sidecar against the same project scene. It first preserves the existing scene-instance validator and then adds production findings for:

- missing or ambiguous start-scene player control;
- actor frame resolution, native bounds, clipping, entrance clearance and silhouette overlap;
- initial object state, visibility, opacity, interaction shape and reachable approach points;
- consequential targets placed on ambient layers;
- portal distance, traversal animation, route weighting and object obstruction;
- deterministic layer order and artistically significant ordering ties;
- missing composition and design-location links.

The Studio overlay renders actor frame bounds and foot points, object target geometry, object approach points, portal handoffs, entrances and navigation over one native stage. The layer-order view exposes the exact layer, elevation, baseline, z-offset and stable-ID ordering that the packaged runtime receives. Staging review therefore connects Composer and Object authoring to final actor, prop, animation and runtime evidence without creating a second shipping format.

## Progression flow

`@evavo/adventure-design/progression` performs bounded breadth-first exploration over the same canonical consequence model used by gameplay. It follows source hotspots, stateful object interactions, inventory requirements, flags, variables, one-shot memory, dialogue choices, sequence story actions, deterministic sequence completion and scene changes.

The evaluator produces:

- required scene and item objective coverage derived from Adventure Design;
- the proven runtime scene-transition graph;
- shortest witness paths for scenes, items, dialogues, sequences and object states;
- terminal branch summaries;
- unreachable required content findings;
- potential soft-lock findings for branches that cannot return to the maximum explored objective coverage;
- explicit truncation, looping-sequence and recursion findings when exhaustive proof is unavailable.

State exploration is deliberately bounded by maximum states and decision depth. A complete report means the configured graph was exhausted, not that human playtesting, timing, readability or puzzle enjoyment has been proven. The shortest witness should be replayed against the compiled Player and retained as deterministic replay evidence before release.

## Runtime narrative closure

`@evavo/adventure-scene-runtime/narrative` resolves dialogue and sequence requests emitted by canonical actions. It preserves emitted ordering, starts requested narrative content, advances active sequences, processes nested requests and fails visibly on missing or recursively unbounded targets.

`@evavo/adventure-scene-runtime/commands` advances interactive movement, pending object commands and blocking narrative playback one logical tick at a time. Scene changes clear stale movement and command state from the previous room.

## Deterministic audio production

`AudioMixManifest` is a project-scoped sidecar containing:

- required master and content buses;
- bus volume, mute, voice-limit and stealing policy;
- reusable cues with offsets, fades, loop regions, crossfades, priorities and polyphony;
- ordered music, ambience and room-tone layers for each scene;
- dialogue-line speech bindings and ordered performance markers;
- deterministic ducking relationships.

`@evavo/adventure-audio-editor-core` protects stable IDs and referenced cues, applies immutable serializable commands, validates after complete batches and produces exact inverse commands. A cue and every caller can therefore migrate atomically without exposing a broken intermediate document.

The compiler validates the mix against source project entities and compiled audio evidence, then embeds a canonically ordered copy in the source-free runtime bundle. `@evavo/adventure-audio-controller` derives soundscape, dialogue and sequence commands from fixed-tick game state. `@evavo/adventure-audio-web` is only the host output adapter: autoplay recovery, decoded buffers and device scheduling never become story authority.

Audio state participates in save restoration and renderer-free replay execution. The browser player stops stale output and reconstructs voices from canonical saved state.

See [Audio Studio and deterministic sound production](audio-studio.md).

## Focused documents and project integration

Dialogue graphs, cinematic sequences and actors are edited as focused documents for usable tooling. They are not independent shipping formats.

The Narrative Project Library performs protected dialogue and sequence replacement in canonical `project.json`. Typed action callers prevent unsafe removal.

The animation project-integration contract performs protected actor replacement. It rejects global ID collisions and missing performance states or facings requested by dialogue and cinematic cues.

Art direction is a project-scoped sidecar rather than a focused replacement document. It is evaluated against both `AssetBuildManifest` and `ArtVisualEvidenceManifest`, whose pixel data is measured from encoded PNG outputs.

Bitmap fonts compile into the runtime bundle only after project-atlas and compiled-glyph validation. The player renders glyph sprites from validated runtime assets and never substitutes CSS or vector text.

Interface skins bind the canonical interaction mode to native regions, verbs, bitmap-font roles, inventory, parser, score, dialogue choices and verb coins. They compile only after source validation and compiled icon-frame validation, then drive the same renderer-neutral composer in Studio and packaged gameplay.

Audio mixes bind canonical scenes, dialogue lines, sequence sound requests and compiled audio assets. They compile only after source and compiled-evidence validation, then drive deterministic runtime state and replaceable platform output adapters.

Save games and replay logs are packaged-runtime artifacts. Their payload fingerprints and exact runtime-bundle fingerprints are validated before inspection, loading, replay execution or semantic diffing.

## Verification

The primary repository workflow remains `.github/workflows/ci.yml`.

The editor expansion also has `.github/workflows/editor-expansion-ci.yml`. A governed exact-SHA dispatch runs one deliberately selected operating-system lane and calls the shared `check:editor-expansion` command.

The expansion verification includes:

- the dedicated TypeScript expansion graph;
- Adventure Design parsing, semantic validation, dependency ordering and protected history tests;
- production-profile, authored-intent authenticity, compiled-evidence, scene-readability, scene-staging and progression regression tests;
- scene-runtime narrative request and command-boundary tests;
- editor command and workspace tests;
- art-direction policy and evidence tests;
- bitmap-font layout, authoring, compilation and runtime tests;
- interface-skin schema, editor, compiler, runtime, hit-testing and player tests;
- audio schema, editor, controller, browser adapter, compiler, runtime-bundle, save and Studio tests;
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
packages/audio/tests
packages/audio-editor-core/tests
packages/audio-controller/tests
packages/audio-web/tests
packages/scene-runtime/tests
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
