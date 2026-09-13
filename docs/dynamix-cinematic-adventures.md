# Dynamix DGDS cinematic adventures

## Purpose

Adventure Studio treats Dynamix DGDS as a separate cinematic-adventure dialect. It is not a Sierra
SCI skin and it is not a generic cyberpunk preset.

The first title-specific study lanes are:

- *Heart of China*, represented by the original EVAVO proof **Jade Horizon**;
- *Rise of the Dragon*, represented by the original EVAVO proof **Dead Channel**.

Both references share a DGDS foundation but require different game-design and timing systems.

## Shared DGDS production grammar

The reusable technical baseline is:

```text
Native canvas          320 × 200
Display intent         DOS-style 4:3
Palette                indexed 8-bit, maximum 256 colours
Presentation scaling   integer only
Texture sampling       nearest neighbour
Sprite transparency    binary
Logical simulation     60 ticks per second
Scene construction     native-first
```

Authenticity comes from full-screen composition, hard editorial cuts, economical actor animation,
held portraits, tactile interface panels, explicit route and relationship consequences, and action
inserts that remain connected to canonical adventure state.

It does not come from a generic pixel filter, neon gradients, bloom, motion blur or low frame rate
alone.

## Heart of China lane

The Heart of China reference pack requires:

- full-screen cinematic panels;
- multiple playable protagonists;
- separate protagonist knowledge and inventory;
- relationship state;
- route and conversation time costs;
- authored travel montages;
- route-dependent later scenes;
- bounded vehicle or combat inserts;
- readable input telegraphs;
- safe action retry;
- deterministic save and replay closure.

**Jade Horizon** is the original proof language. It follows a debt courier and a disgraced pilot
through route choices whose time, trust and fatigue costs alter later scenes.

The clock is costed rather than continuously advanced. Travel, dialogue, investigation and action
declare their time cost explicitly.

## Rise of the Dragon lane

The Rise of the Dragon reference pack requires:

- a visible case clock;
- one game minute per 300 logical ticks;
- scheduled contacts and location windows;
- travel, dialogue, evidence and action costs on the same clock;
- deadline-driven outcomes;
- evidence-gated dialogue and access;
- contact trust and cooperation;
- first-person action or escape inserts;
- telegraphed input windows;
- safe action retry that preserves clock and evidence;
- deterministic save and replay closure.

**Dead Channel** is the original proof language. An investigator follows a repeating signal through
an apartment, transit office, night market and service tower while every delay changes witness and
location availability.

The 300-tick clock ratio encodes the measured DGDS behaviour that five game minutes correspond to
25 seconds of continuous play. Rendering cadence never changes the result.

## Cinematic action sequences

Action inserts are authored as deterministic sequences:

```text
safe anchor
→ telegraph
→ bounded input window
→ committed pose
→ consequence
→ recovery or terminal result
```

Every sequence declares:

- a stable sequence ID;
- location and action kind;
- duration in logical ticks;
- a named safe anchor;
- non-overlapping input windows;
- required input per window;
- visual or audio telegraph;
- success and failure flags;
- relationship changes;
- explicit time cost;
- success and failure consequences.

Failure does not erase investigation, route, relationship or clock state. Retry restores the named
pre-action anchor and re-enters the same deterministic sequence.

## Art and animation

Backgrounds are authored for 320 × 200 from the beginning. A larger direction master may guide
architecture, costume and light, but it is not final game art.

The mastering contract requires:

- five to seven large value groups before detail;
- deliberate room and interface palette reservations;
- material-specific dithering;
- crisp pixel clusters;
- binary actor and object edges;
- strong face, hand and prop readability;
- native and DOS-aspect review;
- original interface and publisher art.

Animation uses selected poses and authored holds:

- six to ten walk frames;
- explicit start, turn and stop poses;
- two to four portrait expression frames;
- discrete object-use frames;
- anticipation, commitment, impact and recovery for action inserts;
- hard cuts and palette steps instead of smooth interpolation.

## Studio workspace

Open:

```text
/?workspace=dynamix
```

The DGDS Cinematic Systems Lab allows the operator to:

- select Jade Horizon or Dead Channel;
- inspect the exact visual and timing contract;
- advance the route or case clock;
- switch protagonists;
- choose relationship and evidence branches;
- travel through currently valid routes;
- start and drive a cinematic action sequence;
- fail and retry from the safe anchor;
- inspect flags, route history, relationships and terminal outcomes.

## Reference and redistribution boundary

Commercial titles are behavioural reference targets only. Distributed Adventure Studio data may
contain engine measurements, timing ranges, capability contracts and references to private traces
created from a legitimately owned installation.

It must not distribute commercial art, screenshots, sprites, portraits, music, speech, dialogue,
scripts, maps, characters, logos, room layouts or puzzle solutions.

ScummVM can be used privately as an independent behavioural oracle. Adventure Studio does not copy
its implementation or commercial game data.
