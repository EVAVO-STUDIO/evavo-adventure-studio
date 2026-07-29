import type { Actor, Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  findNavigationRoute,
  type NavigationPortal,
  type NavigationRoute,
  type NavigationRouteResult,
  type NavigationRouteSegment,
} from "@evavo/adventure-scene/navigation";
import type { SceneNavigationPortal } from "@evavo/adventure-scene-instances";
import {
  advanceRuntimeWorld,
  createInitialRuntimeWorldState,
  setActorInstanceAnimation,
  setActorInstancePosition,
  type ActorInstanceAnimationEvent,
  type RuntimeWorldState,
} from "./index.js";

const EPSILON = 1e-7;
const DEFAULT_WALK_SPEED = 48;

export interface ActorMovementState {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly route: NavigationRoute;
  readonly nextSegmentIndex: number;
  readonly distanceAlongSegment: number;
  readonly speedPixelsPerSecond: number;
  readonly walkAnimationState: string;
  readonly arrivalAnimationState: string;
}

export interface NavigableRuntimeWorldState extends RuntimeWorldState {
  readonly movements: Readonly<Record<string, ActorMovementState>>;
}

export type ActorMovementEvent =
  | {
      readonly kind: "movement-started";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly destination: Point;
      readonly routeDistance: number;
    }
  | {
      readonly kind: "movement-segment-completed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly segmentIndex: number;
      readonly portalId: Id<"navigation-portal"> | null;
    }
  | {
      readonly kind: "movement-completed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly destination: Point;
    }
  | {
      readonly kind: "movement-cancelled";
      readonly actorInstanceId: Id<"actor-instance">;
    };

export interface NavigableRuntimeWorldTransition {
  readonly state: NavigableRuntimeWorldState;
  readonly animationEvents: readonly ActorInstanceAnimationEvent[];
  readonly movementEvents: readonly ActorMovementEvent[];
}

export interface BeginActorMovementOptions {
  readonly speedPixelsPerSecond?: number;
  readonly walkAnimationState?: string;
  readonly arrivalAnimationState?: string;
  readonly snapDestination?: boolean;
}

export type BeginActorMovementResult =
  | {
      readonly kind: "started";
      readonly state: NavigableRuntimeWorldState;
      readonly route: NavigationRoute;
      readonly event: Extract<ActorMovementEvent, { readonly kind: "movement-started" }>;
    }
  | {
      readonly kind: "already-there";
      readonly state: NavigableRuntimeWorldState;
      readonly route: NavigationRoute;
    }
  | {
      readonly kind: "rejected";
      readonly reason: "missing-instance" | "fixed-instance" | "invalid-speed";
      readonly state: NavigableRuntimeWorldState;
    }
  | {
      readonly kind: "unreachable";
      readonly routeResult: Exclude<NavigationRouteResult, { readonly kind: "route" }>;
      readonly state: NavigableRuntimeWorldState;
    };

const actorsById = (bundle: RuntimeBundle): ReadonlyMap<string, Actor> =>
  new Map(bundle.actors.map((actor) => [actor.id as string, actor] as const));

const authoredActorInstance = (
  bundle: RuntimeBundle,
  actorInstanceId: Id<"actor-instance">,
) => {
  for (const composition of bundle.sceneInstances?.scenes ?? []) {
    const instance = composition.actorInstances.find(
      (candidate) => candidate.id === actorInstanceId,
    );
    if (instance) {
      return { composition, instance };
    }
  }
  return null;
};

const geometricDistance = (segment: NavigationRouteSegment): number => {
  const x = segment.to.x - segment.from.x;
  const y = segment.to.y - segment.from.y;
  return Math.sqrt(x * x + y * y);
};

const directionName = (from: Point, to: Point): string => {
  const x = to.x - from.x;
  const y = to.y - from.y;
  if (Math.abs(x) <= EPSILON && Math.abs(y) <= EPSILON) {
    return "south";
  }
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) {
    return "east";
  }
  if (angle >= 22.5 && angle < 67.5) {
    return "south-east";
  }
  if (angle >= 67.5 && angle < 112.5) {
    return "south";
  }
  if (angle >= 112.5 && angle < 157.5) {
    return "south-west";
  }
  if (angle >= 157.5 || angle < -157.5) {
    return "west";
  }
  if (angle >= -157.5 && angle < -112.5) {
    return "north-west";
  }
  if (angle >= -112.5 && angle < -67.5) {
    return "north";
  }
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

const resolveAnimationFacing = (
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
  if (available.has(desiredFacing)) {
    return desiredFacing;
  }
  for (const fallback of cardinalFallback(desiredFacing)) {
    if (available.has(fallback)) {
      return fallback;
    }
  }
  if (available.has(currentFacing)) {
    return currentFacing;
  }
  const first = [...available].sort((left, right) => left.localeCompare(right))[0];
  if (!first) {
    throw new Error(
      `Actor '${actor.id}' has no '${animationState}' animation for movement.`,
    );
  }
  return first;
};

const portalForSegment = (
  compositionPortals: readonly SceneNavigationPortal[],
  segment: NavigationRouteSegment,
): SceneNavigationPortal | null =>
  segment.portalId
    ? compositionPortals.find((portal) => portal.id === segment.portalId) ?? null
    : null;

const animationStateForSegment = (
  movement: ActorMovementState,
  portals: readonly SceneNavigationPortal[],
  segment: NavigationRouteSegment,
): string =>
  portalForSegment(portals, segment)?.traversalAnimationState ??
  movement.walkAnimationState;

const applySegmentAnimation = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
  segment: NavigationRouteSegment,
  portals: readonly SceneNavigationPortal[],
): NavigableRuntimeWorldState => {
  const actorRuntime = state.actorInstances[movement.actorInstanceId];
  if (!actorRuntime) {
    throw new Error(
      `Actor instance '${movement.actorInstanceId}' runtime state is missing.`,
    );
  }
  const actor = actorsById(bundle).get(actorRuntime.actorId);
  if (!actor) {
    throw new Error(`Actor '${actorRuntime.actorId}' does not exist.`);
  }
  const animationState = animationStateForSegment(movement, portals, segment);
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

const enabledPortals = (
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
        !portal.enabledWhen ||
        // The condition evaluator is already used by scene visibility and is
        // intentionally shared here so route availability is save/replay safe.
        importConditionEvaluator(portal.enabledWhen, state),
    )
    .map((portal) => ({
      id: portal.id,
      fromAreaId: portal.fromAreaId,
      toAreaId: portal.toAreaId,
      fromPoint: portal.fromPoint,
      toPoint: portal.toPoint,
      bidirectional: portal.bidirectional,
      traversalCost: portal.traversalCost,
    }));
};

const importConditionEvaluator = (
  condition: NonNullable<SceneNavigationPortal["enabledWhen"]>,
  state: NavigableRuntimeWorldState,
): boolean => {
  // Kept behind a helper to make portal filtering easy to property-test.
  const { evaluateCondition } = requireCoreConditionEvaluator();
  return evaluateCondition(condition, state.story);
};

const requireCoreConditionEvaluator = (): typeof import("@evavo/adventure-core") =>
  // This indirection is replaced by the static import during TypeScript output.
  // It exists only to keep this helper's intent explicit.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@evavo/adventure-core") as typeof import("@evavo/adventure-core");

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

  const speed = options.speedPixelsPerSecond ?? DEFAULT_WALK_SPEED;
  if (!Number.isFinite(speed) || speed <= 0) {
    return { kind: "rejected", reason: "invalid-speed", state };
  }
  const scene = bundle.scenes.find(
    (candidate) => candidate.id === authored.composition.sceneId,
  );
  if (!scene) {
    throw new Error(`Runtime scene '${authored.composition.sceneId}' is missing.`);
  }
  const areas = scene.navigationAreas.filter(
    (area) => !area.enabledWhen || importConditionEvaluator(area.enabledWhen, state),
  );
  const routeResult = findNavigationRoute(
    runtime.position,
    destination,
    areas,
    enabledPortals(bundle, state, scene.id),
    { snapEnd: options.snapDestination ?? true },
  );
  if (routeResult.kind !== "route") {
    return { kind: "unreachable", routeResult, state };
  }
  if (routeResult.route.segments.length === 0) {
    return { kind: "already-there", state, route: routeResult.route };
  }

  const movement: ActorMovementState = {
    actorInstanceId,
    route: routeResult.route,
    nextSegmentIndex: 0,
    distanceAlongSegment: 0,
    speedPixelsPerSecond: speed,
    walkAnimationState: options.walkAnimationState ?? "walk",
    arrivalAnimationState: options.arrivalAnimationState ?? "idle",
  };
  let nextState: NavigableRuntimeWorldState = {
    ...state,
    movements: {
      ...state.movements,
      [actorInstanceId]: movement,
    },
  };
  const firstSegment = movement.route.segments[0];
  if (firstSegment) {
    nextState = applySegmentAnimation(
      bundle,
      nextState,
      movement,
      firstSegment,
      authored.composition.navigationPortals,
    );
  }
  const event = {
    kind: "movement-started" as const,
    actorInstanceId,
    destination: routeResult.route.points.at(-1) ?? destination,
    routeDistance: routeResult.route.distance,
  };
  return { kind: "started", state: nextState, route: routeResult.route, event };
};

export const cancelActorMovement = (
  state: NavigableRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
): NavigableRuntimeWorldTransition => {
  if (!state.movements[actorInstanceId]) {
    return { state, animationEvents: [], movementEvents: [] };
  }
  const movements = { ...state.movements };
  delete movements[actorInstanceId];
  return {
    state: { ...state, movements },
    animationEvents: [],
    movementEvents: [{ kind: "movement-cancelled", actorInstanceId }],
  };
};

const advanceMovementOneTick = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
): {
  readonly state: NavigableRuntimeWorldState;
  readonly movement: ActorMovementState | null;
  readonly events: readonly ActorMovementEvent[];
} => {
  const authored = authoredActorInstance(bundle, movement.actorInstanceId);
  if (!authored) {
    throw new Error(
      `Actor instance '${movement.actorInstanceId}' authoring data is missing.`,
    );
  }
  let nextState = state;
  let nextMovement = movement;
  const events: ActorMovementEvent[] = [];
  let availableDistance =
    movement.speedPixelsPerSecond / bundle.presentation.logicalTicksPerSecond;

  while (availableDistance > EPSILON) {
    const segment = nextMovement.route.segments[nextMovement.nextSegmentIndex];
    if (!segment) {
      break;
    }
    const segmentLength = geometricDistance(segment);
    const remaining = Math.max(
      0,
      segmentLength - nextMovement.distanceAlongSegment,
    );

    if (remaining > availableDistance + EPSILON) {
      const progress =
        segmentLength <= EPSILON
          ? 1
          : (nextMovement.distanceAlongSegment + availableDistance) /
            segmentLength;
      nextState = {
        ...setActorInstancePosition(
          nextState,
          movement.actorInstanceId,
          {
            x: segment.from.x + (segment.to.x - segment.from.x) * progress,
            y: segment.from.y + (segment.to.y - segment.from.y) * progress,
          },
        ),
        movements: nextState.movements,
      };
      nextMovement = {
        ...nextMovement,
        distanceAlongSegment: nextMovement.distanceAlongSegment + availableDistance,
      };
      availableDistance = 0;
      break;
    }

    nextState = {
      ...setActorInstancePosition(
        nextState,
        movement.actorInstanceId,
        segment.to,
      ),
      movements: nextState.movements,
    };
    availableDistance -= remaining;
    events.push({
      kind: "movement-segment-completed",
      actorInstanceId: movement.actorInstanceId,
      segmentIndex: nextMovement.nextSegmentIndex,
      portalId: segment.portalId,
    });
    const nextIndex = nextMovement.nextSegmentIndex + 1;
    const following = nextMovement.route.segments[nextIndex];
    if (!following) {
      const actorRuntime = nextState.actorInstances[movement.actorInstanceId];
      if (!actorRuntime) {
        throw new Error(
          `Actor instance '${movement.actorInstanceId}' runtime state is missing.`,
        );
      }
      nextState = {
        ...setActorInstanceAnimation(
          bundle,
          nextState,
          movement.actorInstanceId,
          movement.arrivalAnimationState,
          actorRuntime.facing,
        ),
        movements: nextState.movements,
      };
      events.push({
        kind: "movement-completed",
        actorInstanceId: movement.actorInstanceId,
        destination: segment.to,
      });
      return { state: nextState, movement: null, events };
    }

    nextMovement = {
      ...nextMovement,
      nextSegmentIndex: nextIndex,
      distanceAlongSegment: 0,
    };
    nextState = applySegmentAnimation(
      bundle,
      nextState,
      nextMovement,
      following,
      authored.composition.navigationPortals,
    );
  }

  return { state: nextState, movement: nextMovement, events };
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
  const animationEvents: ActorInstanceAnimationEvent[] = [];
  const movementEvents: ActorMovementEvent[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    const movements = { ...state.movements };
    for (const actorInstanceId of Object.keys(movements).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const movement = movements[actorInstanceId];
      if (!movement) {
        continue;
      }
      const advanced = advanceMovementOneTick(bundle, state, movement);
      state = advanced.state;
      movementEvents.push(...advanced.events);
      if (advanced.movement) {
        movements[actorInstanceId] = advanced.movement;
      } else {
        delete movements[actorInstanceId];
      }
    }
    state = { ...state, movements };

    const animated = advanceRuntimeWorld(bundle, state, 1);
    state = { ...animated.state, movements: state.movements };
    animationEvents.push(...animated.animationEvents);
  }

  return { state, animationEvents, movementEvents };
};
