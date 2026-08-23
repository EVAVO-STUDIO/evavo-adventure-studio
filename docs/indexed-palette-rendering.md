# Indexed palette rendering

Adventure Studio's canonical render contract includes `indexed-sprite` nodes because palette-index artwork is materially different from an RGBA sprite with a tint.

The indexed path is intended for period-authentic VGA workflows where one byte identifies a palette entry and the same index map may be displayed through different authored palette tables.

## Canonical render node

An indexed sprite carries:

- `indexAssetId` — the one-byte-per-pixel index map;
- `paletteAssetId` — the authored RGBA palette table;
- `paletteOffset` — a deterministic offset applied before lookup;
- source rectangle, trim/original size and normal scene transform/order data.

The canonical frame remains indexed. Palette selection is not converted into story flags, RGB tint or a post-processing effect.

## Pixi adapter

Public API:

```ts
@evavo/adventure-renderer-pixi/indexed-renderer
```

`PixiIndexedWebGLRenderer` wraps the existing renderer and requires a `PixiIndexedTextureResolver`:

```ts
getIndexedTexture(indexAssetId, paletteAssetId, paletteOffset): Texture | null
```

At the Pixi boundary the adapter:

1. preserves the canonical indexed render node;
2. derives a stable synthetic texture identity from index asset + palette asset + palette offset;
3. asks the indexed resolver for the palette-resolved texture;
4. converts only the renderer-facing node into the existing sprite path;
5. forces nearest-neighbour sampling;
6. preserves transform, trim, source rectangle, opacity, masking and render order.

Changing `paletteOffset` changes the texture identity, preventing a cached texture view from silently reusing the wrong palette treatment.

## Deterministic CPU expansion

Public API:

```ts
@evavo/adventure-renderer-pixi/indexed-pixels
```

`expandIndexedPixels` converts:

```text
1 byte per source pixel
+
RGBA palette entries
+
optional transparent index
+
optional palette offset
```

into deterministic RGBA bytes suitable for a texture upload, software screenshot, evidence capture or test fixture.

It fails closed when:

- dimensions are not positive integers;
- index byte count does not equal width × height;
- palette data is not complete RGBA quads;
- a palette exceeds 256 entries;
- transparent index is invalid;
- palette offset is outside 0–255;
- any resolved index exceeds the available palette table.

The source index bytes are never mutated.

## Why this is not RGB tint

Tinting an RGBA sprite multiplies already-selected colours. It cannot reproduce arbitrary indexed palette substitution and it encourages modern smooth-light assumptions.

Indexed remapping instead allows authored transformations such as:

```text
normal officer ramp
→ fluorescent interior ramp
→ cool rain/shadow ramp
→ warm lamp ramp
```

while preserving the same source pixel clusters and binary edge geometry.

This is the intended foundation for Scene Director `LIGHT` zones.

## Remaining asset-pipeline work

The current compiled asset contract produces final PNG images/spritesheet pages and standalone palette assets, but it does not yet define a first-class runtime **index-map asset** whose payload is guaranteed to contain one palette index byte per native pixel.

Do not pretend that gap is solved by loading an ordinary colour PNG and calling it an index map.

The next pipeline version should add an explicit compiled indexed-image record with at least:

- native width and height;
- one-byte-per-pixel runtime index payload;
- palette-entry limit;
- optional transparent index;
- deterministic checksum;
- source art/evidence linkage;
- an explicit palette asset binding or permitted palette family;
- optional frame/atlas metadata for indexed sprite sheets.

A runtime host can then cache palette-resolved Pixi textures by:

```text
index asset id
+ palette asset id
+ palette offset
```

and use `expandIndexedPixels` as the reference CPU implementation.

GPU palette lookup may be added later for efficiency, but its output must match the deterministic reference expansion exactly and must retain nearest-neighbour/native-pixel behaviour.

## Palette-light zones

Scene staging already resolves palette-light zones independently from rendering. The intended flow is:

```text
actor foot point
→ resolve active Scene Director LIGHT zone
→ choose authored palette map / offset
→ emit indexed sprite node with resolved palette treatment
→ indexed Pixi resolver
→ exact nearest-neighbour pixels
```

No HDR light, bloom, normal map, soft shadow or dynamic exposure is required.

## Evidence

Indexed rendering still passes through the normal compiled art and Period VGA audits. A palette-resolved frame does not become period-authentic merely because it is indexed.

Review raw 1× output, integer presentation, cluster discipline, dither/material behaviour and modern-effect contamination separately.
