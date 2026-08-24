import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
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

export interface InvestigationPackagedRuntimeController extends PackagedRuntimeController {
  investigationState(): RuntimeInvestigationState | null;
  investigationChapterReadiness(): RuntimeInvestigationChapterReadiness | null;
  investigationPresence(): readonly NonNullable<RuntimeBundle["investigation"]>["presenceVariants"][number][];
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

  return {
    ...base,
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
    advanceInvestigationChapter: () =>
      update((state) => advanceRuntimeInvestigationChapter(bundle, state)),
  };
};
