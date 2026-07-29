# Architecture

## Goal

EVAVO Adventure Studio must reproduce the expressive strengths of 1990s graphic adventures without inheriting their brittle authoring pipelines, arbitrary dead ends or inaccessible interaction design.

The architecture separates authored content, deterministic simulation, rendering, input presentation and editor state. A project must remain playable when the editor UI, renderer or packaging target changes.

## System boundaries

### 1. Project model

Human-readable, versioned data describes games, rooms, actors, props, hotspots, walk areas, occluders, dialogue, inventory, score events, scripts, timelines and presentation profiles.

Stable string IDs are used for all cross references. Serialized data contains no runtime object pointers and no renderer-specific classes.

### 2. Semantic validator

Structural validation catches malformed documents. Semantic validation catches valid-looking but broken content such as missing scene exits, unreachable dialogue nodes, duplicate score awards, invalid asset references, walk targets outside navigation areas and interactions with no fallback response.

### 3. Deterministic runtime

The runtime consumes commands and emits events. It owns game flags, variables, inventory, score, actor state, room state, dialogue state and script tasks. Rendering and audio react to emitted events but cannot mutate story state directly.

The simulation uses a fixed logical tick. Animation may interpolate visually, but puzzle and cutscene outcomes never depend on monitor refresh rate.

### 4. Script and sequence layer

Common behaviour is expressed as typed actions and conditions rather than arbitrary code. Advanced extensions may call sandboxed registered functions through explicit capabilities.

Sequences support parallel tracks, waits, actor movement, speech, animation, camera framing, sound, music, fades, palette effects, object state changes, flags, choices and skippable cutscene boundaries.

### 5. Scene solver

Rooms combine:

- logical canvas dimensions;
- background and parallax planes;
- navigation polygons and links;
- interaction hotspots;
- depth and scale bands;
- walk-behind occluders;
- dynamic props and actors;
- camera bounds and framing zones;
- ambient animation and sound zones.

Navigation, scale and occlusion are related but separate. This permits unusual compositions such as balconies, stairs, foreground arches, windows, reflections and scripted elevation changes without abusing one mask for every purpose.

### 6. Presentation profiles

A game selects a presentation profile defining native resolution, aspect handling, palette policy, text rendering, dialogue layout, cursor grammar, interaction model, animation cadence, transition language, save UI and optional score display.

Profiles include icon-bar, verb-list, verb-coin, two-button, context-sensitive and parser-assisted families. Projects may customise these rather than imitate a named commercial title.

### 7. Renderer adapter

The renderer receives a resolved frame description: ordered visual nodes, transforms, clips, palette effects, camera state and UI composition. It does not decide puzzle logic.

The first renderer will use PixiJS with WebGL, nearest-neighbour texture sampling, integer presentation scaling and explicit render layers. Native-resolution surfaces are composed before scaling to the host window.

### 8. Editor

The editor is a client of the same commands and validation services used by automation. Every visual operation has a serializable command, undo operation and deterministic result.

Major workspaces are Project, Scene, Navigation, Hotspots, Characters, Animation, Dialogue, Inventory, Sequence, Audio, UI, Script, Validation, Playtest and Build.

## Runtime rules

1. Story state changes only through commands.
2. Commands are serializable and testable.
3. Every command produces explicit events or a typed rejection.
4. Save files store canonical state and schema versions, not renderer state.
5. Score awards use unique IDs and are idempotent.
6. Interactions always resolve to a response, even when no authored action matches.
7. Cutscenes declare skip boundaries and a deterministic completion state.
8. Player death, unwinnable states and timed failure are opt-in project policies with authoring warnings.
9. Dialogue choices support availability, visibility and exhaustion independently.
10. Randomness comes from named deterministic streams recorded in saves and replays.

## Authenticity without needless friction

The engine preserves low-resolution composition, limited animation, deliberate timing, expressive cursor feedback, strong scene staging and inventory-driven puzzle construction. It improves common historical problems with optional hotspot readability, subtitle and speech controls, scalable UI, interaction fallbacks, reversible speed controls, generous save handling, puzzle-state diagnostics and automated soft-lock detection.

## Repository plan

- `src/model`: canonical authored types and schemas.
- `src/runtime`: deterministic state, commands, reducers and scheduling.
- `src/scene`: navigation, depth, scale, hit testing and occlusion.
- `src/dialogue`: graph evaluation and conversation state.
- `src/sequence`: cutscene and ambient timeline execution.
- `src/validation`: structural and semantic project checks.
- `src/render`: renderer-neutral frame contracts.
- `src/editor`: command history and editor services.
- `examples`: complete small games and stress fixtures.
- `tests`: unit, scenario, replay and migration coverage.
