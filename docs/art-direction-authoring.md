# Art direction and compiled asset evidence

## Purpose

The Art workspace defines the technical visual grammar that makes an adventure feel authentically authored for its selected era profile. It separates deliberate art direction from incidental source-file properties.

Open it from Studio or directly:

```text
http://localhost:5174/?workspace=art
```

The canonical policy sidecar is `ArtDirectionManifest` from `@evavo/adventure-art-direction`.

## Era profiles

Built-in starting profiles include:

- EGA 16-colour 320 × 200;
- VGA 256-colour 320 × 200;
- SVGA 256-colour 640 × 480;
- native-resolution RGBA pixel art;
- custom native-pixel policy.

A profile declares:

- native canvas size;
- square or DOS 320 × 200 pixel aspect intent;
- indexed or RGBA output;
- colour budget and dithering strength;
- transparent-index policy;
- opaque, binary or full-alpha treatment;
- nearest-neighbour sampling requirement;
- integer host scaling requirement;
- fixed-tick animation cadence.

Profiles do not post-process modern artwork into authenticity. They constrain the source preparation, compiler and renderer contracts that produce the final image.

## Per-asset rules

Every project asset receives one explicit rule containing:

- production role such as background, actor, object, UI, cursor, font or palette;
- inherited or overridden colour mode;
- optional colour and dithering budget;
- alpha-trim policy;
- transparency policy;
- exact, minimum or unrestricted dimensions;
- nearest-only and resampling permissions;
- minimum atlas extrusion padding;
- production notes.

Background rules are inferred from scene dimensions and require exact output sizes. Actor assets are inferred from actor frame references. The Studio fixture additionally classifies stateful object atlases from the scene-composition sidecar.

## Two compiled evidence layers

The policy is evaluated against two separate build documents.

### Asset build manifest

`AssetBuildManifest` proves:

- each source asset has a compiled record;
- project and compiled kinds match;
- output roles and runtime paths are unique;
- native image dimensions and image colour counts;
- image indexed or RGBA output mode;
- atlas page dimensions, frame placement and extrusion padding;
- source and output byte lengths and SHA-256 identities.

### Visual pixel evidence

`ArtVisualEvidenceManifest` proves properties measured directly from the encoded PNG bytes:

- indexed or RGBA encoding for each image and atlas page;
- actual unique RGBA colour count after encoding;
- opaque, binary-alpha or full-alpha classification;
- exact atlas page role correspondence.

The asset pipeline derives this sidecar using `analysePngEvidence`. It does not rely on the requested recipe or on author-entered claims.

Keeping visual evidence separate preserves backward compatibility for runtime asset manifests while allowing strict art-direction gates to advance independently.

## Verified quality gates

The combined evaluator verifies:

- every visual asset has pixel evidence;
- every compiled atlas page has corresponding evidence;
- unexpected or duplicate page evidence is rejected;
- native image dimensions satisfy role policy;
- indexed or RGBA output matches the selected profile;
- image and atlas-page colours stay within budget;
- alpha classification satisfies opaque, binary or full-alpha policy;
- atlas frames meet minimum padding requirements;
- backgrounds remain exact native-size images;
- palette entry counts remain within budget;
- vector font sources are flagged where bitmap runtime fonts are required.

## Command history

Profile and asset-rule changes use serializable commands with exact inverse operations. The workspace supports:

- undo and redo;
- deterministic dirty-state comparison;
- guarded preset changes;
- validation before history mutation;
- exportable policy JSON;
- Windows and Linux CI tests.

## Relationship to other workspaces

- **Animation** owns native frame geometry, anchors, cadence and performance clips.
- **Composer** owns room placement and depth ordering.
- **Geometry** owns walk areas, hotspots, perspective bands and entrances.
- **Objects** owns persistent prop states and verbs.
- **Art** owns how every visual asset must compile and present.
- **Validation** combines structural and semantic project checks.

The compiled player consumes runtime assets only after all of these contracts converge.
