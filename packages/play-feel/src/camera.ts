import type {
  AdventureCameraAdvance,
  AdventureCameraState,
  AdventureCameraTarget,
  AdventureNativePoint,
  AdventureNativeSize,
  AdventurePlayFeelProfile,
} from "./types.js";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finitePoint = (point: AdventureNativePoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const quantize = (point: AdventureNativePoint, profile: AdventurePlayFeelProfile): AdventureNativePoint =>
  profile.camera.quantization === "native-pixel" ? { x: Math.round(point.x), y: Math.round(point.y) } : point;

const clampCamera = (
  point: AdventureNativePoint,
  viewport: AdventureNativeSize,
  world: AdventureNativeSize,
): AdventureNativePoint => ({
  x: clamp(point.x, 0, Math.max(0, world.width - viewport.width)),
  y: clamp(point.y, 0, Math.max(0, world.height - viewport.height)),
});

export const createAdventureCameraState = (
  position: AdventureNativePoint = { x: 0, y: 0 },
): AdventureCameraState => {
  if (!finitePoint(position)) throw new RangeError("Camera position must be finite.");
  return {
    stateVersion: 1,
    tick: 0,
    position: { ...position },
    unquantizedPosition: { ...position },
    velocityPixelsPerSecond: { x: 0, y: 0 },
    settledTicks: 0,
  };
};

const deadZoneDesired = (
  state: AdventureCameraState,
  target: AdventureCameraTarget,
  viewport: AdventureNativeSize,
  profile: AdventurePlayFeelProfile,
): AdventureNativePoint => {
  const zone = profile.camera.deadZone;
  const lookAhead = target.velocityPixelsPerSecond
    ? {
        x: Math.sign(target.velocityPixelsPerSecond.x) * profile.camera.lookAheadPixels,
        y: Math.sign(target.velocityPixelsPerSecond.y) * profile.camera.lookAheadPixels * 0.35,
      }
    : { x: 0, y: 0 };
  const targetX = target.position.x + lookAhead.x;
  const targetY = target.position.y + lookAhead.y;
  const screenX = targetX - state.unquantizedPosition.x;
  const screenY = targetY - state.unquantizedPosition.y;
  let x = state.unquantizedPosition.x;
  let y = state.unquantizedPosition.y;
  const left = viewport.width * zone.left;
  const right = viewport.width * zone.right;
  const top = viewport.height * zone.top;
  const bottom = viewport.height * zone.bottom;
  if (screenX < left) x = targetX - left;
  else if (screenX > right) x = targetX - right;
  if (screenY < top) y = targetY - top;
  else if (screenY > bottom) y = targetY - bottom;
  return { x, y };
};

const desiredCameraPosition = (
  state: AdventureCameraState,
  target: AdventureCameraTarget,
  viewport: AdventureNativeSize,
  world: AdventureNativeSize,
  profile: AdventurePlayFeelProfile,
): AdventureNativePoint => {
  const raw =
    profile.camera.mode === "fixed"
      ? state.unquantizedPosition
      : profile.camera.mode === "shot-led"
        ? (target.shotPosition ?? state.unquantizedPosition)
        : deadZoneDesired(state, target, viewport, profile);
  return clampCamera(raw, viewport, world);
};

const advanceAxis = (
  position: number,
  velocity: number,
  desired: number,
  profile: AdventurePlayFeelProfile,
): { readonly position: number; readonly velocity: number } => {
  const ticksPerSecond = profile.logicalTicksPerSecond;
  const delta = desired - position;
  const acceleration = profile.camera.accelerationPixelsPerSecondSquared;
  const maxSpeed = profile.camera.maximumSpeedPixelsPerSecond;
  if (Math.abs(delta) < 1e-6 && Math.abs(velocity) < 1e-6) {
    return { position: desired, velocity: 0 };
  }
  const stoppingDistance = (velocity * velocity) / (2 * acceleration);
  const desiredDirection = Math.sign(delta);
  const movingToward = Math.sign(velocity) === desiredDirection || velocity === 0;
  const accelerationDirection =
    movingToward && Math.abs(delta) > stoppingDistance
      ? desiredDirection
      : -Math.sign(velocity || -desiredDirection);
  const nextVelocity = clamp(
    velocity + (accelerationDirection * acceleration) / ticksPerSecond,
    -maxSpeed,
    maxSpeed,
  );
  const proposed = position + nextVelocity / ticksPerSecond;
  if ((desired - position) * (desired - proposed) <= 0) {
    return { position: desired, velocity: 0 };
  }
  return { position: proposed, velocity: nextVelocity };
};

const advanceOneTick = (
  state: AdventureCameraState,
  target: AdventureCameraTarget,
  viewport: AdventureNativeSize,
  world: AdventureNativeSize,
  profile: AdventurePlayFeelProfile,
): AdventureCameraAdvance => {
  if (!finitePoint(target.position)) throw new RangeError("Camera target position must be finite.");
  if (target.velocityPixelsPerSecond && !finitePoint(target.velocityPixelsPerSecond)) {
    throw new RangeError("Camera target velocity must be finite.");
  }
  if (target.shotPosition && !finitePoint(target.shotPosition)) {
    throw new RangeError("Camera shot position must be finite.");
  }
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    !Number.isFinite(world.width) ||
    !Number.isFinite(world.height) ||
    world.width <= 0 ||
    world.height <= 0
  ) {
    throw new RangeError("Camera viewport and world dimensions must be positive and finite.");
  }
  const desired = desiredCameraPosition(state, target, viewport, world, profile);
  const x = advanceAxis(state.unquantizedPosition.x, state.velocityPixelsPerSecond.x, desired.x, profile);
  const y = advanceAxis(state.unquantizedPosition.y, state.velocityPixelsPerSecond.y, desired.y, profile);
  const distance = Math.hypot(desired.x - x.position, desired.y - y.position);
  const settledTicks = distance < 0.05 ? state.settledTicks + 1 : 0;
  const snap = settledTicks >= profile.camera.settleTicks;
  const unquantizedPosition = snap ? desired : clampCamera({ x: x.position, y: y.position }, viewport, world);
  const velocityPixelsPerSecond = snap ? { x: 0, y: 0 } : { x: x.velocity, y: y.velocity };
  const next: AdventureCameraState = {
    stateVersion: 1,
    tick: state.tick + 1,
    position: quantize(unquantizedPosition, profile),
    unquantizedPosition,
    velocityPixelsPerSecond,
    settledTicks,
  };
  return {
    state: next,
    desiredPosition: desired,
    moved: next.position.x !== state.position.x || next.position.y !== state.position.y,
  };
};

export const advanceAdventureCamera = (
  state: AdventureCameraState,
  target: AdventureCameraTarget,
  viewport: AdventureNativeSize,
  world: AdventureNativeSize,
  profile: AdventurePlayFeelProfile,
  ticks = 1,
): AdventureCameraAdvance => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Camera advancement must be a non-negative safe integer.");
  }
  let next = state;
  let desiredPosition = state.unquantizedPosition;
  let moved = false;
  for (let tick = 0; tick < ticks; tick += 1) {
    const advanced = advanceOneTick(next, target, viewport, world, profile);
    next = advanced.state;
    desiredPosition = advanced.desiredPosition;
    moved ||= advanced.moved;
  }
  return { state: next, desiredPosition, moved };
};

export const interpolateAdventureCameraPresentation = (
  previous: AdventureCameraState,
  current: AdventureCameraState,
  interpolationAlpha: number,
  profile: AdventurePlayFeelProfile,
): AdventureNativePoint => {
  if (!Number.isFinite(interpolationAlpha) || interpolationAlpha < 0 || interpolationAlpha > 1) {
    throw new RangeError("Camera interpolation alpha must be from 0 to 1.");
  }
  if (profile.presentation.renderInterpolation === "none") {
    return current.position;
  }
  return quantize(
    {
      x:
        previous.unquantizedPosition.x +
        (current.unquantizedPosition.x - previous.unquantizedPosition.x) * interpolationAlpha,
      y:
        previous.unquantizedPosition.y +
        (current.unquantizedPosition.y - previous.unquantizedPosition.y) * interpolationAlpha,
    },
    profile,
  );
};
