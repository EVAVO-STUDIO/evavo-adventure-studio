import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
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
import {
  commitWorldToActiveProtagonist,
  projectMultiProtagonistIntoWorld,
} from "./multi-protagonist-projection.js";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
  type PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";
import { controlledActorRequestFromSave } from "./input.js";
import type { ParserBufferState, ParserKeyInput } from "./parser.js";
import type { ProfiledRuntimeCameraState } from "./profiled-camera.js";

export interface MultiProtagonistPackagedRuntimeController {
  activeProtagonistId(): ProtagonistId;
  multiProtagonistState(): MultiProtagonistState;
  switchProtagonist(protagonistId: ProtagonistId): void;
  controlledActorInstanceId(): Id<"actor-instance"> | null;
  worldState(): InteractiveRuntimeWorldState;
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

const initialCompanion = (bundle: RuntimeBundle): MultiProtagonistState => {
  const manifest = bundle.multiProtagonist;
  if (!manifest) throw new Error(`Runtime bundle '${bundle.projectId}' has no multi-protagonist manifest.`);
  return createMultiProtagonistState(manifest.protagonists, manifest.activeProtagonistId);
};

export const createMultiProtagonistPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: Omit<PackagedRuntimeControllerOptions, "requestedActorInstanceId"> = {},
): MultiProtagonistPackagedRuntimeController => {
  let companion = initialCompanion(bundle);
  let controller: PackagedRuntimeController;

  const createControllerFor = (
    protagonistId: ProtagonistId,
    sourceWorld?: InteractiveRuntimeWorldState,
  ): PackagedRuntimeController => {
    const actorInstanceId = actorInstanceIdForProtagonist(bundle, companion, protagonistId);
    const next = createPackagedRuntimeController(bundle, {
      ...options,
      requestedActorInstanceId: controlledActorRequestFromSave(actorInstanceId),
    });
    const baseSave = next.createSaveGame();
    const projectionBase = sourceWorld ?? next.worldState();
    const projectedWorld = projectMultiProtagonistIntoWorld(projectionBase, companion);
    const projectedSave = createRuntimeSaveGame(bundle, projectedWorld, {
      controlledActorInstanceId: actorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: null,
      statusText: `CONTROL • ${protagonistId}`,
      parser: baseSave.interface.parser,
      multiProtagonist: companion,
    });
    next.restoreSaveGame(projectedSave);
    return next;
  };

  controller = createControllerFor(companion.activeProtagonistId);

  const commitCurrent = (): void => {
    companion = commitWorldToActiveProtagonist(companion, controller.worldState());
  };

  const switchProtagonist = (protagonistId: ProtagonistId): void => {
    if (protagonistId === companion.activeProtagonistId) return;
    const globalWorld = controller.worldState();
    commitCurrent();
    companion = switchActiveProtagonist(companion, protagonistId);
    controller = createControllerFor(protagonistId, globalWorld);
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
      ...(baseSave.interface.profiledCamera ? { profiledCamera: baseSave.interface.profiledCamera } : {}),
      multiProtagonist: companion,
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    companion = save.multiProtagonist ?? initialCompanion(bundle);
    const actorInstanceId = actorInstanceIdForProtagonist(bundle, companion);
    controller = createPackagedRuntimeController(bundle, {
      ...options,
      requestedActorInstanceId: controlledActorRequestFromSave(actorInstanceId),
    });
    const restored = createRuntimeSaveGame(bundle, projectMultiProtagonistIntoWorld(save.world, companion), {
      controlledActorInstanceId: actorInstanceId,
      selectedVerbId: save.interface.selectedVerbId,
      selectedItemId: save.interface.selectedItemId,
      statusText: save.interface.statusText,
      parser: save.interface.parser,
      ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
      multiProtagonist: companion,
    });
    return controller.restoreSaveGame(restored);
  };

  return {
    activeProtagonistId: () => companion.activeProtagonistId,
    multiProtagonistState: () => companion,
    switchProtagonist,
    controlledActorInstanceId: () => controller.controlledActorInstanceId,
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
  };
};
