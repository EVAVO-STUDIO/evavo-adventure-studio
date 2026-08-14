import { advanceFixedStepClock, createFixedStepClock } from "@evavo/adventure-core/fixed-step";
import type { Point } from "@evavo/adventure-project-schema";
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
import { createPackagedRuntimeController, type PackagedRuntimeController } from "./packaged-controller.js";
import { type ParserKeyInput, parserKeyInputFromKeyboardEvent } from "./parser.js";
import { createPlayerReplayRecorder, type ReplayRecordingStatus } from "./replay-recorder.js";
import { loadRuntimeBundle } from "./runtime-loader.js";
import { createPackagedRuntimeRenderer } from "./runtime-renderer.js";
import { hasSaveGameSlot, readSaveGameSlot, writeSaveGameSlot } from "./save-storage.js";
import "./style.css";

interface PlayerInputController {
  setPointer(position: Point | null): void;
  setPressed(pressed: boolean): void;
  activate(position: Point): void;
  handleKey?(input: ParserKeyInput): boolean;
}

interface PlayerPersistence {
  saveQuickSlot(): void;
  loadQuickSlot(): number;
  hasQuickSlot(): boolean;
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
  readonly disposeAdditional?: () => Promise<void>;
}

interface PackagedPlayerSession {
  readonly player: MountedPlayer;
  readonly initialTick: number;
}

const updateStatus = (text: string): void => {
  const status = document.querySelector<HTMLElement>(".player-status > span:nth-of-type(2)");
  if (status) status.textContent = text;
};

const errorText = (prefix: string, error: unknown): string =>
  `${prefix} • ${error instanceof Error ? error.message : String(error)}`;

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

const nativePointer = (host: HTMLElement, canvas: NativeCanvas, event: PointerEvent): Point | null => {
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

const mountPlayer = async (
  host: HTMLElement,
  player: MountedPlayer,
  initialLogicalTick = 0,
): Promise<void> => {
  if (!Number.isSafeInteger(initialLogicalTick) || initialLogicalTick < 0) {
    throw new RangeError("Player initial logical tick must be a non-negative safe integer.");
  }
  const initialFrame = player.createFrame(initialLogicalTick);
  await player.renderer.initialize(
    { target: host, devicePixelRatio: window.devicePixelRatio },
    initialFrame.canvas,
  );
  if (player.statusText) updateStatus(player.statusText());

  let clock = createFixedStepClock();
  let logicalTick = initialLogicalTick;
  let previousTime = performance.now();
  let animationFrame = 0;
  let disposed = false;

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
    player.input?.setPointer(nativePointer(host, initialFrame.canvas, event));
  };
  const onPointerLeave = (): void => {
    player.input?.setPointer(null);
    player.input?.setPressed(false);
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (!player.input || event.button !== 0) return;
    const point = nativePointer(host, initialFrame.canvas, event);
    player.input.setPointer(point);
    player.input.setPressed(true);
    if (point) {
      player.replay?.recordActivation(logicalTick, point);
      player.input.activate(point);
    }
    if (player.statusText) updateStatus(player.statusText());
    event.preventDefault();
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) player.input?.setPressed(false);
  };
  const onPointerCancel = (): void => player.input?.setPressed(false);
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
      updateStatus("GAME RESTORED");
    } catch (error) {
      updateStatus(errorText("LOAD FAILED", error));
    }
  };

  const saveQuickSlot = (): void => {
    if (!player.persistence) return;
    try {
      player.persistence.saveQuickSlot();
      updateStatus("GAME SAVED");
    } catch (error) {
      updateStatus(errorText("SAVE FAILED", error));
    }
  };

  const toggleReplayRecording = (): void => {
    if (!player.replay) return;
    try {
      if (player.replay.status().recording) {
        const replay = player.replay.finish();
        updateStatus(`REPLAY RECORDED • ${replay.events.length} EVENTS`);
      } else {
        player.replay.start();
        updateStatus("REPLAY RECORDING");
      }
    } catch (error) {
      updateStatus(errorText("REPLAY FAILED", error));
    }
  };

  const exportLatestReplay = (): void => {
    if (!player.replay) return;
    const json = player.replay.latestReplayJson();
    if (!json) {
      updateStatus("NO COMPLETED REPLAY TO EXPORT");
      return;
    }
    downloadText(player.replay.fileName, json);
    updateStatus("REPLAY EXPORTED");
  };

  const onKeyDown = (event: KeyboardEvent): void => {
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
    if (player.statusText) updateStatus(player.statusText());
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
    const advanced = advanceFixedStepClock(clock, now - previousTime, {
      ticksPerSecond: player.ticksPerSecond,
      maxCatchUpTicks: 4,
      maxFrameDeltaMilliseconds: 250,
    });
    clock = advanced.state;
    logicalTick += advanced.ticksToRun;
    previousTime = now;
    player.renderer.render(player.createFrame(logicalTick));
    if (player.statusText) updateStatus(player.statusText());
    animationFrame = requestAnimationFrame(renderLoop);
  };

  player.renderer.render(initialFrame);
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
  initialSave?: SaveGame,
): Promise<PackagedPlayerSession> => {
  const textures = new PixiAssetTextureStore({ aliasNamespace: bundle.projectId });
  await textures.loadRuntimeAssets(bundle.assets, bundleUrl);
  const controller: PackagedRuntimeController = createPackagedRuntimeController(bundle, {
    requestedActorInstanceId,
  });
  const initialTick = initialSave ? controller.restoreSaveGame(initialSave) : 0;
  const recorder = createPlayerReplayRecorder(bundle);
  const persistence: PlayerPersistence = {
    saveQuickSlot: () => writeSaveGameSlot(window.localStorage, bundle, controller.createSaveGame()),
    loadQuickSlot: () => controller.restoreSaveGame(readSaveGameSlot(window.localStorage, bundle)),
    hasQuickSlot: () => hasSaveGameSlot(window.localStorage, bundle),
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
  host.textContent = "Loading runtime bundle…";
  updateStatus("LOADING GAME DATA");
  const bundle = await loadRuntimeBundle(bundleUrl);
  host.textContent = "";

  let initialSave: SaveGame | undefined;
  if (!classicFrontEndSkipped(window.location.search)) {
    updateStatus("TITLE SCREEN");
    let startMode = await runClassicFrontEnd(host, {
      title: bundle.title,
      hasSave: hasSaveGameSlot(window.localStorage, bundle),
      ...(bundle.frontEnd ? { frontEnd: bundle.frontEnd } : {}),
    });
    if (startMode === "continue") {
      try {
        initialSave = readSaveGameSlot(window.localStorage, bundle);
      } catch (error) {
        startMode = await runClassicFrontEnd(host, {
          title: bundle.title,
          hasSave: false,
          ...(bundle.frontEnd ? { frontEnd: bundle.frontEnd } : {}),
          notice: errorText("QUICK SAVE UNAVAILABLE", error),
        });
        if (startMode === "continue") {
          throw new Error("Classic front end selected an unavailable save slot.");
        }
      }
    }
  }

  host.dataset["mode"] = "runtime-loading";
  host.textContent = "Loading game…";
  updateStatus(initialSave ? "RESTORING GAME" : "STARTING NEW GAME");
  const session = await packagedPlayer(
    bundle,
    bundleUrl,
    requestedActorFromSearch(window.location.search),
    initialSave,
  );
  host.textContent = "";
  host.dataset["mode"] = "runtime-bundle";
  host.setAttribute("aria-label", "Native adventure game canvas");
  await mountPlayer(host, session.player, session.initialTick);
};

void boot().catch((error: unknown) => {
  console.error(error);
  const host = document.querySelector<HTMLElement>("#player-host");
  if (host) {
    host.dataset["mode"] = "error";
    host.textContent = error instanceof Error ? error.message : "The player could not start.";
  }
});