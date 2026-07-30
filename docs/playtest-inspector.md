# Playtest inspector

## Purpose

The Playtest Inspector reviews packaged runtime artifacts without starting WebGL, audio or browser input. It uses the exact save and replay validators that packaged gameplay and the CLI use.

Open the workspace at:

```text
http://localhost:5174/?workspace=playtest
```

## Inputs

The workspace accepts four JSON documents:

1. a compiled `game.bundle.json`;
2. an optional Save A checkpoint;
3. an optional Save B checkpoint;
4. an optional deterministic replay log.

Saves and replays can be loaded before the bundle. The workspace retains valid JSON inputs and recomputes inspection results once the matching runtime bundle is available.

Each picker can be cleared independently. A newer selection or a clear action invalidates any older in-progress file read, so a slow stale read cannot overwrite the current artifact. Browser file-read failures and JSON/schema failures remain separate visible errors.

## Save summary

A validated save summary includes:

- logical tick, current scene and entrance;
- score and inventory item names;
- true and false flags;
- scalar variables;
- actor instance position, facing, animation and movement state;
- persistent object states;
- active dialogue and sequence cursors;
- movement and pending-command counts;
- selected verb, selected inventory item and controlled actor;
- status text and parser history;
- exact save and bundle fingerprints.

Transient pointer, hover, press and parser-focus state is not present because it is deliberately excluded from the canonical save contract.

## Semantic save diff

When two compatible saves are loaded, the inspector reports deterministic changes by semantic category rather than comparing raw JSON line numbers.

Current categories include:

- tick, scene and entrance;
- score and inventory;
- flags and variables;
- persistent object state;
- actor playback and position;
- navigation routes and deferred commands;
- active dialogue and sequences;
- interface selections, status and parser state.

Diff entries are sorted by canonical state path. Object key insertion order in a save cannot change the report.

## Canonical state audit

The semantic diff is intentionally concise, so it is paired with a separate exact audit. `diffCanonicalSaveGames` recursively compares every serialized `world` and `interface` field while preserving array order.

This catches deterministic differences that a human summary may deliberately omit, including:

- random-stream state;
- consumed interaction IDs;
- consumed dialogue-choice IDs;
- awarded score IDs;
- ordered inventory and history entries;
- any other canonical save field.

The Studio audit is bounded to 250 displayed paths. If the limit is reached, the result is marked as truncated and never presented as a complete diff. A canonical difference with no semantic changes is labelled as hidden divergence and opens automatically.

Automation can import the exact comparator directly:

```ts
import { diffCanonicalSaveGames } from "@evavo/adventure-playtest-inspector/canonical-diff";

const result = diffCanonicalSaveGames(bundle, beforeSave, afterSave, {
  maxDifferences: 500,
});
```

## Replay timeline

A validated replay is grouped by logical tick. Every event shows:

- global sequence number;
- event kind;
- native activation position or parser operation;
- initial and final ticks;
- duration and checkpoint count;
- optional expected final save fingerprint.

## Replay closure

When a replay is loaded, the workspace classifies its final-save checkpoint as one of four states:

- **no checkpoint** — the replay did not record an expected final save;
- **awaiting Save B** — the replay has a checkpoint but no after-save is loaded;
- **checkpoint match** — Save B exactly matches the recorded final fingerprint;
- **checkpoint mismatch** — Save B is valid for the bundle but differs from the replay checkpoint.

This is a checkpoint comparison, not replay execution. It prevents a displayed fingerprint from being mistaken for a verified match while still keeping the inspector renderer-free.

## Replay execution boundary

`@evavo/adventure-replay` already executes a replay through the `ReplayRuntimeAdapter` contract and fails on final-save divergence. The packaged player controller satisfies that contract, but it currently lives inside `apps/player`.

Studio must not import player-app internals. The next architectural step for renderer-free execution is to extract the packaged controller into a shared runtime-controller package used by both Player and Studio. Until that extraction is complete, replay execution and convergence remain the responsibility of the replay package and packaged-controller regression tests.

## Relationship to CLI

Automation can run the same packaged-artifact gates without Studio:

```powershell
pnpm cli -- save-validate `
  --bundle .\release\game.bundle.json `
  --save .\playtests\before.save.json `
  --json

pnpm cli -- replay-validate `
  --bundle .\release\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --json
```

The Studio workspace adds human-readable summaries, canonical cross-save auditing, replay grouping and checkpoint closure. It does not weaken any compatibility or fingerprint rule.
