# Renderer-free replay execution

## Purpose

Replay validation proves that a replay document is intact and compatible with a compiled runtime bundle. Replay execution goes further: it restores the recorded initial save, applies every deliberate event through the same shared controller used by Player, advances to the explicit final tick and creates a canonical final save.

The renderer, WebGL, audio and browser event loop are not required.

## Shared services

- `@evavo/adventure-runtime-controller` owns controller, input, parser and runtime-interface behaviour.
- `@evavo/adventure-replay` owns replay integrity, compatibility and ordered execution.
- `@evavo/adventure-playtest-inspector/replay-execution` combines them and returns both the canonical final save document and a human-readable inspection.
- `replay-execute` exposes the same path to automation through the CLI.

Player retains compatibility re-exports, so browser gameplay and renderer-free execution use the same implementation rather than parallel controller copies.

## Default execution limits

Renderer-free execution fails before controller creation when either default limit is exceeded:

- 10,000 deliberate events;
- one hour of logical ticks at the bundle's configured tick rate.

The defaults prevent a structurally valid but extreme replay from consuming unbounded CPU. API callers can supply lower or higher positive safe-integer limits when the workload is trusted.

```ts
import { executeInspectedReplay } from "@evavo/adventure-playtest-inspector/replay-execution";

const result = executeInspectedReplay(bundle, replay, {
  maxEvents: 25_000,
  maxDurationTicks: 432_000,
});
```

Limit violations raise `ReplayExecutionLimitError` before any replay event is applied.

## CLI execution

```powershell
pnpm cli -- replay-execute `
  --bundle .\release\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --output-save .\playtests\office.final.save.json `
  --max-events 10000 `
  --max-duration-ticks 216000 `
  --json
```

Both limit flags are optional. Successful JSON reports include the resolved limits so automation records the exact execution policy.

## Final-save output safety

`--output-save` is optional and fails closed:

- it cannot target the input bundle or replay path;
- it cannot replace an existing file;
- parent directories are created only for a new output path;
- divergence or execution failure never writes a final save;
- unexpected permissions or filesystem failures return exit code `3`.

A successful output is serialized through the canonical save-game serializer.

## Controlled actor restoration

Replay execution preserves the controlled actor recorded in the initial save rather than re-running browser auto-selection. This includes:

- explicit view-only saves with no controlled actor;
- actors placed outside the project's start scene;
- fixed actors that are legal in the saved interface state.

Normal browser query selection remains unchanged: it still selects only valid walkable start-scene actors and rejects invalid explicit requests.

## Result and failure semantics

A successful execution returns:

- replay fingerprint;
- event count;
- initial and final ticks;
- canonical final-save fingerprint;
- optional checkpoint match state;
- canonical final save document;
- inspected final save summary.

The CLI uses stable diagnostics for integrity, compatibility, execution, divergence, limits, controlled-actor mismatches, input reads and output protection. Recognized replay or artifact failures return exit code `1`; usage errors return `2`; unclassified internal or output-write failures return `3`.
