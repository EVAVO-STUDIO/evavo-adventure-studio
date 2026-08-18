# Reference fidelity packs

Adventure Studio separates original production profiles from title-specific reference fidelity packs.

Production profiles describe reusable visual and interaction families without commercial title names or content. Reference fidelity packs describe the exact engine, release variant, subsystem and evidence contracts required to reproduce a historical title's technical grammar.

## Included title packs

The first catalogue contains:

- King's Quest V over the Sierra SCI1 VGA dialect;
- Quest for Glory IV over the Sierra SCI32 VGA dialect;
- Gabriel Knight: Sins of the Fathers over the Sierra SCI32 VGA dialect;
- Police Quest IV over the Sierra SCI32 VGA dialect;
- Indiana Jones and the Fate of Atlantis over the LucasArts SCUMM5 VGA dialect;
- Heart of China over the Dynamix DGDS VGA dialect;
- Rise of the Dragon over the Dynamix DGDS VGA dialect.

Every title pack keeps floppy and CD variants explicit. Variant-specific speech, audio, timing, interpreter and interface differences must be proved independently rather than hidden inside one generic title preset.

## Contract structure

A reference pack binds:

1. one engine dialect;
2. one visual production-profile baseline;
3. explicit release variants;
4. required capabilities grouped by presentation, input, world, narrative, system, audio and title-specific subsystems;
5. executable state/action scenarios;
6. an original EVAVO playable proof;
7. a redistribution boundary.

Capabilities are not considered complete merely because a type or UI control exists. Each capability declares accepted evidence kinds and a minimum retained-evidence count. Critical implementation or evidence gaps block fidelity admission.

## Separate title grammars

The SCI32 title packs deliberately remain separate:

- Quest for Glory IV requires attributes, skill checks, classes, resources, schedules, combat, encounter travel and character transfer.
- Gabriel Knight requires chapter state, topic dialogue, evidence research, portraits, close-ups and investigation gating.
- Police Quest IV requires procedure checks, evidence handling, case state, interrogation, procedural failure and location progression.

They may currently share a visual baseline, but they do not share one runtime capability graph.

Fate of Atlantis separately requires persistent verbs, sentence construction, alternate routes, companion state, travel, alternative puzzle solutions, action sequences and route-dependent world state.

Heart of China separately requires protagonist switching, relationship state, costed routes, editorial travel montages, knowledge separation and recoverable action inserts.

Rise of the Dragon separately requires a visible case clock, scheduled contact windows, time-costed actions, deadline outcomes and safe action retry.

King's Quest V separately requires the temporary icon bar, narration, visible score, death/restart flow and illustrated room-state change.

## Original playable proofs

Reference titles are measurement targets. Distributed examples remain original:

| Reference grammar | Original EVAVO proof | State |
| --- | --- | --- |
| King's Quest V | The Glass Finch | available construction proof |
| Quest for Glory IV | The Hollow Vale | planned dedicated RPG proof |
| Gabriel Knight | The Red Ledger | available playable investigation proof |
| Police Quest IV | Open Case | planned dedicated procedure proof |
| Fate of Atlantis | The Sunken Dial | available construction proof |
| Heart of China | Jade Horizon | planned packaged cinematic proof |
| Rise of the Dragon | Dead Channel | planned packaged clock-driven proof |

A planned proof must not be reported as a finished playable game. An available construction proof must not be reported as full title fidelity until its exact implementation and retained evidence pass the audit contract.

## Redistribution boundary

Reference packs may contain engine measurements, timing ranges, capability contracts and private trace references created from legitimately owned local installations.

They must not distribute commercial art, sprites, portraits, screenshots, interface artwork, music, speech, sound effects, dialogue, scripts, text, maps, characters, logos, room layouts, scene reproductions or puzzle solutions.

ScummVM or another legitimate reference executable may be used privately as an independent behavioural oracle. Its implementation and commercial game data are not copied into Adventure Studio.

## Compatibility Lab

Open the Studio workspace at:

```text
/?workspace=compatibility
```

The lab shows title packs, release variants, engine dialects, critical capabilities, evidence burdens, executable scenarios and original proof boundaries.

It intentionally shows **contract ready, evidence not attached** until a real implementation run supplies retained evidence. It does not invent a fidelity percentage from documentation or screenshots alone.


See [Dynamix DGDS cinematic adventures](dynamix-cinematic-adventures.md) for the shared runtime, timing, action and art contract.
