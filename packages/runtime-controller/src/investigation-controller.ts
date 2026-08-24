import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  advanceRuntimeInvestigationChapter,
  awardRuntimeInvestigationObjectives,
  createRuntimeInvestigationState,
  discoverRuntimeInvestigationFacts,
  evaluateRuntimeInvestigationChapter,
  runtimeInvestigationPresence,
  setRuntimeInvestigationFlag,
  type RuntimeInvestigationChapterReadiness,
  type RuntimeInvestigationDiscovery,
  type RuntimeInvestigationFactId,
  type RuntimeInvestigationSourceId,
  type RuntimeInvestigationState,
  type RuntimeInvestigationTopicId,
  useRuntimeInvestigationResearchSource,
  useRuntimeInvestigationTopic,
} from "@evavo/adventure-scene-runtime/investigation-runtime";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
  type PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";

type RuntimeInvestigationPresenceVariant = NonNullable<
  NonNullable<RuntimeBundle["investigation"]>["presenceVariants"]
>[number];
type RuntimeInvestigationEffect = NonNullable<
  RuntimeBundle["investigationBindings"]
>["interactions"][number]["effects"][number];

export interface InvestigationPackagedRuntimeController extends PackagedRuntimeController {
  investigationState(): RuntimeInvestigationState | null;
  investigationChapterReadiness(): RuntimeInvestigationChapterReadiness | null;
  investigationPresence(): readonly RuntimeInvestigationPresenceVariant[];
  discoverInvestigationFacts(
    factIds: readonly RuntimeInvestigationFactId[],
    discovery: RuntimeInvestigationDiscovery,
  ): RuntimeInvestigationState | null;
  useInvestigationResearchSource(sourceId: RuntimeInvestigationSourceId): RuntimeInvestigationState | null;
  useInvestigationTopic(topicId: RuntimeInvestigationTopicId, speakerId: string): RuntimeInvestigationState | null;
  setInvestigationFlag(flag: string, value: boolean): RuntimeInvestigationState | null;
  advanceInvestigationChapter(): RuntimeInvestigationState | null;
}

const withObjectiveAwards = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
): RuntimeInvestigationState => awardRuntimeInvestigationObjectives(bundle, state);

export const createInvestigationPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): InvestigationPackagedRuntimeController => {
  const base = createPackagedRuntimeController(bundle, options);
  let investigation = createRuntimeInvestigationState(bundle);

  const update = (
    mutator: (state: RuntimeInvestigationState) => RuntimeInvestigationState,
  ): RuntimeInvestigationState | null => {
    if (!investigation) return null;
    investigation = withObjectiveAwards(bundle, mutator(investigation));
    return investigation;
  };

  const advanceChapter = (): RuntimeInvestigationState | null => {
    if (!investigation) return null;
    investigation = withObjectiveAwards(bundle, investigation);
    investigation = advanceRuntimeInvestigationChapter(bundle, investigation);
    investigation = withObjectiveAwards(bundle, investigation);
    return investigation;
  };

  const applyEffect = (effect: RuntimeInvestigationEffect): void => {
    if (!investigation) return;
    switch (effect.kind) {
      case "use-research-source":
        update((state) => useRuntimeInvestigationResearchSource(bundle, state, effect.sourceId));
        return;
      case "discover-facts":
        update((state) =>
          discoverRuntimeInvestigationFacts(bundle, state, effect.factIds, {
            kind: effect.discoveryKind,
            sourceId: effect.sourceId,
            chapterId: state.chapterId,
          }),
        );
        return;
      case "use-topic":
        update((state) => useRuntimeInvestigationTopic(bundle, state, effect.topicId, effect.speakerId));
        return;
      case "set-flag":
        update((state) => setRuntimeInvestigationFlag(state, effect.flag, effect.value));
        return;
      case "advance-chapter":
        advanceChapter();
        return;
    }
  };

  const applyNewSemanticBindings = (
    previousWorld: InteractiveRuntimeWorldState,
    nextWorld: InteractiveRuntimeWorldState,
  ): void => {
    const bindings = bundle.investigationBindings;
    if (!investigation || !bindings) return;
    const previousInteractions = new Set(previousWorld.story.consumedInteractionIds);
    const previousChoices = new Set(previousWorld.story.consumedDialogueChoiceIds);

    for (const interactionId of nextWorld.story.consumedInteractionIds) {
      if (previousInteractions.has(interactionId)) continue;
      const binding = bindings.interactions.find((candidate) => candidate.interactionId === interactionId);
      for (const effect of binding?.effects ?? []) applyEffect(effect);
    }
    for (const choiceId of nextWorld.story.consumedDialogueChoiceIds) {
      if (previousChoices.has(choiceId)) continue;
      const binding = bindings.dialogueChoices.find((candidate) => candidate.choiceId === choiceId);
      for (const effect of binding?.effects ?? []) applyEffect(effect);
    }
  };

  const createSaveGame = (): SaveGame => {
    const baseSave = base.createSaveGame();
    return createRuntimeSaveGame(bundle, base.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...(baseSave.interface.profiledCamera
        ? { profiledCamera: baseSave.interface.profiledCamera }
        : {}),
      ...(investigation ? { investigation } : {}),
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = base.restoreSaveGame(save);
    investigation = save.investigation ?? createRuntimeInvestigationState(bundle);
    return tick;
  };

  const activate: PackagedRuntimeController["activate"] = (position) => {
    const previousWorld = base.worldState();
    base.activate(position);
    applyNewSemanticBindings(previousWorld, base.worldState());
  };

  const handleKey: PackagedRuntimeController["handleKey"] = (input) => {
    const previousWorld = base.worldState();
    const handled = base.handleKey(input);
    applyNewSemanticBindings(previousWorld, base.worldState());
    return handled;
  };

  const createFrame: PackagedRuntimeController["createFrame"] = (tick) => {
    const previousWorld = base.worldState();
    const frame = base.createFrame(tick);
    applyNewSemanticBindings(previousWorld, base.worldState());
    return frame;
  };

  return {
    ...base,
    activate,
    handleKey,
    createFrame,
    createSaveGame,
    restoreSaveGame,
    investigationState: () => investigation,
    investigationChapterReadiness: () =>
      investigation ? evaluateRuntimeInvestigationChapter(bundle, investigation) : null,
    investigationPresence: () =>
      investigation ? runtimeInvestigationPresence(bundle, investigation) : [],
    discoverInvestigationFacts: (factIds, discovery) =>
      update((state) => discoverRuntimeInvestigationFacts(bundle, state, factIds, discovery)),
    useInvestigationResearchSource: (sourceId) =>
      update((state) => useRuntimeInvestigationResearchSource(bundle, state, sourceId)),
    useInvestigationTopic: (topicId, speakerId) =>
      update((state) => useRuntimeInvestigationTopic(bundle, state, topicId, speakerId)),
    setInvestigationFlag: (flag, value) =>
      update((state) => setRuntimeInvestigationFlag(state, flag, value)),
    advanceInvestigationChapter: advanceChapter,
  };
};
