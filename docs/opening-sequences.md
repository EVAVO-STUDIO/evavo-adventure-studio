# Authored opening sequences

Adventure Studio can attach one canonical opening sequence to a packaged game. The opening is not a
second cinematic system: it is an ordinary authored `Sequence` that runs through the same deterministic
story, camera, audio, completion-action and localisation machinery used by in-game cutscenes.

## Manifest

```json
{
  "manifestVersion": 1,
  "projectId": "project.red-ledger",
  "newGameSequenceId": "sequence.red-ledger.opening"
}
```

The selected sequence must:

- belong to the same project;
- exist in the compiled runtime bundle;
- use `mode: "cutscene"`;
- use `blocking: true`;
- use `loop: false`;
- avoid looping `sound` cues, because a skipped opening must not leave an orphaned audio loop.

Its ordinary sequence policy controls saving and skipping. A typical opening uses:

```json
{
  "mode": "cutscene",
  "loop": false,
  "blocking": true,
  "savePolicy": "disabled",
  "skip": {
    "allowed": true,
    "safeAfterTick": 18,
    "completionActions": []
  }
}
```

Completion actions must put the game into exactly the same canonical state whether the sequence reaches
its natural end or is skipped. This is particularly important when the opening changes scene, grants an
item, initializes flags or starts the first dialogue.

## Compilation

Attach the opening to an existing complete compilation so other sidecars remain intact:

```ts
import { attachRuntimeOpening } from "@evavo/adventure-compiler/with-opening";

const packaged = attachRuntimeOpening(compiled, openingManifest);
```

`attachRuntimeOpening` validates project ownership and sequence suitability, then re-parses and
fingerprints the resulting runtime bundle.

## Player flow

The packaged browser Player follows this order:

```text
publisher splash
→ title menu
→ New Game
→ load runtime assets
→ start canonical opening sequence at tick zero
→ release ordinary input when the sequence completes
→ playable scene
```

`Continue` and `Load Game` restore the selected save and do not replay the opening. An authored
`Restart Game` recovery returns to a fresh initial state and runs the opening again unless the explicit
automation bypass is active.

During a blocking opening:

- pointer and parser commands are ignored;
- save, load, pause-menu and replay shortcuts are suppressed;
- interface and software-cursor render nodes are removed;
- sequence speech is shown in the native status rail when bitmap fonts are available;
- `Escape` requests the canonical sequence skip operation;
- the authored `safeAfterTick` boundary is enforced;
- tick-zero audio and camera events are synchronized through the audio-aware runtime controller.

For automated direct-runtime checks, `?opening=skip` (also `off` or `0`) bypasses the opening without
changing the bundle.

## Save compatibility

The opening manifest remains part of the save-compatible runtime fingerprint. Changing which sequence
defines the beginning of a new game can alter initialization actions and therefore invalidates older
saves.

Localised sequence names and speech remain language-neutral through the existing localisation
compatibility projection. The opening manifest itself contains no player-facing copy.

## Current boundary

This tranche provides runtime authoring, compilation and packaged playback. A dedicated visual opening
workspace and CLI command can build on the same `GameOpeningManifest` contract without inventing another
document format.
