# Command-line build workflow

The EVAVO Adventure Studio CLI is the non-visual entry point for validation, deterministic runtime compilation, replay execution and clean release packaging. The editor and automation workers must call the same package services and produce the same bundle and save bytes as this tool.

## Build the CLI

```powershell
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm run build:types
```

The executable is then available through the root script:

```powershell
pnpm cli -- help
```

## Validate an authoring project

Structural and semantic project validation does not require compiled assets:

```powershell
pnpm cli -- validate `
  --project .\game\project.json
```

Use `--json` for a stable machine-readable report.

## Validate scene composition

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --scene-instances .\game\scene-instances.json
```

The CLI uses the same scene-instance schema and semantic validator as the compiler and packaged player.

## Validate compiled asset evidence

Supplying an asset manifest validates project identity, asset kinds, output roles, runtime paths, portability, atlas geometry, manifest fingerprints and every declared source/runtime file hash.

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json
```

Source file paths are resolved relative to the project file. Runtime output paths are resolved relative to the asset manifest file.

## Validate art direction and pixel proof

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --json
```

The pixel evidence is generated from actual encoded PNG bytes and proves indexed/RGBA mode, post-encode colour counts, alpha classification and exact atlas-page roles.

## Validate bitmap fonts

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --json
```

This checks project identity, stable font/glyph IDs, code points, kerning, fallback coverage, metrics and exact compiled image or atlas-frame geometry.

## Validate interface skins

Interface policy can be checked with the same bitmap-font document it references:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --json
```

Adding the asset manifest also validates compiled verb-icon evidence:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --json
```

Validation covers native region bounds, default interaction mode, mode-specific requirements, bitmap-font roles, icon asset kinds, exact spritesheet icon frames, score policy, parser fields, inventory and region-overlap warnings.

## Validate deterministic audio

Audio policy can be checked directly against the source project:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --audio-mix .\game\audio-mix.json `
  --json
```

Adding the asset manifest also verifies every cue against compiled audio evidence:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --audio-mix .\game\audio-mix.json `
  --json
```

Validation covers:

- exact project and logical-tick identity;
- the master, music, speech, ambience, effects and interface buses;
- cue asset existence and audio kind;
- loop ranges, loop crossfades and speech-loop prohibition;
- voice limits, polyphony and deterministic stealing policy;
- scene soundscape, layer-role and cue-bus compatibility;
- dialogue-line speech bindings and ordered performance markers;
- ducking relationships;
- sequence sound and stop-audio compatibility;
- compiled audio-output metadata when build evidence is supplied.

The Audio Studio route `/?workspace=audio` edits the same `AudioMixManifest`; the CLI does not maintain a second build-only representation.

## Compile a runtime bundle

Compilation requires complete verified asset evidence. Optional scene, art, font, interface and audio sidecars become mandatory gates when supplied.

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --audio-mix .\game\audio-mix.json `
  --out .\game\build\game.bundle.json `
  --report .\game\build\compile-report.json
```

Bundle and report files are staged in their destination directories, flushed and committed as one transaction. Existing files are restored if any commit step fails.

The compile report records art, font, interface and audio sidecar paths plus their profile/count information. Art sidecars remain build evidence. Validated bitmap fonts, interface skins and audio mixes are embedded in the runtime bundle because packaged rendering and playback need their exact metrics, layout and deterministic mix policy.

## Assemble a clean release directory

```powershell
pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --audio-mix .\game\audio-mix.json `
  --out .\game\release\windows
```

A successful release contains `game.bundle.json`, `release.manifest.json` and every verified runtime output. It contains no source art, editor documents, build-policy sidecars, previous bundles or stale files.

The target directory is built in a sibling temporary directory and swapped into place only after every file is written successfully. The command rejects a target that contains any input or evidence document, including font, interface and audio sidecars.

Runtime paths cannot contain traversal, backslashes, Windows-invalid characters, reserved device names, trailing dots/spaces or case-only collisions.

## Validate a packaged save game

Save validation needs only the packaged runtime bundle and save JSON:

```powershell
pnpm cli -- save-validate `
  --bundle .\game\release\windows\game.bundle.json `
  --save .\playtests\quick.save.json `
  --json
```

The command verifies bundle parsing, save schema, save payload fingerprint, exact bundle and asset-manifest fingerprints, current scene and entrance, active dialogue and sequence state, actor playback and movement, persistent objects, deferred commands, inventory selections, parser limits and active deterministic audio state.

A successful JSON report includes the project ID, save fingerprint, logical tick and current scene.

## Validate a packaged replay

```powershell
pnpm cli -- replay-validate `
  --bundle .\game\release\windows\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --json
```

This verifies replay schema and payload integrity, exact bundle identity, initial-save compatibility, event ordering, logical tick bounds, final checkpoint and optional expected final-save fingerprint metadata. It validates the replay document without executing gameplay.

A successful JSON report includes initial/final ticks, event count, replay fingerprint and expected final save fingerprint when present.

## Execute a packaged replay

`replay-execute` restores the replay's initial save and applies every event through the shared renderer-neutral runtime controller. It advances the simulation to the explicit final tick and fails when the resulting save fingerprint differs from the recorded checkpoint.

```powershell
pnpm cli -- replay-execute `
  --bundle .\game\release\windows\game.bundle.json `
  --replay .\playtests\office.replay.json `
  --output-save .\playtests\office.final.save.json `
  --json
```

`--output-save` is optional. When supplied, parent directories are created and the canonical final save is written only after replay execution succeeds. A divergence does not produce a misleading output save.

The JSON report includes:

- replay and final-save fingerprints;
- initial and final ticks;
- executed event count;
- expected final-save fingerprint when recorded;
- checkpoint-match state;
- the resolved output-save path, or `null` when no file was requested.

Stable execution diagnostics include `replay-integrity`, `replay-compatibility`, `replay-execution`, `replay-divergence`, `controlled-actor-mismatch`, file read codes and `invalid-json`. An unexpected internal or output-write failure is reported as `replay-execute-failed`.

Automation can call the same execution service directly:

```ts
import { executeInspectedReplay } from "@evavo/adventure-playtest-inspector/replay-execution";

const result = executeInspectedReplay(bundle, replay);
```

The service returns both the canonical final save document and a human-readable inspected summary.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Validation, compilation, replay execution or packaging succeeded. |
| `1` | Project, scene, asset, art, font, interface, audio, save, replay or file evidence is invalid, or replay execution diverged. |
| `2` | Command-line usage is invalid. |
| `3` | An unexpected internal or output-write failure occurred. |

## Determinism rules

The CLI does not add timestamps, absolute workstation paths or random identifiers to runtime output. Temporary filenames never appear in bundles, reports or release manifests.

The runtime bundle fingerprint covers canonical JSON including canonically ordered font, skin and audio documents. Authored verb, soundscape-layer, speech-marker and cue order is preserved where order controls visible or audible behavior. Save and replay reports expose canonical artifact fingerprints without modifying the artifact. Replay execution writes the exact canonical final save produced by the shared controller. The asset manifest fingerprint covers compiled evidence, and each source/runtime output carries its own SHA-256 digest.
