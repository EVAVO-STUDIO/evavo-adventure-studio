import type { Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
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
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
  type PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";
import type { ParserBufferState, ParserKeyInput } from "./parser.js";
import type { ProfiledRuntimeCameraState } from "./profiled-camera.js";

export interface RoomScriptPackagedRuntimeController {
  roomScriptState(): RuntimeRoomScriptState;
  drainRoomScriptEvents(): readonly RuntimeRoomScriptEvent[];
  controlledActorInstanceId(): PackagedRuntimeController["controlledActorInstanceId"];
  worldState(): ReturnType<PackagedRuntimeController["worldState"]>;
  createFrame(tick: number): ResolvedFrame;
  setPointer(position: Point | null): void;
  setPressed(pressed: boolean): void;
  activate(position: Point): void;
  handleKey(input: ParserKeyInput): boolean;
  createSaveGame(): SaveGame;
  restoreSaveGame(input: unknown): number;
  statusText(): string;
  cameraState(): ProfiledRuntimeCameraState | null;
  parserState(): ParserBufferState;
  drainSceneAudioCueIds(): readonly string[];
}

export const createRoomScriptPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): RoomScriptPackagedRuntimeController => {
  let base = createPackagedRuntimeController(bundle, options);
  let roomScripts = createRuntimeRoomScriptState(base.worldState());
  let pendingEvents: RuntimeRoomScriptEvent[] = [];

  const saveWithRoomScripts = (): SaveGame => {
    const save = base.createSaveGame();
    return createRuntimeSaveGame(bundle, base.worldState(), {
      controlledActorInstanceId: save.interface.controlledActorInstanceId,
      selectedVerbId: save.interface.selectedVerbId,
      selectedItemId: save.interface.selectedItemId,
      statusText: save.interface.statusText,
      parser: save.interface.parser,
      ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
      ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
      ...(save.audio ? { audio: save.audio } : {}),
      ...(save.investigation ? { investigation: save.investigation } : {}),
      ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
      ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
      roomScripts,
    });
  };

  const restoreWorldAtSameTick = (world: ReturnType<PackagedRuntimeController["worldState"]>): void => {
    const save = base.createSaveGame();
    const next = createRuntimeSaveGame(bundle, world, {
      controlledActorInstanceId: save.interface.controlledActorInstanceId,
      selectedVerbId: save.interface.selectedVerbId,
      selectedItemId: save.interface.selectedItemId,
      statusText: save.interface.statusText,
      parser: save.interface.parser,
      ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
      ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
      roomScripts,
    });
    base.restoreSaveGame(next);
  };

  const applyRoomScripts = (): boolean => {
    const transition = advanceRuntimeRoomScripts(bundle, base.worldState(), roomScripts);
    roomScripts = transition.state;
    pendingEvents.push(...transition.events);
    if (transition.world === base.worldState()) return false;
    restoreWorldAtSameTick(transition.world);
    return true;
  };

  const createFrame = (tick: number): ResolvedFrame => {
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
    roomScriptState: () => roomScripts,
    drainRoomScriptEvents: () => {
      const events = pendingEvents;
      pendingEvents = [];
      return events;
    },
    controlledActorInstanceId: () => base.controlledActorInstanceId,
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
  };
};
