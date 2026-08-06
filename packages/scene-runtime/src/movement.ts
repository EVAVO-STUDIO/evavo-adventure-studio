import { evaluateCondition } from "@evavo/adventure-core";
import {
  ADVENTURE_MOTION_UNITS_PER_PIXEL,
  adventurePlayFeelProfileById,
  type AdventurePlayFeelProfileId,
} from "@evavo/adventure-play-feel";
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
  advanceProfiledNavigationMovement,
  beginProfiledNavigationMovement,
  type ProfiledNavigationFallbackReason,
  type ProfiledNavigationMovementEvent,
  type ProfiledNavigationMovementState,
} from "./profiled-movement.js";
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
  readonly profiled?: ProfiledNavigationMovementState;
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
      readonly movementMode?: "legacy" | "profiled";
      readonly profileId?: AdventurePlayFeelProfileId;
      readonly fallbackReason?: ProfiledNavigationFallbackReason;
    }
  | {
      readonly kind: "movement-phase-changed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly previousPhase: Extract<
        ProfiledNavigationMovementEvent,
        { readonly kind: "movement-phase-changed" }
      >["previousPhase"];
      readonly phase: Extract<
        ProfiledNavigationMovementEvent,
        { readonly kind: "movement-phase-changed" }
      >["phase"];
      readonly movementTick: number;
      readonly storyTick: number;
    }
  | {
      readonly kind: "movement-footfall";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly footfall: "left" | "right";
      readonly position: Point;
      readonly movementTick: number;
      readonly storyTick: number;
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
  readonly playFeelProfileId?: AdventurePlayFeelProfileId | null;
}

export type BeginActorMovementResult =
  | {
      readonly kind: "started";
      readonly state: NavigableRuntimeWorldState;
      readonly route: NavigationRoute;
      readonly movementMode: "legacy" | "profiled";
      readonly profileFallbackReason?: ProfiledNavigationFallbackReason;
      readonly event: Extract<
        ActorMovementEvent,
        { readonly kind: "movement-started" }
      >;
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
      readonly routeResult: Exclude<
        NavigationRouteResult,
        { readonly kind: "route" }
      >;
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
    if (instance) return { composition, instance };
  }
  return null;
};

const geometricDistance = (segment: NavigationRouteSegment): number =>
  Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);

const directionName = (from: Point, to: Point): string => {
  const x = to.x - from.x;
  const y = to.y - from.y;
  if (Math.abs(x) <= EPSILON && Math.abs(y) <= EPSILON) return "south";
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
  if (available.has(desiredFacing)) return desiredFacing;
  for (const fallback of cardinalFallback(desiredFacing)) {
    if (available.has(fallback)) return fallback;
  }
  if (available.has(currentFacing)) return currentFacing;
  const first = [...available].sort((left, right) => left.localeCompare(right))[0];
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

const applySegmentAnimation = (
  bundle: RuntimeBundle,
  state: NavigmÆÈ‹j◊ù~äÎ{
‚µÎ}Îr