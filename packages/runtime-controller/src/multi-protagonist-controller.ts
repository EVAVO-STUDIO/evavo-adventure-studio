import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  createMultiProtagonistState,
  switchActiveProtagonist,
  type MultiProtagonistState,
  type ProtagonistId,
} from "@evavo/adventure-scene-runtime/multi-protagonist";
import { actorInstanceIdForProtagonist } from "./multi-protagonist-actor.js";
import { applyNewMultiProtagonistBindings } from "./multi-protagonist-bindings-runtime.js";
import {
  commitWorldToActiveProtagonist,
  projectMultiProtagonistIntoWorld,
} from "./multi-protagonist-projection.js";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import { controlledActorRequestFromSave } from "./input.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface MultiProtagonistPackagedRuntimeController extends PackagedSessionController {
  activeProtagonistId(): ProtagonistId;
  multiProtagonistState(): MultiProtagonistState;
  switchProtagonist(protagonistId: ProtagonistId): void;
  replaceMultiProtagonistState(state: MultiProtagonistState): void;
  drainMultiProtagonistBindingIds(): readonly string[];
}

const initialCompanion = (bundle: RuntimeBundle): MultiProtagonistState => {
  const manifest = bundle.multiProtagonist;
  if (!manifest) throw new Error(`Runtime bundle '${bundle.projectId}' has no multi-protagonist manifest.`);
  return createMultiProtagonistState(manifest.protagonists, manifest.activeProtagonistId);
};

const companionOptions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
});

export const createMultiProtagonistPackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: Omit<PackagedRuntimeControllerOptions, "requestedActorInstanceId"> = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): MultiProtagonistPackagedRuntimeController => {
  let companion = initialCompanion(bundle);
  let controller: PackagedSessionController;
  let pendingBindingIds: string[] = [];

  const createControllerFor = (
    protagonistId: ProtagonistId,
    sourceWorld?: InteractiveRuntimeWorldState,
    sourceSave?: SaveGame,
  ): PackagedSessionController => {
    const actorInstanceId = actorInstanceIdForProtagonist(bundle, companion, protagonistId);
    const next = innerFactory(bundle, {
      ...options,
      requestedActorInstanceId: controlledActorRequestFromSave(actorInstanceId),
    });
    const baseSave = sourceSave ?? next.createSaveGame();
    const projectionBase = sourceWorld ?? next.worldState();
    const projectedWorld = projectMultiProtagonistIntoWorld(projectionBase, companion);
    const projectedSave = createRuntimeSaveGame(bundle, projectedWorld, {
      controlledActorInstanceId: actorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: null,
      statusText: `CONTROL • ${protagonistId}`,
      parser: baseSave.interface.parser,
      ...companionOptions(baseSave),
      multiProtagonist: companion,
    });
    next.restoreSaveGame(projectedSave);
    return next;
  };

  controller = createControllerFor(companion.activeProtagonistId);

  const commitCurrent = (): void => {
    companion = commitWorldToActiveProtagonist(companion, controller.worldState());
  };

  const rebuildActive = (state: MultiProtagonistState): void => {
    const globalWorld = controller.worldState();
    const sourceSave = controller.createSaveGame();
    companion = state;
    controller = createControllerFor(companion.activeProtagonistId, globalWorld, sourceSave);
  };

  const recipeIds = (): readonly string[] => controller.itemCombinationUsedRecipeIds?.() ?? [];

  const applyBindingsAfter = (
    beforeWorld: InteractiveRuntimeWorldState,
    beforeRecipeIds: readonly string[],
  ): boolean => {
    const transition = applyNewMultiProtagonistBindings(
      bundle,
      { world: beforeWorld, usedRecipeIds: beforeRecipeIds },
      { world: controller.worldState(), usedRecipeIds: recipeIds() },
      companion,
    );
    if (transition.firedBindingIds.length === 0) return false;
    pendingBindingIds.push(...transition.firedBindingIds);
    rebuildActive(transition.state);
    return true;
  };

  const switchProtagonist = (protagonistId: ProtagonistId): void => {
    if (protagonistId === companion.activeProtagonistId) return;
    const globalWorld = controller.worldState();
    const sourceSave = controller.createSaveGame();
    commitCurrent();
    companion = switchActiveProtagonist(companion, protagonistId);
    controller = createControllerFor(protagonistId, globalWorld, sourceSave);
  };

  const createSaveGame = (): SaveGame => {
    commitCurrent();
    const baseSave = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...companionOptions(baseSave),
      multiProtagonist: companion,
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    companion = save.multiProtagonist ?? initialCompanion(bundle);
    const actorInstanceId = actorInstanceIdForProtagonist(bundle, companion);
    controller = innerFactory(bundle, {
      ...options,
      requestedActorInstanceId: controlledActorRequestFromSave(actorInstanceId),
    });
    const restored = createRuntimeSaveGame(
      bundle,
      projectMultiProtagonistIntoWorld(save.world, companion),
      {
        controlledActorInstanceId: actorInstanceId,
        selectedVerbId: save.interface.selectedVerbId,
        selectedItemId: save.interface.selectedItemId,
        statusText: save.interface.statusText,
        parser: save.interface.parser,
        ...companionOptions(save),
        multiProtagonist: companion,
      },
    );
    pendingBindingIds = [];
    return controller.restoreSaveGame(restored);
  };

  return {
    activeProtagonistId: () => companion.activeProtagonistId,
    multiProtagonistState: () => companion,
    switchProtagonist,
    replaceMultiProtagonistState: rebuildActive,
    drainMultiProtagonistBindingIds: () => {
      const drained = pendingBindingIds;
      pendingBindingIds = [];
      return drained;
    },
    controlledActorInstanceId: () => controller.controlledActorInstanceId(),
    worldState: () => controller.worldState(),
    createFrame: (tick) => {
      const beforeWorld = controller.worldState();
      const beforeRecipeIds = recipeIds();
      let frame = controller.createFrame(tick);
      if (applyBindingsAfter(beforeWorld, beforeRecipeIds)) frame = controller.createFrame(tick);
      return frame;
    },
    setPointer: (position) => controller.setPointer(position),
    setPressed: (pressed) => controller.setPressed(pressed),
    activate: (position) => {
      const beforeWorld = controller.worldState();
      const beforeRecipeIds = recipeIds();
      controller.activate(position);
      applyBindingsAfter(beforeWorld, beforeRecipeIds);
    },
    handleKey: (input) => {
      const beforeWorld = controller.worldState();
      const beforeRecipeIds = recipeIds();
      const handled = controller.handleKey(input);
      applyBindingsAfter(beforeWorld, beforeRecipeIds);
      return handled;
    },
    createSaveGame,
    restoreSaveGame,
    statusText: () => controller.statusText(),
    cameraState: () => controller.cameraState(),
    parserState: () => controller.parserState(),
    drainSceneAudioCueIds: () => controller.drainSceneAudioCueIds(),
    ...(controller.itemCombinationUsedRecipeIds
      ? { itemCombinationUsedRecipeIds: () => controller.itemCombinationUsedRecipeIds?.() ?? [] }
      : {}),
  };
};

export const createMultiProtagonistPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: Omit<PackagedRuntimeControllerOptions, "requestedActorInstanceId"> = {},
): MultiProtagonistPackagedRuntimeController =>
  createMultiProtagonistPackagedRuntimeControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
