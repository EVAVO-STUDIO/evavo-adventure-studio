# Progression flow and soft-lock analysis

## Purpose

The Progression Flow Lab explores the canonical state consequences that connect one adventure objective to the next. It follows source-scene hotspots, stateful object interactions, inventory requirements, dialogue choices and sequence completion actions from the real project and scene-instance documents.

Open the workspace at:

```text
http://localhost:5174/?workspace=progression
```

The lab exists because static reference validation and scene adjacency are not enough. A project can contain valid scenes, items, dialogues and sequences while the only required key is never awarded, a dialogue trigger is conditionally impossible, or an optional branch consumes a required item without recovery.

## Canonical inputs

`evaluateAdventureProgression` accepts:

- canonical `project.json`;
- an optional matching Adventure Design document;
- optional `scene-instances.json`;
- explicit state, depth, witness and nested narrative-request limits.

The evaluator preserves the canonical project and scene-instance validators. Structural or cross-reference errors remain blocking findings rather than being hidden by state exploration.

The Adventure Design sidecar identifies required objectives:

- every design location linked to a canonical scene;
- one item-path objective for each non-optional puzzle whose every solution requires inventory.

Puzzle solutions are alternatives, not cumulative shopping lists. An item-path objective is satisfied when one complete solution's required items have all been acquired. If any authored solution requires no item, that puzzle creates no item objective. Without a matching design document, all canonical project scenes become the scene objective set and item reachability remains informational.

## Runtime semantics modelled

The explorer mirrors the progression-relevant parts of the runtime state:

- current scene;
- flags and variables;
- held and previously acquired inventory items;
- consumed one-shot interactions;
- consumed one-shot dialogue choices;
- stateful object states;
- active dialogue and node;
- visited scenes;
- reached dialogues and sequences.

It evaluates runtime-default flag behaviour, scalar variable comparisons, inventory conditions, interaction memory, dialogue-choice memory and nested `all`, `any` and `not` conditions.

### Scene and object interactions

The explorer enumerates every currently available source hotspot and stateful object interaction. An interaction is available only when:

- its source scene is current;
- its required inventory item is held;
- its condition evaluates true;
- a one-shot interaction has not already been consumed;
- for stateful objects, the placed instance and active state are visible;
- for stateful objects, the active state owns a usable interaction shape and the interaction.

Immediate state actions execute in canonical order. Dialogue and sequence requests are
resolved only after the enclosing interaction action list has finished and a one-shot
interaction has been marked consumed. This matches the runtime event boundary and prevents
node-entry or sequence-completion actions from being applied too early.

### Dialogue

Starting a dialogue enters its requested node or canonical start node and applies node-entry
actions after the requesting action boundary has completed. While a dialogue remains active, world hotspots and stateful objects are not enumerated; only dialogue transitions are available, matching packaged-player input blocking. The explorer then branches across every visible, enabled and unconsumed choice.

Choice actions, node-exit actions, closure and next-node entry are processed as one runtime
operation before any dialogue or sequence requests emitted by that operation are resolved.
When no enabled choice remains, automatic continuation or dialogue completion becomes the
next deterministic transition.

### Sequences

A requested non-looping sequence executes story-action cues in deterministic timeline order:

1. cue tick;
2. stable track ID;
3. cue index.

Completion actions then apply exactly as they do when the sequence reaches its end. This captures story-state and scene transitions without simulating visual-only camera, speech, animation or audio cues.

Looping sequences are explored for one timeline iteration and reported. Recursive sequence
or dialogue requests and nested narrative-request limit exhaustion remain visible findings.

## Bounded state exploration

The evaluator performs deterministic breadth-first exploration and hashes canonical progression state. Repeated states are merged, so reversible doors, scene loops and repeatable interactions do not create unbounded duplicates.

Default limits are:

```text
4,096 unique states
64 state-changing decisions from the start
24 witness steps retained per result
16 nested narrative requests
64 retained terminal-branch witnesses
```

A reached state or depth bound marks the report as truncated. Truncated analysis never claims exhaustive completion. Terminal branches are counted in full, but only the highest-coverage bounded set of terminal witnesses is retained in the report so a highly branching project cannot produce an unbounded review artifact.

Each state-changing transition records a stable step containing:

- source kind;
- source path;
- source scene;
- player-facing label;
- action summary.

Breadth-first order therefore produces the shortest proven witness for each first-reached scene, item, dialogue, sequence and object state.

## Objective coverage

Objective coverage is based on history, not only the current inventory:

- required scenes count once they have been visited;
- a required puzzle item path counts once every item in one alternative solution has been acquired.

Current inventory remains part of the state. This distinction lets the evaluator recognise that a required key was discovered while still detecting a later branch that consumes it and prevents further progress. It also prevents one valid alternate solution from incorrectly requiring every item named by every other solution.

A report is complete only when:

- the configured state space is not truncated;
- every required objective is reached;
- canonical project and scene-instance errors are absent.

## Potential soft locks

The explorer records the complete directed state graph. After exploration it identifies the maximum objective coverage reached anywhere, then walks the graph backwards from every state at that coverage.

A reachable state that cannot return to the maximum coverage frontier is a potential soft lock. The report includes the shortest witness into that branch.

This catches cases such as:

- discarding the only required key after its one-time pickup;
- closing a route behind the player before a required dialogue;
- choosing a state branch that removes all remaining progression actions;
- entering a cycle that cannot return to a productive state.

A reported branch may still be an intentional ending. The correct resolution is to mark and review it deliberately rather than allowing it to remain an accidental trap.

## Reachability findings

The report distinguishes:

- required design scenes that are unreachable;
- other canonical project scenes that are unreachable;
- required puzzles with no fully obtainable alternative item path;
- other project items that are never awarded;
- referenced dialogues and sequences that never start;
- unreferenced narrative drafts;
- interactions that produce no canonical progression-state change;
- recursive dialogue or sequence requests and looping-sequence limits;
- bounded-analysis truncation.

Errors block required objectives. Warnings identify recoverability or referenced-content problems. Notes keep optional drafts and feedback-only interactions visible without misclassifying them as release failures.

## Studio views

The Progression Flow Lab provides three views.

### World flow

The illustrated map is overlaid with only those scene edges proven by executable state transitions. A design route line cannot masquerade as runtime reachability.

The view also exposes explored states, state-changing transitions, maximum decision depth and terminal-branch count.

### Milestones

Milestones show the shortest proven witness for every first-reached:

- scene;
- item;
- dialogue;
- sequence;
- object state.

These witnesses are suitable for playtest scripts and deterministic replay authoring.

### Risks

The Risks view filters errors, warnings and notes, then presents terminal branches with objective coverage, held inventory and witness paths.

The included original production scenarios demonstrate:

- a verified archive-to-harbour route;
- a missing service-key award that blocks the route;
- a branch that consumes the one required key after acquisition.

## Scope boundary

The bounded explorer proves possible canonical state routes within its configured limits. It does not prove that players will discover those routes, understand the clues or enjoy the puzzle.

It also does not replace:

- Adventure Design causality and clue review;
- Native Composition geometry review;
- Native Staging actor and object review;
- compiled asset evidence;
- final 1× visual review;
- Player execution;
- save, load and deterministic replay testing;
- human or simulated playtest evaluation.

A progression route is release-ready only when static exploration, runtime execution, clue comprehension and recovery testing agree.
