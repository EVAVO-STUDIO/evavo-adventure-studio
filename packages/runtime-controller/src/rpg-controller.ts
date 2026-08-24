import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  adjustAdventureRpgResource,
  adventureRpgScheduleActive,
  createAdventureRpgImportSnapshot,
  createAdventureRpgState,
  practiceAdventureRpgSkill,
  resolveAdventureRpgCheck,
  restAdventureRpg,
  advanceAdventureRpgTime,
  type AdventureRpgCheck,
  type AdventureRpgCheckResult,
  type AdventureRpgImportSnapshot,
  type AdventureRpgPracticeResult,
  type AdventureRpgRestRule,
  type AdventureRpgScheduleWindow,
  type AdventureRpgState,
} from "@evavo/adventure-scene-runtime/rpg";
import { projectAdventureRpgIntoStory } from "@evavo/adventure-scene-runtime/rpg-projection";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface AdventureRpgSessionOptions extends PackagedRuntimeControllerOptions {
  readonly rpgClassId?: string;
}

export interface AdventureRpgPackagedRuntimeController extends PackagedSessionController {
  rpgState(): AdventureRpgState;
  practiceSkill(skillId: string, amount?: number): AdventureRpgPracticeResult;
  resolveSkillCheck(check: AdventureRpgCheck): AdventureRpgCheckResult;
  advanceRpgTime(minutes: number): void;
  restRpg(rule: AdventureRpgRestRule): void;
  adjustResource(resourceId: string, delta: number): void;
  scheduleActive(window: AdventureRpgScheduleWindow): boolean;
  createRpgImportSnapshot(sourceGameId: string, tags?: readonly string[]): AdventureRpgImportSnapshot;
}

const preserveCompanions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
});

export const createAdventureRpgPackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: AdventureRpgSessionOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): AdventureRpgPackagedRuntimeController => {
  const manifest = bundle.rpg;
  if (!manifest) throw new Error(`Runtime bundle '${bundle.projectId}' has no RPG manifest.`);
  const { rpgClassId, ...baseOptions } = options;
  const defaultClassId = rpgClassId ?? manifest.classes[0]?.id;
  if (!defaultClassId) throw new Error("RPG manifest contains no playable class.");
  const controller = innerFactory(bundle, baseOptions);
  let rpg = createAdventureRpgState(manifest, defaultClassId);

  const synchronizeProjection = (): void => {
    const baseSave = controller.createSaveGame();
    const world = controller.worldState();
    const projectedWorld = {
      ...world,
      story: projectAdventureRpgIntoStory(manifest, rpg, world.story),
    };
    const projectedSave = createRuntimeSaveGame(bundle, projectedWorld, {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      rpg,
    });
    controller.restoreSaveGame(projectedSave);
  };

  synchronizeProjection();

  const createSaveGame = (): SaveGame => {
    const baseSave = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      rpg,
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = controller.restoreSaveGame(save);
    rpg = save.rpg ?? createAdventureRpgState(manifest, defaultClassId);
    synchronizeProjection();
    return tick;
  };

  const mutateRpg = (next: AdventureRpgState): void => {
    rpg = next;
    synchronizeProjection();
  };

  return {
    selection: controller.selection,
    rpgState: () => rpg,
    practiceSkill: (skillId, amount) => {
      const result = practiceAdventureRpgSkill(manifest, rpg, skillId, amount);
      mutateRpg(result.state);
      return { ...result, state: rpg };
    },
    resolveSkillCheck: (check) => resolveAdventureRpgCheck(manifest, rpg, check),
    advanceRpgTime: (minutes) => {
      mutateRpg(advanceAdventureRpgTime(manifest, rpg, minutes));
    },
    restRpg: (rule) => {
      mutateRpg(restAdventureRpg(manifest, rpg, rule));
    },
    adjustResource: (resourceId, delta) => {
      mutateRpg(adjustAdventureRpgResource(manifest, rpg, resourceId, delta));
    },
    scheduleActive: (window) => adventureRpgScheduleActive(manifest, rpg, window),
    createRpgImportSnapshot: (sourceGameId, tags = []) =>
      createAdventureRpgImportSnapshot(sourceGameId, rpg, tags),
    controlledActorInstanceId: () => controller.controlledActorInstanceId(),
    worldState: () => controller.worldState(),
    createFrame: (tick) => controller.createFrame(tick),
    setPointer: (position) => controller.setPointer(position),
    setPressed: (pressed) => controller.setPressed(pressed),
    activate: (position) => controller.activate(position),
    handleKey: (input) => controller.handleKey(input),
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

export const createAdventureRpgPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: AdventureRpgSessionOptions = {},
): AdventureRpgPackagedRuntimeController =>
  createAdventureRpgPackagedRuntimeControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
