import {
  createAudioPackagedRuntimeController,
  type AudioPackagedRuntimeController,
} from "@evavo/adventure-audio-controller";
import {
  WebAudioCommandPlayer,
  webAudioIsSupported,
} from "@evavo/adventure-audio-web";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { PackagedRuntimeControllerOptions } from "@evavo/adventure-runtime-controller";
import { requestedRuntimeBundleFromSearch } from "./built-in-demos.js";

export type PackagedRuntimeController = AudioPackagedRuntimeController;
export type { PackagedRuntimeControllerOptions };

const runtimeBundleUrl = (): string | null => {
  const requested = requestedRuntimeBundleFromSearch(window.location.search);
  return requested ? new URL(requested, window.location.href).href : null;
};

export const createPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedRuntimeController => {
  const controller = createAudioPackagedRuntimeController(bundle, options);
  const bundleUrl = runtimeBundleUrl();
  let output: WebAudioCommandPlayer | null = null;

  if (bundle.audioMix && bundleUrl && webAudioIsSupported()) {
    output = new WebAudioCommandPlayer(
      bundle.audioMix,
      bundle.assets,
      bundleUrl,
      {
        onVoiceEnded: (voiceId) => {
          controller.completeAudioVoice(voiceId);
          flushAudio();
        },
      },
    );
    void output.preload().catch((error: unknown) => console.error(error));
    window.addEventListener(
      "pagehide",
      () => void output?.dispose().catch((error: unknown) => console.error(error)),
      { once: true },
    );
  }

  const flushAudio = (): void => {
    const tick = controller.worldState().story.tick;
    const pending = controller.drainAudioCommands();
    if (!output) return;
    output.synchronize(tick);
    output.submit(pending, tick);
  };

  const unlockAudio = (): void => {
    if (!output) return;
    const tick = controller.worldState().story.tick;
    void output
      .unlock(tick)
      .then(flushAudio)
      .catch((error: unknown) => console.error(error));
  };

  flushAudio();

  return {
    ...controller,
    setPressed: (pressed) => {
      if (pressed) unlockAudio();
      controller.setPressed(pressed);
    },
    activate: (position) => {
      unlockAudio();
      controller.activate(position);
      flushAudio();
    },
    handleKey: (input) => {
      unlockAudio();
      const handled = controller.handleKey(input);
      flushAudio();
      return handled;
    },
    restoreSaveGame: (input) => {
      const tick = controller.restoreSaveGame(input);
      output?.reset(tick);
      flushAudio();
      return tick;
    },
    completeAudioVoice: (voiceId) => {
      controller.completeAudioVoice(voiceId);
      flushAudio();
    },
    createFrame: (tick) => {
      const frame = controller.createFrame(tick);
      flushAudio();
      return frame;
    },
    drainAudioCommands: () => controller.drainAudioCommands(),
  };
};
