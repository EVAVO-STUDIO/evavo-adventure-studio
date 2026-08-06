# Profiled runtime movement adapter

## Purpose

`@evavo/adventure-scene-runtime/profiled-movement` connects canonical
navigation routes to the deterministic movement contracts in
`@evavo/adventure-play-feel` without replacing the existing constant-speed
runtime path.

The adapter is deliberately additive:

- legacy movement remains unchanged;
- eligible geometric routes can opt into profile-driven acceleration,
  braking, cornering and exact arrival;
- profile identity and fixed-unit state can be serialized independently;
- saved movement is rejected when route geometry, profile identity or logical
  tick rate changes;
- non-geometric portal traversal falls back explicitly instead of inventing
  physical motion.

## Begin and advance

```ts
const started = beginProfiledNavigationMovement({
  actorInstanceId,
  route,
  profileId: "storybook-deliberate",
  logicalTicksPerSecond: 60,
});

if (started.kind === "profiled") {
  const next = advanceProfiledNavigationMovement(
    started.state,
    route,
    60,
  );
}
```

A start result is one of:

- `profiled`: the route has deterministic fixed-unit motion state;
- `legacy-fallback`: the route is valid for the established mover but cannot
  be represented faithfully by the profile solver;
- `rejected`: the selected profile is invalid or incompatible with the
  runtime tick rate.

## Route eligibility

The profiled solver requires a one-to-one geometric route:

- at least two points;
- exactly one segment between each adjacent point pair;
- matching point and segment endpoints;
- no zero-length segment;
- portal cost equal to its geometric distance.

A portal with authored traversal cost may represent stairs, a ladder, a
squeeze, a door animation or another time-based transition. Treating that
cost as Euclidean distance would corrupt actor position and footfall phase, so
the adapter returns a typed legacy fallback.

## Deterministic evidence

Advancement produces stable events for:

- movement phase changes;
- left and right footfalls;
- route segment completion;
- final movement completion.

Walk-cycle phase comes from travelled native distance, not display refresh
rate. Chunked advancement is internally evaluated one logical tick at a time,
so it converges on identical movement state, event order, event timestamps and
footfall evidence.

## Save safety

`canonicalProfiledNavigationMovementJson` and
`parseProfiledNavigationMovementJson` provide a strict versioned payload.
Unknown fields, unsupported versions, unknown profiles, malformed fixed-unit
values and inconsistent extension identities fail visibly.

Compatibility validation checks:

- route fingerprint;
- route point count;
- profile tick rate;
- fixed-unit distance and remainder bounds;
- exact segment index and distance within the segment;
- canonical and quantized actor positions reconstructed from route distance;
- walk-cycle phase reconstructed from travelled distance;
- movement phase history;
- completed segment count reconstructed from crossed route boundaries;
- exact zero-velocity arrival.

The route itself is not duplicated in the save payload. The saved fingerprint
is compared with the current authored navigation route, preventing stale
movement state from being applied to revised level geometry.

## Boundary

This commit establishes the safe adapter and save contract. The existing
packaged controller continues to use legacy movement until a subsequent
integration commit deliberately chooses a profile, stores the optional adapter
state in the world save, and proves save/load and replay convergence.
