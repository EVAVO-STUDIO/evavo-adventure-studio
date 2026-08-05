# EVAVO Adventure Studio

EVAVO Adventure Studio is an engine, visual authoring environment and production toolchain for making authentic 1990s-style point-and-click adventure games.

The project is designed around the production grammar of classic Sierra, LucasArts and Dynamix adventures while remaining an original, reusable system. It supports low-resolution pixel presentation, verb and context cursors, walkable scenes, depth scaling, occlusion, layered animation, dialogue trees, inventory puzzles, score systems, scripted cutscenes, cinematic close-ups, save games and complete project export.

## Product pillars

- **Authentic presentation:** integer-scaled low-resolution rendering, palette-aware art, bitmap typography, deliberate animation timing, scene transitions, cursor language and era-appropriate UI layouts.
- **Profile-driven identity:** seven original production families connect canvas, palette, scene grammar, actor performance, interface, puzzles, audio, publisher splash and showcase direction instead of applying one generic retro filter.
- **Original showcase proof:** every production family includes title, gameplay, dialogue and system plates with native composition, actor, prop, UI and recoverable puzzle intent.
- **Deterministic play feel:** authored acceleration, braking, cornering, footfall phase, camera response, command buffering and fixed-step frame pacing make each family play differently without letting monitor cadence alter story state.
- **Complete adventure runtime:** navigation, hotspots, verbs, inventory, dialogue, conditions, flags, scoring, cutscenes, audio and save-state persistence.
- **Connected game direction:** a production bible for visual identity, illustrated geography, chapters, puzzle causality, clue delivery and shot-based cinematic intent.
- **Evidence-backed production:** compiled dimensions, indexed pixels, binary alpha, bitmap fonts and native interface geometry are reviewed against the same canonical project.
- **Native scene construction:** walk lanes, depth bands, entrances, hotspots and foreground occlusion are reviewed together at the exact gameplay canvas before final art lock.
- **Native scene staging:** player control, actor silhouettes, stateful props, portal handoffs and deterministic layer order are reviewed in the same scene-instance graph that ships.
- **Progression integrity:** bounded canonical state exploration proves routes through object interactions, inventory, dialogue and sequence outcomes while exposing unreachable objectives and recoverability risks.
- **Visual production studio:** scene composition, walkmesh editing, depth maps, occluders, hotspot authoring, character animation, art-direction policy, bitmap fonts, interaction skins, dialogue graphs, timeline sequencing, playtest artifact inspection and project validation.
- **Flexible game identity:** supports parser-like, icon-bar, verb-list, verb-coin, two-button and context-sensitive interaction models without copying any one commercial game.
- **Deterministic projects:** human-readable project files, stable IDs, schema validation, reproducible builds and revision-safe exports.

## Repository direction

The foundation is a TypeScript monorepo with a renderer-independent domain engine. A React and Vite authoring studio, browser player, PixiJS WebGL renderer and optional Tauri desktop shell sit on top of the same compiled project and runtime contracts.

Source projects compile into deterministic runtime bundles. The editor, renderer and platform shell are replaceable clients of the canonical schemas and services rather than owners of game data.

## Repository boundaries

Adventure Studio is an independent Git repository. Other EVAVO repositories must be sibling checkouts, not directories inside this worktree.

Recommended Windows layout:

```text
C:\Gitrepos\evavo-adventure-studio
C:\Gitrepos\card-game-studio
C:\Gitrepos\evavo-development-studio
```

Do not use a nested layout such as:

```text
C:\Gitrepos\evavo-adventure-studio\card-game-studio
```

The top-level `/card-game-studio/` path is ignored defensively so an accidental nested clone cannot be staged into Adventure Studio. That ignore rule is not an endorsement of nesting: move or recreate the clone as a sibling repository, then work from the standalone path.

## Foundation specifications

- [Architecture](docs/architecture.md)
- [Technology stack](docs/technology-stack.md)
- [Authentic pixel rendering](docs/pixel-rendering.md)
- [Authentic classic-adventure production principles](docs/classic-adventure-authenticity.md)
- [Adventure production profiles](docs/production-profiles.md)
- [Native showcase gallery](docs/native-showcase-gallery.md)
- [Classic adventure play feel and frame timing](docs/classic-adventure-play-feel.md)
- [Adventure Design Director](docs/adventure-design.md)
- [Compiled authenticity evidence](docs/compiled-authenticity-evidence.md)
- [Native scene composition and readability](docs/native-scene-composition.md)
- [Native scene staging and initial runtime state](docs/native-scene-staging.md)
- [Progression flow and soft-lock analysis](docs/progression-flow.md)
- [Runtime narrative request execution](docs/runtime-narrative-execution.md)
- [Project format and compilation](docs/project-format.md)
- [Command-line build workflow](docs/cli.md)
- [Scene composition and runtime](docs/scene-composition.md)
- [Visual studio workspace](docs/studio-workspace.md)
- [Editor expansion map](docs/editor-expansion-index.md)
- [Sprite and animation authoring](docs/animation-authoring.md)
- [Art direction and compiled pixel evidence](docs/art-direction.md)
- [Native bitmap fonts](docs/bitmap-fonts.md)
- [Interface skins and interaction layouts](docs/interface-skins.md)
- [Deterministic save games](docs/save-games.md)
- [Deterministic replays](docs/deterministic-replays.md)
- [Renderer-free replay execution](docs/replay-execution.md)
- [Playtest inspector](docs/playtest-inspector.md)
- [Implementation roadmap](docs/foundation-roadmap.md)

## First playable milestone

The first milestone is a small five-room mystery vignette that proves:

1. canonical project schemas and migrations;
2. deterministic runtime commands, saves and replays;
3. one selected production profile controlling canvas, palette, UI, puzzle grammar and original splash;
4. an original title, gameplay, dialogue and system showcase plate for the selected profile;
5. a deterministic play-feel profile controlling motion, footfall phase, camera and frame pacing;
6. navigation, depth, scale and partial occlusion;
7. authentic native-resolution rendering, palettes, sprite timing and bitmap text;
8. verbs, cursors, dialogue, inventory, score and alternate interface policies;
9. skippable in-scene cinematics with equivalent completion state;
10. bounded progression exploration and one deliberately broken recoverability variant;
11. validation fixtures, rendering laboratories and compiled exports;
12. browser and Windows development players.

## Development

The repository pins Node.js 24 LTS and pnpm 11.

```powershell
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm check
```

Run the native-resolution browser player and rendering laboratory:

```powershell
pnpm dev:player
```

Run the visual production Studio:

```powershell
pnpm dev:studio
```

The player uses port `5173`; the Studio uses port `5174`; the Cinematic Timeline Lab uses port `5175`.

Packaged browser games provide one bundle-scoped quick slot and playtest replay controls:

```text
Ctrl/Cmd + Shift + S  Save
Ctrl/Cmd + Shift + L  Load
Ctrl/Cmd + Shift + R  Start or finish replay recording
Ctrl/Cmd + Shift + E  Export the latest completed replay
```

Studio routes currently include:

```text
/?workspace=composer
/?workspace=profiles
/?workspace=showcases
/?workspace=feel
/?workspace=design
/?workspace=authenticity
/?workspace=evidence
/?workspace=composition
/?workspace=staging
/?workspace=progression
/?workspace=geometry
/?workspace=objects
/?workspace=animation
/?workspace=art
/?workspace=fonts
/?workspace=interface
/?workspace=dialogue
/?workspace=playtest
/?workspace=validation
```

After `pnpm run build:types`, inspect the CLI or validate a project:

```powershell
pnpm cli -- help
pnpm cli -- validate --project .\game\project.json
```

The repository is in active development. Builds and tests must only be reported after they have been executed against a checked-out workspace.
