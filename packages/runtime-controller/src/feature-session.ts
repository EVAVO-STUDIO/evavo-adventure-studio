import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createMultiProtagonistPackagedRuntimeControllerWithFactory,
  type MultiProtagonistPackagedRuntimeController,
} from "./multi-protagonist-controller.js";
import {
  createRoomScriptPackagedRuntimeControllerWithFactory,
} from "./room-script-controller.js";
import {
  createSentencePackagedRuntimeControllerWithFactory,
} from "./sentence-controller.js";
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

export interface PackagedFeatureSessionDescription {
  readonly sentence: boolean;
  readonly roomScripts: boolean;
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
  const multiProtagonist = bundle.multiProtagonist !== undefined;
  return {
    sentence,
    roomScripts,
    multiProtagonist,
    stack: [
      "base",
      ...(sentence ? ["sentence"] : []),
      ...(roomScripts ? ["room-scripts"] : []),
      ...(multiProtagonist ? ["multi-protagonist"] : []),
    ],
  };
};

const sentenceFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createSentencePackagedRuntimeControllerWithFactory(bundle, options, inner);

const roomScriptFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createRoomScriptPackagedRuntimeControllerWithFactory(bundle, options, inner);

export const createPackagedFeatureSessionController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedFeatureSessionController => {
  const description = describePackagedFeatureSession(bundle);
  let inner: PackagedSessionControllerFactory = createBasePackagedSessionController;
  if (description.sentence) inner = sentenceFactory(inner);
  if (description.roomScripts) inner = roomScriptFactory(inner);
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
