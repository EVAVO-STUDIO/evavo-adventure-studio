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
import type { AdventureRpgPackagedRuntimeController } from "./rpg-controller.js";
import { controlledActorRequestFromSave } from "./input.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

type OptionalRpgController = Partial<Pick<
  AdventureRpgPackagedRuntimeController,
  | "rpgState"
  | "practiceSkill"
  | "resolveSkillCheck"
  | "advanceRpgTime"
  | "restRpg"
  | "adjustResource"
  | "scheduleActive"
  | "createRpgImportSnapshot"
  | "activeCombatState"
  | "startCombat"
  | "issueCombatAction"
  | "advanceCombat"
  | "finishCombat"
>>;

export interface MultiProtagonistPackagedRuntimeController extends PackagedSessionController, OptionalRpgController {
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

const rpgApi = (getController: () => PackagedSessionController): OptionalRpgController => {
  const initial = getController() as PackagedSessionController & OptionalRpgController;
  const current = () => getController() as PackagedSessionController & OptionalRpgController;
  return {
    ...(initial.rpgState ? { rpgState: () => current().rpgState?.() as ReturnType<AdventureRpgPackagedRuntimeController["rpgState"]> } : {}),
    ...(initial.practiceSkill ? { practiceSkill: (skillId: string, amount?: number) => current().practiceSkill?.(skillId, amount) as ReturnType<AdventureRpgPackagedRuntimeController["practiceSkill"]> } : {}),
    ...(initial.resolveSkillCheck ? { resolveSkillCheck: (check) => current().resolveSkillCheck?.(check) as ReturnType<AdventureRpgPackagedRuntimeController["resolveSkillCheck"]> } : {}),
    ...(initial.advanceRpgTime ? { advanceRpgTime: (minutes: number) => current().advanceRpgTime?.(minutes) } : {}),
    ...(initial.restRpg ? { restRpg: (rule) => current().restRpg?.(rule) } : {}),
    ...(initial.adjustResource ? { adjustResource: (resourceId: string, delta: number) => current().adjustResource?.(resourceId, delta) } : {}),
    ...(initial.scheduleActive ? { scheduleActive: (window) => current().scheduleActive?.(window) ?? false } : {}),
    ...(initial.createRpgImportSnapshot ? { createRpgImportSnapshot: (sourceGameId: string, tags?: readonly string[]) => current().createRpgImportSnapshot?.(sourceGameId, tags) as ReturnType<AdventureRpgPackagedRuntimeController["createRpgImportSnapshot"]> } : {}),
    ...(initial.activeCombatState ? { activeCombatState: () => current().activeCombatState?.() ?? null } : {}),
    ...(initial.startCombat ? { startCombat: (encounterId: string) => current().startCombat?.(encounterId) as ReturnType<AdventureRpgPackagedRuntimeController["startCombat"]> } : {}),
    ...(initial.issueCombatAction ? { issueCombatAction: (action) => current().issueCombatAction?.(action) ?? [] } : {}),
    ...(initial.advanceCombat ? { advanceCombat: (ticks: number) => current().advanceCombat?.(ticks) ?? [] } : {}),
    ...(initial.finishCombat ? { finishCombat: () => current().finishCombat?.() as ReturnType<AdventureRpgPackagedRuntimeController["finishCombat"]> } : {}),
  };
};

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

  const recipeIds = (): readonly string[] => controller.itemCombinationUsedRecipeIds?.() ?? [];

  const applyBindingsAfter = (
    beforeWorld: InteractiveRuntimeWorldState,
    beforeRecipeIds: readonly string[],
  ): boolean => {
    const before = { world: beforeWorld, usedRecipeIds: beforeRecipeIds };
    const after = { world: controller.worldState(), usedRecipeIds: recipeIds() };
    const transition = applyNewMultiProtagonistBindings(bundle, before, after, companion);
    if (transition.state === companion) return false;
    companion = transition.state;
    pendingBindingIds.push(...transition.firedBindingIds);
    return true;
  };

  const commitCurrent = (): void => {
    companion = commitWorldToActiveProtagonist(companion, controller.worldState());
  };

  const rebuildActive = (state: MultiProtagonistState): void => {
    const globalWorld = controller.worldState();
    const baseSave = controller.createSaveGame();
    companion = state;
    controller = createControllerFor(companion.activeProtagonistId, globalWorld, baseSave);
  };

  const switchProtagonist = (protagonistId: ProtagonistId): void => {
    if (protagonistId === companion.activeProtagonistId) return;
    const globalWorld = controller.worldState();
    const baseSave = controller.createSaveGame();
    commitCurrent();
    companion = switchActiveProtagonist(companion, protagonistId);
    controller = createControllerFor(protagonistId, globalWorld, baseSave);
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
    controller = createControllerFor(companion.activeProtagonistId, save.world, save);
    pendingBindingIds = [];
    return controller.restoreSaveGame(
      createRuntimeSaveGame(bundle, projectMultiProtagonistIntoWorld(save.world, companion), {
        controlledActorInstanceId: actorInstanceId,
        selectedVerbId: save.interface.selectedVerbId,
        selectedItemId: save.interface.selectedItemId,
        statusText: save.interface.statusText,
        parser: save.interface.parser,
        ...companionOptions(save),
        multiProtagonist: companion,
      }),
    );
  };

  return {
    get selection() {
      return controller.selection;
    },
    activeProtagonistId: () => companion.activeProtagonistId,
    multiProtagonistState: () => companion,
    switchProtagonist,
    replaceMultiProtagonistState: rebuildActive,
    drainMultiProtagonistBindingIds: () => {
      const drained = pendingBindingIds;
      pendingBindingIds = [];
      return drained;
    },
    ...rpgApi(() => controller),
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
  createMultiProtagonistPackagedRuntimeControllerWithFactory(bundle, options, createBasePackagedSessionController);
