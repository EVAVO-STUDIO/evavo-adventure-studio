# Native bitmap fonts

## Purpose

Adventure Studio renders canonical game text from authored bitmap atlases. It does not use browser font measurement, CSS text, Canvas vector text or operating-system font rasterisation for speech, verbs, inventory labels or other in-game typography.

The font pipeline preserves the visual grammar of native-resolution adventure interfaces:

- integer glyph rectangles;
- explicit bearings and advances;
- authored kerning pairs;
- deterministic word wrapping;
- nearest-neighbour sampling;
- stable fallback characters;
- native-pixel outlines;
- reproducible layout in tests, screenshots and packaged games.

## Authoring document

`BitmapFontManifest` from `@evavo/adventure-bitmap-font` is a versioned project-scoped sidecar.

```text
bitmap-fonts.json
```

Each font declares:

- stable font ID and display name;
- image or spritesheet atlas asset ID;
- line height and baseline;
- space advance and letter spacing;
- fallback Unicode code point;
- glyph records;
- kerning pairs.

Each glyph declares:

- stable glyph ID;
- Unicode code point;
- atlas source rectangle;
- optional spritesheet frame ID;
- horizontal and vertical bearing;
- advance width.

A font using an image atlas must not declare glyph frame IDs. A font using a spritesheet atlas must declare a frame ID for every glyph. The glyph rectangle must match the compiled atlas frame exactly.

## Studio workspace

Open the Font workspace at:

```text
http://localhost:5174/?workspace=fonts
```

The workspace includes:

- glyph-set browser;
- source-rectangle inspector;
- bearing and advance editing;
- fallback-glyph selection;
- line-height, baseline, space and letter-spacing controls;
- kerning-pair editing;
- deterministic preview wrapping;
- baseline overlays;
- undo and redo;
- exportable `bitmap-fonts.json`.

All document mutations use serializable commands from `@evavo/adventure-bitmap-font-editor-core`. Invalid documents never enter history. Removing the active fallback glyph, duplicating a glyph ID or code point, changing stable identities, or creating duplicate kerning pairs is rejected.

## Layout rules

`layoutBitmapText` uses integer authored metrics only.

It supports:

- Unicode code-point iteration;
- fallback-glyph substitution;
- authored pair kerning;
- spaces and deterministic tab widths;
- explicit line breaks;
- word wrapping at a native-pixel width;
- left, centre and right alignment;
- fixed line spacing;
- reporting missing code points.

A line width is the final authored advance minus terminal letter spacing. No browser or renderer measurement is consulted.

## Compiled validation

Font compilation requires a verified `AssetBuildManifest`.

For image atlases, every glyph rectangle must remain inside the compiled image dimensions.

For spritesheet atlases:

- every glyph must declare a frame ID;
- the frame must exist in compiled metadata;
- the authored source rectangle must exactly match the compiled frame rectangle;
- runtime texture lookup resolves the full atlas-page texture by frame ID;
- the glyph source rectangle is applied once by the renderer.

Font definitions are canonically sorted before bundle fingerprinting:

- fonts by font ID;
- glyphs by code point and then glyph ID;
- kerning pairs by left and right code point.

Projects without a font sidecar remain valid and omit `bitmapFonts` from the runtime bundle.

## Command-line workflow

Validate a font document without compiled assets:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --bitmap-fonts .\game\bitmap-fonts.json
```

Validate glyph mappings against compiled evidence:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --json
```

Compile fonts into the canonical runtime bundle:

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --out .\game\build\game.bundle.json
```

The font sidecar path and font count appear in validation, compilation and packaging reports. The CLI rejects outputs or release directories that would overwrite or contain the font sidecar.

## Runtime and renderer

`parseRuntimeBundle` validates font semantics and compiled glyph mappings before player startup. Valid fonts are associated with the exact source-free runtime asset collection.

After textures load successfully:

1. the Pixi texture store adopts the associated font resolver;
2. the renderer expands each `bitmap-text` render node into ordinary glyph sprite nodes;
3. each glyph uses nearest sampling and the authored atlas rectangle;
4. optional outlines produce eight one-native-pixel sprite passes behind the fill;
5. tint and alpha are applied to glyph sprites;
6. normal render ordering, masks, camera groups and integer host scaling continue unchanged.

An explicit renderer font resolver overrides the resolver carried by the texture store. Without either resolver, bitmap text remains an unsupported renderer capability and fails rather than silently falling back to vector text.

## Native feedback rail

Packaged gameplay converts command feedback and `speech-requested` events into a native interface rail when fonts are present.

The rail consists only of renderer-neutral nodes:

- translucent solid panel;
- one-pixel interface rule;
- outlined bitmap-text node;
- software cursor above the interface.

The browser status rail remains an accessibility and debugging mirror. It is not the canonical in-game text surface.

## Verification

The focused Windows and Linux editor workflow covers:

- font schema and semantic validation;
- glyph layout, wrapping, fallback and kerning;
- editor history and command schemas;
- compiled image and atlas mappings;
- deterministic bundle compilation;
- packaged runtime validation;
- glyph-to-sprite expansion;
- Pixi runtime handoff;
- native status composition;
- CLI loading and end-to-end font compilation;
- player, Studio and CLI builds.

No font build should be described as passing until the workflow or equivalent local commands complete with evidence.
