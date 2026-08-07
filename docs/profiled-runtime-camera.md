# Profiled runtime camera

## Purpose

Classic adventure framing is part of game feel. A room may be a fixed
illustrated tableau, a controlled side-scrolling composition, or a deliberately
directed cinematic shot. The camera follows the same logical-tick contract as
movement without changing world-space navigation, hotspots, object geometry or
story state.

`@evavo/adventure-runtime-controller/profiled-camera` provides the
renderer-neutral camera contract. The packaged runtime controller now owns one
optional instance of that state and supplies its resolved camera to every scene
frame.

It supports:

- fixed, dead-zone-follow and shot-led profile behavior;
- native-pixel or subpixel camera presentation;
- bounded acceleration, look-ahead and deterministic settling;
- controlled-actor and entrance fallback targets;
- authored `camera-shot` sequence cues;
- step, linear, ease-in, ease-out and ease-in-out shot timing;
- exact scene-bound clamping;
- strict versioned serialization and save compatibility;
- replay convergence through the existing embedded save-game contract;
- explicit legacy origin behavior when no profile is selected.

## World and screen separation

The camera only supplies the resolved frame's presentation transform:

```text
screen position = world position - camera position + shake offset
```

World-space data remains unchanged:

- actor positions;
- navigation polygons;
- hotspot geometry;
- object interaction targets;
- entrance positions;
- puzzle and dialogue state.

The packaged controller converts native screen input through the current
resolved camera before scene hit testing. Interface and cursor nodes remain in
the renderer's screen-space root, so camera motion cannot drag the UI or alter
hotspot coordinates.

## Initial framing

A runtime bundle without `playFeelProfileId` receives no profiled camera state
and resolves to the established `{ x: 0, y: 0 }` camera.

A profiled bundle initializes according to its camera family:

- `fixed`: room origin;
- `dead-zone-follow`: controlled actor or current entrance placed at the center
  of the authored dead zone;
- `shot-led`: controlled actor or entrance centered until an authored shot takes
  control.

The result is clamped to scene dimensions. Native-pixel profiles quantize the
visible position while retaining the unquantized position for deterministic
acceleration.

## Controller integration

The packaged controller advances the world and camera together one logical tick
at a time. For each tick it:

1. advances canonical world, movement, dialogue and sequence state;
2. supplies the previous and next world snapshots to the camera adapter;
3. supplies sequence and command runtime events from that same tick;
4. resolves the new camera without changing world coordinates;
5. builds the scene frame using that resolved camera.

Immediate zero-tick interactions use the same transition path. A dialogue
choice, object command or sequence request can therefore start a camera shot or
change scene before the next logical tick, and the next rendered frame already
uses the correct composition.

For dead-zone following, target velocity comes from the controlled actor's
previous and current canonical world positions. A scene change resets the
camera directly against the new scene and story tick; the reset is not advanced
a second time.

## Authored camera shots

The adapter consumes existing `sequence-cue-reached` events whose cue kind is
`camera-shot`.

A shot records:

- sequence, track and cue identity;
- logical start tick;
- authored duration;
- starting camera position;
- clamped target position;
- easing policy.

Shot position is calculated from absolute logical progress rather than
accumulated browser-frame deltas. A duration of zero snaps at the cue tick. A
completed shot holds its target until another shot replaces it or the owning
sequence completes or is skipped.

Sequence completion releases the shot after the current logical frame has been
resolved. This preserves the final directed frame while allowing the selected
fixed, follow or shot-led family to resume on the next tick.

## Save and restore

New saves add an optional `interface.profiledCamera` field. It contains the
versioned camera state and active canonical shot identity. Old saves omit the
field and retain their exact serialized interface shape.

On restore:

- a present camera state is strictly parsed and compatibility-checked before the
  first post-load frame;
- an old save without camera state recreates canonical framing from the current
  scene, controlled actor and selected profile;
- a controller restored from that old shape continues omitting the camera field,
  preserving legacy save and replay fingerprints;
- a fresh profiled play session persists camera state from its first save;
- an unprofiled bundle keeps the legacy origin camera;
- stale scene, profile, cue, tick, bounds or quantization data fails visibly.

Compatibility validation checks:

- runtime and saved profile identity;
- profile and bundle logical tick rate;
- current scene identity;
- camera and story tick equality;
- camera bounds and quantization;
- active sequence ownership;
- sequence track and cue identity;
- camera-shot duration, target and easing;
- future-dated shot starts;
- shot positions against current scene bounds.

The active shot points back to canonical sequence data rather than duplicating
an ungoverned timeline. Editing the original cue invalidates stale presentation
state before restoration.

## Replay convergence

Replay logs already embed a validated initial save and drive the packaged
controller to exact logical ticks. Because the save now includes optional camera
state, replay needs no parallel camera format.

A replay restored during an in-flight follow or directed shot advances through
the same world-and-camera loop and produces the same final save fingerprint as
direct deterministic play. Replays whose initial save predates camera persistence
remain in legacy save-shape mode, so their historical final fingerprints do not
change merely because camera presentation is now active.

## Remaining presentation work

The camera is now active in packaged frames, saves and replays. Presentation
interpolation remains a renderer-only concern: it may interpolate authorized
camera presentation between logical states, but it must never move world-space
hit geometry, story consequences, actor movement, dialogue, inventory or save
state off their canonical ticks.
