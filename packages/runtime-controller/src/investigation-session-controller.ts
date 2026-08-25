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
import { applyConsumedRuntimeInvestigationBindings } from "./investigation-bindings-runtime.js";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

type RuntimeInvestigationPresenceVariant = NonNullable<
  NonNullable<RuntimeBundle["investigation"]>["presenceVariants"]
>[number];

export interface InvestigationPackagedSessionController extends PackagedSessionController {
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

const preservedCompanions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.routeTopology ? { routeTopology: save.routeTopology } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
});

const withObjectiveAwards = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
): RuntimeInvestigationState => awardRuntimeInvestigationObjectives(bundle, state);

export const createInvestigationPackagedSessionControllerWithFactory = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): InvestigationPackagedSessionController => {
  const inner = innerFactory(bundle, options);
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

  const applyNewSemanticBindings = (
    previousWorld: InteractiveRuntimeWorldState,
    nextWorld: InteractiveRuntimeWorldState,
  ): void => {
    if (!investigation) return;
    investigation = applyConsumedRuntimeInvestigationBindings(
      bundle,
      investigation,
      previousWorld,
      nextWorld,
    );
  };

  const createSaveGame = (): SaveGame => {
    const baseSave = inner.createSaveGame();
    return createRuntimeSaveGame(bundle, inner.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preservedCompanions(baseSave),
      ...(investigation ? { investigation } : {}),
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = inner.restoreSaveGame(save);
    investigation = save.investigation ?? createRuntimeInvestigationState(bundle);
    return tick;
  };

  const activate: PackagedSessionController["activate"] = (position) => {
    const previousWorld = inner.worldState();
    inner.activate(position);
    applyNewSemanticBindings(previousWorld, inner.worldState());
  };

  const handleKey: PackagedSessionController["handleKey"] = (input) => {
    const previousWorld = inner.worldState();
    const handled = inner.handleKey(input);
    applyNewSemanticBindings(previousWorld, inner.worldState());
    return handled;
  };

  const createFrame: PackagedSessionController["createFrame"] = (tick) => {
    const previousWorld = inner.worldState();
    const frame = inner.createFrame(tick);
    applyNewSemanticBindings(previousWorld, inner.worldState());
    return frame;
  };

  return {
    ...inner,
    get selection() {
      return inner.selection;
    },
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

export const createInvestigationPackagedSessionController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): InvestigationPackagedSessionController =>
  createInvestigationPackagedSessionControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
