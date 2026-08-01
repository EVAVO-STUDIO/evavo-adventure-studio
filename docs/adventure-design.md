# Adventure Design Director

## Purpose

The Adventure Design Director is the project-level production bible for a complete narrative adventure. It connects art direction, world geography, chapter progression, puzzle causality, clue delivery and cinematic intent before those decisions are distributed across scene, dialogue, animation and sequence documents.

Open the workspace at:

```text
http://localhost:5174/?workspace=design
```

The design document is a production sidecar. It does not replace canonical `project.json`, scene composition, art-direction policy, interface skins, dialogue graphs or executable sequences. It records why those documents exist, how they fit together and what the finished game must communicate.

## Creative direction

Every document records a native-resolution production doctrine rather than a generic visual mood board:

- native canvas and colour budget;
- production mode and composition grammar;
- anchor palette, shadow, highlight and dithering rules;
- perspective and lighting doctrine;
- material language;
- actor silhouette and background-detail hierarchy;
- portrait and close-up treatment;
- animation cadence;
- interface, music and ambience direction;
- explicit authenticity rules;
- prohibited shortcuts.

The prohibited-shortcut list is deliberate. A project can reject high-resolution art merely reduced to pixels, soft modern UI conventions, indiscriminate dithering, persistent hotspot markers, generic vector typography or any other technique that undermines the selected production language.

## Illustrated world map

The world map is an authored narrative diagram, not a GPS widget. It contains:

- locations and their visual briefs;
- optional links to executable project scenes;
- chapter availability;
- puzzle-based unlocks;
- arrival beats and music cues;
- directed or bidirectional routes;
- travel modes and transitions;
- route puzzle gates.

The validator confirms every route endpoint, location unlock and chapter reference. It also reports chapter locations that have no authored route from the chapter's starting position.

## Chapters and progression

Progression can be organised as acts, days, missions, eras or open phases. Each chapter records:

- a visible player objective;
- its starting location;
- required and optional puzzle threads;
- locations made available;
- opening and closing cinematics;
- the completion beat that changes story, access or character understanding.

This keeps the map, story clock and puzzle graph aligned instead of treating them as unrelated editor screens.

## Puzzle and clue architecture

Each puzzle records:

- a concrete player goal;
- its chapter and location;
- the story payoff;
- whether the problem is established before its solution appears;
- prerequisite puzzles;
- guaranteed and optional clues;
- one or more solution paths;
- action-by-action feedback;
- a graduated hint ladder;
- failure warning and recovery policy;
- score, optionality and design rationale.

Validation includes:

- dependency cycles and self-dependencies;
- missing puzzle, clue, chapter and location references;
- required puzzles without guaranteed clue delivery;
- backwards puzzle construction;
- malformed hint ladders;
- authored death without warning and recovery;
- duplicate IDs across nested solution and storyboard entities.

`adventurePuzzleDependencyOrder` produces a stable topological order suitable for editor flow views, playtest planning and automated design review.

## Cutscene storyboards

Cutscenes are described shot by shot with:

- trigger and chapter ownership;
- native framing;
- duration in logical ticks;
- camera rule;
- actor and prop staging;
- dialogue and sound intent;
- transition;
- deterministic completion actions.

A skippable cutscene must declare completion actions. Watched and skipped paths therefore converge on the same canonical story state. The storyboard is pre-production intent; executable cue timing remains in the sequence editor and Cinematic Timeline Lab.

## Protected editing

`@evavo/adventure-design/editor` provides serializable commands for locations, routes, chapters, clues, puzzles and cutscenes. It supports:

- stable identity protection;
- duplicate-ID rejection;
- reference-safe removal;
- recursive atomic batches;
- inverse commands;
- undo and redo;
- save checkpoints;
- deterministic dirty-state comparison.

The Studio uses an atomic batch when creating a clue and its puzzle thread. Either the entire design operation succeeds or none of it is applied.

## Canonical project validation

`validateAdventureDesignAgainstProject` connects the design sidecar to `project.json`. It verifies:

- project identity;
- native-resolution alignment;
- design locations linked to real project scenes;
- puzzle steps linked to real inventory items;
- cutscene dialogue-choice triggers;
- completion actions that reference items, scenes, entrances, sequences, dialogues, nodes and actors.

Object-state completion actions remain valid design intent because object definitions live in the scene-composition sidecar rather than `project.json`.

## Original showcase productions

The package includes seven original design examples:

- `The Glass Finch` — painted storybook fantasy;
- `The Briar Road` — role-playing adventure with reputation consequences;
- `The Red Ledger` — day-structured gothic investigation;
- `Jade Horizon` — cinematic travel and relationship adventure;
- `Three Minutes Yesterday` — comic cross-era puzzle design;
- `Vacuum Courtesy` — parser-assisted space satire;
- `The Sunken Dial` — archaeological landscape deduction.

These examples demonstrate production grammar without reproducing commercial characters, dialogue, scenes, maps, logos, interfaces, artwork or puzzle solutions.

## Verification

The package is part of both the root TypeScript graph and `tsconfig.editor-expansion.json`. Its tests are included in `scripts/run-editor-expansion-check.mjs` before the Player, Studio, Timeline Lab and CLI builds.

A complete build must not be reported as successful until the repository's governed installed-workspace verification has run with the pinned Node.js, pnpm and committed lockfile.
