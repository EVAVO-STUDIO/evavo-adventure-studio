# Indexed palette rendering

Adventure Studio's canonical render contract includes `indexed-sprite` nodes because palette-index artwork is materially different from an RGBA sprite with a tint.

The indexed path is intended for period-authentic VGA workflows where one byte identifies a palette entry and the same index map may be displayed through different authored palette tables.

## Canonical render node

An indexed sprite carries:

- `indexAssetId` — the one-byte-per-pixel index map;
- `paletteAssetId` — the authored RGBA palette table;
- `paletteOffset` — a deterministic offset applied before lookup;
- source rectangle, trim/original size and normal scene transform/order data;
- optional `paletteDither` — a target palette, target offset, Bayer matrix, native origin and 0–1 coverage for ordered palette transitions.

The canonical frame remains indexed. Palette selection is not converted into story flags, RGB tint or a post-processing effect.

## Compiled indexed assets

Public APIs:

```ts
@evavo/adventure-asset-pipeline/index-map-compiler
@evavo/adventure-asset-pipeline/palette-compiler
@evavo/adventure-asset-contract/indexed-assets
```

The build path now has a versioned indexed-asset sidecar rather than pretending an ordinary colour PNG is an index map.

An indexed record retains:

- native width and height;
- exact one-byte-per-pixel `.idx` runtime payload;
- SHA-256 and exact byte length;
- optional transparent index;
- default palette asset + offset;
- optional sprite-frame source rectangles, original size and trim offsets.

`compileIndexMap` accepts exact authored index bytes and never resamples them. `compileRgbaPalette` emits 1–256 complete RGBA entries and a normal runtime `palette` asset with a real primary binary output.

The CLI accepts:

```text
--indexed-assets <indexed-assets.json>
--palette-maps <palette-maps.json>
```

for `validate`, `compile` and `package`.

Before packaging it verifies the `.idx` file byte length and SHA-256 from disk. The indexed sidecar metadata is embedded in `game.bundle.json`; the `.idx` bytes are emitted as `index-map` release artifacts and are included in `release.manifest.json` and the release fingerprint.

## Palette maps

Scene staging LIGHT zones reference a readable `paletteMapId` rather than hard-coding a palette asset in every polygon.

A project-scoped palette-map manifest resolves:

```text
palette map id
→ palette asset id
→ palette offset
```

Runtime Bundle parsing fails closed when a staged light zone references a missing map, a map references a non-palette asset, or its offset cannot fit inside the compiled palette.

## Hard palette lighting

For a `hard` LIGHT zone the actor/object foot baseline selects the highest-priority enabled zone. Indexed world nodes inside the zone are rebound directly to the target palette asset + offset.

No tint is applied. The source index bytes and animation geometry are unchanged.

## Ordered-dither palette lighting

For an `ordered-dither` LIGHT zone Adventure Studio does not interpolate RGB colours.

The default transition band is 8 native pixels inside the authored polygon boundary:

```text
outside zone   0% target
boundary       0% target
4 px inside   50% target
8 px inside  100% target
```

Intermediate states attach an indexed palette-dither treatment to the render node. The Pixi indexed texture resolver chooses **either the original palette entry or the target palette entry for each pixel** using a fixed Bayer matrix.

Supported matrices:

- Bayer 2×2 — 4 visual coverage states;
- Bayer 4×4 — 16 visual coverage states; this is the default scene-light transition;
- Bayer 8×8 — 64 visual coverage states.

Coverage is quantized to the matrix's actual number of visible states. This prevents hundreds of duplicate cached textures while the player moves through a transition band.

The Bayer phase is anchored to native sprite/world coordinates. It therefore remains deterministic across animation frames and replay rather than crawling according to browser frame timing.

When the foot point is deep enough inside the zone to reach 100% coverage, the dither payload disappears and the node becomes an ordinary indexed sprite using the target palette.

## Pixi adapter

Public APIs:

```ts
@evavo/adventure-renderer-pixi/indexed-renderer
@evavo/adventure-renderer-pixi/indexed-texture-cache
@evavo/adventure-renderer-pixi/indexed-buffer-texture
```

`PixiIndexedWebGLRenderer` is a drop-in subclass of the ordinary `PixiWebGLRenderer`.

Its resolver supports:

```ts
getIndexedTexture(indexAssetId, paletteAssetId, paletteOffset)
getIndexedDitherTexture(indexAssetId, paletteAssetId, paletteOffset, transition)
```

At the renderer boundary it:

1. keeps the canonical frame indexed;
2. derives stable synthetic texture identity from the complete palette state;
3. resolves the exact palette or Bayer-paired texture;
4. converts only the renderer-facing node into the existing sprite path;
5. forces nearest-neighbour sampling;
6. preserves transform, trim, source rectangle, opacity, masking and render order.

The indexed texture cache stores index maps once and palettes independently. The same actor index map can therefore be reused through neutral, fluorescent, rain-shadow and warm-lamp palettes without duplicating sprite pixels.

## Packaged browser player

Packaged indexed bundles are selected automatically.

The ordinary `PixiAssetTextureStore` first loads standard images/spritesheets and retains the bundle URL. When indexed metadata is present, the packaged renderer creates an indexed texture cache and, during renderer initialization:

1. fetches every declared `.idx` file relative to the bundle URL;
2. verifies exact byte length and SHA-256;
3. fetches every required compiled palette binary;
4. verifies its length and SHA-256;
5. registers index maps and palettes independently;
6. renders through `PixiIndexedWebGLRenderer`.

Legacy bundles with no indexed sidecar still use the normal Pixi renderer unchanged.

RGBA expansion is uploaded through PixiJS `BufferImageSource` with nearest sampling and mipmaps disabled. This avoids a browser image-decoding or canvas conversion step for generated indexed textures.

## Deterministic CPU reference expansion

Public APIs:

```ts
@evavo/adventure-renderer-pixi/indexed-pixels
@evavo/adventure-renderer-pixi/indexed-dither
```

`expandIndexedPixels` is the reference single-palette implementation.

`expandDitheredIndexedPixels` is the reference two-palette ordered-dither implementation.

Both are renderer-independent and suitable for:

- Pixi texture generation;
- software screenshots;
- visual evidence generation;
- deterministic tests;
- future alternative renderer implementations.

The source index bytes are never mutated.

## Why this is not RGB tint

Tinting an RGBA sprite multiplies already-selected colours. It cannot reproduce arbitrary indexed palette substitution and it encourages modern smooth-light assumptions.

Indexed remapping allows authored transformations such as:

```text
normal officer ramp
→ fluorescent interior ramp
→ ordered threshold pattern
→ cool rain/shadow ramp
→ warm lamp ramp
```

while preserving the same source pixel clusters and binary edge geometry.

## Remaining work

The core packaged indexed path now exists. Remaining improvements are narrower:

- expose palette assets/maps and transition bands directly in Scene Director LIGHT authoring;
- add automated source-art tooling that derives `.idx` + palette data from an approved indexed master without changing native pixels;
- retain indexed/palette render evidence alongside normal Period VGA screenshots;
- consider GPU palette lookup later for efficiency, while requiring pixel-for-pixel equivalence with the deterministic CPU reference path.

Do not replace these with bloom, RGB interpolation, soft-alpha light masks, normal maps or modern HDR effects.

## Evidence

Indexed rendering still passes through the normal compiled art and Period VGA audits. A palette-resolved frame does not become period-authentic merely because it is indexed.

Review raw 1× output, integer presentation, cluster discipline, palette-role changes, dither/material behaviour and modern-effect contamination separately.
