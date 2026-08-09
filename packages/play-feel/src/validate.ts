import type { AdventurePlayFeelIssue, AdventurePlayFeelProfile } from "./types.js";

const finite = (value: number): boolean => Number.isFinite(value);
const safeNonnegativeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const safePositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const add = (issues: AdventurePlayFeelIssue[], path: string, message: string): void => {
  issues.push({ severity: "error", code: "invalid-profile", path, message });
};

const positiveFinite = (issues: AdventurePlayFeelIssue[], value: number, path: string): void => {
  if (!finite(value) || value <= 0) add(issues, path, "Expected a positive finite number.");
};

const bounded = (
  issues: AdventurePlayFeelIssue[],
  value: number,
  minimum: number,
  maximum: number,
  path: string,
): void => {
  if (!finite(value) || value < minimum || value > maximum) {
    add(issues, path, `Expected a finite number from ${minimum} to ${maximum}.`);
  }
};

const nonemptyStrings = (issues: AdventurePlayFeelIssue[], values: readonly string[], path: string): void => {
  if (values.length === 0) add(issues, path, "Expected at least one authored rule.");
  values.forEach((value, index) => {
    if (value.trim().length < 12) {
      add(issues, `${path}[${index}]`, "Expected a concrete production instruction.");
    }
  });
};

export const validateAdventurePlayFeelProfile = (
  profile: AdventurePlayFeelProfile,
): readonly AdventurePlayFeelIssue[] => {
  const issues: AdventurePlayFeelIssue[] = [];
  if (profile.profileVersion !== 1) add(issues, "profileVersion", "Expected profile version 1.");
  if (profile.label.trim().length < 3) add(issues, "label", "Expected a readable label.");
  if (profile.summary.trim().length < 24) add(issues, "summary", "Expected a concrete summary.");
  if (!safePositiveInteger(profile.logicalTicksPerSecond) || profile.logicalTicksPerSecond > 240) {
    add(issues, "logicalTicksPerSecond", "Expected a positive safe integer no greater than 240.");
  }

  const movement = profile.movement;
  if (!new Set(["native-pixel", "subpixel"]).has(movement.quantization)) {
    add(issues, "movement.quantization", "Expected a supported motion quantization mode.");
  }
  if (
    !new Set(["replace-immediately", "cancel-and-settle", "finish-current-segment"]).has(
      movement.retargetPolicy,
    )
  ) {
    add(issues, "movement.retargetPolicy", "Expected a supported retarget policy.");
  }
  positiveFinite(issues, movement.topSpeedPixelsPerSecond, "movement.topSpeedPixelsPerSecond");
  positiveFinite(
    issues,
    movement.accelerationPixelsPerSecondSquared,
    "movement.accelerationPixelsPerSecondSquared",
  );
  positiveFinite(
    issues,
    movement.decelerationPixelsPerSecondSquared,
    "movement.decelerationPixelsPerSecondSquared",
  );
  bounded(
    issues,
    movement.minimumStartSpeedPixelsPerSecond,
    0,
    movement.topSpeedPixelsPerSecond,
    "movement.minimumStartSpeedPixelsPerSecond",
  );
  bounded(
    issues,
    movement.arrivalSpeedPixelsPerSecond,
    0,
    movement.topSpeedPixelsPerSecond,
    "movement.arrivalSpeedPixelsPerSecond",
  );
  bounded(issues, movement.arrivalRadiusPixels, 0, 8, "movement.arrivalRadiusPixels");
  bounded(issues, movement.turnSlowdownDegrees, 0, 180, "movement.turnSlowdownDegrees");
  bounded(issues, movement.turnSpeedMultiplier, 0.05, 1, "movement.turnSpeedMultiplier");

  const animation = profile.animation;
  if (animation.phaseMode !== "distance") {
    add(issues, "animation.phaseMode", "Only deterministic distance-locked walk phase is supported.");
  }
  positiveFinite(issues, animation.pixelsPerWalkCycle, "animation.pixelsPerWalkCycle");
  const [leftFootfall, rightFootfall] = animation.footfallPhases;
  bounded(issues, leftFootfall, 0, 0.999999, "animation.footfallPhases[0]");
  bounded(issues, rightFootfall, 0, 0.999999, "animation.footfallPhases[1]");
  if (leftFootfall === rightFootfall) {
    add(issues, "animation.footfallPhases", "Left and right footfalls must use different phases.");
  }
  for (const [path, value] of [
    ["animation.startPoseTicks", animation.startPoseTicks],
    ["animation.turnPoseTicks", animation.turnPoseTicks],
    ["animation.arrivalPoseTicks", animation.arrivalPoseTicks],
    ["animation.actionAnticipationTicks", animation.actionAnticipationTicks],
    ["animation.actionRecoveryTicks", animation.actionRecoveryTicks],
    ["animation.minimumIdleTicks", animation.minimumIdleTicks],
  ] as const) {
    if (!safeNonnegativeInteger(value)) add(issues, path, "Expected a non-negative safe integer.");
  }

  if (!new Set(["fixed", "dead-zone-follow", "shot-led"]).has(profile.camera.mode)) {
    add(issues, "camera.mode", "Expected a supported camera mode.");
  }
  if (!new Set(["native-pixel", "subpixel"]).has(profile.camera.quantization)) {
    add(issues, "camera.quantization", "Expected a supported camera quantization mode.");
  }
  const deadZone = profile.camera.deadZone;
  for (const [path, value] of [
    ["camera.deadZone.left", deadZone.left],
    ["camera.deadZone.right", deadZone.right],
    ["camera.deadZone.top", deadZone.top],
    ["camera.deadZone.bottom", deadZone.bottom],
  ] as const) {
    bounded(issues, value, 0, 1, path);
  }
  if (deadZone.left >= deadZone.right) add(issues, "camera.deadZone", "Left must be less than right.");
  if (deadZone.top >= deadZone.bottom) add(issues, "camera.deadZone", "Top must be less than bottom.");
  positiveFinite(issues, profile.camera.maximumSpeedPixelsPerSecond, "camera.maximumSpeedPixelsPerSecond");
  positiveFinite(
    issues,
    profile.camera.accelerationPixelsPerSecondSquared,
    "camera.accelerationPixelsPerSecondSquared",
  );
  bounded(issues, profile.camera.lookAheadPixels, 0, 160, "camera.lookAheadPixels");
  if (!safeNonnegativeInteger(profile.camera.settleTicks)) {
    add(issues, "camera.settleTicks", "Expected a non-negative safe integer.");
  }

  if (!new Set(["none", "camera-only"]).has(profile.presentation.renderInterpolation)) {
    add(issues, "presentation.renderInterpolation", "Expected a supported render interpolation policy.");
  }

  for (const [path, value] of [
    ["input.hoverCommitTicks", profile.input.hoverCommitTicks],
    ["input.doubleActivationWindowTicks", profile.input.doubleActivationWindowTicks],
    ["input.commandBufferTicks", profile.input.commandBufferTicks],
    ["input.dragThresholdNativePixels", profile.input.dragThresholdNativePixels],
    ["presentation.maximumCatchUpTicks", profile.presentation.maximumCatchUpTicks],
    ["presentation.statusMinimumTicks", profile.presentation.statusMinimumTicks],
    ["presentation.sceneFadeOutTicks", profile.presentation.sceneFadeOutTicks],
    ["presentation.sceneDarkHoldTicks", profile.presentation.sceneDarkHoldTicks],
    ["presentation.sceneFadeInTicks", profile.presentation.sceneFadeInTicks],
  ] as const) {
    if (!safeNonnegativeInteger(value)) add(issues, path, "Expected a non-negative safe integer.");
  }
  if (profile.presentation.maximumCatchUpTicks < 1) {
    add(issues, "presentation.maximumCatchUpTicks", "At least one catch-up tick is required.");
  }
  positiveFinite(
    issues,
    profile.presentation.maximumFrameDeltaMilliseconds,
    "presentation.maximumFrameDeltaMilliseconds",
  );

  nonemptyStrings(issues, profile.authenticityRules, "authenticityRules");
  nonemptyStrings(issues, profile.prohibitedShortcuts, "prohibitedShortcuts");
  nonemptyStrings(issues, profile.reviewQuestions, "reviewQuestions");
  return issues.sort(
    (left, right) => left.path.localeCompare(right.path) || left.message.localeCompare(right.message),
  );
};
