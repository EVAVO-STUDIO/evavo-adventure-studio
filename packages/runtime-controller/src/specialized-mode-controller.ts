import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  activateSpecializedAdventureModeSession,
  advanceSpecializedAdventureModeSession,
  createSpecializedAdventureModeSessionState,
  startSpecializedAdventureModeSession,
  type SpecializedAdventureModeSessionState,
} from "@evavo/adventure-scene-runtime/specialized-mode-session";
import { nativeScreenPointToWorld } from "./input.js";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface SpecializedModePackagedRuntimeController extends PackagedSessionController {
  specializedModeState(): SpecializedAdventureModeSessionState;
  activeSpecializedModeId(): string | null;
  startSpecializedMode(modeId: string): void;
}

const preserveCompanions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.routeTopology ? { routeTopology: save.routeTopology } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
});

export const createSpecializedModePackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): SpecializedModePackagedRuntimeController => {
  if (!bundle.specializedModes) {
    throw new Error(`Runtime bundle '${bundle.projectId}' has no specializedModes manifest.`);
  }
  const controller = innerFactory(bundle, options);
  let specialized = createSpecializedAdventureModeSessionState(controller.worldState());

  const replaceWorld = (
    world: ReturnType<PackagedSessionController["worldState"]>,
  ): void => {
    const baseSave = controller.createSaveGame();
    const save = createRuntimeSaveGame(bundle, world, {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      specializedModes: specialized,
    });
    controller.restoreSaveGame(save);
  };

  const applyTransition = (
    transition: ReturnType<typeof advanceSpecializedAdventureModeSession>,
  ): void => {
    specialized = transition.state;
    if (transition.world !== controller.worldState()) replaceWorld(transition.world);
  };

  const evaluateAutomaticModes = (): void => {
    applyTransition(
      advanceSpecializedAdventureModeSession(bundle, controller.worldState(), specialized),
    );
  };

  const startSpecializedMode = (modeId: string): void => {
    applyTransition(
      startSpecializedAdventureModeSession(
        bundle,
        controller.worldState(),
        specialized,
        modeId,
      ),
    );
  };

  const activate = (position: Point): void => {
    if (!specialized.active) {
      controller.activate(position);
      evaluateAutomaticModes();
      return;
    }
    const frame = controller.createFrame(controller.worldState().story.tick);
    const worldPoint = nativeScreenPointToWorld(position, frame.camera);
    applyTransition(
      activateSpecializedAdventureModeSession(
        bundle,
        controller.worldState(),
        specialized,
        worldPoint,
      ),
    );
  };

  const createFrame = (tick: number) => {
    const first = controller.createFrame(tick);
    const beforeWorld = controller.worldState();
    const beforeMode = specialized.active?.modeId ?? null;
    const beforeState = specialized.active?.stateId ?? null;
    evaluateAutomaticModes();
    const changed =
      controller.worldState() !== beforeWorld ||
      (specialized.active?.modeId ?? null) !== beforeMode ||
      (specialized.active?.stateId ?? null) !== beforeState;
    return changed ? controller.createFrame(tick) : first;
  };

  const createSaveGame = (): SaveGame => {
    const baseSave = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      specializedModes: specialized,
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = controller.restoreSaveGame(save);
    specialized = save.specializedModes ?? createSpecializedAdventureModeSessionState(controller.worldState());
    return tick;
  };

  return {
    ...controller,
    selection: controller.selection,
    specializedModeState: () => specialized,
    activeSpecializedModeId: () => specialized.active?.modeId ?? null,
    startSpecializedMode,
    controlledActorInstanceId: () => controller.controlledActorInstanceId(),
    worldState: () => controller.worldState(),
    createFrame,
    setPointer: (position) => controller.setPointer(position),
    setPressed: (pressed) => controller.setPressed(pressed),
    activate,
    handleKey: (input) => specialized.active ? false : controller.handleKey(input),
    createSaveGame,
    restoreSaveGame,
    statusText: () =>
      specialized.active
        ? `${specialized.active.kind.toUpperCase()} • ${specialized.active.stateId}`
        : controller.statusText(),
    cameraState: () => controller.cameraState(),
    parserState: () => controller.parserState(),
    drainSceneAudioCueIds: () => controller.drainSceneAudioCueIds(),
  };
};

export const createSpecializedModePackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): SpecializedModePackagedRuntimeController =>
  createSpecializedModePackagedRuntimeControllerWithFactory(bundle, options);
