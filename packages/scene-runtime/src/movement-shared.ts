import { evaluateCondition } from "@evavo/adventure-core";
import type { Actor, Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type {
  NavigationPortal,
  NavigationRouteSegment,
} from "@evavo/adventure-scene/navigation";
import type { SceneNavigationPortal } from "@evavo/adventure-scene-instances";
import {
  setActorInstanceAnimation,
  type ActorInstanceRuntimeState,
} from "./index.js";
import type {
  ActorMovementState,
  NavigableRuntimeWorldState,
} from "./movement-types.js";

export const MOVEMENT_EPSILON = 1e-7;
export const DEFAULT_WALK_SPEED = 48;

export const actorsById = (
  bundle: RuntimeBundle,
): ReadonlyMap<string, Actor> =>
  new Map(bundle.actors.map((actor) => [actor.id as string, actor] as const));

export const authoredActorInstance = (
  bundle: RuntimeBundle,
  actorInstanceId: Id<"actor-instance">,
) => {
  for (const composition of bundle.sceneInstances?.scenes ?? []) {
    const instance = composition.actorInstances.find(
      (candidate) => candidate.id === actorInstanceId,
    );
    if (instance) return { composition, instance };
  }
  return null;
};

export const geometricDistance = (
  segment: NavigationRouteSegment,
): number =>
  Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);

const directionName = (from: Point, to: Point): string => {
  const x = to.x - from.x;
  const y = to.y - from.y;
  if (
    Math.abs(x) <= MOVEMENT_EPSILON &&
    Math.abs(y) <= MOVEMENT_EPSILON
  ) {
    return "south";
  }
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "south-east";
  if (angle >= 67.5 && angle < 112.5) return "south";
  if (angle >= 112.5 && angle < 157.5) return "south-west";
  if (angle >= 157.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "north-west";
  if (angle >= -112.5 && angle < -67.5) return "north";
  return "north-east";
};

const cardinalFallback = (direction: string): readonly string[] => {
  switch (direction) {
    case "north-east":
      return ["east", "north"];
    case "south-east":
      return ["east", "south"];
    case "south-west":
      return ["west", "south"];
    case "north-west":
      return ["west", "north"];
    default:
      return [];
  }
};

export const resolveAnimationFacing = (
  actor: Actor,
  animationState: string,
  desiredFacing: string,
  currentFacing: string,
): string => {
  const available = new Set(
    actor.animations
      .filter((animation) => animation.state === animationState)
      .map((animation) => animation.facing),
  );
  if (available.has(desiredFacing)) return desiredFacing;
  for (const fallback of cardinalFallback(desiredFacing)) {
    if (available.has(fallback)) return fallback;
  }
  if (available.has(currentFacing)) return currentFacing;
  const first = [...available].sort((left, right) =>
    left.localeCompare(right),
  )[0];
  if (!first) {
    throw new Error(
      `Actor '${actor.id}' has no '${animationState}' animation for movement.`,
    );
  }
  return first;
};

const portalForSegment = (
  portals: readonly SceneNavigationPortal[],
  segment: NavigationRouteSegment,
): SceneNavigationPortal | null =>
  segment.portalId
    ? portals.find((portal) => portal.id === segment.portalId) ?? null
    : null;

const animationStateForSegment = (
  movement: ActorMovementState,
  portals: readonly SceneNavigationPortal[],
  segment: NavigationRouteSegment,
): string =>
  portalForSegment(portals, segment)?.traversalAnimationState ??
  movement.walkAnimationState;

const actorRuntimeState = (
  state: NavigableRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
): ActorInstanceRuntimeState => {
  const actorRuntime = state.actorInstances[actorInstanceId];
  if (!actorRuntime) {
    throw new Error(
      `Actor instance '${actorInstanceId}' runtime state is missing.`,
    );
  }
  return actorRuntime;
};

export const applySegmentAnimation = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
  segment: NavigationRouteSegment,
  portals: readonly SceneNavigationPortal[],
): NavigableRuntimeWorldState => {
  const actorRuntime = actorRuntimeState(
    state,
    movement.actorInstanceId,
  );
  const actor = actorsById(bundle).get(actorRuntime.actorId);
  if (!actor) throw new Error(`Actor '${actorRuntime.actorId}' does not exist.`);
  const animationState = animationStateForSegment(
    movement,
    portals,
    segment,
  );
  const facing = resolveAnimationFacing(
    actor,
    animationState,
    directionName(segment.from, segment.to),
    actorRuntime.facing,
  );
  if (
    actorRuntime.animationState === animationState &&
    actorRuntime.facing === facing
  ) {
    return state;
  }
  return {
    ...setActorInstanceAnimation(
      bundle,
      state,
      movement.actorInstanceId,
      animationState,
      facing,
    ),
    movements: state.movements,
  };
};

export const completeMovementAnimation = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
): NavigableRuntimeWorldState => {
  const actorRuntime = actorRuntimeState(
    state,
    movement.actorInstanceId,
  );
  const actor = actorsById(bundle).get(actorRuntime.actorId);
  if (!actor) throw new Error(`Actor '${actorRuntime.actorId}' does not exist.`);
  const arrivalFacing = resolveAnimationFacing(
    actor,
    movement.arrivalAnimationState,
    actorRuntime.facing,
    actorRuntime.facing,
  );
  return {
    ...setActorInstanceAnimation(
      bundle,
      state,
      movement.actorInstanceId,
      movement.arrivalAnimationState,
      arrivalFacing,
    ),
    movements: state.movements,
  };
};

export const enabledPortals = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  sceneId: Id<"scene">,
): readonly NavigationPortal[] => {
  const composition = bundle.sceneInstances?.scenes.find(
    (candidate) => candidate.sceneId === sceneId,
  );
  return (composition?.navigationPortals ?? [])
    .filter(
      (portal) =>
        !portal.enabledWhen || evaluateCondition(portal.enabledWhen, state.story),
    )
    .map((portal) => ({
      id: portal.id,
      fromAreaId: portal.fromAreaId,
      toAreaId: portal.toAreaId,
      fromPoint: portal.fromPoint,
      toPoint: portal.toPoint,
      bidirectional: portal.bidirectional,
      ...(portal.traversalCost !== undefined
        ? { traversalCost: portal.traversalCost }
        : {}),
    }));
};
