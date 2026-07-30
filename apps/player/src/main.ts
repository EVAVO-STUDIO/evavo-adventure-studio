import {
  advanceFixedStepClock,
  createFixedStepClock,
} from "@evavo/adventure-core/fixed-step";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type {
  NativeCanvas,
  RenderLayer,
  ResolvedFrame,
  SolidRectangleRenderNode,
} from "@evavo/adventure-render-contract";
import { PixiWebGLRenderer } from "@evavo/adventure-renderer-pixi";
import { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import {
  mapClientPointToNative,
  requestedActorFromSearch,
} from "./input.js";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
} from "./packaged-controller.js";
import {
  parserKeyInputFromKeyboardEvent,
  type ParserKeyInput,
} from "./parser.js";
import { createPackagedRuntimeRenderer } from "./runtime-renderer.js";
import { loadRuntimeBundle } from "./runtime-loader.js";
import {
  hasSaveGameSlot,
  readSaveGameSlot,
  writeSaveGameSlot,
} from "./save-storage.js";
import "./style.css";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const rectangle = (
  nodeId: string,
  layer: RenderLayer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  zOffset = 0,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: id<"render-node">(nodeId),
  order: {
    layer,
    elevation: 0,
    baselineY: y + height,
    zOffset,
    stableId: nodeId,
  },
  transform: {
    position: { x, y },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
  size: { width, height },
  color,
});

const createLaboratoryFrame = (tick: number): ResolvedFrame => {
  const lampOn = Math.floor(tick / 20) % 2 === 0;
  const cursorX = 156 + (Math.floor(tick / 12) % 5);
  const cityLight = Math.floor(tick / 8) % 3;

  return {
    frameVersion: 1,
    tick,
    canvas: {
      width: 320,
      height: 200,
      clearColor: [0, 0, 0, 255],
    },
    camera: {
      position: { x: 0, y: 0 },
      viewport: { width: 320, height: 200 },
      shakeOffset: { x: 0, y: 0 },
    },
    nodes: [
      rectangle("room.wall", "background", 0, 0, 320, 132, 0x26253a),
      rectangle("room.shadow-band", "background", 0, 0, 320, 18, 0x171724),
      rectangle("room.floor", "background", 0, 132, 320, 40, 0x171520),
      rectangle("room.floor-line.1", "background", 0, 143, 320, 1, 0x343043),
      rectangle("room.floor-line.2", "background", 0, 158, 320, 1, 0x0c0b12),
      rectangle("window.recess", "background", 228, 22, 72, 82, 0x0a0911),
      rectangle("window.sky", "background", 233, 27, 62, 72, 0x091727),
      rectangle("window.frame.vertical", "rear-ambient", 263, 27, 3, 72, 0x454157),
      rectangle("window.frame.horizontal", "rear-ambient", 233, 61, 62, 3, 0x454157),
      rectangle(
        "window.city-light.1",
        "rear-ambient",
        242,
        76,
        3,
        3,
        cityLight === 0 ? 0xf4c26a : 0x574a39,
      ),
      rectangle(
        "window.city-light.2",
        "rear-ambient",
        282,
        45,
        2,
        3,
        cityLight === 1 ? 0xd65b6f : 0x4a2630,
      ),
      rectangle(
        "window.city-light.3",
        "rear-ambient",
        251,
        39,
        2,
        2,
        cityLight === 2 ? 0x79b9d1 : 0x263b45,
      ),
      rectangle("desk.body", "world", 92, 101, 132, 48, 0x493a35),
      rectangle("desk.top", "world", 86, 96, 144, 8, 0x765a48),
      rectangle("desk.drawer", "world", 111, 110, 82, 17, 0x30272a),
      rectangle("desk.drawer-edge", "world", 111, 126, 82, 2, 0x84644e),
      rectangle("desk.handle", "world", 147, 116, 12, 3, 0xc8a36d),
      rectangle("desk.leg.left", "world", 98, 145, 12, 24, 0x2f2528),
      rectangle("desk.leg.right", "world", 206, 145, 12, 24, 0x2f2528),
      rectangle("lamp.base", "world", 196, 91, 18, 5, 0x17141a),
      rectangle("lamp.stem", "world", 203, 66, 3, 26, 0xaaa0a2),
      rectangle("lamp.shade", "world", 194, 59, 21, 9, 0x7d1f35),
      rectangle(
        "lamp.glow",
        "effects",
        184,
        69,
        41,
        2,
        lampOn ? 0xffc86b : 0x493923,
      ),
      rectangle("actor.shadow", "world", 37, 158, 38, 5, 0x0b0a0f),
      rectangle("actor.legs.left", "world", 47, 132, 8, 28, 0x12121a),
      rectangle("actor.legs.right", "world", 59, 132, 8, 28, 0x12121a),
      rectangle("actor.coat", "world", 42, 91, 31, 47, 0x202433),
      rectangle("actor.shirt", "world", 52, 95, 12, 22, 0xd2d0c8),
      rectangle("actor.tie", "world", 57, 99, 3, 18, 0x8f2037),
      rectangle("actor.head", "world", 49, 71, 18, 21, 0xbd8f73),
      rectangle("actor.hair", "world", 48, 68, 20, 7, 0x16131a),
      rectangle("actor.hat.brim", "world", 44, 67, 29, 3, 0x252937),
      rectangle("actor.hat.crown", "world", 49, 58, 20, 10, 0x303545),
      rectangle("ui.panel", "interface", 0, 172, 320, 28, 0x08090e),
      rectangle("ui.rule", "interface", 0, 172, 320, 2, 0xff244e),
      rectangle("ui.verb.look", "interface", 10, 180, 28, 11, 0x272b38),
      rectangle("ui.verb.use", "interface", 43, 180, 28, 11, 0x272b38),
      rectangle("ui.inventory", "interface", 245, 178, 64, 15, 0x12151f),
      rectangle("ui.inventory.key", "interface", 268, 182, 15, 4, 0xc9a465),
      rectangle("ui.inventory.key-tooth", "interface", 280, 186, 4, 3, 0xc9a465),
      rectangle("cursor.horizontal", "cursor", cursorX - 4, 103, 9, 1, 0xff244e),
      rectangle("cursor.vertical", "cursor", cursorX, 99, 1, 9, 0xff244e),
    ],
  };
};

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

interface MountedPlayer {
  readonly renderer: PixiWebGLRenderer;
  readonly ticksPerSecond: number;
  readonly createFrame: (tick: number) => ResolvedFrame;
  readonly input?: PlayerInputController;
  readonly persistence?: PlayerPersistence;
  readonly statusText?: () => string;
  readonly disposeAdditional?: () => Promise<void>;
}

const updateStatus = (text: string): void => {
  const status = document.querySelector<HTMLElement>(
    ".player-status span:last-child",
  );
  if (status) status.textContent = text;
};

const errorText = (prefix: string, error: unknown): string =>
  `${prefix} • ${error instanceof Error ? error.message : String(error)}`;

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

const mountPlayer = async (
  host: HTMLElement,
  player: MountedPlayer,
): Promise<void> => {
  const initialFrame = player.createFrame(0);
  await player.renderer.initialize(
    { target: host, devicePixelRatio: window.devicePixelRatio },
    initialFrame.canvas,
  );
  if (player.statusText) updateStatus(player.statusText());

  let clock = createFixedStepClock();
  let logicalTick = 0;
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
    if (point) player.input.activate(point);
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

  const onKeyDown = (event: KeyboardEvent): void => {
    const commandModifier = event.ctrlKey || event.metaKey;
    if (commandModifier && event.shiftKey && event.code === "KeyS") {
      saveQuickSlot();
      event.preventDefault();
      return;
    }
    if (commandModifier && event.shiftKey && event.code === "KeyL") {
      restoreQuickSlot();
      event.preventDefault();
      return;
    }

    const input = parserKeyInputFromKeyboardEvent(event);
    if (!input || !player.input?.handleKey?.(input)) return;
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
  bundleUrl: string,
  requestedActorInstanceId: string | null,
): Promise<MountedPlayer> => {
  const bundle = await loadRuntimeBundle(bundleUrl);
  const textures = new PixiAssetTextureStore({ aliasNamespace: bundle.projectId });
  await textures.loadRuntimeAssets(bundle.assets, bundleUrl);
  const controller: PackagedRuntimeController = createPackagedRuntimeController(
    bundle,
    { requestedActorInstanceId },
  );
  const persistence: PlayerPersistence = {
    saveQuickSlot: () =>
      writeSaveGameSlot(
        window.localStorage,
        bundle,
        controller.createSaveGame(),
      ),
    loadQuickSlot: () =>
      controller.restoreSaveGame(
        readSaveGameSlot(window.localStorage, bundle),
      ),
    hasQuickSlot: () => hasSaveGameSlot(window.localStorage, bundle),
  };

  return {
    renderer: createPackagedRuntimeRenderer(bundle, textures),
    ticksPerSecond: bundle.presentation.logicalTicksPerSecond,
    createFrame: controller.createFrame,
    input: controller,
    persistence,
    statusText: controller.statusText,
    disposeAdditional: () => textures.dispose(),
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

  const bundleParameter = new URLSearchParams(window.location.search).get(
    "bundle",
  );
  if (!bundleParameter) {
    host.dataset.mode = "rendering-lab";
    await mountPlayer(host, laboratoryPlayer());
    return;
  }

  const bundleUrl = new URL(bundleParameter, window.location.href).href;
  host.dataset.mode = "runtime-bundle";
  host.textContent = "Loading runtime bundle…";
  const player = await packagedPlayer(
    bundleUrl,
    requestedActorFromSearch(window.location.search),
  );
  host.textContent = "";
  host.setAttribute("aria-label", "Native adventure game canvas");
  await mountPlayer(host, player);
};

void boot().catch((error: unknown) => {
  console.error(error);
  const host = document.querySelector<HTMLElement>("#player-host");
  if (host) {
    host.dataset.mode = "error";
    host.textContent =
      error instanceof Error ? error.message : "The player could not start.";
  }
});
