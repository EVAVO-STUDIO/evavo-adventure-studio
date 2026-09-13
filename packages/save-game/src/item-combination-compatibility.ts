import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";
import type { SaveGame } from "./schema.js";

export const validateSavedItemCombinations = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const state = save.itemCombinations;
  if (!state) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.itemCombinations;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "item-combination-state-without-runtime-manifest",
      "itemCombinations",
      "Save contains item-combination state but the runtime bundle has no item-combination manifest.",
    );
    return issues;
  }
  const recipeIds = new Set(manifest.recipes.map((recipe) => recipe.id as string));
  state.usedRecipeIds.forEach((recipeId, index) => {
    if (!recipeIds.has(recipeId)) {
      addSaveGameIssue(
        issues,
        "item-combination-recipe-missing",
        `itemCombinations.usedRecipeIds[${index}]`,
        `Saved item-combination recipe '${recipeId}' does not exist in the runtime manifest.`,
      );
    }
  });
  return issues;
};
