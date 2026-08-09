import type { AdventurePlayFeelProfileId } from "@evavo/adventure-play-feel";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { NavigationRoute, NavigationRouteResult } from "@evavo/adventure-scene/navigation";
import type { ActorInstanceAnimationEvent, RuntimeWorldState } from "./index.js";
import type {
  ProfiledNavigationFallbackReason,
  ProfiledNavigationMovementEvent,
  ProfiledNavigationMovementState,
} from "./profiled-movement.js";

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

export interface MovementStepResult {
  readonly state: NavigableRuntimeWorldState;
  readonly movement: ActorMovementState | null;
  readonly events: readonly ActorMovementEvent[];
}
