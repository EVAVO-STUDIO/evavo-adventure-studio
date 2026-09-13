import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  advanceRuntimeRoomScripts,
  createRuntimeRoomScriptState,
  type RuntimeRoomScriptEvent,
  type RuntimeRoomScriptState,
} from "@evavo/adventure-scene-runtime/room-scripts";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface RoomScriptPackagedRuntimeController extends PackagedSessionController {
  roomScriptState(): RuntimeRoomScriptState;
  drainRoomScriptEvents(): readonly RuntimeRoomScriptEvent[];
}

export const createRoomScriptPackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): RoomScriptPackagedRuntimeController => {
  const base = innerFactory(bundle, options);
  let roomScripts = createRuntimeRoomScriptState(base.worldState());
  let pendingEvents: RuntimeRoomScriptEvent[] = [];

  const preserveCompanions = (save: SaveGame) => ({
    ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
    ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
    ...(save.audio ? { audio: save.audio } : {}),
    ...(save.investigation ? { investigation: save.investigation } : {}),
    ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
    ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
    ...(save.rpg ? { rpg: save.rpg } : {}),
  });

  const saveWithRoomScripts = (): SaveGame => {
    const save = base.createSaveGame();
    return createRuntimeSaveGame(bundle, base.worldState(), {
      controlledActorInstanceId: save.interface.controlledActorInstanceId,
      selectedVerbId: save.interface.selectedVerbId,
      selectedItemId: save.interface.selectedItemId,
      statusText: save.interface.statusText,
      parser: save.interface.parser,
      ...preserveCompanions(save),
      roomScripts,
    });
  };

  const restoreWorldAtSameTick = (world: ReturnType<PackagedSessionController["worldState"]>): void => {
    const save = base.createSaveGame();
    const next = createRuntimeSaveGame(bundle, world, {
      controlledActorInstanceId: save.interface.controlledActorInstanceId,
      selectedVerbId: save.interface.selectedVerbId,
      selectedItemId: save.interface.selectedItemId,
      statusText: save.interface.statusText,
      parser: save.interface.parser,
      ...preserveCompanions(save),
      roomScripts,
    });
    base.restoreSaveGame(next);
  };

  const applyRoomScripts = (): boolean => {
    const currentWorld = base.worldState();
    const transition = advanceRuntimeRoomScripts(bundle, currentWorld, roomScripts);
    roomScripts = transition.state;
    pendingEvents.push(...transition.events);
    if (transition.world === currentWorld) return false;
    restoreWorldAtSameTick(transition.world);
    return true;
  };

  const createFrame = (tick: number) => {
    let frame = base.createFrame(tick);
    if (applyRoomScripts()) frame = base.createFrame(tick);
    return frame;
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = base.restoreSaveGame(save);
    roomScripts = save.roomScripts ?? createRuntimeRoomScriptState(base.worldState());
    pendingEvents = [];
    return tick;
  };

  return {
    selection: base.selection,
    roomScriptState: () => roomScripts,
    drainRoomScriptEvents: () => {
      const events = pendingEvents;
      pendingEvents = [];
      return events;
    },
    controlledActorInstanceId: () => base.controlledActorInstanceId(),
    worldState: () => base.worldState(),
    createFrame,
    setPointer: (position) => base.setPointer(position),
    setPressed: (pressed) => base.setPressed(pressed),
    activate: (position) => base.activate(position),
    handleKey: (input) => base.handleKey(input),
    createSaveGame: saveWithRoomScripts,
    restoreSaveGame,
    statusText: () => base.statusText(),
    cameraState: () => base.cameraState(),
    parserState: () => base.parserState(),
    drainSceneAudioCueIds: () => base.drainSceneAudioCueIds(),
    ...(base.itemCombinationUsedRecipeIds
      ? { itemCombinationUsedRecipeIds: () => base.itemCombinationUsedRecipeIds?.() ?? [] }
      : {}),
  };
};

export const createRoomScriptPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): RoomScriptPackagedRuntimeController =>
  createRoomScriptPackagedRuntimeControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
