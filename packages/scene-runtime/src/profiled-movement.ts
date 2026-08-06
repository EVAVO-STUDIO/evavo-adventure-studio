import {
  adventurePlayFeelProfileById,
  advanceAdventureMotionRuntimeExtension,
  createAdventureMotionRuntimeExtension,
  type AdventureMotionPhase,
  type AdventureNativePoint,
  type AdventurePlayFeelProfile,
} from "@evavo/adventure-play-feel";
import type { NavigationRoute } from "@evavo/adventure-scene/navigation";
import {
  canonicalProfiledNavigationMovementJson,
  parseProfiledNavigationMovementJson,
  parseProfiledNavigationMovementState,
  ProfiledNavigationMovementParseError,
} from "./profiled-movement-save.js";
import {
  assertProfiledNavigationMovementCompatibility,
  inspectProfiledNavigationRoute,
  ProfiledNavigationMovementCompatibilityError,
} from "./profiled-movement-compatibility.js";
import type {
  AdvanceProfiledNavigationMovementOptions,
  BeginProfiledNavigationMovementInput,
  BeginProfiledNavigationMovementResult,
  ProfiledNavigationMovementAdvance,
  ProfiledNavigationMovementEvent,
  ProfiledNavigationMovementState,
} from "./profiled-movement-types.js";

export * from "./profiled-movement-compatibility.js";
export * from "./profiled-movement-save.js";
export type * from "./profiled-movement-types.js";

const beginRejected = (
  input: BeginProfiledNavigationMovementInput,
  reason: Extract<
    BeginProfiledNavigationMovementResult,
    { readonly kind: "rejected" }
  >["reason"],
  message: string,
): BeginProfiledNavigationMovementResult => ({
  kind: "rejected",
  profileId: input.profileId,
  reason,
  message,
});

export const beginProfiledNavigationMovement = (
  input: BeginProfiledNavigationMovementInput,
): BeginProfiledNavigationMovementResult => {
  let profile: AdventurePlayFeelProfile;
  try {
    profile = adventurePlayFeelProfileById(input.profileId);
  } catch (error) {
    return beginRejected(
      input,
      "invalid-profile",
      error instanceof Error ? error.message : `Unknown profile '${input.profileId}'.`,
    );
  }
  if (profile.logicalTicksPerSecond !== input.logicalTicksPerSecond) {
    return beginRejected(
      input,
      "logical-tick-rate-mismatch",
      `Profile '${profile.id}' requires ${profile.logicalTicksPerSecond} logical ticks per second, ` +
        `but the runtime uses ${input.logicalTicksPerSecond}.`,
    );
  }
  const inspected = inspectProfiledNavigationRoute(input.route);
  if (inspected.kind === "fallback") {
    return {
      kind: "legacy-fallback",
      profileId: profile.id,
      reason: inspected.reason,
      speedPixelsPerSecond: profile.movement.topSpeedPixelsPerSecond,
    };
  }
  const extension = createAdventureMotionRuntimeExtension(inspected.kinematic, profile);
  return {
    kind: "profiled",
    state: {
      stateVersion: 1,
      actorInstanceId: input.actorInstanceId,
      profileId: profile.id,
      routeFingerprint: extension.routeFingerprint,
      routePointCount: input.route.points.length,
      extension,
      lastPhase: extension.motion.phase,
      completedSegmentCount: 0,
    },
  };
};

const completedSegmentCount = (
  previous: number,
  crossed: readonly number[],
  segmentCount: number,
  arrived: boolean,
): number => {
  let completed = previous;
  for (const segmentIndex of crossed) completed = Math.max(completed, segmentIndex + 1);
  return arrived ? segmentCount : completed;
};

const appendEvents = (
  state: ProfiledNavigationMovementState,
  nextPhase: AdventureMotionPhase,
  crossedSegmentIndexes: readonly number[],
  footfall: "left" | "right" | null,
  arrived: boolean,
  position: AdventureNativePoint,
  tick: number,
): readonly ProfiledNavigationMovementEvent[] => {
  const events: ProfiledNavigationMovementEvent[] = [];
  if (state.lastPhase !== nextPhase) {
    events.push({
      kind: "movement-phase-changed",
      actorInstanceId: state.actorInstanceId,
      previousPhase: state.lastPhase,
      phase: nextPhase,
      tick,
    });
  }
  if (footfall) {
    events.push({
      kind: "movement-footfall",
      actorInstanceId: state.actorInstanceId,
      footfall,
      tick,
      position,
    });
  }
  for (const segmentIndex of crossedSegmentIndexes) {
    events.push({
      kind: "movement-segment-completed",
      actorInstanceId: state.actorInstanceId,
      segmentIndex,
      tick,
    });
  }
  if (arrived && state.lastPhase !== "arrived") {
    events.push({
      kind: "movement-completed",
      actorInstanceId: state.actorInstanceId,
      tick,
      position,
    });
  }
  return events;
};

export const advanceProfiledNavigationMovement = (
  state: ProfiledNavigationMovementState,
  route: NavigationRoute,
  logicalTicksPerSecond: number,
  options: AdvanceProfiledNavigationMovementOptions = {},
): ProfiledNavigationMovementAdvance => {
  assertProfiledNavigationMovementCompatibility({
    state,
    route,
    logicalTicksPerSecond,
  });
  const inspected = inspectProfiledNavigationRoute(route);
  if (inspected.kind === "fallback") {
    throw new ProfiledNavigationMovementCompatibilityError([
      {
        severity: "error",
        code: "invalid-route",
        path: "route",
        message: `The route cannot use profiled movement (${inspected.reason}).`,
      },
    ]);
  }
  const ticks = options.ticks ?? 1;
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError(
      "Profiled movement advancement must use a non-negative safe tick count.",
    );
  }
  let nextState = state;
  const events: ProfiledNavigationMovementEvent[] = [];
  let distanceAdvancedPixels = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const advanced = advanceAdventureMotionRuntimeExtension(
      nextState.extension,
      inspected.kinematic,
      1,
      options.tuning ?? {},
    );
    const motion = advanced.extension.motion;
    events.push(
      ...appendEvents(
        nextState,
        motion.phase,
        advanced.crossedSegmentIndexes,
        advanced.footfall,
        advanced.arrived,
        motion.position,
        motion.tick,
      ),
    );
    distanceAdvancedPixels += advanced.distanceAdvancedPixels;
    nextState = {
      ...nextState,
      extension: advanced.extension,
      lastPhase: motion.phase,
      completedSegmentCount: completedSegmentCount(
        nextState.completedSegmentCount,
        advanced.crossedSegmentIndexes,
        route.segments.length,
        advanced.arrived,
      ),
    };
  }
  const motion = nextState.extension.motion;
  return {
    state: nextState,
    events,
    position: motion.position,
    unquantizedPosition: motion.unquantizedPosition,
    distanceAdvancedPixels,
    arrived: motion.phase === "arrived",
  };
};

export {
  canonicalProfiledNavigationMovementJson,
  parseProfiledNavigationMovementJson,
  parseProfiledNavigationMovementState,
  ProfiledNavigationMovementParseError,
};
