import type { RuntimeBundle, RuntimeAdventureRpgCombatEncounter } from "@evavo/adventure-runtime-bundle";
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
import {
  advanceAdventureRpgBoundCombat,
  createAdventureRpgBoundCombatState,
  issueAdventureRpgBoundCombatAction,
  type AdventureRpgBoundCombatState,
  type AdventureRpgCombatBinding,
} from "@evavo/adventure-scene-runtime/rpg-combat-integration";
import type {
  AdventureRpgCombatAction,
  AdventureRpgCombatEvent,
  AdventureRpgCombatPhase,
  AdventureRpgCombatState,
} from "@evavo/adventure-scene-runtime/rpg-combat";
import {
  resolveAdventureRpgPuzzleSolution,
  type AdventureRpgPuzzleResolution,
} from "@evavo/adventure-scene-runtime/rpg-puzzles";
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
  resolveRpgPuzzle(puzzleId: string, solutionId: string): AdventureRpgPuzzleResolution;
  advanceRpgTime(minutes: number): void;
  restRpg(rule: AdventureRpgRestRule): void;
  adjustResource(resourceId: string, delta: number): void;
  scheduleActive(window: AdventureRpgScheduleWindow): boolean;
  createRpgImportSnapshot(sourceGameId: string, tags?: readonly string[]): AdventureRpgImportSnapshot;
  activeCombatState(): AdventureRpgCombatState | null;
  startCombat(encounterId: string): AdventureRpgCombatState;
  issueCombatAction(action: AdventureRpgCombatAction): readonly AdventureRpgCombatEvent[];
  advanceCombat(ticks: number): readonly AdventureRpgCombatEvent[];
  finishCombat(): AdventureRpgCombatPhase;
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

const combatBinding = (encounter: RuntimeAdventureRpgCombatEncounter): AdventureRpgCombatBinding => ({
  ...encounter,
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
  let combat: { readonly encounter: RuntimeAdventureRpgCombatEncounter; readonly state: AdventureRpgBoundCombatState } | null = null;

  const createSaveGame = (): SaveGame => {
    if (combat?.state.combat.phase === "active") {
      throw new Error("Saving is disabled during active RPG combat; finish, flee or lose the encounter first.");
    }
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
    combat = null;
    return tick;
  };

  const replaceStoryAndRpg = (
    story: ReturnType<PackagedSessionController["worldState"]>["story"],
    nextRpg: AdventureRpgState,
  ): void => {
    const baseSave = controller.createSaveGame();
    rpg = nextRpg;
    const save = createRuntimeSaveGame(bundle, { ...controller.worldState(), story }, {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      rpg,
    });
    controller.restoreSaveGame(save);
  };

  const resolveRpgPuzzle = (
    puzzleId: string,
    solutionId: string,
  ): AdventureRpgPuzzleResolution => {
    if (!bundle.rpgPuzzles) {
      throw new Error(`Runtime bundle '${bundle.projectId}' has no RPG puzzle manifest.`);
    }
    const resolution = resolveAdventureRpgPuzzleSolution(
      manifest,
      bundle.rpgPuzzles,
      controller.worldState().story,
      rpg,
      puzzleId,
      solutionId,
    );
    if (resolution.kind === "success") {
      replaceStoryAndRpg(resolution.story, resolution.rpg);
    } else {
      rpg = resolution.rpg;
    }
    return resolution;
  };

  const startCombat = (encounterId: string): AdventureRpgCombatState => {
    if (combat?.state.combat.phase === "active") {
      throw new Error(`RPG combat '${combat.encounter.id}' is already active.`);
    }
    const encounter = manifest.combatEncounters.find((candidate) => candidate.id === encounterId);
    if (!encounter) throw new Error(`Unknown RPG combat encounter '${encounterId}'.`);
    const state = createAdventureRpgBoundCombatState(manifest, rpg, combatBinding(encounter));
    combat = { encounter, state };
    rpg = state.rpg;
    return state.combat;
  };

  const issueCombatAction = (action: AdventureRpgCombatAction): readonly AdventureRpgCombatEvent[] => {
    if (!combat) throw new Error("No RPG combat encounter is active.");
    const transition = issueAdventureRpgBoundCombatAction(
      manifest,
      combat.state,
      combatBinding(combat.encounter),
      action,
    );
    combat = { ...combat, state: transition };
    rpg = transition.rpg;
    return transition.events;
  };

  const advanceCombat = (ticks: number): readonly AdventureRpgCombatEvent[] => {
    if (!combat) throw new Error("No RPG combat encounter is active.");
    const transition = advanceAdventureRpgBoundCombat(
      manifest,
      combat.state,
      combatBinding(combat.encounter),
      ticks,
    );
    combat = { ...combat, state: transition };
    rpg = transition.rpg;
    return transition.events;
  };

  const finishCombat = (): AdventureRpgCombatPhase => {
    if (!combat) throw new Error("No RPG combat encounter is active.");
    const phase = combat.state.combat.phase;
    if (phase === "active") throw new Error("Active RPG combat cannot finish before victory, defeat or flee.");
    combat = null;
    return phase;
  };

  return {
    selection: controller.selection,
    rpgState: () => rpg,
    practiceSkill: (skillId, amount) => {
      const result = practiceAdventureRpgSkill(manifest, rpg, skillId, amount);
      rpg = result.state;
      return result;
    },
    resolveSkillCheck: (check) => resolveAdventureRpgCheck(manifest, rpg, check),
    resolveRpgPuzzle,
    advanceRpgTime: (minutes) => {
      rpg = advanceAdventureRpgTime(manifest, rpg, minutes);
    },
    restRpg: (rule) => {
      rpg = restAdventureRpg(manifest, rpg, rule);
    },
    adjustResource: (resourceId, delta) => {
      rpg = adjustAdventureRpgResource(manifest, rpg, resourceId, delta);
    },
    scheduleActive: (window) => adventureRpgScheduleActive(manifest, rpg, window),
    createRpgImportSnapshot: (sourceGameId, tags = []) => createAdventureRpgImportSnapshot(sourceGameId, rpg, tags),
    activeCombatState: () => combat?.state.combat ?? null,
    startCombat,
    issueCombatAction,
    advanceCombat,
    finishCombat,
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
  createAdventureRpgPackagedRuntimeControllerWithFactory(bundle, options, createBasePackagedSessionController);
