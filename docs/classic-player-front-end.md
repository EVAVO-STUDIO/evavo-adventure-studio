# Classic packaged-player front end

The packaged Player has a renderer-independent classic front end before gameplay. It reproduces the deliberate pacing and keyboard-first menu grammar of a 1990s PC adventure without coupling menu state to the deterministic story simulation.

## Flow

A packaged runtime opens in this order:

```text
runtime bundle metadata
→ publisher splash
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

## Project-authored front-end manifest

Games can ship a project-scoped `ClassicFrontEndManifest` from:

```ts
@evavo/adventure-project-schema/front-end
```

The manifest owns presentation policy that belongs to the game rather than to EVAVO's generic fallback shell:

- publisher name and presents line;
- splash duration and minimum skip point;
- title kicker;
- New, Continue, Load, Options, Credits, Quit, Quick Save, Back and Fullscreen wording;
- whether Continue, Load, Options, Credits and Quit appear;
- whether fullscreen is offered;
- authored credit lines.

The schema rejects a splash skip point after the splash has already ended. Runtime bundles also reject front-end manifests scoped to a different project.

A deterministic default can be created with:

```ts
import { createDefaultClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
```

When a runtime bundle has no authored front end, the Player uses the same EVAVO classic defaults that existed before the manifest was introduced.

## Compiler attachment

A front-end manifest is a sidecar rather than gameplay project state. It can be attached to an existing compiled project through:

```ts
import { attachRuntimeFrontEnd } from "@evavo/adventure-compiler/with-front-end";
```

This preserves already compiled scenes, assets, fonts, interface skins, audio, localisation and other runtime data, then recomputes canonical runtime JSON and exact artifact fingerprint.

Because the manifest is presentation-only, save compatibility explicitly excludes it. Publisher, menu, timing and credit changes therefore do not invalidate a player's otherwise compatible save. The exact runtime artifact fingerprint still changes, so release evidence can distinguish the builds.

## Native presentation

The shell is authored on a fixed logical 320×200 frame and scaled to the browser host as one unit. It therefore keeps its title, menu, footer and selection geometry stable across desktop sizes instead of becoming a responsive web menu.

The default skin uses:

- a black publisher plate with a restrained publisher mark;
- a logical-tick splash hold;
- a dark low-resolution title plate;
- keyboard and pointer menu control;
- selection arrows and disabled save entries;
- compact Options, Credits and Quit plates;
- restrained scanline and integer-style presentation treatment.

The shell is DOM-rendered rather than part of the gameplay render graph, but its coordinate system and timing policy are independent of CSS viewport size. It is a pre-game system surface, not canonical story state.

## Deterministic state machine

`classic-front-end-state.ts` owns all navigation decisions. State contains only:

- current front-end screen;
- splash logical tick;
- selected menu index;
- whether a compatible save slot is present.

The authored manifest is converted into a pure front-end policy containing timing, labels, menu visibility and fullscreen availability. Commands are explicit:

- tick splash time;
- skip the splash after its minimum hold;
- move or set selection;
- activate;
- back;
- update save availability.

Effects are limited to starting a new/continued game or requesting fullscreen. Front-end navigation never enters the gameplay command log or replay stream.

The default splash policy is 96 logical ticks with skipping enabled after tick 18. Automatic timing uses a 60 Hz logical front-end clock rather than animation-frame count.

## Main menu

The default title menu exposes:

- New Game;
- Continue;
- Load Game;
- Options;
- Credits;
- Quit.

Continue and Load are disabled when no browser quick-save slot exists. Arrow-key navigation skips disabled entries and wraps in classic menu fashion. Authored menu policy may hide optional entries entirely without changing the state machine.

The current save system has one verified browser quick slot, so Load Game explicitly presents that slot rather than pretending a multi-slot browser UI already exists.

## Continue and Load correctness

The front end checks save presence using the presentation-neutral runtime compatibility fingerprint. When Continue or the quick slot is selected:

1. the save JSON is read and fully validated against the current runtime bundle;
2. corrupt or incompatible data returns the user to the title shell with an explanatory notice and save actions disabled;
3. only after a valid start decision are runtime textures and the packaged controller constructed;
4. the validated save is restored into the controller;
5. the renderer is mounted at the restored logical tick rather than tick zero.

This means Continue is not a cosmetic alias for New Game.

In-game quick save/load shortcuts remain available and continue to reset the fixed-step clock after restoration.

## Options, Credits and Quit

Options exposes fullscreen switching only when the authored policy permits it, plus authoritative runtime facts about native resolution, integer/nearest presentation and language selection.

Credits render the authored credit lines. The generic fallback identifies EVAVO Adventure Studio without claiming ownership of the game's original content.

Browsers cannot reliably close arbitrary tabs, so Quit deliberately enters a paused quit plate that asks the player to close the tab or return to title. It does not fake a successful process exit.

## Localisation interaction

The runtime bundle is parsed and localised before the title plate is shown, so the canonical game title reflects the selected presentation locale. The existing language selector remains available in the status rail during the shell.

Front-end-manifest strings are currently authored presentation sidecar text and are not yet part of the canonical project localisation catalogue. They should be localised through an explicit front-end adapter rather than by making menu labels affect story-localisation identity.

The Player status updater uses a direct-child status target so the appended language selector cannot intercept save, load or replay feedback.

## Verification

Focused coverage includes:

```text
packages/project-schema/tests/front-end.test.ts
packages/runtime-bundle/tests/front-end-runtime.test.ts
packages/save-game/tests/front-end-compatibility.test.ts
apps/player/tests/classic-front-end-state.test.ts
```

It verifies schema defaults and timing boundaries, runtime project scoping, presentation-neutral save compatibility, default navigation, custom menu visibility and labels, fullscreen policy, Continue/Load effects and splash timing.

The Player production build and complete Player tests remain part of the governed Editor Expansion/manual release gate. Final shipping evidence also requires browser interaction and 1× native presentation review.