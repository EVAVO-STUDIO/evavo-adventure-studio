# Deterministic replays

## Purpose

A replay proves that deliberate player input produces the same canonical game state when executed again against the exact same compiled runtime bundle.

The canonical format is `ReplayLog` from `@evavo/adventure-replay`.

## Replay boundary

A replay contains:

- project ID;
- exact runtime-bundle fingerprint;
- a fully validated initial save game;
- ordered deliberate input events;
- one explicit final logical tick;
- an optional expected final save fingerprint;
- a fingerprint covering the replay payload itself.

The initial save means a replay can begin from any legal save boundary rather than only from a new game.

## Recorded inputs

Version 1 records two event families:

- `activate`: one native-canvas position used for scene, verb, inventory, parser, dialogue-choice or verb-coin activation;
- `parser-key`: one handled parser operation such as text, backspace, history navigation, submit, focus or blur.

Each event carries:

- a non-decreasing logical tick;
- a globally increasing sequence number;
- its typed input payload.

Multiple operations may occur on the same logical tick. Their sequence number preserves exact input order.

## Explicit final tick

The final tick is separate from the last input event. This is required because the simulation may still need to advance after input stops:

- an actor may be walking toward a staging point;
- a deferred object command may execute on arrival;
- a dialogue or cinematic sequence may progress;
- animation markers or deterministic timers may fire.

Replay execution advances to the final tick before creating the final save checkpoint.

## Deliberately excluded data

Replays do not record:

- pointer movement or hover;
- pressed-button duration;
- browser animation-frame cadence;
- host timestamps;
- DOM events;
- renderer output;
- audio playback position outside canonical runtime state.

These values are presentation or device state. Native activation coordinates and logical ticks are sufficient to reproduce the game command path.

## Integrity and compatibility

Replay parsing verifies its own payload fingerprint. Compatibility then checks:

- project identity;
- exact runtime-bundle fingerprint;
- initial save compatibility;
- initial, event and final tick bounds;
- non-decreasing event ticks;
- strictly increasing event sequence numbers.

Execution fails when a parser input is no longer handled or when the runtime restores a different starting tick.

When `expectedFinalSaveFingerprint` is present, replay execution creates a final save and compares the exact fingerprint. A mismatch raises `ReplayDivergenceError` and is a deterministic regression signal.

## Browser playtest controls

Packaged browser playtests provide:

- `Ctrl` or `Cmd` + `Shift` + `R`: start or finish replay recording;
- `Ctrl` or `Cmd` + `Shift` + `E`: export the latest completed replay JSON.

Loading a save cancels an active recording because the logical timeline moved to another checkpoint. The previously completed replay remains available for export.

Recording begins by creating a legal save snapshot. It therefore respects cinematic save policy and fails clearly when the current sequence disables saving.

## Quality gate

The replay package includes a renderer-free convergence fixture. The packaged player also replays parser input through the real controller and compares its final save fingerprint with uninterrupted execution.

A future replay debugger can consume the same format to:

- step event by event;
- inspect state changes between ticks;
- compare expected and actual save fingerprints;
- jump to the first divergent command;
- attach screenshots and renderer evidence without changing replay semantics.
