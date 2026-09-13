import {
  applyActions,
  evaluateCondition,
  type RuntimeEvent,
  type RuntimeState,
} from "@evavo/adventure-core";
import type { Action, Condition, Id } from "@evavo/adventure-project-schema";

export type ItemCombinationRecipeId = `item-combination.${string}`;

export interface ItemCombinationRecipe {
  readonly id: ItemCombinationRecipeId;
  readonly verb: string;
  readonly primaryItemId: Id<"item">;
  readonly secondaryItemId: Id<"item">;
  readonly commutative?: boolean;
  readonly when?: Condition;
  readonly once?: boolean;
  readonly actions: readonly Action[];
  readonly fallbackText?: string;
}

export interface ItemCombinationManifest {
  readonly manifestVersion: 1;
  readonly recipes: readonly ItemCombinationRecipe[];
  readonly fallbackText?: string;
}

export interface ItemCombinationRuntimeState {
  readonly usedRecipeIds: readonly ItemCombinationRecipeId[];
}

export interface ItemCombinationCommand {
  readonly verb: string;
  readonly primaryItemId: Id<"item">;
  readonly secondaryItemId: Id<"item">;
}

export type ItemCombinationFallbackReason =
  | "item-not-held"
  | "no-match"
  | "condition-failed"
  | "already-used";

export type ItemCombinationResult =
  | {
      readonly kind: "executed";
      readonly recipe: ItemCombinationRecipe;
      readonly command: ItemCombinationCommand;
      readonly story: RuntimeState;
      readonly combinations: ItemCombinationRuntimeState;
      readonly events: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "fallback";
      readonly command: ItemCombinationCommand;
      readonly story: RuntimeState;
      readonly combinations: ItemCombinationRuntimeState;
      readonly reason: ItemCombinationFallbackReason;
      readonly text: string;
    };

export const createItemCombinationRuntimeState = (): ItemCombinationRuntimeState => ({
  usedRecipeIds: [],
});

const orderedUnique = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const recipeMatches = (
  recipe: ItemCombinationRecipe,
  command: ItemCombinationCommand,
): boolean => {
  if (recipe.verb !== command.verb) return false;
  if (
    recipe.primaryItemId === command.primaryItemId &&
    recipe.secondaryItemId === command.secondaryItemId
  ) {
    return true;
  }
  return (
    recipe.commutative === true &&
    recipe.primaryItemId === command.secondaryItemId &&
    recipe.secondaryItemId === command.primaryItemId
  );
};

export const validateItemCombinationManifest = (
  manifest: ItemCombinationManifest,
  knownItemIds?: ReadonlySet<string>,
): readonly string[] => {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const recipe of manifest.recipes) {
    if (seen.has(recipe.id)) issues.push(`Item-combination recipe '${recipe.id}' is duplicated.`);
    seen.add(recipe.id);
    if (recipe.primaryItemId === recipe.secondaryItemId) {
      issues.push(`Item-combination recipe '${recipe.id}' cannot use the same item on itself.`);
    }
    if (knownItemIds) {
      if (!knownItemIds.has(recipe.primaryItemId)) {
        issues.push(`Item-combination recipe '${recipe.id}' references missing item '${recipe.primaryItemId}'.`);
      }
      if (!knownItemIds.has(recipe.secondaryItemId)) {
        issues.push(`Item-combination recipe '${recipe.id}' references missing item '${recipe.secondaryItemId}'.`);
      }
      for (const action of recipe.actions) {
        if ((action.kind === "give-item" || action.kind === "remove-item") && !knownItemIds.has(action.itemId)) {
          issues.push(`Item-combination recipe '${recipe.id}' action references missing item '${action.itemId}'.`);
        }
      }
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};

export const resolveItemCombination = (
  manifest: ItemCombinationManifest,
  story: RuntimeState,
  combinations: ItemCombinationRuntimeState,
  command: ItemCombinationCommand,
): ItemCombinationResult => {
  const fallbackText = manifest.fallbackText ?? "Those items do not work together.";
  if (
    !story.inventory.includes(command.primaryItemId) ||
    !story.inventory.includes(command.secondaryItemId)
  ) {
    return {
      kind: "fallback",
      command,
      story,
      combinations,
      reason: "item-not-held",
      text: fallbackText,
    };
  }

  const candidates = manifest.recipes.filter((recipe) => recipeMatches(recipe, command));
  let conditionFailed = false;
  let alreadyUsed = false;
  for (const recipe of candidates) {
    if (recipe.once === true && combinations.usedRecipeIds.includes(recipe.id)) {
      alreadyUsed = true;
      continue;
    }
    if (recipe.when && !evaluateCondition(recipe.when, story)) {
      conditionFailed = true;
      continue;
    }
    const transition = applyActions(story, recipe.actions);
    const nextCombinations = recipe.once === true
      ? {
          usedRecipeIds: orderedUnique([...combinations.usedRecipeIds, recipe.id]),
        }
      : combinations;
    return {
      kind: "executed",
      recipe,
      command,
      story: transition.state,
      combinations: nextCombinations,
      events: transition.events,
    };
  }

  return {
    kind: "fallback",
    command,
    story,
    combinations,
    reason: conditionFailed ? "condition-failed" : alreadyUsed ? "already-used" : "no-match",
    text: candidates[0]?.fallbackText ?? fallbackText,
  };
};
