# Classic Game Creator

## Purpose

The Classic Game Creator turns Adventure Studio's production profiles and native
showcase plates into editable game blueprints. It is not a generic pixel-art
filter and it is not a collection of copied commercial scenes.

The first creator release focuses on three materially different production
languages:

- **The Glass Finch** — original storybook fantasy with a temporary icon bar;
- **The Red Ledger** — original gothic investigation with portraits and topics;
- **Saltwake Island** — original object comedy with a persistent verb panel.

Each project remains an original game. Historical games are studied only for
production grammar: native composition, interface architecture, puzzle rhythm,
character staging, timing and feedback.

## Historical production study

### Storybook icon adventure

The storybook family studies the early VGA Sierra approach represented by
*King's Quest V*:

- painted 320 by 200 rooms composed as complete illustrations;
- clean lower-third routes for the player character;
- strong value separation between actor, clue and exit;
- a temporary icon bar rather than permanent bottom-screen chrome;
- short narrator or portrait exchanges that preserve the room tableau;
- environmental cause and effect expressed through visible world changes.

The Glass Finch uses a bell keeper, crystal bird, seasonal valley and physical
route map created specifically for EVAVO Adventure Studio. No character,
location, interface artwork, dialogue or puzzle from an existing game is used.

### Gothic investigation

The investigation family studies the production language associated with
*Gabriel Knight: Sins of the Fathers*:

- dense but navigable interiors with practical pools of light;
- restrained colour with one meaningful evidence accent;
- grounded protagonist staging rather than exaggerated fantasy poses;
- bottom narration that leaves the room visible;
- two-character portrait conversations with evidence-driven topic lists;
- chapter state that changes locations, witnesses and available questions;
- research puzzles that require connecting physical evidence and testimony.

The Red Ledger uses an original municipal archivist, harbour city, impossible
debt, night clerk, chapel registry and contradiction ledger. The topic system
models investigation structure without copying any commercial dialogue tree,
portrait or mystery.

### Persistent verb-panel comedy

The verb-panel family studies the interaction architecture associated with
*The Secret of Monkey Island*:

- a persistent command grid and visible inventory;
- an exact sentence line that previews player intent;
- compact actor silhouettes above the interface boundary;
- readable props and exits despite reduced gameplay height;
- authored wrong-action responses;
- recoverable inventory chains rather than silent dead ends;
- reaction poses that deliver comedy before and after dialogue lines.

Saltwake Island uses an original lighthouse apprentice, civic vote, harbour
master, obsolete permit, office stamp and tide chart. It does not reproduce any
existing pirate, island, joke, inventory item or puzzle chain.

## Canonical creator contract

The public package entry point is:

```ts
@evavo/adventure-design/classic-game-creator
```

A creator project contains:

- one production family and compatible production profile;
- a 320 by 200 native canvas and controlled palette budget;
- family-specific interface geometry;
- title, gameplay, dialogue and system construction scenes;
- editable actors, props, focal point, horizon and walk lane;
- ordered art layers and native review proofs;
- causal puzzle steps, visible results and concrete recovery;
- dialogue modes, topics and state changes;
- logical-tick timing for input, movement, actions, text and transitions;
- an explicit original-content boundary.

The initial presets are derived from the existing production-profile and
production-showcase catalogues. This keeps the profile, showcase and creator
from drifting into independent descriptions of the same game family.

## Scene editor

The Studio route is:

```text
/?workspace=creator
```

The Scene surface provides:

- a one-times native 320 by 200 construction frame;
- the active gameplay viewport and interface exclusion zone;
- horizon and walk-lane overlays;
- selectable actors and props;
- one-pixel keyboard nudging;
- eight-pixel Shift plus arrow nudging;
- native X and Y controls;
- scene naming;
- independent scene variants;
- reference-safe scene removal;
- native review evidence beside the frame.

Actor and prop changes use immutable commands. A malformed edit remains visible
through the creator audit rather than being silently clamped into a plausible
but unintended result.

## Interface editor

The Interface surface renders the selected production family's actual screen
claim:

### Temporary icon bar

- full-height room composition;
- temporary top overlay;
- at least six symbolic actions;
- no persistent reduction of gameplay space.

### Portrait topic ledger

- two portrait anchors;
- evidence-led topic rows;
- bottom narration outside modal interviews;
- no hidden hotspot or checklist treatment.

### Persistent verb panel

- 52 to 72 native pixels of permanent chrome;
- a sentence line;
- nine command verbs;
- visible inventory slots;
- gameplay and dialogue geometry transformed into the reduced viewport;
- title and full-screen system plates preserved at the complete native height.

Changing persistent chrome recomputes only scenes that actually use persistent
chrome. Full-screen title and system compositions do not shrink accidentally.

## Puzzle and dialogue editor

The Puzzles surface presents causal steps rather than an unstructured task
list. Each puzzle must provide:

- a stable setup scene;
- a stable resolution scene;
- visible required props;
- at least three ordered causal steps;
- a world-state result;
- a concrete recovery route;
- no irreversible failure state.

The dialogue model distinguishes:

- short storybook exchanges;
- portrait-led investigation topics;
- in-scene comic choices.

The investigation preset requires at least five evidence-driven topics. Topics
should unlock from discoveries and testimony rather than arbitrary chapter
progress.

## Timing editor

All timing is authored against a 60-tick logical clock. The creator exposes:

- pointer acknowledgement;
- hover commitment;
- movement anticipation;
- turn pose;
- action anticipation and recovery;
- wrong-action feedback hold;
- minimum dialogue or narration hold;
- fade out, dark hold and fade in.

These values control the deliberate feel of each family. Monitor refresh rate
must not alter them.

## History and safe editing

Every edit runs through a typed immutable command. The history service provides:

- deterministic canonical JSON;
- FNV-1a 64-bit fingerprints;
- bounded undo and redo;
- save markers and dirty-state detection;
- independent IDs for duplicated scene variants;
- protected deletion for puzzle, dialogue and required-scene references.

A removal that would break a puzzle, dialogue or the final required scene kind
throws a typed reference error and leaves the project unchanged.

## Validation

The creator audit checks:

- family, profile and showcase compatibility;
- exact native dimensions;
- palette budget and unique anchors;
- globally unique IDs;
- title, gameplay, dialogue and system coverage;
- native focal, horizon, walk-lane, actor and prop geometry;
- family-specific interface rules;
- bounded timing values;
- visible puzzle props and scene references;
- complete recoverability;
- dialogue scene references and investigation topic depth;
- an explicit original-content statement.

A project is `ready` only when it has no errors or warnings. The score is an
editorial signal, not proof that final art, acting, music or puzzle enjoyment is
complete. Native-size human review and deterministic playtesting remain
required.
