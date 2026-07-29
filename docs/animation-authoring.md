# Sprite and character animation authoring

## Purpose

The Animation workspace edits focused actor definitions from canonical `project.json`. It owns native sprite-frame geometry and performance clips; it does not own compiled atlas placement, scene placement or runtime playback state.

Open it from the main Studio navigation or directly:

```text
http://localhost:5174/?workspace=animation
```

## Authored frame geometry

Every sprite frame retains:

- stable frame and logical asset IDs;
- compiled atlas source rectangle;
- original untrimmed canvas dimensions;
- trim offset within that original canvas;
- pivot and foot point in original-canvas coordinates;
- optional shadow and attachment anchors;
- fixed logical duration in ticks;
- frame-entry markers such as footsteps, prop releases and sound events;
- explicit mirroring eligibility.

Trim offsets and anchors are integer native pixels. The trimmed rectangle must fit inside the original canvas. Editing trim geometry never redefines the actor's foot position or silently recentres a frame.

## Performance clips

An animation clip is selected by a unique `(state, facing)` pair. Clips contain stable frame IDs rather than copied frame data.

The workspace supports:

- looping and one-shot performances;
- interruptible and protected performances;
- repeated frame occurrences;
- uneven frame holds;
- exact fixed-tick cadence previews;
- frame-entry marker inspection;
- guarded insertion, removal and replacement of frame occurrences.

A frame cannot be deleted while any clip references it. Clip-frame commands include the frame ID expected at the edited index, preventing stale automation from changing the wrong occurrence after concurrent edits.

## Focused actor and project integration

Actor files are useful focused editing documents but are not standalone shipping projects.

`@evavo/adventure-animation-editor-core/project-integration` merges edited actors back into canonical `project.json`. The merge rejects:

- actor, frame or animation IDs colliding with other project entities;
- dialogue lines requesting animation states removed by the edit;
- sequence speech requesting missing performance states;
- actor-animation cues without the required state and facing;
- actor movement arrival facings unsupported by the actor;
- actors not already present in the target project.

The Studio's pure `animation-project-export` service merges every focused actor history in canonical project order.

## Visual preview

The current visual preview is deliberately geometry-first. It renders:

- the original transparent canvas;
- the trimmed sprite region;
- pivot and foot anchors;
- authored dimensions and asset identity;
- cadence blocks, playhead and markers.

It does not fabricate atlas textures or smooth movement. A later compiled-asset preview will load the verified runtime atlas pages and display the exact pixels through the same texture contract used by the player.

## Verification

The editor-expansion CI graph checks the animation core and Studio workspace on Windows and Linux. Relevant tests cover:

- trim and anchor validation;
- duplicate performance identities;
- cadence timeline calculation;
- protected frame references;
- stale clip-frame commands;
- actor-specific undo and redo histories;
- deterministic project merging;
- dialogue and sequence performance-reference protection.

A build must not be described as passing until the workflow or equivalent local commands complete with evidence.
