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

The foundation is a TypeScript monorepo with a renderer-independent domain engine. A React and Vite authoring studio, browser player, PixiJS WebGL renderer and optional Tauri desktop shell sit on top of the same compiled project and runtime contracts.

Source projects compile into deterministic runtime bundles. The editor, renderer and platform shell are replaceable clients of the canonical schemas and services rather than owners of game data.

## Foundation specifications

- [Architecture](docs/architecture.md)
- [Technology stack](docs/technology-stack.md)
- [Authentic pixel rendering](docs/pixel-rendering.md)
- [Project format and compilation](docs/project-format.md)
- [Implementation roadmap](docs/foundation-roadmap.md)

## First playable milestone

The first milestone is a small five-room mystery vignette that proves:

1. canonical project schemas and migrations;
2. deterministic runtime commands, saves and replays;
3. navigation, depth, scale and partial occlusion;
4. authentic native-resolution rendering and sprite timing;
5. verbs, cursors, dialogue, inventory and score policies;
6. skippable in-scene cinematics with equivalent completion state;
7. validation fixtures, a rendering laboratory and compiled exports;
8. browser and Windows development players.

## Development

The repository pins Node.js 24 LTS and pnpm 11.

```powershell
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm check
```

The repository is in active development. Builds and tests must only be reported after they have been executed against a checked-out workspace.
