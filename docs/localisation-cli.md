# Localisation CLI workflow

Adventure Studio exposes localisation as a first-class headless workflow through the same canonical project, runtime-bundle and localisation services used by Studio and the Player. The CLI never changes gameplay commands or story state when creating or attaching locale data.

## Extract the source catalogue

```powershell
pnpm cli -- localisation source `
  --project .\game\project.json `
  --out .\game\localisation-source.json `
  --json
```

The output contains stable localisation keys, text roles, owner IDs, canonical source paths and source text. It is suitable for translation-memory ingestion, reporting and automation.

## Create a blank target manifest

```powershell
pnpm cli -- localisation template `
  --project .\game\project.json `
  --source-locale en-AU `
  --locale fr-FR `
  --label "Français" `
  --out .\game\localisation.fr-FR.json
```

The manifest contains one deterministic row for every current localisable source key and starts in `draft` state. Additional locales can be added in Localisation Studio or through the headless localisation editor command API.

## Generate pseudo-localisation

```powershell
pnpm cli -- localisation pseudo `
  --project .\game\project.json `
  --source-locale en-AU `
  --out .\game\localisation.pseudo.json
```

The default pseudo locale is `qps-ploc`. Placeholders remain byte-for-byte intact while visible characters are accented and expanded to expose clipping, unsupported glyphs and hard-coded source strings.

## Validate a localisation manifest

```powershell
pnpm cli -- localisation validate `
  --project .\game\project.json `
  --localisation .\game\localisation.json `
  --json
```

Validation checks project identity, duplicate locales and keys, unknown source keys, release coverage, fallback targets and cycles, and exact placeholder parity. Exit code `1` means localisation data is invalid; warnings do not fail the command.

Native bitmap text-fit remains a separate release gate because it requires the final bitmap-font manifest and authored text-fit profile. Localisation Studio shows those findings interactively through the same audit service.

## Attach locales to a compiled runtime bundle

First compile the complete source-free runtime bundle with the normal pipeline, including scene composition, fonts, interface skins and audio as required. Then attach the validated locale pack:

```powershell
pnpm cli -- localisation attach `
  --project .\game\project.json `
  --localisation .\game\localisation.json `
  --bundle .\game\build\game.bundle.json `
  --default-locale fr-FR `
  --out .\game\build\game.localised.bundle.json `
  --json
```

The attachment command preserves all existing compiled runtime data and adds only the canonical `RuntimeLocalisationPack`. The input runtime bundle is never modified in place. `--default-locale` must be either the canonical source locale or one of the declared target locales.

This two-stage design means localisation can be added after the complete game bundle has already incorporated scene, UI, font, audio and other production sidecars. It avoids maintaining a second localisation-specific compiler path.

## Automation API

The CLI command group is also exported directly:

```ts
import {
  parseLocalisationCliArguments,
  runLocalisationCli,
} from "@evavo/adventure-cli/localisation";
```

Headless tools that already own file persistence can bypass CLI parsing and call the lower-level localisation APIs from `@evavo/adventure-project-schema/localisation`, `@evavo/adventure-bitmap-font/localisation`, `@evavo/adventure-compiler/with-localisation` and `@evavo/adventure-runtime-bundle/localisation`.

## Safety and determinism

- Source, manifest and runtime-bundle inputs are read-only.
- Output paths are rejected when they collide with an input path.
- Generated JSON has no timestamps or random IDs.
- Source catalogue and target entries use deterministic ordering.
- Locale attachment recomputes the canonical runtime-bundle fingerprint.
- Invalid manifests never produce an attached bundle.
- Locale selection remains presentation-only and does not become a replay event.
- Save compatibility remains localisation-neutral as defined by the runtime/save contract.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Command completed successfully. |
| `1` | Project, localisation or runtime-bundle data is invalid. |
| `2` | Command-line usage or output path is invalid. |
| `3` | An unexpected internal or output-write failure occurred. |