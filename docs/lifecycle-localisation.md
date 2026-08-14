# Lifecycle localisation

Game-over states and successful endings now use the same canonical localisation pack as scenes, dialogue, inventory, sequences and other runtime text.

## Source keys

Each lifecycle outcome contributes seven deterministic keys:

```text
lifecycle.<outcome-id>.title
lifecycle.<outcome-id>.message
lifecycle.<outcome-id>.menu.quickRetry
lifecycle.<outcome-id>.menu.loadGame
lifecycle.<outcome-id>.menu.restartGame
lifecycle.<outcome-id>.menu.returnToTitle
lifecycle.<outcome-id>.menu.back
```

The keys are derived from stable outcome IDs. Reordering outcomes does not rename translations.

## Compilation order

For a release bundle, attach lifecycle before localisation:

```text
compiled project
→ attach lifecycle
→ attach localisation
→ package player
```

`attachRuntimeLocalisation` detects an attached lifecycle manifest, validates every lifecycle key for release locales and includes those source entries in the runtime pack.

Attaching lifecycle to a bundle that already has a draft localisation pack also extends the pack with canonical lifecycle sources. Missing draft translations fall back to source copy rather than crashing the player.

## Runtime behavior

Language selection localises:

- outcome title;
- outcome message;
- Quick Retry;
- Load Game;
- Restart Game;
- Return to Title;
- Back.

Outcome IDs, kinds, priorities, conditions and recovery-route availability remain unchanged.

Older localisation packs without lifecycle source entries remain readable. The runtime leaves lifecycle source copy unchanged for keys that are not present instead of throwing.

## Save compatibility

Lifecycle presentation copy is excluded from the save-compatible runtime fingerprint.

Changing or translating a title, message or menu label does not invalidate saves. The following remain gameplay-significant and continue to change the fingerprint:

- adding or removing lifecycle outcomes;
- outcome IDs and kinds;
- priority order;
- trigger conditions;
- Quick Retry, Load, Restart and Return-to-Title availability.

This keeps language and editorial changes safe while preserving deterministic terminal-state behavior.
