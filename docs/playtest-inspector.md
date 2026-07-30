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

Saves and replays can be loaded before the bundle. The workspace retains them and recomputes inspection results once the matching runtime bundle is available.

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

## Replay timeline

A validated replay is grouped by logical tick. Every event shows:

- global sequence number;
- event kind;
- native activation position or parser operation;
- initial and final ticks;
- duration and checkpoint count;
- optional expected final save fingerprint.

The inspector validates the replay document but does not execute it. Execution and convergence remain the responsibility of `@evavo/adventure-replay`, the packaged controller tests or a future step-through replay debugger.

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

The Studio workspace adds human-readable summaries, cross-save diffs and replay grouping. It does not weaken any compatibility or fingerprint rule.
