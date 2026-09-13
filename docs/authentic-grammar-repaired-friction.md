# Authentic grammar, repaired friction

Adventure Studio's reference examples are not reproductions of commercial games. They are original games designed to prove that the engine, authoring tools and production pipeline can sustain comparable **engine grammar, visual pressure, interaction structure and whole-game complexity**.

## What “clone example” means

A clone example may deliberately target the production pressure of a reference title or engine family:

- native resolution and aspect;
- palette and value-group discipline;
- interface grammar;
- movement, depth and occlusion behavior;
- dialogue presentation;
- puzzle and progression structure;
- save/failure conventions;
- cinematic timing;
- scene archetypes and whole-game systems.

It must **not** reproduce proprietary rooms, characters, dialogue, jokes, story beats, artwork, logos, puzzle solutions, music, recorded speech or other creative expression.

The proof is successful when a knowledgeable player can say “this behaves and reads like a professionally authored game from that production family” while the actual game remains unmistakably original.

## Historical fidelity and modern-retro benchmarks are different

Historical fidelity lanes target a particular period engine/release grammar and require retained evidence against that era.

Examples:

- **Open Case** — late Sierra procedural investigation under Police Quest IV pressure;
- **After Hours** — SCI1 VGA social comedy under Leisure Suit Larry VGA pressure.

A modern-retro benchmark is different. It may learn from later low-resolution adventure games while retaining Adventure Studio's authored-pixel discipline, but it must not be represented as 1990s historical fidelity.

- **Cold Meridian** — modern-retro low-resolution noir benchmark, informed by the clarity, atmosphere and pacing pressure of games such as *Gemini Rue*, while using original characters, setting, plot, interfaces and assets.

## Preserve the game grammar

Quality-of-life improvement must not erase the source grammar.

Keep:

- raw native-resolution composition;
- period cursor/verb/icon/context conventions appropriate to the lane;
- authored score and narration where relevant;
- deliberate animation holds and comic/dramatic timing;
- evidence, inventory and dialogue as physical/world state rather than modern objective UI;
- failure and consequence;
- route and social consequences;
- sparse room tone and period-appropriate presentation;
- deterministic fixed-tick behavior.

Do not “improve” authenticity away by adding:

- quest markers;
- objective checklists;
- relationship/approval meters;
- hotspot glow/outline overlays;
- bloom or modern HDR lighting;
- chromatic aberration, VHS or scanline filters;
- omniscient hint arrows;
- solution highlighting;
- generic card-grid inventory;
- modern mission HUDs.

## Repair friction, not identity

Adventure Studio should preserve consequences while removing friction that tests cursor precision, foreknowledge or patience instead of understanding.

### Pixel hunting

Keep a tiny object tiny. Add an invisible authored click-comfort region and correct cursor feedback. Never enlarge or glow the visible prop merely to make acquisition easier.

### Hidden unwinnable states

A consequential mistake may close a route, but a silent unwinnable state is not desirable. Use progression analysis and author one of:

- a credible recovery;
- an alternate route;
- an explicit terminal outcome with retry/load/restart.

### Opaque failure

Keep the failure, joke or procedural consequence. Explain the fictional/professional reason through narration, animation, props, notes or character reaction rather than a generic error message.

### Retry friction

A failed action should not force the player to repeat solved setup merely because an old engine lacked convenient state capture. Use deterministic pre-action retry checkpoints and save-safe boundaries while leaving manual saves untouched.

### Repeated busywork

Once the game has semantically established that the player knows a fact or completed a one-shot process, persist that knowledge. Require repetition only if the fiction changed.

### Obscure single solutions

Where the fiction supports several sensible solutions, author several. Where only one can work, give specific feedback that demonstrates the world rule rather than silently rejecting a reasonable attempt.

### Timed sequences

Separate reading/recognition time from challenge time. Keep deterministic timing pressure, but do not make text comprehension itself the reflex test.

## Lane-specific application

### Open Case — late Sierra procedural investigation

Preserve:

- grounded police/investigative spaces;
- evidence boundaries and custody;
- procedural order;
- case state;
- interrogation constrained by lawful evidence and prior testimony;
- restrained score/failure feedback.

Repair:

- arbitrary procedural memorisation;
- case-state corruption from an unrelated mistake;
- unexplained failure;
- pixel hunting for evidence;
- long replay corridors after a handling error.

Never turn the caseboard into a modern quest tracker or interrogation into a credibility meter.

### After Hours — Sierra VGA social comedy

Preserve:

- temporary SCI1 icon interaction;
- visible score;
- inventory and conversation working together;
- authored awkward pauses/reaction holds;
- social memory and venue-access consequences;
- comic rejection/embarrassment.

Repair:

- a single ambiguous line permanently destroying the route;
- unreadably short timed joke windows;
- arbitrary one-answer dialogue guessing;
- repeated setup after a comic failure.

Never add relationship bars, approval meters or best-answer highlighting.

### Cold Meridian — modern-retro low-resolution noir

Preserve:

- authored low-resolution pixel composition;
- narrow palette and negative space;
- minimal context interaction;
- separate protagonist knowledge;
- communicator/research state;
- hard cuts and short bounded action inserts;
- room tone, rain and silence as atmosphere.

Repair:

- tiny interaction ambiguity through invisible comfort regions;
- long no-save action corridors;
- opaque late-arrival/failure states;
- single arbitrary inference paths where several deductions are plausible.

Never use bloom, chromatic aberration, scanlines or VHS filters to manufacture “retro” atmosphere.

## Completion evidence

A profile card or production plate is not a complete proof.

Each proof lane must ultimately retain:

- raw 1× native screenshots;
- integer-scale screenshots;
- deterministic save/restore evidence;
- success replay;
- representative failure/recovery replay;
- required scene-archetype coverage;
- interaction and progression evidence;
- final art/audio review;
- packaged Runtime Bundle evidence.

Historical lanes additionally require review against the target release/engine production grammar. Modern-retro benchmarks require explicit labeling as benchmarks rather than historical fidelity.
