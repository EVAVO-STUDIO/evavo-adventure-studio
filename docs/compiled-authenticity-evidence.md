# Compiled authenticity evidence

## Purpose

The Compiled Proof Lab separates a persuasive production bible from evidence that the
packaged game actually preserves its intended VGA or SVGA presentation.

Open the workspace at:

```text
http://localhost:5174/?workspace=evidence
```

The audit is local and read-only. It parses six canonical JSON artifacts in the browser,
uses the existing project, art, asset, bitmap-font and interface validators, and then
applies adventure-specific native-output gates.

## Required artifacts

A complete proof set contains:

1. `project.json` — canonical scenes, presentation, actors, inventory and narrative IDs;
2. `art-direction.json` — executable palette, size, sampling and transparency policy;
3. `assets.manifest.json` — exact source-to-runtime outputs, dimensions and atlas geometry;
4. `art-evidence.json` — colour counts, indexed mode and alpha measured from encoded PNGs;
5. `bitmap-fonts.json` — glyph atlases, metrics, fallback coverage and kerning;
6. `ui-skins.json` — native regions, interaction mode, cursor grammar and font roles.

Every artifact must carry the same project identity. The evidence report never silently
combines files from different builds or projects.

## Native-output gates

`evaluateAdventureCompiledEvidence` verifies:

- canonical project and design-side references;
- matching project, design and art-policy native dimensions;
- integer presentation and nearest-neighbour sampling;
- an indexed output profile for controlled VGA projects;
- a compiled colour budget no wider than the production bible;
- exact scene-background dimensions without unreviewed resampling;
- indexed, opaque and budgeted background pixels;
- complete actor frame coverage in deterministic padded atlases;
- indexed actor pages with binary transparency rather than soft alpha;
- valid bitmap-font manifests, useful glyph coverage and indexed font atlases;
- valid interface skins and bounded persistent native-canvas coverage;
- complete compiled and encoded evidence coverage for every visual project asset.

The report is deterministic. Findings are deduplicated and sorted by severity, evidence
area, path and ID. A report is `verified` only when it has no errors or warnings and every
required visual asset has encoded pixel evidence.

## What the gate proves

A verified report proves that the reviewed artifacts agree on native size, colour mode,
alpha policy, atlas structure, bitmap text and interface geometry. It does not prove that
the illustration, animation, puzzle design or acting is artistically excellent.

Human review remains mandatory at 1× native size. Reviewers must still confirm silhouette,
value grouping, focal hierarchy, interaction readability, animation timing, material
coherence, audio identity and deterministic playtest behaviour.

## Relationship to the Authenticity Lab

The `/?workspace=authenticity` workspace reviews authored production intent and generates
scene briefs. The Compiled Proof Lab reviews built artifacts. Neither replaces the other:

```text
Design Director
→ Authenticity Lab
→ asset, font and interface production
→ compiled manifests and encoded pixel evidence
→ Compiled Proof Lab
→ 1× native human review and deterministic playtest
```

This boundary prevents a strong prose document from being mistaken for finished evidence,
and prevents technically valid files from being mistaken for a well-directed game.
