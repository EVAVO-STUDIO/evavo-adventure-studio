import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { advanceRuntimeWorld, createInitialRuntimeWorldState } from "./index.js";
import { synchronizeProfiledMovementAnimations } from "./movement-animation.js";
import {
  actorRuntimeState,
  applySegmentAnimation,
  authoredActorInstance,
  completeMovementAnimation,
  enabledPortals,
  navigationPortalsForActor,
} from "./movement-shared.js";
import { advanceMovementOneTick, createMovementFromRoute } from "./movement-steps.js";
import type {
  ActorMovementEvent,
  BeginActorMovementOptions,
  BeginActorMovementResult,
  NavigableRuntimeWorldState,
  NavigableRuntimeWorldTransition,
} from "./movement-types.js";
import { findStagedNavigationRoute } from "./staging.js";

export * from "./movement-types.js";

export const createInitialNavigableRuntimeWorldState = (
  bundle: RuntimeBundle,
  seed?: number,
): NavigableRuntimeWorldState => ({
  ...createInitialRuntimeWorldState(bundle, seed),
  movements: {},
});

export const beginActorMovement = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  destination: Point,
  options: BeginActorMovementOptions = {},
): BeginActorMovementResult => {
  const authored = authoredActorInstance(bundle, actorInstanceId);
  const runtime = state.actorInstances[actorInstanceId];
  if (!authored || !runtime) {
    return { kind: "rejected", reason: "missing-instance", state };
  }
  if (authored.instance.mobility !== "walkable") {
    return { kind: "rejected", reason: "fixed-instance", state };
  }
  if (
    options.speedPixelsPerSecond !== undefined &&
    (!Number.isFinite(options.speedPixelsPerSecond) || options.speedPixelsPerSecond <= 0)
  ) {
    return { kind: "rejected", reason: "invalid-speed", state };
  }

  const runtimeSceneId = actorRuntimeState(state, actorInstanceId).sceneId;
  const scene = bundle.scenes.find((candidate) => candidate.id === runtimeSceneId);
  if (!scene) {
    throw new Error(`Runtime scene '${runtimeSceneId}' is missing.`);
  }
  const areas = scene.navigationAreas.filter(
    (area) => !area.enabledWhen || evaluateCondition(area.enabledWhen, state.story),
  );
  const portals = enabledPortals(bundle, state, scene.id);
  const routeResult = findStagedNavigationRoute(
    bundle,
    state,
    scene.id,
    runtime.position,
    destination,
    areas,
    portals,
    { snapEnd: options.snapDestination ?? true },
  );
  if (routeResult.kind !== "route") {
    return { kind: "unreachable", routeResult, state };
  }
  if (routeResult.route.segments.length === 0) {
    return { kind: "already-there", state, route: routeResult.route };
  }

  const created = createMovementFromRoute(bundle, actorInstanceId, routeResult.route, options);
  let nextState: NavigableRuntimeWorldState = {
    ...state,
    movements: {
      ...state.movements,
      [actorInstanceId]: created.movement,
    },
  };
  const firstSegment = created.movement.route.segments[0];
  if (firstSegment) {
    nextState = applySegmentAnimation(
      bundle,
      nextState,
      created.movement,
      firstSegment,
      navigationPortalsForActor(bundle, nextState, actorInstanceId),
    );
  }

  const event: Extract<ActorMovementEvent, { readonly kind: "movement-started" }> = {
    kind: "movement-started",
    actorInstanceId,
    destination: routeResult.route.points.at(-1) ?? destination,
    routeDistance: routeResult.route.distance,
    movementMode: created.mode,
    ...(created.profileId ? { profileId: created.profileId } : {}),
    ...(created.fallbackReason ? { fallbackReason: created.fallbackReason } : {}),
  };
  return {
    kind: "started",
    state: nextState,
    route: routeResult.route,
    movementMode: created.mode,
    ...(created.fallbackReason ? { profileFallbackReason: created.fallbackReason } : {}),
    event,
  };
};

export const cancelActorMovement = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  arrivalAnimationState?: string,
): NavigableRuntimeWorldTransition => {
  const movement = state.movements[actorInstanceId];
  if (!movement) {
    return { state, animationEvents: [], movementEvents: [] };
  }
  const animationState = arrivalAnimationState ?? movement.arrivalAnimationState;
  const animated = completeMovementAnimation(bundle, state, {
    ...movement,
    arrivalAnimationState: animationState,
  });
  const movements = { ...state.movements };
  delete movements[actorInstanceId];
  return {
    state: { ...animated, movements },
    animationEvents: [],
    movementEvents: [{ kind: "movement-cancelled", actorInstanceId }],
  };
};

export const advanceNavigableRuntimeWorld = (
  bundle: RuntimeBundle,
  world: NavigableRuntimeWorldState,
  ticks: number,
): NavigableRuntimeWorldTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("World advancement must be a non-negative safe integer.");
  }
  let state = world;
  const animationEvents: NavigableRuntimeWorldTransition["animationEvents"][number][] = [];
  const movementEvents: ActorMovementEvent[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    const movements = { ...state.movements };
    for (const actorInstanceId of Object.keys(movements).sort((left, right) => left.localeCompare(right))) {
      const movement = movements[actorInstanceId];
      if (!movement) continue;
      const advanced = advanceMovementOneTick(bundle, state, movement);
      state = advanced.state;
      movementEvents.push(...advanced.events);
      if (advanced.movement) movements[actorInstanceId] = advanced.movement;
      else delete movements[actorInstanceId];
    }
    state = { ...state, movements };

    const animated = advanceRuntimeWorld(bundle, state, 1);
    const synchronized = synchronizeProfiledMovementAnimations(
      bundle,
      { ...animated.state, movements: state.movements },
      animated.animationEvents,
    );
    state = synchronized.state;
    animationEvents.push(...synchronized.animationEvents);
  }

  return { state, animationEvents, movementEvents };
};
