# Deterministic game lifecycle outcomes

Adventure Studio models failure screens and endings as authored consequences of canonical story state. The Player does not infer death from a variable name, a score value or a scene convention.

## Lifecycle manifest

`@evavo/adventure-project-schema/lifecycle` defines a project-scoped `GameLifecycleManifest` containing ordered outcomes. Each outcome provides:

- a stable ID;
- `failure` or `success` kind;
- explicit integer priority;
- one canonical project `Condition`;
- title and message copy;
- recovery/menu policy and labels.

Conditions reuse the engine's existing deterministic grammar: flags, scalar variables, inventory possession, completed interactions, completed dialogue choices, and nested `all`, `any` and `not` expressions.

Every outcome must expose Restart Game or Return to Title. Quick Retry and Load Game are allowed as additional routes, but neither may be the only escape because compatible saves might not exist.

## Deterministic selection

The packaged Player evaluates lifecycle conditions after the runtime controller has advanced canonical world state for the rendered logical tick. If several outcomes are true at once, selection is stable:

1. highest priority;
2. lexical outcome ID as the tie-break.

Authored array order, monitor refresh rate and browser event timing therefore cannot choose a different ending.

## Runtime compilation

`@evavo/adventure-compiler/with-lifecycle` attaches a validated, canonically ordered lifecycle manifest to any already compiled runtime bundle. This means scene composition, fonts, interface skins, audio, localisation and front-end data can remain intact.

Unlike localisation and front-end presentation data, lifecycle rules are gameplay-affecting. They remain part of the save-compatible runtime fingerprint. Changing the condition that causes a game over or ending therefore creates a distinct save compatibility boundary.

## Player behavior

When an outcome matches, the Player freezes logical time and blocks gameplay input. A native 320 by 200 recovery screen is layered over the last deterministic gameplay frame.

Available routes are authored per outcome:

- Quick Retry loads validated slot 0;
- Load Game opens the same ten validated save slots used by the title screen and pause menu;
- Restart Game reloads a fresh controller without replaying the title shell for that one boot;
- Return to Title reloads the normal publisher/title flow.

A loaded save is restored at its exact logical tick. If that restored state still satisfies a lifecycle condition, the outcome screen deterministically appears again on the next lifecycle evaluation rather than silently dismissing a terminal state.

## Replay boundary

Lifecycle selection itself is not a gameplay command. Replays record the canonical commands and state transitions that caused the outcome. Recovery actions such as loading another save, restarting or returning to title are session orchestration and do not mutate the completed replay history.

## Current authoring boundary

The lifecycle manifest is currently a headless/project sidecar contract. A dedicated Studio lifecycle workspace and localisation adapter for outcome title/message text are the next authoring layers; runtime semantics do not depend on those visual tools.