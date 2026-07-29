# Authentic Pixel Rendering Specification

## Purpose

The 1990s appearance is a production contract, not a post-processing filter. EVAVO Adventure Studio must preserve the native pixel grid, authored palettes, sprite pivots, frame holds, camera movement, scene layering, cursor language and transition timing from source assets through final presentation.

This document is normative for the renderer, asset pipeline, editor preview and visual tests.

## 1. Native presentation surface

Every project declares one logical canvas, commonly:

- 320 x 200;
- 320 x 240;
- 640 x 400;
- 640 x 480;
- a deliberate custom low-resolution canvas.

The renderer composes the world, speech, cursors and game interface into a native-resolution render texture with:

- device resolution fixed to `1` for the native surface;
- antialiasing disabled;
- nearest-neighbour sampling for pixel assets;
- no automatic high-DPI multiplication;
- no dependency on host-window dimensions.

The completed native surface is then scaled to the host canvas. Integer scale is preferred. Spare space is letterboxed or pillarboxed according to the project presentation profile. The logical canvas is never stretched independently on each axis.

## 2. Pixel coordinate policy

A project selects a pixel-motion policy:

### Strict

- actor foot points, sprite pivots, camera position, UI elements and cursor positions resolve to integer native pixels;
- useful for visibly chunky 320-pixel-wide games;
- movement may use fixed-point internal coordinates but presentation is snapped once at the final transform boundary.

### Camera strict

- actors may interpolate at subpixel precision internally;
- the camera and final displayed transforms are quantised to native pixels;
- useful when smooth path motion must coexist with a stable background grid.

### Free

- subpixel presentation is permitted for deliberately higher-resolution profiles;
- nearest sampling and native composition still apply when the project uses pixel assets.

Pixel snapping occurs in one renderer service. Individual game systems must not perform competing rounds that create jitter.

## 3. Texture rules

Pixel textures use:

- nearest-neighbour scale mode;
- no mipmaps unless a non-pixel asset explicitly opts in;
- integer source rectangles;
- deterministic atlas padding and edge extrusion;
- transparent colour cleanup before packing;
- stable atlas ordering derived from asset IDs rather than filesystem traversal order.

Trimmed frames are allowed, but runtime positioning never guesses an anchor from trimmed bounds. Every frame retains its original source size, trim rectangle and authored pivot.

Backgrounds too large for the GPU texture limit are split by the asset compiler into stable tiles and exposed to the renderer as one logical plane.

## 4. Sprite contract

A sprite frame records at minimum:

- stable frame ID;
- source asset and source rectangle;
- original untrimmed dimensions;
- trim offset;
- pivot;
- foot or depth point;
- optional interaction and collision shapes;
- shadow anchor;
- frame duration in logical ticks;
- animation event markers;
- optional mouth, hand or prop attachment points;
- mirror eligibility;
- palette policy.

A character animation clip records:

- semantic state such as idle, walk, talk, use, take, turn or custom performance;
- facing direction;
- ordered frame IDs;
- per-frame duration rather than a single assumed frame rate;
- looping and exit policy;
- root-motion policy;
- interruptibility;
- footstep, sound and action markers;
- safe transition frames.

Held poses and uneven timing are first-class. The runtime does not force all animation into smooth modern interpolation.

## 5. Deterministic time

Story simulation advances on a fixed logical tick, initially 60 ticks per second. Render refresh and simulation time are separate.

Animation frames store durations in ticks. This supports:

- deliberate held frames;
- low-cadence walk cycles;
- snappier cursor loops;
- irregular acting beats;
- deterministic playback in saves, replays and tests.

The renderer may interpolate camera or non-pixel effects only when allowed by the presentation profile. Puzzle outcomes, sequence completion, audio cues and frame events are driven by logical time, never monitor refresh rate.

When a stalled browser frame produces accumulated time, the scheduler executes a bounded number of catch-up steps and reports dropped presentation time rather than allowing an unbounded spiral.

## 6. Palette pipeline

Two complementary colour paths are supported.

### RGBA pixel path

This is the normal path for hand-painted VGA-like art, modern exports and projects that need more than one active palette. Pixel integrity, sampling, dithering and colour-count policy are still validated.

### Indexed palette path

True palette animation uses:

- an index texture whose pixels store palette entries;
- a palette lookup texture;
- a renderer shader that resolves index to displayed colour;
- named cycle ranges and deterministic cycle timing;
- protected interface and transparency indices;
- optional actor or layer-specific palettes.

An ordinary decoded RGBA image cannot preserve the distinction between two equal-looking colours that occupy different palette indices. Indexed source metadata therefore remains available to the asset compiler rather than being inferred from the final PNG.

The asset pipeline may use Sharp for deterministic quantisation, colour limits, indexed PNG output and controlled dithering. Hand-authored palette ramps and dither patterns remain preferable for hero art.

## 7. Dithering

Dither patterns are anchored to the native scene or asset pixel grid. They do not move with the display window or a post-scale shader.

Supported policies include:

- authored dithering only;
- ordered matrix dithering for deterministic fades or gradients;
- controlled error diffusion during asset conversion;
- no dithering.

The editor preview must show the exact compiled result. A high-resolution preview that hides palette or dither defects is not authoritative.

## 8. Scene render graph

A room is not one background plus actors. The resolved frame can contain:

1. sky and distant parallax planes;
2. base background tiles;
3. rear ambient animation;
4. world props and actors;
5. authored occlusion planes;
6. front ambient animation;
7. weather and light layers;
8. speech and scene overlays;
9. game interface;
10. software cursor;
11. optional final display treatment.

Logical parentage and draw order are separate. A held item can follow an actor transform while rendering on a different scene layer. Interface elements remain in a separate render group so world-camera transforms cannot affect them.

Static sections may be cached as render textures only after correctness is established. Caching is a renderer optimisation and never changes scene semantics.

## 9. Depth and scaling

An actor has an authored foot point. Scene depth is solved from:

- navigation surface or current elevation;
- foot-point position;
- scale field or scale band;
- explicit scene layer;
- local z offset;
- stable entity-ID tie-breaker.

Stable tie-breaking prevents actors at the same baseline from flickering between orders.

Scale can be authored as:

- linear near and far bands;
- piecewise bands;
- a sampled scale field;
- a fixed scale region;
- a scripted override.

Navigation, scale, visual ordering and occlusion remain separate data sets. A staircase may change elevation and scale without becoming a foreground mask. A balcony can render above the floor while using its own navigation surface.

## 10. Occlusion modes

The engine supports three compatible modes.

### Baseline plane

A foreground sprite or plane renders in front of an actor when the actor foot depth is behind its authored baseline. This reproduces conventional walk-behind behaviour efficiently.

### Authored mask

A foreground plane includes an alpha or binary mask for irregular shapes such as railings, foliage, arches and furniture. Only covered pixels occlude the actor.

### Depth-threshold field

A low-resolution depth texture stores the scene depth at which each pixel becomes foreground. During composition, the actor depth is compared with the field. This supports irregular partial occlusion while preserving a painterly scene.

Occlusion data is compiled and inspectable. It is not inferred every frame from background colours.

## 11. Navigation and staging

The scene editor authors polygonal navigation surfaces, links and portals. Portals can define:

- destination surface;
- entry and exit points;
- elevation interpolation;
- scale transition;
- facing constraints;
- traversal animation;
- scripted conditions.

Pathfinding operates on navigation geometry, while final presentation can follow authored curves or staging waypoints. Character feet remain on the solved floor even when a sprite extends above an occluder.

Walk targets for interactions are explicit and validated. The engine can find a nearby reachable fallback but does not silently replace carefully authored staging.

## 12. Camera and parallax

Camera coordinates live in native pixels. Profiles can define:

- fixed rooms;
- horizontal or vertical scrolling;
- oversized cinematic rooms;
- dead zones;
- look-ahead;
- framing zones;
- authored timeline shots;
- bounded shake and impact offsets.

Parallax factors are stored as deterministic rational or fixed-point values so long camera moves do not accumulate visible drift. Strict pixel profiles quantise each displayed layer after applying its parallax transform.

Camera motion is tested for one-pixel judder, oscillating rounding and seams at tiled-background boundaries.

## 13. Software cursor and input mapping

The operating-system pointer is hidden over the game canvas. The game renders its own cursor at native resolution.

Pointer input is converted through the presentation transform into native coordinates before hit testing. The mapping accounts for integer scale, letterboxing, aspect policy and host zoom.

Cursor definitions support:

- animation with per-frame tick durations;
- active hotspot and click points;
- semantic states such as walk, look, talk, use, take, enter, inventory item, invalid and busy;
- project-specific verbs;
- selected-inventory overlays;
- hover and pressed variants.

The cursor can change immediately on hotspot entry without changing the resolved interaction command.

## 14. Text and interface

Authentic game text uses bitmap fonts or pre-rasterised glyph atlases on the native surface.

Text layout records:

- exact glyph metrics;
- line height and baseline;
- wrapping width in native pixels;
- palette-safe speaker colours;
- optional outline or shadow recipe;
- subtitle duration and interruption policy.

Interface panels use authored pixel assets, tile borders or native-resolution nine-slice rules. CSS text is suitable for editor chrome, not the canonical in-game presentation.

## 15. Lighting, weather and transitions

Era-appropriate effects are rendered on the native surface:

- palette fades and cycles;
- ordered-dither fades;
- wipes and irises;
- deterministic dissolves;
- low-resolution light and shadow masks;
- rain, snow, smoke, dust and water animation;
- layer tinting and local palette swaps.

A CRT, scanline or phosphor treatment is optional and occurs after integer upscaling. It may enhance a selected display profile but must never be used to disguise blurred source art or broken pixel alignment.

## 16. Asset manifest

Each compiled asset records:

- stable ID and source path;
- source content hash;
- output content hash;
- dimensions and frame geometry;
- alpha bounds;
- colour count and palette metadata;
- conversion, trim and dither settings;
- pivot and attachment metadata;
- atlas location;
- provenance and licence notes;
- compiler version.

Builds are content-addressed. Unchanged source and settings produce byte-stable compiled assets where the underlying format permits it.

## 17. Visual quality gates

The rendering lab must contain golden fixtures for:

- nearest-neighbour scaling at several host sizes;
- letterboxing and input-coordinate mapping;
- trimmed sprites with non-central pivots;
- stable depth sorting;
- baseline, mask and depth-field occlusion;
- stairs and multiple elevation surfaces;
- camera scrolling and parallax seams;
- palette cycling;
- dithered fades;
- bitmap text wrapping;
- animated cursors;
- atlas edge bleeding;
- cutscene frame and event timing.

Tests include:

- pure unit tests for transforms, sorting and tick schedules;
- renderer readback checks for exact pixels;
- deterministic replay hashes;
- Playwright screenshots captured in a controlled environment;
- explicit tolerance only for effects that are intentionally non-exact.

A render change cannot be accepted solely because it looks acceptable on one monitor. It must preserve the native contract and pass the relevant fixtures.

## 18. Authenticity profiles

The studio ships generic starting profiles rather than copies of named commercial games. Initial families should include:

- 16-colour parser adventure;
- early 256-colour verb-panel adventure;
- icon-bar illustrated adventure;
- cinematic 640 x 480 mystery adventure;
- two-button comic adventure;
- high-contrast neo-noir pixel adventure.

Profiles provide defaults, not restrictions. A project can combine interaction grammar, resolution, palette, dialogue layout, death policy, score display and cinematic language to create its own identity.
