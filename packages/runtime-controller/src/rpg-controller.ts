import type { RuntimeBundle, RuntimeAdventureRpgCombatEncounter } from "@evavo/adventure-runtime-bundle";
import {
  RuntimeAdventureRpgEconomyValidationError,
  validateRuntimeAdventureRpgEconomy,
} from "@evavo/adventure-runtime-bundle/rpg-economy";
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
  adventureRpgEquipmentModifiers,
  buyAdventureRpgItem,
  createAdventureRpgEconomyState,
  equipAdventureRpgItem,
  sellAdventureRpgItem,
  unequipAdventureRpgSlot,
  type AdventureRpgEconomyResult,
  type AdventureRpgEconomyState,
} from "@evavo/adventure-scene-runtime/rpg-economy";
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
  rpgEconomyState(): AdventureRpgEconomyState | null;
  buyRpgItem(shopId: string, itemId: string): AdventureRpgEconomyResult;
  sellRpgItem(shopId: string, itemId: string): AdventureRpgEconomyResult;
  equipRpgItem(itemId: string): AdventureRpgEconomyResult;
  unequipRpgSlot(slotId: string): void;
  rpgEquipmentModifiers(): Readonly<Record<string, number>>;
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
  ...(save.rpgEconomy ? { rpgEconomy: save.rpgEconomy } : {}),
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
  const economyManifest = manifest.economy ?? null;
  if (economyManifest) {
    const economyIssues = validateRuntimeAdventureRpgEconomy(
      economyManifest,
      new Set(bundle.inventoryItems.map((item) => item.id as string)),
    );
    if (economyIssues.length > 0) throw new RuntimeAdventureRpgEconomyValidationError(economyIssues);
  }
  let economy = economyManifest ? createAdventureRpgEconomyState(economyManifest) : null;
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
      ...(economy ? { rpgEconomy: economy } : {}),
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = controller.restoreSaveGame(save);
    rpg = save.rpg ?? createAdventureRpgState(manifest, defaultClassId);
    economy = economyManifest
      ? (save.rpgEconomy ?? createAdventureRpgEconomyState(economyManifest))
      : null;
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
      ...(economy ? { rpgEconomy: economy } : {}),
    });
    controller.restoreSaveGame(save);
  };

  const applyEconomyResult = (result: AdventureRpgEconomyResult): AdventureRpgEconomyResult => {
    if (result.kind !== "success") return result;
    economy = result.economy;
    if (result.world !== controller.worldState()) {
      replaceStoryAndRpg(result.world.story, rpg);
    }
    return result;
  };

  const requireEconomy = () => {
    if (!economyManifest || !economy) {
      throw new Error(`Runtime bundle '${bundle.projectId}' has no RPG economy manifest.`);
    }
    return { manifest: economyManifest, state: economy };
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

  const classTags = (): readonly string[] =>
    manifest.classes.find((entry) => entry.id === rpg.classId)?.tags ?? [];

  return {
    selection: controller.selection,
    rpgState: () => rpg,
    rpgEconomyState: () => economy,
    buyRpgItem: (shopId, itemId) => {
      const current = requireEconomy();
      return applyEconomyResult(
        buyAdventureRpgItem(current.manifest, controller.worldState(), current.state, shopId, itemId as never),
      );
    },
    sellRpgItem: (shopId, itemId) => {
      const current = requireEconomy();
      return applyEconomyResult(
        sellAdventureRpgItem(current.manifest, controller.worldState(), current.state, shopId, itemId as never),
      );
    },
    equipRpgItem: (itemId) => {
      const current = requireEconomy();
      return applyEconomyResult(
        equipAdventureRpgItem(current.manifest, controller.worldState(), current.state, itemId as never, classTags()),
      );
    },
    unequipRpgSlot: (slotId) => {
      const current = requireEconomy();
      economy = unequipAdventureRpgSlot(current.state, slotId);
    },
    rpgEquipmentModifiers: () => {
      const current = requireEconomy();
      return adventureRpgEquipmentModifiers(current.manifest, current.state);
    },
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
