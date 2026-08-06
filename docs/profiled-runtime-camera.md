# Profiled runtime camera adapter

## Purpose

Classic adventure framing is part of game feel. A room may be a fixed illustrated tableau, a controlled side-scrolling composition, or a deliberately directed cinematic shot. The camera must follow the same logical-tick contract as movement without changing world-space navigation, hotspots, object geometry or story state.

`@evavo/adventure-runtime-controller/profiled-camera` provides a renderer-neutral, save-safe camera adapter for runtime bundles that select a play-feel profile.

It supports:

- fixed, dead-zone-follow and shot-led profile behavior;
- native-pixel or subpixel camera presentation;
- bounded acceleration, look-ahead and deterministic settling;
- controlled-actor and entrance fallback targets;
- authored `camera-shot` sequence cues;
- step, linear, ease-in, ease-out and ease-in-out shot timing;
- exact scene-bound clamping;
- strict versioned serialization;
- route-independent save compatibility checks;
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

Pointer input must continue to use `nativeScreenPointToWorld` before scene hit testing. Interface and cursor nodes remain in the renderer's screen-space root, so camera motion cannot drag the UI or software cursor.

## Initial framing

A runtime bundle without `playFeelProfileId` receives no profiled camera state and resolves to the established `{ x: 0, y: 0 }` camera.

A profiled bundle initializes according to its camera family:

- `fixed`: room origin;
- `dead-zone-follow`: controlled actor or current entrance placed at the center of the authored dead zone;
- `shot-led`: controlled actor or entrance centered until an authored shot takes control.

The result is clamped to the scene dimensions. Native-pixel profiles quantize the visible position while retaining the unquantized position for deterministic acceleration.

## Logical-tick advancement

`advanceProfiledRuntimeCamera` accepts either zero or one logical tick. Higher-level controllers should advance it alongside the runtime world one tick at a time.

For dead-zone following, target velocity comes from the controlled actor's previous and current canonical world positions. The camera then uses the selected play-feel profile's acceleration, maximum speed, look-ahead, dead zone, settling and quantization rules.

A scene change resets the camera directly against the new scene and story tick. The reset is not advanced a second time, preventing camera time from drifting one tick ahead of canonical story state.

## Authored camera shots

The adapter consumes existing `sequence-cue-reached` runtime events whose cue kind is `camera-shot`.

A shot records:

- sequence, track and cue identity;
- logical start tick;
- authored duration;
- starting camera position;
- clamped target position;
- easing policy.

The shot position is calculated from absolute logical progress rather than accumulated frame deltas. A duration of zero snaps at the cue tick. A completed shot holds its target until another shot replaces it or the owning sequence completes or is skipped.

Sequence completion releases the shot after the current logical frame has been resolved. This preserves the final directed frame while allowing the selected fixed, follow or shot-led family to resume on the next tick.

## Serialization and compatibility

`canonicalProfiledRuntimeCameraJson` and `parseProfiledRuntimeCameraJson` provide a strict versioned payload. Unknown fields, unsupported versions, unknown profiles, malformed points and invalid counters fail visibly.

Compatibility validation checks:

- runtime and saved profile identity;
- profile and bundle logical tick rate;
- current scene identity;
- camera and story tick equality;
- camera bounds;
- native-pixel quantization;
- active sequence ownership;
- sequence track and cue identity;
- camera-shot duration, target and easing;
- future-dated shot starts;
- shot positions against current scene bounds.

The active camera shot points back to canonical sequence data rather than duplicating an ungoverned timeline. Editing that cue therefore invalidates stale presentation state before restoration.

## Integration boundary

This commit establishes the camera contract, sequence-cue handling, serialization and compatibility proof. The existing packaged controller is intentionally unchanged in this slice.

The next integration step should:

1. keep one optional profiled camera state beside controller interface state;
2. advance world and camera together one logical tick at a time;
3. pass the resolved camera into `resolveRuntimeSceneFrame`;
4. persist the optional camera state in new saves while accepting old saves without it;
5. restore the exact camera and active shot before the first post-load frame;
6. prove pointer hit testing still converts through the resolved camera;
7. prove direct play, save/load and replay resolve identical camera traces.
