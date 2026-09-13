# Classic in-game system menu

The packaged Player now treats the in-game pause/save/load surface as a real classic-adventure system layer rather than a browser shortcut collection.

## Open and pause semantics

Press `Escape` while a packaged game is running. The Player freezes logical-tick advancement before opening the menu. Pointer activation and parser input are blocked while the menu owns focus, so opening Options or browsing save slots cannot enter replay or story commands.

Closing the menu recreates the fixed-step clock origin. Time spent in the system menu therefore cannot produce a catch-up burst when gameplay resumes.

## Root menu

The root surface provides:

- Resume Game
- Save Game
- Load Game
- Options
- Return to Title

Load Game is disabled when no compatible slot exists. Return to Title requires explicit confirmation and reloads the same Player URL so the authored publisher/title flow starts normally.

## Save slots

Ten deterministic browser slots are exposed:

- slot `0` is the existing Quick Save slot;
- slots `1` through `9` are regular named positions in the system menu.

Slot metadata is derived from the validated save itself. No wall-clock timestamp is written into canonical save data. Valid slots display the current scene, logical play time, score and inventory count. Malformed or incompatible data is shown as a damaged slot instead of crashing the menu.

Saving runs through `controller.createSaveGame()`, so sequence save policy remains authoritative. A cutscene that disables saving or permits it only at a boundary continues to reject the operation with its real policy diagnostic.

Loading validates the selected slot against the current runtime bundle before mutating controller state. Successful restore returns the exact saved logical tick, resets the fixed-step clock and resumes from that state.

## Keyboard compatibility

The existing direct shortcuts remain available during gameplay:

```text
Ctrl/Cmd + Shift + S  Quick Save to slot 0
Ctrl/Cmd + Shift + L  Quick Load from slot 0
Ctrl/Cmd + Shift + R  Start/finish deterministic replay recording
Ctrl/Cmd + Shift + E  Export the latest replay
Escape                Open the classic system menu
```

Inside the menu:

```text
Up / Down  Select
Enter       Activate
Escape      Back, or Resume from the root
```

## Determinism boundary

The system menu is presentation and persistence control. Menu navigation, fullscreen changes and slot browsing are not gameplay commands and are not recorded into replay history. Save and load operations intentionally change persistence/runtime state through the existing save-game contract.

The menu does not add timestamps, random IDs or host-specific state to save files. Slot labels are reconstructed from canonical saves whenever the menu renders.
