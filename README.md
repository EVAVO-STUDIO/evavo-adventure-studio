# EVAVO Adventure Studio

EVAVO Adventure Studio is an engine, visual authoring environment and production toolchain for making authentic 1990s-style point-and-click adventure games.

The project is designed around the production grammar of classic Sierra, LucasArts and Dynamix adventures while remaining an original, reusable system. It supports low-resolution pixel presentation, verb and context cursors, walkable scenes, depth scaling, occlusion, layered animation, dialogue trees, inventory puzzles, score systems, scripted cutscenes, cinematic close-ups, save games and complete project export.

## Product pillars

- **Authentic presentation:** integer-scaled low-resolution rendering, palette-aware art, deliberate animation timing, scene transitions, cursor language and era-appropriate UI layouts.
- **Complete adventure runtime:** navigation, hotspots, verbs, inventory, dialogue, conditions, flags, scoring, cutscenes, audio and save-state persistence.
- **Visual production studio:** scene composition, walkmesh editing, depth maps, occluders, hotspot authoring, character animation, dialogue graphs, timeline sequencing and project validation.
- **Flexible game identity:** supports parser-like, icon-bar, verb-coin, two-button and context-sensitive interaction models without copying any one commercial game.
- **Deterministic projects:** human-readable project files, stable IDs, schema validation, reproducible builds and revision-safe exports.

## Repository direction

The initial foundation is a TypeScript monorepo with a renderer-independent domain engine. A web-based editor and preview runtime will sit on top of the same project model. Platform adapters can later target desktop, web and packaged game builds without changing authored content.

## First milestone

The first milestone establishes:

1. canonical project and scene schemas;
2. deterministic runtime state and commands;
3. depth, scale and occlusion rules;
4. cursor and verb resolution;
5. dialogue, inventory and score contracts;
6. validation fixtures and an example scene;
7. editor and renderer adapter boundaries.

## Development

```powershell
npm install
npm run typecheck
npm test
```

The repository is in active development.