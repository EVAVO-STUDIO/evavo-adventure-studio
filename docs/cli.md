# Command-line build workflow

The EVAVO Adventure Studio CLI is the non-visual entry point for validation and deterministic runtime compilation. The editor and automation workers must call the same package services and produce the same bundle bytes as this tool.

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

## Validate compiled asset evidence

Supplying an asset manifest adds all of the following checks:

- manifest schema and project identity;
- one compiled record for every authored asset;
- asset-kind agreement;
- unique output roles and runtime paths;
- atlas page and frame integrity;
- manifest payload fingerprint;
- source-file byte length and SHA-256;
- runtime-output byte length and SHA-256.

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json
```

Source file paths are resolved relative to the project file. Runtime output paths are resolved relative to the asset manifest file.

## Compile a runtime bundle

Compilation requires complete verified asset evidence. The runtime bundle contains runtime-relative output files and typed metadata, but never authoring source paths or source hashes.

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --out .\game\build\game.bundle.json `
  --report .\game\build\compile-report.json
```

The bundle should be written inside the same runtime root as the asset manifest so its runtime-relative asset paths resolve consistently. A later packaging command will make this relationship explicit by assembling a clean release directory.

Bundle and report files are staged in their destination directories, flushed, and committed as one transaction. Existing files are moved to temporary backups and restored if any commit step fails.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Validation or compilation succeeded. |
| `1` | Project, manifest or file evidence is invalid. |
| `2` | Command-line usage is invalid. |
| `3` | An unexpected internal failure occurred. |

## Determinism rules

The CLI does not add timestamps, absolute workstation paths or random identifiers to runtime output. Temporary filenames used during transactional writes never appear in a bundle or report.

The runtime bundle fingerprint covers canonical bundle JSON. The asset manifest fingerprint covers canonical compiled-asset evidence. Each source and runtime output also carries its own SHA-256 digest.
