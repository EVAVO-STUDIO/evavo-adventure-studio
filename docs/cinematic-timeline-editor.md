# Cinematic timeline editor

## Purpose

The cinematic timeline editor authors deterministic fixed-tick sequences for in-room performances, cutscenes and ambient scene behavior.

It does not use browser animation time as canonical sequence time. Every cue is scheduled against the same logical tick clock used by game simulation, saves, skips and replay tests.

## Sequence editor core

`@evavo/adventure-sequence-editor-core` owns renderer-free timeline commands.

Supported operations include:

- replace a sequence;
- insert, remove and replace typed tracks;
- insert, remove and replace cues;
- atomic command batches;
- undo, redo and saved-state comparison.

Cue commands use a stale-safe locator containing:

- the stable track ID;
- the cue array index;
- the exact cue expected at that index.

If a cue changes after a command is created, replay fails with `stale-cue` rather than editing a different cinematic event.

## Track contracts

The editor enforces canonical cue families:

| Track | Allowed cue kinds |
| --- | --- |
| Actor | actor move, actor animation |
| Camera | camera shot |
| Dialogue | speech |
| Audio | sound, stop audio |
| Story | typed story action |
| Effects | layer visibility, palette cycle |

Tracks must keep cues in nondecreasing tick order. Same-tick order remains authored array order.

## Time validation

The sequence core rejects:

- cue start ticks outside the sequence;
- actor moves, camera shots or speech extending beyond sequence duration;
- safe skip ticks beyond sequence duration;
- cue kinds placed on incompatible tracks;
- duplicate track IDs;
- empty command batches.

## Timeline geometry

`src/timeline.ts` provides framework-independent layout services:

- ticks to pixels;
- pixels to ticks;
- fixed-tick snapping;
- visible tick ranges;
- cue durations and labels;
- stable insertion positions;
- stale-safe selection locators.

These services prevent React, canvas or another UI toolkit from becoming the owner of timeline mathematics.

## Timeline lab

The repository contains `@evavo/adventure-timeline-lab` as a visual proof before integration into the main studio shell.

Run it with:

```powershell
pnpm --filter @evavo/adventure-timeline-lab dev
```

Open:

```text
http://localhost:5175/
```

The timeline lab includes:

- fixed-tick ruler and playhead;
- actor, camera, dialogue, audio, effects and story tracks;
- draggable cue blocks;
- snap intervals;
- track-specific cue insertion;
- typed cue inspector;
- undo and redo;
- sequence JSON export;
- a representative office-blackout cutscene.

Cue dragging is implemented as one atomic remove-and-insert batch. This lets a cue cross other cues while preserving chronological order and one-step undo.

## Project integration

`@evavo/adventure-narrative-library-editor-core` inserts or replaces completed sequences in canonical `project.json`.

It prevents removal when any hotspot, dialogue action, skip completion action or story cue still uses `play-sequence` to reference the sequence.

## Verification

The expansion project graph is available at:

```powershell
pnpm exec tsc -b tsconfig.editor-expansion.json --pretty false
```

This graph includes the project schema, editor cores, narrative library, main studio and timeline lab.

A successful command has not yet been observed in the current tool environment and must not be inferred from repository structure alone.

## Remaining work

The next cinematic features are:

- integrate the timeline lab into the main Studio workspace navigator;
- add typed editors for every cue field;
- add parallel cue selection and multi-drag;
- add scrubbing preview through the real sequence runtime;
- add safe-skip preview and watched-versus-skipped state comparison;
- add speech waveform and subtitle timing views;
- add actor attachment and prop tracks;
- add camera easing curves;
- add ambient looping range visualization;
- add conflict diagnostics directly on cue blocks.
