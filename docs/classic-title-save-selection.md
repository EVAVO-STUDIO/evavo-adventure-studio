# Classic title-screen save selection

The packaged Player uses one save-slot model on both sides of gameplay. Title-screen Load Game and the in-game system menu inspect the same bundle-scoped browser slots through `listSaveGameSlots`.

## Slot contract

The default Player exposes ten slots:

- slot `0` is the Quick Save slot used by Continue and the keyboard quick-save shortcuts;
- slots `1` through `9` are manual save slots;
- every slot is inspected through the canonical save parser and compatibility validator before it can be selected.

A slot snapshot is `empty`, `invalid`, or `valid`. Empty and invalid slots remain visible in Load Game but are disabled. Invalid storage is labelled `DAMAGED SAVE` rather than being treated as a usable Continue target.

## Continue versus Load Game

Continue is deliberately narrow: it resumes only a validated slot `0`. The presence of arbitrary browser data is not enough to enable Continue.

Load Game is broader. It becomes available when any of the ten slots contains a validated compatible save, even if Quick Save is empty. The native load screen presents scene, logical tick, score and inventory count for valid saves.

## Runtime handoff

The front-end state machine returns an explicit request:

```ts
{ kind: "new" }
{ kind: "load", slot: 0 }
{ kind: "load", slot: 7 }
```

The Player then reads that exact slot before textures, audio and the gameplay controller are mounted. A successful load restores the same deterministic save state used by the in-game system menu.

If storage changes between inspection and selection, the failed read returns to the title menu without replaying the publisher splash. Slot snapshots are recomputed, so the disappeared or damaged slot is no longer selectable.

## Determinism boundary

Save-slot selection is presentation and persistence orchestration. It does not enter the gameplay command stream, change replay hashes, alter canonical story state or introduce wall-clock timestamps into save files.