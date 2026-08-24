# Full-game classic adventure grammar

Adventure Studio must not define success as “one room looks like a 1990s adventure game.”

The stronger release question is:

> Can this project author, run, save, replay and validate the complete set of scene types, progression structures and specialized systems required by a professionally authored early-1990s adventure game?

The target references include production languages demonstrated by King's Quest V, Gabriel Knight: Sins of the Fathers, Quest for Glory, Day of the Tentacle, Leisure Suit Larry VGA, Heart of China, Rise of the Dragon, and Indiana Jones and the Fate of Atlantis.

Commercial titles are reference pressure only. Shipped EVAVO examples, artwork, dialogue, characters and puzzle content remain original.

## Three independent axes

Do not collapse the engine into title presets.

### Production profile

Answers **how it should feel**:

- native canvas and presentation;
- palette discipline;
- actor proportions and animation economy;
- composition and camera doctrine;
- interaction chrome;
- puzzle tone;
- audio identity;
- prohibited modern shortcuts.

Examples already include storybook Sierra VGA, Gothic investigation, early procedural icon VGA, later procedural investigation, LucasArts-like puzzle/cinematic families and Dynamix cinematic profiles.

### Scene archetype

Answers **what sort of authored scene this is**.

A whole game needs more than normal walkable rooms. Adventure Studio now defines archetypes for:

- classic fixed room;
- scrolling exterior;
- hub location;
- multi-level interior;
- state-variant room;
- portrait/dialogue close-up;
- research/investigation surface;
- puzzle close-up;
- travel map;
- vehicle interior/exterior;
- combat arena;
- action/minigame insert;
- timed danger;
- cinematic inset;
- cutaway/montage;
- multi-protagonist cross-state puzzle;
- day/night location;
- shop/economy;
- training/practice;
- chapter/day transition;
- failure/outcome screen.

Scene Director should eventually select authoring overlays and validation from the archetype rather than showing every tool for every scene.

### Whole-game capability

Answers **what persistent engine/world grammar the complete game requires**.

Examples:

- walk regions, perspective, priority and occlusion;
- inventory and item combinations;
- facts/topics/research;
- chapter/day progression;
- branching route topology;
- multiple playable characters;
- time-of-day and NPC schedules;
- stats/classes/skills/resources;
- combat;
- travel/vehicle/action modes;
- deterministic saves/replays;
- full-game evidence.

A capability is not considered proofed because it could theoretically be represented with generic story flags. It should have a first-class contract, authoring workflow, deterministic runtime behavior and a representative stress proof.

## Why the engine families differ

### Sierra SCI

The SCI production model strongly separates visible scene art from priority/control behavior. Adventure Studio's Scene Director WALK / CONTROL / DEPTH / OCCLUSION model is therefore a useful common foundation.

For King's Quest V-like work the remaining pressure is mostly scene breadth: scrolling/wide painterly exteriors, multi-level interiors, larger connected journeys, creature choreography and robust inventory/failure progression.

For Leisure Suit Larry-like work the same core room system must support dense social interactions, comedy timing, score, conditional dialogue and failure/recovery without turning every scene into a later investigation interface.

### Sierra investigation

Gabriel Knight requires substantially more than a Gothic visual profile. The engine needs first-class:

- discovered facts;
- ask/tell topics;
- topic provenance/exhaustion;
- research sources;
- required and optional chapter/day actions;
- deterministic day transition/migration;
- revisited room/NPC state.

A generic flag + dialogue condition can mimic one interaction, but it is not enough to author, inspect and validate an entire investigation graph.

### Sierra RPG/adventure

Quest for Glory requires a real simulation layer integrated with the adventure game:

- stats;
- skills that improve through use/practice;
- classes/backgrounds;
- class/skill-specific puzzle alternatives;
- health/stamina/mana;
- equipment/money;
- world time;
- NPC schedules;
- day/night room variants;
- combat;
- character import/export.

These should not be implemented as a giant pile of bespoke flags in individual rooms.

### LucasArts SCUMM5

The SCUMM-family pressure is not merely visual. The authoring grammar should support:

- walk boxes and per-region scale;
- multiple Z/occlusion planes;
- verb + object + optional secondary-object sentences;
- inventory combinations;
- strongly room-local scripts;
- object state images/scripts;
- cutaways that suspend/resume room logic;
- long synchronized comedy/cinematic choreography.

Day of the Tentacle adds multi-protagonist/world-state coupling: different playable characters, locations and inventories must remain independent while deliberate cross-time effects mutate shared world state.

Fate of Atlantis adds true route topology. Team/Wits/Fists-style progression cannot be represented honestly as a few alternate dialogue responses; major acts have different puzzle/action content and later reconverge.

### Dynamix DGDS

Heart of China and Rise of the Dragon put more pressure on branching/cinematic composition and specialized modes:

- major branching story consequences;
- multiple playable characters where required;
- travel/location interludes;
- vehicles;
- close-up/inset compositions;
- hard editorial cuts and held frames;
- timed/action/minigame inserts;
- deterministic return from specialized modes to adventure state.

Do not force these into a normal room renderer with giant conditional scripts.

## Specialized mode boundary

Combat, driving, travel maps, action inserts and complex puzzle close-ups should use a common deterministic mode boundary.

Every specialized mode should implement the equivalent of:

1. **enter** — receive canonical world state, story tick and authored payload;
2. **input** — accept an explicit mode-specific input grammar;
3. **tick** — advance on logical fixed ticks, never render delta time;
4. **render** — emit native render-contract output or a documented renderer extension;
5. **save** — serialize all mode state according to an explicit save/checkpoint policy;
6. **outcome** — emit success/failure/story actions through the normal world action path;
7. **return** — resume the adventure scene or request a canonical scene transition;
8. **replay** — record inputs/outcome using the same deterministic replay system.

A specialized mode must not create a second unsynchronized story state.

## Reference stress suites

### King's Quest V

Require at minimum:

- wide painterly exterior traversal;
- dense interior with inventory/object puzzle;
- creature/NPC choreography;
- dangerous failure/retry scene;
- multi-room journey continuity;
- raw 1× storybook VGA review.

### Gabriel Knight: Sins of the Fathers

Require at minimum:

- dense investigation interior;
- portrait/topic conversation;
- research source unlocking facts/topics/destinations;
- required + optional day action graph;
- day transition that changes revisited rooms/NPCs;
- danger/failure state.

### Quest for Glory VGA

Require at minimum:

- icon-interface adventure room;
- time-driven town hub/NPC schedule;
- fighter/magic/thief solutions to one obstacle;
- practice/training progression;
- health/stamina/resource loop;
- combat arena;
- shop/equipment/money;
- character export/import round trip.

Earlier parser-era Sierra variants are a separate interaction dialect and should not be accidentally attached to the VGA requirement set.

### Day of the Tentacle

Require at minimum:

- SCUMM sentence/interface room;
- wide room with walk boxes/per-region scale/Z masks;
- item-on-item and item-on-object chain;
- room cutaway/comedy sequence;
- three playable character/world states;
- cross-time item/world consequence;
- save/replay across character switching.

### Leisure Suit Larry VGA

Require at minimum:

- SCI icon social interior;
- branching/conditional conversation;
- small practical inventory interactions;
- score;
- timed/comedic danger;
- period failure/recovery;
- returning venue with changed social/object state.

### Heart of China

Require at minimum:

- branching plot consequence;
- playable-character switching;
- travel map/interlude;
- radically different location compositions;
- cinematic inset/close-up;
- vehicle/action insert;
- alternate route/failure evidence.

### Rise of the Dragon

Require at minimum:

- dark dense city room;
- hard cinematic inset/cut;
- timed event changing later topology;
- branching conversation consequence;
- vehicle/action sequence;
- failure/retry and changed downstream room state.

### Indiana Jones and the Fate of Atlantis

Require at minimum:

- SCUMM5 sentence/object room;
- inventory combination chain;
- travel map with discovered destinations;
- major alternate route topology;
- social/puzzle/action solution variation;
- fight/action insert returning to shared story state;
- branch reconvergence evidence.

## Current Adventure Studio position

Strong/proofed foundations already include:

- fixed native rooms;
- walk geometry;
- staged perspective;
- multi-plane occlusion;
- stateful navigation;
- approach slots and body-clearance checks;
- exact/state-specific hotspots;
- icon/context interaction;
- inventory/item-on-object;
- score and lifecycle outcomes;
- in-scene dialogue;
- deterministic interaction/entry/cutscene choreography;
- deterministic saves/replays;
- surface/audio staging;
- indexed palette lighting including Bayer transitions;
- native Period VGA audit;
- multi-document Scene Director authoring.

Important capability gaps remain:

- first-class scrolling camera authoring/proofs;
- stair/elevation transitions;
- topic/fact/research system;
- chapter/day migration;
- SCUMM sentence grammar and strongly room-local script hooks;
- item-on-item production proof;
- multi-protagonist state;
- explicit large branch/reconvergence graph;
- QFG stats/classes/skills/resources/time/NPC schedules/combat/import-export;
- generic specialized travel/vehicle/action mode runtime boundary;
- full-game route/archetype evidence harness.

## Upgrade order

The cross-family implementation roadmap lives in `@evavo/adventure-design/full-game-upgrade-plan`.

The intended order emphasizes reusable leverage:

1. scene camera / scrolling / elevation;
2. investigation knowledge / day progression;
3. SCUMM sentence + room/object script grammar;
4. multi-protagonist world state;
5. Quest for Glory simulation kernel;
6. DGDS cinematic/travel/action mode framework;
7. whole-game branch orchestration;
8. full-game proof harness.

Some work can proceed in parallel, but the final proof harness must consume all specialized systems rather than inventing separate evidence logic per title.

## Release rule

A production profile may say “inspired by” a historical family before all whole-game capabilities are complete.

It must not say **full-game ready for that family** until:

- every required capability is `proofed`;
- every required scene archetype has a retained native proof;
- success/failure/alternate routes have deterministic replay evidence;
- all specialized modes save/restore/return correctly;
- the whole-game progression graph has no required unreachable/deadlocked state;
- raw 1× and integer-scale visual evidence passes the family's production rules.

This keeps Adventure Studio ambitious without making unsupported compatibility claims.
