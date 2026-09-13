# Scene Director authoring

Scene Director is the native 320×200 authoring surface for the geometry that makes a classic VGA room actually play correctly.

It does **not** copy project data into an editor-only scene format. The Director edits the same three canonical documents consumed by the compiler and runtime:

```text
project.json
scene-instances.json
scene-staging.json
```

## Ownership

### `project.json`

Owns scene-wide geometry and reusable project declarations:

- walkable navigation polygons;
- entrances;
- scene dimensions;
- background identity;
- actors/assets/dialogue/sequences and other project-level data.

The canonical geometry editor can move navigation polygon vertices and entrance points directly in this document.

### `scene-instances.json`

Owns placed composition and reusable stateful prop definitions:

- placed actor instances;
- placed object instances;
- navigation portals;
- reusable object states;
- exact local interaction polygons;
- state-specific visuals and interactions.

The Director can move portal endpoints, placed object anchors and exact object-state hotspot vertices. Hotspot editing uses the same pivot, perspective scale, instance scale and X-mirroring transform as runtime hit testing, then writes the result back in local object coordinates.

A state with no exact interaction polygon can explicitly create a starter target. Existing targets can be explicitly removed. No hidden automatic hotspot is shipped merely because an object exists.

### `scene-staging.json`

Owns production staging that layers on top of canonical room/composition geometry:

- actor footprints;
- preferred walking lanes;
- perspective scale curves and area overrides;
- navigation state modifiers;
- approach slots;
- invisible click-comfort regions;
- interaction choreography;
- entry choreography;
- surface zones;
- foreground occlusion planes;
- palette-light zones.

These remain separate from project/instance geometry because they describe how a room is directed rather than redefining the underlying room or reusable prop.

## One history

All three documents share one chronological edit history.

For example:

```text
move navigation floor vertex     project.json
move radio object                scene-instances.json
move radio approach slot         scene-staging.json
adjust fluorescent LIGHT polygon scene-staging.json
undo                             restores LIGHT polygon
undo                             restores approach slot
undo                             restores radio position
undo                             restores navigation floor
```

Pointer movement creates live preview state only. Pointer-up creates one committed history entry. This prevents hundreds of history entries during a single drag.

Changing production proof or scene cancels transient preview state.

## Native coordinate mapping

Responsive browser size must never become authored game geometry.

Pointer input is transformed through the SVG screen matrix back into native room coordinates and then rounded to native pixels. WALK, CONTROL, DEPTH, OCCLUSION, APPROACH, SURFACE, LIGHT and normal entry-path points therefore remain integer native coordinates in the editor.

Entry choreography is the intentional exception: an authored spawn/path may extend outside the native canvas so a character can enter from off-screen.

## Linked validation

Every committed or previewed composite edit is fail-closed through the relevant schemas and then through both linked semantic validators:

```text
project schema
scene-instance schema
scene-instance semantics
staging schema
staging semantics against edited project + edited instances
```

A navigation polygon edit is rejected if it leaves an actor or portal invalid. A staging edit is rejected if an approach slot becomes unreachable/outside the authored room geometry. An object-state hotspot remains local geometry and is checked after round-trip parsing.

## Polygon quality

The UI applies stricter polygon-quality checks than the base `points.length >= 3` schema alone.

Navigation, exact hotspots, LIGHT regions and SURFACE regions reject:

- self-intersection;
- zero-area/degenerate polygons;
- duplicate consecutive vertices;
- too few points;
- non-finite coordinates;
- out-of-native-bounds points where the owning geometry requires native containment.

A bow-tie polygon therefore cannot enter history or export just because its JSON shape is syntactically valid.

## Footprint clearance review

A foot point may be technically inside a walk polygon while the visible character body still scrapes the edge.

Scene Director performs an additional production-quality clearance audit for:

- walkable actor start points;
- authored approach slots;
- entrances.

The conservative requirement is based on the actor footprint half-width plus authored clearance. These are warnings rather than physics failures: they call attention to visually tight staging that should be adjusted or deliberately accepted.

## Indexed LIGHT authoring

LIGHT mode exposes the actual palette-map binding rather than a generic coloured overlay:

```text
LIGHT polygon
→ palette map
→ palette asset
→ palette offset
→ authored 16-colour bank
```

Ordered-dither regions also display their real inner eight-native-pixel Bayer transition band.

The Director sample inspector shows the target bank as swatches, but authoring a palette asset does not pretend that compiled release evidence exists. Shipping still requires the indexed/palette CLI/runtime integrity gates.

## Export

`Export documents` serializes the **committed** document state, never transient drag preview state.

One deterministic store-only ZIP is produced:

```text
<proof>.scene-director.zip
  <proof>.project.json
  <proof>.scene-instances.json
  <proof>.scene-staging.json
```

Each JSON file is reparsed through its canonical schema before export. The ZIP uses deterministic file ordering and zeroed timestamp fields so identical document state produces identical archive bytes.

The export is intended as a round-trip production artifact: place the three files back into the project workflow, validate/compile/package them through the normal CLI, and review the resulting room at raw 1× native size.

## Current direct-edit modes

The staging Director directly edits:

- WALK preferred-lane points;
- DEPTH key Y values;
- OCCLUSION baselines;
- APPROACH slot positions;
- SURFACE polygon vertices;
- LIGHT polygon vertices;
- ENTRY spawn/path points.

The canonical geometry editor directly edits:

- WALK navigation polygons;
- CONTROL portal endpoints;
- CONTROL entrances;
- OBJECT placed anchors;
- HOTSPOTS exact local state polygons.

The remaining authoring work should focus on quality rather than another parallel data model: richer priority masks, stronger footprint/corridor diagnostics, visual state selection/context, and production-grade playable proof assets.
