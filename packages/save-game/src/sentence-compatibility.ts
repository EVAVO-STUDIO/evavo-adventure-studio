import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedSentence = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const sentence = save.interface.sentence;
  if (!sentence) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const skin = bundle.uiSkins?.skins.find((candidate) => candidate.id === bundle.uiSkins?.defaultSkinId);
  if (sentence.verbId && !skin?.verbs.some((verb) => verb.id === sentence.verbId)) {
    addSaveGameIssue(
      issues,
      "sentence-verb-missing",
      "interface.sentence.verbId",
      `Saved sentence verb '${sentence.verbId}' does not exist in the default UI skin.`,
    );
  }
  const itemIds = new Set(bundle.inventoryItems.map((item) => item.id as string));
  const objectIds = new Set(
    bundle.sceneInstances?.scenes.flatMap((scene) => scene.objectInstances.map((object) => object.id as string)) ?? [],
  );
  const validateTarget = (
    target: NonNullable<typeof sentence.primary> | null,
    path: string,
  ): void => {
    if (!target) return;
    if (target.kind === "inventory-item" && !itemIds.has(target.itemId)) {
      addSaveGameIssue(
        issues,
        "sentence-item-missing",
        path,
        `Saved sentence item '${target.itemId}' does not exist in the runtime inventory catalog.`,
      );
    }
    if (target.kind === "scene-object" && !objectIds.has(target.objectId)) {
      addSaveGameIssue(
        issues,
        "sentence-object-missing",
        path,
        `Saved sentence object '${target.objectId}' does not exist in runtime scene instances.`,
      );
    }
  };
  validateTarget(sentence.primary, "interface.sentence.primary");
  validateTarget(sentence.secondary, "interface.sentence.secondary");
  return issues;
};
