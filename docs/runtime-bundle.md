# Runtime bundle and packaged player contract

## Purpose

`game.bundle.json` is the sole project-data input to a packaged player. It is not an authoring document and does not contain source-art paths, editor state, source hashes or build-tool objects.

The shared `@evavo/adventure-runtime-bundle` package owns the structural and semantic parser used by both the compiler and browser player. The compiler parses its own output before fingerprinting it. The player parses the same format before allocating textures or starting logical time.

## Bundle contents

A version 1 runtime bundle contains:

- project identity and presentation profile;
- start scene and entrance;
- the compiled asset-manifest fingerprint and compiler version;
- source-free runtime asset records;
- inventory definitions;
- actor frame and animation definitions;
- compiled scenes and interaction lookup indices;
- compiled dialogue graphs and node indices;
- deterministic sequences and cue counts.

Runtime asset records contain output roles, release-relative paths, media types, byte lengths, SHA-256 digests and typed metadata. They never contain `sourceFiles`.

## Runtime validation

The browser rejects a bundle before loading assets when any of the following is true:

- JSON structure or schema versions are invalid;
- IDs are duplicated;
- runtime paths are non-portable or collide case-insensitively;
- required image or atlas output roles are missing;
- atlas pages, frame IDs or source rectangles are invalid;
- authored actor frames differ from compiled atlas geometry;
- actor animations refer to missing frames;
- the start scene or entrance is missing;
- scene backgrounds are missing, non-image assets or smaller than the room;
- inventory icons or occluders have invalid runtime asset kinds;
- dialogue start nodes, continuation nodes or node indices are invalid;
- sequence cue counts differ from their tracks.

Build-time validation remains broader because it also has access to source projects and source evidence. Runtime validation protects packaged games from corruption, stale files and unsupported manual edits.

## Texture loading

`PixiAssetTextureStore` consumes runtime assets rather than authoring assets.

For an image asset it loads the `primary` output. For a spritesheet it loads only declared atlas page outputs in stable role order. Atlas JSON is build evidence and does not need to be reparsed during every player startup because page and frame metadata is already embedded in the runtime bundle.

A resolved sprite may identify both `assetId` and `frameId`. The texture store maps that frame to its compiled page texture. The renderer then applies the frame's exact source rectangle, original size and trim offset. It never guesses an atlas page from coordinates.

All texture loads complete before rendering begins. A failed atlas page rolls back the current asset load instead of exposing a partially usable spritesheet.

## Browser modes

The browser player has two explicit modes.

### Rendering laboratory

Open the player without a query parameter:

```text
http://localhost:5173/
```

This uses native-resolution primitive fixtures to verify WebGL presentation, layer separation, fixed ticks and integer host scaling without depending on imported art.

### Packaged runtime

Pass a URL to a packaged bundle:

```text
http://localhost:5173/?bundle=/release/game.bundle.json
```

The player resolves the URL against the current page, parses the runtime bundle, preloads image and atlas page outputs relative to the bundle URL and renders the start room at the project's native resolution.

The current packaged-player slice deliberately renders the start-room background first. Scene actor instances, dynamic object instances, camera staging and interactive runtime state will be added through canonical scene-instance contracts rather than inferred from global actor definitions.

## Trust boundaries

Release packaging is responsible for verifying source and output file evidence and assembling a clean directory. The runtime bundle parser is responsible for project and asset metadata integrity. The texture loader is responsible for mapping verified runtime paths to GPU textures. The renderer is responsible only for displaying resolved frames.

No layer is allowed to reach backward into source-art folders to repair missing runtime data.
