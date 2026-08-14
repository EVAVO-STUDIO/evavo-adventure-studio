import {
  createAudioPackagedRuntimeController,
  type AudioPackagedRuntimeController,
} from "@evavo/adventure-audio-controller";
import {
  WebAudioCommandPlayer,
  webAudioIsSupported,
} from "@evavo/adventure-audio-web";
import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { PackagedRuntimeControllerOptions } from "@evavo/adventure-runtime-controller";
import type { SaveGame } from "@evavo/adventure-save-game";
import { requestedRuntimeBundleFromSearch } from "./built-in-demos.js";
import { resolveActiveGameLifecycleOutcome } from "./lifecycle-outcome.js";
import { runGameLifecycleScreen } from "./lifecycle-screen.js";
import {
  PLAYER_RUNTIME_RESTORED_EVENT,
  type PlayerRuntimeRestoredDetail,
} from "./runtime-events.js";
import { listSaveGameSlots, readSaveGameSlot } from "./save-storage.js";

export type PackagedRuntimeController = AudioPackagedRuntimeController;
export type { PackagedRuntimeControllerOptions };

const runtimeBundleUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const requested = requestedRuntimeBundleFromSearch(window.location.search);
  return requested ? new URL(requested, window.location.href).href : null;
};

const dispatchRuntimeRestored = (restoredTick: number, tickOffset: number): void => {
  if (typeof window === "undefined") return;
  const detail: PlayerRuntimeRestoredDetail = { restoredTick, tickOffset };
  window.dispatchEvent(
    new CustomEvent<PlayerRuntimeRestoredDetail>(PLAYER_RUNTIME_RESTORED_EVENT, { detail }),
  );
};

export const createPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedRuntimeController => {
  const controller = createAudioPackagedRuntimeController(bundle, options);
  const bundleUrl = runtimeBundleUrl();
  const initialSave: SaveGame | null = (() => {
    try {
      return controller.createSaveGame();
    } catch {
      return null;
    }
  })();
  let output: WebAudioCommandPlayer | null = null;
  let lastExternalTick = controller.worldState().story.tick;
  let tickOffset = 0;
  let lifecycleOutcome: GameLifecycleOutcome | null = null;
  let lifecycleFrame: ReturnType<typeof controller.createFrame> | null = null;
  let lifecycleUiActive = false;

  const flushAudio = (): void => {
    const tick = controller.worldState().story.tick;
    const pending = controller.drainAudioCommands();
    if (!output) return;
    output.synchronize(tick);
    output.submit(pending, tick);
  };

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
      () =>
        void output
          ?.dispose()
          .catch((error: unknown) => console.error(error)),
      { once: true },
    );
  }

  const unlockAudio = (): void => {
    if (!output) return;
    const tick = controller.worldState().story.tick;
    void output
      .unlock(tick)
      .then(flushAudio)
      .catch((error: unknown) => console.error(error));
  };

  function returnToTitle(): void {
    if (typeof window === "undefined") return;
    const destination = new URL(window.location.href);
    destination.searchParams.delete("shell");
    window.location.assign(destination.href);
  }

  function checkLifecycle(): void {
    if (!bundle.lifecycle || lifecycleOutcome) return;
    const outcome = resolveActiveGameLifecycleOutcome(bundle, controller.worldState().story);
    if (!outcome) return;
    lifecycleOutcome = outcome;
    openLifecycle(outcome);
  }

  function restoreInternal(save: SaveGame): number {
    const tick = controller.restoreSaveGame(save);
    tickOffset = lastExternalTick - tick;
    lifecycleOutcome = null;
    lifecycleFrame = null;
    output?.reset(tick);
    lifecycleFrame = controller.createFrame(tick);
    flushAudio();
    dispatchRuntimeRestored(tick, tickOffset);
    checkLifecycle();
    return tick;
  }

  function openLifecycle(outcome: GameLifecycleOutcome): void {
    if (
      lifecycleUiActive ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const host = document.querySelector<HTMLElement>("#player-host");
    if (!host) return;
    lifecycleUiActive = true;
    void runGameLifecycleScreen(host, {
      bundle,
      outcome,
      snapshots: () => listSaveGameSlots(window.localStorage, bundle, 10),
      loadSlot: (slot) => restoreInternal(readSaveGameSlot(window.localStorage, bundle, slot)),
    })
      .then((result) => {
        if (result.kind === "title") {
          returnToTitle();
          return;
        }
        if (result.kind === "restart") {
          if (initialSave) restoreInternal(initialSave);
          else {
            returnToTitle();
            return;
          }
        }
        lifecycleUiActive = false;
      })
      .catch((error: unknown) => {
        console.error(error);
        lifecycleUiActive = false;
      });
  }

  flushAudio();

  return {
    ...controller,
    setPointer: (position) => {
      if (lifecycleOutcome) return;
      controller.setPointer(position);
    },
    setPressed: (pressed) => {
      if (lifecycleOutcome) return;
      if (pressed) unlockAudio();
      controller.setPressed(pressed);
    },
    activate: (position) => {
      if (lifecycleOutcome) return;
      unlockAudio();
      controller.activate(position);
      flushAudio();
      checkLifecycle();
    },
    handleKey: (input) => {
      if (lifecycleOutcome) return false;
      unlockAudio();
      const handled = controller.handleKey(input);
      flushAudio();
      checkLifecycle();
      return handled;
    },
    restoreSaveGame: (input) => {
      const tick = controller.restoreSaveGame(input);
      tickOffset = 0;
      lastExternalTick = tick;
      lifecycleOutcome = null;
      lifecycleFrame = controller.createFrame(tick);
      lifecycleUiActive = false;
      output?.reset(tick);
      flushAudio();
      dispatchRuntimeRestored(tick, 0);
      return tick;
    },
    completeAudioVoice: (voiceId) => {
      controller.completeAudioVoice(voiceId);
      flushAudio();
    },
    statusText: () => lifecycleOutcome?.title ?? controller.statusText(),
    createFrame: (externalTick) => {
      lastExternalTick = externalTick;
      if (lifecycleOutcome && lifecycleFrame) {
        if (!lifecycleUiActive) openLifecycle(lifecycleOutcome);
        return lifecycleFrame;
      }
      const runtimeTick = externalTick - tickOffset;
      if (!Number.isSafeInteger(runtimeTick) || runtimeTick < 0) {
        throw new RangeError("Mapped runtime tick must be a non-negative safe integer.");
      }
      const frame = controller.createFrame(runtimeTick);
      flushAudio();
      lifecycleFrame = frame;
      checkLifecycle();
      return frame;
    },
    drainAudioCommands: () => controller.drainAudioCommands(),
  };
};