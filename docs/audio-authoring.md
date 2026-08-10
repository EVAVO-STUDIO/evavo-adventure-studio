# Deterministic audio authoring

## Purpose

Adventure Studio treats audio as authored game data, not as incidental browser playback. Music, ambience, room tone, dialogue recordings, interface sounds and effects are described in one project-scoped `AudioMixManifest`, validated against the canonical project and compiled asset evidence, embedded in the runtime bundle and executed from deterministic game state.

The Studio workspace is available at:

```text
http://localhost:5174/?workspace=audio
```

The canonical packages are:

- `@evavo/adventure-audio` for schemas, semantic validation and deterministic runtime state;
- `@evavo/adventure-audio-editor-core` for serializable edits, inverse commands, undo and redo;
- `@evavo/adventure-audio-controller` for connecting scene, dialogue and sequence state to audio commands;
- `@evavo/adventure-audio-web` for the browser Web Audio adapter.

The core audio packages never depend on React, PixiJS or browser timing.

## Audio mix document

`AudioMixManifest` is a versioned sidecar with:

- the project ID and logical tick rate;
- the master, music, speech, ambience, effects and interface buses;
- deterministic bus volume, mute, voice limits and voice-stealing policy;
- reusable cues that reference canonical audio assets;
- loop ranges, crossfades, fades, offsets, priorities and polyphony;
- scene soundscapes made from music, ambience and room-tone layers;
- speech bindings that connect dialogue-line IDs to recorded cues;
- tick-based mouth, phoneme or performance markers;
- bus-ducking relationships with attack and release timing.

The sidecar remains an authoring document. A validated, canonically ordered copy is embedded in the source-free runtime bundle because packaged playback needs the exact cue and mix policy.

## Why timing uses logical ticks

Story state, dialogue, cutscenes, saves and replays use the project logical clock. Audio authoring therefore expresses fades, delays, speech markers and ducking envelopes in the same logical ticks.

The Web Audio adapter translates deterministic commands into device time only at the final output boundary. Browser scheduling cannot change story outcomes, cue ordering, save data or replay fingerprints.

Audio source offsets and loop boundaries use milliseconds because they address locations inside an encoded recording. Game sequencing around those recordings still uses logical ticks.

## Runtime buses

Every mix requires these buses:

- `master`;
- `music`;
- `speech`;
- `ambience`;
- `effects`;
- `interface`.

Each bus declares:

- volume from zero to one;
- muted state;
- maximum simultaneous voices;
- deterministic voice-stealing policy: oldest, quietest or lowest priority.

Voice limits prevent an adventure scene from accumulating unbounded rain, footsteps, interface clicks or overlapping dialogue. A stolen voice is selected from canonical runtime data, not from nondeterministic browser enumeration order.

## Audio cues

A cue is the reusable playback contract for one audio asset. It contains:

- stable cue ID and display name;
- canonical audio asset ID;
- content bus;
- base volume and source offset;
- fade-in and fade-out ticks;
- optional loop start, end and crossfade milliseconds;
- overlap, restart or ignore polyphony;
- maximum simultaneous instances;
- priority;
- optional interrupt group.

Speech cues cannot loop. Restart and ignore policies normally use one instance. Loop crossfades cannot consume more than the loop region. These are blocking semantic rules rather than Studio-only hints.

## Scene soundscapes

A soundscape belongs to one canonical scene. It contains ordered layers with:

- stable layer ID;
- music, ambience or room-tone role;
- compatible cue ID;
- optional story-state condition;
- start delay;
- fade-in and fade-out ticks;
- restart, resume or continue re-entry policy.

Music layers must reference music cues. Ambience and room-tone layers must reference ambience cues. Scene entry is resolved from deterministic runtime state, so conditional layers behave consistently after saving, loading and replaying.

The Audio Studio lets an author create silent scenes deliberately, add and remove layers, change their roles and cues, and tune entry and exit behavior without editing JSON by hand.

## Speech bindings

Speech bindings connect recorded dialogue to canonical narrative content rather than to displayed text. Each binding contains:

- stable binding ID;
- dialogue-line ID;
- speech cue ID;
- lead-in and tail ticks;
- ordered performance markers.

Binding by dialogue-line ID makes localization and text revision possible without breaking the recording relationship. Marker names are project-defined and can drive mouth poses, phonemes, portrait animation, gestures or subtitle emphasis. Marker ticks must remain ordered.

The current runtime selects the bound cue when a dialogue node becomes active. The same binding data is preserved through save restoration and deterministic replay.

## Ducking

Ducking rules protect intelligibility by reducing one content bus while another is active. A rule declares:

- source bus;
- target bus;
- target volume;
- attack ticks;
- release ticks.

A bus cannot duck itself. Common policies include speech reducing music and ambience, or a cinematic effect temporarily reducing room tone.

## Serializable editing

`@evavo/adventure-audio-editor-core` represents every change as a discriminated command. Supported operations include:

- replace the complete mix;
- replace a bus;
- insert, remove or replace cues;
- insert, remove or replace ducking rules;
- insert, remove or replace soundscapes;
- insert, remove or replace soundscape layers;
- insert, remove or replace speech bindings;
- execute an atomic command batch.

Every successful command produces an exact inverse command. Undo and redo therefore exercise the same validation path as normal editing.

Validation occurs after an entire batch, not after each child command. This permits safe atomic migrations such as replacing a cue and updating every soundscape or speech reference in the same operation. A dangling intermediate reference never becomes observable project state.

The editor rejects:

- missing or duplicate stable IDs;
- identity changes during replace operations;
- deletion of referenced cues;
- out-of-range indices;
- invalid bus, cue, soundscape or speech relationships;
- any structurally invalid manifest.

Warnings do not block editing, but semantic errors do.

## Audio Studio workspace

The React workspace is presentation only. Its state reducer wraps the audio editor history and owns:

- current cue, scene, speech-binding and ducking-rule selection;
- recoverable notices for rejected edits;
- dirty, undo and redo state;
- JSON export.

The visual workspace currently provides:

- six-bus mixer strips;
- volume, mute, voice limit and steal-policy controls;
- cue library and cue inspector;
- loop, offset, fade, priority, polyphony and interrupt-group editing;
- scene soundscape authoring;
- speech-line and recorded-cue binding;
- performance-marker editing;
- ducking-rule authoring;
- selected and whole-document diagnostics.

The checked-in Studio fixture demonstrates a noir office and alley with looping score, rain, room tone, thunder, spoken dialogue, interface feedback and speech ducking.

## Compilation and CLI

Validate an audio sidecar before compilation:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --audio-mix .\game\audio-mix.json `
  --json
```

Compile it into a runtime bundle:

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --audio-mix .\game\audio-mix.json `
  --out .\game\build\game.bundle.json
```

The validator checks:

- exact project and tick-rate identity;
- required buses and unique IDs;
- audio asset existence and kind;
- loop, crossfade and polyphony rules;
- soundscape scene, cue and bus compatibility;
- dialogue-line and speech-cue bindings;
- ordered speech markers;
- sequence audio asset and bus compatibility;
- compiled audio metadata when an asset manifest is supplied.

The authoring sidecar is not copied into a release. Its validated canonical data lives inside `game.bundle.json`; encoded audio files are copied only from verified runtime outputs.

## Browser playback

`@evavo/adventure-audio-controller` observes deterministic runtime transitions and emits commands for:

- entering a scene soundscape;
- starting bound speech;
- reaching sequence sound and stop-audio cues;
- advancing fades and ducking;
- completing voices;
- restoring saved audio state.

`@evavo/adventure-audio-web` then:

- plans portable runtime asset URLs;
- preloads and decodes verified audio outputs;
- waits for a user gesture when browser autoplay policy requires it;
- schedules start, stop, fade and bus-gain commands;
- reports completed voices back to deterministic state;
- resets cleanly after save restoration;
- disposes browser resources on page exit.

A platform-specific adapter may replace Web Audio without changing the project, runtime bundle or editor documents.

## Save and replay behavior

Active audio state is stored with the packaged runtime save. On restoration, currently playing output is stopped and reconstructed from canonical voice state. Scene ambience, music offsets, fades and dialogue speech therefore resume from deterministic data rather than from whatever the browser happened to be playing.

Replay execution remains renderer-free. It reproduces audio runtime state and command ordering even when no speakers or Web Audio device are present. Browser playback is an output effect, never replay authority.

## Verification

The canonical editor expansion gate includes:

- audio schema and semantic tests;
- audio editor command/history tests;
- audio runtime orchestration tests;
- Web Audio scheduling and autoplay-recovery tests;
- compiler and runtime-bundle audio tests;
- save-game audio persistence tests;
- Player and Audio Studio tests;
- Studio, Player and CLI builds.

Run the full installed-workspace gate with:

```powershell
pnpm run check:editor-expansion
```

A build or test result must not be described as successful until that command or the governed exact-SHA workflow completes with evidence.
