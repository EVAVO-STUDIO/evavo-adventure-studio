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

Use `--json` for a stable machine-readable report:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --json
```

## Validate scene composition

The scene-composition sidecar adds placed actors, persistent objects and navigation portals:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --scene-instances .\game\scene-instances.json
```

The CLI uses the same scene-instance schema and semantic validator as the compiler and packaged player.

## Validate compiled asset evidence

Supplying an asset manifest adds all of the following checks:

- manifest schema and project identity;
- one compiled record for every authored asset;
- asset-kind agreement;
- unique output roles and runtime paths;
- portable Windows, Linux and web path rules;
- case-insensitive runtime-path collision detection;
- atlas page, frame and source-rectangle integrity;
- manifest payload fingerprint;
- source-file byte length and SHA-256;
- runtime-output byte length and SHA-256.

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json
```

Source file paths are resolved relative to the project file. Runtime output paths are resolved relative to the asset manifest file.

## Validate art direction policy

Art policy can be checked before images have been compiled:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --art-direction .\game\art-direction.json
```

This verifies native resolution, nearest-neighbour and integer-scaling requirements, complete per-asset rules, role and asset-kind compatibility, background dimensions, indexed-colour limits, trim policy and atlas-padding requirements.

## Validate proof-level pixel evidence

Full art validation combines four documents:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --json
```

`ArtVisualEvidenceManifest` is generated from actual encoded PNG bytes by the asset-pipeline services. It proves:

- indexed or RGBA output for images and every atlas page;
- actual post-encode colour counts;
- opaque, binary-alpha or full-alpha classification;
- exact correspondence to declared atlas page roles.

`--art-evidence` requires both `--art-direction` and `--asset-manifest`. A missing, malformed or non-compliant pixel proof is a blocking validation error.

## Validate bitmap fonts

A project-scoped bitmap-font sidecar can be validated before assets are compiled:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --bitmap-fonts .\game\bitmap-fonts.json
```

This checks:

- project identity;
- font and glyph identity;
- duplicate code points and kerning pairs;
- fallback-glyph availability;
- line-height and baseline metrics;
- image-versus-spritesheet atlas rules.

Adding the compiled asset manifest also verifies glyph geometry against runtime outputs:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --json
```

Image-atlas glyph rectangles must remain inside compiled image dimensions. Spritesheet glyphs must name an existing frame and exactly match its compiled source rectangle.

## Compile a runtime bundle

Compilation requires complete verified asset evidence. Optional scene, art and font sidecars become mandatory gates when supplied. The runtime bundle contains runtime-relative output files and typed metadata, but never authoring source paths or source hashes.

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --out .\game\build\game.bundle.json `
  --report .\game\build\compile-report.json
```

Bundle and report files are staged in their destination directories, flushed, and committed as one transaction. Existing files are moved to temporary backups and restored if any commit step fails.

The compile report records the selected art profile, font-sidecar path, bitmap-font count and exact evidence input paths. Art sidecars remain build evidence. Validated bitmap-font definitions are canonically sorted and embedded in the runtime bundle because the player needs their glyph metrics.

## Assemble a clean release directory

The package command revalidates project, scene, asset, art and font evidence, rereads and rehashes every runtime output, compiles the canonical bundle and assembles a new release tree:

```powershell
pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --scene-instances .\game\scene-instances.json `
  --art-direction .\game\art-direction.json `
  --art-evidence .\game\build\art-evidence.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --out .\game\release\windows
```

A successful release contains:

- `game.bundle.json`;
- `release.manifest.json`;
- every verified runtime output at its declared relative path;
- no source art, editor files, policy sidecars, evidence sidecars, font sidecars, previous bundle files or stale output.

The release manifest records the project ID, bundle fingerprint, bundle SHA-256, asset-manifest fingerprint and the byte length and SHA-256 of every packaged runtime file. It contains no timestamps or absolute workstation paths.

The target directory is built in a sibling temporary directory and swapped into place only after every file is written successfully. An existing target is backed up and restored if the final swap fails. The command rejects a target directory that contains the project, manifests, policy sidecars, evidence sidecars, font sidecars, source files or compiled evidence.

Runtime paths must be portable. They cannot contain traversal, backslashes, Windows-invalid characters, reserved device names, trailing dots or spaces, or case-only collisions.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Validation, compilation or packaging succeeded. |
| `1` | Project, scene, asset, art, font or file evidence is invalid. |
| `2` | Command-line usage is invalid. |
| `3` | An unexpected internal failure occurred. |

## Determinism rules

The CLI does not add timestamps, absolute workstation paths or random identifiers to runtime output. Temporary filenames used during transactional writes never appear in a bundle, report or release manifest.

The runtime bundle fingerprint covers canonical bundle JSON, including canonically ordered bitmap-font definitions when supplied. The asset manifest fingerprint covers canonical compiled-asset evidence. The release fingerprint covers the canonical release description. Each source and runtime output also carries its own SHA-256 digest.
