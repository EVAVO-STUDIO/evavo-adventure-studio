# The Red Ledger playable slice

## Purpose

The Red Ledger playable slice is the first Creator project carried through the
canonical Adventure Studio runtime. It proves that the Creator work is not a
static design mockup: one original production language now compiles into a
multi-room, saveable and replay-compatible game bundle consumed by the packaged
web player.

The slice remains deliberately small. It is a complete vertical proof of the
investigation loop, not the finished commercial game.

## Player route

Run the player and open:

```text
/?demo=red-ledger
```

An explicit `bundle` query remains authoritative, so external runtime bundles
continue to work:

```text
/?bundle=/path/to/runtime.bundle.json
```

The built-in route resolves to:

```text
/demos/the-red-ledger/runtime.bundle.json
```

## Original premise

A municipal debt account claims a date before its paper stock existed. The
player controls an archivist during a rain-dark night shift and must connect
three physical facts:

1. the impossible account date;
2. a harbour construction record hidden in a misfiled drawer;
3. a surviving copy of the river chapel registry.

Presenting the complete contradiction to the night clerk opens the service
alley and reveals the ledger that hid a route through the flooded wards.

The archivist, clerk, harbour city, archive, chapel, account, registry, service
alley and evidence chain are original EVAVO material. The slice studies general
1990s gothic-investigation production grammar without reproducing a commercial
character, room, dialogue tree, mystery or artwork.

## Playable evidence flow

### Municipal Archive

- Inspect the account to establish the impossible date.
- Open the misfiled drawer and recover the harbour record.
- Question the clerk before or after researching the evidence.
- Use the river door to reach the chapel.
- The service-alley door remains visibly locked until the contradiction is
  proved.

### River Chapel Registry

- The persistent player actor arrives at the authored entrance.
- Walking uses the chapel navigation mesh rather than the actor's original
  archive composition.
- Inspecting the registry awards a physical chapel copy.
- The return door restores the archivist to the correct archive entrance.

### Clerk confrontation

The conversation exposes evidence-led topics rather than a checklist. Paper and
chapel topics appear only after the corresponding physical discoveries. The
contradiction topic requires all three facts and cannot permanently close the
case. Entering the confrontation node changes the service-door state, awards
score and preserves the result in saves.

### Service Alley

The open service door leads to a third scene. Inspecting the contradiction
ledger completes the vertical slice and brings the score to 100.

## Runtime contract exercised

The slice covers:

- canonical `AdventureProject` parsing;
- compiled asset metadata and portable paths;
- scene-instance object definitions and state changes;
- one controlled actor persisting through scenes that do not author a duplicate
  actor placement;
- destination entrance positioning and arrival facing;
- scene-local navigation after transition;
- contextual object cursors;
- physical inventory evidence;
- conditional dialogue choices and node enter actions;
- deterministic score awards;
- gothic measured play-feel timing;
- bitmap-font status and dialogue composition;
- save and restore after multi-room progression;
- deterministic runtime-bundle compilation.

## Scene-transition correction

Before this slice, the core story action changed `currentSceneId` and
`currentEntranceId`, but the selected actor instance retained its original
scene. This created three failures after a doorway:

- the actor could disappear because rendering only inspected authored actors in
  the destination composition;
- movement could continue to resolve against the original room;
- saves could contain a story scene and actor scene that disagreed.

The runtime now treats authored actor placement as a persistent instance
template. The controller relocates the controlled actor to the destination
entrance when the story location changes, clears transient movement state, and
passes the reconciled world to camera and rendering. Rendering discovers actor
metadata globally but displays only runtime actors whose `sceneId` matches the
active scene. Movement and portal animation use the actor's runtime scene.

Older saves whose controlled actor scene disagrees with the story scene are
reconciled at load time without changing the save schema.

## Canonical source and generated bundle

The schema-authoritative input is checked in as:

```text
apps/player/public/demos/the-red-ledger/source-manifests.json
```

It contains the project, asset build manifest, bitmap-font manifest, UI-skin
manifest and scene-instance manifest.

The player artifact is:

```text
apps/player/public/demos/the-red-ledger/runtime.bundle.json
```

A regression test parses every source manifest through its public schema,
compiles the project with scene instances, attaches the gothic measured profile
and requires exact structural equality with the checked-in bundle. A second
compilation must produce the same canonical JSON and fingerprint.

## Native UI geometry

The interface is intentionally contextual rather than a permanent verb bar.
The 320 by 200 frame reserves:

- 24 pixels for status text;
- 86 pixels on the same baseline for three inventory slots;
- an 84-pixel evidence-topic panel above the status strip during dialogue.

Five dialogue rows, their gaps and font line height are capacity checked. The
panel ends exactly before the status strip, preventing the final choice from
spilling into another interactive region.

## Controls

- Click a walkable point to move.
- Click an object to use its contextual action.
- Click visible dialogue topics to investigate.
- `Ctrl/Cmd + Shift + S` saves the quick slot.
- `Ctrl/Cmd + Shift + L` restores the quick slot.
- `Ctrl/Cmd + Shift + R` starts or ends replay recording.
- `Ctrl/Cmd + Shift + E` exports the latest completed replay.

## Completion boundary

This slice proves the runtime path and investigation grammar. It does not yet
include the final painted room set, portrait close-ups, complete actor animation,
voice, music, ambience, chapter structure or the full Red Ledger mystery. Those
remain production work rather than hidden claims of completion.

## Native indexed art upgrade

The playable bundle now uses indexed PNG artwork for every runtime image. The
three rooms, actor sheets, object states, inventory icons and bitmap font are all
authored on their final pixel grid. No runtime asset depends on browser SVG text,
vector rasterisation, high-resolution downsampling or soft alpha.

The room set applies the production language consistently:

- the archive uses rain-window depth, a readable desk-light focal pool, reserved
  evidence red and strong door silhouettes;
- the chapel uses cold stone value groups, warm registry light, restrained
  stained-glass colour and a clear central evidence stage;
- the alley uses wet brick, sparse rain, puddle reflections, foreground fire
  escape geometry and one consequential crimson cache;
- the archivist and clerk use binary transparency, planted feet, readable coat
  masses and limited colour ramps at 32 × 64 native sprite scale;
- the UI font is a binary-alpha bitmap atlas rather than a browser font rendered
  through SVG.

These assets are original construction artwork intended to prove palette,
composition, interaction and runtime presentation. They are substantially closer
to the target game language, but final commercial production would still add
more directional actor frames, facial portrait art, environmental loops, sound,
music and chapter-scale room variation.
