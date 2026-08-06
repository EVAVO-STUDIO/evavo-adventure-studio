# Profiled runtime movement

## Purpose

`@evavo/adventure-scene-runtime/profiled-movement` connects canonical
navigation routes to the deterministic movement contracts in
`@evavo/adventure-play-feel` without invalidating the established
constant-speed runtime path.

The packaged runtime now adopts that adapter through the normal movement map:

- a runtime bundle may declare one optional `playFeelProfileId`;
- eligible geometric routes use profile-driven acceleration, braking,
  cornering and exact arrival;
- the active movement keeps its legacy projection fields for compatibility;
- new saves add an optional versioned `profiled` movement field;
- old bundles and old movement saves remain structurally unchanged;
- non-geometric portals fall back explicitly to the legacy mover;
- replay logs preserve and advance in-flight profiled movement through their
  existing embedded save-game contract.

## Compiler boundary

A production profile is attached after canonical project compilation:

```ts
import { compileProjectWithInstances } from
  "@evavo/adventure-compiler/with-instances";
import { attachRuntimePlayFeelProfile } from
  "@evavo/adventure-compiler/with-play-feel";

const compiled = compileProjectWithInstances(
  project,
  assets,
  sceneInstances,
  bitmapFonts,
  uiSkins,
);

const packaged = attachRuntimePlayFeelProfile(
  compiled,
  "storybook-deliberate",
);
```

The wrapper reparses the runtime bundle, writes the governed profile identity,
and recalculates canonical JSON and the compiled-project fingerprint. The
unprofiled compiled project is not mutated.

This keeps production-profile selection outside the source project schema while
making the selected timing contract part of the shipping bundle identity.

## Beginning movement

`beginActorMovement` resolves its timing policy in this order:

1. an explicit `playFeelProfileId` supplied by the caller;
2. the runtime bundle's `playFeelProfileId`;
3. the established legacy speed path when neither is present.

A caller may pass `playFeelProfileId: null` to deliberately force legacy
movement for a compatibility test or a specialised traversal.

The start result exposes whether the route is using `profiled` or `legacy`
movement. When a selected profile falls back, the result also includes a typed
reason such as `non-geometric-portal`.

## Route eligibility

The profiled solver requires a one-to-one geometric route:

- at least two points;
- exactly one segment between each adjacent point pair;
- matching point and segment endpoints;
- no zero-length segment;
- portal cost equal to its geometric distance.

A portal with authored traversal cost may represent stairs, a ladder, a
squeeze, a door animation or another time-based transition. Treating that cost
as Euclidean distance would corrupt actor position and footfall phase, so the
runtime uses the legacy mover at the selected profile's top-speed character.

## Runtime state

A profiled `ActorMovementState` retains the legacy fields:

- actor instance ID;
- canonical navigation route;
- current segment index;
- distance along the segment;
- speed override;
- walk and arrival animation states.

It additionally stores the optional versioned profiled movement state. The
legacy fields are updated as a projection of the fixed-unit solver so existing
command queues, movement cancellation, scene-transition cleanup and inspection
surfaces continue to operate on one movement collection.

Advancement produces stable events for:

- movement phase changes;
- left and right footfalls;
- route segment completion;
- final movement completion.

Batched advancement is evaluated one logical tick at a time internally, so it
converges on the same state, event order, event timestamps and footfall evidence
as repeated single-tick advancement.

## Save compatibility

The save schema adds `profiled` as an optional movement field. When absent, Zod
parsing does not manufacture the property, so a legacy movement keeps the same
canonical serialized shape and save fingerprint inputs.

When present, save compatibility validates:

- actor identity;
- bundle and movement profile identity;
- route fingerprint and point count;
- logical tick rate;
- fixed-unit distance and remainder bounds;
- exact segment index and distance within the segment;
- canonical and quantized actor positions reconstructed from route distance;
- walk-cycle phase reconstructed from travelled distance;
- movement phase history;
- completed segment count reconstructed from route boundaries;
- exact zero-velocity arrival.

Changed level geometry or corrupted motion state therefore fails before the
world is restored.

## Replay convergence

Replay logs already embed a fully validated initial save and use the packaged
controller to advance to each logical tick. No parallel replay format is
required.

An in-flight profiled movement is restored from the initial save, advanced by
the normal scene runtime and included in the final save fingerprint. Focused
regression coverage proves that an empty-input replay continuing a walk reaches
the same final save fingerprint as direct deterministic advancement.

## Remaining presentation work

This integration makes actor position, route timing, footfall evidence, saves
and replays profile-aware. It does not yet claim that final sprite playback is
distance-locked or that the packaged Player consumes the profile camera model.
Those are separate presentation slices because they must preserve:

- authored animation clips and interruptibility;
- sequence-owned camera shots;
- world-space hit geometry;
- renderer-neutral resolved frames;
- old project and save behaviour.

The next adoption step should bind walk-cycle presentation and camera output to
this deterministic state without moving story consequences off logical ticks.
