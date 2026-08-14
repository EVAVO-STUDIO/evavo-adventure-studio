# Classic packaged-player front end

The packaged Player now has a renderer-independent classic front end before gameplay. Its job is to reproduce the deliberate pacing and keyboard-first menu grammar of a 1990s PC adventure without coupling menu state to the deterministic story simulation.

## Flow

A packaged runtime opens in this order:

```text
runtime bundle metadata
→ EVAVO publisher splash
→ title / main menu
→ New Game or validated Continue / Load
→ runtime assets and controller
→ native gameplay
```

The renderer laboratory still opens directly when no runtime bundle is requested.

The front end can be bypassed for controlled automation or direct runtime testing with:

```text
?shell=skip
```

The bypass starts a new game and does not silently restore a save.

## Native presentation

The shell is authored on a fixed logical 320×200 frame and scaled to the browser host as one unit. It therefore keeps its title, menu, footer and selection geometry stable across desktop sizes instead of becoming a responsive web menu.

The initial skin uses:

- a black publisher plate with a restrained EVAVO mark;
- a short logical-tick splash hold;
- a dark low-resolution title plate;
- keyboard and pointer menu control;
- selection arrows and disabled save entries;
- compact Options, Credits and Quit plates;
- deliberate scanline and integer-style presentation treatment.

The shell is DOM-rendered rather than part of the gameplay render graph, but its coordinate system and timing policy are independent of CSS viewport size. It is a pre-game system surface, not canonical story state.

## Deterministic state machine

`classic-front-end-state.ts` owns all navigation decisions. State contains only:

- current front-end screen;
- splash logical tick;
- selected menu index;
- whether a compatible save slot is present.

Commands are explicit:

- tick splash time;
- skip the splash after its minimum hold;
- move or set selection;
- activate;
- back;
- update save availability.

Effects are limited to starting a new/continued game or requesting fullscreen. Front-end navigation never enters the gameplay command log or replay stream.

The default splash policy is 96 logical ticks with skipping enabled after tick 18. Automatic timing uses a 60 Hz logical front-end clock rather than animation-frame count.

## Main menu

The title menu exposes:

- New Game;
- Continue;
- Load Game;
- Options;
- Credits;
- Quit.

Continue and Load are disabled when no browser quick-save slot exists. Arrow-key navigation skips disabled entries and wraps in classic menu fashion.

The current save system has one verified browser quick slot, so Load Game explicitly presents that slot rather than pretending a multi-slot browser UI already exists.

## Continue and Load correctness

The front end checks save presence using the localisation-neutral runtime compatibility fingerprint. When Continue or the quick slot is selected:

1. the save JSON is read and fully validated against the current runtime bundle;
2. corrupt or incompatible data returns the user to the title shell with an explanatory notice and save actions disabled;
3. only after a valid start decision are runtime textures and the packaged controller constructed;
4. the validated save is restored into the controller;
5. the renderer is mounted at the restored logical tick rather than tick zero.

This means Continue is not a cosmetic alias for New Game.

In-game quick save/load shortcuts remain available and continue to reset the fixed-step clock after restoration.

## Options, Credits and Quit

Options currently exposes fullscreen switching and authoritative runtime facts about native resolution, integer/nearest presentation and language selection. Language selection remains in the Player status rail because the localisation subsystem owns locale persistence and page reload semantics.

Credits identify the running engine without claiming ownership of the game's original content.

Browsers cannot reliably close arbitrary tabs, so Quit deliberately enters a paused quit plate that asks the player to close the tab or return to title. It does not fake a successful process exit.

## Localisation interaction

The runtime bundle is parsed and localised before the title plate is shown, so the game title reflects the selected presentation locale. The existing language selector remains available in the status rail during the shell.

The Player status updater uses a direct-child status target so the appended language selector cannot intercept save, load or replay feedback.

## Verification

Focused state-machine coverage lives in:

```text
apps/player/tests/classic-front-end-state.test.ts
```

It verifies:

- minimum splash hold and automatic transition;
- disabled save actions;
- wraparound menu movement;
- Continue and Load effects;
- Options, Credits and Quit navigation;
- reselection when save availability changes.

The Player production build and complete Player tests remain part of the governed Editor Expansion/manual release gate. Final shipping evidence also requires browser interaction and 1× native presentation review.