import type { RuntimeBundle, RuntimeMultiProtagonistBinding } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  giveProtagonistItem,
  moveProtagonist,
  removeProtagonistItem,
  setProtagonistFlag,
  setSharedWorldFlag,
  transferProtagonistItem,
  discoverSharedWorldFact,
  type MultiProtagonistState,
} from "@evavo/adventure-scene-runtime/multi-protagonist";

export interface MultiProtagonistBindingObservation {
  readonly world: InteractiveRuntimeWorldState;
  readonly usedRecipeIds: readonly string[];
}

const newlyAdded = (before: readonly string[], after: readonly string[]): ReadonlySet<string> => {
  const previous = new Set(before);
  return new Set(after.filter((value) => !previous.has(value)));
};

const sourceTriggered = (
  binding: RuntimeMultiProtagonistBinding,
  newInteractions: ReadonlySet<string>,
  newChoices: ReadonlySet<string>,
  newRecipes: ReadonlySet<string>,
): boolean => {
  const source = binding.source;
  if (source.kind === "interaction-consumed") return newInteractions.has(source.interactionId);
  if (source.kind === "dialogue-choice-consumed") return newChoices.has(source.choiceId);
  return newRecipes.has(source.recipeId);
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

export interface MultiProtagonistBindingTransition {
  readonly state: MultiProtagonistState;
  readonly firedBindingIds: readonly string[];
}

export const applyNewMultiProtagonistBindings = (
  bundle: Pick<RuntimeBundle, "multiProtagonistBindings">,
  before: MultiProtagonistBindingObservation,
  after: MultiProtagonistBindingObservation,
  state: MultiProtagonistState,
): MultiProtagonistBindingTransition => {
  const manifest = bundle.multiProtagonistBindings;
  if (!manifest) return { state, firedBindingIds: [] };
  const newInteractions = newlyAdded(
    before.world.story.consumedInteractionIds,
    after.world.story.consumedInteractionIds,
  );
  const newChoices = newlyAdded(
    before.world.story.consumedDialogueChoiceIds,
    after.world.story.consumedDialogueChoiceIds,
  );
  const newRecipes = newlyAdded(before.usedRecipeIds, after.usedRecipeIds);
  let next = state;
  const fired: string[] = [];
  for (const binding of [...manifest.bindings].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!sourceTriggered(binding, newInteractions, newChoices, newRecipes)) continue;
    for (const effect of binding.effects) next = applyEffect(next, effect);
    fired.push(binding.id);
  }
  return { state: next, firedBindingIds: fired };
};
