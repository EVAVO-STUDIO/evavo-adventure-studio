import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedMultiProtagonist = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  const state = save.multiProtagonist;
  const manifest = bundle.multiProtagonist;
  if (!state) return issues;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "multi-protagonist-state-without-runtime-manifest",
      "multiProtagonist",
      "Save contains multi-protagonist state but the runtime bundle has no multi-protagonist manifest.",
    );
    return issues;
  }
  const definitions = new Map(manifest.protagonists.map((entry) => [entry.protagonistId as string, entry] as const));
  const itemIds = new Set(bundle.inventoryItems.map((item) => item.id as string));
  const scenes = new Map(
    bundle.scenes.map((scene) => [
      scene.id as string,
      new Set(scene.entrances.map((entrance) => entrance.id as string)),
    ]),
  );
  if (!definitions.has(state.activeProtagonistId)) {
    addSaveGameIssue(
      issues,
      "multi-protagonist-active-missing",
      "multiProtagonist.activeProtagonistId",
      `Saved active protagonist '${state.activeProtagonistId}' is not defined.`,
    );
  }
  for (const [key, protagonist] of Object.entries(state.protagonists)) {
    if (key !== protagonist.protagonistId || !definitions.has(protagonist.protagonistId)) {
      addSaveGameIssue(
        issues,
        "multi-protagonist-identity-mismatch",
        `multiProtagonist.protagonists.${key}`,
        `Saved protagonist '${key}' is not defined by the runtime manifest.`,
      );
    }
    const entrances = scenes.get(protagonist.location.sceneId);
    if (!entrances || !entrances.has(protagonist.location.entranceId)) {
      addSaveGameIssue(
        issues,
        "multi-protagonist-location-invalid",
        `multiProtagonist.protagonists.${key}.location`,
        `Saved protagonist '${key}' has an invalid scene/entrance location.`,
      );
    }
    protagonist.inventory.forEach((itemId, index) => {
      if (!itemIds.has(itemId)) {
        addSaveGameIssue(
          issues,
          "multi-protagonist-item-missing",
          `multiProtagonist.protagonists.${key}.inventory[${index}]`,
          `Saved protagonist item '${itemId}' does not exist.`,
        );
      }
    });
  }
  for (const protagonistId of definitions.keys()) {
    if (!state.protagonists[protagonistId]) {
      addSaveGameIssue(
        issues,
        "multi-protagonist-identity-mismatch",
        "multiProtagonist.protagonists",
        `Save is missing protagonist '${protagonistId}'.`,
      );
    }
  }
  return issues;
};
