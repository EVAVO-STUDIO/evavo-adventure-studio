# Night Shift production pipeline

`Night Shift` is the canonical original proof for the `early-procedural-icon-vga` production profile and the Police Quest I VGA remake / SCI1 reference lane.

It is intentionally governed as a real production rather than a screenshot mock. The proof is not registered as a built-in player demo until authored contracts, media intake, compiled/indexed output, Period VGA review and retained playtest evidence are all complete.

## Current authored proof

The canonical source contains three native 320×200 rooms:

1. municipal briefing room;
2. wet roadside stop;
3. late diner.

The successful procedural route scores exactly 32 points:

```text
briefing          +4
radio             +4
keys              +4
ready exit        +2
vehicle observe   +3
calm contact      +3
safe stop         +4
diner witness     +3
receipt           +2
proof completion  +3
                 ---
                  32
```

The unsafe roadside branch activates a failure lifecycle outcome. Packaged play keeps an in-memory pre-action retry checkpoint for projects that allow Quick Retry, so retry does not overwrite the user's Quick Save.

## Production source archive

Scene Director can export `night-shift.runtime-source.zip` containing:

```text
project.json
scene-instances.json
scene-staging.json
palette-maps.json
bitmap-fonts.json
ui-skins.json
audio-mix.json
front-end.json
lifecycle.json
production-manifest.json
```

This archive contains authored source contracts only. It deliberately does **not** manufacture missing PNG, Aseprite, WAV, palette or `.idx` binaries.

## Production manifest

`night-shift.production-manifest.json` is the machine-readable media brief.

For every runtime asset it records:

- exact project asset ID and source path;
- production role;
- native size when the geometry is canonical;
- whether dimensions are exact, art-directed or duration-dependent;
- whether a runtime `.idx` map is required;
- alpha policy;
- palette role;
- required evidence classes;
- asset-specific art/audio rules.

The production plan and runtime project must have one-to-one asset coverage. Adding a runtime asset without adding a production requirement makes the authored readiness gate fail.

## Build waves

Media work is ordered into four dependency-aware waves.

### 1. Foundation — native player language

Complete first:

- 128-entry actor-lighting palette;
- 5×7 bitmap system font;
- WALK / LOOK / USE / TALK 16×16 icons;
- production officer spritesheet.

The officer sheet is a 264×50 single-page indexed master containing idle, eight walk frames, reach, inspect and notebook poses. The walk uses two explicit foot-contact events and stable foot/shadow/hand anchors.

Do not start judging room-specific art before this shared visual language is coherent.

### 2. Station — first playable vertical slice

Complete the station background, desk sergeant, briefing sheet, radio, keys, door, foreground desk/door-frame planes, station footsteps/Foley and room tone.

Foundation + Station are sufficient for an internal station vertical-slice package. This slice must prove:

- early-SCI1 top icon bar and visible score;
- eight-frame officer movement;
- briefing → radio → keys → exit procedure;
- footprint-aware navigation and preferred lanes;
- desk/door-frame foreground priority;
- hard indexed fluorescent actor lighting;
- surface footfalls and interaction Foley;
- native save/replay behavior.

The station slice has its own readiness gate. It does **not** make the full three-room proof shippable.

### 3. Roadside — procedural failure/retry proof

Complete the roadside background, driver, sedan, sedan foreground plane, wet-asphalt footsteps, notebook cue and rain/traffic ambience.

This wave proves:

- dark wet-night value separation without bloom/HDR/neon exaggeration;
- authored vehicle approach and baseline occlusion;
- eight-pixel Bayer-4 transition into the headlamp palette bank;
- observe → talk → resolve order;
- terminal unsafe-action failure;
- private pre-action Quick Retry.

### 4. Diner — complete proof and retained evidence

Complete diner background, server, receipt, counter foreground plane, diner footsteps, paper touch and room ambience.

This wave proves:

- distinct warm diner palette treatment;
- in-scene witness performance rather than portrait/caseboard UI;
- witness-gated receipt corroboration;
- exact 32-point completion;
- success lifecycle surface.

Only after all four waves should the full demo evidence pass be captured.

## Art master intake

Before compilation, every Period VGA visual master is inspected through the Night Shift art intake contract.

It rejects:

- wrong exact dimensions;
- oversized foreground/overlay plates;
- true-colour final masters;
- more than 256 colours;
- soft alpha;
- missing required opaque/binary alpha behavior;
- PNG/Aseprite source-format mismatches;
- assets not belonging to the production plan.

A clean subset is not enough. The intake report remains blocked until every required visual master has been observed.

### Indexed-colour master versus runtime `.idx`

These are related but not identical requirements.

All final Period VGA visual masters are expected to be authored/reviewed as indexed-colour native artwork.

Only assets marked `indexed: true` in the production plan additionally require one-byte-per-pixel runtime `.idx` data for palette substitution in packaged play.

Foreground occlusion plates currently stay on the normal sprite path, so they require indexed-colour/binary-alpha Period VGA masters but do not require runtime `.idx` sidecars.

## Audio master intake

Night Shift audio source masters are WAV.

The intake contract checks:

- approved PCM sample rates (22.05/32/44.1/48 kHz);
- 16- or 24-bit source depth;
- mono short effects;
- effect duration under four seconds;
- ambience duration long enough for the authored loop window;
- valid source peak range;
- complete coverage of every required effect/ambience asset.

The runtime audio mix has distinct station, roadside and diner ambient beds plus surface footsteps and interaction Foley. Speech ducks ambience modestly rather than flattening the entire effects bed.

## Compile and indexed runtime stage

Once source masters pass intake:

1. compile normal runtime assets and retain `assets.manifest.json`;
2. compile the RGBA palette binary;
3. compile one-byte-per-pixel index maps for every production asset marked `indexed: true`;
4. retain `maximumSourceIndex` metadata;
5. validate default and light-map palette windows against real palette sizes;
6. package indexed metadata and `.idx` files through the normal CLI release integrity path.

The packaged browser player verifies `.idx` and palette byte lengths/SHA-256 before registering them.

## Period VGA gate

A technically indexed file is not automatically period-authentic.

Every required final visual master must pass the Period VGA production audit, including:

- raw 1× review;
- nearest integer-scale review;
- indexed output and colour budget;
- opaque or binary alpha as appropriate;
- cluster discipline;
- outline discipline;
- purposeful dithering;
- absence of bloom, blur, chromatic aberration and other modern effects;
- absence of synthetic/AI-like microtexture.

The guiding question remains:

> Could this exact native frame plausibly have shipped as professionally authored VGA adventure artwork between roughly 1990 and 1994?

## Shippable evidence

The full Night Shift built-in demo remains blocked until all of the following are green:

- art-master intake;
- audio-master intake;
- every production runtime asset in the compiled asset manifest;
- every required `.idx` map;
- complete Period VGA review coverage;
- packaged Runtime Bundle parses successfully;
- at least one deterministic success replay and one failure/retry replay;
- at least six retained raw 1× screenshots covering the three rooms and lifecycle/system states.

Do not register `?demo=night-shift` before these gates pass.

## Relationship to the historical reference

The Police Quest I VGA remake is a measurement and production-study reference, not copied content.

Night Shift uses original locations, characters, dialogue and puzzles while studying the earlier SCI1-era production grammar:

- grounded contemporary environments;
- proportionate small in-scene actors;
- compact icon interaction;
- visible score/procedural feedback;
- practical failure/recovery;
- painted 320×200 perspective;
- palette-index lighting and restrained animation.

Do not import Police Quest characters, maps, dialogue, logos or copyrighted room artwork into the proof.
