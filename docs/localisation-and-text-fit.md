# Localisation, runtime locale packs and native text fit

Adventure Studio treats translated text as governed production data rather than a late spreadsheet export. Canonical project text remains the source of truth; localisation may change presentation text, but it cannot add actions, alter IDs, change conditions, award score, mutate inventory or affect deterministic story state.

## Canonical source catalogue

`@evavo/adventure-project-schema/localisation` extracts a deterministic catalogue from the project. It covers project, scene, hotspot, actor, dialogue, sequence and inventory names; fallback responses; dialogue lines and choices; spoken `say` actions; cinematic speech; and inventory descriptions.

Each entry retains a stable key, role, owner ID, source path and canonical text. Target manifests are project-scoped, use BCP 47-compatible locale tags, preserve exact placeholders, and declare `draft`, `review` or `release` status. Explicit fallback targets are validated for missing locales and cycles.

Release locales must resolve every source key without falling back to canonical source. Review locales report missing text as warnings. Draft locales may remain incomplete.

## Headless localisation editing

The localisation module also exposes deterministic editing commands and history state for Studio, CLI and automation surfaces. Commands cover locale insertion, removal and replacement plus translation entry upsert/removal. Every applied command returns an exact inverse, enabling deterministic undo and redo without keeping browser-only mutation state.

The editor contract provides:

- canonical manifest ordering;
- source-locale and duplicate-target protection;
- fallback-reference protection during locale removal;
- stable locale identity during replacement;
- schema-validated command payloads for automation;
- canonical dirty-state comparison and explicit saved/exported snapshots.

Semantic translation findings remain diagnostics rather than mutation blockers. This means an editor can temporarily contain missing translations or placeholder mistakes while still surfacing them immediately through validation.

## Pseudo-localisation

The deterministic pseudo-localiser accents visible characters, preserves placeholders byte-for-byte, expands text by a configurable ratio and adds visible boundary markers. It is intended to expose clipped strings, unsupported glyphs and text that escaped the source catalogue before translation begins.

## Native bitmap text fit

`@evavo/adventure-bitmap-font/localisation` evaluates resolved target strings with the same integer glyph advances, kerning, line height, wrapping and fallback-glyph rules used by the bitmap renderer. A fit profile assigns native width, height, line count and font constraints to text roles.

The resulting report records exact native dimensions, overflow, line count, fallback code points, source fallback, governing rule and selected font. CSS or operating-system font metrics are not accepted as shipping evidence for a native-pixel interface.

## Localisation Studio workspace

The visual authoring surface is available at:

```text
/?workspace=localisation
```

It uses the same project-schema localisation commands, source extraction, validation and bitmap text-fit audit as headless tooling. The workspace provides:

- target-locale selection with direct and resolved coverage;
- creation and guarded removal of target locales;
- draft, review and release status authoring;
- explicit fallback-locale authoring;
- source-catalogue search and findings-only filtering;
- side-by-side canonical source and target translation editing;
- placeholder evidence and source ownership paths;
- deterministic pseudo-localisation pressure previews;
- native pixel width, height, line and glyph-gap evidence;
- per-string errors and warnings;
- undo, redo, dirty-state tracking and deterministic JSON export.

The React workspace does not invent a second localisation model. Editing is performed through the headless command/history contract and diagnostics are derived from the canonical manifest after each change.

## Runtime locale pack

The source project and a validated localisation manifest compile into an optional `RuntimeLocalisationPack` embedded in the source-free runtime bundle. The pack contains:

- source and default locale;
- canonically ordered target locales and direct translations;
- the source catalogue required for deterministic fallback;
- no commands, conditions or mutable runtime state.

`localiseRuntimeBundle` produces a presentation projection of the same runtime bundle. It replaces only supported text fields while retaining scene IDs, dialogue nodes, interaction IDs, sequence cues, object identity and every non-text gameplay value. Missing or unsupported locale requests resolve through the authored default and finally the canonical source locale.

The compiler entry point `@evavo/adventure-compiler/with-localisation` can attach a validated locale pack to an existing compilation or compile a project with localisation in one operation.

## Player language selection

The browser Player reads the `locale` query parameter first, then the project-scoped persisted preference, then the runtime pack default. A language selector appears in the Player status rail when a locale pack is present. Selecting a language persists the choice and reloads the presentation with the selected locale.

The query form is:

```text
?bundle=/game/runtime.bundle.json&locale=fr-FR
```

Quick saves remain available across language selection. Changing language does not enter the command log and is not a replay event.

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
packages/bitmap-font/tests/localisation.test.ts
packages/runtime-bundle/tests/localisation-runtime.test.ts
packages/compiler/tests/with-localisation.test.ts
packages/save-game/tests/localisation-compatibility.test.ts
apps/player/tests/localisation.test.ts
apps/studio/tests/localisation-workspace.test.ts
```

The governed Editor Expansion command includes these tests, strict TypeScript compilation and the Player and Studio production builds. A successful source or type pass does not replace 1× native visual review with the final bitmap atlas and translated content.

## Current boundary

This tranche governs canonical project text. Stateful-object copy in `scene-instances.json`, interface-skin labels, external subtitle files and storefront metadata remain separate surfaces. They should join the catalogue through explicit adapters rather than by duplicating strings into the runtime pack.