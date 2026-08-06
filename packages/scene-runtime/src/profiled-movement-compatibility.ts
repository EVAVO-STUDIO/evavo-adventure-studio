import {
  ADVENTURE_MOTION_UNITS_PER_PIXEL,
  adventureKinematicRouteFingerprint,
  adventurePlayFeelProfileById,
  createAdventureKinematicRoute,
  type AdventureKinematicRoute,
  type AdventureNativePoint,
} from "@evavo/adventure-play-feel";
import type {
  NavigationRoute,
  NavigationRouteSegment,
} from "@evavo/adventure-scene/navigation";
import { parseProfiledNavigationMovementState } from "./profiled-movement-save.js";
import type {
  BeginProfiledNavigationMovementResult,
  ProfiledNavigationCompatibilityInput,
  ProfiledNavigationCompatibilityIssue,
} from "./profiled-movement-types.js";

const EPSILON = 1e-7;
const POSITION_EPSILON = 1 / ADVENTURE_MOTION_UNITS_PER_PIXEL;

export interface EligibleProfiledNavigationRoute {
  readonly kind: "eligible";
  readonly kinematic: AdventureKinematicRoute;
}

export interface FallbackProfiledNavigationRoute {
  readonly kind: "fallback";
  readonly reason: Extract<
    BeginProfiledNavigationMovementResult,
    { readonly kind: "legacy-fallback" }
  >["reason"];
}

export type ProfiledNavigationRouteInspection =
  | EligibleProfiledNavigationRoute
  | FallbackProfiledNavigationRoute;

const samePoint = (left: AdventureNativePoint, right: AdventureNativePoint): boolean =>
  Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;

const geometricDistance = (segment: NavigationRouteSegment): number =>
  Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);

export const inspectProfiledNavigationRoute = (
  route: NavigationRoute,
): ProfiledNavigationRouteInspection => {
  if (route.points.length < 2) return { kind: "fallback", reason: "route-too-short" };
  if (route.segments.length !== route.points.length - 1) {
    return { kind: "fallback", reason: "route-point-segment-mismatch" };
  }
  for (let index = 0; index < route.segments.length; index += 1) {
    const segment = route.segments[index];
    const from = route.points[index];
    const to = route.points[index + 1];
    if (!segment || !from || !to || !samePoint(segment.from, from) || !samePoint(segment.to, to)) {
      return { kind: "fallback", reason: "route-point-segment-mismatch" };
    }
    const distance = geometricDistance(segment);
    if (distance <= EPSILON) return { kind: "fallback", reason: "zero-length-segment" };
    if (segment.kind === "portal" && Math.abs(segment.distance - distance) > EPSILON) {
      return { kind: "fallback", reason: "non-geometric-portal" };
    }
  }
  return { kind: "eligible", kinematic: createAdventureKinematicRoute(route.points) };
};

interface LocatedRouteDistance {
  readonly point: AdventureNativePoint;
  readonly segmentIndex: number;
  readonly distanceAlongSegmentMicropixels: number;
}

const locateRouteDistance = (
  route: AdventureKinematicRoute,
  distanceMicropixels: number,
): LocatedRouteDistance => {
  const distance = Math.min(
    Math.max(0, distanceMicropixels),
    route.totalMicropixels,
  );
  let segmentIndex = route.segmentLengthsMicropixels.length - 1;
  for (let index = 0; index < route.segmentLengthsMicropixels.length; index += 1) {
    const end = route.cumulativeMicropixels[index + 1];
    if (end !== undefined && distance < end) {
      segmentIndex = index;
      break;
    }
  }
  const from = route.points[segmentIndex];
  const to = route.points[segmentIndex + 1];
  const segmentLength = route.segmentLengthsMicropixels[segmentIndex];
  const segmentStart = route.cumulativeMicropixels[segmentIndex] ?? 0;
  if (!from || !to || !segmentLength) {
    throw new RangeError("Kinematic route geometry is incomplete.");
  }
  const distanceAlongSegmentMicropixels = Math.min(
    segmentLength,
    Math.max(0, distance - segmentStart),
  );
  const progress = distanceAlongSegmentMicropixels / segmentLength;
  return {
    point: {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    },
    segmentIndex,
    distanceAlongSegmentMicropixels,
  };
};

const issue = (
  issues: ProfiledNavigationCompatibilityIssue[],
  code: ProfiledNavigationCompatibilityIssue["code"],
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateProfiledNavigationMovementCompatibility = (
  input: ProfiledNavigationCompatibilityInput,
): readonly ProfiledNavigationCompatibilityIssue[] => {
  const issues: ProfiledNavigationCompatibilityIssue[] = [];
  const state = parseProfiledNavigationMovementState(input.state);
  const inspected = inspectProfiledNavigationRoute(input.route);
  if (inspected.kind === "fallback") {
    issue(
      issues,
      "invalid-route",
      "route",
      `The saved profiled movement cannot use this route (${inspected.reason}).`,
    );
    return issues;
  }
  const profile = adventurePlayFeelProfileById(state.profileId);
  if (profile.logicalTicksPerSecond !== input.logicalTicksPerSecond) {
    issue(
      issues,
      "logical-tick-rate-mismatch",
      "logicalTicksPerSecond",
      `Profile '${profile.id}' requires ${profile.logicalTicksPerSecond} logical ticks per second.`,
    );
  }
  if (state.extension.profileId !== state.profileId) {
    issue(
      issues,
      "profile-mismatch",
      "state.extension.profileId",
      "The movement extension profile differs from the saved movement profile.",
    );
  }
  const fingerprint = adventureKinematicRouteFingerprint(inspected.kinematic);
  if (
    state.routeFingerprint !== fingerprint ||
    state.extension.routeFingerprint !== fingerprint
  ) {
    issue(
      issues,
      "route-fingerprint-mismatch",
      "state.routeFingerprint",
      "The authored navigation route has changed since this movement state was saved.",
    );
  }
  if (state.routePointCount !== input.route.points.length) {
    issue(
      issues,
      "route-point-count-mismatch",
      "state.routePointCount",
      "The saved route point count differs from the authored navigation route.",
    );
  }
  const motion = state.extension.motion;
  if (
    motion.distanceMicropixels > inspected.kinematic.totalMicropixels ||
    motion.distanceRemainder >= input.logicalTicksPerSecond
  ) {
    issue(
      issues,
      "invalid-motion-distance",
      "state.extension.motion.distanceMicropixels",
      "Saved motion distance or fixed-step remainder is outside the route contract.",
    );
  }
  const located = locateRouteDistance(
    inspected.kinematic,
    motion.distanceMicropixels,
  );
  if (
    motion.segmentIndex !== located.segmentIndex ||
    motion.distanceAlongSegmentMicropixels !==
      located.distanceAlongSegmentMicropixels
  ) {
    issue(
      issues,
      "invalid-motion-segment",
      "state.extension.motion.segmentIndex",
      "Saved segment progress does not match the deterministic route distance.",
    );
  }
  const expectedCompletedSegmentCount =
    inspected.kinematic.cumulativeMicropixels
      .slice(1)
      .filter((boundary) => motion.distanceMicropixels >= boundary).length;
  if (state.completedSegmentCount !== expectedCompletedSegmentCount) {
    issue(
      issues,
      "invalid-completed-segment-count",
      "state.completedSegmentCount",
      "Completed segment count does not match the deterministic route distance.",
    );
  }
  if (
    !samePointWithin(
      motion.unquantizedPosition,
      located.point,
      POSITION_EPSILON,
    )
  ) {
    issue(
      issues,
      "invalid-motion-position",
      "state.extension.motion.unquantizedPosition",
      "Saved motion position does not match its deterministic route distance.",
    );
  }
  const expectedDisplayPosition =
    profile.movement.quantization === "native-pixel"
      ? { x: Math.round(located.point.x), y: Math.round(located.point.y) }
      : located.point;
  if (
    !samePointWithin(
      motion.position,
      expectedDisplayPosition,
      POSITION_EPSILON,
    )
  ) {
    issue(
      issues,
      "invalid-motion-display-position",
      "state.extension.motion.position",
      "Saved display position does not match the selected quantization policy.",
    );
  }
  if (state.lastPhase !== motion.phase) {
    issue(
      issues,
      "invalid-motion-phase",
      "state.lastPhase",
      "Saved movement phase history does not match the motion extension.",
    );
  }
  const walkCycleMicropixels = Math.round(
    profile.animation.pixelsPerWalkCycle *
      ADVENTURE_MOTION_UNITS_PER_PIXEL,
  );
  const expectedWalkCyclePhase =
    walkCycleMicropixels > 0
      ? (motion.distanceMicropixels % walkCycleMicropixels) /
        walkCycleMicropixels
      : 0;
  if (Math.abs(motion.walkCyclePhase - expectedWalkCyclePhase) > 1e-9) {
    issue(
      issues,
      "invalid-walk-cycle-phase",
      "state.extension.motion.walkCyclePhase",
      "Saved walk-cycle phase does not match the travelled native distance.",
    );
  }
  const atRouteEnd =
    motion.distanceMicropixels === inspected.kinematic.totalMicropixels;
  if (
    (motion.phase === "arrived" &&
      (!atRouteEnd || motion.velocityMicropixelsPerSecond !== 0)) ||
    (atRouteEnd && motion.phase !== "arrived")
  ) {
    issue(
      issues,
      "invalid-arrival-state",
      "state.extension.motion.phase",
      "Arrival phase, exact route end and zero velocity must agree.",
    );
  }
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};

const samePointWithin = (
  left: AdventureNativePoint,
  right: AdventureNativePoint,
  tolerance: number,
): boolean =>
  Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;

export class ProfiledNavigationMovementCompatibilityError extends Error {
  readonly issues: readonly ProfiledNavigationCompatibilityIssue[];

  constructor(issues: readonly ProfiledNavigationCompatibilityIssue[]) {
    super(`Profiled navigation movement is incompatible (${issues.length} issue(s)).`);
    this.name = "ProfiledNavigationMovementCompatibilityError";
    this.issues = issues;
  }
}

export const assertProfiledNavigationMovementCompatibility = (
  input: ProfiledNavigationCompatibilityInput,
): void => {
  const issues = validateProfiledNavigationMovementCompatibility(input);
  if (issues.length > 0) throw new ProfiledNavigationMovementCompatibilityError(issues);
};
