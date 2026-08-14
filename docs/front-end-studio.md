# Front End Studio

Front End Studio is the visual authoring workspace for the packaged game's pre-play 1990s presentation. It edits the same `ClassicFrontEndManifest` consumed by the Player and compiler rather than maintaining a browser-only mockup model.

Open it at:

```text
/?workspace=front-end
```

## What it authors

The workspace controls:

- publisher name and presents line;
- splash duration and skip timing in logical ticks;
- title-screen kicker;
- visibility of Continue, Load, Options, Credits and Quit;
- wording for New Game, Continue, Load Game, Options, Credits, Quit, Quick Save, Back and Fullscreen;
- fullscreen availability;
- ordered credit lines.

The game title itself remains canonical project text. This prevents the front-end sidecar from becoming a second source of project identity.

## Native preview

The centre workspace presents a fixed-aspect 320×200-style preview at a clean doubled scale. Preview tabs cover:

- Splash;
- Title;
- Options;
- Credits;
- Quit.

The preview intentionally models logical front-end geometry rather than responsive website layout. It uses the authored manifest values directly and never creates story flags, inventory, commands, save slots or replay events.

## Headless editor contract

The visual workspace is backed by:

```ts
@evavo/adventure-project-schema/front-end-editor
```

Its command surface supports:

- publisher and presents-line edits;
- splash timing edits;
- title-kicker edits;
- individual menu-label edits;
- individual menu-visibility edits;
- fullscreen policy;
- credit-line replacement;
- atomic command batches.

Every applied command returns an exact inverse. The history layer provides deterministic undo, redo, saved/exported snapshots and dirty-state detection. Command payloads are Zod-validated so automation can use the same mutation contract without driving React controls.

## Editing behavior

Text and timing controls keep temporary typing drafts locally, then commit complete valid values through the headless editor on blur. This allows ordinary text editing without weakening the canonical schema with invalid intermediate values.

Checkbox policy edits are committed immediately because boolean transitions are always structurally valid.

Keyboard shortcuts follow Studio conventions:

```text
Ctrl/Cmd + Z         Undo
Ctrl/Cmd + Shift+Z  Redo
Ctrl/Cmd + Y         Redo
Ctrl/Cmd + S         Export front-end manifest
```

Export produces deterministic JSON for compiler attachment through `@evavo/adventure-compiler/with-front-end`.

## Current boundary

Front End Studio authors the manifest contract and runtime preview policy. It does not yet author custom bitmap title art, publisher logo image assets, menu sound cues, animated title sequences or per-locale front-end label variants. Those should be connected as explicit asset/audio/localisation adapters rather than embedded as opaque UI-only state.

## Verification

Focused coverage lives in:

```text
packages/project-schema/tests/front-end-editor.test.ts
apps/studio/tests/front-end-workspace.test.ts
```

These tests cover command parsing, batches, schema rejection, exact undo/redo, dirty state, preview-only navigation and policy edits. The Studio production build remains part of the governed manual Editor Expansion gate.