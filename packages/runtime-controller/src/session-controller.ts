import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "@evavo/adventure-save-game";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
  type PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";
import type { ParserBufferState, ParserKeyInput } from "./parser.js";
import type { ProfiledRuntimeCameraState } from "./profiled-camera.js";

export interface PackagedSessionController {
  readonly selection: PackagedRuntimeController["selection"];
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
  itemCombinationUsedRecipeIds?(): readonly string[];
}

export type PackagedSessionControllerFactory = (
  bundle: RuntimeBundle,
  options?: PackagedRuntimeControllerOptions,
) => PackagedSessionController;

export const createBasePackagedSessionController: PackagedSessionControllerFactory = (
  bundle,
  options = {},
) => {
  const base = createPackagedRuntimeController(bundle, options);
  return {
    selection: base.selection,
    controlledActorInstanceId: () => base.controlledActorInstanceId,
    worldState: () => base.worldState(),
    createFrame: (tick) => base.createFrame(tick),
    setPointer: (position) => base.setPointer(position),
    setPressed: (pressed) => base.setPressed(pressed),
    activate: (position) => base.activate(position),
    handleKey: (input) => base.handleKey(input),
    createSaveGame: () => base.createSaveGame(),
    restoreSaveGame: (input) => base.restoreSaveGame(input),
    statusText: () => base.statusText(),
    cameraState: () => base.cameraState(),
    parserState: () => base.parserState(),
    drainSceneAudioCueIds: () => base.drainSceneAudioCueIds(),
  };
};
