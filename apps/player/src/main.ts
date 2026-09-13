import { advanceFixedStepClock, createFixedStepClock } from "@evavo/adventure-core/fixed-step";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import {
  canonicalPlayerSystemText,
  type PlayerSystemTextResolver,
} from "@evavo/adventure-project-schema/localisation";
import type { NativeCanvas, ResolvedFrame } from "@evavo/adventure-render-contract";
import { PixiWebGLRenderer } from "@evavo/adventure-renderer-pixi";
import { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { ReplayLog } from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "@evavo/adventure-save-game";
import { requestedRuntimeBundleFromSearch } from "./built-in-demos.js";
import { classicFrontEndSkipped, runClassicFrontEnd } from "./classic-front-end.js";
import { mapClientPointToNative, requestedActorFromSearch } from "./input.js";
import { createLaboratoryFrame } from "./laboratory-frame.js";
import { resolveActiveGameLifecycleOutcome } from "./lifecycle-outcome.js";
import { runGameLifecycleScreen } from "./lifecycle-screen.js";
import {
  configuredOpeningSequenceId,
  requestedNewGameOpeningSequenceId,
} from "./opening-sequence.js";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
} from "./packaged-controller.js";
import { type ParserKeyInput, parserKeyInputFromKeyboardEvent } from "./parser.js";
import { createPlayerReplayRecorder, type ReplayRecordingStatus } from "./replay-recorder.js";
import { createPlayerStatusRail } from "./player-status-rail.js";
import { createPlayerSystemText } from "./player-system-localisation.js";
import { loadRuntimeBundle } from "./runtime-loader.js";
import { createPackagedRuntimeRenderer } from "./runtime-renderer.js";
import {
  hasSaveGameSlot,
  listSaveGameSlots,
  readSaveGameSlot,
  type SaveGameSlotSnapshot,
  writeSaveGameSlot,
} from "./save-storage.js";
import { runClassicSystemMenu } from "./system-menu.js";
import "./style.css";

interface PlayerInputController {
  setPointer(position: Point | null): void;
  setPressed(pressed: boolean): void;
  activate(position: Point): void;
  handleKey?(input: ParserKeyInput): boolean;
  activeBlockingSequenceId?(): Id<"sequence"> | null;
  skipNarrativeSequence?(
    sequenceId: Id<"sequence">,
  ): { readonly kind: "skipped" | "rejected"; readonly reason?: string };
}

interface PlayerPersistence {
  saveQuickSlot(): void;
  loadQuickSlot(): number;
  hasQuickSlot(): boolean;
  saveSlot(slot: number): void;
  loadSlot(slot: number): number;
  listSlots(): readonly SaveGameSlotSnapshot[];
  captureRetryCheckpoint?(): void;
  restoreRetryCheckpoint?(): number;
  hasRetryCheckpoint?(): boolean;
}

interface PlayerReplayControls {
  start(): void;
  cancel(): void;
  finish(): ReplayLog;
  latestReplayJson(): string | null;
  status(): ReplayRecordingStatus;
  recordActivation(tick: number, position: Point): void;
  recordParserInput(tick: number, input: ParserKeyInput): void;
  readonly fileName: string;
}

interface MountedPlayer {
  readonly renderer: PixiWebGLRenderer;
  readonly ticksPerSecond: number;
  readonly createFrame: (tick: number) => ResolvedFrame;
  readonly input?: PlayerInputController;
  readonly persistence?: PlayerPersistence;
  readonly replay?: PlayerReplayControls;
  readonly statusText?: () => string;
  readonly activeLifecycleOutcome?: () => GameLifecycleOutcome | null;
  readonly text?: PlayerSystemTextResolver;
  readonly bundle?: RuntimeBundle;
  readonly disposeAdditional?: () => Promise<void>;
}

interface PackagedPlayerSession {
  readonly player: MountedPlayer;
  readonly initialTick: number;
}

let activeSystemText: PlayerSystemTextResolver = canonicalPlayerSystemText;

const errorStatusHoldMilliseconds = 4200;

const statusRail = createPlayerStatusRail((text) => {
  const status = document.querySelector<HTMLElement>(".player-status > span:nth-of-type(2)");
  if (status) status.textContent = text;
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const downloadText = (fileName: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const nativePointer = (
  host: HTMLElement,
  canvas: NativeCanvas,
  event: PointerEvent,
): Point | null => {
  const bounds = host.getBoundingClientRect();
  return mapClientPointToNative(
    { x: event.clientX, y: event.clientY },
    {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    canvas,
  );
};

const restartCurrentRuntime = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.set("shell", "skip");
  window.location.assign(url.href);
};

const mountPlayer = async (
  host: HTMLElement,
  player: MountedPlayer,
  initialLogicalTick = 0,
): Promise<void> => {
  if (!Number.isSafeInteger(initialLogicalTick) || initialLogicalTick < 0) {
    throw new RangeError("Player initial logical tick must be a non-negative safe integer.");
  }
  const text = player.text ?? canonicalPlayerSystemText;
  const initialFrame = player.createFrame(initialLogicalTick);
  await player.renderer.initialize(
    { target: host, devicePixelRatio: window.devicePixelRatio },
    initialFrame.canvas,
  );
  if (player.statusText) statusRail.replace(player.statusText());

  let clock = createFixedStepClock();
  let logicalTick = initialLogicalTick;
  let previousTime = performance.now();
  let animationFrame = 0;
  let disposed = false;
  let systemMenuActive = false;
  let lifecycleActive = false;
  let presentedLifecycleOutcomeId: string | null = null;

  const blockingSequenceId = (): Id<"sequence"> | null =>
    player.input?.activeBlockingSequenceId?.() ?? null;
  const modalActive = (): boolean => systemMenuActive || lifecycleActive;

  const resize = (): void => {
    const bounds = host.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      player.renderer.resize(bounds.width, bounds.height);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const onPointerMove = (event: PointerEvent): void => {
    if (modalActive() || blockingSequenceId()) return;
    player.input?.setPointer(nativePointer(host, initialFrame.canvas, event));
  };
  const onPointerLeave = (): void => {
    if (modalActive() || blockingSequenceId()) return;
    player.input?.setPointer(null);
    player.input?.setPressed(false);
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (modalActive() || !player.input || event.button !== 0) return;
    if (blockingSequenceId()) {
      event.preventDefault();
      return;
    }
    const point = nativePointer(host, initialFrame.canvas, event);
    player.input.setPointer(point);
    player.input.setPressed(true);
    if (point) {
      player.persistence?.captureRetryCheckpoint?.();
      player.replay?.recordActivation(logicalTick, point);
      player.input.activate(point);
    }
    if (player.statusText) statusRail.replace(player.statusText());
    event.preventDefault();
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (!modalActive() && !blockingSequenceId() && event.button === 0) {
      player.input?.setPressed(false);
    }
  };
  const onPointerCancel = (): void => {
    if (!modalActive() && !blockingSequenceId()) player.input?.setPressed(false);
  };
  const onContextMenu = (event: MouseEvent): void => {
    if (player.input) event.preventDefault();
  };

  const restoreQuickSlot = (): void => {
    if (!player.persistence) return;
    try {
      player.replay?.cancel();
      logicalTick = player.persistence.loadQuickSlot();
      clock = createFixedStepClock();
      previousTime = performance.now();
      player.renderer.render(player.createFrame(logicalTick));
      presentedLifecycleOutcomeId = null;
      statusRail.announce(text("status.gameRestored"));
    } catch (error) {
      statusRail.announce(
        text("status.loadFailed", { error: errorMessage(error) }),
        errorStatusHoldMilliseconds,
      );
    }
  };

  const saveQuickSlot = (): void => {
    if (!player.persistence) return;
    try {
      player.persistence.saveQuickSlot();
      statusRail.announce(text("status.gameSaved"));
    } catch (error) {
      statusRail.announce(
        text("status.saveFailed", { error: errorMessage(error) }),
        errorStatusHoldMilliseconds,
      );
    }
  };

  const toggleReplayRecording = (): void => {
    if (!player.replay) return;
    try {
      if (player.replay.status().recording) {
        const replay = player.replay.finish();
        const count = replay.events.length;
        const eventLabel = text(
          count === 1 ? "status.replayEventSingular" : "status.replayEventPlural",
        );
        statusRail.announce(text("status.replayRecorded", { count, eventLabel }));
      } else {
        player.replay.start();
        statusRail.announce(text("status.replayRecording"));
      }
    } catch (error) {
      statusRail.announce(
        text("status.replayFailed", { error: errorMessage(error) }),
        errorStatusHoldMilliseconds,
      );
    }
  };

  const exportLatestReplay = (): void => {
    if (!player.replay) return;
    const json = player.replay.latestReplayJson();
    if (!json) {
      statusRail.announce(text("status.noCompletedReplay"));
      return;
    }
    downloadText(player.replay.fileName, json);
    statusRail.announce(text("status.replayExported"));
  };

  const openLifecycleOutcome = (outcome: GameLifecycleOutcome): void => {
    if (lifecycleActive || systemMenuActive || !player.persistence || !player.bundle) return;
    lifecycleActive = true;
    presentedLifecycleOutcomeId = outcome.id;
    player.input?.setPressed(false);
    player.input?.setPointer(null);
    player.replay?.cancel();
    statusRail.replace(outcome.title);
    const retryAvailable = player.persistence.hasRetryCheckpoint?.() === true;

    void runGameLifecycleScreen(host, {
      bundle: player.bundle,
      outcome,
      snapshots: player.persistence.listSlots,
      loadSlot: (slot) => player.persistence?.loadSlot(slot) ?? logicalTick,
      ...(retryAvailable && player.persistence.restoreRetryCheckpoint
        ? { quickRetry: player.persistence.restoreRetryCheckpoint }
        : {}),
    })
      .then((result) => {
        if (result.kind === "title") {
          window.location.reload();
          return;
        }
        if (result.kind === "restart") {
          restartCurrentRuntime();
          return;
        }
        lifecycleActive = false;
        logicalTick = result.tick;
        clock = createFixedStepClock();
        previousTime = performance.now();
        player.renderer.render(player.createFrame(logicalTick));
        presentedLifecycleOutcomeId = null;
        statusRail.announce(
          result.kind === "retry"
            ? text("status.gameRestored")
            : result.slot === 0
              ? text("status.quickSaveRestored")
              : text("status.saveSlotRestored", { slot: result.slot }),
        );
        host.focus();
      })
      .catch((error: unknown) => {
        console.error(error);
        lifecycleActive = false;
        presentedLifecycleOutcomeId = null;
        clock = createFixedStepClock();
        previousTime = performance.now();
        statusRail.announce(errorMessage(error), errorStatusHoldMilliseconds);
        host.focus();
      });
  };

  const openSystemMenu = (): void => {
    if (
      modalActive() ||
      blockingSequenceId() ||
      !player.persistence ||
      !player.bundle
    ) {
      return;
    }
    systemMenuActive = true;
    player.input?.setPressed(false);
    player.input?.setPointer(null);
    statusRail.replace(text("status.gamePaused"));

    void runClassicSystemMenu(host, {
      bundle: player.bundle,
      snapshots: player.persistence.listSlots,
      saveSlot: player.persistence.saveSlot,
      loadSlot: (slot) => {
        player.replay?.cancel();
        return player.persistence?.loadSlot(slot) ?? logicalTick;
      },
      text,
    })
      .then((result) => {
        if (result.kind === "return-to-title") {
          window.location.reload();
          return;
        }
        systemMenuActive = false;
        if (result.kind === "loaded") {
          logicalTick = result.tick;
          player.renderer.render(player.createFrame(logicalTick));
          presentedLifecycleOutcomeId = null;
          statusRail.announce(
            result.slot === 0
              ? text("status.quickSaveRestored")
              : text("status.saveSlotRestored", { slot: result.slot }),
          );
        } else {
          statusRail.announce(text("status.gameResumed"));
        }
        clock = createFixedStepClock();
        previousTime = performance.now();
        host.focus();
      })
      .catch((error: unknown) => {
        console.error(error);
        systemMenuActive = false;
        clock = createFixedStepClock();
        previousTime = performance.now();
        statusRail.announce(
          text("status.systemMenuFailed", { error: errorMessage(error) }),
          errorStatusHoldMilliseconds,
        );
        host.focus();
      });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (modalActive()) return;

    const sequenceId = blockingSequenceId();
    if (sequenceId) {
      if (event.key === "Escape" && player.input?.skipNarrativeSequence) {
        const result = player.input.skipNarrativeSequence(sequenceId);
        statusRail.announce(
          text(
            result.kind === "skipped"
              ? "status.cutsceneSkipped"
              : "status.cutsceneCannotSkip",
          ),
        );
      }
      event.preventDefault();
      return;
    }

    if (player.persistence && event.key === "Escape") {
      openSystemMenu();
      event.preventDefault();
      return;
    }

    const commandModifier = event.ctrlKey || event.metaKey;
    if (player.persistence && commandModifier && event.shiftKey && event.code === "KeyS") {
      saveQuickSlot();
      event.preventDefault();
      return;
    }
    if (player.persistence && commandModifier && event.shiftKey && event.code === "KeyL") {
      restoreQuickSlot();
      event.preventDefault();
      return;
    }
    if (player.replay && commandModifier && event.shiftKey && event.code === "KeyR") {
      toggleReplayRecording();
      event.preventDefault();
      return;
    }
    if (player.replay && commandModifier && event.shiftKey && event.code === "KeyE") {
      exportLatestReplay();
      event.preventDefault();
      return;
    }

    const input = parserKeyInputFromKeyboardEvent(event);
    if (!input || !player.input?.handleKey?.(input)) return;
    player.replay?.recordParserInput(logicalTick, input);
    if (player.statusText) statusRail.replace(player.statusText());
    event.preventDefault();
  };

  if (player.input) {
    host.style.cursor = "none";
    host.tabIndex = 0;
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerCancel);
    host.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
  }

  const renderLoop = (now: number): void => {
    if (disposed) return;
    if (modalActive()) {
      previousTime = now;
      animationFrame = requestAnimationFrame(renderLoop);
      return;
    }
    const advanced = advanceFixedStepClock(clock, now - previousTime, {
      ticksPerSecond: player.ticksPerSecond,
      maxCatchUpTicks: 4,
      maxFrameDeltaMilliseconds: 250,
    });
    clock = advanced.state;
    logicalTick += advanced.ticksToRun;
    previousTime = now;
    player.renderer.render(player.createFrame(logicalTick));
    if (player.statusText) statusRail.refresh(player.statusText());
    const outcome = player.activeLifecycleOutcome?.() ?? null;
    if (outcome && outcome.id !== presentedLifecycleOutcomeId) {
      openLifecycleOutcome(outcome);
    } else if (!outcome) {
      presentedLifecycleOutcomeId = null;
    }
    animationFrame = requestAnimationFrame(renderLoop);
  };

  player.renderer.render(initialFrame);
  const initialOutcome = player.activeLifecycleOutcome?.() ?? null;
  if (initialOutcome) openLifecycleOutcome(initialOutcome);
  animationFrame = requestAnimationFrame(renderLoop);

  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      host.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      void player.renderer
        .destroy()
        .then(() => player.disposeAdditional?.())
        .catch((error: unknown) => console.error(error));
    },
    { once: true },
  );
};

const packagedPlayer = async (
  bundle: RuntimeBundle,
  bundleUrl: string,
  requestedActorInstanceId: string | null,
  text: PlayerSystemTextResolver,
  initialSave?: SaveGame,
  initialSequenceId?: Id<"sequence"> | null,
  restartSequenceId?: Id<"sequence"> | null,
): Promise<PackagedPlayerSession> => {
  const textures = new PixiAssetTextureStore({ aliasNamespace: bundle.projectId });
  await textures.loadRuntimeAssets(bundle.assets, bundleUrl);
  const controller: PackagedRuntimeController = createPackagedRuntimeController(bundle, {
    requestedActorInstanceId,
    text,
    ...(initialSequenceId ? { initialSequenceId } : {}),
    ...(restartSequenceId ? { restartSequenceId } : {}),
  });
  const initialTick = initialSave
    ? controller.restoreSaveGame(initialSave)
    : controller.worldState().story.tick;
  const recorder = createPlayerReplayRecorder(bundle);
  const retryEnabled =
    bundle.lifecycle?.outcomes.some(
      (outcome) => outcome.kind === "failure" && outcome.menu.allowQuickRetry,
    ) === true;
  let retryCheckpoint: SaveGame | null = null;
  const persistence: PlayerPersistence = {
    saveQuickSlot: () =>
      writeSaveGameSlot(window.localStorage, bundle, controller.createSaveGame()),
    loadQuickSlot: () => controller.restoreSaveGame(readSaveGameSlot(window.localStorage, bundle)),
    hasQuickSlot: () => hasSaveGameSlot(window.localStorage, bundle),
    saveSlot: (slot) =>
      writeSaveGameSlot(
        window.localStorage,
        bundle,
        controller.createSaveGame(),
        slot,
      ),
    loadSlot: (slot) =>
      controller.restoreSaveGame(readSaveGameSlot(window.localStorage, bundle, slot)),
    listSlots: () => listSaveGameSlots(window.localStorage, bundle, 10),
    ...(retryEnabled
      ? {
          captureRetryCheckpoint: () => {
            retryCheckpoint = controller.createSaveGame();
          },
          restoreRetryCheckpoint: () => {
            if (!retryCheckpoint) throw new Error("No retry checkpoint is available.");
            return controller.restoreSaveGame(retryCheckpoint);
          },
          hasRetryCheckpoint: () => retryCheckpoint !== null,
        }
      : {}),
  };
  const replay: PlayerReplayControls = {
    start: () => recorder.start(controller.createSaveGame()),
    cancel: recorder.cancel,
    finish: () => recorder.finish(controller.createSaveGame()),
    latestReplayJson: recorder.latestReplayJson,
    status: recorder.status,
    recordActivation: recorder.recordActivation,
    recordParserInput: recorder.recordParserInput,
    fileName: `${bundle.projectId}.replay.json`,
  };

  return {
    initialTick,
    player: {
      renderer: createPackagedRuntimeRenderer(bundle, textures),
      ticksPerSecond: bundle.presentation.logicalTicksPerSecond,
      createFrame: controller.createFrame,
      input: controller,
      persistence,
      replay,
      statusText: controller.statusText,
      activeLifecycleOutcome: () =>
        resolveActiveGameLifecycleOutcome(bundle, controller.worldState().story),
      text,
      bundle,
      disposeAdditional: () => textures.dispose(),
    },
  };
};

const laboratoryPlayer = (): MountedPlayer => ({
  renderer: new PixiWebGLRenderer({
    textures: { getTexture: () => null },
  }),
  ticksPerSecond: 60,
  createFrame: createLaboratoryFrame,
  text: canonicalPlayerSystemText,
});

const boot = async (): Promise<void> => {
  const host = document.querySelector<HTMLElement>("#player-host");
  if (!host) throw new Error("Player host element was not found.");

  const bundleParameter = requestedRuntimeBundleFromSearch(window.location.search);
  if (!bundleParameter) {
    host.dataset["mode"] = "rendering-lab";
    await mountPlayer(host, laboratoryPlayer());
    return;
  }

  const bundleUrl = new URL(bundleParameter, window.location.href).href;
  host.dataset["mode"] = "runtime-loading";
  host.textContent = activeSystemText("loading.runtimeBundle");
  statusRail.replace(activeSystemText("status.loadingGameData"));
  const bundle = await loadRuntimeBundle(bundleUrl);
  activeSystemText = createPlayerSystemText(bundle);
  const text = activeSystemText;
  host.textContent = "";

  let initialSave: SaveGame | undefined;
  if (!classicFrontEndSkipped(window.location.search)) {
    statusRail.replace(text("status.titleScreen"));
    const snapshots = (): readonly SaveGameSlotSnapshot[] =>
      listSaveGameSlots(window.localStorage, bundle, 10);
    let request = await runClassicFrontEnd(host, {
      title: bundle.title,
      snapshots,
      ...(bundle.frontEnd ? { frontEnd: bundle.frontEnd } : {}),
    });
    while (request.kind === "load") {
      try {
        initialSave = readSaveGameSlot(window.localStorage, bundle, request.slot);
        break;
      } catch (error) {
        request = await runClassicFrontEnd(host, {
          title: bundle.title,
          snapshots,
          skipSplash: true,
          ...(bundle.frontEnd ? { frontEnd: bundle.frontEnd } : {}),
          notice:
            request.slot === 0
              ? text("status.quickSaveUnavailable", { error: errorMessage(error) })
              : text("status.saveSlotUnavailable", {
                  slot: request.slot,
                  error: errorMessage(error),
                }),
        });
      }
    }
  }

  const restartSequenceId = configuredOpeningSequenceId(
    bundle,
    window.location.search,
  );
  const initialSequenceId = requestedNewGameOpeningSequenceId(
    bundle,
    window.location.search,
    initialSave !== undefined,
  );
  host.dataset["mode"] = "runtime-loading";
  host.textContent = text("loading.game");
  statusRail.replace(
    text(
      initialSave
        ? "status.restoringGame"
        : initialSequenceId
          ? "status.startingOpening"
          : "status.startingNewGame",
    ),
  );
  const session = await packagedPlayer(
    bundle,
    bundleUrl,
    requestedActorFromSearch(window.location.search),
    text,
    initialSave,
    initialSequenceId,
    restartSequenceId,
  );
  host.textContent = "";
  host.dataset["mode"] = "runtime-bundle";
  host.setAttribute("aria-label", text("aria.gameCanvas"));
  await mountPlayer(host, session.player, session.initialTick);
};

void boot().catch((error: unknown) => {
  console.error(error);
  const host = document.querySelector<HTMLElement>("#player-host");
  if (host) {
    host.dataset["mode"] = "error";
    host.textContent = activeSystemText("error.playerCouldNotStart", {
      error: errorMessage(error),
    });
    statusRail.replace(activeSystemText("status.playerCouldNotStart"));
  }
});
