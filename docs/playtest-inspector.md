# Playtest inspector

## Purpose

The Playtest Inspector reviews packaged runtime artifacts without starting WebGL, audio or browser input. It uses the exact save, replay and shared runtime-controller contracts that packaged gameplay and the CLI use.

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

This comparison does not execute the replay. It answers whether an independently loaded Save B matches the checkpoint stored in the replay.

## Renderer-free replay execution

The packaged runtime controller now lives in `@evavo/adventure-runtime-controller`. Player consumes it through compatibility re-exports, while inspector and CLI code can use the same controller without importing application internals or starting WebGL.

`executeInspectedReplay`:

1. parses and validates the replay;
2. restores its canonical initial save;
3. derives the controlled actor from that save;
4. applies native activation and parser events in sequence order;
5. advances to the explicit final tick;
6. creates the canonical final save;
7. enforces the optional expected final-save fingerprint;
8. returns both the final save document and inspected summary.

```ts
import { executeInspectedReplay } from "@evavo/adventure-playtest-inspector/replay-execution";

const execution = executeInspectedReplay(bundle, replay);
```

The Studio currently displays validation, timeline, cross-save audit and checkpoint closure. Replay execution is exposed through the shared API and CLI first so automation has a deterministic non-visual gate before an interactive step-through debugger is added.

## Relationship to CLI

Automation can validate or execute packaged artifacts without Studio:

```powershell
pnpm cli -- save-validate `
  --bundle .\release\game.bundle.json `
  --save .\playtests\before.save.json `
  --json

pnpm cli -- replay-validate `
  --bundle .\release\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --json

pnpm cli -- replay-execute `
  --bundle .\release\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --output-save .\playtests\office.final.save.json `
  --json
```

The Studio workspace adds human-readable summaries, canonical cross-save auditing, replay grouping and checkpoint closure. It does not weaken any compatibility, execution or fingerprint rule.
