# Interface skins and interaction layouts

## Purpose

`@evavo/adventure-ui-skin` defines the native-resolution interface that sits above an adventure scene. It separates game rules from presentation so one runtime can support several original interaction grammars without copying a commercial game's art or layout.

Open the visual authoring workspace at:

```text
http://localhost:5174/?workspace=interface
```

The canonical authoring document is `UiSkinManifest`. It is project-scoped, compiled into `game.bundle.json`, included in the bundle fingerprint and validated again by the packaged player.

## Supported interaction modes

A skin declares one of the six interaction modes already present in `PresentationProfile`:

- `icon-bar` for persistent graphical action buttons;
- `verb-list` for persistent text verbs;
- `verb-coin` for a radial context menu;
- `two-button` for exactly two primary actions;
- `context` for hotspot-directed cursors and commands;
- `parser-assisted` for a native parser field combined with pointer interaction.

The default skin must match the project's presentation mode. Additional skins may use other modes when they satisfy their own requirements, allowing a project to maintain alternate interface experiments without changing the shipping default.

## Native regions

Every region uses authored native pixels. A skin can define:

- status and speech rail;
- score readout;
- verb bar;
- inventory strip;
- parser field;
- dialogue-choice panel;
- radial verb coin.

Each region carries a stable ID, native rectangle, padding and panel style. Panel styles support packed or RGBA fills, borders, border width and an optional accent rule.

Validation rejects regions outside the native canvas. Region overlap is reported as a warning because some intentional designs layer panels, but it remains visible in Studio and CLI diagnostics.

## Fonts and icons

Text roles refer to `BitmapFontManifest` IDs. Supported roles are:

- status;
- verb;
- inventory;
- score;
- parser;
- dialogue.

There is no CSS or vector-font fallback in packaged rendering. Text becomes nearest-sampled glyph sprites before PixiJS creates GPU objects.

Verb icons can use image assets or exact spritesheet frames. Compiled mapping validation enforces:

- declared icon assets exist in the asset build manifest;
- icon assets are images or spritesheets;
- image icons do not declare frame IDs;
- spritesheet icons always declare an exact frame ID;
- the declared frame exists in the compiled atlas.

The same mapping checks run during compilation and source-free runtime bundle parsing.

## Runtime state

`UiRuntimeState` supplies the transient interface state without mutating the skin document:

- status text;
- active, hovered, pressed and disabled verbs;
- visible inventory and selected item;
- score and optional maximum score;
- parser text and cursor visibility;
- dialogue choices and hovered choice;
- verb-coin position.

The packaged player maps canonical story score and inventory directly from `RuntimeState`. Persistent verb selections drive object commands, selected inventory items are forwarded to interaction resolution, and UI hits are resolved before scene hits so interface clicks never become walk commands.

A verb coin uses a deterministic click-open, click-select flow. Persistent verb bars and inventory slots are directly hit-testable in native coordinates.

Parser-assisted skins now support native keyboard editing, Unicode-safe backspace, command history, verb aliases, `HELP`, `INVENTORY`, room descriptions, authored object-name resolution and `USE item ON object` phrases. Parser object commands enter the same movement, interaction, inventory and dialogue pipeline as pointer actions.

Dialogue-requested runtime events now activate canonical dialogue state. Visible choices are composed from `resolveDialogueView`; disabled choices reject cleanly, enabled choices execute their actions, consume once-only choices, change nodes or close the dialogue through `chooseDialogueOption`.

## Renderer-neutral composition

`composeUiSkinNodes` creates ordinary render-contract nodes for:

- panel fills, borders and accent rules;
- bitmap labels;
- score text;
- verb buttons and icons;
- inventory slots and icons;
- parser prompt and cursor;
- dialogue-choice buttons;
- quantized radial verb coins.

`appendUiSkinFrame` adds those nodes to an existing resolved scene frame. PixiJS receives only supported sprite and rectangle nodes after bitmap text expansion.

The Studio preview calls the same composer with synthetic compiled geometry. It does not maintain a separate visual-only layout model.

## Authoring history

`@evavo/adventure-ui-skin-editor-core` provides serializable commands for:

- inserting, removing and replacing skins;
- changing the default skin;
- inserting, removing and replacing verbs;
- atomic default-skin migrations;
- undo and redo;
- deterministic dirty-state comparison.

Every command is applied to a cloned document and the complete result is validated against the project and bitmap fonts before history mutation. Authored verb order is preserved because it controls visible button order. Rejected Studio edits remain inside the workspace, preserve history and surface a local notice instead of triggering the application error boundary.

## CLI workflow

Validate source interface policy:

```powershell
pnpm cli -- validate `
  --project .\game\project.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json
```

Compile it into the runtime bundle:

```powershell
pnpm cli -- compile `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --out .\game\build\game.bundle.json `
  --report .\game\build\compile-report.json
```

Package a release:

```powershell
pnpm cli -- package `
  --project .\game\project.json `
  --asset-manifest .\game\build\assets.manifest.json `
  --bitmap-fonts .\game\bitmap-fonts.json `
  --ui-skins .\game\ui-skins.json `
  --out .\game\release\windows
```

CLI reports record the exact skin sidecar path and compiled skin count. Output safety rejects a bundle, report or release directory that would overwrite or contain the source skin document.

## Verification

The focused Windows and Linux workflow covers:

- UI schema and semantic validation;
- renderer-neutral composition;
- native hit-testing;
- compiled icon mappings;
- editor command history;
- compiler and runtime bundle integration;
- player runtime composition, parser input and dialogue transitions;
- Studio workspace tests and build;
- CLI parsing and skin loading.

A build must not be described as successful until those commands or GitHub Actions complete with evidence.
