# Native showcase gallery

## Purpose

The Native Showcase Gallery turns each production profile into a visible original game example. A profile alone can describe palette, interface and animation policy while still leaving the team to imagine how those decisions combine on screen. The gallery therefore provides four coordinated native construction plates for every built-in family:

1. title and publisher transition;
2. ordinary gameplay staging;
3. dialogue or close-up treatment;
4. map, dossier, research or other game-specific system treatment.

Open the workspace at:

```text
http://localhost:5174/?workspace=showcases
```

The public package entry point is:

```ts
@evavo/adventure-design/production-showcases
```

## Original showcase set

| Profile | Original showcase | Native proof |
| --- | --- | --- |
| Storybook Icon VGA | **The Glass Finch** | fairytale tableau, icon interaction, portrait restraint and season-changing map |
| Comic Science-Fiction VGA | **Vacuum Courtesy** | machine comedy, readable warning state, reaction dialogue and service schematic |
| Gothic Investigation VGA | **The Red Ledger** | rain-dark evidence staging, portrait topics and contradiction ledger |
| Verb Panel Cartoon VGA | **Saltwake Island** | persistent verbs, sentence construction, inventory comedy and physical tide chart |
| Pulp Archaeology VGA | **The Sunken Dial** | practical conservation room, route choice, companion consequence and mechanism dossier |
| Cinematic Pulp VGA | **Jade Horizon** | wide travel staging, protagonist knowledge, relationship state and route dossier |
| Neo-Noir Low-Resolution | **Cold Meridian** | sparse rain composition, minimal captions, evidence playback and separated knowledge archives |

The gallery data contains no commercial title, character, location, dialogue, puzzle solution, logo or interface artwork. Historical references remain confined to research documentation.

## Plate contract

Each `AdventureProductionShowcase` contains exactly one plate of each kind:

- `title`;
- `gameplay`;
- `dialogue`;
- `system`.

A plate records:

- stable identity and player-facing name;
- immediate player goal;
- native focal point and horizon;
- status or dialogue text;
- actor beats with role, baseline, height, facing, pose and silhouette intent;
- prop beats with role, native rectangle, state and interaction intent;
- at least three concrete visual proofs.

The data is renderer-neutral. Studio currently renders a procedural construction image so the same contract can later drive authored pixel mockups, export checklists or project templates.

## Actor and prop beats

Actor beats are not final animation assets. They specify the opening silhouette and native staging evidence required before sprite production:

- player, companion, non-player character or threat role;
- baseline position;
- intended native height;
- facing;
- readable pose;
- the silhouette feature that must survive final artwork.

Prop beats distinguish:

- clues;
- exits;
- puzzle mechanisms;
- ambience.

Interactive props carry explicit state. Decorative ambience may remain non-interactive. This separation helps prevent the common failure where every detailed object appears actionable or the one required clue disappears into background decoration.

## Puzzle proof

Every showcase includes one or more `AdventureShowcasePuzzleBeat` records. A beat names the production profile's puzzle grammar and documents:

- the problem established on screen;
- the player action;
- the visible state result;
- the recovery policy.

This keeps the visual example connected to actual adventure play. A beautiful room that does not communicate cause, consequence or recovery is not a complete style example.

## Native renderer

The Studio renderer uses one 320×200 coordinate system and profile palette variables. It provides distinct original backgrounds for:

- enchanted bell-tower valley;
- orbital service bay;
- rain-dark archive bookshop;
- island harbour;
- museum conservation workshop;
- night airfield;
- rain tenement alley.

Actor and prop beats are rendered over those backgrounds with crisp geometry. The selected profile then adds its own interface family:

- temporary top icon bar;
- portrait topic panel;
- bottom verb and inventory panel;
- cinematic dossier;
- minimal context caption.

Title, dialogue and system plates use separate overlays rather than recolouring the gameplay interface.

## Validation

`validateAdventureProductionShowcase` checks:

- profile existence and matching showcase title;
- unique IDs;
- required plate kinds;
- focal point and horizon bounds;
- actor positions and native heights;
- a player actor on every gameplay plate;
- prop rectangles inside the native canvas;
- puzzle setup-plate references;
- puzzle grammar compatibility with the selected profile;
- minimum visual-proof coverage;
- explicit original-content boundaries.

The tests also prevent commercial titles and publisher names from entering runtime showcase data.

## Production boundary

The gallery is a construction and direction tool. It does not claim that procedural SVG masses are final pixel art. Final showcase games still require:

- authored backgrounds and native palettes;
- complete actor and object animation;
- bitmap fonts, cursors and interface assets;
- compiled evidence;
- canonical project and scene-instance documents;
- puzzle, dialogue and sequence implementation;
- deterministic Player and replay evidence;
- human native-size review.

The next production step is to turn selected showcase plates into canonical playable project seeds, beginning with one storybook, one investigation and one cinematic-pulp vertical slice.
