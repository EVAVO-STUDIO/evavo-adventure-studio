# Classic VGA scene staging and Scene Director

## Purpose

Adventure Studio treats a classic adventure room as one authored 2.5D stage rather than a background image with navigation added as an afterthought.

The final native frame, invisible control geometry, actor grounding, perspective, foreground priority, approach positions, interaction choreography, surface audio, palette treatment and entrances must agree.

The canonical review question remains:

> Could this exact room, at its native resolution and with its actual movement and interaction behaviour, plausibly have shipped as a professionally authored VGA adventure scene between roughly 1990 and 1994?

The answer must be based on the **actual native frame and runtime behaviour**, not on a modern mock-up, a retro post-process filter or a design document that the shipped player does not follow.

---

## Scene Director

The Studio exposes one native coordinate space through these views:

- **ART** — final room composition, actors, props and interface reservation;
- **WALK** — reachable floor, portals, preferred lanes and body clearance;
- **CONTROL** — traversal gates and state-driven room geometry;
- **DEPTH** — authored perspective curves and area overrides;
- **OCCLUSION** — baseline-sorted foreground planes;
- **HOTSPOTS** — exact interaction geometry and invisible click comfort;
- **APPROACH** — verb/item-specific standing positions and arrival facing;
- **ACTORS** — actor feet, footprint, mobility and facing;
- **SURFACE** — material zones, movement treatment and footsteps;
- **LIGHT** — indexed palette maps and Bayer transition regions;
- **ENTRY** — spawn, entry path, arrival pose and control handoff;
- **DEBUG** — stable IDs and all staging contracts together.

These are not decorative overlays. They read the same canonical project, scene-instance and staging contracts used by runtime/validation.

The current Studio ships two deliberately different production proofs through the same Director:

- **The Red Ledger** — Gothic Investigation VGA;
- **Night Shift** — Early Procedural Icon VGA.

This is intentional evidence that one deterministic engine can support materially different 1990s production languages without collapsing them into a generic pixel-art preset.

---

## Actor footprints and clearance

Classic movement is still foot-point based, but a visible character is not dimensionless.

`ActorFootprint` adds:

- width around the authored foot anchor;
- floor depth;
- additional clearance;
- collision class.

The runtime keeps classic foot-point routing and evaluates candidate routes against the footprint envelope at deterministic samples. When the mathematical shortest route would scrape scenery, staged routing can consider deterministic alternate/lane-directed routes.

This remains authored adventure staging, not rigid-body physics.

---

## Preferred walk lanes

`PreferredWalkLane` provides a soft routing bias so a character can:

- follow a carpet runner;
- stay on a pavement;
- approach a desk from a readable side;
- avoid visually ugly corner cutting;
- preserve a deliberate foreground composition.

A preferred lane affects route cost; it is not a compulsory spline. With no staging manifest, routing retains legacy behaviour.

---

## Stateful navigation

Object state can disable or restore authored navigation areas and portals.

Examples:

- closed door disables doorway portal;
- open door restores doorway portal;
- raised bridge disables a crossing;
- moved chair opens a lane;
- crowd blocks an aisle;
- lowered ladder enables vertical traversal.

Visual object state and traversal state therefore share one source of truth.

---

## Perspective and scale

A painted adventure room often cannot be described by one global near/far interpolation.

`DepthScaleCurve` supports ordered scale keys, for example:

```text
Y  76 -> 0.52
Y  94 -> 0.58
Y 116 -> 0.69
Y 140 -> 0.83
Y 166 -> 1.00
Y 190 -> 1.14
```

Navigation areas can select curves or force fixed scale.

Staged perspective is part of the packaged frame path. Actor/object appearance and transformed interaction geometry use the same staged scale source.

A technically smooth curve is still wrong if the character looks pasted onto the painting. Review at raw 1×.

---

## Approach slots

An interactive prop can expose several deliberate standing positions instead of one universal `walkTo` point.

An `ApproachSlot` can specify:

- foot position;
- arrival facing;
- valid verbs;
- valid items;
- preferred status;
- optional animation state;
- optional condition.

Selection is deterministic: eligible preferred slots first, then reachable distance, then stable ID.

The older object `walkTo` remains the compatibility fallback.

---

## Native click comfort

Tiny period-authentic props should not become frustrating simply because the final artwork is 320×200.

`InteractionComfortRegion` supplies an optional invisible scene-space polygon.

Hit arbitration remains strict:

1. exact visible interaction geometry is tested first;
2. a real visible hit always wins;
3. comfort regions are considered only after an exact miss;
4. comfort overlap resolves through authored priority, front-to-back order and stable ID.

This improves usability without glow outlines, hotspot sparkles or modern object highlighting.

---

## Interaction choreography

Interactions can now remain pending while deterministic authored staging executes.

Typical sequence:

```text
walk
-> settle
-> turn
-> reach pose
-> object state change
-> sound cue
-> hold
-> reaction
-> recovery idle
-> underlying interaction resolves
```

The runtime currently supports:

- actor-animation beats;
- optional animation-completion waits;
- logical-tick holds;
- object-state changes;
- sequence requests;
- sound-cue requests;
- recovery animation;
- approach-slot-specific choreography.

Active choreography is serialized in save state, including beat index, remaining hold and animation-wait state.

---

## Surface zones and footsteps

`SurfaceZone` can describe:

- timber;
- carpet;
- stone;
- dirt;
- grass;
- water;
- metal;
- stairs;
- project-specific materials.

Surface movement is resolved per logical tick without modifying the actor's stored base speed.

Deterministic left/right footfall events are annotated with the exact authored surface/custom material and optional cue ID at the foot position.

The packaged controller/audio path consumes those transient cue IDs without encoding footsteps into story state or replaying stale footsteps after a save restore.

Frame rate never decides when a footstep happens.

---

## Foreground priority and occlusion

Adventure Studio implements classic baseline-sorted foreground overlays and staged multi-plane occlusion.

An authored foreground image participates in world ordering through its baseline, elevation and Z offset:

```text
actor feet Y 50
-> foreground baseline Y 60
-> actor appears behind foreground

actor feet Y 80
-> same foreground baseline Y 60
-> actor appears in front
```

Multiple staged foreground planes can coexist and can be conditionally enabled. This supports desk edges, door frames, rails, pillars, plants, foreground architecture and vehicle foregrounds without adding a 3D renderer.

The next occlusion improvement is richer **multi-mask priority within one foreground asset**, where separate portions of one visual need distinct baselines/priority regions.

---

## Indexed palette-light zones

Classic VGA lighting is now an actual indexed rendering path rather than a future intent.

A staged `PaletteLightZone` selects a project-scoped palette map:

```text
palette map id
-> palette asset
-> palette offset
```

Supported runtime treatment:

### Hard palette boundary

Inside a hard zone, an indexed world sprite switches directly to the target authored palette bank.

### Ordered Bayer transition

An `ordered-dither` zone uses an 8-native-pixel transition band measured inward from the authored polygon boundary.

```text
boundary       0% target
4 px inside   50% target
8 px inside  100% target
```

Intermediate frames contain no interpolated RGB colours. Each source pixel selects either its base-palette colour or its target-palette colour through a fixed Bayer matrix.

The default LIGHT transition uses Bayer 4×4, producing 16 meaningful visual coverage states. Cache identity is quantized to those states and the Bayer phase is normalized by matrix size.

Scene Director displays the ordered-dither band explicitly rather than representing it as a glow.

The Studio proof palettes also define deliberate 16-colour banks for:

- Red Ledger neutral actor;
- Red Ledger warm desk-lamp treatment;
- Red Ledger cool rain shadow;
- Night Shift neutral officer;
- Night Shift municipal fluorescent treatment;
- Night Shift roadside headlamp treatment.

These examples are intentionally separate rather than one universal "retro palette".

---

## Indexed asset integrity

Indexed runtime assets use one exact byte per native source pixel.

The indexed sidecar retains:

- width/height;
- `.idx` runtime path;
- exact byte length;
- SHA-256;
- optional `maximumSourceIndex`;
- optional transparent source index;
- default palette + offset;
- optional frame geometry.

New index maps compiled through the asset pipeline derive `maximumSourceIndex` automatically.

That high-water mark allows build/runtime code to prove:

```text
maximum source index + palette offset < target palette entry count
```

The browser also recomputes the observed high-water mark from fetched `.idx` bytes and rejects disagreement with declared metadata.

Indexed image dimensions must match their compiled image. Indexed spritesheets currently support exactly one compiled atlas page and optional indexed frame metadata must agree with compiled frame rectangles/original size/trim.

This prevents a correctly hashed `.idx` file from being spatially incompatible with the sprite/image it replaces.

---

## Packaged indexed rendering

The packaged browser player now selects the indexed-aware renderer automatically when `indexedAssets` are present.

Initialization:

1. normal renderable image/spritesheet assets are loaded;
2. `.idx` files are fetched relative to the runtime bundle;
3. byte length and SHA-256 are verified;
4. maximum source index metadata is checked when present;
5. required palette binaries are fetched;
6. palette byte length and SHA-256 are verified;
7. index maps and palettes are registered independently;
8. `PixiIndexedWebGLRenderer` resolves hard/Bayer palette textures;
9. generated RGBA buffers are uploaded through PixiJS `BufferImageSource` with nearest sampling and mipmaps disabled.

The canonical scene frame converts ordinary runtime sprite nodes to indexed nodes automatically when the corresponding asset has indexed metadata.

Indexed artwork cannot simultaneously use RGBA tint. Palette substitution must be authored through the palette system.

Legacy bundles without indexed metadata stay on the ordinary Pixi renderer path.

---

## Entry choreography

Entry choreography is implemented in packaged playback.

It supports:

- off-screen/native spawn positions;
- authored entry waypoints;
- explicit speed;
- directional entry animation;
- final facing;
- arrival animation;
- control-unlock policy.

Entry progress is serialized. Input remains locked while an active entry beat requires it.

A looping arrival animation cannot accidentally create an infinite input lock, and immediate/zero-path entry handoff retains the authored arrival pose through the controller state merge.

---

## CLI workflow

Classic staging and indexed rendering are supplied through sidecars rather than being hidden in ad-hoc runtime state.

Key options:

```text
--scene-instances
--scene-staging
--indexed-assets
--palette-maps
```

Example:

```powershell
pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --scene-staging .\game\scene-staging.json `
  --indexed-assets .\game\build\indexed-assets.json `
  --palette-maps .\game\palette-maps.json `
  --out .\game\release
```

The CLI verifies `.idx` bytes before packaging and includes them as `index-map` entries in `release.manifest.json`. Indexed bytes therefore affect the release fingerprint instead of becoming untracked extra files.

Palette maps and indexed metadata participate in the canonical runtime-bundle fingerprint.

---

## Implemented runtime/editor slice

The current system now provides:

- deterministic verb/item-specific approach selection;
- state-aware approach reachability;
- actor footprint route clearance;
- preferred-lane route bias;
- state-driven navigation areas/portals;
- staged perspective curves in packaged frames;
- shared visual/hit-test perspective scale;
- exact hotspot precedence + native click comfort;
- deterministic multi-tick interaction choreography;
- choreography save/restore state;
- surface movement treatment;
- surface-aware deterministic footfalls;
- packaged footstep/choreography audio cue handoff;
- staged entry paths and input lock;
- entry save/restore state;
- baseline + staged multi-plane foreground occlusion;
- project palette-map sidecars;
- indexed asset/palette compilers;
- hard indexed palette swaps;
- ordered Bayer palette transitions;
- automatic indexed packaged renderer selection;
- runtime index/palette integrity checks;
- Scene Director ART/WALK/CONTROL/DEPTH/OCCLUSION/HOTSPOTS/APPROACH/ACTORS/SURFACE/LIGHT/ENTRY/DEBUG modes;
- concrete Director palette binding/status display;
- visible Bayer transition-band review;
- original Red Ledger and Night Shift staging proofs.

---

## Remaining high-value work

The next meaningful slices are now narrower:

1. add richer per-region/multi-mask occlusion inside a single foreground asset;
2. make Scene Director modes **editable**, not only inspectable, with undo/redo-safe operations for lanes, slots, curves, planes, zones and entries;
3. add palette/index source-authoring tooling that can generate approved `.idx` + RGBA palette payloads from an indexed master without changing native pixels;
4. retain palette-resolved 1× visual evidence alongside the Period VGA audit;
5. add stronger corridor/footprint diagnostics for narrow doors, portals and stairs;
6. finish original playable proof rooms for storybook, early procedural, Gothic investigation and DGDS cinematic languages;
7. retain deterministic click replays, return-state visits and raw 1× screenshots for those proofs;
8. run the repository's governed full `pnpm check` / TypeScript / Vitest / player build / Studio build workflow against the exact main SHA.

Do not replace these remaining tasks with generic retro filters, bloom, RGB colour interpolation, soft-alpha lighting, oversized pixels or modern concept-art styling.

---

## Showcase stress tests

### Illustrated storybook VGA

A broad painterly room with dramatic foreground framing, strong near/far scaling, tiny readable actors and temporary icon interface.

### Early procedural contemporary VGA

A grounded station/street/roadside sequence with mundane architecture, small practical targets, deliberate approaches, vehicle foregrounds, visible procedure feedback and simple icon interaction.

`Night Shift` is the canonical original proof target.

### Gothic investigation VGA

A dense old-world room with overlapping furniture, dark-but-readable palette banks, evidence props, staged portraits/dialogue and multiple foreground crossings.

`The Red Ledger` is the canonical original proof target.

### DGDS cinematic VGA

Strong movie-like foreground framing, held poses, portrait/inset cuts, sparse but deliberate animation, visible time/state pressure and hard editorial transitions.

`Dead Channel` remains the canonical original proof target.

All proof content must use original characters, rooms, dialogue, art and puzzles. Historical commercial titles remain measurement/production references, not distributable source material.
