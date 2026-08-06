import {
  ADVENTURE_MOTION_UNITS_PER_PIXEL,
  adventurePlayFeelProfileById,
  type AdventurePlayFeelProfileId,
} from "@evavo/adventure-play-feel";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { NavigationRoute } from "@evavo/adventure-scene/navigation";
import {
  advanceProfiledNavigationMovement,
  beginProfiledNavigationMovement,
  type ProfiledNavigationFallbackReason,
  type ProfiledNavigationMovementEvent,
  type ProfiledNavigationMovementState,
} from "./profiled-movement.js";
import { setActorInstancePosition } from "./index.js";
import {
  applySegmentAnimation,
  authoredActorInstance,
  completeMovementAnimation,
  DEFAULT_WALK_SPEED,
  geometricDistance,
  MOVEMENT_EPSILON,
} from "./movement-shared.js";
import type {
  ActorMovementEvent,
  ActorMovementState,
  BeginActorMovementOptions,
  MovementStepResult,
  NavigableRuntimeWorldState,
} from "./movement-types.js";

export interface CreatedMovement {
  readonly movement: ActorMovementState;
  readonly mode: "legacy" | "profiled";
  readonly profileId: AdventurePlayFeelProfileId | null;
  readonly fallbackReason: ProfiledNavigationFallbackReason | null;
}

const selectedPlayFeelProfileId = (
  bundle: RuntimeBundle,
  options: BeginActorMovementOptions,
): AdventurePlayFeelProfileId | null =>
  Object.prototype.hasOwnProperty.call(options, "playFeelProfileId")
    ? options.playFeelProfileId ?? null
    : bundle.playFeelProfileId ?? null;

export const createMovementFromRoute = (
  bundle: RuntimeBundle,
  actorInstanceId: Id<"actor-instance">,
  route: NavigationRoute,
  options: BeginActorMovementOptions,
): CreatedMovement => {
  const requestedSpeed = options.speedPixelsPerSecond;
  const profileId = selectedPlayFeelProfileId(bundle, options);
  let speedPixelsPerSecond = requestedSpeed ?? DEFAULT_WALK_SPEED;
  let profiled: ProfiledNavigationMovementState | undefined;
  let mode: "legacy" | "profiled" = "legacy";
  let fallbackReason: ProfiledNavigationFallbackReason | null = null;

  if (profileId) {
    const started = beginProfiledNavigationMovement({
      actorInstanceId,
      route,
      profileId,
      logicalTicksPerSecond: bundle.presentation.logicalTicksPerSecond,
    });
    if (started.kind === "rejected") {
      throw new RangeError(started.message);
    }
    if (started.kind === "profiled") {
      mode = "profiled";
      profiled = started.state;
      speedPixelsPerSecond =
        requestedSpeed ??
        adventurePlayFeelProfileById(profileId).movement
          .topSpeedPixelsPerSecond;
    } else {
      fallbackReason = started.reason;
      speedPixelsPerSecond = requestedSpeed ?? started.speedPixelsPerSecond;
    }
  }

  return {
    movement: {
      actorInstanceId,
      route,
      nextSegmentIndex: 0,
      distanceAlongSegment: 0,
      speedPixelsPerSecond,
      walkAnimationState: options.walkAnimationState ?? "walk",
      arrivalAnimationState: options.arrivalAnimationState ?? "idle",
      ...(profiled ? { profiled } : {}),
    },
    mode,
    profileId,
    fallbackReason,
  };
};

const advanceLegacyMovementOneTick = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
): MovementStepResult => {
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

  while (availableDistance > MOVEMENT_EPSILON) {
    const segment = nextMovement.route.segments[nextMovement.nextSegmentIndex];
    if (!segment) break;
    const segmentLength = geometricDistance(segment);
    const remaining = Math.max(
      0,
      segmentLength - nextMovement.distanceAlongSegment,
    );

    if (remaining > availableDistance + MOVEMENT_EPSILON) {
      const progress =
        segmentLength <= MOVEMENT_EPSILON
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
        distanceAlongSegment:
          nextMovement.distanceAlongSegment + availableDistance,
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
      nextState = completeMovementAnimation(bundle, nextState, movement);
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

const profiledEvent = (
  movement: ActorMovementState,
  event: ProfiledNavigationMovementEvent,
  storyTick: number,
): ActorMovementEvent => {
  switch (event.kind) {
    case "movement-phase-changed":
      return {
        kind: "movement-phase-changed",
        actorInstanceId: movement.actorInstanceId,
        previousPhase: event.previousPhase,
        phase: event.phase,
        movementTick: event.tick,
        storyTick,
      };
    case "movement-footfall":
      return {
        kind: "movement-footfall",
        actorInstanceId: movement.actorInstanceId,
        footfall: event.footfall,
        position: event.position,
        movementTick: event.tick,
        storyTick,
      };
    case "movement-segment-completed": {
      const segment = movement.route.segments[event.segmentIndex];
      if (!segment) {
        throw new Error(
          `Profiled movement completed missing route segment ${event.segmentIndex}.`,
        );
      }
      return {
        kind: "movement-segment-completed",
        actorInstanceId: movement.actorInstanceId,
        segmentIndex: event.segmentIndex,
        portalId: segment.portalId,
      };
    }
    case "movement-completed":
      return {
        kind: "movement-completed",
        actorInstanceId: movement.actorInstanceId,
        destination: event.position,
      };
  }
};

const advanceProfiledMovementOneTick = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState & {
    readonly profiled: ProfiledNavigationMovementState;
  },
): MovementStepResult => {
  const authored = authoredActorInstance(bundle, movement.actorInstanceId);
  if (!authored) {
    throw new Error(
      `Actor instance '${movement.actorInstanceId}' authoring data is missing.`,
    );
  }
  const advanced = advanceProfiledNavigationMovement(
    movement.profiled,
    movement.route,
    bundle.presentation.logicalTicksPerSecond,
    {
      tuning: {
        topSpeedPixelsPerSecond: movement.speedPixelsPerSecond,
      },
    },
  );
  let nextState: NavigableRuntimeWorldState = {
    ...setActorInstancePosition(
      state,
      movement.actorInstanceId,
      advanced.position,
    ),
    movements: state.movements,
  };
  const events = advanced.events.map((event) =>
    profiledEvent(movement, event, state.story.tick + 1),
  );

  if (advanced.arrived) {
    nextState = completeMovementAnimation(bundle, nextState, movement);
    return { state: nextState, movement: null, events };
  }

  const motion = advanced.state.extension.motion;
  const nextSegmentIndex = Math.min(
    motion.segmentIndex,
    movement.route.segments.length - 1,
  );
  const nextMovement: ActorMovementState = {
    ...movement,
    nextSegmentIndex,
    distanceAlongSegment:
      motion.distanceAlongSegmentMicropixels /
      ADVENTURE_MOTION_UNITS_PER_PIXEL,
    profiled: advanced.state,
  };
  const segment = nextMovement.route.segments[nextSegmentIndex];
  if (segment) {
    nextState = applySegmentAnimation(
      bundle,
      nextState,
      nextMovement,
      segment,
      authored.composition.navigationPortals,
    );
  }
  return { state: nextState, movement: nextMovement, events };
};

export const advanceMovementOneTick = (
  bundle: RuntimeBundle,
  state: NavigableRuntimeWorldState,
  movement: ActorMovementState,
): MovementStepResult =>
  movement.profiled
    ? advanceProfiledMovementOneTick(
        bundle,
        state,
        movement as ActorMovementState & {
          readonly profiled: ProfiledNavigationMovementState;
        },
      )
    : advanceLegacyMovementOneTick(bundle, state, movement);
