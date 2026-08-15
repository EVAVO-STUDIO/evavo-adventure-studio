# Localisation, authored sidecars, runtime locale packs and native text fit

Adventure Studio treats translated text as governed production data rather than a late spreadsheet export. Canonical source text remains the authority; localisation may change presentation copy, but it cannot add actions, alter IDs, change conditions, award score, mutate inventory or affect deterministic story state.

## Canonical source catalogue

`@evavo/adventure-project-schema/localisation` extracts a deterministic catalogue from an adventure project. It covers project, scene, hotspot, actor, dialogue, sequence and inventory names; fallback responses; dialogue lines and choices; spoken `say` actions; cinematic speech; and inventory descriptions.

Each entry retains a stable key, role, owner ID, source path and canonical text. Target manifests are project-scoped, use BCP 47-compatible locale tags, preserve exact placeholders, and declare `draft`, `review` or `release` status. Explicit fallback targets are validated for missing locales and cycles.

Release locales must resolve every governed source key without falling back to canonical source. Review locales report missing text as warnings. Draft locales may remain incomplete.

## Authored supplemental surfaces

Not every localisable string belongs directly to `project.json`. Adventure Studio therefore supports explicit supplemental source adapters instead of copying sidecar or host text into the core project model.

The current adapters cover:

- classic front-end publisher, title-screen, menu and credits copy;
- lifecycle outcome titles, messages and menu labels;
- classic Player pause, save, load, options, slot-summary, notice, footer and accessibility copy.

`extractFrontEndLocalisableText`, `extractLifecycleLocalisableText` and `extractPlayerSystemLocalisableText` produce the same `LocalisationSourceEntry` contract used by core project extraction. `collectLocalisationSourceEntries` combines core and supplemental sources with deterministic ordering, while supplemental-aware template, pseudo-localisation, resolution, coverage and validation helpers preserve the same release rules.

The adapter boundary is deliberate. A sidecar or host surface can participate in localisation without gaining permission to change behavior policy, timing, conditions, runtime identity, save compatibility or menu effects.

Player system localisation is backward compatible. Existing manifests remain unchanged unless a target locale contains a `playerSystem.*` key. Once a manifest opts in, the compiler includes the complete canonical Player system catalogue. Draft locales may fall back to source; release locales must translate every Player system key.

## Headless localisation editing

The localisation module exposes deterministic editing commands and history state for Studio, CLI and automation surfaces. Commands cover locale insertion, removal and replacement plus translation entry upsert/removal. Every applied command returns an exact inverse, enabling deterministic undo and redo without keeping browser-only mutation state.

The editor contract provides:

- canonical manifest ordering;
- source-locale and duplicate-target protection;
- fallback-reference protection during locale removal;
- stable locale identity during replacement;
- schema-validated command payloads for automation;
- canonical dirty-state comparison and explicit saved/exported snapshots.

Translation findings remain diagnostics rather than mutation blockers. An editor can therefore contain missing translations or placeholder mistakes temporarily while surfacing them immediately through validation.

New target locales may be created from a combined core-and-adapter source catalogue. Existing manifests that predate an adapter can still author a newly selected supplemental key because translation commands upsert missing entries deterministically.

## Pseudo-localisation

The deterministic pseudo-localiser accents visible characters, preserves placeholders byte-for-byte, expands text by a configurable ratio and adds visible boundary markers. It is intended to expose clipped strings, unsupported glyphs and copy that escaped the governed source catalogue before translation begins.

Pseudo-localisation accepts the same supplemental source adapters as normal locale templates, so front-end, lifecycle and Player system copy receive the same expansion and glyph-pressure testing as in-game dialogue.

## Native bitmap text fit

`@evavo/adventure-bitmap-font/localisation` evaluates resolved target strings with the same integer glyph advances, kerning, line height, wrapping and fallback-glyph rules used by the bitmap renderer. A fit profile assigns native width, height, line count and font constraints to text roles.

The resulting report records exact native dimensions, overflow, line count, fallback code points, source fallback, governing rule and selected font. CSS or operating-system font metrics are not accepted as shipping evidence for a native-pixel interface.

Supplemental roles participate in the same audit. Front-end publisher and title copy, compact menu labels, credits lines, lifecycle titles and messages, Player system headings, descriptions, menu labels, notices and keyboard footer copy can each use constraints matched to their final native surface.

## Localisation Studio workspace

The visual authoring surface is available at:

```text
/?workspace=localisation
```

It uses the same project-schema localisation commands, combined source catalogue, validation and bitmap text-fit audit as headless tooling. The workspace provides:

- target-locale selection with direct and resolved coverage;
- creation and guarded removal of target locales;
- draft, review and release status authoring;
- explicit fallback-locale authoring;
- a combined project, classic-front-end, lifecycle and Player-system catalogue;
- source-catalogue search and findings-only filtering across every governed surface;
- side-by-side canonical source and target translation editing;
- explicit source owner, role and path evidence;
- placeholder evidence;
- deterministic pseudo-localisation pressure previews;
- native pixel width, height, line and glyph-gap evidence;
- per-string errors and warnings;
- undo, redo, dirty-state tracking and deterministic JSON export.

The Studio fixture includes real front-end, lifecycle and Player system adapters, translated French examples, complete pseudo-localisation and native text-fit rules for every supplemental role. New target locales receive the complete combined catalogue rather than project-only entries.

The React workspace does not invent a second localisation model. Editing is performed through the headless command/history contract and diagnostics are derived from the canonical manifest after each change.

## Runtime locale pack

The source project and a validated localisation manifest compile into an optional `RuntimeLocalisationPack` embedded in the source-free runtime bundle. The pack contains:

- source and default locale;
- canonically ordered target locales and direct translations;
- the complete opted-in core-and-adapter source catalogue required for deterministic fallback;
- no commands, conditions or mutable runtime state.

`localiseRuntimeBundle` produces a presentation projection of the same runtime bundle. It replaces only supported project text fields while retaining scene IDs, dialogue nodes, interaction IDs, sequence cues, object identity and every non-text gameplay value.

Dedicated runtime adapters localise classic front-end and lifecycle sidecars from the same pack without changing splash timing, menu visibility, outcome conditions or retry policy. The Player system resolver localises pause/save/load presentation without changing menu IDs, enabled states, slot numbers, compatibility validation, logical ticks, fullscreen behavior or return-to-title effects.

Missing or unsupported locale requests resolve through the authored default and finally canonical source text.

The compiler entry point `@evavo/adventure-compiler/with-localisation` can attach a validated locale pack to an existing compilation or compile a project with localisation in one operation. Compiler sidecar attachment remains order-safe: front-end and lifecycle sources are included when present before localisation, and draft packs can be extended when a supported sidecar is attached later. Release packs fail closed when newly attached governed copy lacks translations.

Player system copy uses explicit opt-in detection so legacy manifests without `playerSystem.*` entries remain source-compatible.

## Player language selection

The browser Player reads the `locale` query parameter first, then the project-scoped persisted preference, then the runtime pack default. A language selector appears in the Player status rail when a locale pack is present. Selecting a language persists the choice and reloads the presentation with the selected locale.

The query form is:

```text
?bundle=/game/runtime.bundle.json&locale=fr-FR
```

The selected projection covers gameplay text, classic front-end publisher/title/menu/credits copy, lifecycle outcome presentation and opted-in classic pause/save/load UI. Quick saves remain available across language selection. Changing language does not enter the command log and is not a replay event.

## Save and replay compatibility

Save-game bundle fingerprints use a localisation-neutral compatibility view:

1. any selected target text is restored to canonical source text;
2. the locale pack itself is excluded from the save compatibility fingerprint;
3. all non-localisation runtime data remains fingerprinted exactly.

This preserves compatibility with pre-localisation saves for an otherwise unchanged bundle, permits translation corrections without invalidating saves, and gives every language projection the same save-slot identity. The exact full runtime bundle fingerprint remains available separately for release evidence and artifact identity.

Replays remain renderer-free command logs against canonical story state. Locale selection changes presentation only and therefore neither changes replay event hashes nor produces a gameplay command.

## Verification

Focused executable coverage includes:

```text
packages/project-schema/tests/localisation.test.ts
packages/project-schema/tests/localisation-editor.test.ts
packages/project-schema/tests/front-end-localisation.test.ts
packages/project-schema/tests/lifecycle-localisation.test.ts
packages/project-schema/tests/player-system-localisation.test.ts
packages/bitmap-font/tests/localisation.test.ts
packages/runtime-bundle/tests/localisation-runtime.test.ts
packages/runtime-bundle/tests/front-end-localisation.test.ts
packages/runtime-bundle/tests/lifecycle-localisation-runtime.test.ts
packages/compiler/tests/with-localisation.test.ts
packages/compiler/tests/front-end-localisation.test.ts
packages/compiler/tests/lifecycle-localisation-order.test.ts
packages/compiler/tests/player-system-localisation.test.ts
packages/save-game/tests/localisation-compatibility.test.ts
apps/player/tests/localisation.test.ts
apps/player/tests/player-system-localisation.test.ts
apps/player/tests/system-menu-state.test.ts
apps/studio/tests/localisation-workspace.test.ts
```

The Localisation Studio workspace test verifies that front-end, lifecycle and Player system sources are selectable, searchable, editable through normal undo/redo history, included in newly created locale templates and governed by native text-fit rules.

The governed Editor Expansion command includes these tests, strict TypeScript compilation and the Player and Studio production builds. A successful source or type pass does not replace 1× native visual review with the final bitmap atlas and translated content.

## Current boundary

The governed catalogue now covers canonical project text, classic front-end publisher/title/menu/credits copy, lifecycle outcome presentation and classic Player system-menu presentation.

Stateful-object copy in `scene-instances.json`, status-rail and replay/cutscene notices outside the system menu, interface-skin labels, external subtitle files and storefront metadata remain separate surfaces. They should join the catalogue through explicit adapters rather than by duplicating strings into the runtime pack.
