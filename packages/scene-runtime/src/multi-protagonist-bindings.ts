import type {
  RuntimeMultiProtagonistBinding,
  RuntimeMultiProtagonistBindingManifest,
} from "@evavo/adventure-runtime-bundle/multi-protagonist-bindings";
import {
  discoverSharedWorldFact,
  giveProtagonistItem,
  moveProtagonist,
  removeProtagonistItem,
  setProtagonistFlag,
  setSharedWorldFlag,
  transferProtagonistItem,
  type MultiProtagonistState,
} from "./multi-protagonist.js";

export interface MultiProtagonistBindingSourceSnapshot {
  readonly consumedInteractionIds: readonly string[];
  readonly consumedDialogueChoiceIds: readonly string[];
  readonly usedItemCombinationRecipeIds: readonly string[];
}

export interface MultiProtagonistBindingTransition {
  readonly state: MultiProtagonistState;
  readonly firedBindingIds: readonly string[];
}

const newlyAdded = (before: readonly string[], after: readonly string[]): ReadonlySet<string> => {
  const previous = new Set(before);
  return new Set(after.filter((value) => !previous.has(value)));
};

const bindingTriggered = (
  binding: RuntimeMultiProtagonistBinding,
  interactions: ReadonlySet<string>,
  choices: ReadonlySet<string>,
  recipes: ReadonlySet<string>,
): boolean => {
  switch (binding.source.kind) {
    case "interaction-consumed":
      return interactions.has(binding.source.interactionId);
    case "dialogue-choice-consumed":
      return choices.has(binding.source.choiceId);
    case "item-combination-used":
      return recipes.has(binding.source.recipeId);
  }
};

const applyEffect = (
  state: MultiProtagonistState,
  effect: RuntimeMultiProtagonistBinding["effects"][number],
): MultiProtagonistState => {
  switch (effect.kind) {
    case "set-shared-flag":
      return setSharedWorldFlag(state, effect.flag, effect.value);
    case "add-shared-fact":
      return discoverSharedWorldFact(state, effect.factId);
    case "set-protagonist-flag":
      return setProtagonistFlag(state, effect.protagonistId, effect.flag, effect.value);
    case "move-protagonist":
      return moveProtagonist(state, effect.protagonistId, {
        sceneId: effect.sceneId,
        entranceId: effect.entranceId,
      });
    case "give-protagonist-item":
      return giveProtagonistItem(state, effect.protagonistId, effect.itemId);
    case "remove-protagonist-item":
      return removeProtagonistItem(state, effect.protagonistId, effect.itemId);
    case "transfer-item":
      return transferProtagonistItem(
        state,
        effect.fromProtagonistId,
        effect.toProtagonistId,
        effect.itemId,
      );
  }
};

export const applyNewMultiProtagonistBindings = (
  manifest: RuntimeMultiProtagonistBindingManifest | null | undefined,
  state: MultiProtagonistState,
  previous: MultiProtagonistBindingSourceSnapshot,
  current: MultiProtagonistBindingSourceSnapshot,
): MultiProtagonistBindingTransition => {
  if (!manifest) return { state, firedBindingIds: [] };
  const interactions = newlyAdded(previous.consumedInteractionIds, current.consumedInteractionIds);
  const choices = newlyAdded(previous.consumedDialogueChoiceIds, current.consumedDialogueChoiceIds);
  const recipes = newlyAdded(previous.usedItemCombinationRecipeIds, current.usedItemCombinationRecipeIds);
  let next = state;
  const fired: string[] = [];
  for (const binding of [...manifest.bindings].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!bindingTriggered(binding, interactions, choices, recipes)) continue;
    for (const effect of binding.effects) next = applyEffect(next, effect);
    fired.push(binding.id);
  }
  return { state: next, firedBindingIds: fired };
};
