import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createMultiProtagonistPackagedRuntimeControllerWithFactory,
  type MultiProtagonistPackagedRuntimeController,
} from "./multi-protagonist-controller.js";
import {
  appendProtagonistSwitcher,
  hitTestProtagonistSwitcher,
  validateProtagonistSwitcherRuntime,
} from "./protagonist-switcher.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export const createMultiProtagonistSwitcherPackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: Omit<PackagedRuntimeControllerOptions, "requestedActorInstanceId"> = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): MultiProtagonistPackagedRuntimeController => {
  validateProtagonistSwitcherRuntime(bundle);
  const controller = createMultiProtagonistPackagedRuntimeControllerWithFactory(
    bundle,
    options,
    innerFactory,
  );

  return {
    ...controller,
    get selection() {
      return controller.selection;
    },
    createFrame: (tick) =>
      appendProtagonistSwitcher(
        controller.createFrame(tick),
        bundle,
        controller.activeProtagonistId(),
      ),
    activate: (position) => {
      const protagonistId = hitTestProtagonistSwitcher(bundle, position);
      if (protagonistId) {
        controller.switchProtagonist(protagonistId);
        return;
      }
      controller.activate(position);
    },
  };
};

export const createMultiProtagonistSwitcherPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: Omit<PackagedRuntimeControllerOptions, "requestedActorInstanceId"> = {},
): MultiProtagonistPackagedRuntimeController =>
  createMultiProtagonistSwitcherPackagedRuntimeControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
