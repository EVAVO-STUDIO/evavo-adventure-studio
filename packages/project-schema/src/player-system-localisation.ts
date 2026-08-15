import type { LocalisationSourceEntry, LocalisationTextRole } from "./localisation-types.js";

export const playerSystemLocalisationPrefix = "playerSystem.";

export const playerSystemSourceText = {
  "aria.gameCanvas": "Native adventure game canvas",
  "aria.languageSelector": "Game language",
  "aria.systemMenu": "{title} system menu",
  "label.language": "LANGUAGE",
  "description.languageReload":
    "Changing language reloads the presentation. Quick saves remain compatible.",
  "heading.paused": "GAME PAUSED",
  "heading.save": "SAVE GAME",
  "heading.load": "LOAD GAME",
  "heading.options": "OPTIONS",
  "heading.returnToTitle": "RETURN TO TITLE?",
  "description.save": "Choose a slot. Existing saves in that slot will be replaced.",
  "description.load": "Choose a compatible save to restore its exact logical game state.",
  "description.options": "System display settings do not alter game state or replay history.",
  "description.returnToTitle": "Unsaved progress since the last save will be lost.",
  "loading.runtimeBundle": "Loading runtime bundle…",
  "loading.game": "Loading game…",
  "error.playerCouldNotStart": "The player could not start — {error}",
  "menu.resume": "RESUME GAME",
  "menu.save": "SAVE GAME",
  "menu.load": "LOAD GAME",
  "menu.options": "OPTIONS",
  "menu.returnToTitle": "RETURN TO TITLE",
  "menu.fullscreen": "TOGGLE FULLSCREEN",
  "menu.back": "BACK",
  "menu.confirmReturnToTitle": "YES — RETURN TO TITLE",
  "menu.cancelReturnToTitle": "NO — KEEP PLAYING",
  "slot.quick": "QUICK SAVE",
  "slot.numbered": "SAVE SLOT {slot}",
  "slot.empty": "{title} — EMPTY",
  "slot.damaged": "{title} — DAMAGED SAVE",
  "slot.valid": "{title} — {scene} TICK {tick}",
  "slot.detail": "SCORE {score} • {count} {itemLabel}",
  "slot.itemSingular": "ITEM",
  "slot.itemPlural": "ITEMS",
  "status.loadingGameData": "LOADING GAME DATA",
  "status.titleScreen": "TITLE SCREEN",
  "status.restoringGame": "RESTORING GAME",
  "status.startingOpening": "STARTING OPENING",
  "status.startingNewGame": "STARTING NEW GAME",
  "status.playerCouldNotStart": "PLAYER COULD NOT START",
  "status.gameRestored": "GAME RESTORED",
  "status.gameSaved": "GAME SAVED",
  "status.gamePaused": "GAME PAUSED",
  "status.gameResumed": "GAME RESUMED",
  "status.quickSaveRestored": "QUICK SAVE RESTORED",
  "status.saveSlotRestored": "SAVE SLOT {slot} RESTORED",
  "status.quickSaveUnavailable": "QUICK SAVE UNAVAILABLE — {error}",
  "status.saveSlotUnavailable": "SAVE SLOT {slot} UNAVAILABLE — {error}",
  "status.replayRecording": "REPLAY RECORDING",
  "status.replayRecorded": "REPLAY RECORDED • {count} {eventLabel}",
  "status.replayEventSingular": "EVENT",
  "status.replayEventPlural": "EVENTS",
  "status.noCompletedReplay": "NO COMPLETED REPLAY TO EXPORT",
  "status.replayExported": "REPLAY EXPORTED",
  "status.replayFailed": "REPLAY FAILED — {error}",
  "status.cutscene": "CUTSCENE",
  "status.cutsceneSkipped": "CUTSCENE SKIPPED",
  "status.cutsceneCannotSkip": "CUTSCENE CANNOT BE SKIPPED YET",
  "status.cutsceneCaptionSkippable": "{caption} • ESC",
  "status.cutsceneNameSkippable": "{name} • ESC TO SKIP",
  "status.systemMenuFailed": "SYSTEM MENU FAILED — {error}",
  "status.fullscreenEnabled": "FULLSCREEN ENABLED.",
  "status.fullscreenDisabled": "FULLSCREEN DISABLED.",
  "status.fullscreenUnavailable": "FULLSCREEN IS NOT AVAILABLE IN THIS HOST.",
  "status.quickSaveWritten": "QUICK SAVE WRITTEN.",
  "status.saveSlotWritten": "SAVE SLOT {slot} WRITTEN.",
  "status.saveFailed": "SAVE FAILED — {error}",
  "status.loadFailed": "LOAD FAILED — {error}",
  "footer.controls": "↑ ↓ SELECT   ENTER CHOOSE   ESC BACK / RESUME",
} as const;

export type PlayerSystemLocalisationField = keyof typeof playerSystemSourceText;
export type PlayerSystemTextValues = Readonly<Record<string, string | number>>;
export type PlayerSystemTextResolver = (
  field: PlayerSystemLocalisationField,
  values?: PlayerSystemTextValues,
) => string;

export const playerSystemLocalisationFields = Object.keys(
  playerSystemSourceText,
).sort((left, right) => left.localeCompare(right)) as readonly PlayerSystemLocalisationField[];

export const playerSystemLocalisationKey = (
  field: PlayerSystemLocalisationField,
): string => `${playerSystemLocalisationPrefix}${field}`;

const playerSystemRole = (field: PlayerSystemLocalisationField): LocalisationTextRole => {
  if (field.startsWith("heading.") || field.startsWith("aria.")) {
    return "player-system-heading";
  }
  if (field.startsWith("description.")) return "player-system-description";
  if (field.startsWith("menu.") || field.startsWith("label.")) {
    return "player-system-menu-label";
  }
  if (field.startsWith("footer.")) return "player-system-footer";
  if (
    field === "slot.quick" ||
    field === "slot.numbered" ||
    field === "slot.itemSingular" ||
    field === "slot.itemPlural"
  ) {
    return "player-system-menu-label";
  }
  return "player-system-status";
};

export const extractPlayerSystemLocalisableText = (
  projectId: string,
): readonly LocalisationSourceEntry[] =>
  playerSystemLocalisationFields.map((field) => ({
    key: playerSystemLocalisationKey(field),
    role: playerSystemRole(field),
    ownerId: projectId,
    sourcePath: `playerSystem.${field}`,
    text: playerSystemSourceText[field],
  }));

export const formatPlayerSystemText = (
  text: string,
  values: PlayerSystemTextValues = {},
): string =>
  text.replace(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g, (placeholder, key: string) => {
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });

export const canonicalPlayerSystemText: PlayerSystemTextResolver = (field, values = {}) =>
  formatPlayerSystemText(playerSystemSourceText[field], values);
