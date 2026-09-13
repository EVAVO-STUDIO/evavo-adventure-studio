import type {
  AdventureFootfall,
  AdventureKinematicRoute,
  AdventureMotionAdvance,
  AdventureMotionRuntimeTuning,
  AdventureMotionState,
  AdventureMotionTrace,
  AdventureMotionTraceSample,
  AdventureNativePoint,
  AdventurePlayFeelProfile,
} from "./types.js";

export const ADVENTURE_MOTION_UNITS_PER_PIXEL = 1024;
const EPSILON = 1e-9;

const finitePoint = (point: AdventureNativePoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const toMicropixels = (pixels: number): number => {
  if (!Number.isFinite(pixels)) {
    throw new RangeError("Motion values must be finite.");
  }
  const value = Math.round(pixels * ADVENTURE_MOTION_UNITS_PER_PIXEL);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Motion values exceed the deterministic fixed-unit range.");
  }
  return value;
};

const toPixels = (micropixels: number): number => micropixels / ADVENTURE_MOTION_UNITS_PER_PIXEL;

const quantizePoint = (
  point: AdventureNativePoint,
  profile: AdventurePlayFeelProfile,
): AdventureNativePoint =>
  profile.movement.quantization === "native-pixel"
    ? { x: Math.round(point.x), y: Math.round(point.y) }
    : point;

export class AdventureKinematicRouteError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "AdventureKinematicRouteError";
  }
}

export const createAdventureKinematicRoute = (
  points: readonly AdventureNativePoint[],
): AdventureKinematicRoute => {
  if (points.length < 2) {
    throw new AdventureKinematicRouteError("A kinematic route requires at least two points.");
  }
  const copied = points.map((point, index) => {
    if (!finitePoint(point)) {
      throw new AdventureKinematicRouteError(`Route point ${index} must be finite.`);
    }
    return { x: point.x, y: point.y };
  });
  const segmentLengthsMicropixels: number[] = [];
  const cumulativeMicropixels = [0];
  let totalMicropixels = 0;
  for (let index = 0; index < copied.length - 1; index += 1) {
    const from = copied[index];
    const to = copied[index + 1];
    if (!from || !to) continue;
    const length = toMicropixels(Math.hypot(to.x - from.x, to.y - from.y));
    if (length <= 0) {
      throw new AdventureKinematicRouteError(
        `Route points ${index} and ${index + 1} occupy the same position.`,
      );
    }
    if (!Number.isSafeInteger(totalMicropixels + length)) {
      throw new AdventureKinematicRouteError("Route length exceeds the deterministic fixed-unit range.");
    }
    totalMicropixels += length;
    segmentLengthsMicropixels.push(length);
    cumulativeMicropixels.push(totalMicropixels);
  }
  return {
    points: copied,
    segmentLengthsMicropixels,
    cumulativeMicropixels,
    totalMicropixels,
  };
};

const segmentIndexAtDistance = (route: AdventureKinematicRoute, distanceMicropixels: number): number => {
  if (distanceMicropixels >= route.totalMicropixels) {
    return route.segmentLengthsMicropixels.length - 1;
  }
  for (let index = 0; index < route.segmentLengthsMicropixels.length; index += 1) {
    const end = route.cumulativeMicropixels[index + 1];
    if (end !== undefined && distanceMicropixels < end) return index;
  }
  return Math.max(0, route.segmentLengthsMicropixels.length - 1);
};

const pointAtDistance = (
  route: AdventureKinematicRoute,
  distanceMicropixels: number,
): {
  readonly point: AdventureNativePoint;
  readonly segmentIndex: number;
  readonly distanceAlongSegmentMicropixels: number;
} => {
  const distance = clamp(distanceMicropixels, 0, route.totalMicropixels);
  const segmentIndex = segmentIndexAtDistance(route, distance);
  const from = route.points[segmentIndex];
  const to = route.points[segmentIndex + 1];
  const segmentLength = route.segmentLengthsMicropixels[segmentIndex];
  const segmentStart = route.cumulativeMicropixels[segmentIndex] ?? 0;
  if (!from || !to || !segmentLength) {
    throw new AdventureKinematicRouteError("Route geometry is incomplete.");
  }
  const along = clamp(distance - segmentStart, 0, segmentLength);
  const progress = along / segmentLength;
  return {
    point: {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    },
    segmentIndex,
    distanceAlongSegmentMicropixels: along,
  };
};

const angleBetweenSegments = (route: AdventureKinematicRoute, firstSegmentIndex: number): number | null => {
  const firstFrom = route.points[firstSegmentIndex];
  const pivot = route.points[firstSegmentIndex + 1];
  const secondTo = route.points[firstSegmentIndex + 2];
  if (!firstFrom || !pivot || !secondTo) return null;
  const firstX = pivot.x - firstFrom.x;
  const firstY = pivot.y - firstFrom.y;
  const secondX = secondTo.x - pivot.x;
  const secondY = secondTo.y - pivot.y;
  const firstLength = Math.hypot(firstX, firstY);
  const secondLength = Math.hypot(secondX, secondY);
  if (firstLength <= EPSILON || secondLength <= EPSILON) return null;
  const cosine = clamp((firstX * secondX + firstY * secondY) / (firstLength * secondLength), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
};

const brakingDistance = (
  velocityMicropixelsPerSecond: number,
  targetVelocityMicropixelsPerSecond: number,
  decelerationMicropixelsPerSecondSquared: number,
): number => {
  if (velocityMicropixelsPerSecond <= targetVelocityMicropixelsPerSecond) return 0;
  return Math.ceil(
    (velocityMicropixelsPerSecond * velocityMicropixelsPerSecond -
      targetVelocityMicropixelsPerSecond * targetVelocityMicropixelsPerSecond) /
      (2 * decelerationMicropixelsPerSecondSquared),
  );
};

const phaseCrossed = (from: number, to: number, target: number): boolean =>
  to >= from ? target > from && target <= to : target > from || target <= to;

const resolveFootfall = (
  previousPhase: number,
  nextPhase: number,
  profile: AdventurePlayFeelProfile,
): AdventureFootfall => {
  const [left, right] = profile.animation.footfallPhases;
  const leftCrossed = phaseCrossed(previousPhase, nextPhase, left);
  const rightCrossed = phaseCrossed(previousPhase, nextPhase, right);
  if (leftCrossed && rightCrossed) {
    const leftDistance = (left - previousPhase + 1) % 1;
    const rightDistance = (right - previousPhase + 1) % 1;
    return leftDistance <= rightDistance ? "left" : "right";
  }
  return leftCrossed ? "left" : rightCrossed ? "right" : null;
};

const targetVelocityForTurn = (
  route: AdventureKinematicRoute,
  state: AdventureMotionState,
  profile: AdventurePlayFeelProfile,
  topVelocity: number,
  deceleration: number,
): { readonly limit: number; readonly cornering: boolean } => {
  const angle = angleBetweenSegments(route, state.segmentIndex);
  if (angle === null || angle < profile.movement.turnSlowdownDegrees) {
    return { limit: topVelocity, cornering: false };
  }
  const boundary = route.cumulativeMicropixels[state.segmentIndex + 1];
  if (boundary === undefined) return { limit: topVelocity, cornering: false };
  const distanceToTurn = Math.max(0, boundary - state.distanceMicropixels);
  const cornerVelocity = Math.round(topVelocity * profile.movement.turnSpeedMultiplier);
  const permitted = Math.floor(
    Math.sqrt(cornerVelocity * cornerVelocity + 2 * deceleration * distanceToTurn),
  );
  return { limit: Math.min(topVelocity, permitted), cornering: permitted < topVelocity };
};

const crossedSegments = (
  route: AdventureKinematicRoute,
  previousDistance: number,
  nextDistance: number,
): readonly number[] => {
  const crossed: number[] = [];
  for (let index = 1; index < route.cumulativeMicropixels.length; index += 1) {
    const boundary = route.cumulativeMicropixels[index];
    if (boundary !== undefined && previousDistance < boundary && nextDistance >= boundary) {
      crossed.push(index - 1);
    }
  }
  return crossed;
};

export const createAdventureMotionState = (
  route: AdventureKinematicRoute,
  profile: AdventurePlayFeelProfile,
): AdventureMotionState => {
  const located = pointAtDistance(route, 0);
  const startVelocity = toMicropixels(profile.movement.minimumStartSpeedPixelsPerSecond);
  return {
    stateVersion: 1,
    tick: 0,
    phase: "starting",
    distanceMicropixels: 0,
    velocityMicropixelsPerSecond: startVelocity,
    distanceRemainder: 0,
    segmentIndex: located.segmentIndex,
    distanceAlongSegmentMicropixels: located.distanceAlongSegmentMicropixels,
    position: quantizePoint(located.point, profile),
    unquantizedPosition: located.point,
    walkCyclePhase: 0,
  };
};

const advanceOneTick = (
  state: AdventureMotionState,
  route: AdventureKinematicRoute,
  profile: AdventurePlayFeelProfile,
  tuning: AdventureMotionRuntimeTuning,
): AdventureMotionAdvance => {
  if (state.phase === "arrived") {
    return {
      state: { ...state, tick: state.tick + 1 },
      crossedSegmentIndexes: [],
      distanceAdvancedPixels: 0,
      arrived: true,
      footfall: null,
    };
  }
  const ticksPerSecond = profile.logicalTicksPerSecond;
  const tunedTopSpeed = tuning.topSpeedPixelsPerSecond ?? profile.movement.topSpeedPixelsPerSecond;
  if (!Number.isFinite(tunedTopSpeed) || tunedTopSpeed <= 0) {
    throw new RangeError("Motion top-speed tuning must be a positive finite number.");
  }
  const topVelocity = toMicropixels(tunedTopSpeed);
  const arrivalVelocity = toMicropixels(profile.movement.arrivalSpeedPixelsPerSecond);
  const acceleration = toMicropixels(profile.movement.accelerationPixelsPerSecondSquared);
  const deceleration = toMicropixels(profile.movement.decelerationPixelsPerSecondSquared);
  const remaining = Math.max(0, route.totalMicropixels - state.distanceMicropixels);
  const arrivalLimit = Math.floor(
    Math.sqrt(arrivalVelocity * arrivalVelocity + 2 * deceleration * remaining),
  );
  const turn = targetVelocityForTurn(route, state, profile, topVelocity, deceleration);
  const targetVelocity = Math.min(topVelocity, arrivalLimit, turn.limit);
  const accelerationPerTick = Math.max(1, Math.round(acceleration / ticksPerSecond));
  const decelerationPerTick = Math.max(1, Math.round(deceleration / ticksPerSecond));
  const velocity =
    state.velocityMicropixelsPerSecond < targetVelocity
      ? Math.min(targetVelocity, state.velocityMicropixelsPerSecond + accelerationPerTick)
      : Math.max(targetVelocity, state.velocityMicropixelsPerSecond - decelerationPerTick);
  const distanceNumerator = state.distanceRemainder + velocity;
  const requestedStep = Math.max(1, Math.floor(distanceNumerator / ticksPerSecond));
  const nextRemainder = distanceNumerator % ticksPerSecond;
  const nextDistance = Math.min(route.totalMicropixels, state.distanceMicropixels + requestedStep);
  const located = pointAtDistance(route, nextDistance);
  const cycleLength = toMicropixels(profile.animation.pixelsPerWalkCycle);
  const nextWalkCyclePhase = cycleLength > 0 ? (nextDistance % cycleLength) / cycleLength : 0;
  const footfall = resolveFootfall(state.walkCyclePhase, nextWalkCyclePhase, profile);
  const arrived = nextDistance >= route.totalMicropixels;
  const arrivalRadius = toMicropixels(profile.movement.arrivalRadiusPixels);
  const phase = arrived
    ? "arrived"
    : remaining <= Math.max(arrivalRadius, brakingDistance(velocity, arrivalVelocity, deceleration))
      ? "arriving"
      : turn.cornering
        ? "cornering"
        : velocity < topVelocity
          ? "starting"
          : "moving";
  const nextState: AdventureMotionState = {
    stateVersion: 1,
    tick: state.tick + 1,
    phase,
    distanceMicropixels: nextDistance,
    velocityMicropixelsPerSecond: arrived ? 0 : velocity,
    distanceRemainder: arrived ? 0 : nextRemainder,
    segmentIndex: located.segmentIndex,
    distanceAlongSegmentMicropixels: located.distanceAlongSegmentMicropixels,
    position: quantizePoint(located.point, profile),
    unquantizedPosition: located.point,
    walkCyclePhase: nextWalkCyclePhase,
  };
  return {
    state: nextState,
    crossedSegmentIndexes: crossedSegments(route, state.distanceMicropixels, nextDistance),
    distanceAdvancedPixels: toPixels(nextDistance - state.distanceMicropixels),
    arrived,
    footfall,
  };
};

export const advanceAdventureMotion = (
  state: AdventureMotionState,
  route: AdventureKinematicRoute,
  profile: AdventurePlayFeelProfile,
  ticks = 1,
  tuning: AdventureMotionRuntimeTuning = {},
): AdventureMotionAdvance => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Motion advancement must be a non-negative safe integer.");
  }
  let next = state;
  const crossed: number[] = [];
  let distanceAdvancedPixels = 0;
  let footfall: AdventureFootfall = null;
  for (let tick = 0; tick < ticks; tick += 1) {
    const advanced = advanceOneTick(next, route, profile, tuning);
    next = advanced.state;
    crossed.push(...advanced.crossedSegmentIndexes);
    distanceAdvancedPixels += advanced.distanceAdvancedPixels;
    if (advanced.footfall) footfall = advanced.footfall;
  }
  return {
    state: next,
    crossedSegmentIndexes: crossed,
    distanceAdvancedPixels,
    arrived: next.phase === "arrived",
    footfall,
  };
};

export const simulateAdventureMotion = (
  points: readonly AdventureNativePoint[],
  profile: AdventurePlayFeelProfile,
  maximumTicks = 36_000,
  tuning: AdventureMotionRuntimeTuning = {},
): AdventureMotionTrace => {
  if (!Number.isSafeInteger(maximumTicks) || maximumTicks <= 0) {
    throw new RangeError("maximumTicks must be a positive safe integer.");
  }
  const route = createAdventureKinematicRoute(points);
  let state = createAdventureMotionState(route, profile);
  const samples: AdventureMotionTraceSample[] = [
    {
      tick: state.tick,
      phase: state.phase,
      position: state.position,
      unquantizedPosition: state.unquantizedPosition,
      velocityPixelsPerSecond: toPixels(state.velocityMicropixelsPerSecond),
      distancePixels: toPixels(state.distanceMicropixels),
      walkCyclePhase: state.walkCyclePhase,
      footfall: null,
    },
  ];
  while (state.phase !== "arrived" && state.tick < maximumTicks) {
    const advanced = advanceAdventureMotion(state, route, profile, 1, tuning);
    state = advanced.state;
    samples.push({
      tick: state.tick,
      phase: state.phase,
      position: state.position,
      unquantizedPosition: state.unquantizedPosition,
      velocityPixelsPerSecond: toPixels(state.velocityMicropixelsPerSecond),
      distancePixels: toPixels(state.distanceMicropixels),
      walkCyclePhase: state.walkCyclePhase,
      footfall: advanced.footfall,
    });
  }
  if (state.phase !== "arrived") {
    throw new RangeError(`Motion did not arrive within ${maximumTicks} ticks.`);
  }
  return { profileId: profile.id, route, samples, arrivalTick: state.tick };
};
