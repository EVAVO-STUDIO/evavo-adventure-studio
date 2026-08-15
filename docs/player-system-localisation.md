# Player system-menu localisation

The classic pause, save, load and options overlay uses a governed localisation adapter instead of hard-coded translated branches in React or DOM code.

## Source contract

`@evavo/adventure-project-schema/localisation` exports:

```text
extractPlayerSystemLocalisableText(projectId)
playerSystemLocalisationKey(field)
canonicalPlayerSystemText(field, values)
formatPlayerSystemText(text, values)
```

The catalogue covers:

- pause, save, load, options and return-to-title headings;
- explanatory submenu copy;
- resume, save, load, options, fullscreen, back and confirmation labels;
- quick-save and numbered save-slot labels;
- empty, damaged and valid slot summaries;
- score and inventory-count detail lines;
- save, load and fullscreen notices;
- keyboard-control footer copy;
- the system-menu accessibility label.

Dynamic copy uses the same `{placeholder}` grammar validated elsewhere in the localisation pipeline. Slot numbers, scene names, logical ticks, scores, item counts and error messages are supplied only at presentation time.

## Compatibility policy

Player system text is opt-in for existing localisation manifests. A manifest opts in when any target locale contains a `playerSystem.*` entry.

After opt-in:

1. the compiler adds the complete canonical Player system catalogue to the runtime locale pack;
2. draft locales may use source fallback;
3. review locales report missing system copy as warnings;
4. release locales must translate the complete system catalogue;
5. placeholder mismatches remain compilation errors.

A legacy manifest with no `playerSystem.*` entries remains source-compatible and the Player uses canonical English copy. This avoids silently breaking existing projects while allowing Studio-generated manifests to adopt complete system localisation immediately.

## Runtime behavior

The Player resolves system copy from the selected runtime locale pack. If a pack, locale or individual key is unavailable, the canonical source resolver is used. Localization changes labels and notices only; menu IDs, save-slot numbers, compatibility checks, logical ticks, state transitions, fullscreen behavior and return-to-title effects are unchanged.

`classicSystemMenuItems` and `transitionClassicSystemMenu` accept the same text-resolver contract, so the deterministic menu state machine can be tested independently of the DOM with either canonical or translated copy.

## Studio authoring

The Localisation Studio fixture includes the Player system adapter alongside project, front-end and lifecycle sources. New target locales receive complete entries for all governed surfaces. Player system roles participate in native bitmap text-fit auditing:

```text
player-system-heading
player-system-description
player-system-menu-label
player-system-status
player-system-footer
```

Representative French translations and a complete pseudo-localised target are included for pressure testing.

## Verification coverage

```text
packages/project-schema/tests/player-system-localisation.test.ts
packages/compiler/tests/player-system-localisation.test.ts
apps/player/tests/player-system-localisation.test.ts
apps/player/tests/system-menu-state.test.ts
apps/studio/tests/localisation-workspace.test.ts
```

The governed Editor Expansion command includes the compiler test explicitly and already includes all project-schema, Player and Studio tests. Full release evidence still requires the pinned Node, pnpm, TypeScript, Biome, Vitest and production-build toolchain.
