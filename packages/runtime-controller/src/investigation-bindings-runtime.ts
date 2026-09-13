import type { RuntimeBundle, RuntimeInvestigationEffect } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  advanceRuntimeInvestigationChapter,
  awardRuntimeInvestigationObjectives,
  discoverRuntimeInvestigationFacts,
  setRuntimeInvestigationFlag,
  type RuntimeInvestigationState,
  useRuntimeInvestigationResearchSource,
  useRuntimeInvestigationTopic,
} from "@evavo/adventure-scene-runtime/investigation-runtime";

const award = (bundle: RuntimeBundle, state: RuntimeInvestigationState): RuntimeInvestigationState =>
  awardRuntimeInvestigationObjectives(bundle, state);

export const applyRuntimeInvestigationEffect = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
  effect: RuntimeInvestigationEffect,
): RuntimeInvestigationState => {
  switch (effect.kind) {
    case "use-research-source":
      return award(bundle, useRuntimeInvestigationResearchSource(bundle, state, effect.sourceId));
    case "discover-facts":
      return award(
        bundle,
        discoverRuntimeInvestigationFacts(bundle, state, effect.factIds, {
          kind: effect.discoveryKind,
          sourceId: effect.sourceId,
          chapterId: state.chapterId,
        }),
      );
    case "use-topic":
      return award(bundle, useRuntimeInvestigationTopic(bundle, state, effect.topicId, effect.speakerId));
    case "set-flag":
      return award(bundle, setRuntimeInvestigationFlag(state, effect.flag, effect.value));
    case "advance-chapter": {
      const scored = award(bundle, state);
      return award(bundle, advanceRuntimeInvestigationChapter(bundle, scored));
    }
  }
};

export const applyConsumedRuntimeInvestigationBindings = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
  previousWorld: InteractiveRuntimeWorldState,
  nextWorld: InteractiveRuntimeWorldState,
): RuntimeInvestigationState => {
  const bindings = bundle.investigationBindings;
  if (!bindings) return state;
  const previousInteractions = new Set(previousWorld.story.consumedInteractionIds);
  const previousChoices = new Set(previousWorld.story.consumedDialogueChoiceIds);
  let next = state;

  for (const interactionId of nextWorld.story.consumedInteractionIds) {
    if (previousInteractions.has(interactionId)) continue;
    const binding = bindings.interactions.find((candidate) => candidate.interactionId === interactionId);
    for (const effect of binding?.effects ?? []) {
      next = applyRuntimeInvestigationEffect(bundle, next, effect);
    }
  }

  for (const choiceId of nextWorld.story.consumedDialogueChoiceIds) {
    if (previousChoices.has(choiceId)) continue;
    const binding = bindings.dialogueChoices.find((candidate) => candidate.choiceId === choiceId);
    for (const effect of binding?.effects ?? []) {
      next = applyRuntimeInvestigationEffect(bundle, next, effect);
    }
  }

  return next;
};
