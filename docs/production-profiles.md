# Adventure production profiles

## Purpose

Production profiles prevent “1990s adventure game” from becoming one generic pixel filter. Each profile is an executable production contract covering:

- final native canvas and indexed-colour budget;
- background composition and foreground discipline;
- actor silhouette, portrait and animation cadence;
- interaction and inventory family;
- dialogue presentation;
- puzzle grammar;
- music, ambience and interface sound;
- an original deterministic publisher splash;
- an original showcase vertical slice;
- authenticity rules, prohibited shortcuts and native-review questions.

Open the Studio workspace at:

```text
http://localhost:5174/?workspace=profiles
```

The public package entry point is:

```ts
@evavo/adventure-design/production-profiles
```

## Reference-study matrix

The built-in profiles study production grammar rather than copying commercial content.

| Built-in profile | Historical or modern study lane | What is retained as general method |
| --- | --- | --- |
| `storybook-icon-vga` | *King's Quest V* and painterly Sierra icon adventures | 320×200 tableau composition, icon interaction, musical locations, readable environmental state |
| `comic-scifi-icon-vga` | *Space Quest III* and comic science-fiction adventures | exaggerated silhouettes, machine-state comedy, specific failure feedback, economical animation |
| `early-procedural-icon-vga` | *Police Quest: In Pursuit of the Death Angel* VGA remake and early SCI1 procedural adventures | painted real-world observation, compact icon interaction, small proportionate actors, practical targets, readable procedure and bounded failure/restart |
| `gothic-investigation-vga` | *Quest for Glory IV* and *Gabriel Knight: Sins of the Fathers* | dark readable palettes, portraits, topic research, chapter change and visible evidence |
| `gothic-rpg-vga` | later Sierra Gothic RPG adventures | classes, resources, schedules, combat recovery and route-state variation |
| `procedural-investigation-vga` | *Police Quest IV* and later SCI32 procedural investigation | evidence custody, case state, interrogation, procedural recovery and authored case-file surfaces |
| `verb-panel-cartoon-vga` | *The Secret of Monkey Island* | verb-object sentence construction, persistent inventory, dense authored feedback and comic causality |
| `pulp-archaeology-vga` | *Indiana Jones and the Fate of Atlantis* | route alternatives, investigation, travel, mechanism close-ups and pulp staging |
| `cinematic-pulp-vga` | *Rise of the Dragon* and *Heart of China* | full-screen framing, bespoke panels, protagonist and relationship state, visible branch divergence |
| `neo-noir-lowres` | *Gemini Rue* | sparse pixel composition, noir atmosphere, multi-character investigation and restrained context UI |

The profile data contains no commercial title, character, location, dialogue, puzzle solution, logo or interface artwork. Historical names are confined to this research documentation.

## Police procedural profiles are deliberately split

`early-procedural-icon-vga` and `procedural-investigation-vga` are not aliases.

The early profile is for roughly 1991–1992 SCI1-style production where most of the experience still happens directly in a 320×200 room: practical architecture, restrained icon interaction, small in-scene actors, short narration, visible score, explicit procedure and fast failure/restart. It should feel like a professional VGA adaptation of ordinary places, not like a later cinematic investigation interface.

The later procedural profile is for denser SCI32-era investigation: evidence custody, interviews, case-state presentation, more elaborate modal surfaces and richer procedural branching.

A project should not mix those two languages accidentally. If a room needs a caseboard, extensive interview state and evidence-chain UI, it belongs in the later profile. If it needs a believable station corridor, patrol-car handoff, roadside stop and tiny practical targets, the early profile is normally the better fit.

## Built-in original showcases

Each profile includes a distinct original vertical-slice brief:

| Profile | Original showcase | Production proof |
| --- | --- | --- |
| Storybook Icon VGA | **The Glass Finch** | fairytale location chain, icon interaction, environmental state and score |
| Comic Science-Fiction VGA | **Vacuum Courtesy** | machine comedy, caricatured props and authored reaction feedback |
| Early Procedural Icon VGA | **Night Shift** | municipal/street staging, compact icons, procedure, score, small-target interaction and bounded failure/restart |
| Gothic Investigation VGA | **The Red Ledger** | topic-led research, portrait state and chapter-visible evidence |
| Gothic Role-Playing VGA | **The Hollow Vale** | classes, resources, schedules and recoverable combat |
| Procedural Investigation VGA | **Open Case** | evidence custody, interrogation, case state and later procedural recovery |
| Verb Panel Cartoon VGA | **Saltwake Island** | verbs, sentence line, inventory combinations and dialogue comedy |
| Pulp Archaeology VGA | **The Sunken Dial** | alternate routes, travel, mechanism close-ups and companion consequence |
| Cinematic Pulp VGA | **Jade Horizon** | protagonist switching, relationship state, branch alerts and dossier UI |
| Neo-Noir Low-Resolution | **Cold Meridian** | sparse context interaction, communicator research and two-character knowledge boundaries |

These are production briefs rather than screenshot replicas. Final demo projects must preserve the same originality boundary when assets, dialogue, music and puzzles are authored.

## Canonical profile seed

`createAdventureProductionProfileSeed` converts a profile into deterministic project defaults:

- canonical `PresentationProfile` values;
- an `AdventureCreativeDirection` suitable for Adventure Design Director;
- required review checklist items;
- the original splash contract;
- the original showcase brief.

Example:

```ts
import {
  adventureProductionProfileById,
  createAdventureProductionProfileSeed,
} from "@evavo/adventure-design/production-profiles";

const profile = adventureProductionProfileById("early-procedural-icon-vga");
const seed = createAdventureProductionProfileSeed(profile);

seed.presentation.interactionMode; // icon-bar
seed.presentation.textureSampling; // nearest
seed.creativeDirection.nativeSize; // 320 × 200
```

The seed is not a complete game. It is a production starting point that must be connected to canonical scenes, actors, dialogue, sequences, assets, scene instances, Scene Director staging, UI skins and compiled evidence.

## Compatibility audit

`auditAdventureProductionProfile` checks a selected profile against an Adventure Design document and canonical project presentation. It detects:

- native-canvas mismatch;
- incompatible production or composition mode;
- palette budget overflow;
- incompatible interaction family;
- disabled integer scaling;
- linear texture sampling;
- motion-policy drift;
- non-default score presentation;
- project-identity mismatch.

Errors block the profile. Warnings require explicit review. Score visibility is a note because a game may deliberately omit or add scoring while otherwise retaining the production language.

The profile audit does not replace compiled pixel evidence. A project may match a profile on paper while its final backgrounds, actor atlases, fonts or UI assets fail native-size review.

## Interface families

### Top icon bar

Used by storybook, comic-icon and early procedural icon profiles. The bar is temporary rather than permanently consuming the gameplay canvas. Walk, look, use, talk, inventory and system states must have project-specific bitmap cursors and feedback.

For early procedural scenes, the interface must remain especially quiet: ordinary objects should stay ordinary, score feedback should be restrained and the icon system must not reveal hidden targets through modern highlighting.

### Portrait topic panel

Used by the gothic investigation profile. Inventory, evidence and conversation topics remain distinct production concepts. Portrait expression and eye line must reflect the active dialogue branch rather than acting as static decoration.

### Bottom verb panel

Used by cartoon and pulp verb profiles. The animation window is composed around persistent verbs, sentence construction and inventory from the beginning. The sentence line must always reflect the command that will execute.

### Cinematic dossier

Used by cinematic pulp. Full-screen scenes remain primary while quick inventory, status, route, time and relationship state appear in authored panels. Panels are part of the fiction and cannot be a generic modern HUD.

### Minimal context

Used by neo-noir. A restrained context cursor, short captions and temporary inventory or communicator surfaces preserve negative space. Minimal UI is not permission to make goals or failures ambiguous.

## Scene Director relationship

Production profiles define what a room should feel like. Scene Director defines how the actual 320×200 room behaves.

A profile-compliant room should use Scene Director to verify:

- WALK: navigable floor and preferred authored lanes;
- CONTROL: active traversal and state-driven blockers;
- DEPTH: perspective curves and fixed-scale regions;
- OCCLUSION: legacy and staged foreground planes;
- HOTSPOTS: visible target geometry and click comfort;
- APPROACH: verb/item-specific actor standing positions;
- ACTORS: foot point, footprint, facing and scale;
- SURFACE: movement material and footstep treatment;
- LIGHT: palette-light zones and priority;
- ENTRY: spawn, arrival path and control handoff;
- DEBUG: combined deterministic room state.

The Director must not become a modern navmesh/physics editor. It is an authored 2.5D staging tool for classic room composition.

## Original splash families

Profiles include original publisher marks and deterministic beat timelines:

- `lantern-reveal` for restrained storybook and early procedural presentation;
- `celestial-mark` for gothic investigation;
- `comic-transmission` for science-fiction comedy;
- `pulp-panel` for archaeological travel;
- `kinetic-monolith` for cinematic pulp;
- `noir-signal` for sparse neo-noir.

Every splash specifies stable beat IDs, contiguous logical start ticks and durations, visual composition and motion doctrine, transition and optional sound cue, safe skip boundary and deterministic main-menu completion.

The marks are original. A “Sierra-like” or “Dynamix-like” production lane means studying restraint, framing, timing and integration, never tracing or imitating those companies' logos.

## Puzzle grammar

Profiles select from explicit puzzle grammars:

- `inventory-chain`;
- `environmental-state`;
- `topic-investigation`;
- `multi-route`;
- `relationship-branch`;
- `comic-misapplication`;
- `research-deduction`;
- `hybrid-action`.

The grammar informs authoring and review; it does not automatically generate puzzles. Adventure Design, Progression Flow Lab, runtime execution and playtest evidence remain responsible for causality, reachability, recovery and player comprehension.

## Production workflow

Use profiles at the beginning of production:

1. choose one primary production profile;
2. generate its project and Adventure Design seed;
3. compose native scenes around the profile interface reservation;
4. author Scene Director staging over the same native room;
5. author actors and animation within the silhouette and cadence range;
6. author puzzles using the selected grammar rather than a generic item list;
7. create original splash, menu, font, cursors and UI assets;
8. run profile, authenticity, composition, staging and progression audits;
9. compile and inspect encoded pixel evidence;
10. replay the game at 1× native size and retain deterministic playtest evidence.

A project can deliberately diverge, but divergence must be documented and verified. Combining every profile into one game normally produces incoherent art, interface and puzzle language.
