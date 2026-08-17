import {
  createAudioPackagedRuntimeController,
  type AudioPackagedRuntimeController,
} from "@evavo/adventure-audio-controller";
import {
  WebAudioCommandPlayer,
  webAudioIsSupported,
} from "@evavo/adventure-audio-web";
import type { Id, Sequence } from "@evavo/adventure-project-schema";
import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import type { PlayerSystemTextResolver } from "@evavo/adventure-project-schema/localisation";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  type PackagedRuntimeControllerOptions as BasePackagedRuntimeControllerOptions,
} from "@evavo/adventure-runtime-controller";
import { appendNativeStatusPanel } from "@evavo/adventure-runtime-controller/native-status";
import type { SaveGame } from "@evavo/adventure-save-game";
import { requestedRuntimeBundleFromSearch } from "./built-in-demos.js";
import { playerCutsceneStatusText } from "./cutscene-status.js";
import { resolveActiveGameLifecycleOutcome } from "./lifecycle-outcome.js";
import { runGameLifecycleScreen } from "./lifecycle-screen.js";
import { frameWithoutInteractiveChrome } from "./opening-sequence.js";
import {
  installPlayerPlaytestBridge,
  type PlayerPlaytestWindow,
} from "./playtest-automation.js";
import { createPlayerSystemText } from "./player-system-localisation.js";
import {
  PLAYER_RUNTIME_RESTORED_EVENT,
  type PlayerRuntimeRestoredDetail,
} from "./runtime-events.js";
import { listSaveGameSlots, readSaveGameSlot } from "./save-storage.js";

export type PackagedRuntimeController = AudioPackagedRuntimeController;

export interface PackagedRuntimeControllerOptions
  extends BasePackagedRuntimeControllerOptions {
  readonly initialSequenceId?: Id<"sequence"> | null;
  readonly restartSequenceId?: Id<"sequence"> | null;
  readonly text?: PlayerSystemTextResolver;
}

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

const activeSequenceState = (
  controller: AudioPackagedRuntimeController,
  sequenceId: Id<"sequence">,
) =>
  controller
    .worldState()
    .story.activeSequences.find((active) => active.sequenceId === sequenceId) ?? null;

const sequenceSpeechCues = (
  sequence: Sequence,
): readonly {
  readonly atTick: number;
  readonly text: string;
  readonly durationTicks?: number;
}[] =>
  sequence.tracks
    .flatMap((track) => track.cues)
    .flatMap((cue) => {
      if (cue.kind === "speech") {
        return [
          {
            atTick: cue.atTick,
            text: cue.text,
            ...(cue.durationTicks === undefined ? {} : { durationTicks: cue.durationTicks }),
          },
        ];
      }
      if (cue.kind === "story-action" && cue.action.kind === "say") {
        return [{ atTick: cue.atTick, text: cue.action.text }];
      }
      return [];
    })
    .sort((left, right) => left.atTick - right.atTick);

const activeSequenceCaption = (
  sequence: Sequence,
  elapsedTicks: number,
): string | null => {
  const cues = sequenceSpeechCues(sequence).filter((cue) => cue.atTick <= elapsedTicks);
  const cue = cues.at(-1);
  if (!cue) return null;
  if (
    cue.durationTicks !== undefined &&
    elapsedTicks >= cue.atTick + cue.durationTicks
  ) {
    return null;
  }
  return cue.text;
};

const blockingSequenceStatus = (
  bundle: RuntimeBundle,
  controller: AudioPackagedRuntimeController,
  sequenceId: Id<"sequence">,
  text: PlayerSystemTextResolver,
): string => {
  const sequence = bundle.sequences.find((candidate) => candidate.id === sequenceId);
  const active = activeSequenceState(controller, sequenceId);
  if (!sequence || !active) return playerCutsceneStatusText(null, text);
  return playerCutsceneStatusText(
    {
      name: sequence.name,
      caption: activeSequenceCaption(sequence, active.elapsedTicks),
      canSkip: sequence.skip.allowed && active.elapsedTicks >= sequence.skip.safeAfterTick,
    },
    text,
  );
};

export const createPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedRuntimeController => {
  const {
    initialSequenceId: requestedInitialSequenceId,
    restartSequenceId: requestedRestartSequenceId,
    text: requestedText,
    ...controllerOptions
  } = options;
  const text = requestedText ?? createPlayerSystemText(bundle);
  const controller = createAudioPackagedRuntimeController(bundle, controllerOptions);
  const bundleUrl = runtimeBundleUrl();
  const openingSequenceId = requestedInitialSequenceId ?? null;
  const restartSequenceId = requestedRestartSequenceId ?? openingSequenceId;
  const initialSave: SaveGame | null = (() => {
    try {
      return controller.createSaveGame();
    } catch {
      return null;
    }
  })();
  if (openingSequenceId) {
    controller.startNarrativeSequence(openingSequenceId);
  }

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

  function restartInitialState(): void {
    if (!initialSave) {
      returnToTitle();
      return;
    }
    restoreInternal(initialSave);
    if (restartSequenceId) {
      controller.startNarrativeSequence(restartSequenceId);
      flushAudio();
    }
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
          restartInitialState();
        }
        lifecycleUiActive = false;
      })
      .catch((error: unknown) => {
        console.error(error);
        lifecycleUiActive = false;
      });
  }

  const cinematicFrame = (
    frame: ReturnType<typeof controller.createFrame>,
  ): ReturnType<typeof controller.createFrame> => {
    const sequenceId = controller.activeBlockingSequenceId();
    if (!sequenceId) return frame;
    const stripped = frameWithoutInteractiveChrome(frame);
    return appendNativeStatusPanel(
      stripped,
      bundle,
      blockingSequenceStatus(bundle, controller, sequenceId, text),
    );
  };

  flushAudio();

  const playerController: PackagedRuntimeController = {
    ...controller,
    setPointer: (position) => {
      if (lifecycleOutcome || controller.activeBlockingSequenceId()) return;
      controller.setPointer(position);
    },
    setPressed: (pressed) => {
      if (lifecycleOutcome || controller.activeBlockingSequenceId()) return;
      if (pressed) unlockAudio();
      controller.setPressed(pressed);
    },
    activate: (position) => {
      if (lifecycleOutcome || controller.activeBlockingSequenceId()) return;
      unlockAudio();
      controller.activate(position);
      flushAudio();
      checkLifecycle();
    },
    handleKey: (input) => {
      if (lifecycleOutcome || controller.activeBlockingSequenceId()) return false;
      unlockAudio();
      const handled = controller.handleKey(input);
      flushAudio();
      checkLifecycle();
      return handled;
    },
    skipNarrativeSequence: (sequenceId) => {
      const result = controller.skipNarrativeSequence(sequenceId);
      flushAudio();
      checkLifecycle();
      return result;
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
    statusText: () => {
      if (lifecycleOutcome) return lifecycleOutcome.title;
      const sequenceId = controller.activeBlockingSequenceId();
      return sequenceId
        ? blockingSequenceStatus(bundle, controller, sequenceId, text)
        : controller.statusText();
    },
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
      return cinematicFrame(frame);
    },
    drainAudioCommands: () => controller.drainAudioCommands(),
  };

  if (typeof window !== "undefined") {
    installPlayerPlaytestBridge(
      window as unknown as PlayerPlaytestWindow,
      bundle,
      playerController,
    );
  }

  return playerController;
};
