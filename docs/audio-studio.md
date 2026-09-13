# Audio Studio and deterministic sound production

## Purpose

Audio Studio authors the project-scoped `AudioMixManifest` consumed by the compiler, deterministic runtime controller and browser Web Audio adapter.

Open the workspace at:

```text
http://localhost:5174/?workspace=audio
```

The source mix is deliberately separate from imported sound files and from browser playback objects. It records creative intent and deterministic timing; compiled asset evidence proves which runtime files satisfy that intent.

## Canonical audio document

`@evavo/adventure-audio` defines one versioned sidecar containing:

- the project ID and logical tick rate;
- master, music, speech, ambience, effects and interface buses;
- per-bus volume, mute state, voice limit and stealing policy;
- ducking relationships;
- reusable audio cues;
- scene soundscapes;
- dialogue-line speech bindings;
- speech performance markers.

Audio Studio edits that document through `@evavo/adventure-audio-editor-core`. Every mutation is a serializable discriminated command with an exact inverse. Undo, redo, dirty-state comparison and automation therefore use the same service instead of duplicating editor-only logic.

## Mixer buses

The six required buses are:

| Bus | Intended content |
| --- | --- |
| `master` | final project output |
| `music` | score, stings and musical transitions |
| `speech` | recorded dialogue and voice performance |
| `ambience` | room tone, weather and environmental beds |
| `effects` | world actions, impacts and cinematic effects |
| `interface` | verbs, inventory, parser and menu feedback |

Each bus specifies:

- authored volume from `0` to `1`;
- mute state;
- maximum simultaneous voices;
- deterministic voice stealing by oldest, quietest or lowest priority.

Bus state is part of the runtime and save-game contract. Changes use logical ticks rather than wall-clock animation frames.

## Audio cues

A cue binds a canonical audio asset to playback policy:

- bus and authored volume;
- source start offset;
- fade-in and fade-out ticks;
- optional loop start, loop end and crossfade in milliseconds;
- overlap, restart or ignore polyphony;
- maximum instances;
- priority;
- optional interrupt group.

Loop points are authored against decoded source time but playback starts and fades are scheduled from the deterministic game tick. Speech cues cannot loop. Non-overlapping polyphony modes normally use one maximum instance.

Removing or replacing a referenced cue is rejected unless the operation is an atomic batch that also migrates its soundscape or speech callers. The document is validated after the complete batch, not after every intermediate child command.

## Scene soundscapes

Each scene may own one soundscape with ordered layers. A layer chooses:

- a music, ambience or room-tone role;
- one compatible cue;
- an optional gameplay condition;
- start delay;
- fade-in and fade-out duration;
- restart, resume or continue behaviour when the scene is re-entered.

Music layers require music-bus cues. Ambience and room-tone layers require ambience-bus cues. This prevents an apparently valid editor selection from producing a semantically incorrect runtime mix.

The layer order is preserved as authored. Stable IDs keep save restoration and automated edits independent of list position.

## Ducking and mix clarity

Ducking rules lower one content bus while another is active. A rule defines:

- source bus;
- target bus;
- target volume multiplier;
- attack ticks;
- release ticks.

The default mix lets speech reduce music and ambience without stopping either bed. A bus cannot duck itself. Runtime command generation recalculates the effective bus level deterministically as voices start and complete.

## Speech bindings and performance markers

A speech binding connects one dialogue line to one speech cue. It can also provide:

- lead-in ticks;
- tail ticks;
- ordered mouth, emphasis or gesture markers.

Markers are not audio timestamps hidden inside the browser. They are canonical logical-tick performance events that animation, portrait and cinematic systems can consume consistently across targets.

Only speech-bus cues may be bound to dialogue. Each line can have at most one binding in a mix.

## Cinematic and sequence audio

Sequence audio tracks remain in the canonical project document. `sound` cues identify an audio asset, bus, volume and loop request; `stop-audio` cues identify a bus and fade duration.

The audio-aware runtime controller observes deterministic sequence progress and translates reached sequence cues into the same audio runtime command stream used by soundscapes and speech. Skips, saves and restores therefore do not require a second cinematic audio implementation.

## Browser playback boundary

`@evavo/adventure-audio-web` is an adapter, not the owner of game state. It:

- preloads verified runtime audio outputs;
- unlocks the browser audio context after user interaction;
- applies play, stop and bus commands;
- maps tick fades to Web Audio ramps;
- reports completed voices back to the deterministic controller;
- resets playback after a save-game restore.

Browser autoplay policy and decoded buffers are host concerns. Cue selection, bus state, active voices, resume offsets and deterministic scheduling remain in renderer-independent packages.

## Validation

Audio validation covers:

- project and tick-rate identity;
- all required buses;
- duplicate buses, cues, ducking rules, soundscapes, layers and speech bindings;
- missing or non-audio source assets;
- unavailable buses;
- invalid loop ranges and crossfades;
- speech loops;
- scene and dialogue references;
- layer-role and cue-bus agreement;
- speech cue agreement;
- ordered speech markers;
- project sequence audio assets and buses;
- compiled audio-output mapping.

The CLI accepts the same sidecar:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --audio-mix .\game\audio-mix.json
```

Compilation and packaging use `--audio-mix` to embed the validated, canonically ordered mix into `game.bundle.json`.

## Verification

The focused authoring coverage is:

```powershell
pnpm exec vitest run `
  packages/audio/tests `
  packages/audio-editor-core/tests `
  packages/audio-controller/tests `
  packages/audio-web/tests `
  apps/studio/tests/audio-workspace.test.ts
```

The complete installed-workspace gate remains:

```powershell
pnpm run check:editor-expansion
```

A mix is not considered verified merely because the Studio renders. The command history, semantic validators, compiler, runtime bundle, save restoration, browser adapter and Studio build must all pass against the committed dependency graph.
