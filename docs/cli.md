# Command-line build workflow

The EVAVO Adventure Studio CLI is the non-visual entry point for validation, deterministic runtime compilation and clean release packaging. The editor and automation workers must call the same package services and produce the same bundle bytes as this tool.

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

## Compile a runtime bundle

Compilation requires complete verified asset evidence. Optional scene, art, font and interface sidecars become mandatory gates when supplied.

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --out .\game\build\game.bundle.json `
  --report .\game\build\compile-report.json
```

Bundle and report files are staged in their destination directories, flushed and committed as one transaction. Existing files are restored if any commit step fails.

The compile report records art, font and interface sidecar paths plus their profile/count information. Art sidecars remain build evidence. Validated bitmap fonts and interface skins are embedded in the runtime bundle because packaged rendering needs their native metrics and layout policy.

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
  --out .\game\release\windows
```

A successful release contains `game.bundle.json`, `release.manifest.json` and every verified runtime output. It contains no source art, editor documents, build-policy sidecars, previous bundles or stale files.

The target directory is built in a sibling temporary directory and swapped into place only after every file is written successfully. The command rejects a target that contains any input or evidence document, including font and interface sidecars.

Runtime paths cannot contain traversal, backslashes, Windows-invalid characters, reserved device names, trailing dots/spaces or case-only collisions.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Validation, compilation or packaging succeeded. |
| `1` | Project, scene, asset, art, font, interface or file evidence is invalid. |
| `2` | Command-line usage is invalid. |
| `3` | An unexpected internal failure occurred. |

## Determinism rules

The CLI does not add timestamps, absolute workstation paths or random identifiers to runtime output. Temporary filenames never appear in bundles, reports or release manifests.

The runtime bundle fingerprint covers canonical JSON including canonically ordered font and skin documents. Authored verb order remains unchanged because it controls visible layout. The asset manifest fingerprint covers compiled evidence, and each source/runtime output carries its own SHA-256 digest.
