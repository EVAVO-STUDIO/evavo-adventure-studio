# Lifecycle CLI workflow

Adventure Studio exposes deterministic failure and ending production through the same headless CLI used by other build surfaces. The commands use the exact `GameLifecycleManifest` and runtime-bundle contracts consumed by Endings Studio and the Player.

## Create a starter manifest

```powershell
pnpm cli -- lifecycle template `
  --project .\game\project.json `
  --kind failure `
  --out .\game\game-lifecycle.json
```

`--kind` accepts `failure` or `success`. The template contains one deterministic flag-driven outcome and the safe default recovery policy. It is a starting point, not a game-specific design decision.

The command aliases `ending` and `endings` route to the same command group.

## Validate lifecycle authoring data

```powershell
pnpm cli -- lifecycle validate `
  --project .\game\project.json `
  --lifecycle .\game\game-lifecycle.json `
  --json
```

Validation parses both documents through their canonical schemas and verifies that the lifecycle document belongs to the selected project. Schema failures, duplicate IDs, invalid recovery policies and malformed conditions are returned through stable lifecycle diagnostic sources.

## Attach lifecycle data to a compiled runtime bundle

```powershell
pnpm cli -- lifecycle attach `
  --lifecycle .\game\game-lifecycle.json `
  --bundle .\game\build\game.bundle.json `
  --out .\game\build\game.lifecycle.bundle.json `
  --json
```

The input bundle is fully parsed before mutation. Lifecycle project identity must match the runtime project. The output is written atomically and receives a newly calculated deterministic bundle fingerprint.

Attachment works on an already compiled bundle, so scene composition, bitmap fonts, UI skins, audio, localisation and front-end data remain intact. The source bundle is never modified in place.

## Output safety

Template and attach commands reject an output path that aliases any required input document. This protects canonical source projects, lifecycle manifests and runtime bundles from accidental overwrite.

Use `--json` for machine-readable reports. Lifecycle command exit codes follow the main CLI convention:

- `0` success;
- `1` invalid project/lifecycle/runtime data;
- `2` invalid command-line usage;
- `3` unexpected internal or output-write failure.

## Determinism boundary

Lifecycle attachment changes gameplay termination semantics and therefore changes the exact runtime bundle fingerprint and save-compatibility identity. The CLI does not add timestamps, random IDs or workstation paths to lifecycle or runtime output.