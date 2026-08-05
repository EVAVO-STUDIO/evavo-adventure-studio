# Classic adventure play-feel, motion and frame timing

## Purpose

Adventure presentation is not authentic because the final image has visible pixels. The game must also respond, move, hold, cut and settle according to one coherent production language.

`@evavo/adventure-play-feel` provides a renderer-neutral contract for:

- deterministic actor kinematics;
- acceleration and braking in native pixels;
- authored slowdown at sharp route corners;
- native-pixel or subpixel canonical display policy;
- distance-locked walk-cycle phase and footfall events;
- fixed, dead-zone and shot-led camera behaviour;
- bounded fixed-step frame pacing;
- input acknowledgement and command-buffer timing;
- action anticipation and recovery holds;
- scene-transition timing;
- compatibility and trace audits.

Open the Studio workspace at:

```text
http://localhost:5174/?workspace=feel
```

The package entry point is:

```ts
@evavo/adventure-play-feel
```

## Why this is a separate core contract

Movement code, animation playback, camera presentation, input handling and renderer cadence are separate systems. They must share an authored timing language without becoming one tightly coupled update loop.

The play-feel package therefore does not own:

- navigation pathfinding;
- canonical story state;
- actor animation assets;
- camera-shot sequence authoring;
- pointer hit testing;
- PixiJS scene construction;
- audio playback;
- project editing.

It provides deterministic timing and motion services that those systems can consume.

This boundary protects several important invariants:

1. story consequences advance only on logical ticks;
2. render refresh rate cannot alter canonical position or puzzle state;
3. actor walking phase is based on travelled distance rather than monitor cadence;
4. camera presentation cannot move world-space hit geometry;
5. a large browser-frame stall cannot run an unbounded simulation catch-up;
6. the same route, profile and inputs produce the same trace;
7. old constant-speed runtime movement remains valid while profile-driven movement is introduced through a versioned adapter.

## Production-family mapping

The production profiles map to distinct play-feel profiles:

| Production profile | Play-feel profile | Primary timing character |
| --- | --- | --- |
| Storybook Icon VGA | `storybook-deliberate` | measured starts, readable turns, patient feedback and fixed tableaux |
| Comic Science-Fiction VGA | `comic-snappy` | immediate acknowledgement, rapid acceleration and punch-line holds |
| Gothic Investigation VGA | `gothic-measured` | weighted traversal, restrained turns and longer evidence or portrait beats |
| Verb Panel Cartoon VGA | `verb-panel-responsive` | fast command construction, route replacement and short feedback loops |
| Pulp Archaeology VGA | `pulp-grounded` | practical traversal, controlled follow camera and readable action handling |
| Cinematic Pulp VGA | `cinematic-directed` | shot-led camera, blocking, eyelines and deterministic cutscene closure |
| Neo-Noir Low-Resolution | `noir-restrained` | sparse motion, narrow camera response and long meaningful stillness |

`classic-balanced` remains available for projects that have not selected a production family.

These profiles contain original runtime data. Historical game and publisher names are confined to research documentation and do not appear in executable profile presets.

## Deterministic route kinematics

`createAdventureKinematicRoute` validates a route and converts every segment to fixed native motion units. Consecutive duplicate points are rejected rather than silently creating zero-length segments.

`createAdventureMotionState` and `advanceAdventureMotion` maintain:

- route distance;
- current segment and distance within it;
- velocity;
- fixed-step distance remainder;
- unquantized canonical position;
- profile-authorized display position;
- movement phase;
- distance-locked walk-cycle phase;
- left or right footfall events.

### Acceleration and arrival

The motion solver uses a bounded velocity envelope. Each logical tick compares:

- profile top speed;
- acceleration-limited speed from the start;
- braking-limited speed for the final destination;
- braking-limited speed for the next sharp corner.

The final step is clamped to the exact route destination. It cannot overshoot, oscillate around the approach point or depend on renderer delta time.

### Cornering

A route corner above the profile threshold introduces a lower corner-speed limit. The solver begins braking before the corner and accelerates after it.

This is not rigid-body physics. Classic point-and-click actors need deterministic authored kinematics, not friction, impulses or collision response designed for platform games. Navigation remains responsible for valid routes; play feel controls how the actor performs that route.

### Walk-cycle phase

Walk phase is calculated from canonical route distance:

```text
phase = travelled native pixels mod pixels-per-cycle
```

This keeps footsteps and planted poses stable when:

- the display refresh rate changes;
- a frame is dropped;
- the renderer is temporarily hidden;
- the same replay is executed on another machine.

## Camera behaviour

`advanceAdventureCamera` supports three modes.

### Fixed

The room is composed as one stable shot. Actor movement does not move the camera.

### Dead-zone follow

The actor may move inside a normalized screen region without camera motion. Once the actor crosses the region, the camera accelerates toward the minimum correction required to restore the composition.

The camera:

- remains clamped to the world bounds;
- supports limited directional look-ahead;
- settles deterministically;
- emits a separately quantized display position;
- never changes canonical actor or hotspot coordinates.

### Shot-led

The sequence or scene director provides an explicit shot position. General actor movement does not override authored framing.

This is intended for cinematic travel and relationship-driven scenes. Camera shots remain presentation events; story changes remain canonical sequence actions.

## Fixed-step frame pacing

`advanceAdventureFramePacing` wraps the existing core fixed-step clock with profile rules.

The result contains:

- logical ticks to run;
- bounded interpolation alpha;
- deliberately dropped wall-clock time;
- logical and presentation tick positions.

A profile may expose camera-only interpolation. `interpolateAdventureCameraPresentation` blends only the previous and current camera presentation states, then applies the profile camera quantization. Actor state, interactions, dialogue, score, inventory, sequence actions and saves remain on integer logical ticks.

When a browser frame arrives late, the clock:

1. clamps the accepted frame delta;
2. limits catch-up ticks;
3. records dropped time;
4. leaves canonical event ordering intact.

This avoids both simulation spirals and accidental fast-forwarding through narrative state.

## Input and action timing

Profiles define:

- hover commitment;
- double-activation window;
- command-buffer duration;
- drag threshold in native pixels;
- minimum status hold;
- start, turn and arrival poses;
- action anticipation and recovery;
- scene fade-out, dark hold and fade-in.

These values are not artificial latency. They divide immediate intent acknowledgement from canonical action completion.

For example, an object command can show `USE AFTER APPROACH` immediately, queue the action, walk to the authored point and execute only after arrival. The visible verb and target must remain the command that eventually runs.

## Studio evidence

The Motion & Timing Lab simulates one multi-segment native route for every production family. It exposes:

- actor position at any logical tick;
- acceleration, cruise, cornering and arrival phases;
- display position versus unquantized canonical position;
- footfall phase;
- camera position and mode;
- velocity envelope;
- irregular render-frame conversion into logical ticks;
- dropped-time evidence;
- complete movement, animation, camera, input and transition contract.

The procedural stage is a construction view. It proves timing relationships and coordinate behaviour, not final background or sprite quality.

## Validation

`validateAdventurePlayFeelProfile` rejects malformed contracts including:

- invalid tick rates;
- non-positive speed or acceleration;
- arrival speed above top speed;
- invalid corner thresholds or multipliers;
- duplicate footfall phases;
- malformed camera dead zones;
- non-finite camera or timing values;
- empty authenticity, prohibition or review rules.

`auditAdventurePlayFeelProfile` detects project drift in:

- logical tick rate;
- pixel-motion policy;
- render interpolation.

`auditAdventureMotionTrace` detects:

- profile mismatch;
- non-monotonic ticks;
- backwards route progress;
- fractional output under native-pixel policy;
- speed above the contract;
- failure to land exactly on the destination.

## Save compatibility and runtime adoption

Existing movement state is part of the versioned save-game contract. Runtime adoption must therefore be additive:

1. keep the existing constant-speed movement fields readable;
2. add optional versioned play-feel state;
3. preserve old saves without migration;
4. serialize profile identity and deterministic motion remainder for new saves;
5. make the runtime use the old path when the optional extension is absent;
6. add replay fixtures proving chunked and one-tick execution are identical.

The package and Studio lab establish the core contract without pretending that save-safe runtime adoption is already complete.

## Release boundary

A deterministic movement trace is necessary but not sufficient. Final release evidence still requires:

- canonical navigation and scene staging;
- final actor frames and pivots;
- compiled nearest-neighbour pixels;
- bitmap cursors and interface assets;
- audio latency and footstep review;
- camera and hit-coordinate verification;
- save, load and replay convergence;
- native-size human playtesting;
- puzzle comprehension and recovery testing.

The goal is not to reproduce proprietary code or copied game content. The goal is to preserve the general production disciplines that made classic adventures readable, responsive, atmospheric and internally coherent.
