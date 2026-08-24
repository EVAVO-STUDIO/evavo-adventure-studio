import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type {
  PackagedRuntimeController,
  PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";
import {
  createMultiProtagonistPackagedRuntimeControllerWithFactory,
  type MultiProtagonistPackagedRuntimeController,
} from "./multi-protagonist-controller.js";
import { createRoomScriptPackagedRuntimeControllerWithFactory } from "./room-script-controller.js";
import { createAdventureRpgPackagedRuntimeControllerWithFactory } from "./rpg-controller.js";
import { createSentencePackagedRuntimeControllerWithFactory } from "./sentence-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface PackagedFeatureSessionController extends PackagedSessionController {
  activeProtagonistId?(): ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]>;
  multiProtagonistState?(): ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]>;
  switchProtagonist?(protagonistId: Parameters<MultiProtagonistPackagedRuntimeController["switchProtagonist"]>[0]): void;
}

export interface PackagedFeatureRuntimeController extends PackagedRuntimeController {
  activeProtagonistId?(): ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]>;
  multiProtagonistState?(): ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]>;
  switchProtagonist?(protagonistId: Parameters<MultiProtagonistPackagedRuntimeController["switchProtagonist"]>[0]): void;
}

export interface PackagedFeatureSessionDescription {
  readonly sentence: boolean;
  readonly roomScripts: boolean;
  readonly rpg: boolean;
  readonly multiProtagonist: boolean;
  readonly stack: readonly string[];
}

export const describePackagedFeatureSession = (
  bundle: RuntimeBundle,
): PackagedFeatureSessionDescription => {
  const sentence =
    bundle.presentation.interactionMode === "verb-list" &&
    bundle.uiSkins !== undefined &&
    bundle.bitmapFonts !== undefined;
  const roomScripts = bundle.roomScripts !== undefined;
  const rpg = bundle.rpg !== undefined;
  const multiProtagonist = bundle.multiProtagonist !== undefined;
  return {
    sentence,
    roomScripts,
    rpg,
    multiProtagonist,
    stack: [
      "base",
      ...(sentence ? ["sentence"] : []),
      ...(roomScripts ? ["room-scripts"] : []),
      ...(rpg ? ["rpg"] : []),
      ...(multiProtagonist ? ["multi-protagonist"] : []),
    ],
  };
};

const sentenceFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createSentencePackagedRuntimeControllerWithFactory(bundle, options, inner);

const roomScriptFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createRoomScriptPackagedRuntimeControllerWithFactory(bundle, options, inner);

const rpgFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createAdventureRpgPackagedRuntimeControllerWithFactory(bundle, options, inner);

export const createPackagedFeatureSessionController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedFeatureSessionController => {
  const description = describePackagedFeatureSession(bundle);
  let inner: PackagedSessionControllerFactory = createBasePackagedSessionController;
  if (description.sentence) inner = sentenceFactory(inner);
  if (description.roomScripts) inner = roomScriptFactory(inner);
  if (description.rpg) inner = rpgFactory(inner);
  if (description.multiProtagonist) {
    const { requestedActorInstanceId: _ignored, ...multiOptions } = options;
    return createMultiProtagonistPackagedRuntimeControllerWithFactory(
      bundle,
      multiOptions,
      inner,
    );
  }
  return inner(bundle, options);
};

export const createPackagedFeatureRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedFeatureRuntimeController => {
  const session = createPackagedFeatureSessionController(bundle, options);
  return {
    get selection() {
      return session.selection;
    },
    get controlledActorInstanceId() {
      return session.controlledActorInstanceId();
    },
    createFrame: (tick) => session.createFrame(tick),
    setPointer: (position) => session.setPointer(position),
    setPressed: (pressed) => session.setPressed(pressed),
    activate: (position) => session.activate(position),
    handleKey: (input) => session.handleKey(input),
    createSaveGame: () => session.createSaveGame(),
    restoreSaveGame: (input) => session.restoreSaveGame(input),
    statusText: () => session.statusText(),
    worldState: () => session.worldState(),
    cameraState: () => session.cameraState(),
    parserState: () => session.parserState(),
    drainSceneAudioCueIds: () => session.drainSceneAudioCueIds(),
    ...(session.activeProtagonistId
      ? { activeProtagonistId: () => session.activeProtagonistId?.() as ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]> }
      : {}),
    ...(session.multiProtagonistState
      ? { multiProtagonistState: () => session.multiProtagonistState?.() as ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]> }
      : {}),
    ...(session.switchProtagonist
      ? {
          switchProtagonist: (
            protagonistId: Parameters<MultiProtagonistPackagedRuntimeController["switchProtagonist"]>[0],
          ) => session.switchProtagonist?.(protagonistId),
        }
      : {}),
  };
};
