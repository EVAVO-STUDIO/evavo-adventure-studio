import type { Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { resolveActiveGameLifecycleOutcome } from "./lifecycle-outcome.js";

export const PLAYER_PLAYTEST_GLOBAL = "__EVAVO_ADVENTURE_PLAYTEST__" as const;

export interface PlayerPlaytestActorState {
  readonly sceneId: string;
  readonly position: Point;
  readonly facing: string;
  readonly animationState: string;
}

export interface PlayerPlaytestWorldState {
  readonly story: {
    readonly projectId: string;
    readonly tick: number;
    readonly currentSceneId: string;
    readonly flags: Readonly<Record<string, boolean>>;
    readonly inventory: readonly string[];
    readonly score: number;
    readonly objectStates: Readonly<Record<string, string>>;
    readonly activeDialogue: { readonly nodeId: string } | null;
    readonly activeSequences: readonly { readonly sequenceId: string }[];
  };
  readonly movements: Readonly<Record<string, unknown>>;
  readonly pendingObjectCommands: Readonly<Record<string, unknown>>;
  readonly actorInstances: Readonly<Record<string, PlayerPlaytestActorState>>;
}

export interface PlayerPlaytestController {
  readonly controlledActorInstanceId: string | null;
  worldState(): PlayerPlaytestWorldState;
  createFrame(tick: number): unknown;
  setPointer(position: Point | null): void;
  activate(position: Point): void;
  statusText(): string;
}

export interface PlayerPlaytestSnapshot {
  readonly projectId: string;
  readonly tick: number;
  readonly sceneId: string;
  readonly score: number;
  readonly inventory: readonly string[];
  readonly flags: Readonly<Record<string, boolean>>;
  readonly objectStates: Readonly<Record<string, string>>;
  readonly activeDialogueNodeId: string | null;
  readonly activeSequenceIds: readonly string[];
  readonly lifecycleOutcomeId: string | null;
  readonly statusText: string;
  readonly motionSettled: boolean;
  readonly controlledActor:
    | {
        readonly id: string;
        readonly sceneId: string;
        readonly position: Point;
        readonly facing: string;
        readonly animationState: string;
      }
    | null;
}

export interface PlayerPlaytestBridge {
  readonly bridgeVersion: 1;
  readonly projectId: string;
  readonly nativeCanvas: {
    readonly width: number;
    readonly height: number;
  };
  snapshot(): PlayerPlaytestSnapshot;
  advanceTo(tick: number): PlayerPlaytestSnapshot;
  activate(position: Point): PlayerPlaytestSnapshot;
  activateAndSettle(position: Point, maxTicks?: number): PlayerPlaytestSnapshot;
}

export interface PlayerPlaytestWindow {
  readonly location: { readonly search: string };
  [PLAYER_PLAYTEST_GLOBAL]?: PlayerPlaytestBridge;
}

const assertTick = (tick: number, minimum = 0): void => {
  if (!Number.isSafeInteger(tick) || tick < minimum) {
    throw new RangeError(`Playtest tick must be a safe integer greater than or equal to ${minimum}.`);
  }
};

const assertPosition = (position: Point, bundle: RuntimeBundle): void => {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    position.x >= bundle.presentation.nativeWidth ||
    position.y >= bundle.presentation.nativeHeight
  ) {
    throw new RangeError(
      `Playtest activation ${position.x},${position.y} is outside the native ` +
        `${bundle.presentation.nativeWidth}x${bundle.presentation.nativeHeight} canvas.`,
    );
  }
};

const playtestSnapshot = (
  bundle: RuntimeBundle,
  controller: PlayerPlaytestController,
): PlayerPlaytestSnapshot => {
  const world = controller.worldState();
  const actorId = controller.controlledActorInstanceId;
  const actor = actorId ? world.actorInstances[actorId] : undefined;
  const outcome = resolveActiveGameLifecycleOutcome(
    bundle,
    world.story as Parameters<typeof resolveActiveGameLifecycleOutcome>[1],
  );
  return {
    projectId: world.story.projectId,
    tick: world.story.tick,
    sceneId: world.story.currentSceneId,
    score: world.story.score,
    inventory: [...world.story.inventory],
    flags: { ...world.story.flags },
    objectStates: { ...world.story.objectStates },
    activeDialogueNodeId: world.story.activeDialogue?.nodeId ?? null,
    activeSequenceIds: world.story.activeSequences.map((sequence) => sequence.sequenceId),
    lifecycleOutcomeId: outcome?.id ?? null,
    statusText: controller.statusText(),
    motionSettled:
      Object.keys(world.movements).length === 0 &&
      Object.keys(world.pendingObjectCommands).length === 0,
    controlledActor:
      actorId && actor
        ? {
            id: actorId,
            sceneId: actor.sceneId,
            position: { ...actor.position },
            facing: actor.facing,
            animationState: actor.animationState,
          }
        : null,
  };
};

export const playerPlaytestAutomationRequested = (search: string): boolean => {
  const value = new URLSearchParams(search).get("playtest")?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
};

export const createPlayerPlaytestBridge = (
  bundle: RuntimeBundle,
  controller: PlayerPlaytestController,
): PlayerPlaytestBridge => ({
  bridgeVersion: 1,
  projectId: bundle.projectId,
  nativeCanvas: {
    width: bundle.presentation.nativeWidth,
    height: bundle.presentation.nativeHeight,
  },
  snapshot: () => playtestSnapshot(bundle, controller),
  advanceTo: (tick) => {
    const currentTick = controller.worldState().story.tick;
    assertTick(tick, currentTick);
    controller.createFrame(tick);
    return playtestSnapshot(bundle, controller);
  },
  activate: (position) => {
    assertPosition(position, bundle);
    controller.setPointer(position);
    controller.activate(position);
    return playtestSnapshot(bundle, controller);
  },
  activateAndSettle: (position, maxTicks = 1800) => {
    assertPosition(position, bundle);
    assertTick(maxTicks, 1);
    controller.setPointer(position);
    controller.activate(position);
    let snapshot = playtestSnapshot(bundle, controller);
    for (let step = 0; !snapshot.motionSettled && step < maxTicks; step += 1) {
      controller.createFrame(snapshot.tick + 1);
      snapshot = playtestSnapshot(bundle, controller);
    }
    if (!snapshot.motionSettled) {
      throw new Error(
        `Playtest activation ${position.x},${position.y} did not settle within ${maxTicks} ticks.`,
      );
    }
    return snapshot;
  },
});

export const installPlayerPlaytestBridge = (
  host: PlayerPlaytestWindow,
  bundle: RuntimeBundle,
  controller: PlayerPlaytestController,
): (() => void) => {
  if (!playerPlaytestAutomationRequested(host.location.search)) return () => undefined;
  const bridge = createPlayerPlaytestBridge(bundle, controller);
  Object.defineProperty(host, PLAYER_PLAYTEST_GLOBAL, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: bridge,
  });
  return () => {
    if (host[PLAYER_PLAYTEST_GLOBAL] === bridge) delete host[PLAYER_PLAYTEST_GLOBAL];
  };
};
